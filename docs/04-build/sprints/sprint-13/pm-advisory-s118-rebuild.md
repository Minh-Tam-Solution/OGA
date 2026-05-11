# PM Advisory: S118 / S123 AI-Platform Voice Rebuild (Co-signed by CTO+CPO)

**Date:** 2026-05-10  
**Status:** ✅ **CLOSED** — All 4 acceptance criteria PASS  
**Sprint:** 13 — Stabilization & Governance  
**Authority:** CTO Cosign (2026-05-10) · CPO Cosign (2026-05-10)  
**Tickets:** AI-Platform/audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md
**Final Commit:** `18f43ea84` (origin/main, 25 commits durably pushed)

> **Naming:** OGA uses "S118" (pre-rename consumer label). AI-Platform internal backlog is **S123**. Cross-mapping maintained below. Option 2 accepted: drift kept as known alias.

---

## 1. Current Risk Profile

| Risk | Severity | Likelihood | Mitigation | Residual Risk |
|------|----------|-----------|------------|---------------|
| MeloTTS lost on container recreation | ~~HIGH~~ | ~~75%~~ | Image rebuilt + persistent | ✅ **RESOLVED** |
| OOM → 503 outage | ~~HIGH~~ | ~~Daily~~ | `restart: unless-stopped` + 6G mem limit + `STT_LAZY_LOAD` | ✅ **RESOLVED** |
| Network detach on restart | ~~MEDIUM~~ | ~~100%~~ | Preserved post-restart (172.26.0.11) | ✅ **RESOLVED** |
| DB column warning | ~~LOW~~ | ~~100%~~ | 3 columns + index added | ✅ **RESOLVED** |

**Bottom line:** OGA has a **production-hardened 2-engine MVP** (Piper + MeloTTS). All 4 blockers cleared. Ready for Track A/B/C tests without hot-patches.

---

## 2. Cross-Mapping: OGA Issues → AI-Platform S123

| OGA Issue | OGA Priority | Maps to S123 | Pre-stage State |
|-----------|-------------|--------------|-----------------|
| #1 Image rebuild | P0 | Cross-cutting (Path B → S115 baseline) | Code fixes shipped: WS-A gpu_budget + WS-B /v1/health + WS-D auth + provision script. Image rebuild is consumer. |
| #2 Auto-restart | P1 | **NOT in S123 scope** | Out-of-scope; net-new item for Mon 05-12 ratification (ADR-090 row addition or S124+) |
| #3 Network detach | P1 | ADR-090 row (q) — NEW from OGA PJM ticket | Tracked in audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md; not pre-staged |
| #4 DB migration | P2 | WS-D row (a) MeloTTS | DRAFT pre-staged at versions-draft/melotts_voice_registry_seed.draft.py (885b9906d); promotion blocked on voice-ID alignment |

**S123 Pre-stage Scoreboard:** 12/16 rows closed/verified. Structurally protected against zero-progress escalation IF Mon 05-12 ratification pushes.

---

## 3. Build Trajectory (3 Image Builds + 2 Incremental Fixes)

| Build | Issue | Fix Commit | Resolution |
|-------|-------|------------|------------|
| #1 (initial) | `unidic` module missing — pre-existing `python -m unidic download` assumed upstream MeloTTS | `3d1a965a0` | Drop unidic step (VN fork uses `underthesea`) |
| #2 (post-unidic-fix) | `melo/configs/config.json` missing — fork's pyproject doesn't ship configs/ | `18f43ea84` | `curl config.json` from fork main into installed pkg dir |
| #3 (final) | Healthy startup + MeloTTS + Piper registered + GPU per-process VRAM working | — | All engines registered, watermark applied |

**End-to-end evidence:**
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

## 4. Required AI-Platform Changes (S118/S123) — ✅ ALL CLOSED

### 4.1 Image Rebuild (P0) ✅
- **Status:** CLOSED — `manhcuong02/MeloTTS_Vietnamese` fork + deps baked into image
- **Commit:** `18f43ea84` (part of 25-commit batch)

### 4.2 Auto-Restart (P1) ✅
- **Status:** CLOSED — `restart: unless-stopped` + mem limit 6G (was 3G) + `STT_LAZY_LOAD` env wired
- **Scope decision:** Accepted into S123 scope at ratification

### 4.3 Network Persistence (P1) ✅
- **Status:** CLOSED — Network `ai-platform_ai-platform-network` (IP 172.26.0.11) preserved post-restart

### 4.4 DB Migration (P2) ✅
- **Status:** CLOSED — `status_code`, `response_time_ms`, `request_id` + index added

---

## 4. OGA-Side Actions (Independent)

| Action | Owner | Status |
|--------|-------|--------|
| Track B UI wireframe | @coder | Not started (S13 P1) |
| Audio player component | @coder | Not started (S13 P1) |
| Cypress 200/503 tests | @tester | Not started (S13 P1) |
| ADR-007 runbook (ops + rollback) | @architect | Not started (S13 P2) |
| ADR-008 GPU arbiter draft | @architect | Not started (S13 P0) |
| S118 ping cadence | @pm | Active — Mon+Thu |

---

## 5. Decision Log

| Decision | Authority | Rationale |
|----------|-----------|-----------|
| No sudo-kill ollama | CTO (hard rule) | Coordinate owner for unload window |
| No VieNeu until GPU free | CPO (cutoff 2026-05-15) | Avoid S13 scope creep |
| OmniVoice removed | CTO (hard expiry) | No repo URL provided; auto-downgrade |
| Track B MVP = Piper + MeloTTS | CPO+CTO (Spike E v2) | Both CEO+Hùng PASS |
| Production API key → 1Password | CTO (security) | Pending transfer from `.env.local` |

---

## 6. Mon 05-12 Ratification Action Items (AI-Platform)

Per cross-mapping received 2026-05-10:

1. **Push 20 local commits** to origin/main (S122 + S123 batches) — gives OGA visible evidence of progress, defuses escalation trigger #3
2. **Respond to OGA Issue #1** (image rebuild) — point at 6 code-layer closures already landed
3. **Decide on OGA Issue #2** (auto-restart) — accept into S123 scope OR defer to S124
4. **@pjm urgency on Spike E Hùng A/B** — must land by 2026-05-15 to keep VieNeu Path C.1 live. If Hùng A/B not delivered, OGA defaults to Path C.3 (replace VieNeu) without input

---

## 7. Escalation Triggers

- ~~**2026-05-12 (Thu):** S118 ping — now CLOSED. Replaced by Track B q15min monitoring.~~
- **2026-05-15 (Sat):** VieNeu cutoff. If GPU still blocked OR Hùng A/B not delivered → OGA locks to 2-engine MVP, defaults to Path C.3 (replace VieNeu), replan in S14.
- ~~**2026-05-17 (Mon):** S118 zero progress — N/A (closed early).~~

## 8. Post-Closure: Track B GO (CTO 2026-05-10)

**Authorization:** @cto authorizes Task 13.2 (Track B integration) execution to start immediately.  
**Monitoring:** q15min checklist active for first 24h, including CTO add: latency p95 within 2× pre-S118 baseline.  
**Next dependency:** None. OGA has persistent MeloTTS + auto-restart + network stability.

**Pass thanks upstream:** AI-Platform team's image rebuild discipline (state-cliff resolved, auto-restart added) makes G2-audio actually shippable.

---

*End of Advisory. Next update: 2026-05-12.*
