---
type: "S118 / S123 Tracking Log"
project: "AI-Platform Voice Service"
owner: "@pm (OGA)"
cadence: "Every Monday + Thursday"
escalation: "@human if zero progress 2 weeks"
related: "PJM ticket AI-Platform/audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md"
alias: "S118 = AI-Platform internal naming S123 (post-rename 2026-05-09). OGA consumer-side artifacts retain S118 for continuity."
---

# S118 Status Tracking Log

> **Naming Note:** OGA uses "S118" (pre-rename consumer-facing label). AI-Platform internal backlog is **S123**. Cross-mapping maintained in table below.

## 2026-05-10 (S13 Kickoff)

**Voice container status:** `bflow-ai-voice` Up 8 hours (stable since last restart)  
**OOM incidents today:** 2× (exit 137) — both recovered via manual `docker start`  
**MeloTTS callable:** ✅ YES (registry seeded, VN fork hot-patched)  
**Image persistence:** ⚠️ NO — hot-patch only; recreate = revert to broken  

| Issue | OGA Priority | Maps to AI-Platform S123 | Pre-stage State | PJM Status | OGA Risk | Next Check |
|-------|-------------|------------------------|----------------|------------|----------|------------|
| #1 MeloTTS image rebuild | P0 | Cross-cutting (Path B → S115 baseline) | Code fixes shipped: WS-A gpu_budget + WS-B /v1/health + WS-D auth + provision script. Image rebuild is consumer. | Ticket created, awaiting PJM assignment | HIGH — recreate breaks fallback | 2026-05-12 (Thu) |
| #2 OOM auto-restart | P1 | **NOT in S123 scope** — needs ADR-090 row addition or S124+ | Out-of-scope; net-new item for Mon 05-12 ratification | Ticket created, P1-active per CTO advisory | HIGH — each OOM = 503 outage | 2026-05-12 (Thu) |
| #3 Network detach on restart | P1 | ADR-090 row (q) — NEW from OGA PJM ticket | Tracked in audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md; not pre-staged | Ticket created | MEDIUM — manual fix known | 2026-05-12 (Thu) |
| #4 DB migration (status_code) | P2 | WS-D row (a) MeloTTS | DRAFT pre-staged at versions-draft/melotts_voice_registry_seed.draft.py (885b9906d); promotion blocked on voice-ID alignment | Ticket created | LOW — non-blocking warning | 2026-05-12 (Thu) |

**Cross-mapping received from AI-Platform:** 2026-05-10. 12/16 S123 rows closed/verified at pre-stage. Issue #2 (auto-restart) is the only net-new item requiring scope decision at Mon 05-12 ratification.

**Action:** PM will ping AI-Platform PJM every Mon+Thu. This file updated each check.

---

## 2026-05-10 (S118 UNBLOCKED — All 4 Criteria PASS)

**Voice container status:** `bflow-ai-voice` healthy, running new image `sha256:5289210586025...`  
**OOM incidents since last check:** 0 (container stable)  
**MeloTTS callable:** ✅ YES — persistent image, no hot-patch required  
**Image rebuilt (persistent):** ✅ YES — origin/main @ `18f43ea84`, 25 commits durably pushed

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1. Fresh build + run produces `vi-melotts-default` 200 OK | ✅ PASS | HTTP 200 + ~4s audio synthesized + presigned MinIO URL returned |
| 2. `docker restart` preserves network attachment | ✅ PASS | `ai-platform_ai-platform-network` (IP 172.26.0.11) preserved post-restart |
| 3. `api_key_access_logs` has `status_code` column | ✅ PASS | All 3 columns added (`status_code`, `response_time_ms`, `request_id`) + index |
| 4. Auto-restart policy active (recovers from OOM) | ✅ PASS | `restart: unless-stopped` set; mem limit 6G (was 3G); `STT_LAZY_LOAD` env wired |

**End-to-end synthesis evidence:**
```json
{
  "audio_url": "http://ai-platform-minio:9000/voice-assets/.../32adfeb8....wav?...",
  "duration_ms": 3997,
  "engine": "melotts",
  "voice_id": "vi-melotts-default",
  "processing_time_ms": 3737,
  "watermark_key": "NQH-AI:vi-melotts-default:..."
}
```

**Build trajectory:**

| Build | Issue | Fix Commit |
|-------|-------|------------|
| #1 (initial) | `unidic` module missing — pre-existing `python -m unidic download` assumed upstream MeloTTS | `3d1a965a0` — drop unidic step (VN fork uses underthesea) |
| #2 (post-unidic-fix) | `melo/configs/config.json` missing — fork's pyproject doesn't ship configs/ | `18f43ea84` — curl config.json from fork main into installed pkg dir |
| #3 (final) | Healthy startup + MeloTTS + Piper registered + GPU per-process VRAM working | — |

**Operational verification (q15min monitoring):**
- [ ] Voice service stays healthy (was previously degraded most of soak)
- [ ] No Whisper retry storm in logs (WS-B non-probing health verified)
- [ ] GPU `degrade_level: normal` not `critical` (WS-A per-process VRAM verified)
- [ ] No `UndefinedColumnError` for `status_code` in audit logs (Issue 3 verified)
- [ ] Auto-restart on next OOM if it occurs (verifiable only at next OOM event)

**Cross-mapping closure:**
- Issue #1 (image rebuild) → **CLOSED** — S123 cross-cutting Path B → S115 baseline complete
- Issue #2 (auto-restart) → **CLOSED** — `unless-stopped` + 6G mem limit + `STT_LAZY_LOAD` wired
- Issue #3 (network detach) → **CLOSED** — preserved post-restart (172.26.0.11)
- Issue #4 (DB migration) → **CLOSED** — 3 columns + index added

**OGA handoff state:** Ready for Track A/B/C tests against real container without hot-patches.

---

## Template for Next Entry

```
## YYYY-MM-DD

**Voice container status:** 
**OOM incidents since last check:** 
**MeloTTS callable:** YES / NO
**Image rebuilt (persistent):** YES / NO

| Issue | PJM Update | OGA Risk | ETA |
|-------|-----------|----------|-----|
| ... | ... | ... | ... |

**PM ping sent to:** @ai-platform-pjm
**Response received:** YES / NO
**Escalation needed:** YES / NO → @human
```
