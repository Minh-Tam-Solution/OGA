---
sprint: 2
status: DONE
start_date: 2026-04-27
planned_duration: 5-7d
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "Sprint 1 complete — hardening, production deploy, simple auth"
---

# Sprint 2 — Production Hardening: Auth + Deploy + Persistence

**Sprint**: 2 | **Phase**: Phase 2 (Production-Ready)
**Status**: DONE
**Created**: 2026-04-26
**Framework**: SDLC Enterprise Framework 6.3.1
**Previous**: Sprint 1 (rebrand + provider abstraction + local image gen complete)

---

## Sprint Goal

Make NQH Creative Studio production-ready on the Mac mini: add simple LAN access control,
auto-start via launchd, and health monitoring — then close the two UX gaps deferred from
Sprint 1 (image-to-image upload, pending job persistence). Probe Wan2GP to unblock Sprint 3
video generation planning.

---

## Context

Sprint 1 shipped the core image generation loop (local mflux, zero cloud API calls, NQH
branding). Sprint 2 transitions the stack from a developer-run process to an always-on
production service with just enough access control for a trusted LAN. No OAuth, no user
database — a PIN-gated session cookie is sufficient for the Phase 2 threat model.

---

## Backlog

| Task | Description | Effort | Points | Depends on | Owner | Status |
|------|-------------|--------|--------|-----------|-------|--------|
| 2.1 | **Simple LAN auth:** PIN-based Next.js middleware; env-configurable `ACCESS_PIN`; `httpOnly; SameSite=Strict` session cookie; covers `/api/*` routes (except `/api/health`); bypass when `ACCESS_PIN` unset; rate-limit 5 attempts/IP/min | 2h | 3 | — | @coder | ✅ DONE |
| 2.2 | **launchd deploy guide:** `com.nqh.creative-studio.plist` + `com.nqh.mflux.plist`; absolute paths; `KeepAlive=true`; `StandardOutPath`/`StandardErrorPath` to `/var/log/nqh/`; guide at `docs/06-deploy/mac-mini-launchd.md`. Dev/test on local MacBook, Mac mini deploy when hardware available | 3h | 5 | — | @devops | ✅ DONE |
| 2.3 | **Health monitoring endpoint:** `GET /api/health` (unauthenticated — excluded from PIN gate) → `{status, uptime, mflux_reachable, timestamp}`; dvhiep wires cron to hit this URL | 1.5h | 2 | — | @coder | ✅ DONE |
| 2.4 | **Image-to-image upload (FR-C07):** file-picker in ImageStudio; multipart file upload only (no URL passthrough — SSRF prevention); passthrough to mflux `--image` param; result in gallery | 3h | 5 | — | @coder | ✅ DONE |
| 2.5 | **Pending job persistence (FR-L06):** store in-flight job state in `localStorage`; restore spinner + elapsed time on page reload; clear on completion or error | 2h | 3 | — | @coder | ✅ DONE |
| 2.6 | **Wan2GP probe + stub:** document Gradio API shape; add `wan2gp` entry to `providerConfig.js` (`enabled: false`); stub `/api/video-stub` returning HTTP 501 | 2h | 3 | — | @coder | ✅ DONE |
| 2.7 | **Integration test (local MacBook):** start Next.js + mflux locally, verify PIN gate, health endpoint, img2img flow, job persistence, regression on Sprint 1. Mac mini E2E deferred to when hardware available | 2h | 3 | 2.1, 2.3, 2.4, 2.5 | @tester | ✅ DONE |

**Total estimated effort:** ~15.5 hours (~3–4 working days)
**Total story points:** 24

---

## Task Dependencies

```
2.1 (auth) ──────────────────────────────────────────────┐
2.2 (launchd) ──→ 2.3 (health endpoint) ────────────────┤──→ 2.7 (hardware test)
2.4 (img2img) ───────────────────────────────────────────┤
2.5 (job persistence) ───────────────────────────────────┘
2.6 (wan2gp stub) — independent, Sprint 3 prep only
```

---

## Acceptance Criteria

- [ ] `npm run build` — 0 errors
- [ ] Mac mini auto-starts `next start` and `mflux` after reboot (`KeepAlive=true` in both plists)
- [ ] `GET /api/health` returns HTTP 200 with `{status: "ok"}` from a LAN browser
- [ ] Visiting `http://mac-mini.local:3000` without PIN redirects to `/auth`
- [ ] Entering correct PIN sets session cookie; subsequent requests skip gate
- [ ] Entering wrong PIN returns HTTP 401; no bypass possible via direct API call
- [ ] Image-to-image: upload `.png`/`.jpg` → generated image delivered ≤ 90 s on Mac mini
- [ ] Page reload mid-generation: progress spinner + elapsed time restored from `localStorage`
- [ ] `GET /api/video-stub` returns HTTP 501 `{"error":"not_implemented","target":"sprint-3"}`
- [ ] `providerConfig.js` contains `wan2gp` entry with `enabled: false`
- [ ] All Sprint 1 acceptance criteria still pass (0 regressions)

---

## Definition of Done

- [x] All 7 tasks marked DONE in this plan
- [~] @tester signs off Task 2.7 (Mac mini hardware integration test)
- [x] `docs/04-build/sprints/sprint-2-plan.md` updated to `status: DONE`
- [x] `docs/06-deploy/mac-mini-launchd.md` created with launchd setup guide
- [x] `IDENTITY.md` updated to reflect production-deployed status
- [x] README updated with production access instructions

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| launchd plist PATH issues — `node`/`npm` not found at service startup | HIGH | HIGH | Use absolute paths in `ProgramArguments`; run `which node` on Mac mini first; test `launchctl start` before merge |
| mflux img2img API differs from txt2img (different endpoint shape or params) | MEDIUM | MEDIUM | Spike Task 2.4 first: `curl` mflux server to verify `--image` flag before building UI; fallback to text-only if blocked |
| PIN auth bypassable via direct `/api/*` calls (middleware matcher gap) | MEDIUM | LOW | Confirm `middleware.js` matcher covers `/api/:path*`; add integration test verifying API-level auth |
| Mac mini not available for hardware test at sprint end | LOW | HIGH | dvhiep confirms hardware availability on Sprint 2 day 1; fallback to MacBook M4 Pro as stand-in |
| `localStorage` persistence conflicts with React hydration on reload | LOW | MEDIUM | Test reload during active generation; clear stale entries on app init with expiry check |

---

## Dependencies

| Dependency | Status | Owner | Notes |
|-----------|--------|-------|-------|
| Sprint 1 DONE (local image gen working) | REQUIRED | @tester | Gate for starting any Sprint 2 work |
| Mac mini accessible on LAN at `mac-mini.local:3000` | DEFERRED | @devops (dvhiep) | Dev/test on local MacBook; Mac mini deploy when hardware available |
| mflux img2img endpoint confirmed via `curl` spike | ASSUMED | @coder | Must verify before building Task 2.4 UI |
| Wan2GP Gradio API documentation | OPTIONAL | @coder | Sprint 3 prep only; 501 stub ships regardless |

---

## Retrospective Reference (Sprint 1)

- Provider abstraction added initial complexity but cleanly isolated local mode — Sprint 2 auth
  builds on the same middleware.js pattern rather than introducing a separate auth layer.
- dvhiep (IT Admin) needs explicit, step-by-step deploy docs — a dedicated
  `docs/06-deploy/mac-mini-launchd.md` is a Sprint 2 first-class deliverable, not an afterthought.
- Deferred items (auth, img2img, persistence) were correctly scoped out of Sprint 1; they land
  here as the primary backlog rather than being squeezed alongside core work.

---

## Sprint 2 Retrospective

- **What worked:** PIN middleware pattern cleanly composed with Next.js App Router; test-first approach (pin-auth.test.mjs) caught rate-limiter edge cases before integration. 25/25 tests — 0 regressions.
- **Watch Sprint 3:** Session token is existence-only (base64 encoded) — must harden to HMAC-signed opaque token before expanding user base. Backlogged as S3-02.
- **Deferred:** Mac mini hardware E2E still pending dvhiep hardware availability — carry as Sprint 3 first task (S3-01).

---

## Gate Evidence

| Gate | Evidence |
|------|----------|
| G0 | `docs/00-foundation/README.md` — problem statement, business case |
| G0.1 | `docs/01-planning/README.md` — FR-1→FR-5 + NFRs (Sprint 1 gate artifacts) |
| G-Sprint | This plan + acceptance criteria above |
| G-Sprint-Close | Task 2.7 (@tester hardware sign-off) |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 2 Plan*
