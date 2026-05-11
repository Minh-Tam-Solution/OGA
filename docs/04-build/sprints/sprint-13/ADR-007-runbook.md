---
adr_id: ADR-007
type: "Operational Runbook"
status: "DRAFT"
date: "2026-05-10"
owner: "@architect"
reviewers: ["@cto", "@cpo"]
---

# ADR-007 v4 Operational Runbook

**Voice Production Pipeline — OGA as Consumer of AI-Platform Voice Services**

---

## 1. Quick Reference

| Component | Location | Owner |
|-----------|----------|-------|
| Voice client | `src/lib/aiPlatformVoiceClient.js` | @coder |
| Proxy route | `app/api/voice/tts/route.js` | @coder |
| Voice UI | `packages/studio/src/components/VoiceStudio.jsx` | @coder |
| AI-Platform gateway | `http://bflow-ai-gateway:8120` | AI-Platform PJM |
| Voice service | `bflow-ai-voice:8121` | AI-Platform PJM |
| MinIO assets | `ai-platform-minio:9000` (host: `localhost:9020`) | AI-Platform PJM |

---

## 2. Latency Baseline (from 2026-05-10 smoke)

| Engine | Cold Latency | Warm Latency | p95 Alert Threshold (2× cold) |
|--------|-------------|--------------|------------------------------|
| Piper VAIS1000 | ~1000ms | ~20ms | **2000ms** |
| MeloTTS VN | ~1400ms | ~15ms | **2800ms** |

> **Note:** Cold latency = first request after container restart. Warm = cached model. Use cold threshold for production alerting.

---

## 3. Daily Ops Checklist

### 3.1 Morning (q15min window)

- [ ] `GET /api/v1/voice/health` → `status: "healthy"`
- [ ] `GET /api/v1/voice/tts/voices` → `vi-piper-vais1000`, `vi-melotts-default`, `en-piper-libritts-f` present
- [ ] GPU `degrade_level: normal` (not `critical`)
- [ ] No `UndefinedColumnError` in `api_key_access_logs`
- [ ] No Whisper retry storm in logs
- [ ] Voice container uptime > previous check (no unexpected restart)

### 3.2 End of Day

- [ ] Review `api_key_access_logs` for `status_code >= 500`
- [ ] Check MinIO bucket `voice-assets` storage growth
- [ ] Confirm no unplanned OOM (exit 137) in container history

---

## 4. Failover Behavior

### 4.1 Automatic Failover (Client-Side)

```
User request → VoiceStudio UI
  → POST /api/voice/tts
    → aiPlatformVoiceClient.synthesize()
      → AI-Platform Gateway
        → Voice Service
```

**Failure chain:**
1. Piper 503/unavailable → client auto-fallback to MeloTTS (same language)
2. MeloTTS 503/unavailable → propagate 503 to user ("Service warming up, retry")
3. Gateway 502/504 → bounded retry 2× (1s, 2s), then propagate
4. Connection error → bounded retry 2× (2s, 4s), then log alert

### 4.2 Manual Failover

If both Piper and MeloTTS fail:
1. Check AI-Platform gateway health: `curl http://localhost:8120/api/v1/voice/health`
2. If gateway healthy but voice service degraded → escalate to AI-Platform PJM (S123)
3. If gateway down → check `ai-net` network, restart `bflow-ai-gateway` container
4. Temporarily disable Voice Studio tab via feature flag if prolonged outage

---

## 5. Rollback Procedure

### 5.1 Rollback Voice Studio UI

```bash
# Revert to pre-Track B state
git revert --no-commit <track-b-merge-commit>
# Or manually: remove 'voice' tab from StandaloneShell.js TABS array
```

### 5.2 Rollback Proxy Route

```bash
# Disable voice proxy by removing route file
mv app/api/voice/tts/route.js app/api/voice/tts/route.js.disabled
# Next.js will return 404 for /api/voice/tts
```

### 5.3 Database Rollback (if registry changes)

```sql
-- Only if voice registry rows were modified
-- Revert to pre-Track B registry state
DELETE FROM voice.tts_voices WHERE voice_id = 'vi-melotts-default';
```

---

## 6. On-Call Roster

| Tier | Contact | Escalation Trigger |
|------|---------|-------------------|
| L1 — OGA Dev | @coder | Voice UI errors, 503 user reports |
| L2 — OGA Architect | @architect | Failover not resolving, gateway down |
| L3 — AI-Platform PJM | @ai-platform-pjm | Voice service degraded, image rebuild needed |
| L4 — CTO | @cto | Cross-platform GPU contention, security incident |

**Escalation path:**
```
L1 (5 min auto-triage)
  → L2 (if not resolved in 15 min)
    → L3 (if AI-Platform service issue)
      → L4 (if governance/policy decision needed)
```

---

## 7. Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| TTS latency p95 | > 2000ms | > 5000ms | Check gateway load, consider MeloTTS primary |
| 503 rate | > 1% | > 5% | Escalate to AI-Platform PJM |
| Voice container OOM | 1×/day | 3×/day | Check memory limit, request image rebuild |
| Gateway health fail | 1 check | 3 consecutive | Restart gateway container |
| Presigned URL 403 | > 10% | > 50% | Defect #20 workaround degraded |

---

## 8. Known Issues & Workarounds

### Defect #20 — MinIO Presigned URL Hostname

**Symptom:** `audio_url` returns `http://ai-platform-minio:9000/...` which fails from host/browser with DNS/403 error.

**Workarounds:**
1. **Container fetch:** Run audio fetch inside `ai-platform_ai-platform-network`
2. **Gateway streaming:** AI-Platform S118(p) fix (not yet implemented)
3. **Host override:** Add `ai-platform-minio` to `/etc/hosts` → `127.0.0.1` (signature may still mismatch)

**Current mitigation:** VoiceStudio uses `<audio src>` element; browser handles fetch. If CORS/403, user sees player error.

### OOM Auto-Restart

**Symptom:** `bflow-ai-voice` exits with code 137 when MeloTTS + Whisper loaded concurrently.

**Mitigation:** `restart: unless-stopped` + 6G memory limit + `STT_LAZY_LOAD` env wired.

**Verification:** Check `docker ps` after restart — container should auto-recover within seconds.

---

## 9. Environment Variables & Key Rotation

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| `AIP_VOICE_API_KEY` | ✅ | — | Primary AI-Platform API key |
| `AIPLATFORM_VOICE_API_KEY` | Fallback | — | Backward compat fallback |
| `AIP_GATEWAY_URL` | ✅ | `http://localhost:8120` | AI-Platform gateway URL |
| `AIP_VOICE_TIMEOUT_MS` | ❌ | `30000` | Read timeout for synthesis |

**Security:** `.env.local` is git-ignored and should have `0600` permissions.
> **Update 2026-05-15:** 1Password vault not yet provisioned. API key remains in `.env.local` on deployed hosts. Revisit when vault available.

### Key Rotation Procedure (CTO-mandated)

**Current key:** `aip_5dd4...` | **Expires:** 2026-05-24 | **Vaulted:** ❌ (outstanding)

| Step | Owner | Action |
|------|-------|--------|
| 1 | @oga-devops | Generate new key in AI-Platform admin panel |
| 2 | @oga-devops | ~~Add to 1Password vault~~ (vault not yet provisioned) |
| 3 | @oga-devops | Update `.env.local` on all deployed hosts |
| 4 | @oga-pjm | Verify smoke test passes with new key |
| 5 | @oga-devops | Revoke old key in AI-Platform admin panel |
| 6 | @architect | Update runbook with new expiry date |

**Rotation cadence:** Every 30 days for production keys. Next rotation target: 2026-06-24.

**Expiry response:** If key expires uncaught, gateway returns `401 Unauthorized`. VoiceStudio falls through to 503-class retry which does NOT resolve auth errors. Symptom: "Service warming up" forever. **Escalate immediately to L2 if auth errors persist >5 min.**

---

## 10. Post-Incident Review Template

```
Date: YYYY-MM-DD
Incident: [Brief description]
Impact: [Users affected, duration]
Root Cause: [Technical reason]
Resolution: [Fix applied]
Follow-up: [Preventive action]
```

Every OOM, 503 storm, or gateway outage → create incident doc in `docs/05-test/incidents/`.

---

*Runbook version: 2026-05-10-draft | Next review: Post-ADR-008 acceptance*
