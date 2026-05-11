---
adr_id: ADR-002
title: "Replace mflux CLI with Diffusers In-Process Pipeline"
status: Approved
date: 2026-04-29
deciders: ["@cto", "@ceo"]
gate: G2
supersedes: null
---

# ADR-002: Replace mflux CLI with Diffusers In-Process Pipeline

## Status

**Approved** — CTO approved 9/10 with conditions. CPO approved with KPI gates.

## Context

Sprint 1-3 used `mflux-generate` CLI as subprocess for local image generation. This
caused OOM on MacBook M4 Pro 24GB because:

1. mflux loads entire model into unified memory per invocation (~12-15GB Q8, ~6-8GB Q4)
2. No way to control component lifecycle from FastAPI server (subprocess owns memory)
3. With Chrome + IDE running (~14GB), only ~10GB available → OOM at 512×512

CEO tested ZPix (same hardware) which uses Diffusers `enable_model_cpu_offload(device="mps")`
and generates 1024×1024 without OOM. Peak RAM ~3-6GB.

## Decision

Replace mflux CLI subprocess with Hugging Face Diffusers in-process pipeline in
`local-server/server.py`. Use `enable_model_cpu_offload(device="mps")` for Apple Silicon
memory management.

### What Changes

| Component | Before (mflux) | After (Diffusers) |
|-----------|----------------|-------------------|
| Inference | `subprocess.exec("mflux-generate")` | `pipe(**kwargs).images[0]` |
| Memory | Full model loaded per call | Sequential component offload |
| Models | Single model via `--model` flag | Curated registry, hot-swap |
| Concurrency | Process isolation (safe) | `asyncio.Lock()` (single-gen) |
| Kill switch | N/A | `INFERENCE_ENGINE=mflux` fallback |
| Video Gen | Not supported | CogVideoX 5B via `CogVideoXPipeline` (16 frames, 720×480 max) |
| Long tasks | Synchronous (risk 504 timeout) | Async job queue: `POST /api/v1/async-generate` + polling `GET /api/v1/jobs/{id}` |

### What Stays the Same

- FastAPI server on port 8000
- `/api/v1/{model}` Muapi-compatible endpoint
- `/health` endpoint
- Next.js middleware proxy
- providerConfig.js routing

## Consequences

### Positive
- No OOM at 1024×1024 on 24GB hardware
- In-process pipeline: no cold start per request after initial load
- Native img2img support (Flux2 Klein 4B `image` kwarg)
- LoRA hot-swap possible (diffusers `load_lora_weights`)
- Better observability: `torch.mps.current_allocated_memory()`
- Video generation: CogVideoX 5B produces coherent 2-second MP4 clips locally on RTX 5090
- Async queue eliminates 504 Gateway Timeout for long-running generations (~40s video gen)

### Negative
- Server startup slower (~10-30s for model load vs instant with subprocess)
- Larger Python dependency tree (diffusers + torch + peft)
- Must pin exact diffusers commit (API unstable between releases)
- Single-threaded generation (asyncio.Lock blocks concurrent requests)
- Video requires resolution clamping (720×480 max) to fit 32GB VRAM; VAE tiling corrupts output
- AnimateDiff disabled: diffusers 0.38.0 + RTX 5090 (Blackwell) produces noise across all dtype/scheduler combos

### Risks
- MPS offload may be slower than mflux native MLX path (mitigated: 2x regression KPI)
- diffusers commit pinning creates maintenance burden (mitigated: test on upgrade)

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| mflux with lower quantize (Q3) | Still OOM at 1024×1024 with apps running |
| mflux with `--low-memory` flag | Flag doesn't exist in mflux v0.17.5 |
| Separate GPU server (Wan2GP) | Hardware not available; adds network dependency |
| sd.cpp with GGUF models | No MPS CPU offload equivalent; same OOM issue |

## Compliance

- **Kill switch**: `INFERENCE_ENGINE=mflux` env var preserves old path
- **Rollback**: branch-based, `git checkout main` returns to mflux baseline
- **KPI gate**: no merge without passing test matrix on MacBook 24GB

---

*NQH Creative Studio (OGA) | ADR-002 | Approved 2026-04-29*
