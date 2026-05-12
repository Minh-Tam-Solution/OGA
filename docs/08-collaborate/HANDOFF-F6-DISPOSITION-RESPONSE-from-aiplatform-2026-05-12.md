---
handoff_id: HO-F6-RESP
date: 2026-05-12
from: "AI-Platform @cto"
to: "OGA @cto / OGA team"
scope: "AI-Platform disposition response to OGA's 4 open asks on F6 spike result"
related:
  - "OGA `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md` (OGA CTO 4 questions)"
  - "OGA `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md` (Kimi spike report)"
  - "AI-Platform `docs/08-collaborate/03-sprint-management/cto-disposition-f6-result-2026-05-12.md` (full Q1-Q4 rationale)"
  - "AI-Platform `docs/08-collaborate/03-sprint-management/path-b-step1-piper-vn-male-sourcing-2026-05-12.md` (sourcing blocker)"
status: "ANSWERED — Q1-Q4 dispositioned by AI-Platform CTO 2026-05-12"
---

# AI-Platform Response — F6 Disposition

**From**: AI-Platform @cto  
**To**: OGA @cto + OGA team  
**Date**: 2026-05-12  
**Re**: Response to your CTO-DISPOSITION-F6 4 open asks (deadline 2026-05-15 EOD)

---

## TL;DR

Spike result accepted; you were right on F6 ROI (~7 weeks early
discovery). All 4 questions dispositioned. Headline points:

- **Q1**: ACCEPTED — FAIL ≡ CUDA-ONLY semantic reclassification
- **Q2**: CONDITIONAL — gate moves to **2026-06-01** (not 2026-05-20)
- **Q3**: Path B selected (drop VieNeu + source Piper VN Male), BUT
  sourcing surfaced an upstream blocker requiring a sub-decision —
  see §3 below
- **Q4**: AI-Platform @cto owns 14-day upstream arm64 request
  (2026-05-12 → 2026-05-26 hard close)

Full disposition with rationale:
`AI-Platform/docs/08-collaborate/03-sprint-management/cto-disposition-f6-result-2026-05-12.md`

---

## 1. Q1 — Reclassification accepted

You were right that arch-mismatch and CUDA-bound are semantically
equivalent for WS-C decision purposes. Both close paths C.1/C.2 and
trigger C.3.

Tracking convention going forward across both repos:
**"FAIL (Kimi literal) ≡ CUDA-ONLY (CTO semantic)"**

Kimi report stays as-is on disk (operator followed the prompt to the
letter; the gap was prompt authorship, not operator). Your proposed
prompt template fix (fold arch-mismatch into CUDA-ONLY branch in STEP 3)
is fine — we'll consume it on the next spike cycle.

---

## 2. Q2 — Gate move 2026-06-15 → 2026-05-20 is too aggressive; AI-Platform proposes **2026-06-01**

Rationale: Even though Path C.3 (replace) decision is clear, executing
the engine swap requires:

- Voice registry migration (~2h)
- ADR-090 §D6 amendment (~2-3h)
- Hùng A/B quality validation (~half day)
- If new voice sourced: smoke test + integration (~4-6h)

Add buffer for the sub-blocker (see §3) and you're at ~1-2 weeks
realistic, not 5 working days.

**2026-06-01 proposed** balances:
- 2.5 weeks runway from today
- 2-week buffer before AI-Platform S123 close 2026-06-06
- Aligns with OGA velocity gate day per Sprint 263 Track B pattern
- Reasonable for both teams to ratify with confidence

**Ask: please ack 2026-06-01 vs 2026-05-20.** If OGA holds firm on
2026-05-20, AI-Platform forced to Path A (truly zero engineering,
accept Male/Southern Vietnamese coverage gaps) — see §3 for why we
think that's risky.

---

## 3. Q3 — Path B selected, but sourcing blocker surfaced

Selected sub-option from Path C.3: **Path B (drop VieNeu, source Piper
VN Male voice)**. Reasoning vs your "drop entirely" hint:

Production voice registry analysis (verified on disk 2026-05-12):

| Coverage axis | VieNeu | MeloTTS | Piper | Drop-entirely impact |
|---|---|---|---|---|
| VN Northern/Standard | — | ✅ Female | partial | OK |
| VN Southern | ✅ Male | — | — | **GAP** |
| VN Male | ✅ | — | — partial Female | **GAP** |
| VN Central | — | — | ✅ Piper Central | OK |

OGA's "zero engineering possibly required" hint didn't account for the
Male and Southern coverage loss. If we drop entirely, production
allowlist shrinks to **3 Female-or-unspecified-gender voices only**.

So AI-Platform CTO selected Path B (source Male) rather than Path A
(accept gaps).

### BUT — sourcing blocker (2026-05-12 research)

AI-Platform @architect surveyed `rhasspy/piper-voices` upstream:

| Voice | License | Gender | Production viable? |
|---|---|---|---|
| `25hours_single` (low) | **Unknown** | Likely Male | ❌ license blocker |
| `vais1000` (medium) | CC-BY-4.0 ✅ | Female (already in our registry) | ✅ already in use |
| `vivos` (x_low) | CC-BY-NC-SA ❌ | Multi-speaker | ❌ non-commercial |

**No production-licensed Male Vietnamese Piper voice exists upstream.**

Full sourcing report:
`AI-Platform/docs/08-collaborate/03-sprint-management/path-b-step1-piper-vn-male-sourcing-2026-05-12.md`

### AI-Platform CTO leaning toward B.1 + B.3 combo

- **B.1**: Open license-clarification issue at `rhasspy/piper-voices`
  for `25hours_single` (parallel to your Q4 upstream arm64 ask).
  14-day async track.
- **B.3**: Accept Female-only stack now, document Male VN coverage gap
  as future quality work. Effectively converges with your original
  "zero engineering" hint but with explicit license-inquiry path
  preserving the option.

**Net engineering work for cutover: ~4-5h** (voice registry soft-delete
VieNeu + ADR-090 §D6 amendment). Even closer to your zero-eng intuition
than original Path B estimate.

**Broader signal we observed**: community Vietnamese TTS has migrated
to F5-TTS, not Piper. `hynt/F5-TTS-Vietnamese-ViVoice` has 2,285
downloads — the rest of the Piper VN voices are <10 downloads each.
Future engine upgrade work likely targets F5-TTS, not custom Piper
training. We've parked this as Path C reserve for future quality work
(S125+).

### Confirmation needed from OGA

OGA-CTO either confirms or counter-proposes:
- (a) **AI-Platform's B.1 + B.3 combo**: accept Male VN coverage gap
  short-term; preserve license-inquiry option
- (b) **Pivot to Path C now**: evaluate F5-TTS-Vietnamese in S124, push
  WS-C gate back to 2026-06-15 original
- (c) **Pure drop-entirely** (OGA's original hint): accept all gaps
  including license inquiry as not-worth-pursuing

AI-Platform CTO recommends (a). Awaiting OGA-CTO ack.

---

## 4. Q4 — Upstream arm64 request

**AI-Platform @cto signs** (engine selection scope + adapter ownership).

- Window: 2026-05-12 → 2026-05-26 (14 days hard close = S123 kickoff)
- Repo: `https://github.com/pnnbao97/VieNeu-TTS`
- Issue text drafted at:
  `AI-Platform/docs/08-collaborate/03-sprint-management/upstream-pnnbao-arm64-request-2026-05-12.md`
- Posting 2026-05-13 morning

Outcome handling:
- If upstream delivers within window → re-evaluate (bonus, doesn't
  reverse Path B already executed)
- If silent or declines → drop track at 2026-05-26 hard close

---

## 5. ADR-008 D2 amendment touch-point

Your disposition mentioned footnoting D2 to reflect upstream-arch
constraint. AI-Platform concurs. Proposed footnote text for D2:

> *Footnote 2026-05-12*: Per F6 spike, `pnnbao/vieneu-tts:serve`
> upstream image is `linux/amd64` only, no `arm64` manifest. PyTorch
> MPS requires native arm64. VieNeu is therefore unavailable on Apple
> Silicon hardware (Mac Mini M4 Pro production target). D2's
> "GPU-only" stance compounds with this distribution constraint — both
> together close the path to VieNeu on the production cutover host.
> Path C.3 (replace) is the resulting WS-C decision.

OGA-CTO ratifies this footnote at your convenience; AI-Platform won't
edit D2 directly without OGA sign-off.

---

## 6. What we ask back from OGA

**By 2026-05-15 EOD** (your original deadline):

1. **Ack on Q2 gate date**: 2026-06-01 vs 2026-05-20
2. **Confirm or counter on §3 sub-decision**: B.1+B.3 combo (a) vs
   Path C pivot (b) vs pure drop-entirely (c)
3. **Ratify D2 footnote** in OGA ADR-008 (text in §5 above)
4. **Acknowledge AI-Platform CTO owns Q4 upstream arm64 request**

Nothing else outstanding. AI-Platform S123 WS-A/B/D/E execution
proceeds independently per `sprint-123-ws-prep-2026-05-12.md` (S123
gate work unaffected by F6 outcome).

---

## 7. ROI note — credit where due

F6 spike on CEO's M4 Pro 24G surfaced this entire decision tree in
**~10 minutes of CEO time**. Without it, we'd have spent S124 doing
adapter rework against an image that doesn't exist on Apple Silicon —
discovered post-Mac Mini delivery in early July, ~6-7 weeks of
engineering waste.

Worth flagging to CEO + CPO: F6 was the highest-ROI spike pattern
we've executed this cycle. Pattern reusable for any future
cross-platform compatibility validation pre-procurement.

---

*AI-Platform @cto — 2026-05-12*  
*Filed in OGA repo for cross-team coordination + audit trail. Mirror copy of disposition rationale stays in AI-Platform tracker.*
