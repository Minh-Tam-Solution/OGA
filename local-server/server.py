"""NQH Creative Studio — Local Generation Server v3.0 (Sprint 6).

Hot-swap state machine + RMBG utility + Diffusers MPS CPU offload.
Kill switch: INFERENCE_ENGINE=mflux falls back to mflux CLI subprocess.

API:
    POST /api/v1/{model}         — Muapi-compatible (frontend)
    POST /v1/images/generations  — OpenAI-compatible (AI-Platform)
    POST /api/v1/swap-model      — Hot-swap pipeline (diffusers/custom only)
    POST /api/v1/remove-bg       — Background removal (RMBG utility)
    GET  /v1/models              — List available models
    GET  /api/model-status       — Pipeline state + memory
    GET  /health                 — Liveness probe
"""

import asyncio
import base64
import gc
import io
import json
import logging
import os
import time
import uuid
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("nqh-server")

app = FastAPI(title="NQH Creative Studio Server", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Config ───────────────────────────────────────────────────────────────────

INFERENCE_ENGINE = os.environ.get("INFERENCE_ENGINE", "diffusers")
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/tmp/nqh-output"))
OUTPUT_DIR.mkdir(exist_ok=True)
MEMORY_BASELINE_TOLERANCE_MB = 300  # CPO gate: peak_ram <= baseline + 300MB

_models_path = Path(__file__).parent / "models.json"
MODEL_REGISTRY = json.loads(_models_path.read_text()) if _models_path.exists() else []


# ─── State Machine (ADR-003) ─────────────────────────────────────────────────

class PipelineState(str, Enum):
    IDLE = "idle"
    LOADING = "loading"
    READY = "ready"
    GENERATING = "generating"

pipe = None
current_model = None
pipeline_state = PipelineState.IDLE
memory_baseline_mb = 0  # MPS memory before any pipeline loaded

# Dual locks (TS-003): no swap during gen, no gen during swap
_gen_lock = asyncio.Lock()
_swap_lock = asyncio.Lock()

# RMBG serialisation (TS-004): one CPU-bound operation at a time
_rembg_lock = asyncio.Lock()

# RMBG session (always-resident utility)
_rembg_session = None

# Observability
last_peak_ram = 0
last_gen_latency = 0.0


# ─── Request/Response Models ─────────────────────────────────────────────────

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

class SwapRequest(BaseModel):
    model: str  # frontend_id from models.json

class RemoveBgRequest(BaseModel):
    image: str  # base64 data URL


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


def resolve_model_config_strict(frontend_id: str) -> dict | None:
    """Strict lookup: no fallback to default model. Used by swap endpoint."""
    for m in MODEL_REGISTRY:
        if frontend_id in m.get("frontend_ids", []):
            return m
    return None

def get_mps_memory() -> int:
    """Return MPS allocated memory in MB."""
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


def is_ram_over_cap() -> bool:
    """Check if system RAM usage exceeds 85% cap."""
    try:
        import psutil
        return psutil.virtual_memory().percent > 85.0
    except ImportError:
        return False


def get_process_rss_mb() -> int:
    """Get current process RSS in MB."""
    try:
        import psutil
        return round(psutil.Process().memory_info().rss / 1024 / 1024)
    except ImportError:
        return 0


def init_rembg():
    """Initialize rembg u2net session. Called once at startup."""
    global _rembg_session
    try:
        from rembg import new_session
        log.info("Loading RMBG (u2net) utility model...")
        _rembg_session = new_session("u2net")
        log.info("RMBG ready (~1-2GB resident)")
    except Exception as e:
        log.warning(f"RMBG initialization failed (rembg not installed?): {e}")
        _rembg_session = None


# ─── Pipeline Lifecycle (ADR-003 + TS-003) ────────────────────────────────────

def unload_pipeline():
    """Unload current Diffusers pipeline, release MPS memory.
    Gate: peak_ram_mb <= baseline_mb + MEMORY_BASELINE_TOLERANCE_MB within 5s.
    """
    global pipe, current_model, pipeline_state
    import torch

    if pipe is None:
        pipeline_state = PipelineState.IDLE
        return

    model_name = current_model["name"] if current_model else "unknown"
    mem_before = get_mps_memory()
    log.info(f"Unloading pipeline: {model_name} (RAM before: {mem_before}MB)")

    del pipe
    pipe = None
    current_model = None
    gc.collect()

    if torch.backends.mps.is_available():
        torch.mps.empty_cache()

    mem_after = get_mps_memory()
    pipeline_state = PipelineState.IDLE
    log.info(f"Pipeline unloaded: {model_name} (RAM: {mem_before}→{mem_after}MB, "
             f"baseline={memory_baseline_mb}MB, tolerance={MEMORY_BASELINE_TOLERANCE_MB}MB)")

    if mem_after > memory_baseline_mb + MEMORY_BASELINE_TOLERANCE_MB:
        log.warning(f"Memory not fully released: {mem_after}MB > baseline+tolerance "
                    f"({memory_baseline_mb + MEMORY_BASELINE_TOLERANCE_MB}MB)")


def load_pipeline(model_config: dict):
    """Load a Diffusers pipeline with MPS CPU offload."""
    global pipe, current_model, pipeline_state
    import torch

    pipeline_state = PipelineState.LOADING

    # Register SDNQ quantizer
    try:
        import sdnq  # noqa: F401
        log.info("SDNQ quantizer registered")
    except ImportError:
        log.warning("sdnq not installed — SDNQ-quantized models will fail")

    pipeline_name = model_config["pipeline"]
    model_id = model_config["id"]
    backup_id = model_config.get("backup_id")

    log.info(f"Loading {pipeline_name} from {model_id} ...")

    if pipeline_name == "ZImagePipeline":
        from diffusers import ZImagePipeline as PipeClass
    elif pipeline_name == "Flux2KleinPipeline":
        from diffusers import Flux2KleinPipeline as PipeClass
    else:
        pipeline_state = PipelineState.IDLE
        raise ValueError(f"Unknown pipeline: {pipeline_name}")

    try:
        pipe = PipeClass.from_pretrained(model_id, torch_dtype=torch.bfloat16)
    except Exception as e:
        if backup_id:
            log.warning(f"Failed {model_id}, trying backup {backup_id}: {e}")
            pipe = PipeClass.from_pretrained(backup_id, torch_dtype=torch.bfloat16)
        else:
            pipeline_state = PipelineState.IDLE
            raise

    pipe.vae.to(memory_format=torch.channels_last)
    if torch.backends.mps.is_available():
        pipe.enable_model_cpu_offload(device="mps")
        log.info("MPS CPU offload enabled")
    else:
        pipe.enable_model_cpu_offload()

    current_model = model_config
    pipeline_state = PipelineState.READY
    log.info(f"Pipeline ready: {model_config['name']} (RAM: {get_mps_memory()}MB)")


def swap_pipeline(model_config: dict):
    """Unload current pipeline, load new one. Full swap cycle."""
    unload_pipeline()
    load_pipeline(model_config)


# ─── Generation ───────────────────────────────────────────────────────────────

async def diffusers_generate(prompt: str, width: int, height: int,
                             steps: int | None = None, seed: int | None = None,
                             cfg: float | None = None, image=None) -> dict:
    global last_peak_ram, last_gen_latency, pipeline_state
    import torch

    model_cfg = current_model or {}
    defaults = model_cfg.get("default", {})
    gen_steps = steps or defaults.get("steps", 8)
    gen_cfg = cfg if cfg is not None else defaults.get("cfg", 0.0)
    gen_seed = seed if (seed is not None and seed != -1) else int(time.time()) % 1000000

    pipe_kwargs = {
        "prompt": prompt, "height": height, "width": width,
        "num_inference_steps": gen_steps, "guidance_scale": float(gen_cfg),
        "generator": torch.manual_seed(gen_seed),
    }

    if image is not None and "image-to-image" in model_cfg.get("features", []):
        from PIL import Image as PILImage
        if isinstance(image, str) and image.startswith("data:"):
            img_data = base64.b64decode(image.split(",", 1)[1])
            pipe_kwargs["image"] = [PILImage.open(io.BytesIO(img_data))]
        elif isinstance(image, (str, Path)):
            pipe_kwargs["image"] = [PILImage.open(image)]

    async with _gen_lock:
        # Race-safe checks: state can only change while we hold _gen_lock or _swap_lock
        if _swap_lock.locked():
            raise HTTPException(503, "Pipeline swap in progress, try again shortly")
        if pipeline_state == PipelineState.LOADING:
            raise HTTPException(503, "Pipeline loading, please wait")
        if pipeline_state != PipelineState.READY:
            raise HTTPException(503, f"Pipeline not ready (state: {pipeline_state})")
        if pipe is None:
            raise HTTPException(503, "No pipeline loaded")

        pipeline_state = PipelineState.GENERATING
        start = time.time()
        mem_before = get_mps_memory()
        log.info(f"Generating: {prompt[:80]}... ({width}x{height}, steps={gen_steps})")

        try:
            result = await asyncio.to_thread(lambda: pipe(**pipe_kwargs).images[0])
        finally:
            pipeline_state = PipelineState.READY

        elapsed = time.time() - start
        mem_after = get_mps_memory()
        last_peak_ram = max(mem_before, mem_after)
        last_gen_latency = elapsed
        log.info(f"Done in {elapsed:.1f}s — RAM: {mem_before}→{mem_after}MB")

    b64 = image_to_base64(result)
    return {
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {
            "model": model_cfg.get("name", "unknown"),
            "size": f"{width}x{height}", "steps": gen_steps, "seed": gen_seed,
            "elapsed_seconds": round(elapsed, 1), "peak_ram_mb": last_peak_ram,
            "engine": "diffusers",
        },
    }


# ─── mflux Fallback (kill switch) ────────────────────────────────────────────

async def mflux_generate(prompt, width, height, steps=None, seed=None, **kw) -> dict:
    mflux_model = os.environ.get("MFLUX_MODEL", "schnell")
    mflux_quantize = os.environ.get("MFLUX_QUANTIZE", "4")
    mflux_steps = steps or int(os.environ.get("MFLUX_STEPS", "4"))

    output_path = OUTPUT_DIR / f"{uuid.uuid4().hex}.png"
    cmd = ["mflux-generate", "--model", mflux_model, "--prompt", prompt,
           "--steps", str(mflux_steps), "--width", str(width), "--height", str(height),
           "--quantize", mflux_quantize, "--output", str(output_path)]
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
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {"model": mflux_model, "size": f"{width}x{height}",
                  "elapsed_seconds": round(elapsed, 1), "engine": "mflux"},
    }


async def generate(prompt, width, height, steps=None, seed=None, cfg=None, image=None):
    if INFERENCE_ENGINE == "mflux":
        return await mflux_generate(prompt, width, height, steps, seed)
    return await diffusers_generate(prompt, width, height, steps, seed, cfg, image)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok", "engine": INFERENCE_ENGINE,
        "pipeline_state": pipeline_state.value,
        "model": current_model["name"] if current_model else "none",
        "peak_ram_mb": last_peak_ram,
        "memory_baseline_mb": memory_baseline_mb,
        "mps_current_mb": get_mps_memory(),
        "last_gen_latency_s": round(last_gen_latency, 1),
        "utilities": {
            "rembg": _rembg_session is not None,
        },
        "process_rss_mb": get_process_rss_mb(),
    }

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": m["frontend_ids"][0], "name": m["name"], "ram_gb": m["ram_gb"],
             "features": m["features"], "default": m["default"],
             "model_type": m.get("model_type", "diffusers"),
             "loaded": current_model and current_model.get("id") == m.get("id")}
            for m in MODEL_REGISTRY
        ],
    }

@app.get("/api/model-status")
async def model_status():
    return {
        "pipeline_state": pipeline_state.value,
        "loaded_model": current_model["name"] if current_model else None,
        "engine": INFERENCE_ENGINE,
        "available_models": [{"name": m["name"], "model_type": m.get("model_type", "diffusers")}
                             for m in MODEL_REGISTRY],
        "peak_ram_mb": last_peak_ram,
        "mps_current_mb": get_mps_memory(),
        "memory_baseline_mb": memory_baseline_mb,
    }

@app.post("/api/v1/swap-model")
async def swap_model_endpoint(req: SwapRequest):
    """Hot-swap pipeline. Only for diffusers/custom model_type (TS-003)."""
    if INFERENCE_ENGINE != "diffusers":
        raise HTTPException(400, "Hot-swap only available in diffusers engine mode")

    model_config = resolve_model_config_strict(req.model)
    if not model_config:
        raise HTTPException(400, f"Unknown model: {req.model}")

    model_type = model_config.get("model_type", "diffusers")
    if model_type not in ("diffusers", "custom"):
        raise HTTPException(400, f"Cannot swap model_type={model_type}. Only diffusers/custom supported.")

    # Check if already loaded
    if current_model and current_model.get("id") == model_config.get("id"):
        raise HTTPException(400, {"error": "Model already loaded", "model": model_config["name"]})

    async with _swap_lock:
        if _gen_lock.locked():
            raise HTTPException(409, "Cannot swap while generating. Try again after current generation completes.")
        if pipeline_state == PipelineState.GENERATING:
            raise HTTPException(409, "Cannot swap while generating. Try again after current generation completes.")
        if pipeline_state == PipelineState.LOADING:
            raise HTTPException(503, "Another swap already in progress")

        if is_ram_over_cap():
            raise HTTPException(503, {"error": "Server RAM over 85% cap, swap blocked"}, headers={"Retry-After": "30"})

        previous_name = current_model["name"] if current_model else None
        mem_before = get_mps_memory()
        start = time.time()
        await asyncio.to_thread(swap_pipeline, model_config)
        elapsed = time.time() - start
        mem_after = get_mps_memory()
        ram_delta = mem_after - mem_before

    return {
        "status": "swapped",
        "previous_model": previous_name,
        "current_model": model_config["name"],
        "swap_time_seconds": round(elapsed, 1),
        "ram_after_mb": mem_after,
        "ram_delta_mb": ram_delta,
    }

@app.post("/api/v1/remove-bg")
async def remove_bg(req: RemoveBgRequest):
    """Background removal utility (TS-004). Always-resident, no pipeline swap."""
    if not req.image or not req.image.startswith("data:image"):
        raise HTTPException(400, {"error": "Invalid image data"})

    try:
        header, b64data = req.image.split(",", 1)
        img_bytes = base64.b64decode(b64data)
        if not img_bytes:
            raise ValueError("Empty image after base64 decode")
    except Exception:
        raise HTTPException(400, {"error": "Invalid base64 encoding"})

    size_mb = len(img_bytes) / (1024 * 1024)
    if size_mb > 10:
        raise HTTPException(413, {"error": "Image too large (max 10MB)", "size_mb": round(size_mb, 1)})

    if is_ram_over_cap():
        raise HTTPException(503, {"error": "Server overloaded, try again later"}, headers={"Retry-After": "10"})

    if _rembg_session is None:
        raise HTTPException(503, {"error": "RMBG utility not available"})

    async with _rembg_lock:
        start = time.time()
        try:
            from rembg import remove
            result_bytes = await asyncio.to_thread(remove, img_bytes, session=_rembg_session)
        except Exception as e:
            log.error(f"RMBG failed: {e}")
            raise HTTPException(500, {"error": f"Background removal failed: {str(e)}"})

    elapsed = time.time() - start

    from PIL import Image as PILImage
    img = PILImage.open(io.BytesIO(img_bytes))
    input_size = f"{img.width}x{img.height}"
    output_b64 = base64.b64encode(result_bytes).decode()

    return {
        "status": "completed",
        "output": f"data:image/png;base64,{output_b64}",
        "_meta": {
            "model": "RMBG (u2net)",
            "input_size": input_size,
            "output_format": "PNG (RGBA)",
            "elapsed_seconds": round(elapsed, 1),
            "ram_mb": get_process_rss_mb(),
        },
    }

@app.post("/api/v1/{model_endpoint:path}")
async def muapi_generate(model_endpoint: str, req: MuapiRequest):
    # Skip non-generation endpoints
    if model_endpoint in ("swap-model", "remove-bg", "account/balance"):
        raise HTTPException(404, "Use dedicated endpoint")
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

    print(f"\n🎨 NQH Creative Studio Server v3.0 (Sprint 6)")
    print(f"   Engine: {INFERENCE_ENGINE}")
    print(f"   Models: {[m['name'] for m in MODEL_REGISTRY]}")
    print(f"   Port: {port}")

    # Record memory baseline before loading any pipeline
    memory_baseline_mb = get_mps_memory()
    print(f"   Memory baseline: {memory_baseline_mb}MB")

    # Always load utility models (regardless of INFERENCE_ENGINE)
    init_rembg()

    if INFERENCE_ENGINE == "diffusers" and MODEL_REGISTRY:
        default_model = MODEL_REGISTRY[0]
        print(f"   Loading default model: {default_model['name']}...")
        load_pipeline(default_model)
        print(f"   ✅ Pipeline ready (RAM: {get_mps_memory()}MB)")
    elif INFERENCE_ENGINE == "mflux":
        print(f"   Using mflux subprocess (legacy fallback)")

    print(f"   Hot-swap: POST /api/v1/swap-model")
    print(f"   Health: GET /health")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)
