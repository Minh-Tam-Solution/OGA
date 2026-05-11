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
        │         ├── mode: "local"  → LOCAL_API_URL (http://gpu-server-s1:8000 or LAN URL)
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
        [Diffusers runtime — CUDA (primary) / MPS (fallback)]
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

## API Flow — Video Generation (Local Mode, Async)

```
1. User nhập prompt → chọn aspect ratio → click Generate trong VideoStudio
2. VideoStudio.js → muapi.generateVideoAsync({ prompt, model: "cogvideox-5b", aspect_ratio: "16:9" })
3. MuapiClient gọi: POST ${getApiBase()}/api/v1/async-generate
4. server.py enqueue job → return { status: "processing", job_id: "abc123" }
5. VideoStudio hiển thị "Job queued — starting soon..."
6. MuapiClient poll mỗi 5s: GET /api/v1/jobs/abc123
7. server.py trả về { status: "processing" } trong ~40s
8. server.py hoàn thành → lưu MP4 → trả về { status: "completed", result: { outputs: [...] } }
9. VideoStudio hiển thị video MP4 trong canvas
```

---

## local-server API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check — engine, model, memory |
| `/api/model-status` | GET | Loaded model, memory, latency meta |
| `/api/v1/{model}` | POST | Muapi-compatible generation (sync) |
| `/api/v1/async-generate` | POST | Enqueue long-running generation job |
| `/api/v1/jobs/{job_id}` | GET | Poll job status / retrieve result |
| `/api/v1/swap-model` | POST | Hot-swap active pipeline |
| `/api/v1/remove-bg` | POST | RMBG background removal |

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
        ├── Video Studio ──→ server.py (CogVideoX 5B, async job queue)
        ├── Cinema Studio ──→ Muapi.ai cloud (Sprint 7, spike FAIL → cloud-only)
        └── Lip Sync Studio ──→ cloud-only (Sprint 9, all local models failed)

[local-server/server.py — FastAPI, port 8000 (dev) / 8123 (prod)]
        │
        ├── State Machine: IDLE → LOADING → READY → GENERATING
        ├── Hot-Swap: POST /api/v1/swap-model (diffusers/custom only)
        ├── Utility: POST /api/v1/remove-bg (rembg, always-resident)
        ├── Image Gen: POST /api/v1/{model} (Diffusers + MPS CPU offload)
        ├── Video Gen: POST /api/v1/async-generate + GET /api/v1/jobs/{id} (CogVideoX, async polling)
        ├── Product: POST /api/v1/product-placement (IP-Adapter, Sprint 7)
        └── Health: GET /health (engine, model, peak_ram, latency)

[AI-Platform Gateway — S1 :8120 (MOP integration)]
        │
        ├── Routes to: OGA server.py :8123 (priority 1)
        ├── Fallback: fal.ai / Replicate (priority 2-3)
        └── Adds: X-Provider-Used, X-Cost-Vnd headers
```

### Design Artifacts (Sprint 6-8)

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
| [ADR-005](01-ADRs/ADR-005-lipsync-architecture.md) | Lip Sync architecture + MIT face detection |
| [TS-005](14-Technical-Specs/TS-005-liveportrait-lipsync.md) | LivePortrait endpoint spec (superseded; reference only) |

---

## Quality Gate Requirements

This stage feeds gate(s): **G2**

- [x] **G2 (Sprint 1)**: Provider abstraction designed
- [x] **G2 (Sprint 5)**: Diffusers engine migration approved
- [x] **G2 (Sprint 6)**: Hot-swap architecture + RMBG utility designed
- [x] **G2 (Sprint 8-9)**: Lip Sync decision finalized as cloud-only for current phase

---

## Dependencies

| Upstream Stage | What to Consume |
|---------------|-----------------|
| [00-foundation](../00-foundation/) | Problem statement, constraints, MOP context |
| [01-planning](../01-planning/) | FR-S6-01→FR-S6-04, FR-S8-01→FR-S8-04, NFRs |

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
| ADR-005 Lip Sync architecture | ✅ Required | ✅ Done (revised v2.1) | @architect |
| TS-005 LivePortrait endpoint | ✅ Required | ✅ Superseded (reference) | @architect |

---

*NQH Creative Studio (OGA) | MOP Tier 1+2 | SDLC Framework v6.3.1 | Stage 02: Design*

---

## Audio Production Architecture (G2 — ADR-007 v4 Accepted)

**Status:** ACCEPTED | **Gate:** G2-audio PASSED (CTO + CPO 2026-05-10)

### Architecture Overview

```
[Browser — NQH/MTS Employee]
        │
        ▼
[Next.js 15 App — port 3000]
        │
        ├── src/lib/aiPlatformVoiceClient.js   ← Track B consumer wrapper
        │         │
        │         ├── Primary:   vi-piper-vais1000 (Piper, 22050Hz)
        │         └── Fallback:  vi-melotts-default (MeloTTS, 44100Hz)
        │
        ├── app/api/voice/tts/route.js          ← Proxy route (hides API key)
        │         │
        │         └── POST /api/voice/tts
        │               → AI-Platform Gateway (:8120)
        │               → /api/v1/voice/tts/synthesize
        │
        └── AI-Platform Voice Service (:8121)
                  │
                  ├── TTS Orchestrator
                  │   ├── Registry lookup (voice.tts_voices)
                  │   ├── Adapter routing (piper | melotts | vineu)
                  │   ├── Watermark embed (AudioSeal)
                  │   └── MinIO upload + presigned URL
                  │
                  └── Returns: {audio_url, duration_ms, engine, voice_id}
```

### Key Design Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| OGA hosts NO audio engine | AI-Platform owns all TTS; OGA is pure consumer | ✅ Locked |
| Piper primary, MeloTTS fallback | Piper = low latency; MeloTTS = natural quality | ✅ Validated |
| Server-side API key | Key never reaches browser; proxy route enforces auth | ✅ Implemented |
| Container-level audio fetch | MinIO presigned URL uses internal DNS (defect #20) | ✅ Workaround |
| REST boundary | Contains GPL `unidecode` inside AI-Platform; OGA never imports | ✅ License clean |

### Engine Comparison (Production Truth)

| Engine | Sample Rate | Latency | Quality | Registry | Image |
|--------|-------------|---------|---------|----------|-------|
| Piper VAIS1000 | 22050Hz | ~330ms | Neutral/robotic | ✅ Seeded | ✅ Baked |
| MeloTTS VN | 44100Hz | ~3.2s | Natural (Hùng 5/5) | ✅ Seeded | ⚠️ Container-only |
| VieNeu | 24000Hz | TBD | TBD | ❌ Residue | ❌ Deferred S118 |

### Production Caveats

- **Brand initials:** Latin abbreviations (e.g., "NQH") are weak on both Piper and MeloTTS. Workaround: spell out in script input ("N Q H").
- **MeloTTS fragility:** Container changes non-persistent. Recreate = revert to broken state until S118 image rebuild.
- **OOM risk:** Voice service killed under concurrent load (Whisper + MeloTTS). Auto-restart policy needed.
- **Customer-facing:** ADR-091 unsigned. Internal use only until CPO+CTO joint sign-off.

---

*02-design README | Updated 2026-05-10 | G2 Audio Production PASSED | Sprint 13 planned*
