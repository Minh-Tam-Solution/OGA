# 02-design — NQH Creative Studio (OGA)

## Purpose

**Key Question:** HOW will we build it?

---

## Architecture Overview

```
[Browser — NQH/MTS Employee]
        │
        ▼
[Next.js 15 App — port 3000]
        │
        ├── src/lib/providerConfig.js   ← NEW: provider abstraction SSOT
        │         │
        │         ├── mode: "local"  → LOCAL_API_URL (http://mac-mini:8000)
        │         └── mode: "cloud"  → https://api.muapi.ai (disabled Phase 1)
        │
        ├── middleware.js               ← proxy /api/v1/* → backend
        │
        └── src/components/ImageStudio.js  ← reads providerConfig, filters models
                  │
                  ▼
        [local-server/server.py — FastAPI, port 8000]
                  │
                  ▼
        [mflux-generate CLI — MLX, Apple Silicon M4 Pro]
                  │
                  ▼
        [PNG base64 response]
```

---

## Key Design Decision: Provider Abstraction

**Problem:** Muapi.ai URLs hardcoded in 6+ locations across 2 API clients + middleware + route handlers.

**Solution:** Centralized `src/lib/providerConfig.js` — single source of truth.

```javascript
// src/lib/providerConfig.js (spec)
export function getProviderMode() {
  return process.env.NEXT_PUBLIC_PROVIDER_MODE || 'local';
}

export function getApiBase() {
  if (getProviderMode() === 'local') {
    return process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:8000';
  }
  return 'https://api.muapi.ai';
}

export function isLocalMode() {
  return getProviderMode() === 'local';
}
```

**Files impacted by provider abstraction:**

| File | Current | After |
|------|---------|-------|
| `src/lib/muapi.js` (line 7) | `localStorage + hardcode muapi.ai` | Import `getApiBase()` |
| `packages/studio/src/muapi.js` (line 3) | `const BASE_URL = 'https://api.muapi.ai'` | Import `getApiBase()` |
| `middleware.js` (line 4) | `process.env.LOCAL_API_URL` | Import `getApiBase()` |
| `app/api/api/v1/route.js` | `const MUAPI_BASE = 'https://api.muapi.ai'` | `process.env.API_BASE_URL \|\| getApiBase()` |
| `app/api/workflow/route.js` | Same | Same pattern |
| `app/api/agents/route.js` | Same | Same pattern |
| `app/api/app/route.js` | Same | Same pattern |

**Env vars:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_PROVIDER_MODE` | `local` | `local` hoặc `cloud` |
| `NEXT_PUBLIC_LOCAL_API_URL` | `http://localhost:8000` | Mac mini LAN IP khi deploy |
| `LOCAL_API_URL` | `http://localhost:8000` | Server-side middleware routing |

---

## Component Changes — Sprint 1

| Component | Thay đổi |
|-----------|---------|
| `components/StandaloneShell.js` | Rebrand "NQH Creative Studio"; replace balance polling with server health check; filter tabs |
| `src/components/ImageStudio.js` | Dùng `providerConfig.getApiBase()`; lọc models theo `isLocalMode()` |
| `src/components/AuthModal.js` | Skip hoàn toàn khi local mode |
| `src/components/SettingsModal.js` | "Muapi API Key" → "Server Configuration" |
| `src/components/Header.js` | Update branding text + title |
| Video/LipSync/Cinema/Marketing tabs | Wrap với `<ComingSoon />` banner |
| Workflows/Agents tabs | Ẩn hoàn toàn khỏi tab list |

---

## API Flow — Image Generation (Local Mode)

```
1. User nhập prompt → click Generate trong ImageStudio
2. ImageStudio.js → muapi.generateImage({ prompt, model: "flux-schnell" })
3. MuapiClient gọi: POST ${getApiBase()}/api/v1/flux-schnell-image
4. middleware.js bắt /api/v1/* → rewrite to LOCAL_API_URL
5. local-server/server.py nhận POST /api/v1/flux-schnell-image
6. server.py gọi subprocess: mflux-generate --model schnell --quantize 8 --steps 4
7. mflux sinh PNG (34–49s) → server.py đọc file → base64 encode
8. Response: { request_id, status: "completed", outputs: ["data:image/png;base64,..."] }
9. MuapiClient poll (noop — already completed)
10. ImageStudio hiển thị ảnh
```

---

## local-server API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check — trả về model, quantize |
| `/v1/models` | GET | Danh sách models local |
| `/v1/images/generations` | POST | OpenAI-compatible image gen |
| `/api/v1/{model}` | POST | Muapi-compatible (dùng bởi frontend) |
| `/api/v1/account/balance` | GET | Fake balance — trả về 999999 LOCAL |
| `/api/v1/predictions/{id}/result` | GET | Polling endpoint (returns cached result) |

---

---

## Sprint 6 Architecture — Hot-Swap + Multi-Studio

```
[Browser — NQH/MTS Employee]
        │
        ▼
[Next.js 15 App — port 3001 (dev) / 3000 (prod)]
        │
        ├── Image Studio ──→ server.py (Diffusers pipeline, hot-swap)
        ├── Marketing Studio ──→ server.py /api/v1/remove-bg (RMBG utility)
        ├── Video Studio ──→ Muapi.ai cloud (Phase 6, cloud-only)
        ├── Cinema Studio ──→ Coming Soon (Sprint 7 conditional)
        └── Lip Sync Studio ──→ Coming Soon (Sprint 8 conditional)

[local-server/server.py — FastAPI, port 8000 (dev) / 8123 (prod)]
        │
        ├── State Machine: IDLE → LOADING → READY → GENERATING
        ├── Hot-Swap: POST /api/v1/swap-model (diffusers/custom only)
        ├── Utility: POST /api/v1/remove-bg (rembg, always-resident)
        ├── Image Gen: POST /api/v1/{model} (Diffusers + MPS CPU offload)
        └── Health: GET /health (engine, model, peak_ram, latency)

[AI-Platform Gateway — S1 :8120 (MOP integration)]
        │
        ├── Routes to: OGA server.py :8123 (priority 1)
        ├── Fallback: fal.ai / Replicate (priority 2-3)
        └── Adds: X-Provider-Used, X-Cost-Vnd headers
```

### Design Artifacts (Sprint 6)

| Document | Purpose |
|----------|---------|
| [ADR-001](01-ADRs/ADR-001-initial-architecture.md) | Initial provider abstraction |
| [ADR-002](01-ADRs/ADR-002-diffusers-engine.md) | mflux → Diffusers migration |
| [ADR-003](01-ADRs/ADR-003-hot-swap-architecture.md) | Hot-swap state machine + memory management |
| [ADR-004](01-ADRs/ADR-004-aiplatform-integration.md) | AI-Platform routing spec |
| [TS-001](14-Technical-Specs/TS-001-provider-abstraction.md) | Provider config module |
| [TS-002](14-Technical-Specs/TS-002-diffusers-pipeline.md) | Diffusers pipeline integration |
| [TS-003](14-Technical-Specs/TS-003-pipeline-hot-swap.md) | Hot-swap API + state transitions |
| [TS-004](14-Technical-Specs/TS-004-rembg-utility.md) | RMBG endpoint spec |

---

## Quality Gate Requirements

This stage feeds gate(s): **G2**

- [x] **G2 (Sprint 1)**: Provider abstraction designed
- [x] **G2 (Sprint 5)**: Diffusers engine migration approved
- [ ] **G2 (Sprint 6)**: Hot-swap architecture + RMBG utility designed

---

## Dependencies

| Upstream Stage | What to Consume |
|---------------|-----------------|
| [00-foundation](../00-foundation/) | Problem statement, constraints, MOP context |
| [01-planning](../01-planning/) | FR-S6-01→FR-S6-04, NFRs |

---

## Artifact Checklist

| Artifact | Required | Status | Owner |
|----------|----------|--------|-------|
| Architecture overview (this file) | ✅ Required | ✅ Done | @architect |
| ADR-001 Provider abstraction | ✅ Required | ✅ Done | @architect |
| ADR-002 Diffusers engine | ✅ Required | ✅ Done | @architect |
| ADR-003 Hot-swap architecture | ✅ Required | ✅ Done | @architect |
| ADR-004 AI-Platform integration | ✅ Required | ✅ Done | @architect |
| TS-001 Provider config | ✅ Required | ✅ Done | @architect |
| TS-002 Diffusers pipeline | ✅ Required | ✅ Done | @architect |
| TS-003 Hot-swap API | ✅ Required | ✅ Done | @architect |
| TS-004 RMBG utility | ✅ Required | ✅ Done | @architect |

---

*NQH Creative Studio (OGA) | MOP Tier 1+2 | SDLC Framework v6.3.1 | Stage 02: Design*
