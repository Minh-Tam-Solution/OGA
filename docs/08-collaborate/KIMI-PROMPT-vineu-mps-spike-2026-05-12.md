---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — Kimi CLI handoff prompt for VieNeu MPS spike F6
Authority: "@cto (OGA)"
Stage: "08-collaborate"
target_runtime: "Kimi CLI on CEO MacBook M4 Pro 24G"
session_window: "2026-05-15 → 2026-05-22 (CEO calendar)"
related:
  - "docs/08-collaborate/HANDOFF-F6-ACCEPTANCE-vineu-mps-ceo-m4pro-2026-05-12.md"
  - "docs/08-collaborate/HANDOFF-F6-VIENEU-MPS-TEST-ON-CEO-M4PRO-2026-05-12.md"
---

# Kimi CLI Handoff Prompt — VieNeu MPS Compatibility Spike

**For**: Kimi CLI agent running on CEO Tài Đăng's personal MacBook M4 Pro 24G  
**Purpose**: Run VieNeu Apple Silicon (MPS) compatibility spike, produce structured report, leave device clean  
**Authority**: OGA CTO + AI-Platform CTO joint authorization (HO-F6)

---

## How to use this file

1. CEO opens Kimi CLI on his MacBook M4 Pro 24G
2. CEO authorizes a 2-4 hour session window
3. CEO pastes **the prompt block in §2 below** as the initial message to Kimi
4. Kimi executes step-by-step, asking CEO confirmation at the 3 explicit checkpoints
5. Session closes with a committed report file at `~/oga-vineu-spike/REPORT.md`
6. CEO ships the report to OGA via git or scp (path documented at end)

---

## 1. Hard guardrails Kimi must respect

These are **non-negotiable** — the prompt below enforces them, but listing here for human review before paste:

| # | Rule |
|---|---|
| G1 | This is CEO's **personal device**. Treat every action as if a colleague is reviewing it tomorrow. |
| G2 | **Time-box: 4 hours max** from session start. If not done at 4h, halt + report progress. |
| G3 | **No persistent installs** except Docker Desktop (if CEO confirms). No launchctl, no system extensions, no global pip packages. |
| G4 | **No keychain writes**, no credentials saved, no SSH key generation. |
| G5 | **All work in `~/oga-vineu-spike/`**. No mutations outside this directory + `~/Library/Containers/com.docker.docker` (if Docker newly installed). |
| G6 | **CEO confirmation required** at: install Docker (if needed), pull `pnnbao/vieneu-tts:serve` image, session close cleanup. |
| G7 | **Halt early on hard failure**. CUDA-only error at upstream gate = valid result, report it, do NOT try workarounds. |
| G8 | **No internet uploads** except: docker pull from upstream registry, git push final report (if CEO authorizes). |

---

## 2. THE PROMPT — paste this verbatim into Kimi CLI

```
You are running on Tài Đăng's personal MacBook M4 Pro 24G as the spike-runner
for OGA Sprint 13 F6 handoff. You are NOT a general-purpose assistant for this
session — you are executing one tightly-scoped engineering task with a time
budget of 4 hours.

MISSION:
Test whether the upstream Docker image `pnnbao/vieneu-tts:serve` runs on Apple
Silicon via PyTorch MPS backend, and report the result in a structured format.
This unblocks the WS-C path decision for AI-Platform's voice service.

CONTEXT YOU NEED:
- VieNeu is a Vietnamese TTS engine. AI-Platform has been using it on CUDA
  (NVIDIA RTX 5090, S1 server). Production target in July is Mac Mini M4 Pro
  48G. We need to know whether VieNeu runs on Apple Silicon at all.
- CEO's MacBook is M4 Pro 24G — same chip family as production Mac Mini, less
  memory. Compatibility transfers; VRAM headroom does NOT.
- Three outcome codes matter:
    PASS       = MPS runs, audio out is valid, stable over 10 calls
    CUDA-ONLY  = upstream image cannot start with MPS (hard fail at first run)
    PARTIAL    = MPS starts but fails stability or quality
    FAIL       = something else broke (capture details)

HARD CONSTRAINTS:
1. This is a personal device. Every command writes inside ~/oga-vineu-spike/
   or to Docker. Nothing else.
2. Time-box: 4 hours from now. If not done, halt and report partial result.
3. Stop at first hard fail. Do NOT attempt CPU fallback adapter work, do NOT
   debug upstream source, do NOT install Python packages globally.
4. Ask CEO explicit YES/NO before: (a) installing Docker Desktop if missing,
   (b) pulling the 5+GB upstream image, (c) running cleanup at session close.
5. Do not commit anything to keychain, launchctl, /etc/, or generate SSH keys.

EXECUTION PROTOCOL — follow these steps in order, do not skip:

STEP 0 — Session metadata + pre-snapshot
  - Print session start time, your model name+version, expected end time (now+4h)
  - mkdir -p ~/oga-vineu-spike
  - cd ~/oga-vineu-spike
  - Capture pre-state snapshots:
      brew list > pre-brew.txt
      ls /Applications > pre-apps.txt
      ps -ax | grep -iE 'docker|tts|vieneu' > pre-proc.txt
      docker ps -a > pre-docker.txt 2>&1 || echo "docker not installed" > pre-docker.txt
  - Print system info: sw_vers, sysctl -n machdep.cpu.brand_string, sysctl hw.memsize

STEP 1 — Docker availability check
  - Run: docker version
  - If Docker is present and daemon running → continue to STEP 2
  - If Docker is missing or daemon not running:
      Ask CEO: "Docker Desktop is required for this spike. Install it now?
      It will be tracked for removal at session close. [yes/no]"
      If yes: open https://www.docker.com/products/docker-desktop and pause
              until CEO confirms install complete. Then re-run docker version.
      If no: HALT. Write REPORT.md with verdict=FAIL, reason="no Docker, CEO declined install".

STEP 2 — Confirm before pulling 5+GB image
  - Ask CEO: "About to pull pnnbao/vieneu-tts:serve (~5-8 GB). Proceed? [yes/no]"
  - If no: HALT. Write REPORT.md with verdict=FAIL, reason="CEO declined image pull".
  - If yes: docker pull pnnbao/vieneu-tts:serve

STEP 3 — Upstream MPS gate (this is the critical checkpoint)
  - Try to start VieNeu with MPS-only torch:
      docker run --rm --platform linux/arm64 \
        -e TORCH_DEVICE=mps \
        -e CUDA_VISIBLE_DEVICES= \
        --name vieneu-mps-test \
        pnnbao/vieneu-tts:serve \
        python -c "import torch; print('mps_avail=', torch.backends.mps.is_available()); print('mps_built=', torch.backends.mps.is_built())"
  - Capture stdout, stderr, exit code into ~/oga-vineu-spike/step3-upstream-gate.log
  - Decision tree:
      A) Container exits 0 AND prints mps_avail=True → continue to STEP 4
      B) Container errors with "CUDA-only" / "no CUDA device" / similar →
          set verdict=CUDA-ONLY, write report, jump to STEP 7
      C) Container does not start (image arch mismatch, runtime error) →
          set verdict=FAIL, capture error, write report, jump to STEP 7

STEP 4 — Single-shot Vietnamese synthesis
  - Run a short VN synthesis (5-10s audio target). Sample text:
      "Xin chào, đây là bài kiểm tra giọng đọc tiếng Việt."
  - Command pattern (exact entrypoint may differ per upstream — try in order):
      a) docker run --rm --platform linux/arm64 \
           -e TORCH_DEVICE=mps -v $PWD:/out \
           pnnbao/vieneu-tts:serve \
           --text "Xin chào, đây là bài kiểm tra giọng đọc tiếng Việt." \
           --out /out/sample1.wav
      b) If (a) errors on flags, inspect image: docker run --rm pnnbao/vieneu-tts:serve --help
         and adjust accordingly. Document the working invocation in the report.
  - Capture: peak memory (use Activity Monitor or `top -l 1 -pid <docker-pid>` separately),
    wall-clock latency, container exit code, output file size.
  - Verify the WAV file:
      file sample1.wav        # should say "RIFF (little-endian) data, WAVE audio"
      afinfo sample1.wav      # should show sample rate + duration > 0
  - If WAV is invalid: verdict=PARTIAL, jump to STEP 7
  - If WAV is valid: continue to STEP 5

STEP 5 — Stability check (10 sequential calls)
  - Loop 10 times with the same text. Capture:
      - exit code each iteration
      - wall-clock time
      - any stderr containing "mps", "alloc", "memory", "fault"
  - Log to ~/oga-vineu-spike/step5-stability.log
  - Pass criteria: 10/10 succeed, no MPS allocator errors, no audio corruption
    (spot-check sample1, sample5, sample10 with afinfo + audible playback if CEO
    wants to listen)
  - Determine verdict:
      10/10 clean → verdict=PASS
      8-9/10 → verdict=PARTIAL
      <8/10 → verdict=FAIL

STEP 6 — Compose final report
  Write ~/oga-vineu-spike/REPORT.md with this exact structure:

  # VieNeu MPS Spike Report — CEO M4 Pro 24G
  ## §1 Session metadata
  - Date / start time / end time / duration
  - Device: chip, memory, OS version
  - Operator: Kimi CLI <model+version>
  - CEO present: yes
  - HO-F6 reference: OGA/docs/08-collaborate/HANDOFF-F6-ACCEPTANCE-vineu-mps-ceo-m4pro-2026-05-12.md

  ## §2 Upstream MPS check
  - Image digest pulled (docker inspect pnnbao/vieneu-tts:serve | grep -i digest)
  - torch.backends.mps.is_available() = <True/False>
  - Outcome: STARTED / CUDA-ONLY / FAILED-TO-START
  - Raw log excerpt (last 20 lines of step3-upstream-gate.log)

  ## §3 Compatibility check (if §2 = STARTED)
  - Synthesis command used
  - WAV validity: sample rate, duration, file size
  - Peak unified memory (MB)
  - Wall-clock latency for 1 synthesis (s)

  ## §4 Stability check (if §3 = PASS)
  - 10-call results: N/10 pass, exit codes, any errors
  - Memory drift: peak at call 1 vs call 10
  - Audio corruption: yes/no, spot-check evidence

  ## §5 Residual diff (CEO device snapshot)
  - brew diff (post - pre): nothing expected
  - apps diff: Docker Desktop if newly installed, else nothing
  - process diff: should be clean post-cleanup
  - docker images remaining: list

  ## §6 Cleanup checklist confirmed
  - [ ] docker stop / rm vieneu-* containers
  - [ ] docker rmi pnnbao/vieneu-tts:serve (or keep if CEO requests)
  - [ ] rm -rf ~/oga-vineu-spike/ (or keep for report transfer, see §7 of this prompt)
  - [ ] Docker Desktop: kept / uninstalled (CEO decision)

  ## §7 Verdict
  PASS | FAIL | CUDA-ONLY | PARTIAL — pick exactly one
  Reasoning: <2-4 sentences>
  Implications for ADR-090 WS-C:
    - PASS → path C.1 (rework adapter for serve mode) is viable on Mac Mini
    - CUDA-ONLY → path C.3 (replace engine) is required for Mac Mini
    - PARTIAL → needs deeper investigation on actual Mac Mini 48G
    - FAIL → escalate to AI-Platform CTO for triage

STEP 7 — Cleanup (REQUIRED regardless of verdict)
  - Ask CEO: "About to clean up. Stop vieneu containers, remove image, remove
    spike directory. Docker Desktop will remain installed unless you say otherwise.
    Proceed? [yes/no]"
  - On yes:
      docker stop $(docker ps -aq -f name=vieneu) 2>/dev/null
      docker rm $(docker ps -aq -f name=vieneu) 2>/dev/null
      docker rmi pnnbao/vieneu-tts:serve 2>/dev/null
      # Snapshot post-state BEFORE deleting spike dir
      brew list > ~/oga-vineu-spike/post-brew.txt
      ls /Applications > ~/oga-vineu-spike/post-apps.txt
      ps -ax | grep -iE 'docker|tts|vieneu' > ~/oga-vineu-spike/post-proc.txt
      docker ps -a > ~/oga-vineu-spike/post-docker.txt
      diff pre-brew.txt post-brew.txt > brew-diff.txt
      diff pre-apps.txt post-apps.txt > apps-diff.txt
      # Append diffs into REPORT.md §5
  - On Docker Desktop disposition:
      Ask CEO: "Keep Docker Desktop installed, or uninstall now? [keep/uninstall]"
      If uninstall: open Finder → Applications → drag Docker to trash, empty trash.
                    Document in report §6.

STEP 8 — Hand-off to CEO for transfer
  - Print final REPORT.md path: ~/oga-vineu-spike/REPORT.md
  - Tell CEO three transfer options:
      a) `scp ~/oga-vineu-spike/REPORT.md user@oga-host:OGA/docs/05-test/`
         (CEO provides target host)
      b) Open the file, copy contents, paste into a new file in OGA repo via web
      c) git clone OGA, add REPORT.md to docs/05-test/spike-vineu-mps-ceo-m4pro-<today>.md,
         commit + push
  - Do NOT generate SSH keys or push to git from CEO's device unless CEO does
    it interactively with his own existing credentials.

STOP CONDITIONS (halt immediately if any of these trigger):
  - CEO says "stop" or "halt" at any point → write whatever report you have, run STEP 7
  - 4-hour time budget exceeded → write partial report, run STEP 7
  - Any command tries to write outside ~/oga-vineu-spike/ or Docker → halt + ask
  - You are tempted to "just try one workaround" after a CUDA-only error → STOP. CUDA-only is a valid result.
  - Unexpected sudo prompt appears → halt + ask CEO

NOW BEGIN AT STEP 0.
```

---

## 3. Operator notes (for whoever supervises Kimi)

| Item | Value |
|---|---|
| Expected runtime | 2-4 hours |
| Risk of CEO device damage | Low (no system mutations outside Docker + spike dir) |
| Internet calls | Docker registry only |
| Report destination | `OGA/docs/05-test/spike-vineu-mps-ceo-m4pro-<YYYY-MM-DD>.md` |
| Ping after report lands | AI-Platform @cto + OGA @cto |

If Kimi gets confused or off-script: tell it "go back to your STEP <N> in the prompt" — the protocol is the source of truth.

If Kimi cannot find the `pnnbao/vieneu-tts:serve` invocation arguments (the image may use different flag names than the prompt assumes), instruct it to:
1. `docker run --rm pnnbao/vieneu-tts:serve --help`
2. `docker inspect pnnbao/vieneu-tts:serve | grep -iE 'cmd|entrypoint'`
3. Document the actual invocation in the report and proceed.

---

## 4. CEO-side preparation checklist

Before launching Kimi, CEO should:

- [ ] Ensure 4 hours of uninterrupted time (calendar block)
- [ ] Close all sensitive apps (Mail, Messages, password manager)
- [ ] Decide in advance: willing to install Docker Desktop temporarily? (yes/no)
- [ ] Note current Docker Desktop status (already installed or not)
- [ ] Have a backup of any important work (precautionary — Kimi will not touch user files, but standard discipline)
- [ ] Charge the laptop or plug in (synthesis + 10-call stability runs heat MPS)

---

## 5. Post-spike action — report transfer to OGA

Once Kimi finishes and `REPORT.md` exists:

**Option A (CEO has SSH access to OGA host):**
```
scp ~/oga-vineu-spike/REPORT.md \
    user@<oga-host>:/home/nqh/shared/OGA/docs/05-test/spike-vineu-mps-ceo-m4pro-$(date +%Y-%m-%d).md
```

**Option B (CEO uses GitHub web UI):**
1. Open https://github.com/Minh-Tam-Solution/OGA
2. Navigate to `docs/05-test/` (create if missing)
3. New file → name `spike-vineu-mps-ceo-m4pro-2026-MM-DD.md`
4. Paste REPORT.md content → commit on main

**Option C (CEO uses git CLI on MacBook):**
```
cd /tmp && git clone git@github.com:Minh-Tam-Solution/OGA.git
cp ~/oga-vineu-spike/REPORT.md OGA/docs/05-test/spike-vineu-mps-ceo-m4pro-$(date +%Y-%m-%d).md
cd OGA && git add docs/05-test/ && git commit -m "docs(spike-f6): VieNeu MPS report from CEO M4 Pro 24G" && git push
```

After commit, CEO notifies:
- OGA `@cto` (DT Tai)
- AI-Platform `@cto`

---

## 6. Authority

This prompt was drafted by **OGA @cto** on 2026-05-12 per the F6 handoff acceptance. It is approved for one-time execution on CEO Tài Đăng's personal M4 Pro 24G within the 2026-05-15 → 2026-05-22 session window. The prompt expires when the report lands in OGA repo OR on 2026-05-22, whichever first.

For any deviation from the protocol (e.g. trying a different upstream image, attempting CPU fallback, extending the time budget), CEO must escalate to OGA @cto before authorizing Kimi to continue.

---

*OGA @cto | Kimi CLI handoff prompt for F6 VieNeu MPS spike | 2026-05-12*
