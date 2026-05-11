# VN Blind A/B Review Package

**Prepared**: 2026-05-09
**Reviewer**: Hùng
**Context**: Sprint 11 IndexTTS Spike — Vietnamese TTS Quality Assessment

---

## How to Review

1. Play each file **without looking at the labels** (blind review)
2. Rate each on a scale of 1–5 for:
   - **Intelligibility** (1 = cannot understand, 5 = perfectly clear)
   - **Naturalness** (1 = robotic/foreign, 5 = native speaker)
   - **Prosody** (1 = flat/monotone, 5 = natural intonation)
3. Note any artifacts (clipping, glitches, robotic sounds)
4. Pick your **favorite** (A, B, or C)

## The Text (Read Along)

> Xin chào quý khách. Chào mừng đến với NQH Creative Studio. Hôm nay chúng tôi giới thiệu hệ thống sản xuất âm thanh địa phương chạy trên máy chủ GPU. Chúng tôi sẽ trình diễn tạo giọng nói từ văn bản với cảm xúc trung tính trong mườilăm giây.

## File Locations

```
/tmp/indextts-spike/shared/audio/outputs/
├── spk_1778319030.wav  (Sample A — Baseline)
├── spk_1778319044.wav  (Sample B — High Emotion)
└── spk_1778319057.wav  (Sample C — Fast Delivery)
```

| File | Sample | Variant | Duration |
|------|--------|---------|----------|
| `spk_1778319030.wav` | **A** | Baseline (default settings) | 32.15s |
| `spk_1778319044.wav` | **B** | High Emotion (weight 1.5) | 39.41s |
| `spk_1778319057.wav` | **C** | Fast Delivery (rate 0.85) | 24.08s |

## Review Form

| Criterion | Sample A | Sample B | Sample C |
|-----------|----------|----------|----------|
| Intelligibility (1–5) | ___ | ___ | ___ |
| Naturalness (1–5) | ___ | ___ | ___ |
| Prosody (1–5) | ___ | ___ | ___ |
| Artifacts noted? | ___ | ___ | ___ |
| **Favorite?** | ☐ | ☐ | ☐ |

## Context for Reviewer

- Speaker source: 3-second synthetic test clip (low quality — expect baseline timbre limitations)
- Production would use 8–20s natural voice samples for better cloning
- IndexTTS2 model: `IndexTeam/IndexTTS-2` (bilibili)
- Hardware: RTX 5090 32GB, GPU inference
- All samples generated successfully with zero backend errors

## Verdict Scale

- **≥ 4.0 average + no major artifacts** → VN quality ACCEPTED for production
- **3.0–3.9 average + minor artifacts** → CONDITIONAL (improve speaker source first)
- **< 3.0 average or major artifacts** → REJECTED (explore alternative TTS for VN)

---
*Please return completed form to @cto + @cpo*
