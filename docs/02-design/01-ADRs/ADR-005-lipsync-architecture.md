---
adr_id: ADR-005
title: "Lip Sync Architecture — Audio-Driven Models (Revised Post-Sprint 9)"
status: Accepted
date: 2026-05-05
revised: 2026-05-06
deciders: ["@cto"]
gate: G2
references:
  - ADR-003 (hot-swap architecture)
  - TS-003 (pipeline hot-swap mechanism)
  - Sprint 8 spike report (LivePortrait FAIL — video-driven, not audio-driven)
  - Sprint 9 spike reports (Wav2Lip FAIL license, MuseTalk FAIL deps)
---

# ADR-005: Lip Sync Architecture (Revised)

## Status

**Accepted** — revised after Sprint 9 dual spike results.

## Revision History

| Date | Revision | Reason |
|------|----------|--------|
| 2026-05-05 | v1.0 | Initial ADR — LivePortrait + RetinaFace |
| 2026-05-05 | v2.0 | Revised — all audio lip-sync models failed; Lip Sync stays cloud-only |
| 2026-05-06 | v2.1 | CogVideoX 5B spike passed; Video Studio now local-first with async queue |

## Context

Lip Sync Studio needs a local inference engine for generating lip-synced videos
from portrait images/videos + audio input.

### Spike Results (Sprints 8–9)

| Model | Type | License | Result | Blocker |
|-------|------|---------|--------|---------|
| LivePortrait | Video-driven | MIT | ❌ FAIL | Does NOT accept audio input |
| Wav2Lip | Audio-driven | ❌ None | ❌ FAIL | All rights reserved (no LICENSE) |
| MuseTalk | Audio-driven | MIT + Apache 2.0 | ❌ FAIL | mmpose/mmcv build failure on macOS |
| SadTalker | Audio-driven | MIT | ⏸️ Not spiked | Similar dependency profile to MuseTalk |
| CogVideoX-5B | Text-to-video | Apache 2.0 | ✅ PASS | Video Studio local (5B, float16, 16 frames, 720×480) |

### Constraints

1. **License**: All components must be commercially safe (no NC/RAIL restrictions)
2. **RAM**: Must fit within 24GB pilot (< 8GB peak) or 48GB production
3. **Latency**: < 30s for 5s video (PASS threshold)
4. **Architecture**: Must integrate with Sprint 6 hot-swap state machine (ADR-003)
5. **Audio input**: Must accept audio file + image/video → lip-synced video

## Decision

### v2.0 Decision: Lip Sync — Cloud-Only

**No locally-runnable audio-driven lip-sync model was found that meets all criteria.**

| Criterion | Wav2Lip | MuseTalk | LivePortrait |
|-----------|---------|----------|--------------|
| Audio input | ✅ Yes | ✅ Yes | ❌ No |
| License | ❌ NC | ✅ OK | ✅ OK |
| Runs on macOS | Not tested | ❌ No (deps) | ✅ Yes |
| Commercial use | ❌ No | ✅ Yes | ✅ Yes |

**Result**: Lip Sync Studio remains **cloud-only** for the pilot phase.

### Cloud-Only Pattern

The cloud-only pattern (established in Sprint 7 for Cinema Studio) is applied:

```jsx
// LipSyncStudio.jsx
{isLocal && (
  <div className="cloud-only-banner">
    Lip Sync is cloud-only on this device
  </div>
)}
```

- `isLocal` prop: `true` when `NEXT_PUBLIC_LOCAL_MODE === 'true'`
- Local mode: shows banner + instructions to use cloud
- Cloud mode: full functionality via API

### Video Studio — CogVideoX 5B Local-First

The CogVideoX 5B spike passed. Video Studio now operates with a local/cloud toggle:

| Mode | Engine | Input | Status |
|------|--------|-------|--------|
| Local | CogVideoX 5B | Text prompt → Video (16 frames, 720×480 max) | ✅ Active |
| Cloud | muapi.ai / fal.ai / Replicate | Text/Image → Video | Available when cloud mode enabled |

This is **not** lip-sync but adds local video generation capability via async job queue to avoid 504 timeouts.

### Future Re-evaluation

| Trigger | Action |
|---------|--------|
| New audio lip-sync model released | Re-spike with 2-day protocol |
| Docker/Python 3.10 environment available | Re-test MuseTalk |
| GPU cloud tier (fal.ai) | Evaluate cloud lip-sync pricing |

## Consequences

### Positive

- No license risk — all evaluated models properly vetted
- No dependency hell in production venv
- Cloud-only pattern proven stable (Cinema Studio since Sprint 7)
- CogVideoX 5B is now integrated with async job queue (15 min max polling)

### Negative

- Lip Sync requires internet connection
- Cloud API costs for lip-sync generation
- User experience gap: local image generation but cloud lip-sync

### Risks

| Risk | Mitigation |
|------|-----------|
| No local lip-sync forever | Monitor model releases monthly; re-spike when viable |
| Cloud API downtime | Graceful degradation with user messaging |
| CogVideoX also fails | Video stays cloud-only; 2 local image + 1 local video + 2 cloud studios still valid |

---

*NQH Creative Studio (OGA) | ADR-005 v2.0 | Accepted 2026-05-05*
