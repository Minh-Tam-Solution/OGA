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

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Suppress torch.compile/dynamo hard failures with SDNQ-quantized models
# on torch nightly. See https://pytorch.org/docs/stable/torch.compiler_faq.html
try:
    import torch._dynamo
    torch._dynamo.config.suppress_errors = True
    log = logging.getLogger("nqh-server")
    log.info("torch._dynamo suppress_errors enabled")
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("nqh-server")

app = FastAPI(title="NQH Creative Studio Server", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Config ───────────────────────────────────────────────────────────────────

INFERENCE_ENGINE = os.environ.get("INFERENCE_ENGINE", "diffusers")
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/tmp/nqh-output"))
OUTPUT_DIR.mkdir(exist_ok=True)
MEMORY_BASELINE_TOLERANCE_MB = 300  # CPO gate: peak_ram <= baseline + 300MB

# CPU fallback flag (Luồng A — unblock CI/Gate on RTX 5090 Blackwell)
FORCE_CPU = os.environ.get("OGA_FORCE_CPU", "").lower() in ("1", "true", "yes")

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

# ─── Async Job State ──────────────────────────────────────────────────────────
async_jobs: dict[str, dict] = {}
# Locks for job dict to prevent race on concurrent updates
_jobs_lock = asyncio.Lock()


# ─── Request/Response Models ─────────────────────────────────────────────────

class MuapiRequest(BaseModel):
    prompt: str
    aspect_ratio: str | None = None
    resolution: str | None = None
    image_url: str | None = None
    seed: int | None = None
    steps: int | None = None
    guidance_scale: float | None = None

class AsyncGenerateRequest(BaseModel):
    model: str
    prompt: str
    aspect_ratio: str | None = None
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

class ProductPlacementRequest(BaseModel):
    product_image: str  # base64 data URL
    scene_prompt: str
    steps: int | None = None
    strength: float | None = None
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


def resolve_model_config_strict(frontend_id: str) -> dict | None:
    """Strict lookup: no fallback to default model. Used by swap endpoint."""
    for m in MODEL_REGISTRY:
        if frontend_id in m.get("frontend_ids", []):
            return m
    return None

def get_runtime_device() -> str:
    """Resolve preferred runtime device for inference."""
    if FORCE_CPU:
        return "cpu"
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"

def get_mps_memory() -> int:
    """Return active accelerator memory in MB (CUDA/MPS)."""
    if FORCE_CPU:
        return 0
    try:
        import torch
        if torch.cuda.is_available():
            return round(torch.cuda.memory_allocated() / 1024 / 1024)
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
    """Unload current Diffusers pipeline, release GPU/MPS memory synchronously."""
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

    if torch.cuda.is_available():
        torch.cuda.synchronize()
        torch.cuda.empty_cache()
    elif torch.backends.mps.is_available():
        torch.mps.empty_cache()

    mem_after = get_mps_memory()
    pipeline_state = PipelineState.IDLE
    log.info(f"Pipeline unloaded: {model_name} (RAM: {mem_before}→{mem_after}MB)")

    if mem_after > memory_baseline_mb + MEMORY_BASELINE_TOLERANCE_MB:
        log.warning(f"Memory not fully released: {mem_after}MB > baseline+tolerance "
                    f"({memory_baseline_mb + MEMORY_BASELINE_TOLERANCE_MB}MB)")


def load_pipeline(model_config: dict):
    """Load a Diffusers pipeline with MPS CPU offload."""
    global pipe, current_model, pipeline_state
    import torch

    pipeline_state = PipelineState.LOADING
    runtime_device = get_runtime_device()

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
    elif pipeline_name == "StableDiffusionPipeline":
        from diffusers import StableDiffusionPipeline as PipeClass
    elif pipeline_name == "StableDiffusionXLPipeline":
        from diffusers import StableDiffusionXLPipeline as PipeClass
    elif pipeline_name == "AnimateDiffPipeline":
        from diffusers import AnimateDiffPipeline, MotionAdapter, DDIMScheduler
        adapter_id = model_config.get("motion_adapter", model_id)
        base_id = model_config.get("base_model", "runwayml/stable-diffusion-v1-5")
        log.info(f"Loading MotionAdapter: {adapter_id} ...")
        adapter = MotionAdapter.from_pretrained(adapter_id, torch_dtype=torch.bfloat16)
        log.info(f"Loading AnimateDiff base: {base_id} ...")
        pipe = AnimateDiffPipeline.from_pretrained(
            base_id, motion_adapter=adapter, torch_dtype=torch.bfloat16
        )
        # AnimateDiff requires beta_schedule="linear" for proper motion generation
        pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config, beta_schedule="linear")
        # VAE slicing keeps decode memory bounded for multi-frame video
        pipe.vae.enable_slicing()
        if runtime_device == "mps":
            pipe.enable_model_cpu_offload(device="mps")
            log.info("MPS CPU offload enabled for AnimateDiff")
        elif runtime_device == "cuda":
            pipe.enable_model_cpu_offload()
            log.info("CUDA model CPU offload enabled for AnimateDiff")
        else:
            pipe.enable_model_cpu_offload()
        current_model = model_config
        pipeline_state = PipelineState.READY
        log.info(f"Pipeline ready: {model_config['name']} (RAM: {get_mps_memory()}MB)")
        return
    elif pipeline_name == "CogVideoXPipeline":
        from diffusers import CogVideoXPipeline
        log.info(f"Loading CogVideoX from {model_id} ...")
        pipe = CogVideoXPipeline.from_pretrained(
            model_id, torch_dtype=torch.float16
        )
        # NOTE: enable_tiling() with bfloat16 caused monochrome output on RTX 5090.
        # float16 + cpu_offload works correctly. Do NOT re-enable tiling without testing.
        # pipe.vae.enable_tiling()
        if runtime_device == "mps":
            pipe.enable_model_cpu_offload(device="mps")
            log.info("MPS CPU offload enabled for CogVideoX")
        elif runtime_device == "cuda":
            pipe.enable_model_cpu_offload()
            log.info("CUDA model CPU offload enabled for CogVideoX")
        else:
            pipe.enable_model_cpu_offload()
        current_model = model_config
        pipeline_state = PipelineState.READY
        log.info(f"Pipeline ready: {model_config['name']} (RAM: {get_mps_memory()}MB)")
        return
    elif pipeline_name == "WanPipeline":
        from diffusers import AutoencoderKLWan, WanPipeline
        from diffusers.schedulers.scheduling_unipc_multistep import UniPCMultistepScheduler
        log.info(f"Loading Wan2.1 from {model_id} ...")
        vae = AutoencoderKLWan.from_pretrained(model_id, subfolder="vae", torch_dtype=torch.float32)
        # flow_shift=3.0 for 480P, 5.0 for 720P — read from model defaults for future 14B/720P support
        flow_shift = model_config.get("default", {}).get("flow_shift", 3.0)
        scheduler = UniPCMultistepScheduler(
            prediction_type="flow_prediction",
            use_flow_sigmas=True,
            num_train_timesteps=1000,
            flow_shift=flow_shift,
        )
        pipe = WanPipeline.from_pretrained(
            model_id, vae=vae, torch_dtype=torch.bfloat16
        )
        pipe.scheduler = scheduler
        if runtime_device == "mps":
            pipe.enable_model_cpu_offload(device="mps")
            log.info("MPS CPU offload enabled for Wan2.1")
        elif runtime_device == "cuda":
            pipe.enable_model_cpu_offload()
            log.info("CUDA model CPU offload enabled for Wan2.1")
        else:
            pipe.enable_model_cpu_offload()
        current_model = model_config
        pipeline_state = PipelineState.READY
        log.info(f"Pipeline ready: {model_config['name']} (RAM: {get_mps_memory()}MB)")
        return
    elif pipeline_name == "LTXPipeline":
        from diffusers import LTXPipeline
        log.info(f"Loading LTX-Video from {model_id} ...")
        pipe = LTXPipeline.from_pretrained(
            model_id, torch_dtype=torch.bfloat16
        )
        pipe.vae.enable_tiling()
        if runtime_device == "mps":
            pipe.enable_model_cpu_offload(device="mps")
            log.info("MPS CPU offload enabled for LTX")
        elif runtime_device == "cuda":
            pipe.enable_model_cpu_offload()
            log.info("CUDA model CPU offload enabled for LTX")
        else:
            pipe.enable_model_cpu_offload()
        current_model = model_config
        pipeline_state = PipelineState.READY
        log.info(f"Pipeline ready: {model_config['name']} (RAM: {get_mps_memory()}MB)")
        return
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
    if runtime_device == "mps":
        pipe.enable_model_cpu_offload(device="mps")
        log.info("MPS CPU offload enabled")
    elif runtime_device == "cuda":
        pipe = pipe.to("cuda")
        log.info("CUDA execution enabled")
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
                             cfg: float | None = None, image=None,
                             num_frames: int | None = None,
                             request_id: str | None = None) -> dict:
    global last_peak_ram, last_gen_latency, pipeline_state
    import torch

    model_cfg = current_model or {}
    defaults = model_cfg.get("default", {})
    gen_steps = steps or defaults.get("steps", 8)
    gen_cfg = cfg if cfg is not None else defaults.get("cfg", 0.0)
    gen_seed = seed if (seed is not None and seed != -1) else int(time.time()) % 1000000

    # Detect video model
    is_video = "text-to-video" in model_cfg.get("features", [])

    # Video model resolution clamps
    model_name = model_cfg.get("name", "")
    if "CogVideoX" in model_name:
        cog_map = {
            (1280, 720): (720, 480),
            (720, 1280): (480, 720),
            (512, 512): (480, 480),
            (1024, 768): (640, 480),
            (768, 1024): (480, 640),
        }
        new_wh = cog_map.get((width, height))
        if new_wh:
            width, height = new_wh
            log.info(f"CogVideoX resolution clamped to {width}x{height}")
    elif "Wan2.1" in model_name:
        # Wan2.1 1.3B: 480P sweet spot, divisible by 16
        wan_map = {
            (1280, 720): (832, 480),
            (720, 1280): (480, 832),
            (512, 512): (480, 480),
            (1024, 768): (640, 480),
            (768, 1024): (480, 640),
        }
        new_wh = wan_map.get((width, height))
        if new_wh:
            width, height = new_wh
            log.info(f"Wan2.1 resolution mapped to {width}x{height}")
    elif "LTX" in model_name:
        # LTX: divisible by 32, frames divisible by 8+1
        ltx_map = {
            (1280, 720): (768, 512),
            (720, 1280): (512, 768),
            (512, 512): (512, 512),
            (1024, 768): (640, 480),
            (768, 1024): (480, 640),
        }
        new_wh = ltx_map.get((width, height))
        if new_wh:
            width, height = new_wh
            log.info(f"LTX resolution mapped to {width}x{height}")

    pipe_kwargs = {
        "prompt": prompt, "height": height, "width": width,
        "num_inference_steps": gen_steps, "guidance_scale": float(gen_cfg),
        "generator": torch.manual_seed(gen_seed),
    }

    if is_video:
        pipe_kwargs["num_frames"] = num_frames or defaults.get("num_frames", 16)
        # AnimateDiff VAE decode of 16 frames at once can OOM on 32GB VRAM.
        # Chunk decode to 2 frames at a time to keep memory bounded.
        if "AnimateDiff" in model_cfg.get("pipeline", ""):
            pipe_kwargs["decode_chunk_size"] = 2

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
        log.info(f"Generating: {prompt[:80]}... ({width}x{height}, steps={gen_steps}, video={is_video})")

        try:
            result = await asyncio.to_thread(lambda: pipe(**pipe_kwargs))
        finally:
            pipeline_state = PipelineState.READY

        elapsed = time.time() - start
        mem_after = get_mps_memory()
        last_peak_ram = max(mem_before, mem_after)
        last_gen_latency = elapsed
        log.info(f"Done in {elapsed:.1f}s — RAM: {mem_before}→{mem_after}MB")

    _schedule_idle_unload()

    if is_video:
        from diffusers.utils import export_to_video
        frames = result.frames[0]
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            mp4_path = f.name
        fps = defaults.get("fps", 8)
        export_to_video(frames, mp4_path, fps=fps)
        mp4_bytes = Path(mp4_path).read_bytes()
        Path(mp4_path).unlink(missing_ok=True)
        b64 = base64.b64encode(mp4_bytes).decode()
        result_dict = {
            "status": "completed",
            "outputs": [f"data:video/mp4;base64,{b64}"],
            "_meta": {
                "model": model_cfg.get("name", "unknown"),
                "size": f"{width}x{height}", "steps": gen_steps, "seed": gen_seed,
                "elapsed_seconds": round(elapsed, 1), "peak_ram_mb": last_peak_ram,
                "engine": "diffusers", "format": "mp4", "frames": len(frames), "fps": fps,
            },
        }
        if request_id:
            out_path = OUTPUT_DIR / f"{request_id}.mp4"
            out_path.write_bytes(mp4_bytes)
            result_dict["_meta"]["file_path"] = str(out_path)
        return result_dict

    result_image = result.images[0]
    b64 = image_to_base64(result_image)
    result_dict = {
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {
            "model": model_cfg.get("name", "unknown"),
            "size": f"{width}x{height}", "steps": gen_steps, "seed": gen_seed,
            "elapsed_seconds": round(elapsed, 1), "peak_ram_mb": last_peak_ram,
            "engine": "diffusers",
        },
    }
    if request_id:
        out_path = OUTPUT_DIR / f"{request_id}.png"
        result_image.save(out_path, format="PNG")
        result_dict["_meta"]["file_path"] = str(out_path)
    return result_dict


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


async def generate(prompt, width, height, steps=None, seed=None, cfg=None, image=None, request_id=None):
    if INFERENCE_ENGINE == "mflux":
        return await mflux_generate(prompt, width, height, steps, seed)
    return await diffusers_generate(prompt, width, height, steps, seed, cfg, image, request_id=request_id)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok", "engine": INFERENCE_ENGINE,
        "runtime_device": get_runtime_device(),
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
        img_bytes = base64.b64decode(b64data, validate=True)
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


# ─── IP-Adapter Product Placement (Sprint 7.1) ───────────────────────────────

_ip_adapter_pipe = None

async def _load_ip_adapter():
    """Lazy-load IP-Adapter pipeline. Unloads current diffusers pipe if needed."""
    global _ip_adapter_pipe
    import torch

    if _ip_adapter_pipe is not None:
        return

    # Conservative: unload active diffusers pipeline to free RAM on 24GB
    if pipe is not None:
        log.info("Unloading active diffusers pipeline to make room for IP-Adapter")
        unload_pipeline()

    model_id = "runwayml/stable-diffusion-v1-5"
    log.info(f"Loading IP-Adapter base pipeline: {model_id} ...")

    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    _ip_adapter_pipe = StableDiffusionPipeline.from_pretrained(
        model_id, torch_dtype=torch.float16, safety_checker=None
    )
    _ip_adapter_pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        _ip_adapter_pipe.scheduler.config
    )
    _ip_adapter_pipe.load_ip_adapter(
        "h94/IP-Adapter", subfolder="models", weight_name="ip-adapter_sd15.bin"
    )
    runtime_device = get_runtime_device()
    if runtime_device == "mps":
        _ip_adapter_pipe = _ip_adapter_pipe.to("mps")
        log.info("IP-Adapter pipeline on MPS")
    elif runtime_device == "cuda":
        _ip_adapter_pipe = _ip_adapter_pipe.to("cuda")
        log.info("IP-Adapter pipeline on CUDA")
    else:
        _ip_adapter_pipe = _ip_adapter_pipe.to("cpu")
        log.info("IP-Adapter pipeline on CPU")


def _unload_ip_adapter():
    """Release IP-Adapter pipeline memory."""
    global _ip_adapter_pipe
    import torch
    if _ip_adapter_pipe is not None:
        del _ip_adapter_pipe
        _ip_adapter_pipe = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        elif torch.backends.mps.is_available():
            torch.mps.empty_cache()
        log.info("IP-Adapter pipeline unloaded")


@app.post("/api/v1/product-placement")
async def product_placement(req: ProductPlacementRequest):
    """IP-Adapter product placement: product image + scene prompt → composed image."""
    if not req.product_image or not req.product_image.startswith("data:image"):
        raise HTTPException(400, {"error": "Invalid product image"})

    try:
        header, b64data = req.product_image.split(",", 1)
        img_bytes = base64.b64decode(b64data, validate=True)
    except Exception:
        raise HTTPException(400, {"error": "Invalid base64 encoding"})

    if len(img_bytes) / (1024 * 1024) > 10:
        raise HTTPException(413, {"error": "Image too large (max 10MB)"})

    if is_ram_over_cap():
        raise HTTPException(503, {"error": "Server overloaded"}, headers={"Retry-After": "30"})

    # Decode reference image
    from PIL import Image as PILImage
    ref_image = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")

    await asyncio.to_thread(_load_ip_adapter)
    if _ip_adapter_pipe is None:
        raise HTTPException(503, {"error": "IP-Adapter pipeline unavailable"})

    scale = req.strength if req.strength is not None else 0.6
    num_steps = req.steps or 8
    gen_seed = req.seed if (req.seed is not None and req.seed != -1) else int(time.time()) % 1000000

    _ip_adapter_pipe.set_ip_adapter_scale(scale)

    import torch
    start = time.time()
    try:
        result = await asyncio.to_thread(
            lambda: _ip_adapter_pipe(
                prompt=req.scene_prompt,
                ip_adapter_image=[ref_image],
                num_inference_steps=num_steps,
                generator=torch.manual_seed(gen_seed),
            ).images[0]
        )
    except Exception as e:
        log.error(f"IP-Adapter failed: {e}")
        raise HTTPException(500, {"error": f"Product placement failed: {str(e)}"})
    finally:
        # Conservative: unload after each request on 24GB
        _unload_ip_adapter()

    elapsed = time.time() - start
    b64 = image_to_base64(result)

    return {
        "status": "completed",
        "output": f"data:image/png;base64,{b64}",
        "_meta": {
            "model": "IP-Adapter (SD 1.5)",
            "scene_prompt": req.scene_prompt,
            "strength": scale,
            "steps": num_steps,
            "seed": gen_seed,
            "elapsed_seconds": round(elapsed, 1),
            "ram_mb": get_process_rss_mb(),
        },
    }

# ─── File Upload (local mode) ─────────────────────────────────────────────────
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/nqh-uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/api/v1/upload_file")
async def upload_file(request: Request):
    """Store an uploaded file and return a local file:// URL for downstream use."""
    form = await request.form()
    file_obj = form.get("file")
    if not file_obj:
        raise HTTPException(400, "No file field found")
    
    ext = Path(file_obj.filename or "upload").suffix or ".bin"
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    content = await file_obj.read()
    dest.write_bytes(content)
    log.info(f"Uploaded {file_obj.filename} → {dest} ({len(content)} bytes)")
    # Return file:// URL so the frontend can pass it to image-to-image / image-to-video
    return {"url": f"file://{dest}", "filename": file_obj.filename, "size": len(content)}


@app.post("/api/v1/async-generate")
async def async_generate(req: AsyncGenerateRequest):
    """Enqueue a generation job and return a job_id immediately.

    The client should poll GET /api/v1/jobs/{job_id} until status is completed/failed.
    """
    job_id = uuid.uuid4().hex
    model_cfg = resolve_model_config_strict(req.model)
    if not model_cfg:
        raise HTTPException(400, f"Unknown model: {req.model}")

    async with _jobs_lock:
        async_jobs[job_id] = {
            "status": "pending",
            "model": req.model,
            "prompt": req.prompt,
            "created_at": time.time(),
            "result": None,
            "error": None,
        }

    async def _run_job():
        try:
            async with _jobs_lock:
                if job_id in async_jobs:
                    async_jobs[job_id]["status"] = "processing"

            # Auto-swap pipeline if needed
            if current_model is None or current_model.get("id") != model_cfg.get("id"):
                if INFERENCE_ENGINE != "diffusers":
                    raise HTTPException(503, "Model swap only available in diffusers engine mode")
                if _gen_lock.locked() or pipeline_state == PipelineState.GENERATING:
                    raise HTTPException(409, "Generation in progress, retry shortly")
                if pipeline_state == PipelineState.LOADING:
                    raise HTTPException(503, "Pipeline loading, please wait")
                if is_ram_over_cap():
                    raise HTTPException(503, {"error": "Server RAM over 85% cap, swap blocked"}, headers={"Retry-After": "30"})
                log.info(f"Auto-swap (async): {current_model['name'] if current_model else 'none'} -> {model_cfg['name']}")
                await asyncio.to_thread(swap_pipeline, model_cfg)

            width, height = ar_to_size(req.aspect_ratio)
            result = await generate(
                req.prompt, width, height,
                steps=req.steps, seed=req.seed,
                cfg=req.guidance_scale, image=req.image_url,
                request_id=job_id,
            )

            async with _jobs_lock:
                if job_id in async_jobs:
                    async_jobs[job_id]["status"] = "completed"
                    async_jobs[job_id]["result"] = result
        except HTTPException as he:
            async with _jobs_lock:
                if job_id in async_jobs:
                    async_jobs[job_id]["status"] = "failed"
                    async_jobs[job_id]["error"] = he.detail
        except Exception as e:
            log.error(f"Async job {job_id} failed: {e}")
            async with _jobs_lock:
                if job_id in async_jobs:
                    async_jobs[job_id]["status"] = "failed"
                    async_jobs[job_id]["error"] = str(e)

    # Fire-and-forget background task
    asyncio.create_task(_run_job())
    return {"status": "processing", "job_id": job_id}


@app.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
    """Poll the status of an async generation job."""
    async with _jobs_lock:
        job = async_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    resp = {
        "status": job["status"],
        "model": job.get("model"),
        "prompt": job.get("prompt"),
        "created_at": job.get("created_at"),
    }
    if job["status"] == "completed":
        resp["result"] = job.get("result")
    elif job["status"] == "failed":
        resp["error"] = job.get("error")
    return resp


@app.post("/api/v1/{model_endpoint:path}")
async def muapi_generate(model_endpoint: str, req: MuapiRequest):
    # Skip non-generation endpoints
    if model_endpoint in ("swap-model", "remove-bg", "account/balance"):
        raise HTTPException(404, "Use dedicated endpoint")

    # Auto-swap pipeline if requested model differs from current
    model_cfg = resolve_model_config_strict(model_endpoint)
    if not model_cfg:
        raise HTTPException(400, f"Unknown model endpoint: {model_endpoint}")

    if current_model is None or current_model.get("id") != model_cfg.get("id"):
        if INFERENCE_ENGINE != "diffusers":
            raise HTTPException(503, "Model swap only available in diffusers engine mode")
        if _gen_lock.locked() or pipeline_state == PipelineState.GENERATING:
            raise HTTPException(409, "Generation in progress, retry shortly")
        if pipeline_state == PipelineState.LOADING:
            raise HTTPException(503, "Pipeline loading, please wait")
        if is_ram_over_cap():
            raise HTTPException(503, {"error": "Server RAM over 85% cap, swap blocked"}, headers={"Retry-After": "30"})
        log.info(f"Auto-swap: {current_model['name'] if current_model else 'none'} -> {model_cfg['name']}")
        await asyncio.to_thread(swap_pipeline, model_cfg)

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
    # Check for image result
    result_path = OUTPUT_DIR / f"{request_id}.png"
    if result_path.exists():
        b64 = base64.b64encode(result_path.read_bytes()).decode()
        return {"status": "completed", "outputs": [f"data:image/png;base64,{b64}"]}
    # Check for video result
    video_path = OUTPUT_DIR / f"{request_id}.mp4"
    if video_path.exists():
        b64 = base64.b64encode(video_path.read_bytes()).decode()
        return {"status": "completed", "outputs": [f"data:video/mp4;base64,{b64}"]}
    return {"status": "processing"}


# ─── Idle unload ──────────────────────────────────────────────────────────────

_idle_unload_task = None
IDLE_UNLOAD_SECONDS = int(os.environ.get("IDLE_UNLOAD_SECONDS", "300"))

def _schedule_idle_unload():
    """Start or reset the idle timer. After IDLE_UNLOAD_SECONDS of inactivity,
    the pipeline is automatically unloaded to free VRAM."""
    global _idle_unload_task
    if _idle_unload_task:
        _idle_unload_task.cancel()
    _idle_unload_task = asyncio.create_task(_idle_unload_worker())

async def _idle_unload_worker():
    await asyncio.sleep(IDLE_UNLOAD_SECONDS)
    if pipeline_state == PipelineState.READY and pipe is not None:
        log.info(f"Idle for {IDLE_UNLOAD_SECONDS}s — auto-unloading pipeline to free VRAM")
        unload_pipeline()





# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")

    print(f"\n🎨 NQH Creative Studio Server v3.0 (Sprint 6)")
    print(f"   Engine: {INFERENCE_ENGINE}")
    print(f"   Models: {[m['name'] for m in MODEL_REGISTRY]}")
    print(f"   Host: {host}")
    print(f"   Port: {port}")

    # Record memory baseline before loading any pipeline
    memory_baseline_mb = get_mps_memory()
    print(f"   Memory baseline: {memory_baseline_mb}MB")

    # Always load utility models (regardless of INFERENCE_ENGINE)
    init_rembg()

    if FORCE_CPU:
        print("   ⚠️  FORCE_CPU enabled — skipping Diffusers pipeline load (Luồng A)")
        print("   ⚠️  Generation endpoints will return 503 until GPU stack fixed (Luồng B)")
    elif INFERENCE_ENGINE == "diffusers" and MODEL_REGISTRY:
        # Lazy-load: do NOT load a default model at startup to keep VRAM free.
        # The first generation request will trigger the load via auto-swap.
        print("   Lazy-load mode: no model loaded at startup (VRAM kept free)")
    elif INFERENCE_ENGINE == "mflux":
        print(f"   Using mflux subprocess (legacy fallback)")

    print(f"   Hot-swap: POST /api/v1/swap-model")
    print(f"   Health: GET /health")
    print()
    uvicorn.run(app, host=host, port=port)
