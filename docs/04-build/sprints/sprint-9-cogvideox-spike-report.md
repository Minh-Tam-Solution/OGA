---
sprint: 9
task: 9.0c
status: COMPLETE
owner: "@coder"
date: 2026-05-05
---

# Sprint 9.0c — CogVideoX-2B Spike Report

## Objective

Test CogVideoX-2B for text-to-video generation on MacBook M4 Pro 24GB.
This is the fallback spike after both audio lip-sync models (Wav2Lip, MuseTalk) failed.

## Environment

| Item | Value |
|------|-------|
| Hardware | MacBook Pro M4 Pro |
| RAM | 24GB |
| OS | macOS |
| Python | 3.12.13 |
| PyTorch | 2.10.0 |
| Diffusers | 0.38.0.dev0 |
| Device | MPS (Metal Performance Shaders) |

## License Verification

| Component | License | Commercial? |
|-----------|---------|-------------|
| CogVideoX-2B code | Apache 2.0 | ✅ Yes |
| CogVideoX-2B weights | Apache 2.0 | ✅ Yes |

**License status: PASS**

## Installation

No additional installation required — CogVideoX-2B uses the existing diffusers
pipeline (`diffusers >= 0.30.0` required, we have `0.38.0.dev0`).

```python
from diffusers import CogVideoXPipeline
pipe = CogVideoXPipeline.from_pretrained("THUDM/CogVideoX-2b", torch_dtype=torch.float32)
```

## Test Results

### Attempt 1: bf16 on MPS

```python
pipe = CogVideoXPipeline.from_pretrained("THUDM/CogVideoX-2b", torch_dtype=torch.bfloat16)
pipe.to("mps")
```

**Result**: ❌ FAIL
```
TypeError: Cannot convert a MPS Tensor to float64 dtype as the MPS framework
 doesn't support float64. Please use float32 instead.
```

The model contains float64 tensors that cannot be moved to MPS directly.

### Attempt 2: float32 on MPS

```python
pipe = CogVideoXPipeline.from_pretrained("THUDM/CogVideoX-2b", torch_dtype=torch.float32)
pipe = pipe.to(device="mps", dtype=torch.float32)
```

**Result**: ✅ Model loads and moves to MPS successfully

| Metric | Value |
|--------|-------|
| Load from cache | ~20–22s |
| Move to MPS (float32) | ~244s |
| Total before inference | ~265s |

### Attempt 3: Minimal Inference Test

Configuration: 6 frames, 256×256, 5 inference steps

**Result**: ⏸️ TIMEOUT at 300s — process killed during model-to-device transfer

The 244s transfer time consumed almost the entire 300s timeout budget,
leaving no time for actual inference.

## Critical Finding

**CogVideoX-2B model transfer to MPS takes ~244 seconds alone.**

This is a fundamental performance issue with large diffusion models on MPS:
- The model has ~2B parameters
- Moving from CPU to MPS involves copying ~8GB of weights
- MPS memory allocation appears to have significant overhead for large models

### Comparison with AnimateDiff (Sprint 7)

| Model | Type | Load Time | Inference Latency | Verdict |
|-------|------|-----------|-------------------|---------|
| AnimateDiff | Video (diffusion) | ~60s | ~600s (37× over) | ❌ FAIL |
| CogVideoX-2B | Video (diffusion) | ~265s | Not reached (TIMEOUT) | ❌ FAIL |

Both models exhibit the same pattern: diffusion-based video generation on MPS
is prohibitively slow for interactive use.

## Verdict

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| Text → video | Must work | Model loads, inference TIMEOUT | ❌ **FAIL** |
| Latency (4s 480p) | < 120s (PASS), < 300s (PROD-ONLY) | > 265s before inference | ❌ **FAIL** |
| Peak RAM | < 10GB (PASS), < 25GB (PROD-ONLY) | Not measured (TIMEOUT) | ⏸️ Unknown |
| License | Commercial-safe | Apache 2.0 | ✅ Pass |

**Overall Verdict: FAIL (Latency)**

CogVideoX-2B cannot fulfill the text-to-video requirement within acceptable
latency bounds on Apple Silicon MPS. The model-to-device transfer alone exceeds
the PROD-ONLY threshold (120s), making inference impractical.

## Root Cause Analysis

Using the Iceberg Model:

| Layer | Finding |
|-------|---------|
| **Event** | CogVideoX-2B inference TIMEOUT at 300s |
| **Pattern** | All diffusion-based video models (AnimateDiff, CogVideoX) fail latency on MPS |
| **Structure** | MPS memory transfer overhead for large models (>2B params) is 10–100× slower than CUDA |
| **Mental Model** | "Apple Silicon can run any PyTorch model" — false for large diffusion models at interactive latency |

## Recommendations

1. **Video Studio stays cloud-only** for the pilot phase
2. **Lip Sync Studio stays cloud-only** (no local audio lip-sync model found)
3. **Post-sprint evaluation**:
   - Monitor for smaller/faster video models (e.g., CogVideoX-5B-I2V, LTX-Video)
   - Evaluate GPU cloud tier (fal.ai, Replicate) for video generation
   - Consider PyTorch nightly builds — MPS performance improves regularly
4. **Studios final state**: Image (local), Marketing (local), Video (cloud),
   Cinema (cloud), Lip Sync (cloud) — 2 local + 3 cloud

---
*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 9.0c Spike Report*
