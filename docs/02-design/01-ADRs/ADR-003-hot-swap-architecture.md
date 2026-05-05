---
adr_id: ADR-003
title: "Pipeline Hot-Swap Architecture"
status: Approved
date: 2026-05-05
deciders: ["@cto", "@cpo"]
gate: G2
supersedes: null
references:
  - ADR-002 (docs/02-design/01-ADRs/ADR-002-diffusers-engine.md)
  - ZPix app.py swap_model() lines 212-221
---

# ADR-003: Pipeline Hot-Swap Architecture

## Status

**Approved** — CPO approved with gate tolerance +300MB and 85% RAM cap conditions.

## Context

Sprint 5 introduced Diffusers in-process pipeline (ADR-002). The server loads ONE
pipeline at startup and keeps it in memory forever. This creates problems:

1. **Multi-studio workflow**: Creators need different models for different tasks
   (Z-Image Turbo for fast iteration, FLUX.2 Klein for high-quality img2img).
   Currently requires server restart to switch models.

2. **Limited RAM**: MacBook M4 Pro 24GB cannot hold two diffusers pipelines
   simultaneously. With system + apps (~14GB), only ~10GB available for inference.

3. **No unload path**: `server.py` has `load_diffusers_pipeline()` but no
   `unload_pipeline()`. No `del pipe`, no `gc.collect()`, no
   `torch.mps.empty_cache()`. Memory only freed on process exit.

4. **Production scaling**: Mac Mini M4 Pro 48GB can hold 2 pipelines warm (~12GB
   total for two 4-6GB models), but needs a controlled eviction strategy.

5. **Utility co-residency**: RMBG (rembg + u2net) is a utility model (~1-2GB)
   that must remain loaded alongside any active diffusers pipeline. It should
   never be swapped out.

### ZPix Reference

ZPix `app.py` lines 212-221 implements `swap_model()` with a `pipe_is_busy` flag:

```python
def swap_model(new_model_id):
    if pipe_is_busy:
        return {"error": "Generation in progress"}
    del pipe
    gc.collect()
    torch.mps.empty_cache()
    pipe = load_pipeline(new_model_id)
```

This is a minimal implementation. We need a more robust state machine with proper
locking for async concurrent access.

## Decision

Implement a state-machine-based hot-swap mechanism with dual locks and explicit
memory lifecycle management.

### State Machine

Pipeline state transitions through four states:

```
IDLE ──[swap request]──> LOADING ──[load complete]──> READY ──[gen request]──> GENERATING
  ^                                                     ^                          |
  |                                                     └──────[gen done]──────────┘
  └──[unload]──────────────── LOADING <─────────────────[swap during READY]
```

States:
- **IDLE**: No pipeline loaded. Server is operational but cannot generate.
- **LOADING**: Pipeline being loaded or swapped. Rejects generation requests (503).
- **READY**: Pipeline loaded and idle. Accepts generation and swap requests.
- **GENERATING**: Pipeline actively generating. Rejects swap requests (409).

### Dual Lock Strategy

```python
_swap_lock = asyncio.Lock()   # Protects pipeline identity (load/unload)
_gen_lock  = asyncio.Lock()   # Protects pipeline usage (generation)
```

Rules:
- `swap_model()` acquires `_swap_lock` first, then waits for `_gen_lock` to be free
  (ensuring no generation is in progress), then performs unload/load.
- `generate()` acquires `_gen_lock`. If `_swap_lock` is held, generation returns 503.
- No deadlock: lock order is always swap -> gen (never reverse).

### unload_pipeline()

```python
def unload_pipeline():
    global pipe, current_model
    import gc, torch

    if pipe is not None:
        del pipe
        pipe = None
        current_model = None
        gc.collect()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
```

### Memory Gate

After unload + load, measure RAM:
- `peak_ram_mb` must be <= `baseline_mb + 300` within 5 seconds
- If exceeded, log a warning and emit metric (but do not roll back — operator decides)
- Baseline is measured at server start before any pipeline load

### model_type Classification

Each model in `models.json` declares a `model_type` field:

| Type | Behavior | Example |
|------|----------|---------|
| `diffusers` | Swappable via hot-swap endpoint | Z-Image Turbo, FLUX.2 Klein |
| `utility` | Always-resident, never swapped | RMBG (rembg + u2net) |
| `custom` | Swappable, loaded from local path | User-trained LoRA pipeline |
| `cloud-only` | Never loaded locally, proxied to cloud | DALL-E 3, Midjourney |

**Policy**: Only `diffusers` and `custom` types participate in hot-swap.
`utility` models are loaded at startup and remain in memory permanently.
`cloud-only` models are never loaded locally.

### LRU Cache (48GB Production Only)

On Mac Mini M4 Pro 48GB (`PIPELINE_CACHE_SIZE=2` env var):
- Keep up to 2 recently used diffusers pipelines warm in memory
- LRU eviction when a 3rd model is requested
- Eviction uses the same `unload_pipeline()` path
- Default on 24GB hardware: cache size = 1 (current behavior, always swap)

Cache is an `OrderedDict` mapping `model_id -> pipe`. On access, model moves to
end. On eviction, oldest model is unloaded.

## Consequences

### Positive

- Zero-downtime model switching for multi-studio workflows
- Explicit memory management prevents gradual memory leaks
- State machine prevents race conditions (no gen during swap, no swap during gen)
- Utility models (RMBG) remain available regardless of diffusers swap state
- LRU cache on 48GB hardware eliminates swap latency for common model pairs
- Observable: state transitions logged with timestamps and RAM measurements

### Negative

- Swap latency: unload (~1-2s) + load (~10-30s) = 12-32s downtime per swap
- Complexity: dual lock + state machine adds ~80 lines to server.py
- LRU cache on 48GB uses more memory (~12GB for 2 models vs ~6GB for 1)
- First request after swap may be slower (model components not yet paged in)

### Risks

| Risk | Mitigation |
|------|-----------|
| MPS empty_cache() doesn't fully reclaim memory | Measure before/after; log delta; escalate if >300MB residual |
| Race condition during swap | State machine + dual lock; integration test with concurrent requests |
| LRU eviction during burst traffic on 48GB | Only evict when state=READY (never during GENERATING) |

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Restart server to switch models | Unacceptable UX; 30s+ cold restart, loses active connections |
| Load all models at startup | OOM on 24GB (two pipelines = 10-12GB + system = over limit) |
| Separate process per model | Memory isolation good, but IPC complexity and 2x base overhead |
| ZPix pipe_is_busy flag (no state machine) | Insufficient for async; race conditions with concurrent HTTP |

## Compliance

- **Gate**: `peak_ram_mb <= baseline_mb + 300` within 5s of swap completion
- **85% RAM cap**: Total process memory must not exceed 85% of physical RAM
- **Swap-model scope**: Only `diffusers` and `custom` model types are swappable
- **Rollback**: If swap fails, server returns to IDLE state (no partial pipeline)
- **Kill switch**: `INFERENCE_ENGINE=mflux` bypasses hot-swap entirely

---

*NQH Creative Studio (OGA) | ADR-003 | Approved 2026-05-05*
