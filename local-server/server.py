"""NQH Creative Studio — Local Image Generation Server.

Sprint 5: Diffusers in-process pipeline with MPS CPU offload.
Kill switch: INFERENCE_ENGINE=mflux falls back to mflux CLI subprocess.

Usage:
    cd ~/Documents/Research/Open-Generative-AI
    source .venv/bin/activate
    python local-server/server.py

API:
    POST /api/v1/{model}         — Muapi-compatible (frontend uses this)
    POST /v1/images/generations  — OpenAI-compatible
    GET  /v1/models              — List available models
    GET  /api/model-status       — Download + memory status
    GET  /health                 — Health check
"""

import asyncio
import base64
import io
import json
import logging
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("nqh-server")

app = FastAPI(title="NQH Creative Studio Server", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Config ───────────────────────────────────────────────────────────────────

INFERENCE_ENGINE = os.environ.get("INFERENCE_ENGINE", "diffusers")
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/tmp/nqh-output"))
OUTPUT_DIR.mkdir(exist_ok=True)

# Load model registry
_models_path = Path(__file__).parent / "models.json"
MODEL_REGISTRY = json.loads(_models_path.read_text()) if _models_path.exists() else []

# ─── State ────────────────────────────────────────────────────────────────────

pipe = None                  # Diffusers pipeline (loaded once)
current_model = None         # Currently loaded model config
_gen_lock = asyncio.Lock()   # One generation at a time (AC-2)
last_peak_ram = 0
last_gen_latency = 0.0


# ─── Request Models ──────────────────────────────────────────────────────────

class MuapiRequest(BaseModel):
    prompt: str
    aspect_ratio: str | None = None
    resolution: str | None = None
    image_url: str | None = None
    seed: int | None = None
    steps: int | None = None
    guidance_scale: float | None = None

class ImageRequest(BaseModel):
    prompt: str
    model: str = "z-image-turbo"
    n: int = 1
    size: str = "512x512"
    steps: int | None = None
    seed: int | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ar_to_size(ar: str | None) -> tuple[int, int]:
    mapping = {
        "1:1": (512, 512), "16:9": (1280, 720), "9:16": (720, 1280),
        "4:3": (1024, 768), "3:4": (768, 1024), "3:2": (1024, 682),
        "2:3": (682, 1024),
    }
    return mapping.get(ar or "1:1", (512, 512))

def parse_size(size: str) -> tuple[int, int]:
    parts = size.lower().split("x")
    return (int(parts[0]), int(parts[1])) if len(parts) == 2 else (512, 512)

def resolve_model_config(frontend_id: str) -> dict | None:
    for m in MODEL_REGISTRY:
        if frontend_id in m.get("frontend_ids", []):
            return m
    return MODEL_REGISTRY[0] if MODEL_REGISTRY else None

def get_mps_memory() -> int:
    """Return MPS allocated memory in MB. 0 if not available."""
    try:
        import torch
        if torch.backends.mps.is_available():
            return round(torch.mps.current_allocated_memory() / 1024 / 1024)
    except Exception:
        pass
    return 0

def image_to_base64(image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ─── Diffusers Engine ─────────────────────────────────────────────────────────

def load_diffusers_pipeline(model_config: dict):
    """Load Diffusers pipeline with MPS CPU offload. Called once at startup."""
    global pipe, current_model
    import torch

    pipeline_name = model_config["pipeline"]
    model_id = model_config["id"]
    backup_id = model_config.get("backup_id")

    log.info(f"Loading {pipeline_name} from {model_id} ...")

    # Import pipeline class from diffusers
    if pipeline_name == "ZImagePipeline":
        from diffusers import ZImagePipeline as PipeClass
    elif pipeline_name == "Flux2KleinPipeline":
        from diffusers import Flux2KleinPipeline as PipeClass
    else:
        raise ValueError(f"Unknown pipeline: {pipeline_name}")

    try:
        pipe = PipeClass.from_pretrained(model_id, torch_dtype=torch.bfloat16)
    except Exception as e:
        if backup_id:
            log.warning(f"Failed {model_id}, trying backup {backup_id}: {e}")
            pipe = PipeClass.from_pretrained(backup_id, torch_dtype=torch.bfloat16)
        else:
            raise

    # Memory optimizations (from ZPix app.py:203-207)
    pipe.vae.to(memory_format=torch.channels_last)
    if torch.backends.mps.is_available():
        pipe.enable_model_cpu_offload(device="mps")
        log.info("MPS CPU offload enabled — sequential component loading")
    else:
        pipe.enable_model_cpu_offload()
        log.info("CPU offload enabled (non-MPS)")

    current_model = model_config
    log.info(f"Pipeline ready: {model_config['name']}")


async def diffusers_generate(prompt: str, width: int, height: int,
                             steps: int | None = None, seed: int | None = None,
                             cfg: float | None = None, image=None) -> dict:
    """Generate image via Diffusers pipeline. Returns dict with base64 + meta."""
    global last_peak_ram, last_gen_latency
    import torch

    if pipe is None:
        raise HTTPException(503, "Pipeline not loaded yet")

    model_cfg = current_model or {}
    defaults = model_cfg.get("default", {})
    gen_steps = steps or defaults.get("steps", 8)
    gen_cfg = cfg if cfg is not None else defaults.get("cfg", 0.0)
    gen_seed = seed if (seed is not None and seed != -1) else int(time.time()) % 1000000

    pipe_kwargs = {
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_inference_steps": gen_steps,
        "guidance_scale": float(gen_cfg),
        "generator": torch.manual_seed(gen_seed),
    }

    # img2img support (Flux2 Klein 4B)
    if image is not None and "image-to-image" in model_cfg.get("features", []):
        from PIL import Image as PILImage
        if isinstance(image, str) and image.startswith("data:"):
            img_data = base64.b64decode(image.split(",", 1)[1])
            pipe_kwargs["image"] = [PILImage.open(io.BytesIO(img_data))]
        elif isinstance(image, (str, Path)):
            pipe_kwargs["image"] = [PILImage.open(image)]

    async with _gen_lock:
        start = time.time()
        mem_before = get_mps_memory()
        log.info(f"Generating: {prompt[:80]}... ({width}x{height}, steps={gen_steps})")

        # Run pipeline in thread pool to not block event loop
        result = await asyncio.to_thread(lambda: pipe(**pipe_kwargs).images[0])

        elapsed = time.time() - start
        mem_after = get_mps_memory()
        last_peak_ram = max(mem_before, mem_after)
        last_gen_latency = elapsed
        log.info(f"Done in {elapsed:.1f}s — RAM: {mem_before}→{mem_after}MB")

    b64 = image_to_base64(result)
    request_id = uuid.uuid4().hex

    return {
        "request_id": request_id,
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {
            "model": model_cfg.get("name", "unknown"),
            "size": f"{width}x{height}",
            "steps": gen_steps,
            "seed": gen_seed,
            "elapsed_seconds": round(elapsed, 1),
            "peak_ram_mb": last_peak_ram,
            "engine": "diffusers",
        },
    }


# ─── mflux Fallback Engine (kill switch) ──────────────────────────────────────

async def mflux_generate(prompt: str, width: int, height: int,
                         steps: int | None = None, seed: int | None = None,
                         **kwargs) -> dict:
    """Legacy mflux subprocess path. Used when INFERENCE_ENGINE=mflux."""
    mflux_model = os.environ.get("MFLUX_MODEL", "schnell")
    mflux_quantize = os.environ.get("MFLUX_QUANTIZE", "4")
    mflux_steps = steps or int(os.environ.get("MFLUX_STEPS", "4"))

    output_path = OUTPUT_DIR / f"{uuid.uuid4().hex}.png"
    cmd = [
        "mflux-generate", "--model", mflux_model, "--prompt", prompt,
        "--steps", str(mflux_steps), "--width", str(width), "--height", str(height),
        "--quantize", mflux_quantize, "--output", str(output_path),
    ]
    if seed is not None and seed != -1:
        cmd.extend(["--seed", str(seed)])

    start = time.time()
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise HTTPException(500, f"mflux failed: {stderr.decode()[-500:]}")
    if not output_path.exists():
        raise HTTPException(500, "mflux produced no output")

    img_bytes = output_path.read_bytes()
    output_path.unlink(missing_ok=True)
    elapsed = time.time() - start
    b64 = base64.b64encode(img_bytes).decode()

    return {
        "request_id": uuid.uuid4().hex,
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {"model": mflux_model, "size": f"{width}x{height}",
                  "elapsed_seconds": round(elapsed, 1), "engine": "mflux"},
    }


# ─── Unified generate() ──────────────────────────────────────────────────────

async def generate(prompt, width, height, steps=None, seed=None, cfg=None, image=None):
    if INFERENCE_ENGINE == "mflux":
        return await mflux_generate(prompt, width, height, steps, seed)
    return await diffusers_generate(prompt, width, height, steps, seed, cfg, image)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine": INFERENCE_ENGINE,
        "model": current_model["name"] if current_model else "none",
        "peak_ram_mb": last_peak_ram,
        "last_gen_latency_s": round(last_gen_latency, 1),
    }

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": m["frontend_ids"][0], "name": m["name"], "ram_gb": m["ram_gb"],
             "features": m["features"], "default": m["default"]}
            for m in MODEL_REGISTRY
        ],
    }

@app.get("/api/model-status")
async def model_status():
    return {
        "loaded_model": current_model["name"] if current_model else None,
        "engine": INFERENCE_ENGINE,
        "available_models": [m["name"] for m in MODEL_REGISTRY],
        "peak_ram_mb": last_peak_ram,
        "last_gen_latency_s": round(last_gen_latency, 1),
    }

@app.post("/api/v1/{model_endpoint:path}")
async def muapi_generate(model_endpoint: str, req: MuapiRequest):
    width, height = ar_to_size(req.aspect_ratio)
    return await generate(req.prompt, width, height,
                          steps=req.steps, seed=req.seed,
                          cfg=req.guidance_scale, image=req.image_url)

@app.post("/v1/images/generations")
async def openai_generate(req: ImageRequest):
    width, height = parse_size(req.size)
    return await generate(req.prompt, width, height, steps=req.steps, seed=req.seed)

@app.get("/api/v1/account/balance")
async def account_balance():
    return {"balance": 999999.0, "currency": "LOCAL", "plan": "self-hosted"}

@app.get("/api/v1/predictions/{request_id}/result")
async def poll_result(request_id: str):
    result_path = OUTPUT_DIR / f"{request_id}.png"
    if result_path.exists():
        b64 = base64.b64encode(result_path.read_bytes()).decode()
        return {"status": "completed", "outputs": [f"data:image/png;base64,{b64}"]}
    return {"status": "processing"}


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))

    print(f"\n🎨 NQH Creative Studio Server v2.0")
    print(f"   Engine: {INFERENCE_ENGINE}")
    print(f"   Models: {[m['name'] for m in MODEL_REGISTRY]}")
    print(f"   Port: {port}")

    if INFERENCE_ENGINE == "diffusers" and MODEL_REGISTRY:
        print(f"   Loading default model: {MODEL_REGISTRY[0]['name']}...")
        load_diffusers_pipeline(MODEL_REGISTRY[0])
        print(f"   ✅ Pipeline ready")
    elif INFERENCE_ENGINE == "mflux":
        print(f"   Using mflux subprocess (legacy fallback)")
    else:
        print(f"   ⚠️ No models configured")

    print(f"   API: POST /api/v1/{{model}}")
    print(f"   Health: GET /health")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)
