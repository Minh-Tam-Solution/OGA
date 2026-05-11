# Spike E — Vietnamese TTS Quality Comparison Results

**Spike ID:** 12.0e v2 (CTO-mandated, 2-way mode)  
**Date:** 2026-05-10  
**Owner:** @coder  
**Reviewer:** Hùng (pending — samples prepared, typo fixed)  

---

## Executive Summary

**VieNeu is UNAVAILABLE for this spike.** AI-Platform handoff (2026-05-10) confirms VieNeu adapter deferred to S118. VieNeu Docker upstream (`pnnbao/vieneu-tts:serve`) blocked on GPU OOM (ollama occupies 12836MiB; no sudo access to kill).

**Pivot:** Spike E v2 compares **Piper** (AI-Platform production voice) vs **MeloTTS** (baseline from Spike 11.0c).
>
> **UPDATE 2026-05-10 ~08:45 UTC:** `vi-melotts-default` has been seeded into AI-Platform registry and is now callable via gateway (200 OK verified). MeloTTS is no longer blocked by registry gap A3. However, container changes are non-persistent — image rebuild required for S118 persistence.

| Engine | Status | Source |
|--------|--------|--------|
| **MeloTTS** | ✅ Baseline (5/5 valid WAV) | Spike 11.0c — direct inference |
| **Piper** | ✅ Production voice (5/5 valid WAV) | AI-Platform gateway — Track C |
| **VieNeu** | ❌ UNAVAILABLE | AI-Platform deferred S118; Docker OOM (ollama root-owned, cannot kill) |

---

## Sample Files Prepared

### MeloTTS Baseline (Spike 11.0c)

| # | File | Text | Duration | Format |
|---|------|------|----------|--------|
| 1 | `spike-e-samples/melotts/sample1_short.wav` | "Xin chào quý khách." | 1.64s | PCM WAV 16-bit mono 44100Hz |
| 2 | `spike-e-samples/melotts/sample2_brand.wav` | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | 3.21s | PCM WAV 16-bit mono 44100Hz |
| 3 | `spike-e-samples/melotts/sample3_long.wav` | "Hôm qua tôi đi dạo quanh hồ Gươm..." | 4.78s | PCM WAV 16-bit mono 44100Hz |
| 4 | `spike-e-samples/melotts/sample4_numbers.wav` | "Giá phòng khách sạn Đà Lạt là một triệu..." | 4.29s | PCM WAV 16-bit mono 44100Hz |
| 5 | `spike-e-samples/melotts/sample5_emotion.wav` | "Thật tuyệt vời! Chúng ta đã chiến thắng!" | 2.94s | PCM WAV 16-bit mono 44100Hz |

> **2026-05-10 ~09:18 UTC:** `sample5_emotion.wav` regenerated for BOTH engines due to Arabic letter contamination ( U+064A) in original text. Corrected text: "Thật tuyệt vời! Chúng ta đã chiến thắng!"

### Piper (AI-Platform Gateway)

| # | File | Text | Duration | Format |
|---|------|------|----------|--------|
| 1 | `spike-e-samples/piper/sample1_short.wav` | "Xin chào quý khách." | ~0.78s | PCM WAV 16-bit mono 22050Hz |
| 2 | `spike-e-samples/piper/sample2_brand.wav` | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | ~2.29s | PCM WAV 16-bit mono 22050Hz |
| 3 | `spike-e-samples/piper/sample3_long.wav` | "Hôm qua tôi đi dạo quanh hồ Gươm..." | ~3.71s | PCM WAV 16-bit mono 22050Hz |
| 4 | `spike-e-samples/piper/sample4_numbers.wav` | "Giá phòng khách sạn Đà Lạt là một triệu..." | ~3.07s | PCM WAV 16-bit mono 22050Hz |
| 5 | `spike-e-samples/piper/sample5_emotion.wav` | "Thật tuyệt vời! Chúng ta đã chiến thắng!" | 2.23s | PCM WAV 16-bit mono 22050Hz |

**Gateway synthesis verified (2026-05-10 re-test):**
> - Piper `vi-piper-vais1000`: ✅ 200 OK, ~331ms processing, valid WAV 22050Hz
> - MeloTTS `vi-melotts-default`: ✅ **200 OK** (previously 404), ~3.2s processing, valid WAV 44100Hz
> - MinIO presigned URL download: ✅ Valid WAV via container-level fetch

---

## CEO Preview Feedback (2026-05-10)

> **Tester:** CEO (direct listen, not blind)
> **Scope:** 2 samples — A-2 (Piper brand) + B-2 (MeloTTS brand)

| Sample | Text | Overall | Pronunciation Issue |
|--------|------|---------|---------------------|
| A-2 (Piper) | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | 3→4/5 | **Re-listen:** Chỉ "NQH" (initials Latin) không phát âm rõ; phần còn lại OK — chấp nhận được |
| B-2 (MeloTTS) | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | 3→4/5 | **Re-listen:** Chỉ "NQH" (initials Latin) không phát âm rõ; phần còn lại OK — chấp nhận được |

**CEO conclusion (updated after re-listen):**
- **Weak point thu hẹp:** Chỉ "NQH" (initials/tên viết tắt Latin) là không rõ — đây là known limitation của cả Piper (espeak-ng) và MeloTTS (underthesea)
- Phần còn lại "bia tươi hương vị đậm đà chuẩn Đức" phát âm **chấp nhận được** trên cả hai engines
- **Mẫu B (MeloTTS) phát âm chuẩn hơn tổng thể** so với mẫu A (Piper)

**CEO sign-off (2026-05-10):** ✅ **PASSED** — brand text acceptable after re-listen. Initials limitation documented. No engine modification required.

> ⚠️ CEO preview sign-off = **informational signal**, NOT the formal G2 gate. Hùng blind A/B review remains the mandatory gate for ADR-007 status flip from Proposed → Accepted.

**Technical analysis:**
- Piper dùng espeak-ng phonemizer — initials Latin "N-Q-H" không có rule trong Vietnamese phoneme set → đọc như nguyên âm lạ hoặc bỏ qua
- MeloTTS dùng underthesea + PhoBERT — cũng không có rule cho initials Latin trong tiếng Việt
- **Mitigation đơn giản (không cần custom lexicon):** Script writer thay "NQH" bằng cách đọc đầy đủ trong text input (ví dụ: "N Q H" hoặc tên đầy đủ "Nguyễn Quang Hùng")
- **ADR-007 v4 production caveat đã cập nhật:** brand initials là known limitation; workaround = text normalization guideline

---

## Hùng A/B Blind Review — Pending

**Setup:**
- Folder A: Piper (5 samples)
- Folder B: MeloTTS (5 samples)
- Shuffle file names; Hùng does not know which is which

**Dimensions (Likert 1-5):**
1. Clarity (rõ ràng)
2. Naturalness (tự nhiên)
3. Prosody (ngữ điệu)
4. Pronunciation accuracy (chính xác phát âm)

**Score sheet:**

| Sample | Clarity | Naturalness | Prosody | Pronunciation | **Mean** |
|--------|---------|-------------|---------|---------------|----------|
| A-1 | _ | _ | _ | _ | _ |
| A-2 | _ | _ | _ | _ | _ |
| A-3 | _ | _ | _ | _ | _ |
| A-4 | _ | _ | _ | _ | _ |
| A-5 | _ | _ | _ | _ | _ |
| B-1 | _ | _ | _ | _ | _ |
| B-2 | _ | _ | _ | _ | _ |
| B-3 | _ | _ | _ | _ | _ |
| B-4 | _ | _ | _ | _ | _ |
| B-5 | _ | _ | _ | _ | _ |

**Acceptance criteria (CTO-mandated):**
- Piper mean ≥ MeloTTS mean → confirm Piper as production voice
- Piper = MeloTTS (within 10%) → keep Piper (integration + stability tiebreakers)
- Piper < MeloTTS by >10% → **MeloTTS becomes primary fallback** (registry already seeded; image rebuild tracked in S118 ticket)

**CEO advisory:** Brand text (tên thương hiệu, chuyên ngành bia) là weak point chung. Cần test thêm với text đơn giản hoặc chuẩn bị custom lexicon cho production.

---

## Technical Notes

### Why VieNeu Could Not Be Tested

| Attempt | Result | Root Cause |
|---------|--------|------------|
| AI-Platform gateway | ❌ 404 | VieNeu adapter deferred S118; registry rows are residue |
| VieNeu Docker GPU | ❌ CUDA OOM | ollama (12836MiB) + other GPU processes leave insufficient VRAM |
| VieNeu Docker CPU | ❌ Crash | lmdeploy requires CUDA driver; image not CPU-compatible |
| Local SDK (ONNX) | ❌ `NoneType` | `Vieneu()` init fails silently without torch/GPU |

**Required to unblock VieNeu:**
- Kill ollama (`sudo kill -15 166223`) → free ~12GB VRAM → restart VieNeu Docker
- OR wait for AI-Platform S118 VieNeu adapter fix

### AI-Platform Gateway Smoke Test Results

| Test | Status | Detail |
|------|--------|--------|
| Health (anonymous) | ✅ 200 | `{"status":"healthy", ...}` |
| List voices (with key) | ✅ 200 | 6 voices returned (4 Piper + 2 VieNeu residue) |
| Synthesize `vi-piper-vais1000` | ✅ 200 | JSON with presigned URL, ~170ms processing |
| Synthesize no key | ❌ 401 | Expected |
| Synthesize invalid voice | ❌ 404 | Expected |
| MinIO download | ✅ 200 | Valid WAV via `Host:` header + localhost:9020 |

---

## Recommendations

1. **Hùng review Piper vs MeloTTS ASAP** — samples ready, score sheet prepared
2. **If Piper acceptable** → OGA production code uses `vi-piper-vais1000` as primary VN voice; `vi-melotts-default` as fallback
3. **If MeloTTS wins by >10%** → flip primary to MeloTTS; Piper becomes emergency fallback (image rebuild required for persistence)
4. **VieNeu evaluation** → deferred to S118 when adapter fixed + GPU freed (kill ollama or stop root-owned process)

---

*Spike E | Piper vs MeloTTS | Samples Ready | Hùng Review Pending*
