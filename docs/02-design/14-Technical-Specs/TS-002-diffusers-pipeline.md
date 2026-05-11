---
ts_id: TS-002
title: "Diffusers Pipeline Integration"
ts_version: "1.0.0"
status: Approved
stage: "02-design"
owner: "@architect"
created: 2026-04-29
last_updated: 2026-05-06
references:
  - ADR-002 (docs/02-design/01-ADRs/ADR-002-diffusers-engine.md)
  - ZPix reference (app.py lines 158-209, 312-428)
gate: G2
---

# TS-002: Diffusers Pipeline Integration

## 1. Overview

Replace `generate_image()` in `local-server/server.py` — from mflux subprocess to
Diffusers in-process pipeline with device-aware execution (`cuda` preferred, `mps` fallback).

Reference implementation: ZPix `app.py` plus GPU Server S1 deployment baseline.

---

## 2. Python Dependencies

Pin in `requirements-mac.txt`:

```
torch==2.10.0
diffusers @ https://github.com/huggingface/diffusers/archive/b757035df6fe080b56a672c4000e458bb442821a.zip
peft==0.18.1
sdnq==0.1.6
```

**Critical**: exact diffusers commit from ZPix. Do not upgrade without testing.

---

## 3. Model Registry

File: `local-server/models.json` (adopted from ZPix `curated_models.json`)

```json
[
    {
        "id": "Disty0/Z-Image-Turbo-SDNQ-uint4-svd-r32",
        "backup_id": "SamuelTallet/Z-Image-Turbo-SDNQ-uint4-svd-r32",
        "frontend_ids": ["z-image-turbo", "flux-schnell"],
        "name": "Z-Image Turbo",
        "pipeline": "ZImagePipeline",
        "default": {"steps": 8, "cfg": 0.0},
        "features": ["text-to-image"],
        "ram_gb": 6
    },
    {
        "id": "Disty0/FLUX.2-klein-4B-SDNQ-4bit-dynamic",
        "backup_id": "SamuelTallet/FLUX.2-klein-4B-SDNQ-4bit-dynamic",
        "frontend_ids": ["flux2-klein-4b", "dreamshaper-8"],
        "name": "FLUX.2 Klein 4B",
        "pipeline": "Flux2KleinPipeline",
        "default": {"steps": 4, "cfg": 1.0},
        "features": ["text-to-image", "image-to-image"],
        "ram_gb": 4
    },
    {
        "id": "/home/nqh/shared/models/cogvideox",
        "frontend_ids": ["cogvideox-5b"],
        "name": "CogVideoX 5B",
        "pipeline": "CogVideoXPipeline",
        "model_type": "diffusers",
        "default": {"steps": 25, "cfg": 6.0, "num_frames": 16},
        "features": ["text-to-video"],
        "ram_gb": 18
    }
]
```

`frontend_ids` maps OGA model dropdown IDs → Diffusers model. Backward compatible
with Sprint 1-3 frontend that sends `z-image-turbo` or `flux-schnell`.

---

## 4. Pipeline Lifecycle

### 4.1 Server Startup

```python
# Load default model once at startup
pipe = load_pipeline(DEFAULT_MODEL)

# Global generation lock — one request at a time
_gen_lock = asyncio.Lock()
```

### 4.2 load_pipeline() — Core Function

```python
import torch
from diffusers import ZImagePipeline, Flux2KleinPipeline

def load_pipeline(model_config):
    PipeClass = resolve_pipeline_class(model_config["pipeline"])

    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    dtype = torch.float16 if device == "cuda" else (torch.bfloat16 if device == "mps" else torch.float32)

    pipe = PipeClass.from_pretrained(model_config["id"], torch_dtype=dtype)

    # Memory optimization
    pipe.vae.to(memory_format=torch.channels_last)

    # CUDA path on GPU server; MPS offload path for Mac fallback
    if device == "cuda":
        pipe = pipe.to("cuda")
    elif device == "mps":
        pipe.enable_model_cpu_offload(device="mps")
    else:
        pipe.enable_model_cpu_offload()

    return pipe
```

### 4.3 How CPU Offload Works (from Diffusers internals)

```
User calls pipe(prompt="a cat", ...)
  │
  ├─ Step 1: text_encoder moved to MPS → encode prompt → moved to CPU
  │           Peak: ~2GB (text encoder only)
  │
  ├─ Step 2: transformer moved to MPS → denoise N steps → moved to CPU
  │           Peak: ~4-6GB (transformer only)
  │
  └─ Step 3: vae_decoder moved to MPS → decode latents → moved to CPU
              Peak: ~1-2GB (VAE only)

  Total peak: max(step1, step2, step3) ≈ 4-6GB
  Without offload: step1 + step2 + step3 ≈ 12-15GB → OOM
```

---

## 5. Generation Endpoint

### 5.1 Muapi-Compatible Route (existing)

```python
@app.post("/api/v1/{model_endpoint:path}")
async def muapi_generate(model_endpoint: str, req: MuapiRequest):
    model_config = resolve_model(model_endpoint)

    async with _gen_lock:
        start = time.time()
        mem_before = get_mps_memory()

        image = pipe(
            prompt=req.prompt,
            height=height,
            width=width,
            num_inference_steps=model_config["default"]["steps"],
            guidance_scale=model_config["default"]["cfg"],
            generator=torch.manual_seed(seed),
        ).images[0]

        elapsed = time.time() - start
        mem_peak = get_mps_memory()

    # Save + return base64
    b64 = image_to_base64(image)
    return {
        "request_id": uuid4().hex,
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {
            "model": model_config["name"],
            "elapsed_seconds": round(elapsed, 1),
            "peak_ram_mb": mem_peak,
        },
    }
```

### 5.2 Observability Helper

```python
def get_device_memory():
    """Return active accelerator allocated memory in MB."""
    if torch.cuda.is_available():
        return round(torch.cuda.memory_allocated() / 1024 / 1024)
    if torch.backends.mps.is_available():
        return round(torch.mps.current_allocated_memory() / 1024 / 1024)
    return 0
```

---

## 6. Kill Switch (INFERENCE_ENGINE env)

```python
INFERENCE_ENGINE = os.environ.get("INFERENCE_ENGINE", "diffusers")

if INFERENCE_ENGINE == "mflux":
    # Old path: mflux subprocess (Sprint 1-4 behavior)
    async def generate_image(prompt, width, height, **kwargs):
        return await mflux_subprocess_generate(prompt, width, height, **kwargs)
else:
    # New path: Diffusers in-process pipeline
    async def generate_image(prompt, width, height, **kwargs):
        return await diffusers_pipeline_generate(prompt, width, height, **kwargs)
```

---

## 7. Model Download & Status

### 7.1 Lazy Download

`from_pretrained()` downloads from HuggingFace on first use. Models cached in
`~/.cache/huggingface/hub/`.

### 7.2 Status Endpoint

```python
@app.get("/api/model-status")
async def model_status():
    return {
        "loaded_model": current_model["name"],
        "available_models": [m["name"] for m in MODEL_REGISTRY],
        "download_status": check_model_downloaded(current_model),
        "peak_ram_mb": last_peak_ram,
        "last_gen_latency_s": last_gen_latency,
    }
```

---

## 8. Affected Files

| File | Change | Task |
|------|--------|------|
| `local-server/server.py` | Major rewrite: Diffusers pipeline + lock + observability | 5.1, 5.3 |
| `local-server/models.json` | New: curated model registry | 5.2 |
| `local-server/requirements-mac.txt` | New: pinned Python deps | 5.2 |
| `src/lib/localModels.js` | Update: match curated registry IDs + RAM info | 5.4 |
| `app/api/health/route.js` | Update: forward `peak_ram_mb` from mflux health | 5.3 |

---

## 9. img2img Support (P2)

Flux2 Klein 4B natively supports `image` kwarg:

```python
if reference_image and "image-to-image" in model_config["features"]:
    pipe_kwargs["image"] = [Image.open(reference_image)]
```

Frontend sends image as base64 data URL → server decodes → passes to pipeline.

---

## 10. Open Questions

| # | Question | Owner |
|---|----------|-------|
| OQ-1 | Does ZPix diffusers commit support Flux Schnell 12B or only Klein 4B? | @coder spike day 1 |
| OQ-2 | Can LoRA .safetensors from Civitai work with SDNQ quantized models? | @coder deferred to 5.6 |
| OQ-3 | Does CogVideoX support image-to-video with `image` kwarg? | @coder deferred |

---

## 11. Video Generation — CogVideoX 5B

### 11.1 Pipeline Loading

```python
elif pipeline_name == "CogVideoXPipeline":
    from diffusers import CogVideoXPipeline
    pipe = CogVideoXPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
    if runtime_device == "cuda":
        pipe.enable_model_cpu_offload()
    current_model = model_config
    pipeline_state = PipelineState.READY
```

**Critical:** `torch.float16` is required on RTX 5090 (Blackwell). `bfloat16` produces monochrome/brown output.

### 11.2 Generation Flow

```python
async def diffusers_generate(..., request_id: str | None = None) -> dict:
    is_video = "text-to-video" in features
    if is_video:
        pipe_kwargs["num_frames"] = num_frames or defaults.get("num_frames", 16)
    
    result = await asyncio.to_thread(lambda: pipe(**pipe_kwargs))
    
    if is_video:
        from diffusers.utils import export_to_video
        frames = result.frames[0]
        mp4_path = OUTPUT_DIR / f"{request_id or uuid.uuid4().hex}.mp4"
        export_to_video(frames, str(mp4_path), fps=8)
        # Return base64 output + file_path in _meta
```

### 11.3 Resolution Clamp (VRAM Safety)

CogVideoX VAE tiling (`pipe.vae.enable_tiling()`) corrupts decode output on this model. VRAM safety is enforced via resolution clamping instead:

```python
def ar_to_size(ar: str | None) -> tuple[int, int]:
    mapping = {
        "1:1": (480, 480), "16:9": (720, 480), "9:16": (480, 720),
        "4:3": (640, 480), "3:4": (480, 640),
    }
    return mapping.get(ar or "1:1", (480, 480))
```

| Aspect Ratio | Resolution | Peak VRAM |
|--------------|------------|-----------|
| 16:9 | 720×480 | ~30 GB |
| 9:16 | 480×720 | ~30 GB |
| 1:1 | 480×480 | ~28 GB |
| 4:3 | 640×480 | ~29 GB |
| 3:4 | 480×640 | ~29 GB |

> 1280×720 or 49 frames causes OOM on RTX 5090 32GB.

### 11.4 Performance Baseline

| Steps | Resolution | Frames | Latency | Quality |
|-------|------------|--------|---------|---------|
| 25 | 720×480 | 16 | ~40s | Good (coherent motion) |
| 5 | 720×480 | 16 | ~38s | Acceptable (faster, slightly lower quality) |

---

## 14. Wan2.1 T2V-1.3B

### 14.1 Pipeline Loading

```python
elif pipeline_name == "WanPipeline":
    from diffusers import WanPipeline, AutoencoderKLWan, UniPCMultistepScheduler
    vae = AutoencoderKLWan.from_pretrained(
        model_id, subfolder="vae", torch_dtype=torch.bfloat16
    )
    pipe = WanPipeline.from_pretrained(
        model_id, vae=vae, torch_dtype=torch.bfloat16
    )
    # Flow-matching scheduler (critical for Wan2.1)
    flow_shift = 3.0  # 3.0 for 480p, 5.0 for 720p
    scheduler = UniPCMultistepScheduler.from_config(
        pipe.scheduler.config,
        prediction_type="flow_prediction",
        use_flow_sigmas=True,
        flow_shift=flow_shift,
    )
    pipe.scheduler = scheduler
    pipe.enable_model_cpu_offload()
    pipe.vae.enable_tiling()
```

**Critical:**
- `UniPCMultistepScheduler` with `prediction_type="flow_prediction"` is required
- `flow_shift=3.0` for 480p class resolutions; `5.0` for 720p
- `AutoencoderKLWan` must be loaded separately and passed as `vae` kwarg
- `torch.bfloat16` works correctly on RTX 5090 (no monochrome bug)

### 14.2 Resolution Mapping

```python
wan_map = {
    "16:9": (832, 480), "1:1": (480, 480),
    "9:16": (480, 832), "4:3": (640, 480), "3:4": (480, 640),
}
```

### 14.3 Generation Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| Steps | 30 | 25 for faster; 40 for best quality |
| CFG | 1.0 | Flow-matching — keep at 1.0 (CFG disabled) |
| Frames | 81 | ~5 seconds at 16fps |
| FPS | 16 | Hard-coded in export |

### 14.4 Performance

| Metric | Value |
|--------|-------|
| Load time | ~15s |
| Inference (30 steps, 832×480, 81 frames) | ~115s |
| Peak VRAM | ~10.85 GB |
| Output | MP4 H.264, ~435KB |

---

## 15. LTX-Video

### 15.1 Pipeline Loading

```python
elif pipeline_name == "LTXPipeline":
    from diffusers import LTXPipeline
    pipe = LTXPipeline.from_pretrained(model_id, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()
    pipe.vae.enable_tiling()
    pipe.vae.enable_slicing()
```

**Notes:**
- Simplest pipeline — single `from_pretrained()` call
- Both `enable_tiling()` and `enable_slicing()` are safe and recommended
- `torch.bfloat16` works correctly on RTX 5090

### 15.2 Resolution Mapping

```python
ltx_map = {
    "16:9": (768, 512), "1:1": (512, 512),
    "9:16": (512, 768), "4:3": (640, 512), "3:4": (512, 640),
}
```

### 15.3 Generation Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| Steps | 30 | 20 for faster drafts; 40 for slightly better quality |
| CFG | 3.0 | Lower (2.0) for more motion; raise (4.0) for stronger adherence |
| Frames | 65 | ~2.7 seconds at 24fps |
| FPS | 24 | Hard-coded in export |

### 15.4 Performance

| Metric | Value |
|--------|-------|
| Load time | ~8s |
| Inference (30 steps, 768×512, 65 frames) | ~17s |
| Peak VRAM | ~8.92 GB |
| Output | MP4 H.264, ~247KB |

---

## 12. Async Job Queue (Long-Running Inference)

### 12.1 Problem

Synchronous HTTP requests timeout at 60s (Nginx/Next.js default). Video generation takes ~40s, risking 504 Gateway Timeout.

### 12.2 Solution

Async job queue with polling:

```python
# POST /api/v1/async-generate
@app.post("/api/v1/async-generate")
async def async_generate(req: AsyncGenerateRequest):
    job_id = uuid.uuid4().hex
    async_jobs[job_id] = {"status": "pending", ...}
    asyncio.create_task(_run_job(job_id, req))
    return {"status": "processing", "job_id": job_id}

# GET /api/v1/jobs/{job_id}
@app.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
    # returns pending / processing / completed / failed
```

### 12.3 Frontend Polling

```javascript
// src/lib/muapi.js
async generateVideoAsync(params) {
    const submitRes = await fetch(`${baseUrl}/api/v1/async-generate`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });
    const { job_id } = await submitRes.json();
    
    for (let attempt = 0; attempt < 180; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`${baseUrl}/api/v1/jobs/${job_id}`);
        const data = await pollRes.json();
        if (params.onStatus) params.onStatus(data.status, attempt);
        if (data.status === 'completed') return data.result;
        if (data.status === 'failed') throw new Error(data.error);
    }
    throw new Error('Generation timed out after polling.');
}
```

| Parameter | Value |
|-----------|-------|
| Poll interval | 5 seconds |
| Max attempts | 180 |
| Max total wait | 15 minutes |

---

## 13. Affected Files

| File | Change | Task |
|------|--------|------|
| `local-server/server.py` | Major rewrite: Diffusers pipeline + lock + observability + video gen + async queue | 5.1, 5.3 |
| `local-server/models.json` | New: curated model registry (added Wan2.1, LTX, CogVideoX) | 5.2 |
| `local-server/requirements-mac.txt` | New: pinned Python deps | 5.2 |
| `src/lib/localModels.js` | Update: match curated registry IDs + RAM info (LTX, Wan2.1, CogVideoX) | 5.4 |
| `src/lib/muapi.js` | Add `generateVideoAsync()` with polling | 5.5 |
| `src/components/VideoStudio.js` | Use `generateVideoAsync()` for local diffusers | 5.5 |
| `app/api/v1/[[...path]]/route.js` | Set `maxDuration = 300` (bypassed by async, but safety net) | 5.6 |

---

*NQH Creative Studio (OGA) | TS-002 v1.1.0 | Approved 2026-05-06*
