---
handoff_id: HO-S9-PM-GPU
date: 2026-05-06
from: "@coder"
to: "@pm"
scope: "Sprint 9 closure + GPU Server S1 deployment prep"
branch: main@0cdf8127
sprint: 9 (DONE)
---

# Handoff: Sprint 9 → @pm — GPU Server S1 + Mac Mini Deploy

## 1. Executive Summary

**Phase A (Studios Activation): COMPLETE**

| Studio | Mode | Status |
|--------|------|--------|
| Image Studio | ✅ Local (Diffusers + MPS/CUDA) | Sprint 5 — PASS |
| Marketing Studio | ✅ Local (RMBG + IP-Adapter) | Sprint 6-7 — PASS |
| Video Studio | ☁️ Cloud (Muapi/fal.ai) | Sprint 6 — Active, cloud-only |
| Cinema Studio | ☁️ Cloud (Muapi) | Sprint 7 — Active, cloud-only |
| Lip Sync Studio | ☁️ Cloud (Muapi) | Sprint 8-9 — Active, cloud-only |

**Key finding:** Multi-frame diffusion video models (AnimateDiff, CogVideoX) are NOT viable on Apple Silicon MPS. Image generation works locally; video/animation requires GPU (CUDA) or cloud API.

**Next:** Deploy current codebase to GPU Server S1 for team testing. Mac Mini M4 Pro 48GB arrives later for production inference.

---

## 2. Repo State

**Remote:** https://github.com/Minh-Tam-Solution/OGA.git
**Branch:** `main` (commit `0cdf8127`)
**Tests:** 140 pass, 4 pre-existing server-connection fails
**Build:** `npm run build` — 0 errors

### Files Changed in Sprint 9

| File | Change |
|------|--------|
| `docs/04-build/sprints/sprint-9-*.md` | 3 spike reports (Wav2Lip, MuseTalk, CogVideoX) |
| `docs/02-design/01-ADRs/ADR-005-lipsync-architecture.md` | Revised v2.0 — cloud-only decision |
| `docs/04-build/sprints/sprint-8-spike-report.md` | Annotated with CPO feedback |
| `tests/unit/sprint-9.test.mjs` | 19 new tests |
| `local-server/spike_cogvideox.py` | CogVideoX spike script (documentation) |
| `.gitignore` | Added spike artifact exclusions |

### What Was NOT Changed

- No new endpoint implemented (all spikes failed — correctly skipped per plan)
- Lip Sync and Video tabs remain cloud-only
- `server.py` unchanged from Sprint 7 (IP-Adapter endpoint still functional)

---

## 3. GPU Server S1 Setup

### 3.1 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| OS | Ubuntu 22.04+ | GPU Server S1 |
| NVIDIA Driver | 535+ | `nvidia-smi` to verify |
| CUDA | 12.1+ | Required for PyTorch CUDA backend |
| Node.js | 20+ | `node -v` |
| Python | 3.12 | `python3.12 --version` |
| Git | 2.40+ | For submodule support |

### 3.2 Clone & Build

```bash
# 1. Clone repo
git clone https://github.com/Minh-Tam-Solution/OGA.git
cd OGA

# 2. Install Node dependencies
npm install

# 3. Build studio package
npm run build:studio

# 4. Build Next.js
npm run build
```

### 3.3 Python Environment (Local Server)

```bash
# 5. Create Python venv
python3.12 -m venv .venv
source .venv/bin/activate

# 6. Install PyTorch with CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# 7. Install diffusers + dependencies
pip install diffusers transformers accelerate safetensors numpy pillow

# 8. Install server utilities
pip install fastapi uvicorn python-multipart psutil

# 9. Verify CUDA
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

### 3.4 Model Downloads

Models download automatically on first use, but pre-downloading avoids cold-start latency:

```bash
# Z-Image Turbo (default image model) — ~6GB
python -c "from diffusers import AutoPipelineForText2Image; AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', torch_dtype=torch.float16)"

# FLUX.2 Klein 4B (optional) — ~4GB
# (downloads on first /api/v1/swap-model call)

# RMBG u2net (background removal) — ~2GB
# (downloads on first /api/v1/remove-bg call)
```

### 3.5 Environment Configuration

```bash
# 10. Create .env.local for GPU server
cat > .env.local << 'EOF'
# === Local Server (GPU) ===
LOCAL_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LOCAL_MODE=true

# === Provider ===
NEXT_PUBLIC_PROVIDER_MODE=local

# === Cloud (fallback for Video/Cinema/LipSync) ===
# NEXT_PUBLIC_MUAPI_KEY=your_key_here
# NEXT_PUBLIC_WAN2GP_ENABLED=false
EOF
```

### 3.6 Start Services

```bash
# Terminal 1: Local inference server
source .venv/bin/activate
python local-server/server.py
# → Runs on http://localhost:8000

# Terminal 2: Next.js frontend
npm run dev
# → Runs on http://localhost:3000

# Verify: curl http://localhost:8000/health
```

### 3.7 GPU Server Differences from MacBook

| Aspect | MacBook (MPS) | GPU Server S1 (CUDA) |
|--------|---------------|---------------------|
| Device | `mps` | `cuda` |
| Dtype | `bfloat16` (MPS-native) | `float16` (CUDA) |
| RAM | 24GB unified | 24-48GB VRAM + system RAM |
| CPU offload | Required on 24GB | Optional if VRAM sufficient |
| Model load time | ~30-60s (cold) | ~15-30s (cold) |
| Inference speed | ~34-49s/image | ~10-20s/image (estimated) |

**Server auto-detects device:** `local-server/server.py` uses `torch.cuda.is_available()` → CUDA, else `torch.backends.mps.is_available()` → MPS, else CPU.

---

## 4. Feature Matrix on GPU Server S1

| Feature | Local (GPU) | Cloud (Muapi) | Notes |
|---------|-------------|---------------|-------|
| Text-to-image | ✅ Yes | ✅ Yes | Local preferred — zero cost |
| Background removal | ✅ Yes | ✅ Yes | Local preferred — zero cost |
| IP-Adapter product placement | ✅ Yes | ✅ Yes | Local preferred — zero cost |
| Image-to-image | ✅ Yes | ✅ Yes | Local preferred — zero cost |
| Text-to-video | ❌ No | ✅ Yes | CogVideoX too slow — cloud only |
| Image-to-video | ❌ No | ✅ Yes | Cloud only |
| Lip sync | ❌ No | ✅ Yes | No viable local model |
| Cinema (camera controls) | ❌ No | ✅ Yes | Cloud only |
| Marketing (ad generation) | ✅ Partial | ✅ Yes | RMBG local; campaign gen cloud |

---

## 5. Mac Mini Deployment (When Hardware Arrives)

### 5.1 Hardware Spec

| Spec | Value |
|------|-------|
| Model | Mac mini M4 Pro |
| RAM | 48GB |
| Storage | 512GB SSD |
| OS | macOS 15+ |
| Network | LAN (10.0.0.x) |

### 5.2 Deployment Guide

Full guide: `docs/06-deploy/mac-mini-launchd.md`

```bash
# 1. Clone repo on Mac mini
git clone https://github.com/Minh-Tam-Solution/OGA.git
cd OGA

# 2. Install dependencies
npm install && npm run build:studio && npm run build

# 3. Python venv
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r local-server/requirements-mac.txt

# 4. Pre-download models (avoid cold-start on first request)
python local-server/preload_models.py

# 5. Create launchd services
# See docs/06-deploy/mac-mini-launchd.md for plist files

# 6. Start services
launchctl load ~/Library/LaunchAgents/com.nqh.creative-studio.plist
launchctl load ~/Library/LaunchAgents/com.nqh.local-server.plist

# 7. Verify
curl http://mac-mini-ip:8000/health
curl http://mac-mini-ip:3000
```

### 5.3 Mac Mini vs GPU Server S1

| | Mac Mini (48GB) | GPU Server S1 |
|---|---|---|
| **Best for** | Image gen (local, zero cost) | Video/animation (CUDA-accelerated) |
| **Image latency** | ~34-49s | ~10-20s (faster) |
| **Video capability** | ❌ No (MPS limitation) | ⚠️ Possible with smaller models |
| **Cost** | $2,000 one-time | Ongoing (cloud or hosting) |
| **Deployment** | launchd auto-start | systemd or Docker |

**Recommendation:** Use BOTH. Mac Mini for image gen (cost savings). GPU Server S1 for video experiments or cloud fallback.

---

## 6. Known Issues & Workarounds

| Issue | Workaround | Owner |
|-------|-----------|-------|
| `npm run build` warning about `slug` Hook deps | Pre-existing, non-blocking. Safe to ignore. | — |
| `tests/unit/concurrency.test.mjs` fails (4 tests) | Requires running server on :8005. Pre-existing. | — |
| CogVideoX model cache ~11GB | `rm -rf ~/.cache/huggingface/hub/models--THUDM--CogVideoX-2b` if disk full | @pm |
| MPS float64 error (CogVideoX) | Use `pipe.to(device="mps", dtype=torch.float32)` | Documented in spike report |
| Cloud API key required for Video/Cinema/LipSync | Set `NEXT_PUBLIC_MUAPI_KEY` in `.env.local` | @pm |

---

## 7. Verification Checklist for @pm

Before declaring GPU Server S1 ready:

- [ ] `git clone` + `npm install` + `npm run build` → 0 errors
- [ ] Python venv created, CUDA detected
- [ ] `python local-server/server.py` starts on :8000
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] `npm run dev` starts on :3000
- [ ] Image Studio → generate image → PNG displays (E2E)
- [ ] Marketing Studio → remove background → transparent PNG
- [ ] Video Studio → cloud banner visible (local mode)
- [ ] Lip Sync Studio → cloud banner visible (local mode)
- [ ] 140 tests pass (`npm test`)

---

## 8. Next Steps

| Step | Task | Owner | When |
|------|------|-------|------|
| 1 | Deploy to GPU Server S1, run verification checklist | @pm | Now |
| 2 | Test with NQH/MTS content team, collect feedback | @pm | Week 1 |
| 3 | Evaluate cloud API costs for Video/Cinema/LipSync | @pm | Week 1 |
| 4 | Mac Mini arrives → deploy using launchd guide | @pm + dvhiep | TBD |
| 5 | Sprint 10 planning (Production Hardening) | @pm + @cto | After GPU deploy |

---

## 9. Contacts

| Role | Person | Contact |
|------|--------|---------|
| CEO / Product Owner | Tai Dang | taidt@mtsolution.com.vn |
| IT Admin / DevOps | dvhiep | cntt@nqh.com.vn |
| Development | @coder | EndiorBot / Kimi CLI |
| Planning | @pm | EndiorBot / Kimi CLI |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 9 Handoff — 2026-05-06*
