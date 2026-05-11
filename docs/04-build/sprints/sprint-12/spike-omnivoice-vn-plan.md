# Sprint 12 Spike — OmniVoice Vietnamese Evaluation

**Spike ID:** 12.0a (ON HOLD — pending CTO unblock after license reconciliation)  
**Owner:** @coder  
**ADR:** ADR-007 (Audio Production Architecture)  
**Duration:** 2 days  
**Branch:** `spike/omnivoice-vn`  
**Date Started:** TBD (Sprint 12 kickoff)  
**Status:** PLANNED — CPO pre-approved, conditional on Spike 11.0c integration completion

---

## Executive Summary

**CPO Decision (2026-05-06):** VieNeu-TTS is now the **default Vietnamese TTS** in AI-Platform. MeloTTS is **fallback #1** (CPU-only). This spike evaluates **OmniVoice** as a potential **upgrade path** — only if it consistently surpasses VieNeu in Vietnamese quality without breaking VRAM/latency budgets.

**Key hypothesis:** OmniVoice (Apache 2.0, 600+ languages, 581k hours training, zero-shot cloning) may deliver higher-fidelity Vietnamese TTS than VieNeu, while maintaining commercial license safety.

**Spike is conditional:** OmniVoice only advances to production if it passes **all gates** including Hùng blind A/B where it must **consistently beat VieNeu** (not just "acceptable").

---

## CPO-Locked Acceptance Criteria

| # | Criterion | Gate Owner | Pass Threshold |
|---|-----------|------------|----------------|
| 1 | **License audit** | @coder | Apache 2.0 confirmed for code + weights. No GPL, no academic-only, no PRC jurisdiction. |
| 2 | **Architecture fit** | @architect | Can integrate as AI-Platform adapter (same pattern as VieNeu/MeloTTS). No standalone microservice. |
| 3 | **Smoke test** | @coder | 5/5 valid audio outputs, no runtime errors, no truncation. |
| 4 | **Performance budget** | @coder | RTF < 1.0, peak VRAM < 10GB (to coexist with Wan2.1/LTX), cold-start < 30s. |
| 5 | **VRAM coexistence** | @architect | OmniVoice + Wan2.1 concurrent ≤ 32GB S1 GPU, or serial-only with arbiter. |
| 6 | **VN Quality Gate** | Hùng (Marketing) | **≥ 4/5 "acceptable" AND must beat VieNeu in blind A/B head-to-head.** |
| 7 | **Fallback strategy** | @architect | If any gate fails → OmniVoice REJECTED, keep VieNeu default + MeloTTS fallback. |

---

## C-Day1 Checklist

### ✅ C-Day1-1: License Chain Audit — PRELIMINARY PASS (CTO UNBLOCK REQUIRED)

**Repo URL:** `https://github.com/k2-fsa/OmniVoice`  
**LICENSE file fetched:** `https://raw.githubusercontent.com/k2-fsa/OmniVoice/main/LICENSE`  
**License text:** Apache License Version 2.0, January 2004  
**Copyright holder:** Xiaomi Corp. (2026)  
**PRC jurisdiction:** None — standard Apache 2.0, no Shanghai Arbitration clause  

**CTO Reconciliation Note:**  
Earlier removal of "OmniVoice" from production compose (Spike 11.0b era) may have targeted a pre-release or different artifact. The **current `main` branch** (as of 2026-05-06) carries a bona fide Apache 2.0 LICENSE with Xiaomi Corp. copyright. This is a **different disposition** from any academic-only finding.

**Verification command (reproducible):**
```bash
curl -s https://raw.githubusercontent.com/k2-fsa/OmniVoice/main/LICENSE | head -5
# Expected: "Apache License\n Version 2.0, January 2004"
```

**Flagged for CTO review:**
- [ ] Confirm this is the same artifact previously removed (or a newer release)
- [ ] If same artifact: reconcile why LICENSE changed (or why prior read was different)
- [ ] If different artifact: note that `k2-fsa/OmniVoice` as of 2026-04/05 is Apache 2.0

**Preliminary verdict:** ✅ **License = Apache 2.0, commercial-safe** — pending CTO explicit unblock to proceed.

**Target:** Confirm Apache 2.0 for OmniVoice code + pretrained weights.

| Package | License | Commercial? | Source |
|---------|---------|-------------|--------|
| **OmniVoice** (main repo) | Apache 2.0 (claimed) | TBD | GitHub LICENSE file |
| **Pretrained weights** | TBD | TBD | HuggingFace / ModelScope |
| **Training data** | 581k hours (claimed) | N/A | Paper / datasheet |

**Verification steps:**
1. Clone official repo, read `LICENSE` top-to-bottom
2. Check HuggingFace model card for weight license
3. Verify no ModelScope-only license (PRC jurisdiction risk)
4. Scan dependencies for GPL/AGPL contamination

**Fail conditions:** Non-Apache code, non-commercial weight license, PRC arbitration clause, GPL in dependency chain that cannot be containerized.

### ⏳ C-Day1-2: Architecture Plan

**Pattern:** AI-Platform TTS adapter (NOT standalone microservice).

**Proposed adapter:** `omnivoice_adapter.py` implementing `BaseTTSAdapter`

```
AI-Platform Voice Service (:8121)
└── TTS Orchestrator
    ├── VieNeu Adapter     ← default vi
    ├── OmniVoice Adapter  ← candidate (if spike passes)
    ├── MeloTTS Adapter    ← fallback #1 (CPU)
    └── Piper Adapter      ← fallback #2 (ONNX CPU)
```

**Resource Budget (target):**
- VRAM: < 10GB peak (to leave room for Wan2.1 ~11GB or LTX ~9GB)
- RAM: < 4GB
- Cold-start: < 30s
- RTF: < 1.0 (real-time factor)

**GPU admission control:**
- If OmniVoice peak VRAM + Wan2.1 > 32GB → serial-only with arbiter
- If OmniVoice can run CPU-only as fallback → mark `cpu_fallback_possible`

### ⏳ C-Day1-3: Vietnamese Language Support Verification

**Critical:** OmniVoice claims 600+ languages but Vietnamese quality is unverified.

**Steps:**
1. Check paper / repo for Vietnamese specifically (ISO 639-1: `vi`)
2. Look for Vietnamese benchmark results (if any)
3. Check tokenizer/phoneme coverage for Vietnamese tones (6 tones + syllable structure)

---

## C-Day2 Execution Plan

### ⏳ C-Day2-1: Smoke Test — 5 VN Samples

Same 5-sample taxonomy as Spike 11.0c for direct comparison:

| # | Name | Type | Text | VieNeu Baseline |
|---|------|------|------|-----------------|
| 1 | sample1_short | Short generic | "Xin chào quý khách." | TBD |
| 2 | sample2_brand | Marketing slogan | "Bia tươi NQH — hương vị đậm đà chuẩn Đức." | TBD |
| 3 | sample3_long | Long narrative | "Hôm qua tôi đi dạo quanh hồ Gươm và thấy thành phố thật đẹp vào buổi chiều." | TBD |
| 4 | sample4_numbers | Numbers-heavy | "Giá phòng khách sạn Đà Lạt là một triệu hai trăm nghìn đồng một đêm." | TBD |
| 5 | sample5_emotion | Emotion-laden | "Thật tuyệt vờي! Chúng ta đã chiến thắng!" | TBD |

**Baseline requirement:** Generate same 5 samples with VieNeu (current default) for blind A/B comparison.

### ⏳ C-Day2-2: Performance Budget

| Metric | Target | Measured | Verdict |
|--------|--------|----------|---------|
| Cold-start (model load) | <30s | TBD | ⏳ |
| RTF (real-time factor) | <1.0 | TBD | ⏳ |
| Peak VRAM | <10GB | TBD | ⏳ |
| Idle VRAM | <4GB | TBD | ⏳ |
| CPU utilization | N/A (GPU expected) | TBD | ⏳ |

**VRAM coexistence test:**
- Load Wan2.1 (~11GB) + OmniVoice simultaneously → measure total
- If > 32GB → serial-only, arbiter required
- Document in ADR-007 if serial scheduling mandatory

### ⏳ C-Day2-3: VN Quality Gate — Hùng Blind A/B

**Reviewer:** Hùng (native Vietnamese speaker, same as Spike 11.0c)  
**Method:** Blind A/B — same 5 text prompts, VieNeu vs OmniVoice, random order  
**Minimum pass:** ≥ 4/5 "acceptable" **AND** Hùng explicitly states OmniVoice is "better" or "clearly better" than VieNeu  

**If Hùng says:**
- "OmniVoice better" + ≥ 4/5 acceptable → **PASS, recommend production**
- "About the same" + ≥ 4/5 acceptable → **MARGINAL — discuss with CPO/CTO**
- "Worse than VieNeu" OR < 4/5 acceptable → **FAIL → REJECT OmniVoice**

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-OMN-001 | Vietnamese not actually well-supported (600+ lang = broad but shallow) | Medium | Quality fail | C-Day1-3 verification; if weak VN → fail fast |
| R-OMN-002 | VRAM too high (>10GB) to coexist with video pipelines | Medium | Architecture fail | Measure Day 2; if high → CPU fallback or serial-only |
| R-OMN-003 | Weight license not truly Apache 2.0 (HF card vs actual) | Medium | Legal block | Read LICENSE carefully; CTO legal tick before prod |
| R-OMN-004 | Inference too slow (RTF > 1.0) for production UX | Low | Performance fail | Benchmark Day 2; if slow → reject |
| R-OMN-005 | Zero-shot cloning quality poor for Vietnamese | Medium | Product limitation | Test with 3-5s VN reference audio; compare to VieNeu |

---

## Appendix

### A. Repository Info

- **Repo:** TBD (search `omnivoice` / `OmniVoice-TTS` on GitHub / HuggingFace)
- **License:** Apache 2.0 (claimed — verify Day 1)
- **Languages:** 600+ (claimed — verify Vietnamese specifically)
- **Training data:** 581k hours (claimed)
- **Architecture:** Single-stage text-to-acoustic (diffusion language model style)

### B. Comparison Matrix (Pre-Spike)

| Engine | License | VN Quality | Cloning | VRAM | CPU Fallback | Status |
|--------|---------|------------|---------|------|--------------|--------|
| **VieNeu** | Apache 2.0 | Baseline (good) | ✅ | 2-4GB | ✅ | **DEFAULT** |
| **OmniVoice** | Apache 2.0 (TBC) | Unknown | ✅ | TBD | TBD | **SPIKE** |
| **MeloTTS** | MIT | Acceptable | ❌ | 0 GB | ✅ | Fallback #1 |
| **Piper** | MIT | Basic | ❌ | 0 GB | ✅ | Fallback #2 |

### C. Decision Flowchart

```
Sprint 12 Start
    │
    ▼
┌─────────────────┐
│ License audit   │──FAIL──→ REJECT OmniVoice
│ (Apache 2.0)    │        │ Keep VieNeu default
└─────────────────┘        │
    │ PASS                 │
    ▼                      │
┌─────────────────┐        │
│ 5-sample smoke  │──FAIL──┤
│ test            │        │
└─────────────────┘        │
    │ PASS                 │
    ▼                      │
┌─────────────────┐        │
│ Performance +   │──FAIL──┤
│ VRAM budget     │        │
└─────────────────┘        │
    │ PASS                 │
    ▼                      │
┌─────────────────┐        │
│ Hùng A/B ≥ 4/5  │──FAIL──┤
│ AND beats VieNeu│        │
└─────────────────┘        │
    │ PASS                 │
    ▼                      │
 APPROVE OmniVoice         │
 for production            │
 Update ADR-007            │
```

---

## CPO Approval Note

> **CPO pre-approves Sprint 12 OmniVoice spike with conditions:**
> 1. Spike is **exploration-only** — no production deploy regardless of technical pass.
> 2. Production approval requires **Hùng explicitly preferring OmniVoice over VieNeu** in blind A/B.
> 3. If OmniVoice VRAM > 10GB peak, must document serial scheduling in ADR-007.
> 4. If any gate fails, OmniVoice is **rejected** — no retry, no partial acceptance.
> 5. Sprint 13 fine-tune MeloTTS only triggers if OmniVoice rejected AND CPO approves budget.
>
> **Zero-cost mandate remains:** No cloud API fallback (ElevenLabs, etc.) for default path.

---

*Spike 12.0a | OmniVoice Vietnamese | PLANNED | Owner: @coder | Gate: Hùng A/B vs VieNeu*
