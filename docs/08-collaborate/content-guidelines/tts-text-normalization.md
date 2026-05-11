# TTS Text Normalization Guideline — NQH Creative Studio

**Status:** DRAFT (Sprint 13, Task 13.1)  
**Owner:** @pm + @marketing  
**Audience:** Script writers, content creators, marketing team  
**Related:** ADR-007 v4, Spike E v2 results

---

## Purpose

This document provides writing rules for Vietnamese text scripts intended for AI-Platform TTS synthesis (Piper + MeloTTS). Following these rules maximizes pronunciation quality and minimizes TTS engine errors.

---

## ✅ DO — Write This Way

### 1. Spell Out Initials

TTS engines cannot pronounce Latin abbreviations clearly.

| ❌ Bad | ✅ Good |
|--------|--------|
| "Bia tươi NQH" | "Bia tươi N Q H" or "Bia tươi Nhất Quang Hưng" |
| "CEO Hùng" | "Xê Ơi Ô Hùng" or "Giám đốc điều hành Hùng" |
| "MTS Solution" | "M T S Solution" or " Minh Tam Solution" |

**Why:** Piper (espeak-ng) and MeloTTS (underthesea) lack phoneme rules for Latin initials in Vietnamese context. They read "NQH" as random syllables or skip it.

### 2. Use Common Words, Avoid Rare Hán-Việt

| ❌ Bad | ✅ Good |
|--------|--------|
| "Thượng lưu đẳng cấp" | "Dòng sản phẩm cao cấp" |
| "Kỳ công chế tác" | "Được làm rất công phu" |

**Why:** Rare Sino-Vietnamese compounds have ambiguous pronunciations even for native speakers. TTS engines guess wrong.

### 3. Break Long Sentences

| ❌ Bad | ✅ Good |
|--------|--------|
| "Bia tươi NQH với hương vị đậm đà chuẩn Đức được sản xuất từ những nguyên liệu tốt nhất và quy trình ủ lạnh truyền thống kéo dài 21 ngày tạo nên một trải nghiệm uống bia độc đáo và tinh tế cho ngườí sành điệu." | "Bia tươi N Q H. Hương vị đậm đà, chuẩn Đức. Được ủ lạnh 21 ngày. Một trải nghiệm độc đáo cho ngườí sành điệu." |

**Why:** TTS engines process sentences as units. Long sentences produce prosody drift (wrong pauses, flat intonation).

### 4. Write Numbers as Words for Small Values

| ❌ Bad | ✅ Good |
|--------|--------|
| "Giá 1.500.000đ" | "Giá một triệu năm trăm nghìn đồng" |
| "Top 3 thương hiệu" | "Top ba thương hiệu" |

**Why:** Number parsing varies by TTS engine. Writing as words guarantees correct pronunciation.

---

## ❌ DON'T — Avoid These

| Pattern | Example | Problem |
|---------|---------|---------|
| Initials | "NQH", "MTS", "CEO" | Pronounced as random syllables |
| Rare Sino-Vietnamese | "Kỳ công", "thượng lưu" | Ambiguous phonemes |
| Mixed-language words | "Premium bia", "Luxury trải nghiệm" | English stress patterns break Vietnamese prosody |
| Very long sentences | >30 words | Prosody drift, unnatural pauses |
| Special characters | "😊", "🍺", "™" | Stripped or read as "emoji" |

---

## 🛠️ TTS Pre-flight Checklist

Before submitting script to Voice Studio:

- [ ] No initials or abbreviations (unless spelled out)
- [ ] No rare Hán-Việt compounds
- [ ] Sentences under 20 words each
- [ ] Numbers written as words (for values < 1,000,000)
- [ ] No special characters
- [ ] Tested with "Preview" button (if available)

---

## Engine-Specific Notes

### Piper (Primary)
- **Strengths:** Fast, reliable, consistent prosody
- **Weaknesses:** espeak-ng phonemizer struggles with brand names, initials, rare words
- **Best for:** General marketing copy, simple sentences, standard vocabulary

### MeloTTS (Fallback)
- **Strengths:** Natural, human-like quality, good tone handling
- **Weaknesses:** Slower (~3.2s), underthesea can missegment unusual compounds
- **Best for:** Emotional copy, storytelling, when naturalness matters more than speed

---

## Examples — Good vs Bad Scripts

### Script A: Product Launch (Good)

```
Bia tươi N Q H.

Hương vị đậm đà. Chuẩn Đức.
Được ủ lạnh 21 ngày.

Uống một ly.
Cảm nhận sự khác biệt.
```

**Result:** Clear, natural, correct pronunciation.

### Script B: Product Launch (Bad)

```
Bia tươi NQH với hương vị đậm đà chuẩn Đức được sản xuất từ những nguyên liệu tốt nhất và quy trình ủ lạnh truyền thống kéo dài 21 ngày tạo nên một trải nghiệm uống bia độc đáo và tinh tế cho ngườí sành điệu.
```

**Result:** "NQH" unclear, long sentence produces flat prosody, risk of mispronunciation.

---

## Revision History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-05-10 | 0.1 | Initial draft — initials, Hán-Việt, sentence length rules | @pm |

---

*Draft for Marketing team review. Lock v1.0 after 2-week usage feedback.*
