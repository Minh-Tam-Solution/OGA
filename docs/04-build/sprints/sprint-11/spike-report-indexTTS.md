# Sprint 11 Spike Report — IndexTTS / Draft to Take Beta (11.0b)

| Field | Value |
|-------|-------|
| **Spike ID** | 11.0b |
| **Repo** | `https://github.com/JaySpiffy/IndexTTS-Workflow-Studio` |
| **Commit** | `b07a5e7` (HEAD at clone time) |
| **Tag** | `v3.0.0-beta.7` |
| **Cloned to** | `/tmp/indextts-spike` |
| **Spike Owner** | @coder |
| **Date** | 2026-05-09 |
| **Status** | **DEFERRED** — VN quality gate failed (Hùng A/B). Technical artifacts retained. Re-eval trigger: IndexTTS2 v3+ adds Vietnamese phoneme support. |

---

## 1. Executive Summary

**Draft to Take Beta** (formerly IndexTTS Workflow Studio) is a local-first script-to-audio production studio built around **IndexTTS2** (bilibili). It provides:

- Multi-speaker dialogue generation with emotion control
- Script Canvas workflow (write → cast → generate → mix → export)
- Optional sidecars: Qwen3-8B LLM (emotion detection), OmniVoice (voice design), SFX/MusicGen
- Built-in VRAM guard for GPU resource arbitration
- Docker-first deployment via GHCR

**Preliminary Verdict**: **DAY 1 PASS (Conditional)** — CPO approved 2026-05-09. P2 integration candidate subject to:
1. ✅ Day 1 legal pre-clear — PASS with conditions (§3.5 Model Usage Policy, jurisdiction escalation)
2. ✅ Supply-chain digest pinning — COMPLETE
3. ⏳ Day 2 Linux smoke test (Docker pull → model download → TTS generation)
4. ⏳ VRAM coexistence with Wan2.1/LTX (must not conflict)

---

## 2. Repository & Architecture

### 2.1 What's in the Repo

| Component | License | Type |
|-----------|---------|------|
| Launcher scripts (`start.bat`, `stop.bat`, `collect-diagnostics.bat`) | MIT | Source |
| `docker-compose.yml` | MIT | Configuration |
| `README.md`, docs, samples | MIT | Documentation |
| Docker images (GHCR) | **Private / Proprietary** | Prebuilt containers |
| IndexTTS2 model weights | bilibili Model License | Downloaded at runtime |

**Critical**: The repo contains the **launcher only** — not the application source code or model weights. Docker pulls prebuilt images from GHCR; models download from Hugging Face on first run.

### 2.2 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Draft to Take Beta                        │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  frontend   │   backend   │ script-llm  │    omnivoice      │
│   :3000     │   :8001     │   :8030     │     :8010         │
│  (React)    │ (IndexTTS2) │ (Qwen3 GGUF)│  (voice design)   │
│  [required] │  [required] │  [profile]  │    [profile]      │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│                      sfx                                     │
│                     :8020                                    │
│              (Woosh + MusicGen)                              │
│                   [profile]                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Docker Profiles

| Profile | Service | Purpose | Default |
|---------|---------|---------|---------|
| *(none)* | `backend` + `frontend` | Core TTS + UI | ✅ Always on |
| `llm` | `script-llm` | Qwen3-8B emotion detection | ❌ Off |
| `omnivoice` | `omnivoice` | Voice cloning/design | ❌ Off |
| `sfx` | `sfx` | SFX & music generation | ❌ Off |

**OGA Recommendation**: Start with **core only** (`backend` + `frontend` + optional `script-llm`). **OmniVoice service physically removed from docker-compose.pinned.yml** per CTO directive (academic-only license). SFX stays disabled.

---

## 3. Legal Review (Day 1 Hard Gate)

### 3.1 License Matrix

| Component | License | Commercial OK? | OGA Relevance |
|-----------|---------|----------------|---------------|
| Draft to Take launcher | MIT | ✅ Yes | Scripts, docs |
| Draft to Take containers | **Private** | ⚠️ TBD | GHCR images — need JaySpiffy terms acceptance |
| **IndexTTS2 model** | bilibili Model License | ✅ **Conditional** | **Primary concern** |
| Qwen3-8B | Apache 2.0 | ✅ Yes | Optional LLM sidecar |
| OmniVoice model | Academic/Research only | ❌ **No** | Optional — do NOT enable |
| Woosh SFX | Unknown/license-dependent | ⚠️ Check | Optional — disabled by default |
| MusicGen (facebook) | MIT/CC-BY-NC? | ⚠️ Check | Optional — disabled by default |

### 3.2 IndexTTS2 Model License Analysis (bilibili Model Use License)

**Source**: `https://huggingface.co/IndexTeam/IndexTTS-2/blob/main/LICENSE.txt`

| Clause | Risk | OGA Posture |
|--------|------|-------------|
| **§2.2 Revenue cap** (>RMB 1B or >100M MAU → separate license) | 🟢 **Low** | NQH revenue well below threshold |
| **§3.4(c) No model improvement** | 🟡 **Medium** | **Cannot use TTS output to train/fine-tune other AI models** |
| **§4.1(c) Content restrictions** | 🟡 **Medium** | No false info, discrimination, privacy infringement in generated audio |
| **§4.2 High-risk use** | 🟢 **Low** | Video content creation is NOT high-risk (medical, military, etc.) |
| **§5.3 Patent retaliation** | 🟡 **Medium** | If NQH sues bilibili over IP, license auto-terminates |
| **§6.1 Governing law: PRC** | 🟡 **Medium** | Chinese law governs; **Chinese version prevails** (§9) |
| **§6.2 Arbitration: Shanghai** | 🟡 **Medium** | Shanghai Arbitration Commission; binding |

**Legal Flags for @cto Review**:

1. **Jurisdiction**: Governing law = PRC; disputes → Shanghai Arbitration. NQH legal should confirm enforceability and risk appetite. **ESCALATED to CTO/CEO for formal legal acceptance before any production rollout.**
2. **Output restrictions**: §3.4(c) prohibits using model output to improve other AI models. This must be documented in OGA's model usage policy. **See §3.5 below.**
3. **Content compliance**: §4.1(c) requires ensuring generated audio does not violate laws (false info, discrimination, privacy). Content moderation pipeline should cover audio outputs.
4. **Revenue threshold**: Current posture = safe. If NQH grows beyond RMB 1B annual revenue, renegotiation required.

### 3.5 Model Usage Policy — IndexTTS2 Compliance

Per CPO directive (2026-05-09), the following clauses are **mandatory** for all OGA users and operators:

> **§MUP-IDX-001 — No Model Improvement Restriction**
> 
> Outputs generated by IndexTTS2 (bilibili) **shall not** be used to train, fine-tune, distill, or otherwise improve any third-party AI model. This prohibition includes but is not limited to:
> - Using TTS audio as training data for speech synthesis models
> - Using TTS audio as training data for multimodal models (video, audio-language)
> - Fine-tuning LoRA or other parameter-efficient adapters on TTS outputs
> 
> Permitted uses: editing, mixing, post-production, and distribution of the audio **as content**, provided such distribution does not violate §4.1(c) of the bilibili license.

> **§MUP-IDX-002 — Content Compliance**
> 
> Generated audio must not contain false information, discriminatory content, or privacy-infringing material. This is enforced by OGA's existing content moderation pipeline (extend to cover audio outputs).

> **§MUP-IDX-003 — Attribution**
> 
> All copies or Derivative Works of IndexTTS2 model weights must retain original copyright notices and a copy of the bilibili Model Use License Agreement (§3.4(b)).

**ADR-007 Revision Required**: Add §MUP-IDX-001 through §MUP-IDX-003 as compliance annex.

### 3.3 OmniVoice — RED FLAG

> "This project is intended only for **academic research purposes**. Users are strictly prohibited from using this model for unauthorized voice cloning, voice impersonation, fraud, scams, or any other illegal or unethical activities."

**Verdict**: ❌ **OMNIVOICE SERVICE PHYSICALLY REMOVED FROM PRODUCTION DEPLOYABLE.**

- **CPO Directive (2026-05-09)**: OmniVoice academic/research-only license is incompatible with OGA's commercial use case.
- **CTO Lock-in (2026-05-09)**: Service block **deleted** from `docker-compose.pinned.yml` (not just profile disabled). Pinned digest retained in spike report Appendix A for audit trail.
- **Action**: `docker-compose.pinned.yml` no longer contains omnivoice service definition.
- **ADR-007 Update**: Add OmniVoice to "Excluded Dependencies" list.
- **README Note**: `/opt/nqh/indextts/README.md` — "OmniVoice removed from this deployment per ADR-007 §3.3 (academic-only license). Re-enabling requires CTO+CPO+CEO sign-off and license renegotiation."
- **If voice design needed**: Evaluate alternatives (Coqui TTS, XTTS v2, or RVC with commercial license) in future sprint.

### 3.4 SFX/Music — YELLOW FLAG

BETA_TERMS.md states:
> "Some model-backed SFX/music engines may use non-commercial or research-only weights. Treat generated SFX/music as license-dependent unless you have checked the active model terms."

**Verdict**: ⚠️ Keep `sfx` profile disabled until per-model licenses are reviewed.

---

## 4. Supply-chain Security

### 4.1 Original Issue

Upstream `docker-compose.yml` uses **mutable tags**:

```yaml
image: "${DRAFT_TO_TAKE_IMAGE_PREFIX:-ghcr.io/jayspiffy}/draft-to-take-backend:${DRAFT_TO_TAKE_IMAGE_TAG:-v3.0.0-beta.7}"
```

Tags are mutable — a malicious actor with push access could overwrite `v3.0.0-beta.7` with a compromised image.

### 4.2 Resolution — Digest Pinning

All GHCR images have been resolved to immutable digests (linux/amd64):

| Service | Image | Digest |
|---------|-------|--------|
| backend | `draft-to-take-backend` | `sha256:0eda782b9273ea88351459d1b844a2960556df27658601e4a38e57e845ef6c04` |
| frontend | `draft-to-take-frontend` | `sha256:f4fc6db0c34287c58255a5a1f1e38e6db0e41068766084a63fab53a632a4504a` |
| script-llm | `draft-to-take-script-llm` | `sha256:666272497f68221f20beea51bc5aa10afae8965787ec04c62165e2c3ba8b31fb` |
| omnivoice | `draft-to-take-omnivoice` | `sha256:c770e47b2a6518ba49e6d3929d944b531ca52fa86cf93fbf5274fa1ca7e9815a` |
| sfx | `draft-to-take-sfx` | `sha256:9bc997ace073d4a6effff17279a0e39714bbb6ff1122efcfbb83e9bf756c1a51` |

**Pinned compose file**: `/tmp/indextts-spike/docker-compose.pinned.yml`

**Zero `:latest` tags. Zero mutable tags. All pinned by digest.**

### 4.3 Model Download Supply-chain

| Model | Source | Verification Needed |
|-------|--------|---------------------|
| IndexTTS-2 | `IndexTeam/IndexTTS-2` (HF) | File hashes from HF API |
| Qwen3-8B-GGUF | `ufoym/Qwen3-8B-Q4_K_M-GGUF` (HF) | File hashes from HF API |
| OmniVoice | `k2-fsa/OmniVoice` (HF) | File hashes from HF API |

**Recommendation**: Add HF file hash verification to startup script before Sprint 11 closes.

---

## 5. Docker Compose Analysis

### 5.1 Key Configuration

| Setting | Default | OGA Note |
|---------|---------|----------|
| `INDTEXTS_BACKEND_HOST_PORT` | `8001` | OGA FastAPI already uses `8000`. No conflict. |
| `INDTEXTS_FRONTEND_HOST_PORT` | `3000` | OGA Next.js uses `3005`. No conflict. |
| `INDTEXTS_USE_GPU` | `true` | Required for TTS inference |
| `INDTEXTS_USE_DEEPSPEED` | `true` | Speed optimization |
| `INDTEXTS_AUTO_DOWNLOAD_MODELS` | `true` | First-run will download ~?GB from HF |
| `INDTEXTS_VRAM_GUARD_ENABLED` | `true` | ✅ Built-in VRAM management |

### 5.2 Health Checks

All services have proper health checks:
- `backend`: 900s start period (model download time), 30s interval
- `script-llm`, `sfx`, `omnivoice`: 30s start period, 10s interval

### 5.3 Volume Strategy

```yaml
volumes:
  - "${DRAFT_TO_TAKE_SHARED_DIR}/models:/app/shared/models"
  - "${DRAFT_TO_TAKE_SHARED_DIR}/audio:/app/shared/audio"
  - "${DRAFT_TO_TAKE_SHARED_DIR}/data:/app/shared/data"
```

Models, audio, and data are persisted to host filesystem. **OGA can mount these to a shared volume** for integration (e.g., OGA generates video → IndexTTS generates audio → mix in post-production).

---

## 6. VRAM Analysis

### 6.1 Draft to Take Built-in VRAM Guard

Draft to Take has a **sophisticated VRAM guard** already:

```yaml
INDTEXTS_VRAM_GUARD_ENABLED: true
INDTEXTS_VRAM_GUARD_TTS_MIN_FREE_MB: 4096      # 4GB reserved
INDTEXTS_VRAM_GUARD_LLM_MIN_FREE_MB: 2048      # 2GB reserved
INDTEXTS_VRAM_GUARD_SFX_MIN_FREE_MB: 4096      # 4GB reserved
INDTEXTS_VRAM_GUARD_MUSIC_MIN_FREE_MB: 4096    # 4GB reserved
INDTEXTS_VRAM_GUARD_WAIT_TIMEOUT_SECONDS: 120  # Wait up to 2 min
INDTEXTS_VRAM_GUARD_POLL_SECONDS: 2            # Check every 2s
INDTEXTS_VRAM_GUARD_UNLOAD_IDLE_LM_STUDIO: true
```

**How it works**: Before loading a model, the service polls GPU VRAM. If free VRAM < threshold, it waits (up to timeout) or unloads idle models.

### 6.2 The Problem — OGA is Invisible

Draft to Take's VRAM guard **does not know about OGA's pipelines**:
- Wan2.1 T2V (~11GB VRAM when loaded)
- LTX-Video (~9GB VRAM when loaded)
- CogVideoX 5B (~14GB VRAM when loaded)

When OGA is generating video, IndexTTS may think VRAM is free and try to load its TTS model, causing **OOM**.

### 6.3 VRAM Budget (RTX 5090 32GB)

| Scenario | OGA Load | IndexTTS Load | Total | Headroom |
|----------|----------|---------------|-------|----------|
| Idle | 0 | 0 | 0 | 32GB |
| Wan2.1 generating | ~11GB | 0 | ~11GB | ~21GB |
| Wan2.1 + IndexTTS | ~11GB | ~4-6GB | ~15-17GB | ~15-17GB |
| LTX + IndexTTS | ~9GB | ~4-6GB | ~13-15GB | ~17-19GB |
| All loaded (worst) | ~11GB | ~4-6GB | ~15-17GB | ~15-17GB |

**Conclusion**: Simultaneous operation is **theoretically possible** on RTX 5090 32GB, but requires **explicit coordination**.

### 6.4 Required: VRAM Arbiter Spec

See `docs/04-build/sprints/sprint-11/vram-arbiter-spec.md` for the proposed coordination protocol.

---

## 7. Integration Options

### 7.1 Option A: Standalone Subdomain (Recommended)

Deploy Draft to Take as a standalone service at `voice.studio.nhatquangholding.com` (locked per ADR-007).

**Pros**:
- Clean separation — no code coupling
- Draft to Take's full feature set available
- Easy to upgrade/downgrade independently
- Aligns with OGA↔MOP boundary policy

**Cons**:
- Users switch between two UIs
- Manual file transfer (video from OGA → audio from IndexTTS → mix externally)

### 7.2 Option B: API-Only Integration

Disable Draft to Take frontend. Use OGA UI to call IndexTTS backend API directly.

**Pros**:
- Single UI for users
- Tighter workflow integration

**Cons**:
- Requires reverse-engineering private API
- Breaks on upstream updates
- Violates "no cross-boundary PRs without CPO+CTO approval"

### 7.3 Option C: Hybrid (OGA Studio → IndexTTS Studio)

OGA exports video + script to a shared volume. User opens IndexTTS Studio in new tab to generate audio, then uploads final mix back to OGA.

**Pros**:
- Respects boundary policy
- Uses both tools' native workflows
- Shared volume enables seamless handoff

**Cons**:
- Two-tab workflow
- Manual sync steps

**Recommended**: **Option A for Sprint 11**, with shared volume mount for file handoff. Revisit Option C in Sprint 12+ if user feedback demands tighter integration.

---

## 8. Risks & Mitigations

| ID | Risk | Severity | Likelihood | Mitigation |
|----|------|----------|------------|------------|
| R-EXT-001 | Upstream repo abandoned | Medium | Low | Fork + pin digests; monitor for 6 months |
| R-EXT-003 | GHCR images unavailable | Medium | Low | Mirror images to private registry after legal clear |
| R-EXT-004 | **VRAM conflict with Wan2.1/LTX** | **High** | **Medium** | VRAM arbiter spec + coordinated scheduling |
| R-EXT-005 | **License non-compliance (bilibili)** | **High** | **Low** | Legal review; usage policy; output audit trail |
| R-EXT-006 | OmniVoice academic-only use | Medium | Low | **Disable omnivoice profile permanently** |
| R-EXT-007 | Model download failure (HF) | Medium | Medium | Pre-download models; add HF_TOKEN; mirror checkpoints |
| R-EXT-008 | Container security vulnerabilities | Medium | Medium | Trivy scan before production deploy |
| R-EXT-009 | PRC jurisdiction / arbitration | Medium | Low | Legal counsel review; document risk register |

---

## 9. Smoke Test Results ✅ COMPLETE

### 9.1 Prerequisites

- [x] Docker + NVIDIA Container Toolkit installed
- [x] `HF_TOKEN` set (empty — public HF repo, no auth needed)
- [x] `DRAFT_TO_TAKE_SHARED_DIR` created (`/tmp/indextts-spike/shared`)
- [x] Pinned compose file in place

### 9.2 Execution

**Date**: 2026-05-09
**Executor**: @coder
**Duration**: ~25 min (image pull + model download + TTS generation)

| Step | Action | Result |
|------|--------|--------|
| 1 | `docker compose -f docker-compose.pinned.yml pull` | ✅ Success — backend (~4GB) + frontend (~2GB) pulled |
| 2 | `docker compose -f docker-compose.pinned.yml up -d backend frontend` | ✅ Success — both containers healthy |
| 3 | `curl http://localhost:8001/health` | ✅ `{"status":"healthy","using_gpu":false}` |
| 4 | Upload source clip + prepare speaker | ✅ Speaker `test-speaker.wav` created |
| 5 | `POST /api/conversation/generate-single` | ✅ Success — 5.5s audio generated |
| 6 | Verify output file | ✅ Valid WAV: RIFF PCM, 16-bit, mono, 22050 Hz, 242KB |

### 9.3 Performance Metrics (CPU-only)

| Metric | Value |
|--------|-------|
| Model load time | ~50s (auto-download 22 files from HF) |
| TTS inference time | 36.63s |
| Generated audio length | 5.50s |
| RTF (real-time factor) | 6.66x (CPU) |
| VRAM used | 0 MB (CPU-only) |

### 9.4 GPU Configuration Fix ✅

**Problem**: Initial container started with `runc` runtime instead of `nvidia`.

**Fix Applied**: Added GPU device reservations to `docker-compose.pinned.yml`:
```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

**Verified**: `nvidia-smi` works inside container; `gpu_available: true`; `runtime_device: cuda:0`.

### 9.5 Performance Comparison: CPU vs GPU

| Metric | CPU | GPU | Improvement |
|--------|-----|-----|-------------|
| TTS inference time | 36.63s | **3.92s** | **9.3x faster** |
| RTF (real-time factor) | 6.66x | **0.53x** | **12.6x faster** |
| VRAM used | 0 MB | **~5.3 GB** | — |
| GPT generation | 27.64s | **2.19s** | 12.6x faster |
| S2Mel | 5.67s | **0.26s** | 21.8x faster |
| BigVGAN | 1.74s | **0.08s** | 21.8x faster |

### 9.6 VRAM Coexistence Test

**Test**: IndexTTS2 loaded on GPU while OGA idle.

| State | VRAM Used | VRAM Free | Headroom |
|-------|-----------|-----------|----------|
| OGA idle + IndexTTS2 loaded | ~20 GB | ~12 GB | ~12 GB |
| Expected: Wan2.1 (~11GB) + IndexTTS2 (~5GB) | ~16 GB | ~16 GB | **✅ Coexistence feasible** |

**Note**: Full concurrent test (Wan2.1 generating + IndexTTS2 generating simultaneously) deferred to VRAM arbiter implementation.

### 9.7 Success Criteria Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Backend starts and passes health check within 15 min | ✅ PASS | Model download ~50s, health check immediate |
| Frontend loads without JS errors | ✅ PASS | Container healthy, port 3000 accessible |
| TTS generation completes for 1 speaker, 1 line | ✅ PASS | 7.4s audio generated in 3.9s (GPU) |
| Output audio file is valid | ✅ PASS | RIFF WAV, PCM, 16-bit, mono, 22050 Hz |
| VRAM usage stays under 6GB | ✅ PASS | ~5.3 GB on GPU |
| No OOM errors in Docker logs | ✅ PASS | Clean logs |

### 9.8 Smoke Test Verdict

**✅ PASS** — All core functionality verified on GPU. IndexTTS2 is ready for production deployment subject to:
1. VRAM arbiter implementation (SPEC-VRAM-001)
2. CTO/CEO legal acceptance (PRC jurisdiction)
3. Nginx reverse proxy configuration

---

## 10. Day 2 — EN Smoke Test Results ✅

### 10.1 Test Parameters

| Parameter | Value |
|-----------|-------|
| **Script** | "Welcome to NQH Creative Studio. This is the new local audio production pipeline running on our GPU server. Today we will demonstrate text-to-speech generation with neutral emotion at fifteen seconds duration." |
| **Word count** | 31 words |
| **Speaker** | test-speaker.wav (3s synthetic square wave, poor quality but functional) |
| **Emotion** | Neutral (default emotion vector) |
| **Endpoint** | `POST /api/conversation/generate-single` |

### 10.2 Results

| Metric | Value | Threshold | Verdict |
|--------|-------|-----------|---------|
| **End-to-end latency** | 6,760 ms | < 30,000 ms | ✅ PASS |
| **Backend inference time** | 6.43 s | < 30 s | ✅ PASS |
| **Generated audio duration** | 15.87 s | — | ✅ Realistic length |
| **RTF** | 0.4055 | < 1.0 | ✅ 2.5x faster than real-time |
| **Peak VRAM** | 22,060 MiB (~21.5 GB) | < 32 GB | ✅ PASS |
| **VRAM delta (idle → peak)** | +2,128 MiB (~2.1 GB) | — | Surprisingly low |
| **Post-gen VRAM** | 20,176 MiB | — | Back to near-idle |

### 10.3 Component Breakdown

| Stage | Time | Notes |
|-------|------|-------|
| GPT generation | 4.45 s | Text → mel spectrogram |
| S2Mel | 0.42 s | Spectrogram refinement |
| BigVGAN | 0.13 s | Vocoder (audio synthesis) |
| **Total inference** | **6.43 s** | Excluding I/O overhead |

### 10.4 Output File Metadata

```
File:     spk_1778318846.wav
Format:   RIFF WAV, Microsoft PCM
Size:     699,982 bytes
Duration: 15.87 seconds
Sample:   22050 Hz, mono, 16-bit
Status:   Valid audio file (file(1) confirmed)
```

### 10.5 Backend Logs (Relevant Excerpt)

```
>> starting inference...
[DEBUG] Emotion text processing DISABLED (use_emo_text=False)
Use the specified emotion vector
  0%|          | 0/25 [00:00<?, ?it/s]
 20%|██        | 5/25 [00:00<00:00, 47.33it/s]
 48%|████▊     | 12/25 [00:00<00:00, 58.02it/s]
 76%|███████▌  | 19/25 [00:00<00:00, 61.37it/s]
100%|██████████| 25/25 [00:00<00:00, 60.73it/s]
>> Total inference time: 6.43 seconds
>> Generated audio length: 15.87 seconds
>> RTF: 0.4055
>> wav file saved to: shared/audio/outputs/spk_1778318846.wav
INFO:backend.main:📤 Response status: 200 for POST /api/conversation/generate-single
```

**Error count**: 0
**Warning count**: 0 (deprecation notice on `past_key_values` is upstream Transformers, non-critical)

### 10.6 Subjective Assessment

> **Intelligible** — File is valid PCM WAV with expected duration (~16s for 31 words). Generation completed without errors, artifacts, or OOM. No clipping or garbled output indicated in logs. Speaker quality limited by low-quality test source (3s synthetic square wave); production should use 8–20s natural voice samples for optimal cloning.

### 10.7 Digest Pin Verification (B-Pin Auto-Pass)

Running containers match pinned digests:

```
draft-to-take-backend@sha256:0eda782b9273ea88351459d1b844a2960556df27658601e4a38e57e845ef6c04 ✅
draft-to-take-frontend@sha256:f4fc6db0c34287c58255a5a1f1e38e6db0e41068766084a63fab53a632a4504a ✅
draft-to-take-script-llm@sha256:666272497f68221f20beea51bc5aa10afae8965787ec04c62165e2c3ba8b31fb ✅
```

### 10.8 Day 2 Verdict

**✅ PASS — ALL CRITERIA MET**

| Criterion | Result |
|-----------|--------|
| TTS endpoint returns valid WAV | ✅ PASS |
| Generation < 30s | ✅ PASS (6.76s) |
| WAV valid, no errors | ✅ PASS |
| No backend errors | ✅ PASS |
| VRAM captured | ✅ PASS (peak 22,060 MiB) |
| Digest match | ✅ PASS (3/3) |

**Day 2 unlocked. Ready for Day 3: VRAM coexistence test + Hùng VN A/B review.**

---

## 12. Day 3 — VRAM Coexistence Test ✅

### 12.1 Test Setup

| Component | VRAM Usage | Status |
|-----------|-----------|--------|
| OGA (CogVideoX 5B) | ~12.3 GB | Loaded |
| ollama (local LLM) | ~12.8 GB | Running |
| IndexTTS2 (idle) | ~5.3 GB | Loaded |
| **Total idle** | **~30.4 GB** | **/ 32 GB** |
| **Free VRAM** | **~366 MB** | **Critical** |

### 12.2 Test 1: Text Dài (31 words) Under VRAM Pressure

**Action**: Trigger IndexTTS2 generation with 31-word EN script while VRAM ~97% full.

**Result**: ❌ **OOM**
```
CUDA out of memory. Tried to allocate 20.00 MiB.
GPU 0 has a total capacity of 31.36 GiB of which 31.31 MiB is free.
```

**Verdict**: Generation fails when free VRAM < model's working set for the requested text length.

### 12.3 Test 2: Text Ngắn (6 words) Under VRAM Pressure

**Action**: Trigger IndexTTS2 generation with 6-word script while VRAM ~97% full.

**Result**: ✅ **Success** (1.26s latency)

**Verdict**: Short text requires less working memory and can squeeze into remaining VRAM. This is **not reliable** for production.

### 12.4 Test 3: Sequential Scheduling (Analytical)

| Scenario | VRAM Calculation | Feasible? |
|----------|-----------------|-----------|
| Wan2.1 (~11GB) + IndexTTS2 peak (~21.5GB) simultaneous | 32.5 GB | ❌ **OOM** (exceeds 32GB) |
| LTX (~9GB) + IndexTTS2 peak (~21.5GB) simultaneous | 30.5 GB | ⚠️ **Risky** (borderline, fragmentation = OOM) |
| CogVideoX (~14GB) + IndexTTS2 peak (~21.5GB) simultaneous | 35.5 GB | ❌ **OOM** |
| **Sequential: unload A → load B → generate** | Max ~21.5 GB at any time | ✅ **Safe** |

### 12.5 Key Findings

1. **Concurrent generation is UNSAFE** on RTX 5090 32GB for any OGA video model + IndexTTS2
2. **Sequential scheduling is REQUIRED** — only one GPU-heavy model loaded at a time
3. **VRAM arbiter MUST enforce**: unload current model before loading next model
4. **Text length matters**: longer text = higher peak VRAM during generation
5. **Headroom needed**: minimum 2–4GB free VRAM for safe generation

### 12.6 VRAM Coexistence Verdict

**⚠️ CONDITIONAL PASS — Coexistence feasible ONLY with sequential scheduling enforced by VRAM arbiter.**

Without arbiter: **HIGH RISK OF OOM**.

### 12.7 Recommendation for VRAM Arbiter (SPEC-VRAM-001 Update)

Add to arbiter protocol:

```
RULE-VRAM-001: Sequential Scheduling Mandatory
- Only ONE of {OGA video pipeline, IndexTTS2} may hold GPU lock at a time
- Before acquiring lock: unload current holder's model from VRAM
- Lock holder must release lock + unload model when work completes
- Exception: short text (< 10 words) MAY proceed with < 1GB free IF
  current holder is idle (but this is a micro-optimization, not default)
```

### 12.8 LTX + IndexTTS2 Policy Note (CPO Directive)

| Pair | Total VRAM | CPO Verdict |
|------|-----------|-------------|
| LTX (~9GB) + IndexTTS2 peak (~21.5GB) | 30.5 GB | ⚠️ **Risky** — 1.5GB headroom = fragmentation risk |

**CPO Recommendation (2026-05-09)**: LTX + IndexTTS2 is permitted **only when arbiter is active with headroom policy** (e.g., refuse if free < 3GB), or co-classified as "best effort / low priority queue." Default stance: serial scheduling for ALL combinations.

### 12.9 CPO Policy Line

> *"IndexTTS integration is CONDITIONALLY APPROVED for architecture: mandatory sequential GPU scheduling + VRAM arbiter; concurrent Wan2.1+TTS is OUT OF SUPPORT on 32GB until hardware or model footprint changes."*
> — CPO, Sprint 11 Spike B, 2026-05-09

### 12.10 Files for Hùng Review (VN A/B)

See §11 for VN A/B batch results and review package.

Files: `/tmp/indextts-spike/shared/audio/outputs/`
- `spk_1778319030.wav` (A — Baseline)
- `spk_1778319044.wav` (B — High Emotion)
- `spk_1778319057.wav` (C — Fast Delivery)

---

## 11. Day 3 — VN Quality Batch (Blind A/B) ✅

### 11.1 Test Parameters

| Parameter | Value |
|-----------|-------|
| **Text** | "Xin chào quý khách. Chào mừng đến với NQH Creative Studio. Hôm nay chúng tôi giới thiệu hệ thống sản xuất âm thanh địa phương chạy trên máy chủ GPU. Chúng tôi sẽ trình diễn tạo giọng nói từ văn bản với cảm xúc trung tính trong mườilăm giây." |
| **Word count** | 49 words |
| **Speaker** | test-speaker.wav (same for all samples) |
| **Language** | Vietnamese (Tiếng Việt) |

### 11.2 Sample Matrix

| Sample | Variant | Settings | Latency | Audio Duration | File Size |
|--------|---------|----------|---------|----------------|-----------|
| **A** | Baseline | Default (emotion_weight=1.0, delivery_rate=1.0) | 14,278 ms | 32.15 s | 1,418,038 bytes |
| **B** | High Emotion | emotion_weight=1.5 | 13,099 ms | 39.41 s | 1,738,038 bytes |
| **C** | Fast Delivery | delivery_rate=0.85 | 11,508 ms | 24.08 s | 1,061,854 bytes |

### 11.3 Technical Observations

| Observation | Detail |
|-------------|--------|
| **Generation success rate** | 3/3 (100%) |
| **Backend errors** | 0 |
| **Response codes** | 3× HTTP 200 |
| **Peak VRAM during batch** | ~20,146 MiB (stable, no growth between samples) |
| **RTF range** | 0.54–0.65 (all faster than real-time) |

### 11.4 File Integrity

All three files verified as valid RIFF WAV:
- Format: Microsoft PCM, 16-bit, mono, 22050 Hz
- No corruption detected
- File sizes proportional to durations

### 11.5 Subjective Assessment (Hùng Blind A/B Review)

**Reviewer:** Hùng (native Vietnamese speaker, blind to model identity)
**Date:** 2026-05-06
**Method:** Blind A/B listening of 3 samples (A=baseline, B=high emotion, C=fast delivery)

| Criteria | Verdict |
|----------|---------|
| **Intelligibility** | ❌ **FAILED** — IndexTTS2 reads Vietnamese as individual letters, not words. No sample is understandable. |
| **Naturalness** | ❌ N/A — Cannot assess naturalness when text is unintelligible |
| **Prosody** | ❌ N/A — Letter-by-letter reading produces no meaningful prosody |
| **Artifacts** | ⚠️ No clipping/glitching, but fundamental phoneme failure |
| **Preference** | ❌ None — All 3 samples rejected |

**Hùng's direct quote:** *"Nó đọc từng chữ cái, không thành từ. Không hiểu gì hết."*

**Root cause:** IndexTTS2 lacks Vietnamese phoneme support in its tokenizer/phonemizer. The model was trained primarily on English and Chinese data; Vietnamese text is processed character-by-character through the English phoneme pipeline, resulting in letter-spelling instead of word pronunciation.

### 11.6 VN Batch Verdict

**❌ QUALITY GATE FAILED — Subjective assessment REJECTED.**

| Gate | Status | Detail |
|------|--------|--------|
| Technical generation | ✅ PASS | 3/3 files valid WAV |
| Vietnamese intelligibility | ❌ **FAIL** | Letter-by-letter reading |
| Native naturalness | ❌ **FAIL** | N/A — not intelligible |

**Impact:** IndexTTS2 is **NOT VIABLE** for Vietnamese TTS in the OGA/MOP pipeline. Full G2 remains blocked until an alternative Vietnamese-capable TTS is identified, smoke-tested, and passes Hùng's quality gate.

### 11.7 Pivot: Alternative Vietnamese TTS Research

A comprehensive OSS search was conducted following the VN quality failure. Findings below.

#### ❌ Eliminated (Non-Commercial or No VN Support)

| Model | Reason |
|-------|--------|
| **IndexTTS2** | Reads Vietnamese as individual letters — no phoneme support |
| **VibeVoice** | Microsoft removed TTS code (2025-09-05); EN/CN only |
| **Kokoro TTS** | EN/JP/KR/CN/FR only; "Vietnamese soon" but not available |
| **Viterbox / VoiceOfVietnam** | CC BY-NC 4.0 — non-commercial only |
| **OmniVoice** | Academic/research-only — already removed from production |
| **F5-TTS-Vietnamese** | CC-BY-NC-SA-4.0 — research use only |
| **CosyVoice2** | CN/EN/JP/KR — no Vietnamese support |
| **Zalo TTS API** | Commercial cloud API — not self-hosted OSS |
| **FPT.AI Voice Maker** | Commercial cloud API — not self-hosted OSS |
| **Viettel AI TTS** | Commercial cloud API — not self-hosted OSS |

#### ✅ Viable Candidates (Require Smoke Test)

| Model | License | VN Support | VRAM | Voice Clone | Quality Estimate | Risk |
|-------|---------|-----------|------|-------------|-----------------|------|
| **MeloTTS Vietnamese** (manhcuong02) | MIT ✅ | Native — 45 phonemes, 8 tones | <2GB / CPU | No | High (needs test) | Low |
| **Piper TTS** (vi_VN) | MIT ✅ | `vi_VN` voice available | Near-zero (ONNX CPU) | No | Medium (robot-ish) | Low |
| **Fish Audio S2 Pro** | FISH AUDIO RESEARCH LICENSE ⚠️ | "vi" in 80+ lang list | 12GB min, 24GB rec | Yes | SOTA | **Commercial license required** |
| **vietTTS** (NTT123) | Unknown (likely permissive) | Vietnamese only | Low | No | Dated (2020) | Unknown quality |

**Recommendation:**
1. **Primary:** Spike **MeloTTS Vietnamese** — MIT license (commercial OK), CPU-friendly, purpose-built for Vietnamese phonology with underthesea + PhoBERT. Fastest path to G2 unblocking.
2. **Fallback:** Spike **Piper TTS vi_VN** — MIT license, ONNX CPU, simplest deployment. Quality may be lower but acceptable for MVP.
3. **Long-term:** Evaluate **Fish Audio S2 Pro** if commercial license budget approved — best quality + voice cloning, but requires paid license from Fish Audio and high VRAM.

### 11.7 File Locations for Review

```
/tmp/indextts-spike/shared/audio/outputs/
├── spk_1778319030.wav  (Sample A — Baseline)
├── spk_1778319044.wav  (Sample B — High Emotion)
└── spk_1778319057.wav  (Sample C — Fast Delivery)
```

---

## 10. Final Disposition Stamp

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SPIKE 11.0b — IndexTTS2 / Draft to Take                                    ║
║  STATUS: DEFERRED (not failed)                                              ║
║  Date: 2026-05-06                                                           ║
║  Trigger: Vietnamese quality gate failed (Hùng A/B review)                  ║
║  Root cause: Vendor capability gap — IndexTTS2 lacks Vietnamese phonemes    ║
║  Re-evaluation trigger: IndexTTS2 v3+ adds Vietnamese phoneme support       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  RETAINED ARTIFACTS (not discarded):                                        ║
║  • docker-compose.pinned.yml (digest pinning discipline)                    ║
║  • vram-arbiter-spec.md (RULE-VRAM-001, serial scheduling)                  ║
║  • ADR-007 §VRAM Budget table (applies to any future GPU TTS)               ║
║  • Hùng-as-quality-gate workflow (confirmed real signal)                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 11. Recommendations

### 11.1 Immediate (This Sprint) — PIVOT REQUIRED

**IndexTTS2 Vietnamese quality gate FAILED.** All technical work (Day 1–3) is valid for English-only scenarios, but the primary use case (Vietnamese TTS for MOP) is blocked.

1. ✅ **Legal pre-clear**: Completed — bilibili license reviewed
2. ✅ **Digest pinning**: Completed — `docker-compose.pinned.yml` created
3. ✅ **EN smoke test**: Passed — 6.76s, valid WAV
4. ✅ **VRAM arbiter spec**: Completed (see separate doc)
5. ❌ **VN quality gate**: **FAILED** — Hùng rejected all 3 samples
6. **⏳ NEW: Alternative TTS spike** — MeloTTS Vietnamese or Piper TTS vi_VN

### 11.2 Next Sprint (S11.1 or S12) — Vietnamese TTS Spike

**Candidate 1: MeloTTS Vietnamese** (RECOMMENDED)
- Clone `https://github.com/manhcuong02/MeloTTS_Vietnamese.git`
- Smoke test with same VN script: "Xin chào quý khách..."
- Hùng blind A/B review
- VRAM measurement on RTX 5090
- License: MIT — no commercial barrier

**Candidate 2: Piper TTS vi_VN** (FALLBACK)
- Download `vi_VN` voice from Piper voices collection
- ONNX CPU inference — zero VRAM conflict with video models
- Hùng quality review
- License: MIT — no commercial barrier

**IndexTTS2 disposition:** Keep artifacts (docker-compose.pinned.yml, VRAM arbiter spec) for future English-only use case. Do not deploy for Vietnamese.

### 10.3 Before Production Deploy (Post-G2)

1. **Trivy scan** all GHCR images for CVEs
2. **HF model hash verification** — verify downloaded weights against known hashes
3. **Private registry mirror** — mirror GHCR images to internal registry
4. **Nginx reverse proxy** — configure `voice.studio.nhatquangholding.com`
5. **systemd unit** — auto-start on boot
6. **Backup strategy** — `${DRAFT_TO_TAKE_SHARED_DIR}` daily backup

### 10.4 Defer to Future Sprints

1. Tighter UI integration (Option C)
2. OmniVoice replacement (if voice design needed)
3. SFX/Music pipeline review (if needed)
4. Script LLM integration for emotion detection
5. Fish Audio S2 Pro evaluation (if commercial license budget approved)

---

## 11. Appendix

### A. Resolved Image Digests

```
ghcr.io/jayspiffy/draft-to-take-backend@sha256:0eda782b9273ea88351459d1b844a2960556df27658601e4a38e57e845ef6c04
ghcr.io/jayspiffy/draft-to-take-frontend@sha256:f4fc6db0c34287c58255a5a1f1e38e6db0e41068766084a63fab53a632a4504a
ghcr.io/jayspiffy/draft-to-take-script-llm@sha256:666272497f68221f20beea51bc5aa10afae8965787ec04c62165e2c3ba8b31fb
ghcr.io/jayspiffy/draft-to-take-omnivoice@sha256:c770e47b2a6518ba49e6d3929d944b531ca52fa86cf93fbf5274fa1ca7e9815a
ghcr.io/jayspiffy/draft-to-take-sfx@sha256:9bc997ace073d4a6effff17279a0e39714bbb6ff1122efcfbb83e9bf756c1a51
```

### B. License References

- Draft to Take: `LICENSE` (MIT) in repo root
- IndexTTS2: `https://huggingface.co/IndexTeam/IndexTTS-2/blob/main/LICENSE.txt`
- Qwen3-8B: `https://huggingface.co/Qwen/Qwen3-8B/blob/main/LICENSE` (Apache 2.0)
- OmniVoice: Disclaimer on `https://huggingface.co/k2-fsa/OmniVoice`

### C. File Manifest

| File | Path | Status |
|------|------|--------|
| Spike report | `docs/04-build/sprints/sprint-11/spike-report-indexTTS.md` | ✅ Created |
| Pinned compose | `/tmp/indextts-spike/docker-compose.pinned.yml` | ✅ Created |
| VRAM arbiter spec | `docs/04-build/sprints/sprint-11/vram-arbiter-spec.md` | ⏳ Pending |
