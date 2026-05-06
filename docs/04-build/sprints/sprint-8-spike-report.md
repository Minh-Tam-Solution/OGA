---
sprint: 8
task: 8.0
status: COMPLETE
owner: "@coder"
date: 2026-05-05
---

# Sprint 8.0 — LivePortrait Spike Report

## Objective

Test LivePortrait (MIT) for audio-driven lip-sync inference on MacBook M4 Pro 24GB.

## Environment

| Item | Value |
|------|-------|
| Hardware | MacBook Pro M4 Pro |
| RAM | 24GB |
| OS | macOS |
| PyTorch | 2.10.0 |
| Device | MPS (Metal Performance Shaders) |

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Model | LivePortrait (KwaiVGI/LivePortrait) |
| Weights | ~608MB (human base models) |
| Dtype | fp16 (flag_use_half_precision=True) |
| Test input | Synthetic portrait + 2-frame driving video |

## Results

### Installation

| Metric | Result |
|--------|--------|
| Module import | ✅ Success |
| Model download | ✅ 6 files, ~608MB |

### Model Loading

| Metric | Value |
|--------|-------|
| Load time | 1263.1s *(cold — first download + JIT compile)* |
| RAM after load | 497MB |

> **CPO Feedback Annotation**: The 1263.1s load time represents a **cold start**
> including model download (~608MB) and MPS kernel compilation. Subsequent loads
> would be significantly faster (~30–60s) if the model is cached. The 0.0s inference
> time is anomalous — likely due to the very short 2-frame test video and timing
> resolution. A realistic 5s video at 25fps would take proportionally longer.

### Video-Driven Inference

| Metric | Value |
|--------|-------|
| Inference time | ~0.0s *(2-frame test only — not representative)* |
| RAM after inference | 497MB |

### Audio-Driven Lip-Sync

| Metric | Result |
|--------|--------|
| Audio input support | ❌ **NOT SUPPORTED** |

## Critical Finding

**LivePortrait is a VIDEO-DRIVEN portrait animation model, not an audio-driven lip-sync model.**

It animates a source portrait using facial motion extracted from a **driving video**.
It does not accept audio input. Audio-driven lip-sync is not a native capability.

### Native Capabilities

| Feature | Supported |
|---------|-----------|
| Image + Driving Video → Animated video | ✅ Yes |
| Lip retargeting (manual control) | ✅ Yes |
| Audio → Lip-synced video | ❌ **No** |

### What Would Be Required

To achieve audio-driven lip-sync with LivePortrait, a multi-model pipeline is needed:

1. Audio feature extraction (e.g., mel-spectrogram)
2. Audio-to-landmark model (e.g., Wav2Lip, EMOCA)
3. Generate driving video from predicted landmarks
4. Feed driving video into LivePortrait for rendering

This is significantly more complex than a single-model solution.

## Verdict

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| Audio-driven lip-sync | Must work | Not supported | ❌ FAIL |
| RAM | < 8GB | ~497MB | ✅ (irrelevant) |
| Latency | < 30s | ~0.0s | ✅ (irrelevant) |

**Overall Verdict: FAIL**

LivePortrait cannot fulfill the audio-driven lip-sync requirement for Sprint 8.

## Recommendations

1. **Lip Sync Studio stays cloud-only for Sprint 8**
2. **Activate Lip Sync tab** with cloud-only banner (same pattern as Cinema Studio)
3. **Sprint 9 pivot**: Spike a purpose-built audio-driven lip-sync model:
   - **Wav2Lip** (MIT license, proven, widely used)
   - **MuseTalk** (MIT license, real-time capable)
   - **SadTalker** (MIT license, audio-driven talking head)

## License Verification

| Component | License | Commercial? |
|-----------|---------|-------------|
| LivePortrait | MIT | ✅ Yes |
| RetinaFace (MIT alternative) | MIT | ✅ Yes |
| InsightFace (default detector) | Non-commercial | ❌ Rejected |

> Note: Even though LivePortrait itself is MIT-licensed, its native face detector
> dependency (InsightFace) is non-commercial. The RetinaFace adapter approach
> (specified in ADR-005) is correct for commercial use, but irrelevant since
> LivePortrait does not support the required use case.

---
*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 8 Spike Report*
