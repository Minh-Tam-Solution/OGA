---
sprint: 7
status: PLANNED
start_date: 2026-05-12
planned_duration: 2 weeks
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto"]
  trigger: "Sprint 6 merged — hot-swap infra ready, Cinema spike next"
branch: "sprint-7/cinema-studio"
baseline_commit: "22b63c6c"
rollback: "git checkout main"
---

# Sprint 7 — IP-Adapter + Cinema Studio (Conditional)

**Sprint**: 7 | **Phase**: Phase A (Studios Activation)
**Previous**: Sprint 6 (hot-swap infra + RMBG + Marketing/Video tabs)
**Branch**: `sprint-7/cinema-studio` (off `main@22b63c6c`)

---

## Sprint Goal

Add IP-Adapter product placement utility and activate Cinema Studio with local
AnimateDiff-Lightning inference — conditional on spike results. If Cinema spike
fails, pivot to Lip Sync spike (Sprint 8 pull-forward).

---

## Pre-Sprint: Spike Protocol (2 days max)

### Target
AnimateDiff-Lightning (ByteDance) via diffusers on MacBook M4 Pro 24GB.

### Pass Criteria (3-Tier)

| Result | Condition | Action |
|--------|-----------|--------|
| **PASS (24GB)** | peak RAM < 9GB, latency < 60s, 512x512x16 frames, no OOM | Enable local on both pilot + prod |
| **PROD-ONLY** | peak RAM 9-20GB (OOM on 24GB, fits 48GB) | Local on Mac Mini only, cloud on MacBook |
| **FAIL** | peak RAM > 30GB or crash | Cinema cloud-only, pivot to Lip Sync spike |

### Spike Tasks

1. Install AnimateDiff-Lightning via diffusers (4-step inference)
2. Test on MacBook 24GB: generate 512x512x16 frames animation
3. Measure: peak MPS RAM, latency, output quality
4. Verify: ByteDance license terms for commercial use
5. Report results to @cto before sprint planning proceeds

### Owner: @coder
### Deadline: 2 days from sprint start (by 2026-05-14)

---

## License Verification (Before Implementation)

| Engine | Code License | Weights License | Commercial? | Action |
|--------|-------------|----------------|-------------|--------|
| AnimateDiff-Lightning | Apache 2.0 | **VERIFY ByteDance** | TBD | Spike gate |
| IP-Adapter | Apache 2.0 | Apache 2.0 | YES | Proceed |

**Blocker**: If ByteDance license is NC (non-commercial), Cinema stays cloud-only.

---

## Backlog (Priority Order)

| Task | Description | Priority | Points | Owner | Condition |
|------|-------------|----------|--------|-------|-----------|
| 7.0 | **Spike: AnimateDiff-Lightning** on MacBook 24GB — measure RAM/latency/quality | P0 | 2 | @coder | — |
| 7.1 | **IP-Adapter endpoint**: `POST /api/v1/product-placement` — product image + scene prompt → composed output | P0 | 5 | @coder | — |
| 7.2 | **AnimateDiff-Lightning integration** via diffusers (4-step), hot-swap with Image pipeline | P1 | 8 | @coder | Spike PASS or PROD-ONLY |
| 7.3 | **Cinema tab activation** — wire CinemaStudio.jsx to local pipeline, map camera/lens/focal UI to motion LoRA weights | P1 | 5 | @coder | Spike PASS or PROD-ONLY |
| 7.4 | **Concurrency runtime test** — swap request during active generate (CPO open question from Sprint 6) | P1 | 2 | @coder | — |
| 7.5 | **Tests** — IP-Adapter, Cinema (if activated), concurrency | Gate | 3 | @coder | — |

**Total**: 25 points. P0 (7.0, 7.1) = 7 points = guaranteed deliverable regardless of spike result.

---

## Task Dependencies

```
7.0 (Spike) ──→ 7.2 (AnimateDiff integration) ──→ 7.3 (Cinema tab)
     │                                                    │
     └── FAIL? → pivot to Lip Sync spike (Sprint 8)      │
                                                          └── 7.5 (Tests)
7.1 (IP-Adapter) ── independent, parallel with spike
7.4 (Concurrency test) ── independent, parallel with all
```

---

## Task Details

### 7.0 — AnimateDiff-Lightning Spike

**Duration**: 2 days max
**Output**: Spike report with RAM measurement, latency, quality sample, license status
**Decision gate**: @cto reviews spike report → approve/reject Cinema local

### 7.1 — IP-Adapter Endpoint

**File**: `local-server/server.py`
**Endpoint**: `POST /api/v1/product-placement`
**Behavior**:
- Accept: product image (base64) + scene prompt (text)
- Output: composed image with product in new context
- RAM: ~2-3GB (utility mode, runs alongside RMBG)
- model_type: "utility" in models.json
- License: Apache 2.0 (code + weights) — verified ✅

**Reference**: agentic-video-editor patterns (MIT, arch ref)

### 7.2 — AnimateDiff-Lightning Integration (Conditional)

**File**: `local-server/server.py`, `local-server/models.json`
**Behavior**:
- Load AnimateDiff-Lightning pipeline via diffusers (4-step inference)
- model_type: "diffusers" — participates in hot-swap
- Hot-swap between Image pipeline ↔ AnimateDiff pipeline
- Support 512x512x16 frames output (MP4 or GIF)

**Reference**: OpenMontage cinema pipeline patterns (AGPLv3 — arch ref ONLY, no code copy)

### 7.3 — Cinema Tab Activation (Conditional)

**Files**: `components/StandaloneShell.js`, `packages/studio/src/muapi.js`
**Behavior**:
- Change `comingSoon: _isLocal` → `comingSoon: false` for Cinema tab
- CinemaStudio.jsx already has camera/lens/focal length UI
- Map camera controls → AnimateDiff motion LoRA weights
- Cloud fallback: if spike = PROD-ONLY, show "Local only on production server" message on MacBook

### 7.4 — Concurrency Runtime Test

**File**: `tests/unit/concurrency.test.mjs` (new)
**Scenario**: Start generation → immediately send swap request → verify 409 returned
**Purpose**: Addresses CPO open question from Sprint 6 review

### 7.5 — Tests

- IP-Adapter endpoint contract test
- Cinema pipeline integration test (if activated)
- Concurrency test (7.4)
- Target: 95+ total tests (87 current + 8+ new)

---

## Acceptance Criteria

### Guaranteed (regardless of spike)
- [ ] IP-Adapter endpoint works: product image + prompt → composed output
- [ ] Concurrency test passes: swap during generate → 409
- [ ] All Sprint 6 tests pass (0 regressions)
- [ ] npm run build — 0 errors
- [ ] 95+ tests pass

### Conditional (if spike PASS or PROD-ONLY)
- [ ] AnimateDiff generates 512x512x16 frames within RAM budget
- [ ] Cinema Studio tab active and functional
- [ ] Hot-swap between Image ↔ Cinema works without OOM
- [ ] Camera/lens UI maps to motion parameters

---

## Pivot Plan (if spike FAILS)

If AnimateDiff-Lightning spike fails on both 24GB and 48GB estimate:

1. Cinema stays cloud-only (existing CinemaStudio.jsx works with Muapi cloud)
2. Pull Lip Sync spike forward into Sprint 7 remaining time
3. Sprint 7 delivers: IP-Adapter + concurrency test + Lip Sync spike report
4. Sprint 8 becomes: Lip Sync implementation (if spike passes) or Video local spike

---

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| AnimateDiff-Lightning OOM on 24GB | MEDIUM | LOW | 3-tier result: PROD-ONLY still delivers value on 48GB |
| ByteDance license is NC | LOW | HIGH | Cinema goes cloud-only; no wasted implementation work |
| IP-Adapter conflicts with Diffusers pipe | LOW | MEDIUM | IP-Adapter runs as utility (separate from diffusers hot-swap) |
| Motion LoRA mapping incomplete | MEDIUM | MEDIUM | Ship with basic camera presets; advanced mapping in Sprint 8 |

---

## MOP Phase A Sync

| MOP Week | MOP Task | OGA Sprint 7 Task |
|----------|----------|-------------------|
| W5 (02/06) | ThơmBrand pilot prep | 7.0 Spike + 7.1 IP-Adapter |
| W6 (09/06) | ThơmBrand pilot live + Gate A | 7.2-7.5 Cinema (conditional) + tests |

---

## Definition of Done

- [ ] Spike report submitted and reviewed by @cto
- [ ] IP-Adapter endpoint functional
- [ ] Concurrency runtime test added
- [ ] Cinema activated OR cloud-only decision documented
- [ ] All tests pass (95+)
- [ ] Sprint plan updated to `status: DONE`
- [ ] Branch merged to main

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 7 Plan*
