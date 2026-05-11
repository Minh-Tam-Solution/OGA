# Video Studio — Model Guide for NQH Staff

> **Scope:** Video generation for marketing, social media, and property showcase.  
> **Target audience:** NQH marketing staff, content creators, F&B managers, hotel/tourism coordinators.  
> **Last updated:** 2026-05-06

---

## Available Models (S1 Server — Local Mode)

| Model | Type | Speed | VRAM | Best For |
|-------|------|-------|------|----------|
| **LTX-Video** | Text-to-Video | ~10 sec | ~9 GB | Fast social clips, real-time drafts, quick iterations |
| **Wan2.1 T2V 1.3B** | Text-to-Video | ~130 sec | ~11 GB | Cinematic motion, longer videos, visual text, SOTA quality |
| **CogVideoX 5B** | Text-to-Video | ~40 sec | ~30 GB | Marketing clips (legacy, superseded by LTX/Wan2.1) |

> **Note:** AnimateDiff Lightning is disabled in this build due to diffusers 0.38.0 + RTX 5090 compatibility issues (produces noise). LTX-Video and Wan2.1 are the primary local video models.

---

## Quick Decision Tree

```
What do you need?
├── Fast social media clip (2–3 sec), quick draft
│   └── → LTX-Video (local) — ~10s generation
├── Cinematic video (5+ sec), best quality, visual text
│   └── → Wan2.1 T2V 1.3B (local) — ~2 min generation, 81 frames
├── Legacy marketing clip (2 sec)
│   └── → CogVideoX 5B (local) — kept for backward compatibility
├── High-res cinematic video (10+ sec, 720p+)
│   └── → Contact IT to discuss cloud options (Seedance, Kling)
└── Cloud models (Seedance, Kling, Veo, Sora)
    └── → NOT available in local mode. Use muapi.cloud for cloud generation.
```

---

## LTX-Video — Deep Dive

### What it does
Lightricks LTX-Video — ultra-fast text-to-video diffusion model. Generates 65 frames (~2.7s at 24fps) in ~10 seconds on RTX 5090.

### Strengths
- ⚡ **Ultra-fast:** ~10s for 30 steps — fastest local video model
- 💾 **VRAM efficient:** ~9 GB peak with CPU offload + VAE tiling
- 🎬 **Smooth motion:** 24fps output looks fluid
- 🖼️ **Multiple aspect ratios:** 16:9, 9:16, 1:1, 4:3, 3:4
- ✅ **Commercial safe:** Apache 2.0 license

### Limitations
- **Shorter duration:** ~2.7 seconds max (65 frames)
- **Resolution:** Max 768×512 (landscape) — lower than Wan2.1
- **Quality ceiling:** Good but not SOTA; best for quick drafts and social clips

### Aspect Ratios

| Ratio | Resolution | Use Case |
|-------|------------|----------|
| `16:9` | 768×512 | Landscape (Facebook cover, YouTube shorts) |
| `1:1` | 512×512 | Square (Instagram feed, TikTok) |
| `9:16` | 512×768 | Portrait (Instagram Reels, TikTok, Stories) |
| `4:3` | 640×512 | Classic photo ratio |
| `3:4` | 512×640 | Portrait photo ratio |

### Recommended Settings

| Parameter | Default | When to Change |
|-----------|---------|----------------|
| Steps | 30 | 20 for faster drafts; 40 for slightly better quality |
| Guidance | 3.0 | Lower (2.0) for more motion; raise (4.0) for stronger prompt adherence |
| Seed | random | Use fixed seed to reproduce the same motion |

---

## Wan2.1 T2V 1.3B — Deep Dive

### What it does
Alibaba Wan2.1 — state-of-the-art open-source text-to-video model. Generates 81 frames (~5s at 16fps) with exceptional motion coherence and visual quality. Supports visual text generation in Chinese and English.

### Strengths
- 🏆 **SOTA quality:** Best-in-class motion coherence, lighting, detail
- ⏱️ **Longer videos:** 81 frames (~5 seconds) — longest local video
- 📝 **Visual text:** Can generate readable text overlays (Chinese/English)
- 💾 **VRAM efficient:** ~11 GB peak with CPU offload — less than CogVideoX
- 🖼️ **Multiple aspect ratios:** 16:9, 9:16, 1:1, 4:3, 3:4
- ✅ **Commercial safe:** Apache 2.0 license

### Limitations
- **Slower generation:** ~130 seconds for 30 steps
- **Lower FPS:** 16fps (vs LTX 24fps) — slightly less fluid but acceptable
- **Not real-time:** Best for planned content, not live demos

### Aspect Ratios

| Ratio | Resolution | Use Case |
|-------|------------|----------|
| `16:9` | 832×480 | Landscape (Facebook cover, YouTube shorts) |
| `1:1` | 480×480 | Square (Instagram feed, TikTok) |
| `9:16` | 480×832 | Portrait (Instagram Reels, TikTok, Stories) |
| `4:3` | 640×480 | Classic photo ratio |
| `3:4` | 480×640 | Portrait photo ratio |

### Recommended Settings

| Parameter | Default | When to Change |
|-----------|---------|----------------|
| Steps | 30 | 25 for faster generation; 40 for best quality |
| Guidance | 1.0 | Wan2.1 uses flow-matching — keep at 1.0 (CFG disabled). Do not raise. |
| Seed | random | Use fixed seed to reproduce the same motion |

---

## CogVideoX 5B — Deep Dive (Legacy)

> ⚠️ **CogVideoX 5B is kept for backward compatibility but superseded by LTX-Video (faster, lower VRAM) and Wan2.1 (longer, higher quality).** Prefer LTX or Wan2.1 for new content.

### What it does
Turns a text prompt into a short MP4 video (16 frames, ~2 seconds at 8 FPS). Uses a 5-billion-parameter transformer trained by Zhipu AI.

### Strengths
- 🎬 **High quality:** Coherent motion, visible detail
- 🏢 **Great for:** Product showcases, scenic animations
- 🖼️ **Multiple aspect ratios:** 16:9, 9:16, 1:1, 4:3, 3:4
- 🔄 **Auto-unload:** Frees VRAM after 5 min idle

### Limitations
- **Short duration:** ~2 seconds max (16 frames)
- **Resolution:** Max 720×480 (landscape) or 480×720 (portrait)
- **VRAM hungry:** ~30 GB peak — requires RTX 5090 32GB with CPU offload
- **Monochrome bug:** bfloat16 produces brown output; float16 required
- **No VAE tiling:** `enable_tiling()` corrupts decode
- **No image-to-video:** Text-to-video only in this configuration

### Aspect Ratios

| Ratio | Resolution | Use Case |
|-------|------------|----------|
| `16:9` | 720×480 | Landscape (Facebook cover, YouTube shorts) |
| `1:1` | 480×480 | Square (Instagram feed, TikTok) |
| `9:16` | 480×720 | Portrait (Instagram Reels, TikTok, Stories) |
| `4:3` | 640×480 | Classic photo ratio |
| `3:4` | 480×640 | Portrait photo ratio |

### Recommended Settings

| Parameter | Default | When to Change |
|-----------|---------|----------------|
| Steps | 25 | Keep at 25 for best quality; 5 for faster drafts |
| Guidance | 6.0 | Raise to 7–8 for stronger prompt adherence; lower to 4–5 for more creativity |
| Seed | random | Use fixed seed to reproduce the same motion |

---

## Use Cases by Department

### F&B — Nhà hàng, Cafe, Bia tươi
**Use:** Animated food shots, pouring drinks, steam rising

**Example prompts:**
- *"A panda playing a guitar in a cozy coffee shop, warm lighting, soft bokeh background"*
- *"Steam rising from a bowl of phở bò, slow motion, warm lighting, overhead shot"*
- *"Beer pouring into a frosted glass, golden bubbles, condensation droplets, macro shot"*

### Hotel & Tourism — NQH Travel
**Use:** Animated landscapes, resort amenities, aerial drone shots

**Example prompts:**
- *"Drone shot flying over terraced rice paddies at sunrise in Mu Cang Chai, golden light reflecting on water"*
- *"Gentle waves lapping against white sand beach in Phu Quoc, palm trees swaying"*
- *"Luxury resort infinity pool overlooking Ha Long Bay limestone karsts at sunset"*

### Real Estate — NQH Land
**Use:** Animated interiors, drone flythroughs, sunset timelapse

**Example prompts:**
- *"Modern penthouse living room, floor-to-ceiling windows, city lights twinkling at dusk, camera slowly panning"*
- *"Aerial drone descending toward a Mediterranean villa with terracotta roof, swimming pool, olive grove"*
- *"Time-lapse of sunrise over a high-rise apartment balcony, clouds moving fast, warm orange glow"*

### Events & Marketing
**Use:** Animated banners, countdown teasers, product reveals

**Example prompts:**
- *"Sparkler writing the number 2026 in the air, slow motion, dark background, golden sparks"*
- *"Confetti falling over a stage with spotlights, celebration atmosphere, vibrant colors"*

---

## Workflow Tips

1. **Start with Image Studio** — Generate a still frame first with your preferred model (Dreamshaper, Realistic Vision, etc.). Use that as reference for your video prompt.
2. **Choose the right model for the job:**
   - **Quick draft / social clip** → LTX-Video (~10s, good enough)
   - **Final cinematic output** → Wan2.1 (~2min, best quality)
   - **Legacy content** → CogVideoX 5B (kept for compatibility)
3. **Keep prompts descriptive** — All models work best with clear subject + motion + lighting descriptions.
4. **Batch generate** — Generate 2–3 variants with different seeds, then pick the best.
   - LTX: ~10s each → batch of 3 in ~30s
   - Wan2.1: ~2min each → batch of 3 in ~6min
5. **Post-process** — Use CapCut or Premiere to add music, text overlays, color grade. Wan2.1's 5s clips need less looping than CogVideoX's 2s clips.

---

## VRAM Warning

- **Only ONE model loaded at a time.** Switching between Image Studio and Video Studio triggers auto-swap. Load times vary:
  - LTX-Video: ~5–10s
  - Wan2.1: ~10–15s
  - CogVideoX 5B: ~15–20s
- **Idle auto-unload:** After 5 minutes of inactivity, the model unloads to free VRAM. The next generation will reload automatically.
- **Peak usage:**
  - LTX-Video: ~9 GB
  - Wan2.1: ~11 GB
  - CogVideoX 5B: ~30 GB
  Ensure no other GPU tasks are running.
- **Do not exceed recommended resolutions.** Higher resolutions will cause Out-Of-Memory errors.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Model loading..." takes >20 sec | First request after idle unload or hot-swap | Normal; load time depends on model size |
| Video looks brown/monochrome | CogVideoX only: bfloat16 bug on RTX 5090 | LTX and Wan2.1 use bfloat16 safely; CogVideoX uses float16 |
| Black screen / CUDA OOM | Resolution too high or other GPU task running | Check `nvidia-smi`; wait for idle unload; use lower resolution |
| Cloud models missing from dropdown | Local mode active | Cloud models (Seedance, Kling, Veo) are disabled in local mode by design |
| Generation timeout after 15 min | Backend error or deadlock | Check server logs; restart local server if needed |
| Wan2.1 output has artifacts | Flow-matching scheduler mismatch | Backend uses UniPCMultistepScheduler with flow_shift=3.0 — contact IT if persists |

---

## Technical Specs

| Spec | Value |
|------|-------|
| Backend engine | diffusers 0.38.0 (PyTorch nightly cu128) |
| Pipelines | LTXPipeline, WanPipeline, CogVideoXPipeline |
| Models | Lightricks/LTX-Video, Wan-AI/Wan2.1-T2V-1.3B-Diffusers, THUDM/CogVideoX-5b |
| Output format | MP4 (H.264, yuv420p) |
| Async pattern | `POST /api/v1/async-generate` + polling `GET /api/v1/jobs/{id}` |

### Model Comparison

| Spec | LTX-Video | Wan2.1 T2V 1.3B | CogVideoX 5B |
|------|-----------|-----------------|--------------|
| Resolution (16:9) | 768×512 | 832×480 | 720×480 |
| Frames | 65 | 81 | 16 |
| FPS | 24 | 16 | 8 |
| Duration | ~2.7s | ~5.0s | ~2.0s |
| Latency (30 steps) | ~10s | ~130s | ~40s |
| Peak VRAM | ~9 GB | ~11 GB | ~30 GB |
| dtype | bfloat16 | bfloat16 | float16 |
| CPU offload | ✅ | ✅ | ✅ |
| VAE tiling | ✅ (safe) | ✅ (safe) | ❌ (corrupts) |
| License | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| Best for | Fast drafts | Cinematic final | Legacy / backward compat |

---

*Prepared by AI Infrastructure Team — NQH Industries*  
*For questions, contact: it@nhatquangholding.com*
