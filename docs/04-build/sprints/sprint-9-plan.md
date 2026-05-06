---
sprint: 9
status: PLANNED
start_date: 2026-06-09
planned_duration: 2 weeks
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto"]
  trigger: "Sprint 8 closed — LivePortrait spike FAIL (wrong tool), CEO chose Option C (dual spike)"
branch: "sprint-9/audio-lipsync"
baseline_commit: "HEAD"
rollback: "git checkout main"
---

# Sprint 9 — Audio-Driven Lip Sync (Dual Spike) + Video Local

**Sprint**: 9 | **Phase**: Phase A (Studios Activation — Final)
**Previous**: Sprint 8 (LivePortrait FAIL — video-driven, not audio-driven)
**Branch**: `sprint-9/audio-lipsync` (off `main@HEAD`)

---

## Sprint Goal

Find a working audio-driven lip-sync model via dual spike (Wav2Lip → MuseTalk).
If either passes, implement local lip sync endpoint. If both fail, lip sync stays
cloud-only and sprint pivots to CogVideoX-2B video local spike.

---

## Context

### Sprint 8 Learning

LivePortrait = video-driven portrait animation. Does NOT accept audio input.
Sprint 9 targets **purpose-built audio-driven** models only:

| Model | Input | Output | Architecture | License |
|-------|-------|--------|-------------|---------|
| **Wav2Lip** | image/video + audio | lip-synced video | GAN-based, face detector + lip sync net | ❓ VERIFY |
| **MuseTalk** | image + audio | lip-synced video | Diffusion-based, real-time capable | ❓ VERIFY |
| **SadTalker** | image + audio | talking head video | 3DMM + audio2motion | MIT |

### What Already Exists
- **LipSyncStudio.jsx**: Full UI active with cloud-only banner
- **server.py**: Hot-swap state machine, _gen_lock, is_ram_over_cap() ready
- **models.json**: model_type "custom" pattern established
- **IP-Adapter**: Lazy-load pattern proven (Sprint 7)
- **Tab**: Already active with cloud-only banner

---

## Pre-Sprint: Dual Spike Protocol (4 days total)

### Spike A: Wav2Lip (Day 1-2)

**Why first**: Most proven audio lip-sync model, widest adoption, smallest/fastest.

| Criterion | Threshold |
|-----------|-----------|
| Audio + image → video | Must work (core requirement) |
| Peak RAM | < 8GB (PASS), 8-20GB (PROD-ONLY), > 20GB (FAIL) |
| Latency (5s audio) | < 30s (PASS), 30-120s (PROD-ONLY), > 120s (FAIL) |
| License | Must be commercial-safe |
| Face detection | Must work with MIT detector (not InsightFace) |

**Tasks**:
1. Verify Wav2Lip license (code + weights) for commercial use
2. Install Wav2Lip + face detection (RetinaFace MIT or s3fd)
3. Test: portrait image + 5s WAV → lip-synced MP4
4. Measure: peak MPS RAM, latency, output quality
5. Use bf16 dtype if supported; fp32 fallback
6. Submit spike report

### Spike B: MuseTalk (Day 3-4, only if Wav2Lip FAILS)

**Why second**: Newer, real-time capable, diffusion-based (potentially better quality).

| Criterion | Threshold |
|-----------|-----------|
| Audio + image → video | Must work |
| Peak RAM | Same as Wav2Lip thresholds |
| Latency (5s audio) | Same thresholds |
| License | Must be commercial-safe |
| MPS support | Must run on Apple Silicon |

**Tasks**:
1. Verify MuseTalk license
2. Install MuseTalk + dependencies
3. Test: portrait image + 5s WAV → lip-synced MP4
4. Measure: peak RAM, latency, quality
5. Submit spike report

### Spike C: CogVideoX-2B (Day 3-4, only if BOTH lip-sync spikes FAIL)

**Fallback**: If neither audio lip-sync model works, pivot to Video local.

| Criterion | Threshold |
|-----------|-----------|
| Text → video | Must work |
| Peak RAM | < 10GB (PASS), 10-25GB (PROD-ONLY), > 30GB (FAIL) |
| Latency (4s 480p) | < 120s (PASS), 120-300s (PROD-ONLY), > 300s (FAIL) |
| License | VERIFY THUDM terms |

### Decision Matrix

```
Wav2Lip PASS  → Implement Wav2Lip (skip MuseTalk spike)
Wav2Lip FAIL  → Spike MuseTalk
  MuseTalk PASS → Implement MuseTalk
  MuseTalk FAIL → Spike CogVideoX-2B (Video local)
    CogVideoX PASS → Implement Video local
    CogVideoX FAIL → Video stays cloud-only, sprint delivers tests only
```

---

## License Pre-Check (Before Any Spike)

| Engine | Code License | Weights License | Commercial? | Status |
|--------|-------------|----------------|-------------|--------|
| Wav2Lip | ❓ Check repo | ❓ Check model card | TBD | **Day 0 verify** |
| MuseTalk | ❓ Check repo | ❓ Check model card | TBD | **Day 0 verify** |
| SadTalker | MIT | MIT | YES ✅ | Backup if others NC |
| CogVideoX-2B | Apache 2.0 | ❓ THUDM terms | TBD | **Verify if needed** |

**Hard blocker**: If a model's license is NC → skip it entirely, try next.

---

## Backlog (Priority Order)

| Task | Description | Priority | Points | Owner | Condition |
|------|-------------|----------|--------|-------|-----------|
| 9.0a | **Spike: Wav2Lip** — audio + image → video on MacBook 24GB | P0 | 2 | @coder | — |
| 9.0b | **Spike: MuseTalk** — same test if Wav2Lip fails | P0 | 2 | @coder | Wav2Lip FAIL |
| 9.0c | **Spike: CogVideoX-2B** — text → video if both lip-sync fail | P0 | 2 | @coder | Both FAIL |
| 9.1 | **Lip Sync endpoint**: `POST /api/v1/lip-sync` — winning model | P0 | 8 | @coder | Any lip-sync PASS |
| 9.2 | **Wire LipSyncStudio.jsx** to local endpoint, remove cloud-only banner | P1 | 3 | @coder | 9.1 done |
| 9.3 | **Video local** (if lip-sync all FAIL): CogVideoX + VideoStudio toggle | P1 | 8 | @coder | CogVideoX PASS |
| 9.4 | **Fix spike report metrics** (CPO feedback) + ADR-005 revision | P1 | 1 | @coder | — |
| 9.5 | **Tests** — endpoint contract, integration, tab update | Gate | 3 | @coder | — |

**Total**: 29 points. P0 spikes (9.0a/b/c) = 6 points guaranteed.

---

## Task Dependencies

```
9.0a (Wav2Lip) ──PASS──→ 9.1 (Lip Sync endpoint) ──→ 9.2 (Wire UI)
     │                                                       │
     └──FAIL──→ 9.0b (MuseTalk) ──PASS──→ 9.1              └── 9.5 (Tests)
                      │
                      └──FAIL──→ 9.0c (CogVideoX) ──PASS──→ 9.3 (Video local)
                                       │
                                       └──FAIL──→ 9.5 (Tests only)

9.4 (Metrics fix + ADR revision) ── independent, parallel with all
```

---

## Task Details

### 9.0a — Wav2Lip Spike

**Duration**: 2 days max
**Script**: `local-server/spike_wav2lip.py`
**Key questions**:
- Does Wav2Lip's face detection work without InsightFace?
- What's the latency on MPS with CPU offload?
- Does it accept arbitrary audio formats (WAV, MP3)?
- Quality: are lip movements convincing at 512x512?

### 9.0b — MuseTalk Spike (if Wav2Lip fails)

**Duration**: 2 days max
**Script**: `local-server/spike_musetalk.py`
**Key questions**:
- Is MuseTalk compatible with MPS backend?
- Does "real-time capable" translate to fast on Apple Silicon?
- What face detection does it use natively?

### 9.0c — CogVideoX-2B Spike (if both lip-sync fail)

**Duration**: 2 days max
**Script**: `local-server/spike_cogvideox.py`
**Key questions**:
- Peak RAM for 480p 4s video?
- Latency with MPS + CPU offload?
- THUDM license commercial status?

### 9.1 — Lip Sync Endpoint (Winning Model)

**File**: `local-server/server.py`
**Endpoint**: `POST /api/v1/lip-sync` (same contract as TS-005)
**Adaptations** based on winning model:
- Request: `image` + `audio` (TS-005 contract unchanged)
- model_type: "custom" in models.json
- Lazy-load pattern
- bf16 if supported, fp32 fallback
- RetinaFace adapter if model needs face detection

### 9.2 — Wire LipSyncStudio.jsx

- Remove cloud-only banner
- Add `processLipSyncLocal()` to muapi.js
- Local mode: route to `POST /api/v1/lip-sync`
- Cloud mode: existing `processLipSync()` unchanged

### 9.3 — Video Local (Fallback Path)

If lip-sync all fail but CogVideoX passes:
- Add CogVideoX-2B to models.json (model_type: "diffusers")
- VideoStudio.jsx: add local/cloud toggle
- Hot-swap between Image ↔ CogVideoX
- PROD-ONLY likely (RAM 10-20GB → Mac Mini only)

### 9.4 — Housekeeping (CPO Feedback)

1. Annotate sprint-8-spike-report.md: clarify 1263.1s (cold) vs 33.4s (warm)
2. Revise ADR-005: update from LivePortrait to winning audio model
3. Audit LipSyncStudio.jsx hero text — ensure no false local audio promise

### 9.5 — Tests

- Spike report validation
- Endpoint contract (if implemented)
- Tab state update (if banner removed)
- Target: 130+ total tests (125 current + 5+ new)

---

## Acceptance Criteria

### Guaranteed (regardless of spikes)
- [ ] At least 2 spike reports submitted (Wav2Lip + MuseTalk or CogVideoX)
- [ ] License status verified for each spiked model
- [ ] Sprint 8 spike report metrics annotated (CPO feedback)
- [ ] ADR-005 revised with correct model landscape
- [ ] All Sprint 8 tests pass (0 regressions)
- [ ] npm run build — 0 errors
- [ ] 130+ tests pass

### Conditional (if any spike PASS/PROD-ONLY)
- [ ] Local endpoint functional (lip-sync OR video)
- [ ] UI wired to local endpoint
- [ ] Hot-swap works without OOM
- [ ] Output video plays in browser (MP4 H.264)

---

## Pivot Plan (if ALL spikes FAIL)

1. Lip Sync stays cloud-only (LipSyncStudio.jsx already functional)
2. Video stays cloud-only (VideoStudio.jsx already functional)
3. Sprint 9 delivers: spike reports + ADR revision + tests
4. **Studios final state**: Image (local), Marketing (local), Video (cloud),
   Cinema (cloud), Lip Sync (cloud) — 2 local + 3 cloud
5. Post-Sprint 9: evaluate newer models as they release, or GPU cloud (fal.ai)

---

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Wav2Lip license is NC | MEDIUM | HIGH | Skip immediately, try MuseTalk |
| Both lip-sync models too slow on MPS | MEDIUM | MEDIUM | 3-tier result; CogVideoX fallback |
| CogVideoX OOM on 24GB | HIGH | LOW | PROD-ONLY tier still delivers on 48GB |
| All three spikes FAIL | LOW | MEDIUM | Cloud-only is acceptable; 5 studios active via cloud |
| MPS bf16 incompatibility | LOW | LOW | fp32 fallback with higher RAM |

---

## MOP Phase A Status

MOP Gate A passable with current state (4 studios active: Image local, Marketing
local, Video cloud, Cinema cloud, Lip Sync cloud). Sprint 9 is **bonus** — local
lip-sync or video is value-add, not gate-blocking.

---

## Definition of Done

- [ ] Spike reports submitted and reviewed by @cto
- [ ] At least one model implemented locally OR all-cloud documented
- [ ] ADR-005 revised
- [ ] Sprint 8 report metrics fixed
- [ ] All tests pass (130+)
- [ ] Sprint plan updated to `status: DONE`
- [ ] Branch merged to main

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 9 Plan*
