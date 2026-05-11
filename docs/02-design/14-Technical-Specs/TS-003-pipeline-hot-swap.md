---
ts_id: TS-003
title: "Pipeline Hot-Swap Mechanism"
ts_version: "1.0.0"
status: Approved
stage: "02-design"
owner: "@architect"
created: 2026-05-05
last_updated: 2026-05-06
references:
  - ADR-003 (docs/02-design/01-ADRs/ADR-003-hot-swap-architecture.md)
  - TS-002 (docs/02-design/14-Technical-Specs/TS-002-diffusers-pipeline.md)
  - ZPix app.py swap_model() lines 212-221
gate: G2
---

# TS-003: Pipeline Hot-Swap Mechanism

## 1. Overview

Add hot-swap capability to `local-server/server.py`: unload the current Diffusers
pipeline, reclaim memory, load a new pipeline — all without server restart. Expose
via `POST /api/v1/swap-model` endpoint with state machine protection against
concurrent access.

Primary runtime target is GPU Server S1 (CUDA). MPS path remains supported for Mac fallback.

---

## 2. State Machine

### 2.1 States

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────┐   swap    ┌─────────┐   done    ┌───────┐            │
│   │ IDLE │─────────>│ LOADING │─────────>│ READY │            │
│   └──────┘           └─────────┘           └───┬───┘            │
│       ^                   ^                     │                │
│       │                   │ swap                │ gen request    │
│       │ unload            │                     v                │
│       │              ┌─────────┐          ┌────────────┐        │
│       └──────────────│ LOADING │<─────────│ GENERATING │        │
│                      └─────────┘  gen     └────────────┘        │
│                                   done         │                │
│                                   +swap        │ gen done       │
│                                   queued       v                │
│                                          ┌───────┐              │
│                                          │ READY │              │
│                                          └───────┘              │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 State Variable

```python
from enum import Enum

class PipelineState(Enum):
    IDLE = "idle"
    LOADING = "loading"
    READY = "ready"
    GENERATING = "generating"

_state = PipelineState.IDLE
```

### 2.3 Transition Rules

| Current State | Event | Next State | Action |
|---------------|-------|------------|--------|
| IDLE | swap request | LOADING | Load pipeline |
| LOADING | load complete | READY | Pipeline available |
| LOADING | load failed | IDLE | Log error, no pipeline |
| READY | gen request | GENERATING | Execute generation |
| READY | swap request | LOADING | Unload + load new |
| GENERATING | gen done | READY | Return result |
| GENERATING | swap request | 409 error | Reject (busy) |

---

## 3. Dual Lock Design

### 3.1 Lock Definitions

```python
_swap_lock = asyncio.Lock()   # Held during entire unload→load cycle
_gen_lock  = asyncio.Lock()   # Held during generation
```

### 3.2 Lock Interaction Matrix

| Operation | _swap_lock | _gen_lock | Behavior if contended |
|-----------|-----------|----------|----------------------|
| swap_model() | ACQUIRE | CHECK (must be free) | 409 if _gen_lock held |
| generate() | CHECK (must be free) | ACQUIRE | 503 if _swap_lock held |

### 3.3 No Deadlock Guarantee

Lock acquisition order is strictly: `_swap_lock` before `_gen_lock`. No code path
attempts the reverse. `generate()` never acquires `_swap_lock`; `swap_model()` never
acquires `_gen_lock`.

---

## 4. POST /api/v1/swap-model Endpoint

### 4.1 Request

```http
POST /api/v1/swap-model
Content-Type: application/json

{
    "model": "flux2-klein-4b"
}
```

The `model` field matches any value in a model's `frontend_ids` array.

### 4.2 Success Response (200)

```json
{
    "status": "swapped",
    "previous_model": "Z-Image Turbo",
    "current_model": "FLUX.2 Klein 4B",
    "swap_time_seconds": 18.3,
    "ram_after_mb": 142,
    "ram_delta_mb": 12
}
```

### 4.3 Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Unknown model ID | `{"error": "Unknown model: xyz", "available": [...]}` |
| 400 | Model is cloud-only | `{"error": "Model xyz is cloud-only, cannot load locally"}` |
| 400 | Model is already loaded | `{"error": "Model already loaded", "model": "..."}` |
| 409 | Generation in progress | `{"error": "Cannot swap while generating", "state": "generating"}` |
| 503 | Another swap in progress | `{"error": "Swap already in progress", "state": "loading"}` |
| 500 | Load failed | `{"error": "Failed to load model: ...", "state": "idle"}` |

### 4.4 Endpoint Implementation

```python
class SwapRequest(BaseModel):
    model: str

@app.post("/api/v1/swap-model")
async def swap_model_endpoint(req: SwapRequest):
    global _state

    # Resolve target model
    target = resolve_model_config(req.model)
    if target is None:
        raise HTTPException(400, {
            "error": f"Unknown model: {req.model}",
            "available": [m["frontend_ids"][0] for m in MODEL_REGISTRY
                          if m.get("model_type", "diffusers") in ("diffusers", "custom")]
        })

    model_type = target.get("model_type", "diffusers")
    if model_type == "cloud-only":
        raise HTTPException(400, {"error": f"Model {req.model} is cloud-only"})
    if model_type == "utility":
        raise HTTPException(400, {"error": f"Model {req.model} is utility (always-resident)"})

    # Check if already loaded
    if current_model and target["id"] == current_model["id"]:
        raise HTTPException(400, {"error": "Model already loaded", "model": target["name"]})

    # State guards
    if _state == PipelineState.GENERATING:
        raise HTTPException(409, {"error": "Cannot swap while generating", "state": _state.value})
    if _state == PipelineState.LOADING:
        raise HTTPException(503, {"error": "Swap already in progress", "state": _state.value})

    # Perform swap
    if _swap_lock.locked():
        raise HTTPException(503, {"error": "Swap already in progress"})

    async with _swap_lock:
        previous_name = current_model["name"] if current_model else None
        baseline_ram = get_mps_memory()

        _state = PipelineState.LOADING
        start = time.time()

        try:
            # Unload current pipeline
            unload_pipeline()
            await asyncio.sleep(0.1)  # Yield for GC

            # Load new pipeline
            await asyncio.to_thread(load_diffusers_pipeline, target)
            _state = PipelineState.READY
        except Exception as e:
            _state = PipelineState.IDLE
            log.error(f"Swap failed: {e}")
            raise HTTPException(500, {"error": f"Failed to load model: {str(e)}", "state": "idle"})

        elapsed = time.time() - start
        ram_after = get_mps_memory()

        # Gate check: warn if RAM delta exceeds tolerance
        ram_delta = ram_after - baseline_ram
        if ram_delta > 300:
            log.warning(f"RAM gate exceeded: delta={ram_delta}MB (tolerance=300MB)")

    return {
        "status": "swapped",
        "previous_model": previous_name,
        "current_model": current_model["name"],
        "swap_time_seconds": round(elapsed, 1),
        "ram_after_mb": ram_after,
        "ram_delta_mb": ram_delta,
    }
```

---

## 5. unload_pipeline() Implementation

### 5.1 Pseudocode

```python
def unload_pipeline():
    """Unload current pipeline and reclaim MPS/system memory."""
    global pipe, current_model
    import gc

    if pipe is None:
        log.info("No pipeline to unload")
        return

    model_name = current_model["name"] if current_model else "unknown"
    ram_before = get_mps_memory()
    log.info(f"Unloading pipeline: {model_name} (RAM: {ram_before}MB)")

    # Step 1: Delete pipeline object (releases Python references)
    del pipe
    pipe = None
    current_model = None

    # Step 2: Force garbage collection (releases C++ / PyTorch tensors)
    gc.collect()

    # Step 3: Reclaim MPS device memory (Apple Silicon specific)
    import torch
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()

    ram_after = get_mps_memory()
    log.info(f"Unloaded: {model_name} — RAM: {ram_before}MB → {ram_after}MB "
             f"(freed {ram_before - ram_after}MB)")
```

### 5.2 Memory Reclamation Timeline

```
t=0.0s  del pipe                  → Python refcount drops to 0
t=0.0s  gc.collect()              → Cyclic refs broken, __del__ called on tensors
t=0.1s  torch.mps.empty_cache()  → MPS allocator returns pages to system
t=0.5s  macOS memory pressure     → Unified memory pages reclaimed
t=1-5s  Steady state              → RAM should be at baseline + 300MB max
```

### 5.3 Verification

```python
async def verify_memory_gate(baseline_mb: int, timeout_s: float = 5.0):
    """Verify RAM returned to acceptable level after unload."""
    import asyncio

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        current = get_mps_memory()
        if current <= baseline_mb + 300:
            return True, current
        await asyncio.sleep(0.5)

    current = get_mps_memory()
    return False, current
```

---

## 6. Generation Guard (Updated)

The existing `diffusers_generate()` function must check state before acquiring
the generation lock:

```python
async def diffusers_generate(prompt, width, height, ...):
    global _state

    # Reject if pipeline not ready
    if _state == PipelineState.LOADING:
        raise HTTPException(503, "Pipeline swap in progress, try again later")
    if _state == PipelineState.IDLE:
        raise HTTPException(503, "No pipeline loaded")
    if _swap_lock.locked():
        raise HTTPException(503, "Pipeline swap in progress")

    async with _gen_lock:
        _state = PipelineState.GENERATING
        try:
            # ... existing generation logic ...
            result = await asyncio.to_thread(lambda: pipe(**pipe_kwargs).images[0])
        finally:
            _state = PipelineState.READY

    # ... return result ...
```

---

## 7. Device Memory Lifecycle (CUDA/MPS)

### 7.1 Measurement Points

| Point | When | Purpose |
|-------|------|---------|
| `baseline_mb` | Server start, before any pipeline | Reference for gate check |
| `pre_unload_mb` | Before `del pipe` | Track what model was using |
| `post_unload_mb` | After `empty_cache()` + 1s | Verify reclamation |
| `post_load_mb` | After new pipeline loaded | Verify gate (+300MB) |
| `gen_peak_mb` | During generation | Track peak for observability |

### 7.2 Gate Enforcement

```
post_load_mb - baseline_mb <= 300MB   (PASS)
post_load_mb - baseline_mb  > 300MB   (WARN — log, do not block)
total_process_rss > 0.85 * physical   (BLOCK — refuse to load, return 503)
```

The 85% cap is checked using `psutil.virtual_memory().percent` before loading.
For CUDA hosts, also log `torch.cuda.memory_allocated()` and `torch.cuda.memory_reserved()`.

---

## 8. models.json Schema Update

### 8.1 New Field: model_type

```json
[
    {
        "id": "Disty0/Z-Image-Turbo-SDNQ-uint4-svd-r32",
        "backup_id": "SamuelTallet/Z-Image-Turbo-SDNQ-uint4-svd-r32",
        "frontend_ids": ["z-image-turbo", "z-image-base", "flux-schnell", "dreamshaper-8"],
        "name": "Z-Image Turbo",
        "pipeline": "ZImagePipeline",
        "model_type": "diffusers",
        "default": {"steps": 8, "cfg": 0.0},
        "features": ["text-to-image"],
        "ram_gb": 6
    },
    {
        "id": "Disty0/FLUX.2-klein-4B-SDNQ-4bit-dynamic",
        "backup_id": "SamuelTallet/FLUX.2-klein-4B-SDNQ-4bit-dynamic",
        "frontend_ids": ["flux2-klein-4b"],
        "name": "FLUX.2 Klein 4B",
        "pipeline": "Flux2KleinPipeline",
        "model_type": "diffusers",
        "default": {"steps": 4, "cfg": 1.0},
        "features": ["text-to-image", "image-to-image"],
        "ram_gb": 4
    },
    {
        "id": "rembg-u2net",
        "frontend_ids": ["rembg", "remove-bg"],
        "name": "RMBG (u2net)",
        "pipeline": null,
        "model_type": "utility",
        "default": {},
        "features": ["remove-background"],
        "ram_gb": 2
    }
]
```

### 8.2 Field Semantics

| Field | Type | Description |
|-------|------|-------------|
| `model_type` | `"diffusers" \| "utility" \| "custom" \| "cloud-only"` | Determines swap eligibility |

Default if omitted: `"diffusers"` (backward compatible).

### 8.3 Video Model Hot-Swap Notes

CogVideoX 5B (`ram_gb: 18`) triggers the longest swap times (~15–20s load). The state machine remains the same, but:

- Swap **from** CogVideoX → image model: full 18GB unload + new load
- Swap **to** CogVideoX: expect 15–20s load on RTX 5090 from local SSD
- Idle auto-unload (§10) prevents CogVideoX from permanently reserving VRAM

Only one diffusers pipeline is loaded at a time. The LRU cache size on S1 remains `1`.

---

## 9. LRU Pipeline Cache (48GB Production)

### 9.1 Configuration

```python
PIPELINE_CACHE_SIZE = int(os.environ.get("PIPELINE_CACHE_SIZE", "1"))
# 24GB MacBook: 1 (always swap)
# 48GB Mac Mini: 2 (keep 2 warm)
# 32GB RTX 5090 (S1): 1 (always swap — CogVideoX dominates VRAM)
```

### 9.2 Cache Structure

```python
from collections import OrderedDict

_pipeline_cache: OrderedDict[str, tuple] = OrderedDict()
# Key: model_id
# Value: (pipe_object, model_config)
```

### 9.3 Cache Logic in swap_model()

```python
async def swap_model(target_config):
    model_id = target_config["id"]

    # Cache hit — reuse existing pipeline
    if model_id in _pipeline_cache:
        _pipeline_cache.move_to_end(model_id)
        pipe, current_model = _pipeline_cache[model_id]
        _state = PipelineState.READY
        return

    # Cache full — evict LRU
    if len(_pipeline_cache) >= PIPELINE_CACHE_SIZE:
        evict_id, (evict_pipe, _) = _pipeline_cache.popitem(last=False)
        del evict_pipe
        gc.collect()
        torch.mps.empty_cache()

    # Load new pipeline
    load_diffusers_pipeline(target_config)
    _pipeline_cache[model_id] = (pipe, current_model)
```

---

## 10. Idle Auto-Unload

After 300 seconds of inactivity, the current diffusers pipeline is automatically unloaded to free VRAM:

```python
IDLE_UNLOAD_SECONDS = int(os.environ.get("IDLE_UNLOAD_SECONDS", "300"))

async def _idle_unload_monitor():
    while True:
        await asyncio.sleep(60)
        if pipeline_state == PipelineState.READY and idle_seconds() > IDLE_UNLOAD_SECONDS:
            unload_pipeline()
            pipeline_state = PipelineState.IDLE
```

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `IDLE_UNLOAD_SECONDS` | 300 | Seconds of inactivity before unload |

This is especially important for CogVideoX 5B which peaks at ~30GB VRAM.

---

## 11. Affected Files

| File | Change | Notes |
|------|--------|-------|
| `local-server/server.py` | Add state machine, dual locks, unload_pipeline(), swap endpoint, cache, idle unload | Major (~120 lines added) |
| `local-server/models.json` | Add `model_type` field to each entry | Schema update |
| `local-server/requirements-mac.txt` | Add `psutil` for memory cap check | Minor |

---

## 12. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Swap while idle (no pipeline loaded) | 200, pipeline loads |
| 2 | Swap while ready | 200, old unloaded, new loaded |
| 3 | Swap while generating | 409 error |
| 4 | Swap while another swap in progress | 503 error |
| 5 | Generate during swap | 503 error |
| 6 | Swap to same model | 400 error |
| 7 | Swap to unknown model | 400 error |
| 8 | Swap to cloud-only model | 400 error |
| 9 | RAM gate check after swap | delta <= 300MB within 5s |
| 10 | LRU cache hit (48GB) | Instant swap, no load |
| 11 | LRU eviction (48GB) | Oldest evicted, new loaded |
| 12 | Idle unload after 300s | Pipeline state → IDLE, VRAM freed |
| 13 | Swap to CogVideoX from idle | 200, ~15–20s load time |
| 14 | Generate video during image gen | 409 (gen lock held) |

---

*NQH Creative Studio (OGA) | TS-003 v1.0.0 | Approved 2026-05-05*
