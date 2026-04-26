"""Local Flux Image Generation Server — OpenAI-compatible API.

Wraps mflux CLI to serve Flux Schnell on Apple Silicon via MLX.
Drop-in replacement for Muapi.ai in Open-Generative-AI.

Usage:
    cd ~/Documents/Research/Open-Generative-AI
    source .venv/bin/activate
    python local-server/server.py

API:
    POST /v1/images/generations  — OpenAI-compatible
    POST /api/v1/{model}         — Muapi-compatible (proxied)
    GET  /v1/models              — List available models
    GET  /health                 — Health check
"""

import asyncio
import base64
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Local Flux Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────────────────────────

MFLUX_MODEL = os.environ.get("MFLUX_MODEL", "schnell")
MFLUX_QUANTIZE = os.environ.get("MFLUX_QUANTIZE", "8")
MFLUX_STEPS = int(os.environ.get("MFLUX_STEPS", "4"))
OUTPUT_DIR = Path(tempfile.gettempdir()) / "flux-output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ─── Models ───────────────────────────────────────────────────────────────────

class ImageRequest(BaseModel):
    prompt: str
    model: str = "flux-schnell"
    n: int = 1
    size: str = "512x512"
    steps: int | None = None
    seed: int | None = None


class MuapiRequest(BaseModel):
    prompt: str
    aspect_ratio: str | None = None
    resolution: str | None = None
    image_url: str | None = None
    seed: int | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def parse_size(size: str) -> tuple[int, int]:
    """Parse '512x512' into (width, height)."""
    parts = size.lower().split("x")
    if len(parts) == 2:
        return int(parts[0]), int(parts[1])
    return 512, 512


def ar_to_size(ar: str | None) -> tuple[int, int]:
    """Convert aspect ratio string to dimensions."""
    mapping = {
        "1:1": (512, 512),
        "16:9": (768, 432),
        "9:16": (432, 768),
        "4:3": (640, 480),
        "3:2": (640, 432),
    }
    return mapping.get(ar or "1:1", (512, 512))


async def generate_image(prompt: str, width: int, height: int,
                         steps: int | None = None, seed: int | None = None) -> bytes:
    """Run mflux-generate and return PNG bytes."""
    output_path = OUTPUT_DIR / f"{uuid.uuid4().hex}.png"

    cmd = [
        "mflux-generate",
        "--model", MFLUX_MODEL,
        "--prompt", prompt,
        "--steps", str(steps or MFLUX_STEPS),
        "--width", str(width),
        "--height", str(height),
        "--quantize", MFLUX_QUANTIZE,
        "--output", str(output_path),
    ]
    if seed is not None and seed != -1:
        cmd.extend(["--seed", str(seed)])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise HTTPException(500, f"mflux-generate failed: {stderr.decode()[-500:]}")

    if not output_path.exists():
        raise HTTPException(500, "mflux-generate produced no output file")

    img_bytes = output_path.read_bytes()
    output_path.unlink(missing_ok=True)
    return img_bytes


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": MFLUX_MODEL, "quantize": MFLUX_QUANTIZE}


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "flux-schnell",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "local-mlx",
            }
        ],
    }


@app.post("/v1/images/generations")
async def openai_generate(req: ImageRequest):
    """OpenAI-compatible image generation endpoint."""
    width, height = parse_size(req.size)
    start = time.time()

    img_bytes = await generate_image(req.prompt, width, height, req.steps, req.seed)

    b64 = base64.b64encode(img_bytes).decode()
    elapsed = time.time() - start

    return {
        "created": int(time.time()),
        "data": [
            {
                "b64_json": b64,
                "revised_prompt": req.prompt,
            }
        ],
        "_meta": {
            "model": MFLUX_MODEL,
            "size": f"{width}x{height}",
            "steps": req.steps or MFLUX_STEPS,
            "elapsed_seconds": round(elapsed, 1),
        },
    }


@app.post("/api/v1/{model_endpoint:path}")
async def muapi_generate(model_endpoint: str, req: MuapiRequest):
    """Muapi-compatible endpoint for Open-Generative-AI integration."""
    width, height = ar_to_size(req.aspect_ratio)
    request_id = uuid.uuid4().hex

    start = time.time()
    img_bytes = await generate_image(req.prompt, width, height, seed=req.seed)
    elapsed = time.time() - start

    # Save for polling endpoint
    result_path = OUTPUT_DIR / f"{request_id}.png"
    result_path.write_bytes(img_bytes)

    b64 = base64.b64encode(img_bytes).decode()

    return {
        "request_id": request_id,
        "status": "completed",
        "outputs": [f"data:image/png;base64,{b64}"],
        "_meta": {
            "model": MFLUX_MODEL,
            "size": f"{width}x{height}",
            "elapsed_seconds": round(elapsed, 1),
        },
    }


@app.get("/api/v1/account/balance")
async def account_balance():
    """Fake balance endpoint for local mode — unlimited local generation."""
    return {"balance": 999999.0, "currency": "LOCAL", "plan": "self-hosted"}


@app.get("/api/v1/predictions/{request_id}/result")
async def poll_result(request_id: str):
    """Muapi-compatible polling endpoint."""
    result_path = OUTPUT_DIR / f"{request_id}.png"
    if result_path.exists():
        b64 = base64.b64encode(result_path.read_bytes()).decode()
        return {
            "status": "completed",
            "outputs": [f"data:image/png;base64,{b64}"],
        }
    return {"status": "processing"}


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    print(f"\n🎨 Local Flux Server starting on http://localhost:{port}")
    print(f"   Model: {MFLUX_MODEL} (quantize {MFLUX_QUANTIZE}, {MFLUX_STEPS} steps)")
    print(f"   OpenAI: POST /v1/images/generations")
    print(f"   Muapi:  POST /api/v1/{{model}}")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)
