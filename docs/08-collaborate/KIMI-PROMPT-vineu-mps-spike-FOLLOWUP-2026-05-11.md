---
Version: 6.3.1
Date: 2026-05-11
Status: ACTIVE — CTO follow-up directive for Kimi CLI standby session
Authority: "@cto (OGA)"
Stage: "08-collaborate"
session_continuation_of: "docs/08-collaborate/KIMI-PROMPT-vineu-mps-spike-2026-05-12.md (initial F6 prompt)"
related:
  - "docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md (F6 primary result: FAIL/CUDA-ONLY)"
  - "docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md"
expected_runtime: "10-20 minutes (no pulls, no execution — registry manifest reads only)"
---

# CTO Follow-Up Directive — Kimi CLI Standby Session

**For**: Kimi CLI on CEO Tài Đăng's MacBook M4 Pro 24G (currently standby after F6 spike close)  
**From**: OGA @cto  
**Date**: 2026-05-11  
**Authority**: Same as F6 acceptance; this is a **scope extension within the original session window**, same cleanup constraints apply

---

## Why this exists

F6 returned a hard NO in 10 minutes by reading the upstream image manifest — **no pull, no execution needed**. That insight is the key: arm64 / Apple Silicon viability of a TTS engine is determinable from registry metadata alone.

While Kimi is standby and the session is still authorized, let's get the same answer for **3 candidate replacement engines** that AI-Platform will need to evaluate for WS-C path C.3. Same 10-minute cost, but 3× more decision evidence.

---

## What this is NOT

- ❌ Not a new spike — it's a manifest survey
- ❌ No image pulls (zero MB downloaded)
- ❌ No containers started
- ❌ No code execution
- ❌ No new file creation beyond appending to existing report

If any step requires pulling an image, **stop and ask CEO** before proceeding. Manifest inspection only.

---

## THE PROMPT — paste verbatim into the same Kimi session

```
CTO follow-up directive received. You are still operating under the same
F6 authority and constraints (personal device, time-boxed, no system
mutations).

Mission extension: do a REGISTRY MANIFEST SURVEY for 3 candidate
replacement TTS engines. The point is to determine, without pulling
any images, which engines have native linux/arm64 manifests.

CONSTRAINTS (unchanged from initial F6 prompt):
- No docker pull. Only `docker manifest inspect` (reads from registry).
- No code execution. Only metadata reads.
- Time budget: 20 minutes max for this extension.
- All output appended to ~/oga-vineu-spike/REPORT.md as §8 (new section).
- If `docker manifest inspect` fails for any image, document and move on.

CANDIDATE IMAGES (check in order):

1. Piper TTS (CPU, MIT, well-known upstream)
   - Image: rhasspy/piper:latest
   - Also try: rhasspy/wyoming-piper:latest (Home Assistant variant)
   - Expected: multi-arch including arm64

2. MeloTTS (CPU, MIT)
   - Image: myshell-ai/melotts:latest
   - Fallback: ghcr.io/myshell-ai/melotts:latest
   - Expected: arm64 likely (PyTorch + transformers, no CUDA-binding)

3. Coqui XTTS-v2 (CPU/GPU optional, CPML license)
   - Image: ghcr.io/coqui-ai/tts:latest
   - Fallback: coqui/tts:latest
   - Expected: multi-arch claim, verify

For each image, run:
   docker manifest inspect <image> 2>&1 | tee -a ~/oga-vineu-spike/manifest-survey.log

Then extract the platforms list and classify into one of:
   - ARM64-NATIVE     : has linux/arm64 manifest → ✅ candidate viable for Mac Mini
   - AMD64-ONLY       : no arm64 → ❌ same problem as VieNeu
   - NOT-FOUND        : image name does not exist on registry → flag for AI-Platform research
   - MULTI-ARCH-OTHER : has arm64 plus other arches → ✅ candidate viable

After all 3 are surveyed, append to REPORT.md §8 (new section) using this exact format:

  ## §8 Candidate replacement engine manifest survey (CTO follow-up)
  
  **Method**: `docker manifest inspect` only. No pulls, no execution.
  **Duration**: <NN> minutes.
  
  | # | Image | Platforms | Verdict |
  |---|---|---|---|
  | 1 | rhasspy/piper:latest | <list of platform/arch> | ARM64-NATIVE / AMD64-ONLY / NOT-FOUND |
  | 2 | myshell-ai/melotts:latest | <list> | <verdict> |
  | 3 | ghcr.io/coqui-ai/tts:latest | <list> | <verdict> |
  
  **Implications for WS-C C.3 path:**
  - <one-line summary per engine — viable replacement or not>
  - <CTO advisory: if Piper + MeloTTS both ARM64-NATIVE, C.3 = "drop VieNeu, keep existing two-engine stack" with zero new engineering>

STOP CONDITIONS:
- Any command needs internet for more than registry reads → halt + ask
- CEO says "stop" → halt + run cleanup (STEP 7 of original F6 prompt)
- 20 minutes elapsed → halt and report whatever you have

AFTER §8 IS WRITTEN:
- Display the §8 contents to CEO for visual confirmation
- Ask CEO: "Survey complete. Run final cleanup now (STEP 7 of original
  prompt), or hold the report directory open for another follow-up?
  [cleanup / hold]"
- On "cleanup": run STEP 7 from the original F6 prompt
- On "hold": print exit message with report path and stand by

BEGIN NOW with image 1 (rhasspy/piper:latest).
```

---

## What to do with the survey result

When Kimi appends §8 to the report and CEO transfers the updated report to OGA, I (CTO) will:

1. **If Piper + MeloTTS both ARM64-NATIVE** → escalate to AI-Platform CTO with recommendation: **WS-C C.3 = "no replacement needed"**. Drop VieNeu, keep existing two-engine stack. This is the path of least cost.

2. **If only one of (Piper, MeloTTS) is ARM64-NATIVE** → recommend that one as primary on Mac Mini; flag the other as needing replacement.

3. **If neither is ARM64-NATIVE** → escalate harder. AI-Platform needs to either build images themselves or pick from Coqui / community alternatives.

4. **If XTTS-v2 is ARM64-NATIVE and quality is acceptable** → optional upgrade candidate beyond Piper/MeloTTS for premium voice tier.

---

## Cleanup reminder

After §8 is written, **Kimi must still run STEP 7 (cleanup) from the original F6 prompt** before standing down. The manifest survey did not create new state, but the spike directory + Docker pre/post snapshots still need finalization per the original prompt's cleanup discipline.

CEO confirms cleanup → Kimi executes → session formally closes.

---

## Time accounting

| Phase | Time |
|---|---|
| F6 primary spike (already done) | ~10 min |
| §8 manifest survey (this directive) | ~10-20 min |
| Cleanup STEP 7 | ~5 min |
| **Total session burn so far** | ~25-35 min |
| **Authorized budget** | 4 hours |
| **Remaining headroom** | ~3.5 hours (not used) |

If something interesting surfaces during the survey (e.g. one image has weird arch metadata), CTO may issue another sub-directive within the remaining headroom — but expectation is the survey is the last task.

---

*OGA @cto | F6 follow-up directive | 2026-05-11 | Manifest survey only — no execution, no pulls*
