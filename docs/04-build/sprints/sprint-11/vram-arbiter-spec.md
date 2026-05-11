# VRAM Arbiter Specification (Draft)
## Sprint 11 — OGA + IndexTTS Coexistence Protocol

| Field | Value |
|-------|-------|
| **Doc ID** | SPEC-VRAM-001 |
| **Status** | Draft — pending @cto review |
| **Author** | @coder |
| **Date** | 2026-05-09 |
| **Applies to** | GPU Server S1 (RTX 5090 32GB) |

---

## 1. Problem Statement

GPU Server S1 runs **two AI inference systems** that both require VRAM:

| System | Pipeline | VRAM (loaded) | Idle Behavior |
|--------|----------|---------------|---------------|
| **OGA** | Wan2.1 T2V, LTX-Video, CogVideoX 5B, AnimateDiff, LivePortrait | 9–14 GB | Unloads after idle timeout |
| **IndexTTS** | IndexTTS2 TTS, optional Qwen3, OmniVoice, SFX | 4–8 GB | VRAM guard polls for free space |

**Conflict**: Without coordination, both systems may attempt to load models simultaneously, causing **CUDA OOM** and job failures.

**Current State**: IndexTTS has built-in VRAM guard, but it is **unaware of OGA's pipeline state**. OGA has idle-unload, but no signaling mechanism to notify IndexTTS.

---

## 2. Design Goals

1. **No OOM**: Guaranteed VRAM availability for the active job
2. **No starvation**: Both systems get fair access over time
3. **No code coupling**: OGA and IndexTTS remain independent deployables
4. **Fail-safe**: If arbiter fails, systems fall back to conservative behavior
5. **Observable**: All arbitration decisions are logged and measurable

---

## 3. VRAM Budget

### 3.1 Total Available

```
RTX 5090 32GB
- OS + desktop overhead:      ~1 GB
- PyTorch/CUDA cache reserve: ~2 GB
- Headroom (safety):          ~2 GB
─────────────────────────────────────
Available for models:         ~27 GB
```

### 3.2 Per-Model Footprints

| Model | Pipeline | VRAM (peak) | VRAM (typical) |
|-------|----------|-------------|----------------|
| Wan2.1 T2V 1.3B | OGA | ~13 GB | ~11 GB |
| LTX-Video | OGA | ~11 GB | ~9 GB |
| CogVideoX 5B | OGA | ~16 GB | ~14 GB |
| AnimateDiff | OGA | ~8 GB | ~6 GB |
| LivePortrait | OGA | ~6 GB | ~4 GB |
| IndexTTS2 | IndexTTS | ~6 GB | ~4-5 GB |
| Qwen3-8B GGUF | IndexTTS (optional) | ~8 GB | ~6 GB |
| OmniVoice | IndexTTS (optional) | ~6 GB | ~4 GB |
| SFX (Woosh+MusicGen) | IndexTTS (optional) | ~8 GB | ~6 GB |

### 3.3 Compatible Pairs (can run simultaneously)

| OGA Pipeline | + IndexTTS Service | Total VRAM | Headroom |
|--------------|-------------------|------------|----------|
| LTX-Video (~9GB) | IndexTTS2 (~5GB) | ~14 GB | ~13 GB ✅ |
| Wan2.1 (~11GB) | IndexTTS2 (~5GB) | ~16 GB | ~11 GB ✅ |
| CogVideoX (~14GB) | IndexTTS2 (~5GB) | ~19 GB | ~8 GB ⚠️ |
| Wan2.1 (~11GB) | Qwen3 (~6GB) | ~17 GB | ~10 GB ✅ |

**Incompatible pairs** (will OOM if simultaneous):
- CogVideoX 5B + Qwen3 (20GB + overhead > 27GB)
- Any OGA video + SFX + OmniVoice simultaneously

---

## 4. Arbitration Protocol

### 4.1 Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   OGA Server    │◄───────►│   VRAM Arbiter  │
│  (port 8000)    │  HTTP   │   (port 8765)   │
└─────────────────┘         └─────────────────┘
        ▲                           ▲
        │                           │
        │    ┌─────────────────┐    │
        └───►│  IndexTTS       │◄───┘
             │  (port 8001)    │
             └─────────────────┘
```

**The Arbiter is a lightweight FastAPI service** that tracks:
- Which system holds the GPU lock
- How much VRAM each system has reserved
- Queue of pending requests

### 4.2 State Machine

```
                    ┌───────────────┐
         ┌─────────►│    IDLE       │◄────────┐
         │          │  (no lock)    │         │
         │          └───────┬───────┘         │
         │                  │ request         │
         │                  ▼                 │
    release            ┌───────────┐     release
         │             │ ACQUIRING │          │
         │             │ (waiting) │          │
         │             └─────┬─────┘          │
         │                   │ granted        │
         │                   ▼                │
         └──────────────┐ LOCKED ◄────────────┘
                        │ (active)
                        └────┬────┘
                             │ work complete
                             ▼
```

### 4.3 API Specification

#### `POST /v1/acquire`

Request lock to load models and run inference.

```json
{
  "system": "oga" | "indextts",
  "pipeline": "wan2.1-t2v" | "ltx-video" | "cogvideox" | "indextts2" | "qwen3" | "omnivoice" | "sfx",
  "vram_mb": 11000,
  "priority": "normal" | "high",
  "timeout_seconds": 300,
  "job_id": "uuid"
}
```

Response:
```json
{
  "status": "granted" | "queued" | "timeout",
  "lock_id": "uuid",
  "expires_at": "2026-05-09T07:00:00Z",
  "queue_position": 0
}
```

#### `POST /v1/release`

Release lock when work is complete or models unloaded.

```json
{
  "lock_id": "uuid"
}
```

#### `GET /v1/status`

Current arbiter state.

```json
{
  "state": "idle" | "locked",
  "holder": "oga" | "indextts" | null,
  "pipeline": "wan2.1-t2v",
  "vram_reserved_mb": 11000,
  "queue_length": 2,
  "queue": [
    {"system": "indextts", "pipeline": "indextts2", "queued_at": "..."}
  ]
}
```

### 4.4 Sequential Scheduling Rule (HARD RULE)

**RULE-VRAM-001**: Only **ONE** GPU-heavy model may be loaded at any time.

| Holder Type | Must Unload Before Releasing? | Notes |
|-------------|------------------------------|-------|
| OGA video pipeline | ✅ Yes | `pipe.enable_model_cpu_offload()` + explicit `del pipe` |
| IndexTTS2 | ✅ Yes | `POST /api/runtime/tts/unload` |
| Script-LLM (Qwen3) | ❌ No | CPU-only, negligible VRAM |
| OmniVoice | N/A | Removed from deployment |

**Implementation**:
```python
# In OGA server.py pipeline loader
async def load_pipeline(pipeline_name):
    await arbiter.acquire(...)
    # unload any previous pipeline first
    if current_pipeline:
        await unload_pipeline(current_pipeline)
    # ... load new pipeline ...

# In IndexTTS backend before generation
async def before_generate():
    lock = await arbiter.acquire(...)
    # backend ensures model is loaded; if not, loads it
    # on completion, model MAY stay loaded for next request
    # BUT must unload if lock expires or another system requests GPU
```

### 4.5 Lock Expiry

- Locks auto-expire after `timeout_seconds` (default 300s = 5 min)
- Holder may request extension via `POST /v1/extend`
- If holder crashes, lock expires and next queued request is granted
- **On expiry or preemption: holder MUST unload GPU model before releasing**

### 4.5 Priority Rules

1. **FIFO within same priority** — first request wins
2. **High priority** can preempt normal priority after current job completes (not during)
3. **Starvation prevention** — if a system has been queued > 60s, its next request gets automatic priority boost

### 4.6 Preemption (Emergency)

If a critical job must run immediately:
- `POST /v1/acquire` with `"priority": "critical"`
- Arbiter sends **SIGTERM** to current holder's inference process
- Current holder has 30s grace period to checkpoint and release
- If not released, arbiter sends **SIGKILL** and grants critical lock

**Usage**: Emergency bug fix, demo deadline, etc. Logged with full audit trail.

### 4.7 Error Response Schema

#### HTTP 503 — GPU Busy (Queue Full or Timeout)

```json
{
  "error": "GPU_UNAVAILABLE",
  "message": "GPU is currently locked by another system. Your request has been queued.",
  "details": {
    "current_holder": "oga",
    "current_pipeline": "wan2.1-t2v",
    "queue_position": 1,
    "queue_length": 3,
    "estimated_wait_seconds": 145,
    "retry_after_seconds": 30,
    "max_wait_seconds": 300,
    "retry_endpoint": "GET /v1/status"
  }
}
```

#### HTTP 429 — Rate Limited

```json
{
  "error": "RATE_LIMITED",
  "message": "Too many acquire requests from this system. Please wait for current lock to complete.",
  "details": {
    "retry_after_seconds": 60
  }
}
```

#### HTTP 409 — Lock Already Held

```json
{
  "error": "LOCK_ALREADY_HELD",
  "message": "This system already holds the GPU lock. Release before acquiring again.",
  "details": {
    "current_lock_id": "uuid",
    "expires_at": "2026-05-09T07:00:00Z"
  }
}
```

### 4.8 Queue Ordering Policy

**Default: FIFO within priority tier**

```
Queue order:
1. critical  (emergency preemption)
2. high      (user-initiated, paid tier)
3. normal    (default)
4. low       (background batch jobs)
```

**Priority boost (starvation prevention)**:
- Any request queued > 60s gets automatic priority +1 tier
- Boost applies once per request
- Maximum boost: normal → high (cannot reach critical)

**Max queue size**: 10 requests
- Queue full → HTTP 503 with `retry_after_seconds: 60`
- Clients should back off exponentially: 1s → 2s → 4s → 8s → max 60s

### 4.9 Client Retry Guidance

**Recommended retry loop**:
```python
async def generate_with_arbiter(text):
    for attempt in range(5):
        lock = await arbiter.acquire(
            system="indextts",
            pipeline="indextts2",
            vram_mb=21000,
            timeout_seconds=300
        )
        if lock.status == "granted":
            try:
                return await tts.generate(text)
            finally:
                await arbiter.release(lock.lock_id)
        elif lock.status == "queued":
            wait = min(lock.estimated_wait_seconds or 30, 60)
            await asyncio.sleep(wait)
        elif lock.status == "timeout":
            raise GPUUnavailableError("Timeout waiting for GPU")
    raise GPUUnavailableError("Max retries exceeded")
```

**UI guidance**: When TTS is blocked by video generation, show:
- Queue position: "You are #2 in line"
- ETA: "Estimated wait: ~2 min 30 sec"
- Progress of current holder: "Video generation in progress (67%)"
- Cancel option: "Cancel and try later"

---

## 5. UX Queue Design (B4 — TTS-Blocked-by-Video)

### 5.0 User Experience Flow

```
User clicks "Generate TTS"
  └── Arbiter returns 503 (GPU locked by video)
      └── UI shows:
          ┌─────────────────────────────────────────┐
          │  ⏳ GPU is busy with video generation   │
          │                                         │
          │  Queue position: #2                     │
          │  Estimated wait: ~2 min 30 sec          │
          │                                         │
          │  Current: Wan2.1 — "Sunset beach..."    │
          │  Progress: ████████░░ 67%               │
          │                                         │
          │  [Cancel]  [Notify me when ready]       │
          └─────────────────────────────────────────┘
```

**ETA calculation**:
```
ETA_seconds = remaining_video_gen_time
            + video_unload_time (~5s)
            + tts_load_time (~10s)
            + tts_generation_time (text_length * 0.2s)
```

**Polling interval**: 5s for active wait, 30s for background wait

**Notification**: Browser push notification when lock granted + WebSocket update

---

## 6. Integration Points

### 5.1 OGA Server (`local-server/server.py`)

**Before pipeline load**:
```python
async def load_pipeline(pipeline_name):
    lock = await arbiter.acquire(
        system="oga",
        pipeline=pipeline_name,
        vram_mb=VRAM_REQUIREMENTS[pipeline_name],
        timeout_seconds=600  # Video generation can take 5-10 min
    )
    if lock.status != "granted":
        raise GPUUnavailableError(f"GPU busy: {lock.queue_position} ahead")
    try:
        # ... load and run pipeline ...
    finally:
        await arbiter.release(lock.lock_id)
```

**After idle timeout unloads model**:
```python
async def unload_idle_pipeline():
    await arbiter.release(current_lock_id)
    current_lock_id = None
```

### 5.2 IndexTTS Backend

IndexTTS already has VRAM guard (`INDTEXTS_VRAM_GUARD_ENABLED`). Two integration options:

**Option A: Wrap IndexTTS's VRAM guard** (Recommended)

Add a small middleware that calls the arbiter BEFORE IndexTTS's internal guard:

```python
# In IndexTTS backend startup
async def before_model_load(pipeline):
    lock = await arbiter.acquire(
        system="indextts",
        pipeline=pipeline,
        vram_mb=VRAM_REQUIREMENTS[pipeline],
        timeout_seconds=120
    )
    return lock
```

This requires a **minimal patch** to IndexTTS's backend container (or a sidecar proxy).

**Option B: External coordination via environment**

OGA writes a "GPU busy" flag to a shared file/socket. IndexTTS's VRAM guard checks this flag and waits.

```bash
# OGA sets flag before loading
export OGA_GPU_BUSY=1
# IndexTTS VRAM guard sees flag, waits
# OGA unsets flag after unload
export OGA_GPU_BUSY=0
```

Simpler but less robust (no queue, no expiry, no logging).

### 5.3 Fallback Behavior

If arbiter is unreachable:
- **OGA**: Fall back to current behavior (load if VRAM available, let PyTorch handle OOM)
- **IndexTTS**: Fall back to built-in VRAM guard (poll `nvidia-smi`)
- Log warning: `Arbiter unreachable, operating in fallback mode`

---

## 7. Deployment

### 6.1 Arbiter Service

```yaml
# docker-compose.arbiter.yml
services:
  vram-arbiter:
    image: oga/vram-arbiter:latest  # Build from Dockerfile
    container_name: oga-vram-arbiter
    ports:
      - "8765:8765"
    volumes:
      - /var/log/oga:/var/log/oga
    environment:
      ARBITER_PORT: 8765
      ARBITER_LOG_LEVEL: INFO
      ARBITER_DEFAULT_TIMEOUT_SECONDS: 300
      ARBITER_MAX_QUEUE_SIZE: 10
    restart: unless-stopped
```

### 6.2 Resource Requirements

- **CPU**: Negligible (< 1%)
- **RAM**: ~50 MB
- **Network**: Localhost only
- **Disk**: Log rotation (100 MB max)

### 6.3 Monitoring

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Queue length | `GET /v1/status` | > 3 for > 2 min |
| Lock wait time | Logs | > 60s average |
| Lock expiry count | Logs | > 0 in 1 hour |
| Preemption count | Logs | > 0 in 24 hours |
| Arbiter health | `GET /health` | HTTP != 200 |

---

## 8. Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. Central Arbiter** (this spec) | Full coordination, logging, queue | Extra service to maintain | ✅ Recommended |
| B. Docker resource limits | Simple, no code | No queue, no fairness, coarse | ❌ Rejected |
| C. Time-sliced scheduling | Predictable | Inflexible, wastes GPU during off-peak | ❌ Rejected |
| D. Separate GPU cards | True isolation | Expensive, S1 has 1 GPU | ❌ Rejected |
| E. IndexTTS-only VRAM guard | No new code | OGA invisible, conflicts persist | ❌ Rejected |

---

## 9. Open Questions

1. **Should arbiter support >2 systems?** (e.g., future MOP tools) → Yes, design is extensible.
2. **Should arbiter be deployed on S1 or a separate micro-VM?** → S1 localhost to minimize latency.
3. **How to handle multi-GPU future?** → Extend `acquire` API with `gpu_id` parameter.
4. **Should we use Redis instead of in-memory state?** → In-memory is sufficient for 2-system, 1-GPU case. Redis adds complexity.

---

## 10. Next Steps

1. **@cto review** — Approve/revise spec before implementation
2. **Implement arbiter** — FastAPI service (~200 lines)
3. **Integrate OGA** — Hook into `server.py` pipeline loader
4. **Integrate IndexTTS** — Patch or sidecar for backend VRAM guard
5. **Test** — Simulate concurrent requests, verify no OOM
6. **Document** — Add to ops runbook

---

*End of SPEC-VRAM-001*
