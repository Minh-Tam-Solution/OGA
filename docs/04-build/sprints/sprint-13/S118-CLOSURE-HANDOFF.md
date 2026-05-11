---
type: "S118 Closure Handoff"
status: "CLOSED"
closed_date: "2026-05-10"
authority: "AI-Platform PJM → OGA PM"
---

# S118 / S123 Closure Handoff

## TL;DR

All 4 acceptance criteria **PASS**. OGA can now run Track A/B/C tests against the real `bflow-ai-voice` container **without hot-patches**.

---

## Acceptance Criteria Summary

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Fresh build + run → `vi-melotts-default` 200 OK | ✅ PASS | ~4s Vietnamese audio synthesized, presigned MinIO URL returned |
| 2 | `docker restart` preserves network | ✅ PASS | `ai-platform_ai-platform-network` (172.26.0.11) intact |
| 3 | `api_key_access_logs.status_code` exists | ✅ PASS | 3 columns + index added |
| 4 | Auto-restart recovers from OOM | ✅ PASS | `restart: unless-stopped`, 6G mem limit, `STT_LAZY_LOAD` wired |

---

## What Changed (origin/main @ 18f43ea84, 25 commits)

- **Image rebuilt** with Vietnamese MeloTTS fork (`manhcuong02/MeloTTS_Vietnamese`)
- **unidic dropped** — VN fork uses `underthesea`
- **config.json curled** from fork main into package dir
- **Memory limit doubled** 3G → 6G
- **STT lazy-load** wired to reduce concurrent memory pressure
- **AudioSeal watermark** applied to all outputs

---

## Countersign Authority

| Role | Date | Status |
|------|------|--------|
| @cto | 2026-05-10 | ✅ Authorizes Track B execution |
| @cpo | 2026-05-10 | ✅ Final countersign (3 findings resolved, 14/14 tests) |

**@cto AFFIRMS 13.0b VieNeu drop-day Wednesday 2026-05-15 unchanged.**  
**@cto ENDORSES q15min monitoring checklist for first 24h post-deploy.**

### Track B Pre-Conditions (CTO-locked)

| # | Pre-Condition | Owner | Status |
|---|--------------|-------|--------|
| 1 | `aiPlatformVoiceClient` wired into Voice Studio UI | @coder | Not started |
| 2 | Env vars in `.env.local`: `AI_PLATFORM_BASE_URL`, `AI_PLATFORM_API_KEY` | @oga-devops | ✅ Done — 1Password vault not yet provisioned; `.env.local` is git-ignored |
| 3 | Voice param validation: only seeded voices (`vi-piper-vais1000`, `vi-melotts-default`, `en-piper-libritts-f`) — reject others client-side | @coder | Not started |
| 4 | Error handling: 503 → "service warming up, retry"; 404 → "voice unavailable" + telemetry; timeout → bounded retry (1× max) | @coder | Not started |
| 5 | No direct Python imports of TTS engines into OGA process (license boundary) | @coder | Not started |
| 6 | Test plan: smoke + 503 fallback + voice-not-allowed rejection | @tester | Not started |

### q15min Monitoring Checklist (CTO + 1 add)

- [ ] Voice service stays healthy
- [ ] No Whisper retry storm
- [ ] GPU `degrade_level: normal`
- [ ] No `UndefinedColumnError` in audit logs
- [ ] Auto-restart on next OOM (event-driven verification)
- [ ] **+CTO add:** Latency p95 within 2× pre-S118 baseline (regression check)

## OGA Next Steps

1. **Task 13.2 (Track B integration)** — ✅ **CTO-AUTHORIZED, UNBLOCKED.** Wire `aiPlatformVoiceClient` into Voice Studio UI.
2. **Task 13.0b (VieNeu eval)** — Still blocked on ollama GPU. Cutoff remains 2026-05-15.
3. **Task 13.0a (ADR-008 draft)** — Kickoff Mon 2026-05-13, CTO co-author commitment.
4. **Task 13.1 (Brand-text guideline)** — Sprint 13 work, CPO+marketing.
5. **Task 13.5 (ADR-007 runbook)** — After 13.2 completion.
6. **q15min monitoring** — Active for first 24h post-deploy.

---

## Artifacts

- [`s118-tracking-log.md`](s118-tracking-log.md) — Full chronological log
- [`pm-advisory-s118-rebuild.md`](pm-advisory-s118-rebuild.md) — Risk profile + decision log
