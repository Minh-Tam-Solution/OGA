---
spec_id: SPEC-01PLANNING-001
title: "requirements"
spec_version: "1.0.0"
status: draft
tier: STANDARD
stage: "01-planning"
category: functional
owner: "@pm"
created: 2026-04-26
last_updated: 2026-04-26
---

# Requirements — NQH Creative Studio (Open-Generative-AI)

## 1. Scope Statement

NQH Creative Studio is a self-hosted, local-inference fork of Open-Generative-AI targeting the
NQH/MTS internal marketing, design, and content team. Phase 1 (Sprint 1) delivers image generation
via a local mflux/sd.cpp engine on a Mac mini M4 Pro 24 GB, eliminating per-request Muapi.ai costs
while keeping all creative assets on-premises.

### In Scope — Sprint 1

| Item | Rationale |
|------|-----------|
| Fork + rebrand to "NQH Creative Studio" | Ownership, white-label for internal use |
| Provider abstraction layer (`src/lib/providerConfig.js`) | Decouple UI from hardcoded Muapi.ai endpoints |
| Image Studio end-to-end with local engine | Primary value delivery — zero-cost generation |
| Local model dropdown (Flux Schnell, Z-Image, Dreamshaper 8) | User model selection without cloud list |
| "Coming Soon" badges on Video/LipSync/Cinema/Marketing tabs | Ship stable; no broken cloud stubs |
| Hide Workflows and Agents tabs | Phase 1 complexity out of scope |
| Bypass auth for LAN-only Phase 1 | No auth infrastructure required until Phase 2 |

### Out of Scope — Sprint 1

| Item | Deferred To |
|------|------------|
| Video generation (cloud or local) | Sprint 3 |
| Lip-sync studio | Sprint 3 |
| Cinema studio (CameraControls, cloud video API) | Sprint 3 |
| Agent Studio workflows | Sprint 4 |
| Multi-user authentication / RBAC | Sprint 2 |
| External Wan2GP server integration | Sprint 2 |
| Mobile / responsive breakpoints below 1024px | Post-Sprint 3 |

---

## 2. Functional Requirements

### 2.1 Module: `src/components/` (13 files)

#### FR-C01 — Image Studio UI (`ImageStudio.js`)

The Image Studio component must route generation requests to the local inference engine when
`NEXT_PUBLIC_LOCAL_MODE=true`. The prompt input, aspect-ratio selector, and model dropdown must
remain fully operational in local mode. The cloud model list (200+ entries from `src/lib/models.js`)
must not appear; only local models from `src/lib/localModels.js` are shown.

**Priority:** Must Have
**Owner:** @coder

#### FR-C02 — Local Model Manager UI (`LocalModelManager.js`)

Users must be able to view available local models (sd.cpp and Wan2GP providers), see download
status and file size (GB), and trigger downloads from within the UI. Model entries must display
provider badge ("Local — sd.cpp" or "Local — Wan2GP") to distinguish engine type. Download
progress must be surfaced via toast notification (`react-hot-toast`).

**Priority:** Must Have
**Owner:** @coder

#### FR-C03 — Header / Branding (`Header.js`)

The application title and all visible branding must read "NQH Creative Studio" (not
"Open-Generative-AI" or "Higgsfield"). The header navigation must show only tabs relevant to
Phase 1: Image Studio (active), Video (Coming Soon), LipSync (Coming Soon), Cinema (Coming Soon).
Workflows and Agents tabs must be hidden entirely — no empty tab, no 404.

**Priority:** Must Have
**Owner:** @coder

#### FR-C04 — Auth Modal bypass (`AuthModal.js`)

In `LOCAL_MODE`, the `AuthModal.js` component must not block access to Image Studio. The auth
gate must be skipped when `NEXT_PUBLIC_LOCAL_MODE=true`; no login prompt, no token check, no
redirect. The component must remain in place for Phase 2 (cloud re-enablement) without code
deletion — guarded by env flag only.

**Priority:** Must Have
**Owner:** @coder

#### FR-C05 — Coming Soon stubs (VideoStudio, LipSyncStudio, CinemaStudio, WorkflowStudio, AgentStudio)

Each deferred studio tab (`VideoStudio.js`, `LipSyncStudio.js`, `CinemaStudio.js`) must render a
"Coming Soon" badge without making any API call to Muapi.ai or local engine. WorkflowStudio and
AgentStudio must not render at all (tab hidden in navigation). No JavaScript error may be thrown
when these routes are visited directly by URL.

**Priority:** Must Have
**Owner:** @coder

#### FR-C06 — Job Progress Feedback (`SettingsModal.js`, `Header.js`)

For local image generation (34–49 s expected duration), users must see a persistent in-progress
indicator — not just a fire-and-forget toast. The existing `react-hot-toast` pattern in `Header.js`
is insufficient for long-running local jobs (identified as primary UX friction in POC feedback).
A loading state with elapsed-time display must be shown during generation.

**Priority:** Should Have
**Owner:** @coder

#### FR-C07 — Upload Picker (`UploadPicker.js`)

File upload for image-to-image workflows must function in local mode. Uploaded files must be
handled client-side (base64 or blob URL) and passed to the local inference client, not transmitted
to Muapi.ai. Max upload size: 10 MB per image.

**Priority:** Could Have (Sprint 1 best-effort)
**Owner:** @coder

---

### 2.2 Module: `src/lib/` (7 files)

#### FR-L01 — Provider Configuration (`providerConfig.js` — new file)

A new `src/lib/providerConfig.js` module must export a single `getProvider()` function that
returns `'local'` when `NEXT_PUBLIC_LOCAL_MODE=true` and `'cloud'` otherwise. All API call sites
in `src/lib/muapi.js` must import from this module rather than hard-coding endpoint selection.
This is the abstraction layer that decouples the UI from Muapi.ai.

**Priority:** Must Have
**Owner:** @architect + @coder

#### FR-L02 — Cloud API client (`muapi.js`)

`src/lib/muapi.js` must be refactored to check `getProvider()` before every outbound API call.
When provider is `'local'`, the function must throw a clear `Error('Local mode: use localInferenceClient')` 
rather than silently calling the cloud endpoint. Zero requests to `api.muapi.ai` may occur when
`NEXT_PUBLIC_LOCAL_MODE=true`. The `packages/studio/src/muapi.js` duplicate must receive the
same guard.

**Priority:** Must Have
**Owner:** @coder

#### FR-L03 — Local inference client (`localInferenceClient.js`)

`src/lib/localInferenceClient.js` must expose a `generateImage(params)` method that dispatches
to the correct provider: `window.localAI` IPC for sd.cpp models, or HTTP to the Wan2GP Gradio
server URL. The method signature must be compatible with Image Studio's existing call site so no
component-layer changes are required beyond provider routing.

**Priority:** Must Have
**Owner:** @coder

#### FR-L04 — Local model catalog (`localModels.js`)

`src/lib/localModels.js` must export the full `LOCAL_MODEL_CATALOG` with at minimum three
ready-to-use entries: `z-image-turbo` (sd.cpp, 3.4 GB), `z-image-base` (sd.cpp, 3.5 GB), and
`dreamshaper-8` (sd.cpp, SD 1.5). Each entry must include `id`, `name`, `provider`, `sizeGB`,
`aspectRatios`, `defaultSteps`, and `defaultGuidance` fields. The catalog must be filterable by
provider string.

**Priority:** Must Have
**Owner:** @coder

#### FR-L05 — Model routing (`models.js`)

`src/lib/models.js` must not default to cloud `t2iModels` when `NEXT_PUBLIC_LOCAL_MODE=true`.
The exported `getModels()` or equivalent routing function must return only `LOCAL_MODEL_CATALOG`
entries when local mode is active. Cloud model list (currently 200+ entries auto-generated from
`models_dump.json`) must not be loaded into the browser bundle in local mode.

**Priority:** Must Have
**Owner:** @coder

#### FR-L06 — Pending job persistence (`pendingJobs.js`)

`src/lib/pendingJobs.js` must persist in-progress local generation jobs to `localStorage` under
key `muapi_pending_jobs`. On page reload, any pending local job must be restored and re-polled
against the local engine. Jobs must carry a `studioType` field (`'image'`, `'video'`, etc.) for
per-studio filtering. Completed and errored jobs must be pruned on retrieval.

**Priority:** Should Have
**Owner:** @coder

#### FR-L07 — Prompt utilities (`promptUtils.js`) and Upload history (`uploadHistory.js`)

`src/lib/promptUtils.js` must provide prompt sanitisation helpers used by Image Studio — these
must function identically in local and cloud modes (provider-agnostic). `uploadHistory.js` must
persist upload records to `localStorage`; in local mode, records must store blob URLs rather than
Muapi.ai CDN URLs.

**Priority:** Could Have
**Owner:** @coder

---

### 2.3 Module: `src/styles/` (0 files)

#### FR-S01 — Tailwind / global CSS baseline

The project currently has zero files in `src/styles/`. All styling is delivered via Tailwind CSS
utility classes (inlined in components) and Next.js global CSS from `pages/_app.js` or equivalent.
Phase 1 requires no new CSS files; the "Coming Soon" badge and loading-state UI must be
implementable with existing Tailwind utilities. If a shared animation class is needed (e.g., pulse
spinner), it must be added to the root global CSS, not a new `src/styles/` file.

**Priority:** Must Have (constraint, not a build task)
**Owner:** @coder

---

## 3. Non-Functional Requirements

| ID | Requirement | Measurable Target | Verification Method |
|----|-------------|-------------------|---------------------|
| NFR-1 | Image generation latency — local engine | ≤60 s per image @ 512×512 on Mac mini M4 Pro 24 GB | Stopwatch during acceptance test; logged by `localInferenceClient` |
| NFR-2 | Zero external API calls in local mode | 0 HTTP requests to `*.muapi.ai` or any cloud AI endpoint | Browser DevTools → Network tab, filter `muapi` — must be empty |
| NFR-3 | Build success | `npm run build` exits 0; 0 TypeScript/ESLint errors blocking build | CI or manual `npm run build` log |
| NFR-4 | Bundle size — local model list | Cloud model catalog (200+ entries) must NOT be included in local-mode JS bundle | `next build` output; chunk analysis |
| NFR-5 | Desktop browser compatibility | UI renders correctly on Chrome ≥120 and Safari ≥17 at 1280×800 and above | Manual visual check on both browsers |
| NFR-6 | Auth bypass in LAN mode | No login prompt when `NEXT_PUBLIC_LOCAL_MODE=true`; direct access to Image Studio | Load `http://mac-mini:3000` — no redirect to `/login` |
| NFR-7 | Concurrent users — Phase 1 | UI supports 10–20 simultaneous browser sessions on LAN without server crash | Not load-tested in Sprint 1; documented as known limit |
| NFR-8 | Uptime during business hours | Local Next.js server + mflux/sd.cpp engine available ≥99% of 09:00–18:00 weekdays | Monitored by IT Admin (dvhiep); informal SLA for Phase 1 |
| NFR-9 | Data residency | No creative asset (image, prompt, upload) leaves the LAN perimeter in local mode | Network capture during generation run; 0 outbound image payloads |
| NFR-10 | Tab error-free routing | Navigating to `/video`, `/lipsync`, `/cinema` URLs must return HTTP 200 + "Coming Soon" UI, not 404 or JS crash | Manual browser navigation |

---

## 4. Acceptance Criteria (BDD GIVEN/WHEN/THEN)

### AC-FR1 — Rebrand (maps to FR-C03)

```gherkin
Scenario: Application title shows NQH Creative Studio branding
  Given the Next.js app is running with any NEXT_PUBLIC_LOCAL_MODE value
  When a user loads the root URL in a browser
  Then the page header displays "NQH Creative Studio"
  And no text matching "Open-Generative-AI" or "Higgsfield" is visible anywhere on the page
```

### AC-FR2 — Provider abstraction (maps to FR-L01, FR-L02)

```gherkin
Scenario: No cloud API calls are made in local mode
  Given NEXT_PUBLIC_LOCAL_MODE is set to "true" in the environment
  When a user submits an image generation request from Image Studio
  Then getProvider() returns "local"
  And zero HTTP requests are sent to any host matching "*.muapi.ai"
  And the browser Network tab shows no outbound requests to cloud AI endpoints
```

### AC-FR3 — Local image generation (maps to FR-C01, FR-L03)

```gherkin
Scenario: Image is generated via the local engine end-to-end
  Given NEXT_PUBLIC_LOCAL_MODE is "true" and the local sd.cpp engine is running
  When the user enters a prompt, selects aspect ratio 1:1, and clicks Generate
  Then a generation job is dispatched to the local inference client (not muapi.js)
  And an image result is displayed in the UI within 60 seconds
  And no error toast or console error is thrown during the flow
```

### AC-FR4 — Local model dropdown (maps to FR-L04, FR-L05)

```gherkin
Scenario: Only local models appear in the model selector
  Given NEXT_PUBLIC_LOCAL_MODE is "true" and Image Studio is open
  When the user opens the model dropdown
  Then the list contains exactly the entries from LOCAL_MODEL_CATALOG
    (z-image-turbo, z-image-base, dreamshaper-8 at minimum)
  And the cloud model catalog (200+ entries from models_dump.json) is absent from the list
  And each entry shows a provider badge ("Local — sd.cpp" or "Local — Wan2GP")
```

### AC-FR5 — Tab visibility (maps to FR-C03, FR-C05)

```gherkin
Scenario: Deferred tabs are hidden or show Coming Soon without API calls
  Given the application is loaded in a browser
  When the user inspects the top navigation bar
  Then the "Workflows" and "Agents" tabs are not rendered in the DOM
  And the "Video", "LipSync", and "Cinema" tabs are visible with a "Coming Soon" badge
  When the user navigates directly to /video, /lipsync, or /cinema
  Then the page returns HTTP 200 and renders the Coming Soon UI
  And no API request is made to any inference endpoint
```

---

## 5. Sprint 6 Functional Requirements

### FR-S6-01 — Pipeline Hot-Swap

The server must support switching between Diffusers pipelines without restart.
State machine: `IDLE → LOADING → READY → GENERATING`. Separate `_swap_lock` from
`_gen_lock`. `unload_pipeline()` releases MPS memory within `baseline + 300MB` in 5s.

**Priority:** Must Have
**Owner:** @coder
**Design:** ADR-003, TS-003

### FR-S6-02 — Background Removal (RMBG)

`POST /api/v1/remove-bg` accepts base64 image, returns PNG with alpha channel.
Uses `rembg` (MIT, u2net, CPU ONNX on Apple Silicon). Always-resident utility (~1-2GB),
does not trigger pipeline swap. Block concurrent if projected RAM > 85% headroom.

**Priority:** Must Have
**Owner:** @coder
**Design:** TS-004

### FR-S6-03 — Marketing Studio Activation

Marketing Studio tab active (remove `comingSoon` flag). Wire `removeBackground()` to
RMBG endpoint. Cloud Muapi stays for video ad generation. MarketingStudio.jsx UI
already exists — just endpoint wiring.

**Priority:** Must Have
**Owner:** @coder

### FR-S6-04 — Video Studio Cloud Activation

Video Studio tab active (remove `comingSoon` flag). VideoStudio.jsx already has full
cloud UI with Muapi.ai endpoints. `generateVideo()`, `generateI2V()` already in muapi.js.
Tab flip only — no local inference changes.

**Priority:** Must Have
**Owner:** @coder
