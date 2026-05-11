---
Version: 6.3.1
Date: 2026-05-11
Status: ACTIVE — CTO disposition of F6 spike result
Authority: "@cto (OGA)"
Stage: "08-collaborate"
related:
  - "docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md (Kimi report)"
  - "docs/08-collaborate/HANDOFF-F6-ACCEPTANCE-vineu-mps-ceo-m4pro-2026-05-12.md"
  - "docs/08-collaborate/KIMI-PROMPT-vineu-mps-spike-2026-05-12.md"
  - "AI-Platform docs/02-design/12-architecture-decisions/adr-090-ws-c-vineu-path-decision-template-2026-05-11.md"
---

# OGA CTO Disposition — F6 VieNeu MPS Spike Result

**From**: OGA @cto  
**To**: AI-Platform @cto, AI-Platform @pm, @human (CEO Tài Đăng — informational)  
**Date**: 2026-05-11 (same day as spike execution)  
**Re**: F6 spike returned FAIL at upstream arch gate. WS-C path decision is now evidence-ready.

---

## 1. TL;DR

CEO ran Kimi CLI on his M4 Pro 24G. Spike **halted at STEP 3 in ~10 minutes** with a hard, decisive result:

> `pnnbao/vieneu-tts:serve` is published as **`linux/amd64` only**. No `arm64` manifest exists. On Apple Silicon, the image cannot be pulled natively. Forcing emulation (Rosetta/QEMU) does not yield MPS — PyTorch MPS requires native arm64 execution.

**Verdict (per Kimi's literal application of my decision tree)**: FAIL  
**CTO reclassification (informational)**: equivalent to **CUDA-ONLY** for WS-C decision purposes — same downstream implication.

**WS-C path: C.3 (replace engine) is now required for Mac Mini M4 Pro production target.** Path C.1 (rework adapter for serve mode) is no longer viable until upstream publishes an arm64 build.

---

## 2. Verdict reclassification (transparency note)

The Kimi report says **FAIL**. My handoff prompt's STEP 3 decision tree mapped:
- "CUDA-only error" → CUDA-ONLY
- "Container does not start (image arch mismatch, runtime error)" → FAIL

Kimi correctly applied the tree: arch mismatch is literally "container does not start." But the **semantic outcome is identical to CUDA-ONLY**: VieNeu does not run on Apple Silicon at all. Both verdicts trigger the same WS-C decision: path C.3 (replace).

For reporting consistency going forward, I'm treating this result as **CUDA-ONLY (subtype: arch-mismatch upstream)**. The Kimi report stays as-is on disk — operator followed the prompt to the letter, prompt's decision tree was the gap.

Prompt fix for any future spike: amend STEP 3 decision tree to:
- B') Container errors with "CUDA-only" / "no CUDA device" / "no matching manifest for arm64" / arch-mismatch → verdict=CUDA-ONLY

---

## 3. What this unblocks

| Item | Status before F6 | Status now |
|---|---|---|
| WS-C path decision (C.1 vs C.3) | Awaiting MPS spike evidence — gate at 2026-06-15 | **Evidence ready 2026-05-11 — gate can move forward ~5 weeks** |
| ADR-008 D2 ("VieNeu GPU-only for Mac Mini production") | Pending compatibility verification | **D2 confirmed by upstream-arch evidence: GPU-only effectively means x86_64-CUDA only** |
| Mac Mini procurement urgency for AI-Platform | Demoted P0→P1 after F6 (compatibility unblocked via CEO laptop) | **Stays P1** — compatibility now known impossible regardless of hardware delivery |
| AI-Platform S124 VieNeu MPS spike | Pre-authorized backup | **Superseded / cancelled** — no more MPS work needed on VieNeu upstream |
| OmniVoice / alternative engine spikes | Out-of-sprint | **Promoted to S124 P0** — replacement engine must be selected |

---

## 4. Cost analysis (the F6 win)

| Metric | Value |
|---|---|
| Total CEO time spent | ~10 minutes |
| Time saved vs waiting for Mac Mini July delivery | ~7-8 weeks |
| WS-C decision gate move-up | From 2026-06-15 → recommended 2026-05-20 (next CTO sync) |
| Cost of running the spike | $0 (no installs, no procurement) |
| CEO device residual impact | Zero (no pulls, no installs, no mutations) |
| Engineering rework risk if we'd gone path C.1 | High — wasted 2-3 weeks adapter work for an impossible deployment |

This is the cleanest spike outcome the F6 handoff could have produced: a fast, deterministic NO that prevents downstream waste.

---

## 5. Actions

### Immediate (today, 2026-05-11)

| # | Owner | Action |
|---|---|---|
| A1 | @cto-OGA | File this disposition + Kimi report into OGA repo, push to main (this commit) |
| A2 | @cto-OGA | Notify AI-Platform @cto + @pm via Slack/email with link to disposition |
| A3 | @cto-OGA | Update HANDOFF-F6-ACCEPTANCE.md §4 schedule to mark spike CLOSED 2026-05-11 |
| A4 | @cto-OGA | Update ADR-008 D2 with confirmation footnote linking to this disposition |

### Short-term (this week, by 2026-05-15)

| # | Owner | Action |
|---|---|---|
| B1 | AI-Platform @pm | Acknowledge F6 result in their impact tracker; close F6 row |
| B2 | AI-Platform @cto | Move WS-C decision gate from 2026-06-15 → 2026-05-20 (next CTO+CPO sync). Path C.3 (replace engine) becomes default unless upstream maintainer commits to arm64 build by then. |
| B3 | AI-Platform @architect | Pause `vineu_adapter.py` rework draft (was parallel work in S123 Days 5-9). C.1 path is dead unless upstream ships arm64. |
| B4 | AI-Platform @pm | Reach out to upstream maintainer `pnnbao` with arm64 build request — set 14-day response window, then assume unavailable. |
| B5 | @cto-OGA (advisory) | Recommend 3-5 candidate replacement TTS engines with native arm64/MPS support for AI-Platform's S124 evaluation spike (Piper already known good — MeloTTS too, both already in production allowlist) |

### Medium-term (S124, 2026-06-09 onward)

| # | Owner | Action |
|---|---|---|
| C1 | AI-Platform @architect + @coder | If WS-C goes C.3: select replacement engine, draft new adapter, S124 spike on Mac Mini once hardware arrives |
| C2 | AI-Platform @cto | Re-evaluate `aiplatform-voice-vieneu` registry entry in ADR-008 D6. Currently "Deferred S118" — if engine replaced, this row should be removed, replaced with new engine's consumer entry |

---

## 6. Replacement engine candidates (CTO advisory, not decision)

For AI-Platform's WS-C C.3 path, the following engines have **native arm64 / MPS support** and could replace VieNeu:

| Engine | Native arm64 | License | VN quality (known) | Notes |
|---|---|---|---|---|
| **Piper TTS** (vais1000) | ✅ Yes (ONNX runtime) | MIT | Already in production allowlist; CEO sign-off 2026-05-10 | Already deployed. Could become primary on Mac Mini with no engineering work. |
| **MeloTTS** | ✅ Yes (PyTorch + transformers) | MIT (underthesea GPL v2+ via REST boundary) | Hùng 5/5 PASS (Spike C) | Already deployed. Already AI-Platform's vi-melotts-default. |
| **XTTS-v2 (Coqui)** | ✅ Yes | CPML (commercial OK for SaaS) | Untested VN; supports VN; voice cloning | Heavier (~2GB), but state-of-art quality. |
| **VITS-based community VN models** | ✅ Yes (PyTorch) | Varies (check per model) | Variable | Needs spike evaluation. |

**CTO recommendation**: AI-Platform should ask whether **C.3 even needs a new engine**. Piper + MeloTTS already cover production allowlist. The VieNeu integration was for "highest quality" position — if Piper/MeloTTS quality is acceptable per Hùng's existing reviews, **C.3 may resolve to "remove VieNeu, keep existing two-engine stack"** with zero new engineering cost.

This is the path of least resistance. Formal decision is AI-Platform CTO + CPO call at the WS-C gate.

---

## 7. Open items for AI-Platform response

By **2026-05-15 EOD**, AI-Platform CTO should respond on:

1. **Accept reclassification** of F6 verdict from FAIL → CUDA-ONLY (semantic equivalence) for ADR-090 WS-C template?
2. **Accelerate WS-C gate** from 2026-06-15 → 2026-05-20? (Yes recommended.)
3. **Upstream outreach** to `pnnbao` for arm64 build — who owns the request, 14-day window?
4. **C.3 scope question**: replace VieNeu with new engine, or remove VieNeu and rely on existing Piper + MeloTTS?

---

## 8. CTO sign

F6 closed with hard, fast NO at upstream gate. Process worked exactly as designed: short spike, clean result, zero device impact, ~7 weeks of project time saved.

OGA's involvement in WS-C concludes here — replacement engine selection and adapter rework are AI-Platform decisions per role boundary (OGA = consumer of voice service, not engine owner).

**Reminder to OGA team**: Track B (Voice Studio UI) already calls AI-Platform's allowlist `vi-piper-vais1000` + `vi-melotts-default`. If AI-Platform chooses to drop VieNeu entirely (no replacement), Track B requires zero changes. If they add a new engine, Track B's `ALLOWED_VOICES` allowlist needs a one-line addition + 1 test.

---

*OGA @cto | F6 spike disposition | 2026-05-11 | WS-C decision evidence-ready ~7 weeks ahead of original gate*
