---
sprint: 8
status: PLANNED
start_date: 2026-05-26
planned_duration: 2 weeks
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto"]
  trigger: "Sprint 7 closed — Cinema spike FAIL, pivot to Lip Sync per approved plan"
branch: "sprint-8/lip-sync"
baseline_commit: "HEAD"
rollback: "git checkout main"
---

# Sprint 8 — Lip Sync Studio (LivePortrait — Conditional)

**Sprint**: 8 | **Phase**: Phase A (Studios Activation)
**Previous**: Sprint 7 (IP-Adapter + Cinema cloud-only)
**Branch**: `sprint-8/lip-sync` (off `main@HEAD`)

---

## Sprint Goal

Activate the Lip Sync Studio with local LivePortrait inference. Spike first to
validate RAM/latency on MacBook 24GB. If spike passes, wire LipSyncStudio.jsx
(already complete with full cloud UI) to local LivePortrait endpoint.

---

## Context

### What Already Exists
- **LipSyncStudio.jsx**: Full cloud UI (1087 lines) — dual mode (Image + Video),
  8 cloud models, file upload, history gallery, fullscreen viewer
- **muapi.js**: `processLipSync()` already wired to cloud endpoints
- **models.js**: 8 lip sync models defined (3 image-to-video, 5 video-to-video)
- **StandaloneShell.js**: `comingSoon: _isLocal` — tab hidden in local mode only

### What Needs Building
- LivePortrait inference endpoint in `server.py`
- Face detection with MIT-licensed detector (not InsightFace)
- Audio + image/video → lip-synced video pipeline
- Local/cloud toggle in LipSyncStudio.jsx

### Sprint 7 Learnings Applied
- AnimateDiff spike FAILED due to MPS + CPU offload latency (37× over threshold)
- IP-Adapter lazy-load pattern (load per request, unload after) works well on 24GB
- Concurrency protection (dual locks) proven by runtime tests
- bf16 preferred over fp16 on MPS (ZPix handoff)

---

## Pre-Sprint: Spike Protocol (2 days max)

### Target
LivePortrait on MacBook M4 Pro 24GB with MPS.

### Pass Criteria (3-Tier)

| Result | Condition | Action |
|--------|-----------|--------|
| **PASS (24GB)** | peak RAM < 8GB, latency < 30s for 5s video, face detection works | Enable local on both pilot + prod |
| **PROD-ONLY** | peak RAM 8-20GB, or latency 30-120s | Local on Mac Mini 48GB only, cloud on MacBook |
| **FAIL** | OOM, crash, or latency > 120s | Lip Sync stays cloud-only, pivot to Video local spike |

### Spike Tasks

1. Install LivePortrait from source (MIT license)
2. Install face detector: **RetinaFace (MIT)** — NOT InsightFace (NC risk)
3. Test on MacBook 24GB: single image + 5s audio → lip-synced video
4. Measure: peak MPS RAM, latency, output quality, face detection accuracy
5. Test with bf16 dtype (ZPix recommendation)
6. Report results to @cto before sprint planning proceeds

### License Gate (Must resolve BEFORE spike)

| Component | License | Commercial? | Decision |
|-----------|---------|-------------|----------|
| LivePortrait code | MIT | YES ✅ | Use |
| LivePortrait detector | InsightFace = NC risk | NO ❌ | **Swap to RetinaFace** |
| RetinaFace | MIT | YES ✅ | Use as replacement |
| Audio processing | torchaudio (BSD) | YES ✅ | Use |

**Blocker**: If RetinaFace face detection accuracy is insufficient (< 90% on test set),
evaluate MediaPipe Face Detection (Apache 2.0) as alternative.

### Owner: @coder
### Deadline: 2 days from sprint start

---

## Backlog (Priority Order)

| Task | Description | Priority | Points | Owner | Condition |
|------|-------------|----------|--------|-------|-----------|
| 8.0 | **Spike: LivePortrait** on MacBook 24GB — face detection + lip sync quality | P0 | 3 | @coder | — |
| 8.1 | **LivePortrait endpoint**: `POST /api/v1/lip-sync` — image/video + audio → video | P0 | 8 | @coder | Spike PASS or PROD-ONLY |
| 8.2 | **Face detection**: RetinaFace (MIT) integration, replace InsightFace dependency | P0 | 3 | @coder | Spike PASS or PROD-ONLY |
| 8.3 | **Lip Sync tab activation** — wire LipSyncStudio.jsx to local endpoint | P1 | 3 | @coder | Spike PASS or PROD-ONLY |
| 8.4 | **VibeVoice TTS integration** — text → speech → lip sync pipeline | P2 | 5 | @coder | Spike PASS or PROD-ONLY |
| 8.5 | **Tests** — LivePortrait, face detection, endpoint contract | Gate | 3 | @coder | — |

**Total**: 25 points. P0 (8.0) = 3 points guaranteed regardless of spike.

---

## Task Dependencies

```
8.0 (Spike) ──→ 8.2 (RetinaFace) ──→ 8.1 (LivePortrait endpoint) ──→ 8.3 (Tab activation)
     │                                       │
     └── FAIL? → Lip Sync cloud-only         └── 8.4 (VibeVoice TTS, P2)
                 Sprint 9 = Video local                │
                                                       └── 8.5 (Tests)
```

---

## Task Details

### 8.0 — LivePortrait Spike

**Duration**: 2 days max
**Script**: `local-server/spike_liveportrait.py`
**Output**: Spike report with RAM measurement, latency, quality sample, face detection results

### 8.1 — LivePortrait Endpoint

**File**: `local-server/server.py`
**Endpoint**: `POST /api/v1/lip-sync`
**Request**:
```json
{
    "image": "data:image/png;base64,...",
    "audio_url": "https://..." or "data:audio/wav;base64,...",
    "video_url": "data:video/mp4;base64,..." (optional, for V2V mode)
}
```
**Response**:
```json
{
    "status": "completed",
    "output": "data:video/mp4;base64,...",
    "_meta": {
        "model": "LivePortrait",
        "input_mode": "image" | "video",
        "duration_seconds": 5.0,
        "elapsed_seconds": 28.3,
        "ram_mb": 6200,
        "face_detected": true
    }
}
```

**Architecture**:
- `model_type: "custom"` in models.json — swappable, non-diffusers
- Uses hot-swap state machine (load/unload via same mechanism as diffusers)
- Custom loading path: `load_liveportrait_pipeline()` (not `from_pretrained`)
- Lazy-load pattern (like Sprint 7 IP-Adapter): load on request, unload after
- bf16 dtype for MPS compatibility

### 8.2 — RetinaFace Integration

**Package**: `retinaface` or equivalent MIT-licensed face detection
**Purpose**: Replace InsightFace detector that LivePortrait depends on
**Approach**:
1. Wrap RetinaFace in adapter matching LivePortrait's expected detector interface
2. Test face detection accuracy against LivePortrait's requirements
3. If RetinaFace insufficient → fallback to MediaPipe Face Detection (Apache 2.0)

### 8.3 — Lip Sync Tab Activation

**Files**: `components/StandaloneShell.js`, `packages/studio/src/muapi.js`
**Changes**:
- `comingSoon: _isLocal` → `comingSoon: false`
- Add `processLipSyncLocal()` function to muapi.js
- LipSyncStudio.jsx: detect local mode, route to local endpoint
- Local: `POST /api/v1/lip-sync` (LivePortrait)
- Cloud: existing `processLipSync()` (Muapi.ai models)

### 8.4 — VibeVoice TTS Integration (P2)

**Purpose**: Text → speech → lip sync (full text-to-talking-head pipeline)
**Dependencies**: VibeVoice-Realtime 0.5B (MIT, ~300ms latency)
**Scope**: If time permits and VibeVoice runs on MPS. Defer to Sprint 9 if not.

### 8.5 — Tests

- Spike report review
- LivePortrait endpoint contract test
- Face detection accuracy test
- Tab activation test
- Target: 120+ total tests (112 current + 8+ new)

---

## Acceptance Criteria

### Guaranteed (regardless of spike)
- [ ] Spike report submitted with RAM/latency/quality measurements
- [ ] License gate resolved (RetinaFace or MediaPipe confirmed)
- [ ] All Sprint 7 tests pass (0 regressions)
- [ ] npm run build — 0 errors
- [ ] 120+ tests pass

### Conditional (if spike PASS or PROD-ONLY)
- [ ] `POST /api/v1/lip-sync` generates lip-synced video from image + audio
- [ ] Face detection works with MIT-licensed detector (no InsightFace)
- [ ] Lip Sync Studio tab active and functional
- [ ] Hot-swap between Image pipeline ↔ LivePortrait works without OOM
- [ ] Output video plays correctly in browser (MP4 H.264)

---

## Pivot Plan (if spike FAILS)

1. Lip Sync stays cloud-only (LipSyncStudio.jsx cloud UI already complete)
2. Sprint 9 pivots to Video local spike (CogVideoX-2B)
3. All 4 studios operational: Image (local), Marketing (local), Video (cloud), 
   Cinema (cloud), Lip Sync (cloud) — 2 local + 3 cloud

---

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| LivePortrait MPS latency too slow (like AnimateDiff) | MEDIUM | HIGH | 3-tier spike; cloud fallback |
| RetinaFace detection quality insufficient | LOW | MEDIUM | MediaPipe (Apache 2.0) as backup |
| LivePortrait Python deps conflict with Diffusers | LOW | MEDIUM | Isolate in subprocess if needed |
| Audio processing adds latency | LOW | LOW | Pre-process audio before inference |

---

## MOP Phase A Sync

Sprint 8 extends beyond MOP Phase A (W6 = 09/06). Sprint 8 starts 26/05 = MOP W4.
MOP Gate A should be passable with Sprint 7 deliverables (4 studios active: Image local,
Marketing local, Video cloud, Cinema cloud).

---

## Definition of Done

- [ ] Spike report submitted and reviewed by @cto
- [ ] Lip Sync activated OR cloud-only decision documented
- [ ] Face detection uses MIT-licensed detector (no InsightFace)
- [ ] All tests pass (120+)
- [ ] Sprint plan updated to `status: DONE`
- [ ] Branch merged to main

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 8 Plan*
