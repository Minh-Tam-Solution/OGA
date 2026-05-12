---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — OGA CTO ratification of AI-Platform F6 response
Authority: "@cto (OGA)"
Stage: "08-collaborate"
deadline_met: "Yes (within 2026-05-15 EOD ask)"
related:
  - "docs/08-collaborate/HANDOFF-F6-DISPOSITION-RESPONSE-from-aiplatform-2026-05-12.md"
  - "docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md"
  - "docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md (D2 footnote target)"
---

# OGA CTO — Ratification of AI-Platform F6 Response

**From**: OGA @cto  
**To**: AI-Platform @cto + AI-Platform @pm  
**Date**: 2026-05-12  
**Re**: Disposition of 4 open asks raised in HO-F6-RESP

---

## TL;DR

All four asks **ACK / RATIFIED / CONFIRMED**. Closing the F6 → WS-C loop with AI-Platform CTO's recommended path. No counter-proposals from OGA side. WS-C decision gate moves to **2026-06-01**.

| Ask | OGA disposition |
|---|---|
| Q2 — Gate 2026-06-01 (vs 2026-05-20) | ✅ **ACK 2026-06-01** |
| Q3 — Sub-decision (a) B.1 + B.3 combo | ✅ **CONFIRM (a)** |
| D2 — Footnote text | ✅ **RATIFY as proposed** |
| Q4 — AI-Platform @cto owns upstream arm64 request | ✅ **ACK** |

---

## 1. Q2 — Gate date acknowledged: 2026-06-01

OGA accepts **2026-06-01**. AI-Platform's rationale (1-2 weeks realistic execution + S123 close buffer + velocity gate alignment) is sound. My original 2026-05-20 ask was optimistic — it assumed pure "no replacement engineering" which §3 just disproved.

Locked: **WS-C decision gate = 2026-06-01**.

OGA Sprint 13 plan and ADR-008/009 already reflect F6 closure; the 2026-06-01 gate date will be propagated in next routine doc-update pass (no urgent rewrite needed).

---

## 2. Q3 — Path B.1 + B.3 combo confirmed (option a)

I confirm AI-Platform CTO's selection: **(a) B.1 + B.3 combo**.

**Why I'm not pushing back to (c) "pure drop-entirely":**

My original "zero-engineering" hint missed the **Male/Southern VN coverage axis**. AI-Platform @architect's voice registry analysis (verified on disk 2026-05-12) shows that dropping VieNeu entirely leaves the production allowlist with **Female-or-unspecified voices only**. That's a real product gap, not just a license edge case.

The B.1 + B.3 combo costs ~4-5h engineering total — close to the zero-eng intent — while:
- Preserving the upstream license-clarification path (B.1) at zero immediate cost
- Documenting Male VN coverage gap explicitly (B.3) so it's visible to CPO + marketing rather than silently absent
- Keeping F5-TTS-Vietnamese (`hynt/F5-TTS-Vietnamese-ViVoice` 2,285 downloads) as Path C reserve for S125+ future quality work

**Path C (F5-TTS evaluation) parked correctly** — no need to pull it forward unless B.1 license inquiry produces a viable Male voice within the 14-day window, in which case re-evaluation is bonus, not scope creep.

**Not pushing for (b) "pivot to F5-TTS now"** because:
- F5-TTS hasn't been spiked yet → unknown VRAM, latency, license fitness on Mac Mini MPS
- Doing it in S124 would push WS-C back to 2026-06-15 (lose AI-Platform's careful gate-move)
- Better: lock 2026-06-01 with current 2-engine ratified stack, evaluate F5-TTS post-cutover when stakes are lower

---

## 3. D2 footnote — RATIFIED as proposed

The proposed footnote text is accurate and well-scoped. **OGA CTO authorizes AI-Platform (or OGA @architect) to apply the footnote to ADR-008 D2 verbatim**:

```
*Footnote 2026-05-12*: Per F6 spike, `pnnbao/vieneu-tts:serve`
upstream image is `linux/amd64` only, no `arm64` manifest. PyTorch
MPS requires native arm64. VieNeu is therefore unavailable on Apple
Silicon hardware (Mac Mini M4 Pro production target). D2's
"GPU-only" stance compounds with this distribution constraint — both
together close the path to VieNeu on the production cutover host.
Path C.3 (replace) is the resulting WS-C decision.
```

**Note on application authority**: Either team can land this footnote. If AI-Platform applies it via PR, OGA reviews & merges. If OGA applies it, AI-Platform's existing acknowledgement here is sufficient prior approval.

**Note for OGA @architect**: this footnote does NOT remove the `aiplatform-voice-vieneu` row from D6 registry. That removal still waits for the formal voice-registry migration that AI-Platform will execute as part of the B.3 cutover work post-2026-06-01. Until then, D6 row stays with F6 FAIL footnote (already present).

---

## 4. Q4 — Upstream arm64 request ownership acknowledged

OGA acknowledges:
- **Owner**: AI-Platform @cto
- **Window**: 2026-05-12 → 2026-05-26 (14 days, hard close at S123 kickoff)
- **Target**: `https://github.com/pnnbao97/VieNeu-TTS`
- **Posting date**: 2026-05-13 morning

OGA stands down on this thread — no parallel inquiry, no shadow ask. If upstream responds within window, AI-Platform CTO triages and flags to OGA only if outcome changes Path B/C disposition. If silent or declines → AI-Platform closes track at 2026-05-26.

---

## 5. ROI flag — endorsed for CEO + CPO visibility

AI-Platform's §7 ROI observation is accurate. F6 spike on CEO's M4 Pro 24G surfaced this entire decision tree in ~10 minutes of CEO time, preventing ~6-7 weeks of post-procurement engineering waste in S124.

**OGA CTO endorses elevating this to CEO + CPO** as a reusable pattern:
- **Pattern name**: *Pre-procurement compatibility validation via personal device*
- **Use case**: any future cross-platform / cross-arch / new-hardware integration spike where the question is "does upstream X support architecture Y at all" — frequently determinable from registry/manifest metadata without execution
- **Cost**: 10-30 min of human-supervised AI agent time on personal device, plus cleanup
- **Recommended adoption**: explicit checkpoint in Sprint planning template for any Sprint that introduces new hardware OR new upstream OSS for production

Will fold this as a one-paragraph addition to OGA Sprint planning template (Sprint 14 planning), and recommend AI-Platform mirror in their template. No immediate action needed from CEO/CPO beyond awareness.

---

## 6. Net status after this ratification

| Item | Status |
|---|---|
| Q1 — FAIL ≡ CUDA-ONLY semantic | ✅ Mutual agreement |
| Q2 — Gate date | ✅ 2026-06-01 locked |
| Q3 — Sub-decision | ✅ Path B.1 + B.3 combo confirmed |
| Q4 — Upstream arm64 owner | ✅ AI-Platform @cto owns 2026-05-12 → 2026-05-26 |
| D2 footnote | ✅ Ratified; either team applies |
| F5-TTS evaluation | 🅿️ Parked Path C reserve, S125+ |
| WS-C decision gate | 🚀 2026-06-01 (was 2026-06-15) |
| F6 spike workflow | ✅ Fully closed cross-team |

---

## 7. Open items remaining (post this ratification)

| # | Item | Owner | Deadline |
|---|---|---|---|
| O1 | Apply D2 footnote to ADR-008 | Either team (OGA @architect or AI-Platform @architect) | 2026-05-20 |
| O2 | Upstream arm64 issue at pnnbao97/VieNeu-TTS | AI-Platform @cto | 2026-05-13 morning post; close 2026-05-26 |
| O3 | rhasspy/piper-voices license inquiry (B.1) | AI-Platform @architect | Async; 14-day window from posting |
| O4 | B.3 cutover execution (voice registry soft-delete VieNeu + ADR-090 §D6 amendment) | AI-Platform @architect + @coder | By 2026-06-01 WS-C gate |
| O5 | OGA @architect: review ADR-007 draft → merge canonical v5 | @oga-architect | This week |
| O6 | F6 pattern → Sprint 14 planning template addition | OGA @cto (light touch) | Sprint 14 kickoff |
| O7 | Voice registry coverage gap doc (Male VN) | AI-Platform @pm + CPO + marketing | Before 2026-06-01 |

---

## 8. Sign

OGA CTO confirms all 4 asks. AI-Platform proceeds with B.1 + B.3 path. F6 cross-team workflow CLOSED on OGA side; remaining items (O1-O7) are execution under already-agreed disposition, not new asks.

No further CTO touchpoint needed until:
- **2026-05-26**: upstream arm64 response window closes (informational ping from AI-Platform if outcome relevant)
- **2026-06-01**: WS-C gate execution (CTO observes, no decision-making)

Sprint 13 OGA-side closes on track. Track B (Voice Studio UI) requires zero changes — allowlist already excludes VieNeu, and any future Male VN voice added by AI-Platform under B.1 will be a one-line allowlist addition + 1 test.

---

*OGA @cto | F6 response ratification | 2026-05-12 | Within 2026-05-15 EOD ask | Cross-team loop closed*
