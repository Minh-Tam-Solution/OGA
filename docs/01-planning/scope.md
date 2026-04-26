---
spec_id: SPEC-01PLANNING-002
title: "Sprint 1 Scope"
spec_version: "1.0.0"
status: draft
tier: STANDARD
stage: "01-planning"
category: scope
owner: "@pm"
created: 2026-04-26
last_updated: 2026-04-26
gate: G0.1
references:
  - docs/00-foundation/problem-statement.md
  - docs/00-foundation/business-case.md
  - docs/01-planning/requirements.md
  - docs/04-build/sprints/sprint-1-plan.md
---

# Sprint 1 Scope — NQH Creative Studio (Open-Generative-AI)

## 1. Purpose

This document defines the bounded scope for **Sprint 1** of the NQH Creative Studio fork of
Open-Generative-AI. It exists to give `@architect`, `@coder`, and `@tester` a single,
unambiguous boundary reference: what is in this sprint, what is explicitly deferred, and what
constraints are non-negotiable.

This document feeds **gate G0.1 (Problem Validated)**. It is produced after G0 pass criteria
were satisfied in `docs/00-foundation/problem-statement.md` and the business case was justified
in `docs/00-foundation/business-case.md`.

---

## 2. Sprint Goal

Deliver a working local-inference fork of Open-Generative-AI that:

1. Generates images end-to-end via the on-premises mflux/sd.cpp server (zero cloud API calls).
2. Presents "NQH Creative Studio" branding to internal users.
3. Hides or stubs all features not ready for Phase 1, so the UI ships without broken states.
4. Documents `.env` configuration so IT Admin (dvhiep) can deploy on the Mac mini M4 Pro 24 GB.

---

## 3. In Scope — Sprint 1

### 3.1 Rebrand

| Item | File(s) Affected | Acceptance Signal |
|------|-----------------|-------------------|
| Application title → "NQH Creative Studio" | `src/components/Header.js`, `package.json`, `pages/_document.js` | All visible title strings updated; `npm run build` passes |
| Favicon and meta description | `public/favicon.ico`, `pages/_document.js` | New favicon visible in browser tab |
| SettingsModal labels + footer credits | `src/components/SettingsModal.js` | No "Higgsfield" or "Open-Generative-AI" references in UI |
| Remote origin → `github.com/Minh-Tam-Solution/OGA` | `package.json`, `README.md` | `git remote -v` shows MTS origin |

### 3.2 Provider Abstraction Layer

| Item | File(s) Affected | Acceptance Signal |
|------|-----------------|-------------------|
| New `providerConfig.js` — exports `getProvider()` | `src/lib/providerConfig.js` (new) | `getProvider()` returns `'local'` when `NEXT_PUBLIC_LOCAL_MODE=true` |
| Patch cloud client to guard all outbound calls | `src/lib/muapi.js`, `packages/studio/src/muapi.js` | 0 requests to `*.muapi.ai` in Network tab when `LOCAL_MODE=true` |
| Patch API route handlers | `app/api/` (×4 route files), `middleware.js` | No cloud fallback leaks in local mode |

### 3.3 Local Image Generation

| Item | File(s) Affected | Acceptance Signal |
|------|-----------------|-------------------|
| Auth modal bypass in local mode | `src/components/AuthModal.js` | No login prompt when `NEXT_PUBLIC_LOCAL_MODE=true` |
| Model dropdown shows local models only | `src/components/ImageStudio.js`, `src/lib/models.js` | Dropdown lists Flux Schnell / Z-Image / Dreamshaper; no cloud 200+ list |
| `generateImage()` wired through providerConfig | `src/lib/localInferenceClient.js` | End-to-end: prompt → local server → base64 image rendered in UI |
| Local model catalog — 3 entries minimum | `src/lib/localModels.js` | `z-image-turbo`, `z-image-base`, `dreamshaper-8` present with full metadata |
| In-progress indicator for long-running jobs | `src/components/Header.js` or `ImageStudio.js` | Persistent loading state shown; elapsed time visible during 34–49 s generation |

### 3.4 Tab Visibility

| Tab | Action | File(s) |
|-----|--------|---------|
| Video Studio | "Coming Soon" badge; no API call | `src/components/VideoStudio.js` |
| LipSync Studio | "Coming Soon" badge; no API call | `src/components/LipSyncStudio.js` |
| Cinema Studio | "Coming Soon" badge; no API call | `src/components/CinemaStudio.js` |
| Marketing | "Coming Soon" badge; no API call | relevant nav entry |
| Workflows | Hidden entirely (tab not rendered) | `src/components/Header.js` nav |
| Agents | Hidden entirely (tab not rendered) | `src/components/Header.js` nav |

Navigating to a "Coming Soon" route directly (`/video`, `/lipsync`, `/cinema`) must return
HTTP 200 + badge UI — not 404 or JavaScript error.

### 3.5 Environment Template

| Item | File | Acceptance Signal |
|------|------|-------------------|
| `.env.local.example` documenting all env vars | `.env.local.example` (new) | File present; covers `NEXT_PUBLIC_LOCAL_MODE`, `LOCAL_API_URL`, `NEXT_PUBLIC_APP_URL` at minimum |
| README updated with local setup instructions | `README.md` | `npm run dev` + `python local-server/server.py` instructions present |
| `IDENTITY.md` updated | `IDENTITY.md` | Reflects NQH Creative Studio identity and LAN-only Phase 1 scope |

---

## 4. Out of Scope — Sprint 1

The following items are **explicitly deferred**. Any implementation work touching these areas in
Sprint 1 is out of scope and must not be merged. Raising them as scope-change requests requires
`@pm` and `@ceo` approval before work begins.

| Item | Reason for Deferral | Target Sprint |
|------|---------------------|---------------|
| **Video generation** (cloud or local) | Requires separate inference stack; not validated in POC | Sprint 3 |
| **Lip-sync studio** | Depends on video pipeline; no local engine selected | Sprint 3 |
| **Cinema studio** (`CameraControls`, cloud video API) | High-complexity; dependent on video gen | Sprint 3 |
| **Agent Studio workflows** | Architectural complexity; LLM orchestration out of Phase 1 | Sprint 4 |
| **Multi-user authentication / RBAC** | No auth infrastructure required for LAN-only Phase 1 | Sprint 2 |
| **Wan2GP server integration** (external GPU node) | Hardware not yet provisioned; Gradio API unverified | Sprint 2 |
| **Production deployment** (public HTTPS, reverse proxy, SSL) | Out of Phase 1; LAN HTTP sufficient for internal use | Post-Sprint 2 |
| **Mobile / responsive breakpoints below 1024 px** | Team uses desktop browsers only; Phase 1 desktop-first | Post-Sprint 3 |
| **Load testing / formal SLA validation** | Informal IT monitoring sufficient for Phase 1 | Post-Sprint 2 |
| **Image-to-image upload workflow** (FR-C07) | Best-effort in Sprint 1; not a blocking acceptance criterion | Sprint 2 |
| **Pending job persistence across page reload** (FR-L06) | Nice-to-have; does not block core generation flow | Sprint 2 |

---

## 5. Constraints (Non-Negotiable)

These constraints are fixed by the deployment environment and business policy. They are not
negotiable within Sprint 1 and must be respected by all implementation decisions.

### 5.1 Hardware

| Constraint | Value | Source |
|------------|-------|--------|
| Inference host | Mac mini M4 Pro, 24 GB unified memory, macOS | Actual hardware (already purchased) |
| Inference engine | mflux v0.17.5 (MLX-native) or sd.cpp — both Apple Silicon optimised | POC validation — see `docs/00-foundation/problem-statement.md §5.1` |
| Max resolution (Phase 1) | 512×512 px (proven at 34–49 s); higher resolutions untested | POC constraint |
| No GPU server | Wan2GP / remote GPU node not available in Sprint 1 | Hardware not provisioned |

### 5.2 Network

| Constraint | Value | Source |
|------------|-------|--------|
| Deployment network | LAN-only; no public internet exposure in Phase 1 | CEO directive, data governance |
| Access URL | `http://mac-mini:3000` (mDNS) or LAN IP | IT Admin (dvhiep) provision |
| External API calls | Zero outbound calls to any cloud AI endpoint in local mode | NFR-2; zero-cost mandate |
| Auth | Bypassed entirely in Phase 1 (`NEXT_PUBLIC_LOCAL_MODE=true`); no token required | LAN trust boundary sufficient |

### 5.3 Cost

| Constraint | Value | Source |
|------------|-------|--------|
| Cloud AI API spend | $0.00 — no Muapi.ai or any other cloud AI API may be called | CEO directive, business-case §1.1 |
| External service fees | $0.00 per image generation | Core product mandate |
| Electricity only | ~$8–12/month for 24/7 inference server | Business case §2.1 accepted |

### 5.4 Codebase

| Constraint | Value |
|------------|-------|
| Fork hygiene | No reverse merges from upstream `Anil-matcha/Open-Generative-AI` planned; NQH fork is independent |
| Language / framework | Next.js (existing), React (existing) — no framework changes in Sprint 1 |
| Styling | Tailwind CSS utility classes only; no new CSS files in `src/styles/` |
| TypeScript | Not used in Sprint 1 (project is JavaScript); strict-mode TS is a future consideration |
| Cloud code preservation | Cloud code paths must not be deleted — guarded by env flag so Phase 2 cloud re-enablement is possible |

---

## 6. Assumptions

1. The Mac mini M4 Pro 24 GB is available and accessible on the LAN before Sprint 1 ends.
2. `local-server/server.py` (mflux wrapper) runs stably at `http://localhost:8000` on the Mac mini.
3. IT Admin (dvhiep) configures mDNS hostname `mac-mini.local` or provides the LAN IP before integration test (Task 1.6).
4. The `src/lib/localInferenceClient.js` code path confirmed present in codebase is the correct integration point — no additional local server protocol changes are required.
5. The three initial local models (`z-image-turbo`, `z-image-base`, `dreamshaper-8`) are accessible or downloadable on the Mac mini by integration test time.

---

## 7. Success Criteria for Sprint 1 Completion

Sprint 1 is complete when **all** of the following are verified (see `docs/05-test/test-plans/test-plan.md`):

