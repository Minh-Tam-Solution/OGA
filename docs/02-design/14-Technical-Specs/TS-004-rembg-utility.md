---
ts_id: TS-004
title: "RMBG Utility — Background Removal Service"
ts_version: "1.0.0"
status: Approved
stage: "02-design"
owner: "@architect"
created: 2026-05-05
references:
  - ADR-003 (docs/02-design/01-ADRs/ADR-003-hot-swap-architecture.md)
  - TS-003 (docs/02-design/14-Technical-Specs/TS-003-pipeline-hot-swap.md)
gate: G2
---

# TS-004: RMBG Utility — Background Removal Service

## 1. Overview

Add background removal as an always-resident utility service in
`local-server/server.py`. Uses the `rembg` library (MIT license) with the u2net
model to remove backgrounds from images, producing PNG with alpha channel.

This is classified as a `utility` model type (ADR-003): loaded at startup,
never swapped, coexists with the active diffusers pipeline.

---

## 2. Dependency

### 2.1 Package

```
rembg[cpu]==2.0.57
```

Add to `local-server/requirements-mac.txt`.

**Key details:**
- License: MIT
- Backend: ONNX Runtime (CPU) — no GPU/MPS required
- Model: u2net (auto-downloaded on first use, ~176MB)
- Apple Silicon: Runs on CPU via ONNX; no MPS dependency, no torch conflict

### 2.2 Why CPU ONNX (not MPS)

- u2net via ONNX is fast enough for single images (~1-3s per image)
- CPU execution avoids contention with MPS diffusers pipeline
- ONNX Runtime for Apple Silicon uses Accelerate framework (NEON) natively
- Keeps MPS memory budget clear for the main generation pipeline

---

## 3. Memory Budget

### 3.1 RMBG Memory Footprint

| Component | RAM (approx) |
|-----------|-------------|
| ONNX Runtime + u2net model | ~800MB |
| Input/output image buffers | ~200-400MB (depends on resolution) |
| **Total peak** | **~1-2GB** |

### 3.2 Co-Residency Budget (24GB MacBook M4 Pro)

| Component | RAM |
|-----------|-----|
| macOS + system services | ~6GB |
| IDE + browser (typical workload) | ~8GB |
| Diffusers pipeline (CPU offload peak) | ~6GB |
| RMBG utility | ~2GB |
| **Total** | **~22GB** |
| **Headroom** | **~2GB (8%)** |

This is within the 85% RAM cap (85% of 24GB = 20.4GB for our process). The
diffusers peak is transient (only during generation), so actual steady-state
for our server process is ~8GB (RMBG + diffusers idle components).

### 3.3 Co-Residency Budget (48GB Mac Mini M4 Pro)

| Component | RAM |
|-----------|-----|
| macOS + system services | ~6GB |
| Diffusers pipeline (2 cached) | ~12GB |
| RMBG utility | ~2GB |
| **Total** | **~20GB** |
| **Headroom** | **~28GB (58%)** |

No concern on 48GB hardware.

---

## 4. POST /api/v1/remove-bg Endpoint

### 4.1 Request

```http
POST /api/v1/remove-bg
Content-Type: application/json

{
    "image": "data:image/png;base64,iVBORw0KGgo..."
}
```

The `image` field accepts a base64-encoded data URL (PNG or JPEG).

### 4.2 Success Response (200)

```json
{
    "status": "completed",
    "output": "data:image/png;base64,iVBORw0KGgo...",
    "_meta": {
        "model": "RMBG (u2net)",
        "input_size": "1024x768",
        "output_format": "PNG (RGBA)",
        "elapsed_seconds": 2.1,
        "ram_mb": 1842
    }
}
```

The output is always PNG with alpha channel (RGBA), regardless of input format.

### 4.3 Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing or invalid `image` field | `{"error": "Invalid image data"}` |
| 413 | Image exceeds 10MB | `{"error": "Image too large (max 10MB)", "size_mb": 12.3}` |
| 503 | Server overloaded (RAM > 85% cap) | `{"error": "Server overloaded, try again later"}` |
| 500 | Processing failed | `{"error": "Background removal failed: ..."}` |

---

## 5. Implementation

### 5.1 Initialization (at server startup)

```python
from rembg import remove, new_session

# Load RMBG session at startup (utility: always-resident)
_rembg_session = None

def init_rembg():
    """Initialize rembg u2net session. Called once at startup."""
    global _rembg_session
    log.info("Loading RMBG (u2net) utility model...")
    _rembg_session = new_session("u2net")
    log.info("RMBG ready (~1-2GB resident)")
```

### 5.2 Request Handler

```python
class RemoveBgRequest(BaseModel):
    image: str  # base64 data URL

@app.post("/api/v1/remove-bg")
async def remove_bg(req: RemoveBgRequest):
    # Validate input
    if not req.image or not req.image.startswith("data:image"):
        raise HTTPException(400, {"error": "Invalid image data"})

    # Decode base64
    try:
        header, b64data = req.image.split(",", 1)
        img_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(400, {"error": "Invalid base64 encoding"})

    # Size check (10MB max)
    size_mb = len(img_bytes) / (1024 * 1024)
    if size_mb > 10:
        raise HTTPException(413, {"error": "Image too large (max 10MB)", "size_mb": round(size_mb, 1)})

    # RAM cap check
    if is_ram_over_cap():
        raise HTTPException(503, {"error": "Server overloaded, try again later"})

    # Process
    start = time.time()
    try:
        result_bytes = await asyncio.to_thread(
            remove, img_bytes, session=_rembg_session
        )
    except Exception as e:
        log.error(f"RMBG failed: {e}")
        raise HTTPException(500, {"error": f"Background removal failed: {str(e)}"})

    elapsed = time.time() - start

    # Get dimensions for meta
    from PIL import Image as PILImage
    img = PILImage.open(io.BytesIO(img_bytes))
    input_size = f"{img.width}x{img.height}"

    # Encode output
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
```

### 5.3 RAM Cap Helper

```python
def is_ram_over_cap() -> bool:
    """Check if adding RMBG processing would exceed 85% RAM cap."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        return mem.percent > 85.0
    except ImportError:
        return False  # If psutil not available, allow request

def get_process_rss_mb() -> int:
    """Get current process RSS in MB."""
    try:
        import psutil
        return round(psutil.Process().memory_info().rss / 1024 / 1024)
    except ImportError:
        return 0
```

---

## 6. Concurrency Policy

### 6.1 RMBG Does Not Use _gen_lock

Background removal runs on CPU (ONNX), not MPS. It does not contend with the
diffusers pipeline which uses MPS. Therefore:

- RMBG requests do NOT acquire `_gen_lock`
- RMBG can run concurrently with diffusers generation
- Multiple RMBG requests are serialized with a dedicated lock:

```python
_rembg_lock = asyncio.Lock()  # One rembg operation at a time (CPU bound)
```

### 6.2 Why Serialize RMBG

- u2net on CPU peaks at ~1-2GB additional RAM per operation
- Concurrent u2net calls would stack memory: 2 concurrent = ~4GB peak
- On 24GB hardware with diffusers active, 4GB extra would breach 85% cap
- Serial execution keeps peak predictable

### 6.3 Concurrency Matrix

| Operation A | Operation B | Allowed? | Reason |
|-------------|-------------|----------|--------|
| Diffusers gen | RMBG | Yes | Different compute (MPS vs CPU) |
| RMBG | RMBG | No (serialized) | RAM cap protection |
| Diffusers gen | Diffusers gen | No (serialized) | Single MPS device |
| Swap model | RMBG | Yes | Swap affects diffusers only |
| Swap model | Diffusers gen | No | State machine blocks |

---

## 7. Startup Integration

### 7.1 Server Main Block Update

```python
if __name__ == "__main__":
    # ... existing startup code ...

    # Always load utility models (regardless of INFERENCE_ENGINE)
    init_rembg()

    # Load diffusers pipeline (if engine=diffusers)
    if INFERENCE_ENGINE == "diffusers" and MODEL_REGISTRY:
        load_diffusers_pipeline(MODEL_REGISTRY[0])
```

### 7.2 Health Endpoint Update

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine": INFERENCE_ENGINE,
        "model": current_model["name"] if current_model else "none",
        "utilities": {
            "rembg": _rembg_session is not None,
        },
        "peak_ram_mb": last_peak_ram,
        "process_rss_mb": get_process_rss_mb(),
    }
```

---

## 8. Error Handling

### 8.1 413 — Image Too Large

Threshold: 10MB raw (after base64 decode). Rationale:
- u2net processes at original resolution — large images = large tensor = OOM risk
- 10MB PNG ~= 4000x4000 pixels, which is well beyond typical studio use
- Frontend should resize to max 2048px before sending

### 8.2 503 — Server Overloaded

Triggered when `psutil.virtual_memory().percent > 85`. This means:
- System RAM usage (all processes) exceeds 85% of physical
- Could happen during concurrent diffusers gen + RMBG request
- Client should retry with exponential backoff (Retry-After header included)

```python
if is_ram_over_cap():
    raise HTTPException(
        status_code=503,
        detail={"error": "Server overloaded, try again later"},
        headers={"Retry-After": "10"},
    )
```

### 8.3 500 — Processing Failed

Catches unexpected failures in rembg (corrupt image, unsupported format, OOM in
ONNX runtime). Logs full traceback for debugging.

---

## 9. Affected Files

| File | Change | Notes |
|------|--------|-------|
| `local-server/server.py` | Add RMBG init, endpoint, lock, RAM helpers | ~60 lines added |
| `local-server/requirements-mac.txt` | Add `rembg[cpu]==2.0.57`, `psutil` | Dependency |
| `local-server/models.json` | Add RMBG entry with `model_type: "utility"` | Registry update |

---

## 10. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid JPEG, 1024x768 | 200, PNG with alpha returned |
| 2 | Valid PNG with existing alpha | 200, re-processed alpha |
| 3 | Image > 10MB | 413 error |
| 4 | Invalid base64 | 400 error |
| 5 | Missing image field | 400 error (validation) |
| 6 | Concurrent RMBG + diffusers gen | Both succeed (different compute) |
| 7 | Two concurrent RMBG requests | Second waits for first (serialized) |
| 8 | RMBG when RAM > 85% | 503 error |
| 9 | RMBG during model swap | 200 (RMBG unaffected by swap) |
| 10 | Server startup without rembg installed | Graceful degradation, endpoint returns 503 |

---

*NQH Creative Studio (OGA) | TS-004 v1.0.0 | Approved 2026-05-05*
