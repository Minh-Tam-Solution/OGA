---
sprint: 11
task: 11.0b
status: PLANNED
owner: "@coder + @cto"
date: 2026-05-09
branch: "spike/indextts-eval"
---

# Sprint 11.0b — IndexTTS / Draft to Take Spike Plan

## Objective

Validate Draft to Take runs on GPU Server S1 (Linux), produces acceptable Vietnamese TTS, and coexists with OGA video pipeline without OOM. Output: spike report with ✅/❌ per acceptance criterion + legal summary.

## Duration

3 days

## Environment

| Item | Value |
|------|-------|
| Host | GPU Server S1 (Ubuntu 22.04, RTX 5090 32GB, 192GB RAM) |
| Docker | Docker Compose v2+ |
| GPU support | NVIDIA Container Toolkit (verify `docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi`) |
| Internal ports | 3000 (frontend), 8001 (backend) — verify no conflict with OGA |

## Day 1 — Legal Pre-Clear (Must Pass Before Days 2–3)

**Owner:** @cto (legal review) + @coder (documentation)

### Tasks
- [ ] Read `BETA_TERMS.md` in repo root
- [ ] Read `THIRD_PARTY_NOTICES.md` (if exists)
- [ ] Document commercial-use posture for each model:
  - IndexTTS2 weights
  - OmniVoice weights
  - Qwen3-8B-GGUF weights
  - MusicGen weights (optional sidecar)
- [ ] If ANY model has "non-commercial", "research-only", or "academic-use-only" clause:
  - Halt spike immediately
  - Escalate to CEO
  - Mark integration DEFERRED
- [ ] If all clear → proceed to Day 2

### Output
Legal summary paragraph in spike report (§Legal Clearance).

### Acceptance Criteria

| # | Criterion | Pass Threshold |
|---|-----------|----------------|
| B-Legal | All model weights (IndexTTS2, OmniVoice, Qwen3, MusicGen) confirmed commercial-safe. No "non-commercial" or "research-only" clauses. | Must pass |
| B-Mirror | Upstream registry auth requirements documented. Exit-plan triggers recorded per ADR-007 Exit Plan section. | Must pass |

## Day 2 — Linux Smoke Test

**Owner:** @coder

### Tasks
- [ ] Download repo ZIP / git clone to `/tmp/indextts-spike`
- [ ] Create `start.sh` equivalent for Ubuntu (adapt from `start.bat`)
- [ ] **Pin all GHCR images by digest** in `docker-compose.yml` (`ghcr.io/.../<image>@sha256:<hex>`). Zero `:latest` or floating tags allowed. Record digest list in spike report.
- [ ] `docker compose up -d`
- [ ] Wait for all 5 containers healthy (`docker ps` + log tail)
- [ ] First-run model downloads: monitor disk usage (`df -h`)
- [ ] Open `http://localhost:3000` (or mapped port) → UI loads
- [ ] Submit English sample script → click Generate Audio
- [ ] Verify WAV/MP3 file created in shared volume
- [ ] Measure latency: script submit → audio file ready

### Acceptance Criteria

| # | Criterion | Pass Threshold |
|---|-----------|----------------|
| B1 | `docker compose up -d` starts all 5 containers without error | Must pass |
| B2 | All containers show `healthy` or `Up` status after 10 min | Must pass |
| B3 | First-run model download completes (may take 30–60 min) | Must pass |
| B4 | English sample script generates valid WAV/MP3 in <30s | Must pass |
| B5 | UI loads at localhost without JavaScript errors | Must pass |
| B-Pin | Every image in `docker-compose.yml` pinned by digest (`@sha256:`). No `:latest` or floating tags. | Must pass |

## Day 3 — VRAM Coexistence + Vietnamese Quality

**Owner:** @coder + @architect (VRAM analysis)

### Tasks — VRAM Coexistence (Morning)
- [ ] Load Wan2.1 in OGA (`curl` to trigger pipeline load)
- [ ] Record `nvidia-smi` baseline VRAM
- [ ] Trigger IndexTTS TTS generation WHILE Wan2.1 loaded
- [ ] Record `nvidia-smi` peak VRAM during concurrent operation
- [ ] Verify NO OOM, both outputs correct
- [ ] If OOM → test CPU-only mode for IndexTTS (disable GPU in Compose)
- [ ] Document VRAM budget recommendation

### Tasks — Vietnamese Quality (Afternoon)
- [ ] Prepare 5 Vietnamese sample scripts (F&B, Hotel, Real Estate, Event, General)
- [ ] Generate TTS for each script using IndexTTS2
- [ ] Generate same scripts using ElevenLabs Vietnamese (cloud benchmark)
- [ ] Send 10 audio clips (5 IndexTTS + 5 ElevenLabs, randomized) to Hùng (Marketing Manager)
- [ ] Hùng rates each clip: "acceptable" / "not acceptable"
- [ ] Pass threshold: ≥3/5 IndexTTS clips rated "acceptable"

### Acceptance Criteria

| # | Criterion | Pass Threshold |
|---|-----------|----------------|
| B6 | Concurrent Wan2.1 + IndexTTS does NOT OOM | Must pass (or CPU fallback documented) |
| B7 | Peak VRAM during coexistence ≤ 30 GB | Must pass |
| B8 | Vietnamese TTS quality: ≥3/5 rated acceptable | Must pass |
| B9 | Disk usage after model downloads ≤ 60 GB | Must pass |

## Output Artifact

`docs/04-build/sprints/sprint-11-indextts-spike-report.md`

Template:
- Environment table
- Legal clearance summary (§Legal)
- Day 2 smoke test results (B1–B5)
- Day 3 VRAM analysis (B6–B7) with `nvidia-smi` logs
- Day 3 Vietnamese quality results (B8) with Hùng's ratings
- Disk usage breakdown
- Recommendation: INTEGRATE / DEFER / REJECT
- If DEFER: conditions for re-evaluation

## Rollback

```bash
cd /tmp/indextts-spike && docker compose down -v
sudo rm -rf /tmp/indextts-spike
# Remove any persistent volumes if created outside /tmp
```

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 11.0b Spike Plan*
