---
sprint: 3
status: IN PROGRESS
start_date: 2026-04-27
planned_duration: 7d
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "Sprint 2 complete — video gen capability + session security hardening"
---

# Sprint 3 — Video Generation: Wan2GP + Security Hardening

**Sprint**: 3 | **Phase**: Phase 3 (Feature Expansion)
**Status**: PLANNED
**Created**: 2026-04-27
**Framework**: SDLC Enterprise Framework 6.3.1
**Previous**: Sprint 2 (auth + launchd + persistence — 25/25 tests)

---

## Sprint Goal

Activate video generation capability via Wan2GP on the Mac mini, and harden session security with HMAC-signed tokens. End of sprint: NQH employees can generate AI videos from the web UI with the same PIN-gated access as image generation.

---

## Context

Sprint 2 shipped the production-ready image stack: PIN auth, launchd, health monitoring, img2img, job persistence, and a Wan2GP HTTP 501 stub ready for activation. Sprint 3 activates that stub and adds a VideoStudio tab alongside the existing ImageStudio. Session token hardening (CTO Sprint 2 condition) ships first to secure the expanded surface before more users onboard.

---

## Backlog

| Task | Description | Effort | Points | Depends on | Owner | Status |
|------|-------------|--------|--------|-----------|-------|--------|
| 3.1 | **Mac mini hardware deploy:** dvhiep deploys launchd plists from `docs/06-deploy/mac-mini-launchd.md`; verifies `GET /api/health` returns `{status:"ok"}` from LAN browser; confirms PIN gate on `mac-mini.local:3000` | 2h | 3 | — | @devops | PLANNED |
| 3.2 | **Session token HMAC hardening (CTO condition):** replace base64(PIN:ts) cookie with HMAC-SHA256 opaque token (`crypto.createHmac('sha256', SECRET_KEY)`); add server-side in-memory `Set` with 7-day TTL; `middleware.js` validates token against store — not existence-only | 2h | 3 | — | @coder | PLANNED |
| 3.3 | **Wan2GP service setup:** install Wan2GP on Mac mini (Python env, model weights); create `com.nqh.wan2gp.plist` launchd service at `localhost:7860`; verify Gradio API with `curl`; document in `docs/06-deploy/wan2gp-setup.md` | 4h | 5 | 3.1 | @devops | PLANNED |
| 3.4 | **Wan2GP backend API:** enable `wan2gpConfig.enabled: true`; implement `/api/video-generate` (replace 501 stub): POST prompt to Gradio, poll job status, stream progress %, return video URL; 120s timeout; auth-gated | 4h | 5 | 3.2, 3.3 | @coder | PLANNED |
| 3.5 | **VideoStudio UI:** new `/video` route + VideoStudio component: prompt input, aspect ratio selector (16:9/9:16/1:1), duration picker (5s/10s), generate button, progress bar, video player; matches ImageStudio design language | 5h | 8 | 3.4 | @coder | PLANNED |
| 3.6 | **Integration tests:** E2E happy path video gen, 120s timeout handling, auth gate on `/video`, img2img regression, Sprint 1 regression; target ≥35 tests total (from 25) | 2h | 3 | 3.1–3.5 | @tester | PLANNED |

**Total estimated effort:** ~19 hours (~4–5 working days)
**Total story points:** 27

---

## Task Dependencies

```
3.1 (Mac mini deploy) ────────────────────────────────────────────┐
3.2 (HMAC hardening) — independent ──────────────────────────────┤
3.3 (Wan2GP setup) ──[needs 3.1]─────────────────────────────────┤──→ 3.6 (tests)
3.4 (Backend API) ───[needs 3.2, 3.3]────────────────────────────┤
3.5 (VideoStudio UI) ─[needs 3.4]───────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `npm run build` — 0 errors
- [ ] `GET /api/health` returns `{status:"ok"}` from Mac mini LAN address
- [ ] Session cookie contains HMAC-signed opaque token; middleware validates against server-side store
- [ ] Submitting tampered cookie → HTTP 401 (not just absence check)
- [ ] POST `/api/video-generate` with valid prompt → video URL returned ≤ 120s on Mac mini
- [ ] `/video` page accessible after PIN auth; renders VideoStudio UI
- [ ] VideoStudio: prompt + aspect ratio + duration → video generated → playable in browser
- [ ] `/api/video-generate` returns HTTP 401 without PIN session (auth gate active)
- [ ] All 25 Sprint 2 tests pass (0 regressions); ≥10 new tests added (target ≥35 total)

---

## Definition of Done

- [ ] All 6 tasks marked DONE in this plan
- [ ] @tester signs off Task 3.6 (Mac mini E2E with video gen)
- [ ] `docs/04-build/sprints/sprint-3-plan.md` updated to `status: DONE`
- [ ] `docs/06-deploy/wan2gp-setup.md` created
- [ ] `IDENTITY.md` Sprint 3 criterion checked
- [ ] VideoStudio accessible from main nav

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Wan2GP model weights too large / GPU OOM on Mac mini M4 Pro 24GB | MEDIUM | HIGH | Pre-check VRAM requirements; test with smallest Wan2GP model first; fallback to CPU inference |
| Gradio API shape differs from Sprint 2 probe (endpoint version mismatch) | MEDIUM | MEDIUM | Spike Task 3.3 first: `curl` Gradio before building Task 3.4 API; stub returns 503 if Gradio unreachable |
| Mac mini not available for hardware deploy (dvhiep capacity) | MEDIUM | HIGH | Tasks 3.2, 3.5 develop against `localhost` fallback; defer 3.3/3.6 if hardware unavailable by day 3 |
| HMAC key rotation: `SECRET_KEY` env var not set on Mac mini | LOW | HIGH | `middleware.js` must throw if `SECRET_KEY` unset (no empty-string fallback); add to launchd plist env vars |
| Video gen latency >120s on Mac mini M4 Pro (model too large) | MEDIUM | MEDIUM | Test 5s clip first; expose configurable `VIDEO_TIMEOUT_MS` env var; show partial progress in UI |

---

## Dependencies

| Dependency | Status | Owner | Notes |
|-----------|--------|-------|-------|
| Sprint 2 DONE (auth + launchd guide complete) | ✅ DONE | Sprint 2 | Gate for Sprint 3 |
| Mac mini accessible on LAN at `mac-mini.local:3000` | REQUIRED | @devops (dvhiep) | Task 3.1 blocks 3.3 |
| Wan2GP model weights downloadable on Mac mini | REQUIRED | @devops | Wan2GP + Python deps installed |
| `SECRET_KEY` env var set in Mac mini launchd plist | REQUIRED | @devops | Task 3.2 prerequisite |

---

## Retrospective Reference (Sprint 2)

- PIN middleware cleanly composed with Next.js App Router — same pattern extended in Sprint 3 for HMAC hardening.
- Wan2GP stub (HTTP 501) was the right sprint boundary — avoids blocking Sprint 2 on hardware availability.
- Mac mini hardware deferred again in Sprint 2 — dvhiep must confirm availability before Sprint 3 kickoff to avoid a third carry.

---

## Gate Evidence

| Gate | Evidence |
|------|----------|
| G0 | `docs/00-foundation/README.md` — problem statement, business case |
| G0.1 | `docs/01-planning/README.md` — FR + NFRs (Sprint 1–2 gate artifacts) |
| G-Sprint | This plan + acceptance criteria above |
| G-Sprint-Close | Task 3.6 (@tester Mac mini E2E sign-off) |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 3 Plan*
