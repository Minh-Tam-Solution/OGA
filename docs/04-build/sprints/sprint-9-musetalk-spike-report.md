---
sprint: 9
task: 9.0b
status: COMPLETE
owner: "@coder"
date: 2026-05-05
---

# Sprint 9.0b — MuseTalk Spike Report

## Objective

Test MuseTalk for audio-driven lip-sync inference on MacBook M4 Pro 24GB.

## Environment

| Item | Value |
|------|-------|
| Hardware | MacBook Pro M4 Pro |
| RAM | 24GB |
| OS | macOS |
| Python | 3.12.13 (main venv) |
| PyTorch | 2.10.0 |
| NumPy | 2.3.5 |
| Diffusers | 0.38.0.dev0 |
| Device | MPS (Metal Performance Shaders) |

## License Verification

| Component | License | Commercial? |
|-----------|---------|-------------|
| MuseTalk code | MIT | ✅ Yes |
| MuseTalk weights | Apache 2.0 | ✅ Yes |
| DWPose weights | Apache 2.0 | ✅ Yes |

**License status: PASS** — MuseTalk is commercially safe.

## Installation Attempt

### Step 1: Clone Repository

```bash
git clone https://github.com/TMElyralab/MuseTalk.git local-server/musetalk
```
✅ Success

### Step 2: Review Requirements

| Dependency | Required | Actual | Compatible? |
|-----------|----------|--------|-------------|
| numpy | 1.23.5 | 2.3.5 | ❌ Pin too old for Python 3.12 |
| torch | 2.0.1 | 2.10.0 | ✅ Newer OK |
| diffusers | 0.30.2 | 0.38.0.dev0 | ✅ Newer OK |
| transformers | 4.30.2 | Installed | ✅ Newer OK |
| tensorflow | 2.12.0 | Not installed | ⚠️ Not actually used in code |
| mmpose | unspecified | Not installed | ❌ Build fails |
| mmcv | unspecified | Not installed | ❌ Build fails |

### Step 3: Module Import Testing

Tested MuseTalk modules with existing environment:

| Module | Result | Notes |
|--------|--------|-------|
| `musetalk.models.vae` | ✅ Success | VAE wrapper around diffusers |
| `musetalk.models.unet` | ✅ Success | UNet wrapper |
| `musetalk.models.syncnet` | ✅ Success | After installing `einops` |
| `musetalk.utils.audio_processor` | ✅ Success | After installing `einops` |
| `musetalk.utils.preprocessing` | ❌ **FAIL** | `ModuleNotFoundError: mmpose` |
| `musetalk.utils.face_detection` | ⚠️ Partial | Import path issue |

### Step 4: mmpose / mmcv Installation

Attempted installation via pip:
```bash
pip install mmpose mmengine mmcv
```

**Result**: `mmcv` wheel build failure on macOS. This is a known issue — mmcv requires
specific compilation flags and often fails to build from source on macOS without pre-built wheels.

Attempted via `mim` (OpenMMLab package manager):
```bash
pip install openmim
mim install mmengine mmcv mmpose
```

**Result**: `AttributeError: module 'pkgutil' has no attribute 'ImpImporter'`
This error occurs due to incompatibility between the installed `setuptools`/`pkg_resources`
and Python 3.12's removal of `pkgutil.ImpImporter`.

### Root Cause Analysis

MuseTalk's preprocessing pipeline depends on **DWPose** (via mmpose) for:
1. Face landmark detection (68-point facial landmarks)
2. Bounding box extraction around the face region
3. Whole-body pose estimation for alignment

Without mmpose, MuseTalk cannot determine which region of the input image/video
to animate. This is a **hard dependency**, not optional.

### Why This Fails on Our Environment

| Issue | Cause |
|-------|-------|
| numpy pin | MuseTalk requirements.txt pins `numpy==1.23.5` which doesn't support Python 3.12 |
| mmpose build | mmcv (required by mmpose) has no pre-built wheels for macOS + Python 3.12 |
| setuptools conflict | Legacy setuptools/pkg_resources incompatible with Python 3.12 |

### Workarounds Evaluated

| Workaround | Feasibility | Notes |
|-----------|-------------|-------|
| Install Python 3.10 | ⚠️ Possible but time-consuming | Requires pyenv or manual install; not on system |
| Patch MuseTalk for newer numpy | ⚠️ Partial | Core modules work, but mmpose still blocks |
| Use RetinaFace instead of mmpose | ❌ Not viable | Would require rewriting preprocessing.py |
| Docker container with Linux | ⚠️ Possible | Beyond scope of local Mac spike |

## Verdict

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| License | Must be commercial-safe | MIT + Apache 2.0 | ✅ Pass |
| Audio-driven lip-sync | Must work | Blocked by dependencies | ❌ **FAIL** |
| MPS support | Must run on Apple Silicon | Cannot test | ⏸️ Blocked |
| Peak RAM | < 8GB | Cannot test | ⏸️ Blocked |
| Latency | < 30s | Cannot test | ⏸️ Blocked |

**Overall Verdict: FAIL (Dependency Blocker)**

MuseTalk is commercially viable but cannot run on the current environment due to
mmpose/mmcv build failures on macOS + Python 3.12. A Python 3.10 environment or
Docker container might resolve this, but is beyond the 2-day spike timebox.

## Recommendations

1. **Lip Sync stays cloud-only for Sprint 9**
2. **Proceed to CogVideoX-2B spike** (Day 3-4 per Sprint 9 plan)
3. **Post-sprint**: Evaluate MuseTalk in an isolated Python 3.10 Docker container
4. **Alternative**: SadTalker (also Apache 2.0) has similar dependency profile but
   may have better macOS support — consider for future spike

---
*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 9.0b Spike Report*
