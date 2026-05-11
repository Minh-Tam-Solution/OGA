---
sprint: 11
task: 11.0b
status: IN-PROGRESS
owner: "@coder + @cto"
date: 2026-05-09
branch: "spike/indextts-eval"
---

# Sprint 11.0b — IndexTTS / Draft to Take Spike Report

## Environment

| Item | Value |
|------|-------|
| Host | GPU Server S1 (Ubuntu 22.04, RTX 5090 32GB, 192GB RAM) |
| Docker Compose | |
| NVIDIA Container Toolkit | |
| Repo commit / tag tested | |
| Image digests pinned | YES / NO |

---

## §1 — Legal Clearance (Day 1 HARD GATE)

### Documents Reviewed
- [ ] `BETA_TERMS.md` read
- [ ] `THIRD_PARTY_NOTICES.md` read (if exists)

### Commercial-Use Posture

| Model / Weights | License Found | Commercial? | Notes |
|-----------------|---------------|-------------|-------|
| IndexTTS2 weights | | ⬜ YES / ⬜ NO / ⬜ UNCLEAR | |
| OmniVoice weights | | ⬜ YES / ⬜ NO / ⬜ UNCLEAR | |
| Qwen3-8B-GGUF weights | | ⬜ YES / ⬜ NO / ⬜ UNCLEAR | |
| MusicGen weights (optional) | | ⬜ YES / ⬜ NO / ⬜ N/A | |

### Day 1 Acceptance

| # | Criterion | Result |
|---|-----------|--------|
| B-Legal | All model weights confirmed commercial-safe. No "non-commercial" or "research-only" clauses. | ⬜ PASS / ⬜ FAIL |
| B-Mirror | Upstream registry auth requirements documented. Exit-plan triggers recorded. | ⬜ PASS / ⬜ FAIL |

**Legal Gate Decision**: ⬜ PROCEED to Day 2 / ⬜ HALT — escalate to CEO

**CEO Escalation Log** (if halted): ___

---

## §2 — Linux Smoke Test (Day 2)

### Tasks

- [ ] `start.sh` created for Ubuntu
- [ ] All images pinned by digest in `docker-compose.yml`
- [ ] `docker compose up -d` starts without error
- [ ] All 5 containers healthy after 10 min
- [ ] First-run model downloads complete
- [ ] UI loads at localhost without JS errors
- [ ] English sample script generates valid WAV/MP3 in <30s

### Digest Pin Verification

| Container | Image | Digest (`sha256:...`) |
|-----------|-------|----------------------|
| Backend | | |
| Frontend | | |
| Qwen sidecar | | |
| OmniVoice sidecar | | |
| SFX sidecar (if enabled) | | |

### Day 2 Acceptance

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| B1 | `docker compose up -d` starts all 5 containers without error | ⬜ PASS / ⬜ FAIL | |
| B2 | All containers show `healthy` or `Up` status after 10 min | ⬜ PASS / ⬜ FAIL | |
| B3 | First-run model download completes | ⬜ PASS / ⬜ FAIL | Time: ___ min |
| B4 | English sample script generates valid WAV/MP3 in <30s | ⬜ PASS / ⬜ FAIL | Latency: ___ s |
| B5 | UI loads at localhost without JavaScript errors | ⬜ PASS / ⬜ FAIL | |
| B-Pin | Every image pinned by digest. No `:latest` or floating tags. | ⬜ PASS / ⬜ FAIL | |

**Disk usage after model downloads**: ___ GB

---

## §3 — VRAM Coexistence (Day 3 Morning)

### Baseline

- [ ] Wan2.1 loaded in OGA
- [ ] `nvidia-smi` baseline VRAM recorded

### Concurrent Test

- [ ] IndexTTS TTS triggered WHILE Wan2.1 loaded
- [ ] `nvidia-smi` peak VRAM recorded during concurrent operation
- [ ] NO OOM observed
- [ ] Both outputs correct

### If OOM

- [ ] CPU-only mode tested for IndexTTS
- [ ] Documented CPU-fallback latency impact

### Day 3 VRAM Acceptance

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| B6 | Concurrent Wan2.1 + IndexTTS does NOT OOM | ⬜ PASS / ⬜ FAIL | |
| B7 | Peak VRAM during coexistence ≤ 30 GB | ⬜ PASS / ⬜ FAIL | Peak: ___ GB |

**nvidia-smi log**: (paste or attach)

---

## §4 — Vietnamese Quality A/B (Day 3 Afternoon)

### Sample Scripts

| # | Script Topic | Script Text |
|---|--------------|-------------|
| 1 | F&B | |
| 2 | Hotel | |
| 3 | Real Estate | |
| 4 | Event | |
| 5 | General | |

### Blind Rating Results (Hùng — Marketing Manager)

| # | IndexTTS Rating | ElevenLabs Rating |
|---|-----------------|-------------------|
| 1 | ⬜ Acceptable / ⬜ Not acceptable | ⬜ Acceptable / ⬜ Not acceptable |
| 2 | ⬜ Acceptable / ⬜ Not acceptable | ⬜ Acceptable / ⬜ Not acceptable |
| 3 | ⬜ Acceptable / ⬜ Not acceptable | ⬜ Acceptable / ⬜ Not acceptable |
| 4 | ⬜ Acceptable / ⬜ Not acceptable | ⬜ Acceptable / ⬜ Not acceptable |
| 5 | ⬜ Acceptable / ⬜ Not acceptable | ⬜ Acceptable / ⬜ Not acceptable |

### Day 3 Quality Acceptance

| # | Criterion | Result |
|---|-----------|--------|
| B8 | Vietnamese TTS quality: ≥3/5 rated acceptable | ⬜ PASS / ⬜ FAIL (___/5 acceptable) |
| B9 | Disk usage after model downloads ≤ 60 GB | ⬜ PASS / ⬜ FAIL (___ GB) |

---

## Summary

| Day | Result | Blockers |
|-----|--------|----------|
| Day 1 (Legal) | ⬜ PASS / ⬜ HALTED | |
| Day 2 (Linux) | ⬜ PASS / ⬜ FAIL | |
| Day 3 (VRAM+VN) | ⬜ PASS / ⬜ FAIL | |

**Overall Verdict**: ⬜ INTEGRATE / ⬜ DEFER / ⬜ REJECT

**Rationale**:

### If DEFERRED
- **Conditions for re-evaluation**:
- **Target re-evaluation date**:

### If INTEGRATE
- **Next steps for S12-13**:

---

## Risk Register Update

| ID | Risk | Status | Mitigation |
|----|------|--------|------------|
| R-EXT-003 | GHCR upstream goes dark | | Digest pinned; local mirror planned? |
| R-EXT-004 | VRAM conflict with video pipeline | | CPU-fallback / queue gate |
| R-EXT-005 | Commercial license non-compliance | | Day 1 gate result |

---

*Sprint 11.0b Spike Report | @coder + @cto | SDLC Framework v6.3.1*
