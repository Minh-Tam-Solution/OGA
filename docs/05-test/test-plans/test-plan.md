---
spec_id: SPEC-05TEST-001
title: "test-plan"
spec_version: "1.0.0"
status: active
tier: STANDARD
stage: "05-test"
category: quality
owner: "@reviewer"
created: 2026-04-26
last_updated: 2026-04-26
gate: G3
---

# Test Plan — NQH Creative Studio (Open-Generative-AI)

## 1. Objective

This test plan verifies that NQH Creative Studio (the self-hosted fork of Open-Generative-AI)
functions correctly across its two inference modes — local (sd.cpp / Wan2GP) and cloud (Muapi.ai) —
for the modules delivered in Sprint 1. The primary question answered here is: **Does it WORK
correctly?** Every test section is anchored to a functional requirement from
`docs/01-planning/requirements.md` and to the ADR-001 architecture decision that introduced the
provider abstraction layer.

Coverage targets per SDLC 6.3.1 STANDARD tier:
- Unit tests: ≥70% line coverage on `src/lib/`
- Integration tests: all API proxy routes exercised against both backends
- E2E (happy-path): Image Studio generate → display flow in both local and cloud modes
- Regression: AuthModal bypass, local-mode auto-key, pending-job persistence

---

## 2. Scope

### 2.1 In Scope

| Module | Files | Test Types |
|--------|-------|------------|
| `src/lib/localInferenceClient.js` | 1 | Unit, Integration |
| `src/lib/localModels.js` | 1 | Unit |
| `src/lib/models.js` | 1 | Unit |
| `src/lib/muapi.js` | 1 | Unit, Integration |
| `src/lib/pendingJobs.js` | 1 | Unit |
| `src/lib/promptUtils.js` | 1 | Unit |
| `src/lib/uploadHistory.js` | 1 | Unit |
| `src/components/ImageStudio.js` | 1 | Component, E2E |
| `src/components/AuthModal.js` | 1 | Component |
| `src/components/LocalModelManager.js` | 1 | Component |
| `src/components/Header.js` | 1 | Component |
| `src/components/SettingsModal.js` | 1 | Component |
| `src/components/UploadPicker.js` | 1 | Component |
| `middleware.js` | 1 | Integration |
| Routing: `/api/v1/*` proxy | — | Integration |

### 2.2 Out of Scope (Sprint 1 deferrals)

Video generation (VideoStudio.js), LipSyncStudio.js, CinemaStudio.js, CameraControls.js,
AgentStudio.js, WorkflowStudio.js, and Sidebar.js are excluded from Sprint 1 testing.
These stubs render "Coming Soon" badges and carry no testable business logic in this sprint.

---

## 3. Test Environment

### 3.1 Local-Mode Environment

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_LOCAL_MODE` | `true` | Enables local-only model list in ImageStudio |
| `local_server_url` (localStorage) | `http://localhost:8000` | Routes MuapiClient to local MLX server |
| `window.localAI` | Electron IPC stub | Required for LocalInferenceClient methods |
| Node.js | ≥20 LTS | Runtime for Next.js 15 |

Hardware baseline for local inference acceptance: Mac mini M4 Pro 24 GB RAM, macOS 15+.

### 3.2 Cloud-Mode Environment

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_LOCAL_MODE` | `false` (default) | Uses full Muapi model list |
| `muapi_key` (localStorage) | valid Muapi.ai key | Required by MuapiClient.getKey() |
| `LOCAL_API_URL` | unset | Forces middleware to proxy to `https://api.muapi.ai` |

### 3.3 Test Framework Stack

The project uses **Vitest** (recommended for Next.js 15 + Vite toolchain already present) and
**@testing-library/dom** for component tests. E2E tests use **Playwright** targeting Chromium.
No test framework is committed yet — this plan governs which framework must be installed before
G3 approval.

---

## 4. Unit Tests — `src/lib/`

### 4.1 `localModels.js` — Model Catalog Integrity

**FR reference:** FR-C01 (local model dropdown), FR-C02 (LocalModelManager)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| LM-001 | `LOCAL_MODEL_CATALOG` exports a non-empty array | Array length ≥ 1 |
| LM-002 | Every entry has `id`, `name`, `provider`, `type`, `sizeGB` | No missing fields |
| LM-003 | `provider` is one of `['sdcpp', 'wan2gp']` for every entry | Strict enum pass |
| LM-004 | `getLocalModelById('z-image-turbo')` returns the Z-Image Turbo entry | `id === 'z-image-turbo'` |
| LM-005 | `getLocalModelById('nonexistent-id')` returns `undefined` | No crash, returns undefined |
| LM-006 | All sdcpp entries have `filename` ending in `.gguf` or `.safetensors` | String match |
| LM-007 | `LOCAL_MODEL_CATALOG.filter(m => m.type !== 'video')` excludes only wan2gp video entries | Count matches expectation |

### 4.2 `localInferenceClient.js` — Provider Dispatch

**FR reference:** FR-C01 local generation path, ADR-001 provider abstraction

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| LIC-001 | `isLocalAIAvailable()` returns `false` when `window.localAI` is absent | `false` |
| LIC-002 | `isLocalAIAvailable()` returns `true` when `window.localAI.isElectron = true` | `true` |
| LIC-003 | `localAI.generate()` throws "Local AI only available in the desktop app." outside Electron | Error message match |
| LIC-004 | `localAI.generate({ model: 'wan2gp-model' })` dispatches to `window.localAI.wan2gp.generate` when model provider is `wan2gp` | Spy called on wan2gp |
| LIC-005 | `localAI.generate({ model: 'z-image-turbo' })` dispatches to `window.localAI.generate` | Spy called on sdcpp |
| LIC-006 | `localAI.listModels()` merges sdcpp and wan2gp arrays and tags each with `provider` | Merged array, all have `provider` |
| LIC-007 | `localAI.cancelGeneration()` calls both `window.localAI.cancelGeneration` and `window.localAI.wan2gp.cancelGeneration` | Both spies called |
| LIC-008 | `localAI.probeWan2gp(url)` returns `{ ok: false }` outside Electron | No throw, `ok === false` |

### 4.3 `muapi.js` — MuapiClient

**FR reference:** FR-C01 cloud path, middleware proxy

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| MC-001 | Constructor sets `baseUrl` to empty string in dev mode without `local_server_url` | `baseUrl === ''` |
| MC-002 | Constructor sets `baseUrl` to `local_server_url` value when key is present in localStorage | `baseUrl === 'http://localhost:8000'` |
| MC-003 | Constructor auto-sets `muapi_key = 'local'` when `local_server_url` is set and no key exists | `localStorage.getItem('muapi_key') === 'local'` |
| MC-004 | `getKey()` throws "API Key missing" when neither `window.__MUAPI_KEY__` nor localStorage key exists | Error thrown |
| MC-005 | `getKey()` returns `'local'` when `isLocal` is true regardless of localStorage state | `'local'` |
| MC-006 | `generateImage()` builds correct endpoint URL using `modelInfo.endpoint` from `models.js` | URL contains model endpoint |
| MC-007 | `generateImage()` omits `negative_prompt` from payload when parameter is empty string | Payload key absent |
| MC-008 | `generateVideo()` sets `Authorization: Bearer <key****[REDACTED] header | Header present |

### 4.4 `pendingJobs.js` — LocalStorage Persistence

**FR reference:** FR-C01 pending-job recovery after page reload

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PJ-001 | `savePendingJob({ requestId: 'r1', studioType: 'image' })` persists to `localStorage['muapi_pending_jobs']` | Parse succeeds, length 1 |
| PJ-002 | Saving a duplicate `requestId` replaces the existing entry (not appended) | Array length unchanged |
| PJ-003 | `removePendingJob('r1')` removes only the matching entry | Length decremented |
| PJ-004 | `getPendingJobs('image')` filters by `studioType` | Only image jobs returned |
| PJ-005 | `getPendingJobs()` with no argument returns all jobs | Full array |
| PJ-006 | Corrupted localStorage JSON does not throw — returns `[]` | `[]` gracefully |

### 4.5 `promptUtils.js` — Prompt Helpers

**FR reference:** FR-C01 prompt enhancement UX

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PU-001 | `ENHANCE_TAGS` exports keys: `quality`, `lighting`, `mood`, `style` | Four keys present |
| PU-002 | Each `ENHANCE_TAGS` value is a non-empty string array | All arrays have length ≥ 1 |
| PU-003 | `QUICK_PROMPTS` has ≥ 6 entries each with `label` and `prompt` string fields | Schema valid |
| PU-004 | `CAMERA_MAP` and `LENS_MAP` exports are plain objects with string values | Type check passes |

### 4.6 `models.js` — Cloud Model Catalog

**FR reference:** FR-C01 cloud model list (non-local mode)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| MOD-001 | `t2iModels` is a non-empty array where every entry has `id` and `endpoint` | Schema valid |
| MOD-002 | `getAspectRatiosForModel(id)` returns an array for known models | Non-empty array |
| MOD-003 | `getAspectRatiosForModel('unknown')` returns `[]` or a sensible default | No throw |
| MOD-004 | `t2vModels`, `i2iModels`, `i2vModels`, `v2vModels` all export non-empty arrays | Length ≥ 1 each |

---

## 5. Component Tests — `src/components/`

Component tests render each component into a real DOM node (no JSDOM mocks for the components
themselves) and assert on rendered HTML. Electron IPC (`window.localAI`) is stubbed.

### 5.1 `AuthModal.js`

**FR reference:** FR-C03 (bypass auth in local mode)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AM-001 | `AuthModal(onSuccess)` returns `null` when `localStorage['local_server_url']` is set | Return value is `null`, `onSuccess` called immediately |
| AM-002 | Modal renders overlay and input when no local server URL is set | `.fixed.inset-0` element in DOM |
| AM-003 | Clicking "Initialize Studio" with empty input does NOT call `onSuccess` | `onSuccess` spy not called |
| AM-004 | Clicking "Initialize Studio" with a valid key calls `onSuccess` and removes overlay from DOM | `onSuccess` called, overlay removed |
| AM-005 | API key is stored in `localStorage['muapi_key']` on successful save | Key persisted |
| AM-006 | Input border turns red when submit attempted with empty field | `border-red-500/50` class added |

### 5.2 `ImageStudio.js` — Mode Switching

**FR reference:** FR-C01 (ImageStudio routing to local vs cloud)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| IS-001 | In local mode (`window.localAI.isElectron = true`), model dropdown contains only `LOCAL_IMAGE_MODELS` entries | Cloud model IDs absent |
| IS-002 | In cloud mode, model dropdown contains `t2iModels` entries | Cloud model IDs present |
| IS-003 | Switching from t2i to i2i mode swaps the model list | `i2iModels` now shown |
| IS-004 | Generating without a prompt shows validation state (button disabled or toast shown) | No API call dispatched |
| IS-005 | Selecting local model Dreamshaper 8 sets `selectedLocalModel` state correctly | Dropdown displays "Dreamshaper 8" |
| IS-006 | Progress bar appears and updates when `localAI` emits progress events | `localGenProgress` reflected in DOM |
| IS-007 | Upload picker triggers i2i mode when an image URL is set | `imageMode === true` |
| IS-008 | Advanced parameters panel toggles visibility on button click | Panel hidden/shown |
| IS-009 | `savePendingJob` is called when a generation request is dispatched | Spy asserted |
| IS-010 | `removePendingJob` is called when generation completes or fails | Spy asserted on both outcomes |

### 5.3 `LocalModelManager.js`

**FR reference:** FR-C02 (model download UX)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| LMM-001 | Renders all entries from `LOCAL_MODEL_CATALOG` | Row count matches catalog length |
| LMM-002 | Each row displays provider badge text "Local — sd.cpp" or "Local — Wan2GP" | Badge text present |
| LMM-003 | Download button calls `localAI.downloadModel(modelId)` | Spy called with correct ID |
| LMM-004 | Delete button calls `localAI.deleteModel(modelId)` | Spy called with correct ID |
| LMM-005 | File size is displayed in GB format (e.g., "3.4 GB") | Text matches `sizeGB` field |
| LMM-006 | Wan2GP URL input and "Probe" button are rendered for wan2gp section | Elements present in DOM |
| LMM-007 | Clicking Probe with valid URL calls `localAI.probeWan2gp(url)` | Spy called |

### 5.4 `Header.js`

**FR reference:** FR-C03 (branding and tab visibility)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| HD-001 | Header renders "NQH Creative Studio" text (or configured brand name), not "Open-Generative-AI" | Brand string matches |
| HD-002 | "Workflows" and "Agents" tabs are absent from DOM in Phase 1 | `querySelectorAll` returns 0 |
| HD-003 | "Video", "LipSync", "Cinema" tabs render "Coming Soon" badge | Badge text present |
| HD-004 | "Image Studio" tab is active on initial render | Active class present |

### 5.5 `UploadPicker.js`

**FR reference:** FR-C01 image upload for i2i mode

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| UP-001 | `createUploadPicker(onUpload)` returns a DOM element | `instanceof HTMLElement` |
| UP-002 | Selecting a file invokes `onUpload` callback with a URL string | Callback called |
| UP-003 | Multi-upload returns array of URLs | Array length matches file count |

---

## 6. Integration Tests — Middleware & API Proxy

**FR reference:** ADR-001 Section 2 (provider abstraction), middleware.js

Integration tests run against the Next.js dev server (`npm run dev`) with a mock backend
using `msw` (Mock Service Worker) or a lightweight Express fixture.

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| INT-001 | `GET /api/v1/flux-dev-image` is rewritten to `https://api.muapi.ai/api/v1/flux-dev-image` when `LOCAL_API_URL` is unset | Response origin header matches Muapi |
| INT-002 | `GET /api/v1/flux-dev-image` is rewritten to `http://localhost:8000/api/v1/flux-dev-image` when `LOCAL_API_URL=http://localhost:8000` | Response origin header matches local |
| INT-003 | `POST /api/workflow/*` passes through to Muapi (not blocked by middleware) | 200 or 401 from upstream |
| INT-004 | Paths not matching `/api/v1/*`, `/api/workflow/*`, `/api/app/*` are NOT rewritten | `NextResponse.next()` path taken |
| INT-005 | Middleware does not strip `Authorization` header on proxy rewrite | Header forwarded to backend |
| INT-006 | `MuapiClient.generateImage()` in local mode sends request to `http://localhost:8000/api/v1/<endpoint>` | URL logged by mock |
| INT-007 | `MuapiClient.generateImage()` in cloud mode sends `Authorization: Bearer <mua****[REDACTED] | Header present in mock capture |

---

## 7. End-to-End Tests

E2E tests run via **Playwright** against `npm run dev` (Next.js dev server, Chromium). The Electron
desktop runtime is NOT tested in this E2E suite — that is covered by the desktop smoke test in
Section 8. These E2E tests exercise the Next.js web UI only.

### 7.1 Image Generation — Cloud Mode

| Test ID | Step | Expected Outcome |
|---------|------|-----------------|
| E2E-IMG-001 | Open `/`, no `local_server_url` in storage | AuthModal overlay renders |
| E2E-IMG-002 | Enter valid API key, click "Initialize Studio" | Overlay dismisses, ImageStudio visible |
| E2E-IMG-003 | Select model "Flux Dev", enter prompt "A red apple on white table", click Generate | Generation request dispatched to `/api/v1/flux-dev-image` |
| E2E-IMG-004 | Mock backend returns `{ url: "https://cdn.example.com/img.png" }` | Image renders in result grid |
| E2E-IMG-005 | Click on generated image opens full-screen preview | Overlay with `<img>` tag appears |
| E2E-IMG-006 | Download button on preview triggers file download | `download` attribute set on anchor |

### 7.2 Image Generation — Local Mode

| Test ID | Step | Expected Outcome |
|---------|------|-----------------|
| E2E-LOCAL-001 | Set `localStorage['local_server_url'] = 'http://localhost:8000'` before load | AuthModal does NOT render |
| E2E-LOCAL-002 | ImageStudio loads with local model dropdown only (Flux Schnell, Z-Image Turbo, Dreamshaper 8) | Cloud model IDs absent |
| E2E-LOCAL-003 | Enter prompt, select "Z-Image Turbo", click Generate | Request sent to `http://localhost:8000/api/v1/z-image` |
| E2E-LOCAL-004 | Mock local server returns image URL | Image renders without auth error |
| E2E-LOCAL-005 | Reload page — pending job from E2E-LOCAL-003 is recovered from localStorage | "Resuming…" indicator shown |

### 7.3 Settings Modal

| Test ID | Step | Expected Outcome |
|---------|------|-----------------|
| E2E-SET-001 | Click Settings icon in Header | SettingsModal renders |
| E2E-SET-002 | Enter local server URL `http://localhost:8000` and save | `localStorage['local_server_url']` set |
| E2E-SET-003 | Clear local server URL field and save | `localStorage.removeItem('local_server_url')` called |

---

## 8. Desktop Smoke Tests (Electron)

These manual tests run on the Mac mini M4 Pro 24 GB with the Electron build
(`npm run electron:dev`). They verify that the IPC bridge between the renderer and the Electron
main process is intact.

| Test ID | Scenario | Pass Criteria |
|---------|----------|---------------|
| ELEC-001 | Launch desktop app — `window.localAI.isElectron` is `true` | Local model section visible in ImageStudio |
| ELEC-002 | Open LocalModelManager, click "Download" on Z-Image Turbo | Progress toast appears, binary downloads |
| ELEC-003 | After download, click Generate with Z-Image Turbo and a prompt | Image renders in ≤90s (M4 Pro baseline) |
| ELEC-004 | Cancel an in-flight generation | Generation stops, cancel button resets to Generate |
| ELEC-005 | Configure Wan2GP URL to `http://192.168.1.100:7860`, click Probe | Toast shows connection status |

---

## 9. Non-Functional Verification

| NFR ID | Requirement | Measurement | Pass Threshold |
|--------|-------------|-------------|----------------|
| NFR-001 | Image generation latency (local, sd.cpp, Dreamshaper 8, 512×512) | Wall-clock time from click to image render | ≤60s on M4 Pro 24 GB |
| NFR-002 | Image generation latency (local, Z-Image Turbo, 1:1, 8 steps) | Wall-clock time | ≤30s on M4 Pro 24 GB |
| NFR-003 | Next.js cold start time | `npm run dev` to first meaningful paint | ≤10s |
| NFR-004 | Bundle size (web build) | `npm run build` output report | ≤5 MB initial JS |
| NFR-005 | No secrets in localStorage | Audit `localStorage` keys after cloud generation | `muapi_key` present, no other credentials |
| NFR-006 | Lint clean | `npm run lint` | 0 errors |

---

## 10. Security Test Cases

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| SEC-001 | API key entered in AuthModal is stored only in `localStorage['muapi_key']`, never in URL or cookies | DevTools Network panel shows no key in request URLs |
| SEC-002 | `MuapiClient.getKey()` throws rather than sending empty Authorization header | Error thrown, no request dispatched |
| SEC-003 | XSS: inject `<script>alert(1)</script>` into prompt input | Script does not execute; text is escaped in DOM |
| SEC-004 | Middleware rewrite does not forward cookies from browser to Muapi backend | `Cookie` header absent in upstream request |
| SEC-005 | Local server URL validated before storage — only `http://` or `https://` accepted | Malformed URL rejected by SettingsModal |

---

## 11. Regression Test Matrix

These tests guard against regressions introduced by the Sprint 1 provider abstraction refactor.
They must all pass on every PR before G3 approval.

| Test ID | Feature | Description |
|---------|---------|-------------|
| REG-001 | Auth bypass | `AuthModal` returns `null` in local mode — no stale auth prompt |
| REG-002 | Auto-key | `muapi_key = 'local'` is set automatically in local mode — no "API Key missing" error |
| REG-003 | Model list isolation | Local model IDs never appear in `t2iModels`; cloud IDs never appear in `LOCAL_MODEL_CATALOG` |
| REG-004 | Middleware passthrough | Non-API paths (e.g., `/`, `/studio`) are not rewritten by middleware |
| REG-005 | Pending job cleanup | `removePendingJob` called after both success and failure — no orphaned jobs |
| REG-006 | Brand name | "Open-Generative-AI" string is absent from rendered HTML across all components |
| REG-007 | Tab visibility | Workflows and Agents tabs absent from DOM — no broken tab rendering |

---

## 12. Test Execution Order

Run test suites in this sequence on every PR targeting `main`:

1. **Lint** — `npm run lint` (fail fast; do not proceed if lint errors exist)
2. **Unit tests** — `npx vitest run src/lib/` (Sections 4.1–4.6)
3. **Component tests** — `npx vitest run src/components/` (Section 5)
4. **Integration tests** — start dev server, then `npx vitest run tests/integration/` (Section 6)
5. **E2E tests** — `npx playwright test` targeting Chromium only (Section 7)
6. **Desktop smoke tests** — manual checklist on Mac mini M4 Pro (Section 8; required for G3 only)
7. **NFR measurements** — wall-clock timings captured after E2E pass (Section 9)
8. **Security spot checks** — manual DevTools audit of Sections 10 cases

Automated steps 1–5 must be green before any G3 evidence is submitted. Desktop smoke (step 6)
requires a physical Mac mini M4 Pro and is gated to the G3 sign-off session, not per-PR CI.

---

## Quality Gates

This test plan governs gate **G3 — Ship Ready**.

### G3 Pass Criteria

| Criterion | Evidence | Owner |
|-----------|----------|-------|
| All unit tests pass (Sections 4.1–4.6) | Vitest HTML report, 0 failures | `@reviewer` |
| All component tests pass (Section 5) | Vitest HTML report, 0 failures | `@reviewer` |
| All integration tests pass (Section 6) | Vitest integration run, 0 failures | `@reviewer` |
| E2E happy paths pass (Section 7.1 & 7.2) | Playwright HTML report, 0 failures | `@reviewer` |
| `src/lib/` line coverage ≥ 70% | Vitest coverage report | `@reviewer` |
| `npm run lint` exits 0 | CI log | `@coder` |
| Desktop smoke tests ELEC-001–ELEC-005 pass | Manual sign-off checklist | CEO / `@reviewer` |
| No BLOCKER security findings (Section 10) | Security spot-check notes | `@reviewer` |
| NFR thresholds met (Section 9) | Timing log attached to G3 evidence | `@reviewer` |

G3 approval authority: **CTO**. Evidence package submitted by `@reviewer` after all criteria above
are marked ✅ in the sprint close checklist.

---

## References

This test plan is derived from and traces to the following upstream SDLC artifacts:

### Planning Stage
- [Requirements Specification](../../01-planning/requirements.md) — functional requirements
  FR-C01 through FR-L01 define every test case in Sections 4–7 of this plan. Test IDs reference
  FR codes directly (e.g., FR-C01 → IS-*, E2E-IMG-*, E2E-LOCAL-*).
- [Sprint 1 Plan](../../04-build/sprints/sprint-1-plan.md) — defines the in-scope modules for
  Sprint 1, which directly maps to the Section 2.1 scope table. Out-of-scope deferrals in Section
  2.2 are sourced from Sprint 1 plan's "Out of Scope" column.

