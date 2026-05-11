---
spec_id: SPEC-03INTEGRATE-001
title: "gpu server integration profile"
spec_version: "1.0.0"
status: active
tier: STANDARD
stage: "03-integrate"
category: integration
owner: "@architect"
created: 2026-05-06
last_updated: 2026-05-09
references:
  - docs/02-design/01-ADRs/ADR-004-aiplatform-integration.md
  - docs/08-collaborate/HANDOFF-SPRINT9-PM-GPU-SERVER.md
  - /home/nqh/shared/BAP/docs/02-design/01-ADRs/ADR-002-nqh-ai-platform-integration.md
  - /home/nqh/shared/models/core/projects/mop/architecture/ADR-004-mflux-aiplatform-integration.md
---

# GPU Server S1 Integration Profile

## 1. Objective

Define integration standards to run OGA local inference on GPU Server S1 as the primary node,
while keeping Mac Mini as fallback runtime.

## 2. Runtime Topology

| Layer | Endpoint | Role | Ports |
|------|----------|------|-------|
| OGA UI | `http://<lan-host>:3005` | User-facing Next.js app | 3005 |
| Local API | `http://<lan-host>:8000` | FastAPI inference service | 8000 |
| OpenReel Editor | `https://editor.studio.nhatquangholding.com` | Post-production video editor (subdomain) | 3006 |
| IndexTTS | `http://<lan-host>:8001` | TTS/audio companion microservice | 8001 |
| AI-Platform (optional) | `http://<gateway>:8120` | Routing and fallback orchestration | 8120 |

`<lan-host>` maps to GPU Server S1 in production-like environments.

## 3. Host Prerequisites

| Component | Minimum |
|-----------|---------|
| OS | Ubuntu 22.04+ |
| NVIDIA Driver | 535+ |
| CUDA | 12.1+ |
| Node.js | 20+ |
| Python | 3.12 |
| Docker Compose | v2+ (for IndexTTS) |
| pnpm | 8+ (for OpenReel) |

## 4. Environment Contract

```bash
LOCAL_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LOCAL_MODE=true
NEXT_PUBLIC_PROVIDER_MODE=local

# AI-Platform compatibility (BAP/MOP alignment)
OPENAI_BASE_URL=https://ai.nhatquangholding.com/api/v1
OPENAI_CUSTOM_HEADER_NAME=X-API-Key
OPENAI_CUSTOM_HEADER_VALUE=<secret>
```

Cloud-only studios require valid cloud credentials in environment/secrets management.

## 5. Health and Readiness

### 5.1 Minimum readiness checks

1. `GET /health` returns `{"status":"ok", ...}`
2. local server process responds within 2 seconds on warm path
3. frontend can generate local image and render result
4. video/lipsync screens display cloud-mode behavior without local endpoint errors

### 5.2 Fallback rules

- If GPU host is unavailable, failover to cloud provider for supported workloads.
- If local inference is unhealthy but UI is healthy, disable local generation actions and show operator message.
- Mac Mini fallback can be activated by updating environment host values and restarting services.

## 6. Operational Notes

- Prefer `float16` on CUDA, `bfloat16` on MPS where applicable.
- Keep image/marketing local-first to optimize cost.
- Video generation: local-first via Wan2.1/LTX; cloud fallback for Seedance/Kling.
- Keep cinema/lipsync cloud-first unless local models pass spike gates.
- OpenReel runs as standalone subdomain; no direct integration with OGA backend.
- IndexTTS runs as Docker Compose companion; monitor VRAM coexistence with video pipeline.
- For AI-Platform calls, preserve BAP-compatible custom header auth behavior (`X-API-Key`).
- If routed through AI-Platform gateway, preserve provider observability headers for ecosystem dashboards.

## 8. VRAM Budget Map (RTX 5090 32GB)

| Service | VRAM | Coexistence Rule |
|---------|------|-----------------|
| OGA Image (SDXL/FLUX) | ~8 GB | Can coexist with TTS |
| OGA Video (LTX) | ~9 GB | Can coexist with TTS (CPU mode) |
| OGA Video (Wan2.1) | ~11 GB | Can coexist with TTS (CPU mode) |
| OGA Video (CogVideoX) | ~30 GB | Must unload before any TTS |
| IndexTTS2 (GPU) | 12–16 GB | Queue if OGA video loaded; use CPU fallback |
| IndexTTS2 (CPU) | 0 GB | Always safe; slower generation |
| OmniVoice | ~2 GB | Can run CPU-only |
| Qwen3-8B GGUF | 0 GB | CPU-only via llama.cpp |

**Rule:** Only one GPU-heavy service at a time. VRAM-arbiter gate: refuse TTS if `nvidia-smi` shows >28 GB allocated.

## 7. BAP + MOP Compatibility Matrix

| Topic | OGA (this project) | BAP | MOP |
|------|---------------------|-----|-----|
| AI base URL | Configurable via env | `OPENAI_BASE_URL` used in production | AI-Platform gateway is core integration hub |
| Custom auth header | Supported for integration paths | `X-API-Key` required | `X-API-Key` specified in ADR integration |
| Provider observability | Keep headers if gateway-proxied | Consumed at platform level | `X-Provider-Used` and cost/time tracking required |
| Routing policy | Local-first for image/marketing | AI gateway mediated model access | Cloud-first governance for non-local-ready workloads |

---

*NQH Creative Studio (OGA) | Stage 03 Integrate | GPU Server S1 profile*
