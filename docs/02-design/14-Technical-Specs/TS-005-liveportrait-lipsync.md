---
ts_id: TS-005
title: "LivePortrait Lip Sync Endpoint"
ts_version: "1.0.0"
status: Superseded
stage: "02-design"
owner: "@architect"
created: 2026-05-05
last_updated: 2026-05-06
references:
  - ADR-005 (docs/02-design/01-ADRs/ADR-005-lipsync-architecture.md)
  - ADR-003 (docs/02-design/01-ADRs/ADR-003-hot-swap-architecture.md)
  - TS-003 (docs/02-design/14-Technical-Specs/TS-003-pipeline-hot-swap.md)
gate: G2
---

# TS-005: LivePortrait Lip Sync Endpoint (Archived for Reference)

## 1. Overview

> Superseded by Sprint 9 decision in `ADR-005`: Lip Sync remains cloud-only in current phase.
> This document is retained as historical implementation reference only and is not an active build target.

Add lip sync video generation to `local-server/server.py` via LivePortrait (MIT).
Endpoint accepts image/video + audio, returns lip-synced MP4 video. Uses RetinaFace
(MIT) for face detection instead of InsightFace (NC risk).

---

## 2. POST /api/v1/lip-sync Endpoint

### 2.1 Request

```http
POST /api/v1/lip-sync
Content-Type: application/json

{
    "image": "data:image/png;base64,...",
    "audio": "data:audio/wav;base64,...",
    "video": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | string | Yes (if no video) | Base64 data URL of portrait image |
| `video` | string | Yes (if no image) | Base64 data URL of source video |
| `audio` | string | Yes | Base64 data URL or HTTPS URL of audio |

Exactly one of `image` or `video` must be provided. `audio` is always required.

### 2.2 Success Response (200)

```json
{
    "status": "completed",
    "output": "data:video/mp4;base64,...",
    "_meta": {
        "model": "LivePortrait",
        "input_mode": "image",
        "duration_seconds": 5.0,
        "frames": 150,
        "fps": 30,
        "resolution": "512x512",
        "elapsed_seconds": 28.3,
        "ram_mb": 6200,
        "face_detected": true,
        "face_detector": "retinaface"
    }
}
```

### 2.3 Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | No image or video provided | `{"error": "Provide either image or video"}` |
| 400 | Both image and video provided | `{"error": "Provide image OR video, not both"}` |
| 400 | No audio provided | `{"error": "Audio is required"}` |
| 400 | Invalid base64 | `{"error": "Invalid base64 encoding"}` |
| 413 | Image > 10MB or video > 50MB or audio > 10MB | `{"error": "File too large", "max_mb": N}` |
| 422 | No face detected in image | `{"error": "No face detected", "suggestion": "Upload a clear frontal portrait"}` |
| 422 | Audio too long (> 30s) | `{"error": "Audio too long (max 30s)", "duration_s": N}` |
| 503 | LivePortrait not available | `{"error": "Lip sync engine not available"}` |
| 503 | RAM over 85% cap | `{"error": "Server overloaded", "headers": {"Retry-After": "30"}}` |
| 503 | Pipeline swap in progress | `{"error": "Pipeline swap in progress"}` |
| 409 | Generation in progress | `{"error": "Generation in progress"}` |

---

## 3. Pipeline Architecture

### 3.1 Loading Path

```python
def load_liveportrait_pipeline():
    """Load LivePortrait model + RetinaFace detector."""
    global _lipsync_model, _face_detector

    # 1. Load RetinaFace (MIT)
    from retinaface import RetinaFace as RF
    _face_detector = RetinaFaceAdapter(RF)

    # 2. Load LivePortrait
    from liveportrait import LivePortraitPipeline
    _lipsync_model = LivePortraitPipeline(
        device="mps" if torch.backends.mps.is_available() else "cpu",
        dtype=torch.bfloat16
    )
```

### 3.2 Integration with Hot-Swap State Machine

LivePortrait uses the same state machine as diffusers pipelines (TS-003):

```python
# models.json entry
{
    "id": "liveportrait",
    "frontend_ids": ["liveportrait", "lip-sync"],
    "name": "LivePortrait",
    "pipeline": null,
    "model_type": "custom",
    "loader": "load_liveportrait_pipeline",
    "default": {},
    "features": ["lip-sync"],
    "ram_gb": 4
}
```

State transitions follow TS-003 exactly:
- `IDLE → LOADING → READY → GENERATING`
- Uses `_gen_lock` during inference
- `_swap_lock` for load/unload lifecycle
- On swap: unload LivePortrait → gc.collect() → torch.mps.empty_cache()

### 3.3 Lazy-Load Pattern

Following Sprint 7 IP-Adapter pattern:

```python
async def lip_sync_endpoint(req):
    # Auto-load if not loaded
    if not is_liveportrait_loaded():
        await auto_swap_to("liveportrait")

    async with _gen_lock:
        _state = PipelineState.GENERATING
        try:
            result = await asyncio.to_thread(generate_lipsync, req)
        finally:
            _state = PipelineState.READY
            # Optional: unload after to free RAM on 24GB
            if PIPELINE_CACHE_SIZE == 1:
                schedule_unload(delay_seconds=60)
```

Delayed unload (60s): keeps model warm for rapid re-use, unloads if idle.

---

## 4. Face Detection Adapter

### 4.1 RetinaFaceAdapter

```python
class RetinaFaceAdapter:
    """Adapts RetinaFace (MIT) to LivePortrait's detector interface."""

    def __init__(self, backend):
        self.backend = backend

    def detect(self, image_np: np.ndarray) -> list[dict]:
        """
        Returns list of detected faces with:
        - bbox: [x1, y1, x2, y2]
        - landmarks: 5-point facial landmarks
        - confidence: float 0-1
        """
        faces = self.backend.detect_faces(image_np)
        results = []
        for face_id, face_data in faces.items():
            results.append({
                "bbox": face_data["facial_area"],
                "landmarks": self._extract_landmarks(face_data["landmarks"]),
                "confidence": face_data["score"],
            })
        return sorted(results, key=lambda f: f["confidence"], reverse=True)

    def _extract_landmarks(self, landmarks: dict) -> np.ndarray:
        """Convert RetinaFace landmark dict to 5x2 numpy array."""
        return np.array([
            landmarks["left_eye"],
            landmarks["right_eye"],
            landmarks["nose"],
            landmarks["mouth_left"],
            landmarks["mouth_right"],
        ], dtype=np.float32)
```

### 4.2 Fallback: MediaPipe

If RetinaFace accuracy < 90%:

```python
class MediaPipeAdapter:
    """Fallback: MediaPipe Face Detection (Apache 2.0)."""

    def __init__(self):
        import mediapipe as mp
        self.detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1,  # full range
            min_detection_confidence=0.5
        )
```

---

## 5. Audio Processing

### 5.1 Preprocessing

```python
import torchaudio

def preprocess_audio(audio_bytes: bytes) -> torch.Tensor:
    """Load audio, resample to 16kHz mono."""
    waveform, sample_rate = torchaudio.load(io.BytesIO(audio_bytes))

    # Mono
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    # Resample to 16kHz
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(sample_rate, 16000)
        waveform = resampler(waveform)

    return waveform
```

### 5.2 Duration Limit

Max 30 seconds. Check before model load to avoid wasting resources:

```python
duration_s = waveform.shape[1] / 16000
if duration_s > 30:
    raise HTTPException(422, {"error": f"Audio too long (max 30s)", "duration_s": round(duration_s, 1)})
```

---

## 6. Memory Budget

### 6.1 24GB MacBook (Lazy-Load)

| Phase | RAM |
|-------|-----|
| Before load | ~0MB (LivePortrait) |
| Model load | ~4GB |
| Face detection | +200MB |
| Generation (peak) | ~6-8GB total |
| After unload (60s) | ~0MB |

Co-residency with RMBG (~2GB): ~8-10GB peak during lip sync, within 85% cap.

### 6.2 48GB Mac Mini (Semi-Resident)

| Component | RAM |
|-----------|-----|
| RMBG (always-resident) | ~2GB |
| LivePortrait (cached) | ~4GB |
| Diffusers (cached) | ~6GB |
| **Total** | **~12GB** |
| **Headroom** | **~28GB** |

---

## 7. Output Video

### 7.1 Encoding

```python
def encode_video(frames: list[np.ndarray], fps: int = 30) -> bytes:
    """Encode frames to MP4 H.264 via ffmpeg."""
    import subprocess

    cmd = [
        "ffmpeg", "-f", "rawvideo",
        "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{frames[0].shape[1]}x{frames[0].shape[0]}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264", "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-f", "mp4", "-movflags", "frag_keyframe+empty_moov",
        "-"
    ]
    proc = subprocess.run(cmd, input=b"".join(f.tobytes() for f in frames),
                          capture_output=True, timeout=30)
    return proc.stdout
```

### 7.2 Audio Merge

If input audio provided, merge with generated video:

```python
def merge_audio_video(video_bytes: bytes, audio_bytes: bytes) -> bytes:
    """Merge audio track into MP4 video."""
    # ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -shortest output.mp4
    ...
```

---

## 8. Affected Files

| File | Change | Notes |
|------|--------|-------|
| `local-server/server.py` | Add lip-sync endpoint, LivePortrait loader, RetinaFace adapter | Major (~200 lines) |
| `local-server/models.json` | Add LivePortrait entry with model_type: "custom" | Schema update |
| `local-server/requirements-mac.txt` | Add liveportrait, retinaface, torchaudio | Dependencies |
| `components/StandaloneShell.js` | Activate Lip Sync tab | Flag flip |
| `packages/studio/src/muapi.js` | Add `processLipSyncLocal()` | New function |

---

## 9. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Image + audio → lip-synced video | 200, MP4 returned |
| 2 | Video + audio → lip-synced video | 200, MP4 returned |
| 3 | No face in image | 422, "No face detected" |
| 4 | Audio > 30s | 422, "Audio too long" |
| 5 | Image > 10MB | 413, "File too large" |
| 6 | No audio provided | 400, "Audio is required" |
| 7 | Both image and video | 400, "Provide image OR video" |
| 8 | LivePortrait not installed | 503, graceful degradation |
| 9 | RAM over 85% cap | 503, "Server overloaded" |
| 10 | Swap during lip sync gen | 409, "Generation in progress" |
| 11 | Hot-swap to LivePortrait | 200, model loads via custom path |
| 12 | Hot-swap away from LivePortrait | RAM freed within 5s |

---

*NQH Creative Studio (OGA) | TS-005 v1.0.0 | Proposed 2026-05-05*
