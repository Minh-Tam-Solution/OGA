---
spec_id: SPEC-03INTEGRATE-002
title: "api contracts for integrated runtime"
spec_version: "1.0.0"
status: active
tier: STANDARD
stage: "03-integrate"
category: api-contract
owner: "@architect"
created: 2026-05-06
last_updated: 2026-05-09
references:
  - docs/02-design/14-Technical-Specs/TS-002-diffusers-pipeline.md
  - docs/02-design/14-Technical-Specs/TS-003-pipeline-hot-swap.md
  - docs/02-design/14-Technical-Specs/TS-004-rembg-utility.md
  - /home/nqh/shared/BAP/docs/02-design/01-ADRs/ADR-002-nqh-ai-platform-integration.md
  - /home/nqh/shared/models/core/projects/mop/architecture/ADR-004-mflux-aiplatform-integration.md
---

# API Contracts — Integrated Runtime

## 1. Canonical Endpoints

| Endpoint | Method | Purpose | Mode |
|----------|--------|---------|------|
| `/health` | GET | Liveness + runtime snapshot | local |
| `/api/model-status` | GET | Loaded model, memory, latency meta | local |
| `/api/v1/{model}` | POST | Muapi-compatible generation route (sync) | local |
| `/api/v1/async-generate` | POST | Enqueue long-running generation job | local |
| `/api/v1/jobs/{job_id}` | GET | Poll job status / result | local |
| `/api/v1/remove-bg` | POST | RMBG background removal | local |
| `/api/v1/swap-model` | POST | Hot-swap active pipeline | local |
| `/api/v1/async-generate` | POST | Enqueue long-running generation job | local |
| `/api/v1/jobs/{job_id}` | GET | Poll job status / result | local |
| `/v1/images/generations` | POST | OpenAI-compatible image generation | local/ai-platform |

## 2.5 External Service Handoff Contracts

### OpenReel — Asset Export/Import

OGA → OpenReel handoff uses MinIO/S3 presigned URLs (not direct API):

| Direction | Mechanism | TTL |
|-----------|-----------|-----|
| OGA → OpenReel | Presigned GET URL for source MP4 | 15 minutes |
| OpenReel → OGA | Presigned PUT URL for edited MP4 | 15 minutes |

No new API endpoints in OGA server.py; handoff is storage-mediated.

### IndexTTS / Draft to Take — Companion Microservice

Runs on S1 as separate Docker Compose stack. OGA communicates via internal REST:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/tts/generate` | Submit script → receive audio URL | TTS generation |
| `POST /api/tts/mix` | Submit stems + timing → receive mix | Audio mixing |
| `GET /api/tts/voices` | List available speaker voices | Voice catalog |
| `GET /health` | Liveness probe | Ops monitoring |

## 2. Response Envelope

### 2.1 Success (generation-style)

```json
{
  "request_id": "string",
  "status": "completed",
  "outputs": ["data:image/png;base64,..."],
  "_meta": {
    "model": "string",
    "elapsed_seconds": 12.4
  }
}
```

### 2.3 Async Job Envelope

**Submit (`POST /api/v1/async-generate`)**

```json
{
  "status": "processing",
  "job_id": "abc123def456"
}
```

**Poll (`GET /api/v1/jobs/{job_id}`)**

```json
{
  "status": "completed",
  "result": {
    "request_id": "abc123def456",
    "status": "completed",
    "outputs": ["data:video/mp4;base64,..."],
    "_meta": {
      "model": "CogVideoX 5B",
      "elapsed_seconds": 42.1,
      "file_path": "/tmp/nqh-output/abc123def456.mp4"
    }
  }
}
```

Job states: `pending` → `processing` → `completed` | `failed`.

### 2.2 Error envelope

```json
{
  "error": "human-readable message",
  "code": "optional_machine_code"
}
```

## 3. Status Codes

| Code | Meaning | Typical scenarios |
|------|---------|-------------------|
| 200 | Success | Health, generation, utility success |
| 400 | Bad request | Invalid model, invalid payload |
| 409 | Conflict | Swap requested during active generation |
| 413 | Payload too large | Oversized input image/audio/video |
| 422 | Unprocessable input | Face detection/audio constraints |
| 503 | Temporarily unavailable | swap in progress, memory pressure |
| 500 | Internal failure | runtime exception |

## 4. Integration Guarantees

- Local mode does not call `*.muapi.ai` for image/marketing local workflows.
- Video Studio uses async local path (`/api/v1/async-generate`) for Wan2.1, LTX-Video, and CogVideoX 5B; cloud path for Seedance/Kling via muapi.ai.
- Post-Production (OpenReel) runs as subdomain companion; no direct API contract with OGA backend.
- Voice Studio (IndexTTS) runs as companion microservice on S1; OGA frontend calls its REST API directly.
- Cinema/lipsync remain cloud-first.
- Device selection remains transparent to client; contract remains stable across CUDA/MPS hosts.
- AI-Platform interop supports `X-API-Key` header model used by BAP.
- Gateway-proxied responses should preserve ecosystem observability headers where available:
  - `X-Provider-Used`
  - `X-Generation-Time-Ms`
  - `X-Cost-Vnd`

## 5. Backward Compatibility

- Keep Muapi-compatible routes active while internal integrations migrate.
- Additive fields in `_meta` are allowed; breaking changes require ADR update and G3 review.

## 6. Cross-Project Header/Auth Contract

| Contract | Required | Notes |
|----------|----------|-------|
| `X-API-Key` request header | Yes (AI-Platform path) | Align with BAP OpenAI custom header implementation |
| `OPENAI_BASE_URL` env support | Yes | Must point to AI-Platform when integrated |
| `OPENAI_CUSTOM_HEADER_NAME/VALUE` | Yes | Keep env-gated like BAP for safe rollout |

---

*NQH Creative Studio (OGA) | Stage 03 Integrate | API contracts*
