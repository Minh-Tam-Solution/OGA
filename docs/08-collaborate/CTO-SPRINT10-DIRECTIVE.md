---
Version: 6.3.1
Date: 2026-05-09
Status: ACTIVE — CTO Sprint 10 Directive
Authority: "@cto"
Stage: "08-collaborate"
Gate: G3-review
References:
  - docs/08-collaborate/HANDOFF-SPRINT9-PM-GPU-SERVER.md
  - docs/02-design/01-ADRs/ADR-005-lipsync-architecture.md (v2.1)
  - docs/06-deploy/gpu-server-s1-external.md
  - docs/06-deploy/runbook-s1.md
  - IDENTITY.md (Phase A complete)
---

# CTO Directive — Sprint 10 Planning & Technical Assessment

**From:** @cto  
**To:** @pm, @pjm, @coder, @architect  
**Date:** 2026-05-09  
**Context:** Phase A complete (Sprint 9 DONE). GPU S1 live. Mac Mini pending.

---

## 1. Overall Technical Assessment

### Phase A Verdict: **APPROVED WITH CONDITIONS**

Phase A (Studios Activation, Sprints 1–9) is technically complete. The codebase
ships a working 5-studio UI with local image generation and cloud fallback for
video/cinema/lipsync. Architecture decisions are sound and documented (ADR-001 → 005).

**Score: 7.5/10**

| Area | Assessment | Score |
|------|-----------|-------|
| Architecture | Hot-swap state machine solid; server.py well-structured | 8/10 |
| Deliverables | All 5 studios active; 140 tests pass | 8/10 |
| Documentation | ADRs complete, Tech Specs thorough, Handoff quality high | 9/10 |
| Code Quality | No TypeScript, no CI/CD, root dir clutter | 5/10 |
| Security | PIN-only auth, no rate limiting documented | 5/10 |
| Gate Compliance | `.sdlc-config.json` shows G0.1 / no gates passed — NOT formal | 4/10 |

**Conditions to resolve in Sprint 10:**
1. Formally close G2 and G3 gates in `.sdlc-config.json`
2. Implement CI/CD (GitHub Actions minimum)
3. Clean up root-level test scripts (12+ files)
4. Document rate limiting / auth hardening plan

---

## 2. Critical Finding: ADR-005 v2.1 — CogVideoX-5B on GPU S1

> "CogVideoX-5B PASS — Video Studio local-first with async queue"  
> (ADR-005 revision 2026-05-06)

This is the **most important unblocked item**. CogVideoX-5B passed on GPU backend.
Video Studio can transition from cloud-only to local-first on S1 (RTX 5090).

**CTO Decision**: Sprint 10 MUST include `server.py` async video endpoint for
CogVideoX-5B. This directly reduces Muapi cloud costs for the content team.
@architect owns the endpoint spec; @coder owns implementation.

**Prerequisite**: GPU S1 verification checklist must be 100% ticked first
(item in GPU-S1-VERIFICATION.md). Do NOT code against unverified infra.

---

## 3. Technical Debt Inventory (Priority Order)

### TD-001 — Root directory test file pollution (P1, 30 min)
**Files**: `test_video_models.js` through `test_video_models11.js`, `test_flux*.js`,
`test_image_*.js`, `test_initial_state.js`, `test_video_studio.js`, `test_dtype.py`  
**Action**: Move all into `tests/` or delete if superseded. Root should be clean.  
**Owner**: @coder | **Sprint**: 10 | **Block**: None

### TD-002 — Gate formalization in `.sdlc-config.json` (P1, 15 min)
**Issue**: Config shows `"current": "G0.1", "passed": []` — this misrepresents
the actual project state (G1+G2 have been informally cleared across Sprints 1–9).  
**Action**: @pjm updates `.sdlc-config.json` to reflect actual gate state.  
**Owner**: @pjm | **Sprint**: 10 | **Block**: None

### TD-003 — CI/CD Pipeline (P2, 1 sprint)
**Issue**: No GitHub Actions; deploy is manual (`git pull`, `npm run build`, systemd restart).
**Risk**: Human error on production. Any regression goes to prod undetected.  
**Action**: Add `.github/workflows/ci.yml` — lint + vitest on every push to `main`.  
**Minimum**: `npm run lint` + `npm test` + build check. No deploy automation required yet.  
**Owner**: @coder | **Sprint**: 10

### TD-004 — server.py modularity (P2, 1 sprint)
**Issue**: `server.py` is 1,110 lines and about to grow with CogVideoX endpoint.  
**Action**: Extract into modules:
  - `server_image.py` — Diffusers image pipeline
  - `server_video.py` — CogVideoX async queue (NEW Sprint 10)
  - `server_rembg.py` — RMBG utility
  - `server_core.py` — health, models, swap state machine  
**Owner**: @architect (spec) + @coder (impl) | **Sprint**: 10 or 11

### TD-005 — Auth hardening (P3, future)
**Issue**: PIN-based auth is acceptable for LAN phase but not for external URL.
`studio.nhatquangholding.com` is already public via Let's Encrypt.  
**Action**: Rate limiting on `/auth` endpoint + session timeout. Escalate to
@human (CEO Tai Dang) for decision on SSO vs PIN with MFA.  
**Owner**: @pm (decision) + @coder (impl) | **Sprint**: 11+

### TD-006 — TypeScript migration (P4, long-term)
**Issue**: Pure JavaScript with no strict typing. Low risk now (small team, well-tested).
**Action**: Not in Sprint 10. Record in backlog. Revisit after Mac Mini deploy stable.  
**Owner**: Backlog

---

## 4. Sprint 10 Scope Recommendation

**Theme**: Production Hardening + Video Local (S1 GPU)

### Must-Have (P0)
| # | Task | Owner | Estimate |
|---|------|-------|---------|
| S10.1 | GPU S1 verification checklist → 100% ticked, evidence logged | @pm | Day 1-2 |
| S10.2 | TD-001: Root test file cleanup → move to `tests/` or delete | @coder | 30 min |
| S10.3 | TD-002: Gate state fix in `.sdlc-config.json` | @pjm | 15 min |
| S10.4 | CogVideoX-5B async endpoint on `server.py` (new `/v1/video/generations`) | @coder | 3-4 days |
| S10.5 | Video Studio UI: local mode toggle (async job poll pattern) | @coder | 2 days |
| S10.6 | CI/CD: GitHub Actions lint+test+build on push to main | @coder | 1 day |

### Should-Have (P1)
| # | Task | Owner | Estimate |
|---|------|-------|---------|
| S10.7 | TD-004: server.py extract `server_video.py` module | @coder | 1 day |
| S10.8 | Update IDENTITY.md success criteria (mark S6-S9 checkboxes) | @pjm | 15 min |
| S10.9 | Mac Mini launchd guide validation (dry-run before hardware arrives) | @pm | 1 day |

### Out-of-Scope for Sprint 10
- TypeScript migration
- SSO/MFA auth
- DAM (Directus) integration
- Lip Sync local (no viable model found)

---

## 5. Architecture Guidance for CogVideoX Endpoint

**Pattern to follow**: IP-Adapter lazy-load (Sprint 7, proven pattern).

```
POST /v1/video/generations
{
  "prompt": "...",
  "duration_frames": 16,   # default: 16
  "resolution": "720x480", # default for 5B on 24GB VRAM
  "seed": 42
}

Response: { "job_id": "uuid" }

GET /v1/video/status/{job_id}
Response: { "status": "queued|generating|done|error", "url": "..." }
```

**Key constraints from CogVideoX spike**:
- Model size: ~11GB disk, ~14-16GB VRAM (float16, 5B)
- Generation time: ~60-90s for 16 frames at 720×480 on RTX 5090
- Must use `asyncio.Queue` (single-slot) — no concurrent video generation
- `is_ram_over_cap()` guard applies; unload image pipeline before loading video

**Async job pattern** (not long-polling, not streaming):
- Client posts → gets `job_id` → polls `/v1/video/status/{job_id}` every 5s
- Video Studio UI shows progress bar with estimated time
- Store completed video as temp file, serve via `/v1/video/result/{job_id}`

---

## 6. Gate Status Assessment

### G2 (Design Approved) — @cto authority

Based on ADR-001 through ADR-005 and TS-001 through TS-005 reviewed:

**G2 Status for Phase A: APPROVED** (retroactive, effective Sprint 9 close)

All Phase A design decisions are documented with rationale. Architecture is sound.
The CogVideoX pivot (ADR-005 v2.1) extends G2 scope for Phase B video work.

**Condition**: @pjm must update `.sdlc-config.json` `"passed"` array to include `"G2"`.

### G3 (Quality Approved) — @cto authority

**G3 Status for Phase A: CONDITIONAL** — requires:

- [ ] GPU S1 verification checklist 100% (GPU-S1-VERIFICATION.md evidence)
- [ ] 4 pre-existing test failures investigated — confirm server-connection only (not logic bugs)
- [ ] Root dir cleanup (TD-001) done
- [ ] `npm run lint` passes with 0 errors on `main`

Once checklist above clears → @cto issues G3 APPROVED for Phase A close.

---

## 7. Mac Mini M4 Pro 48GB — Preparation Checklist

Before hardware arrives (owner: @pm + @devops dvhiep):

- [ ] launchd plist files validated against `docs/06-deploy/mac-mini-launchd.md`
- [ ] Confirm `server.py` INFERENCE_ENGINE=diffusers default (not mflux) for production
- [ ] `models.json` contains correct model IDs for production (no dev-only entries)
- [ ] DNS/LAN config ready for `mac-mini-ip` routing (coordinate with @itadmin)
- [ ] Backup plan: if Mac Mini delayed → S1 handles both image + video

---

## 8. Summary Directives

```
[@pm]    → Execute GPU S1 verification checklist NOW. No Sprint 10 kickoff until done.
           Then coordinate Sprint 10 planning with @pjm.

[@pjm]   → Fix .sdlc-config.json gates (G2 passed). Update IDENTITY.md checkboxes.
           Kick off Sprint 10 after GPU S1 verified.

[@coder] → Priority order: TD-001 (30 min), CI/CD (1 day), CogVideoX endpoint (4 days).
           Follow async job pattern above. Follow IP-Adapter lazy-load pattern from Sprint 7.

[@architect] → Write TS-006: CogVideoX-5B video endpoint spec before @coder starts S10.4.
               Include async queue design, VRAM budget, temp file lifecycle.
```

**Phase B is now open.** The GPU S1 platform is live. The blocker for local video
was hardware (CUDA) not code. Ship CogVideoX video generation in Sprint 10.

---

*@cto | NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | 2026-05-09*
