---
type: "Track B Live Smoke Results"
date: "2026-05-10"
updated: "2026-05-11"
status: "PASSED"
authority: "@cto approved + @cpo final countersign"
---

# Track B Live Smoke Test Results

**Date:** 2026-05-10  
**Tester:** @coder (automated script)  
**Gateway:** `http://localhost:8120`  
**Script:** `scripts/smoke_track_b.mjs`

---

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Voices registered | ✅ PASS | 7 voices including `vi-piper-vais1000`, `vi-melotts-default` |
| 2 | Piper synthesis | ✅ PASS | Audio generated, 575ms duration |
| 3 | MeloTTS synthesis | ✅ PASS | Audio generated, 1850ms duration |
| 4 | Invalid voice rejection | ✅ PASS | 404 returned for `nonexistent-voice-999` |
| 5 | Presigned URL | ⚠️ KNOWN ISSUE | Defect #20 — hostname-bound, 403 from host. Workaround: fetch inside docker network |

---

## Latency Baseline (for q15min monitoring)

### Cold (first request, cache miss)

| Engine | Total Latency | Processing | p95 Threshold (2×) |
|--------|--------------|------------|-------------------|
| Piper VAIS1000 | **1004 ms** | 992 ms | **2008 ms** |
| MeloTTS VN | **1419 ms** | 1409 ms | **2838 ms** |

### Warm (subsequent requests, cache hit)

| Engine | Total Latency | Processing | p95 Threshold (2×) |
|--------|--------------|------------|-------------------|
| Piper VAIS1000 | **23 ms** | 2 ms | **46 ms** |
| MeloTTS VN | **17 ms** | 3 ms | **34 ms** |

**CTO guidance:** Use cold latency for q15min p95 threshold (production users hit cold paths). Warm latency is dev/cache-only.

---

## Observations

- **MeloTTS processing time** (~1409ms cold) confirms higher latency vs Piper (~992ms)
- **Audio duration mismatch**: Piper 575ms vs MeloTTS 1850ms for same text — MeloTTS speaks slower/naturally
- **Invalid voice 404**: Response body lacks `error` field (`undefined`) — minor API response format gap
- **Defect #20**: Presigned URL fetch 403 from host. VoiceStudio component uses `<audio src>` which browser handles; if CORS/403 occurs, component will surface error via `onError`

---

## API Key Resolution (2026-05-11)

**Root cause:** `.env.local` only had `AIPLATFORM_VOICE_API_KEY` but `aiPlatformVoiceClient.js` checks `AIP_VOICE_API_KEY` first.

**Fix:** Both env vars now set with identical key:
- `AIP_VOICE_API_KEY=aip_5dd4...` (primary)
- `AIPLATFORM_VOICE_API_KEY=aip_5dd4...` (fallback, backward compat)

**Verification chain:**

| Layer | Check | Result |
|-------|-------|--------|
| 1. File | Both vars present, SHA256 match | ✅ |
| 2. Client | Simulated `process.env.AIP_VOICE_API_KEY` | ✅ |
| 3. Live API | `curl POST /api/v1/voice/tts/synthesize` | ✅ HTTP 200, 418ms MeloTTS |
| 4. Audit | `api_key_access_logs` row | ✅ `status_code=200`, `response_time_ms=418` |

**Key metadata:**
- Expires: **2026-05-24 01:45 UTC** (13 days)
- App ID: `oga-spike-e-tts-eval`
- Permissions: `["voice.tts"]`

**⚠️ Security reminder:** Key still in `.env.local` on shared workstation. Transfer to 1Password vault before expiry.

---

## Next Steps

1. **q15min monitoring** — Active. Alert if total latency > 2008ms (Piper) or > 2838ms (MeloTTS)
2. **ADR-007 runbook** (Task 13.5) — Can start now with empirical baseline
3. **ADR-008 draft** (Task 13.0a) — Kickoff Mon 2026-05-13 per CTO commitment
4. **1Password transfer** — Before 2026-05-24 expiry
