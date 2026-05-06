---
adr_id: ADR-005
title: "Lip Sync Architecture — LivePortrait with MIT Face Detection"
status: Proposed
date: 2026-05-05
deciders: ["@cto"]
gate: G2
references:
  - ADR-003 (hot-swap architecture)
  - TS-003 (pipeline hot-swap mechanism)
  - Sprint 7 spike report (AnimateDiff FAIL — latency learnings)
---

# ADR-005: Lip Sync Architecture

## Status

**Proposed** — pending @cto review.

## Context

Lip Sync Studio needs a local inference engine for generating lip-synced videos
from portrait images/videos + audio input. The primary candidate is LivePortrait
(MIT license), but its default dependency on InsightFace for face detection creates
a commercial license risk (InsightFace = non-commercial).

### Constraints

1. **License**: All components must be commercially safe (no NC/RAIL restrictions)
2. **RAM**: Must fit within 24GB pilot (< 8GB peak) or 48GB production
3. **Latency**: < 30s for 5s video (PASS threshold)
4. **Architecture**: Must integrate with Sprint 6 hot-swap state machine (ADR-003)
5. **Non-diffusers**: LivePortrait is custom PyTorch, not a diffusers pipeline

### Sprint 7 Learnings

AnimateDiff spike failed at 37x over latency threshold due to:
- MPS + CPU offload memory transfer overhead
- Sequential frame processing without parallelism
- float16 numerical issues on MPS

LivePortrait risk profile differs:
- Smaller model (face-specific, not general image generation)
- Fewer sequential steps than AnimateDiff's denoising loop
- But: video frame generation is still sequential

## Decision

### Engine: LivePortrait (MIT)

LivePortrait generates lip-synced video by:
1. Detecting face landmarks in source image
2. Extracting motion parameters from driving audio
3. Rendering face with new lip movements frame-by-frame
4. Compositing face back into original image/video

### Face Detection: RetinaFace (MIT)

Replace InsightFace detector with RetinaFace:

| Detector | License | Accuracy | Speed | Decision |
|----------|---------|----------|-------|----------|
| InsightFace | Non-commercial ❌ | High | Fast | **Rejected** — NC license |
| RetinaFace | MIT ✅ | High | Fast | **Primary** |
| MediaPipe Face | Apache 2.0 ✅ | Medium | Very fast | **Fallback** |

Adapter pattern: wrap RetinaFace to match LivePortrait's expected detector API:
```python
class RetinaFaceAdapter:
    """Adapts RetinaFace output to LivePortrait's expected format."""
    def detect(self, image) -> list[FaceInfo]:
        # RetinaFace returns bboxes + landmarks
        # Convert to LivePortrait's FaceInfo format
        ...
```

### model_type: "custom"

LivePortrait is not a diffusers pipeline. It uses custom PyTorch modules.
ADR-003 defines `model_type: "custom"` for this case:

- Swappable via hot-swap endpoint (same state machine)
- Custom loading path: `load_liveportrait_pipeline()` instead of `from_pretrained()`
- Lazy-load pattern: load on first lip-sync request, unload after completion
- Uses `_gen_lock` during inference (same concurrency protection)

### Memory Strategy

Based on Sprint 7 IP-Adapter learnings (lazy-load works well on 24GB):

| Hardware | Strategy |
|----------|----------|
| 24GB MacBook | Lazy-load: load LivePortrait on request, unload after, free RAM for other pipelines |
| 48GB Mac Mini | Semi-resident: keep loaded if RAM available, LRU evict if needed |

### Audio Processing

- Accept: WAV, MP3, M4A (via torchaudio, BSD license)
- Resample to 16kHz mono before inference
- Max duration: 30s (prevents memory exhaustion on long audio)
- Pre-process audio before model load to minimize loaded time

## Consequences

### Positive

- Full MIT/Apache 2.0 stack — no commercial license risk
- Integrates with existing hot-swap state machine (no new infra)
- Lazy-load pattern proven by Sprint 7 IP-Adapter
- LipSyncStudio.jsx already complete — just wiring

### Negative

- RetinaFace adapter adds ~50 lines of glue code
- LivePortrait model weights (~500MB) need download on first use
- Custom loading path adds complexity vs diffusers `from_pretrained()`
- Latency risk on MPS (learned from AnimateDiff spike failure)

### Risks

| Risk | Mitigation |
|------|-----------|
| LivePortrait latency on MPS (AnimateDiff pattern) | Spike protocol: 2-day max, 3-tier result |
| RetinaFace accuracy insufficient | MediaPipe fallback (Apache 2.0) |
| torchaudio/LivePortrait dep conflict | Pin versions; isolate if needed |
| bf16 not supported by LivePortrait | Fall back to fp32 with higher RAM |

---

*NQH Creative Studio (OGA) | ADR-005 | Proposed 2026-05-05*
