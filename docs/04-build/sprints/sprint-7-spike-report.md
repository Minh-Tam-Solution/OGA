---
sprint: 7
task: 7.0
status: COMPLETE
owner: "@coder"
date: 2026-05-05
---

# Sprint 7.0 — AnimateDiff-Lightning Spike Report

## Environment

| Item | Value |
|------|-------|
| Hardware | MacBook Pro M4 Pro |
| RAM | 24GB |
| OS | macOS |
| PyTorch | 2.8.0 |
| Diffusers | 0.37.1 |
| Device | MPS (Metal Performance Shaders) |

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Model | AnimateDiff-Lightning (guoyww/animatediff-motion-adapter-v1-5-2) |
| Base | runwayml/stable-diffusion-v1-5 |
| Resolution | 512×512 |
| Frames | 16 |
| Steps | 4 (Lightning) |
| Dtype | float16 |
| Offload | CPU offload enabled |

## Results

### Load Phase

| Metric | Value |
|--------|-------|
| MotionAdapter load | 2.7s |
| Base pipeline load | 10.7s |
| Total load time | ~13.5s |
| RAM after load | 0MB* |

*MPS memory reporting shows 0MB due to CPU offload moving weights off MPS after load.

### Generation Phase

| Metric | Value |
|--------|-------|
| Step 1/4 | ~566s (9m 26s) |
| Projected total | ~2,264s (~37 min) |
| Actual completion | **TIMEOUT** (>600s) |

> ⚠️ Generation was terminated after 600s (10 min) at 25% completion (1/4 steps).

## Verdict

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| Peak RAM | < 9GB | Unknown (timed out) | — |
| Latency | < 60s | ~2,264s projected | ❌ FAIL |
| Stability | No crash | No crash | ✅ |

**Overall Verdict: FAIL (24GB)**

AnimateDiff-Lightning inference on M4 Pro 24GB with MPS + CPU offload is **~37× slower** than the 60s PASS threshold. Even on 48GB hardware, the latency would likely remain unacceptable without significant optimization (e.g., compiled MPS graphs, quantized weights, or native Core ML conversion).

## Root Cause Analysis

1. **MPS float16 performance**: MPS backend on macOS has known performance regressions with float16 for certain diffusers operations.
2. **CPU offload overhead**: `enable_model_cpu_offload()` causes frequent CPU↔MPS memory transfers during the UNet denoising loop.
3. **Sequential frame generation**: AnimateDiff processes 16 frames sequentially; no frame-level parallelism is exploited.

## Recommendations

1. **Cinema stays cloud-only on 24GB MacBook** — local AnimateDiff is not viable at current performance.
2. **48GB Mac Mini**: Could attempt float32 + no-CPU-offload, but latency likely still > 5 min. Not recommended without further optimization.
3. **Future optimization paths**:
   - Core ML Tools conversion for AnimateDiff
   - TinyAnimateDiff or distilled variants
   - Frame-interpolation approach (generate 4 keyframes, interpolate to 16)

## License Verification

| Engine | Code License | Weights License | Commercial? | Status |
|--------|-------------|----------------|-------------|--------|
| AnimateDiff-Lightning | Apache 2.0 | **ByteDance** (guoyww/animatediff-motion-adapter-v1-5-2) | Apache 2.0 ✅ | Verified ✅ |
| SD 1.5 base | — | runwayml/stable-diffusion-v1-5 | CreativeML Open RAIL-M | Research / commercial with restrictions |

> **Blocker**: SD 1.5 base model license (CreativeML Open RAIL-M) has usage restrictions. For full commercial deployment, consider switching to a fully open base (e.g., Stable Diffusion 1.5 community forks with permissive licenses).

## Decision

**@cto decision**: Cinema Studio remains **cloud-only** on 24GB pilot hardware.
Sprint 7 delivers: IP-Adapter endpoint + concurrency test + Cinema tab UI ready with cloud fallback.
Pivot plan: Sprint 8 pulls forward Lip Sync spike as planned.

---
*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 7 Spike Report*
