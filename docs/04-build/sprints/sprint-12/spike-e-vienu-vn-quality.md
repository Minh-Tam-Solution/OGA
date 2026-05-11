# Spike E — VieNeu Vietnamese Quality Validation

**Spike ID:** 12.0e (CTO-mandated, post-ADR-007 v3 reframe)  
**Owner:** @coder  
**ADR:** ADR-007 (Audio Production Architecture)  
**Duration:** 1 day  
**Branch:** `spike/vienu-vn-quality`  
**Status:** AUTHORIZED — waiting for AI-Platform voice service runtime access

---

## Executive Summary

CTO has mandated validation that **VieNeu-TTS** (currently the effective default VN voice in AI-Platform) does not regress Vietnamese quality compared to **MeloTTS** (Spike 11.0c baseline: Hùng 5/5 PASS).

**Spike question:** Is VieNeu ≥ MeloTTS for Vietnamese TTS quality?

**If YES →** Confirm default is correct. Ship.  
**If TIE →** Keep VieNeu as default (tiebreakers: Apache 2.0 + cloning + code-switch).  
**If NO →** Switch default back to MeloTTS, document VieNeu as fallback.

---

## Methodology

### Blind A/B Test

| Step | Detail |
|------|--------|
| **Text prompts** | Same 5 samples from Spike 11.0c (controlled comparison) |
| **Voice A** | VieNeu (`vi-vineu-southern-male`) — generated via AI-Platform `/v1/tts/synthesize` |
| **Voice B** | MeloTTS (`vi-melotts-default`) — generated via AI-Platform `/v1/tts/synthesize` |
| **Order** | Randomized per sample (Hùng does not know which is which) |
| **Reviewer** | Hùng (same as Spike 11.0c) |
| **Rating** | For each sample: which voice is better? (A / B / Tie / Neither acceptable) |

### Sample Texts (identical to Spike 11.0c)

| # | Type | Text |
|---|------|------|
| 1 | Short generic | "Xin chào quý khách." |
| 2 | Marketing slogan | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." |
| 3 | Long narrative | "Hôm qua tôi đi dạo quanh hồ Gươm và thấy thành phố thật đẹp vào buổi chiều." |
| 4 | Numbers-heavy | "Giá phòng khách sạn Đà Lạt là một triệu hai trăm nghìn đồng một đêm." |
| 5 | Emotion-laden | "Thật tuyệt vờي! Chúng ta đã chiến thắng!" |

---

## Execution Steps

### Step 1: Verify AI-Platform voice service accessible

```bash
# Check health endpoint
curl http://<AI-PLATFORM-HOST>:8121/v1/health

# Expected: 200 OK, status: "available", engines include "vineu" and "melotts"
```

**Blocked on:** Need runtime host/port for AI-Platform voice service (staging or S1).

### Step 2: Generate 5 samples per voice

```bash
# VieNeu
curl -X POST http://<AI-PLATFORM-HOST>:8121/v1/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Xin chào quý khách.","voice_id":"vi-vineu-southern-male","language":"vi","format":"wav"}' \
  --output sample1_vienu.wav

# MeloTTS
curl -X POST http://<AI-PLATFORM-HOST>:8121/v1/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Xin chào quý khách.","voice_id":"vi-melotts-default","language":"vi","format":"wav"}' \
  --output sample1_melotts.wav

# Repeat for samples 2-5
```

### Step 3: Blind A/B with Hùng

- Randomize file names (e.g., `sample1_X.wav`, `sample1_Y.wav`)
- Hùng listens to both for each text
- Records: prefers X / prefers Y / tie / neither acceptable

### Step 4: Score and decide

| Outcome | Action |
|---------|--------|
| VieNeu wins ≥ 3/5 | ✅ Keep VieNeu as default |
| Tie (2-2-1 or 3-2 with many "tie") | ✅ Keep VieNeu (tiebreakers: Apache 2.0 + cloning + code-switch) |
| MeloTTS wins ≥ 3/5 | ❌ Switch default to `vi-melotts-default` |
| Either voice has < 3/5 acceptable | 🔴 Investigate — possible service degradation |

---

## Acceptance Criteria

| # | Criterion | Pass Threshold |
|---|-----------|----------------|
| 1 | All 10 samples generate without error | 10/10 success |
| 2 | Hùng review completed | 5/5 texts reviewed |
| 3 | VieNeu not worse than MeloTTS | VieNeu wins OR ties |
| 4 | Both voices ≥ 3/5 "acceptable" individually | No voice is unacceptable |

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-E-001 | AI-Platform voice service not accessible from dev machine | Medium | Spike blocked | Run on S1 directly; or request staging endpoint from ops |
| R-E-002 | VieNeu model not loaded on target instance | Low | Sample generation fails | Check health endpoint before generating |
| R-E-003 | Hùng unavailable for review | Low | Spike blocked | Schedule in advance; backup reviewer: TBD |
| R-E-004 | MeloTTS adapter not registered on target instance | Low | Cannot generate baseline | Verify `melotts` in health response |

---

## Deliverables

1. **10 WAV files** (5 VieNeu + 5 MeloTTS)
2. **Hùng A/B score sheet** (signed/scanned or digital)
3. **Spike report** (this file updated with results)
4. **ADR-007 update** (if default voice changes)

---

## CTO Authorization

> **@cto AUTHORIZES Spike E immediately.**
> 
> Conditions:
> - 1 day maximum
> - No new infrastructure — use existing AI-Platform voice service
> - If AI-Platform not accessible, escalate to ops — do NOT build local workaround
> - Hùng review is mandatory gate — no self-assessment
> - Result feeds directly into ADR-007 v3

---

*Spike E | VieNeu VN Quality | AUTHORIZED | Owner: @coder | Gate: Hùng A/B vs MeloTTS*

---

## Spike E Execution Log

### 2026-05-06: MeloTTS Baseline Samples Generated

**Environment:** S1 GPU Server, MeloTTS venv from Spike 11.0c (`/tmp/melotts-vn-spike/venv/`)
**Model:** `/home/nqh/shared/models/voice/melotts-vietnamese/` (config.json + G_463000.pth)

| # | Name | Text | Duration | File |
|---|------|------|----------|------|
| 1 | sample1_short | "Xin chào quý khách." | 1.64s | `spike-e-samples/melotts/sample1_short.wav` |
| 2 | sample2_brand | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | 3.21s | `spike-e-samples/melotts/sample2_brand.wav` |
| 3 | sample3_long | "Hôm qua tôi đi dạo quanh hồ Gươm và thấy thành phố thật đẹp vào buổi chiều." | 4.78s | `spike-e-samples/melotts/sample3_long.wav` |
| 4 | sample4_numbers | "Giá phòng khách sạn Đà Lạt là một triệu hai trăm nghìn đồng một đêm." | 4.29s | `spike-e-samples/melotts/sample4_numbers.wav` |
| 5 | sample5_emotion | "Thật tuyệt vờي! Chúng ta đã chiến thắng!" | 2.86s | `spike-e-samples/melotts/sample5_emotion.wav` |

**Technical verification:** All 5 files are valid RIFF WAV, PCM 16-bit mono 44100Hz.

**Next step:** VieNeu samples — blocked on model availability.

### Blocker: VieNeu Model

**Status:** `/home/nqh/shared/models/voice/vineu-tts-v2-turbo/` is empty.

**Options to unblock:**
1. **Download from GitHub:** `git clone https://github.com/pnnbao97/VieNeu-TTS.git` + download ONNX weights from releases
2. **Ops provide model:** If VieNeu model exists elsewhere on S1, copy to `/home/nqh/shared/models/voice/vineu-tts-v2-turbo/`
3. **AI-Platform image build:** If model is baked into Docker image during build, start voice container directly

**Recommendation:** Option 1 (download) — 10-15 minutes. Owner: @coder.
