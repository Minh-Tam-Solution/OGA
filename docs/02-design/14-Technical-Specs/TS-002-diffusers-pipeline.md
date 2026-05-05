---
ts_id: TS-002
title: "Diffusers Pipeline Integration"
ts_version: "1.0.0"
status: Approved
stage: "02-design"
owner: "@architect"
created: 2026-04-29
references:
  - ADR-002 (docs/02-design/01-ADRs/ADR-002-diffusers-engine.md)
  - ZPix reference (app.py lines 158-209, 312-428)
gate: G2
---

# TS-002: Diffusers Pipeline Integration

## 1. Overview

Replace `generate_image()` in `local-server/server.py` — from mflux subprocess to
Diffusers in-process pipeline with MPS CPU offload.

Reference implementation: ZPix `app.py` (tested on M4 Pro 24GB by CEO).

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

    pipe = PipeClass.from_pretrained(
        model_config["id"],
        torch_dtype=torch.bfloat16,
    )

    # Memory optimization
    pipe.vae.to(memory_format=torch.channels_last)

    # MPS CPU offload — the key to avoiding OOM
    if torch.backends.mps.is_available():
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
def get_mps_memory():
    """Return MPS allocated memory in MB."""
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

---

*NQH Creative Studio (OGA) | TS-002 v1.0.0 | Approved 2026-04-29*
