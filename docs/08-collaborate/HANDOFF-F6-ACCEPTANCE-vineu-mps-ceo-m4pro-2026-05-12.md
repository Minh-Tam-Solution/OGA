---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — OGA CTO acceptance of AI-Platform handoff HO-F6-VIENEU-MPS
Authority: "@cto (OGA)"
Stage: "08-collaborate"
related:
  - "docs/08-collaborate/HANDOFF-F6-VIENEU-MPS-TEST-ON-CEO-M4PRO-2026-05-12.md (AI-Platform request)"
  - "docs/08-collaborate/CTO-RESPONSE-adr-008-aiplatform-q-2026-05-12.md (Q4+Q5 — supersedes Q5 plan)"
  - "docs/02-design/01-ADRs/ADR-008-cto-cpo-decision-log.md (D2 VieNeu GPU-only)"
  - "AI-Platform docs/02-design/12-architecture-decisions/adr-090-ws-c-vineu-path-decision-template-2026-05-11.md"
status_response: "ACCEPTED with conditions — see §3"
deadline_met: "Yes (2026-05-12, before 2026-05-14 EOD target)"
---

# OGA → AI-Platform: F6 Handoff ACCEPTED

**From**: OGA @cto  
**To**: AI-Platform @cto + @architect  
**Date**: 2026-05-12  
**Re**: HO-F6-VIENEU-MPS — VieNeu MPS spike on CEO M4 Pro 24G

---

## 1. Acceptance summary

OGA **accepts** the F6 handoff to run the VieNeu Apple Silicon compatibility spike on CEO's personal MacBook M4 Pro 24G. All three caveats (C1 24G≠48G, C2 personal-device governance, C3 upstream MPS unknown) are acknowledged below as binding constraints on the spike.

This redirects what was AI-Platform's S124 spike (per my Q5 response on 2026-05-12) to an OGA-run spike on CEO hardware, accelerating the WS-C decision evidence by ~4-6 weeks.

**Net effect on prior commitments:**
- **Q4 (Mac Mini access by 2026-06-14)**: partial relief. Compatibility unblocked via CEO M4 Pro. **Production headroom still depends on Mac Mini delivery** — CEO escalation for early procurement remains live, but priority drops from P0 to P1 since compatibility no longer blocks WS-C decision.
- **Q5 (VieNeu MPS spike)**: scope shifts from AI-Platform S124 → OGA F6 session in 2026-05-15→05-22 window.

---

## 2. Caveats acknowledged (binding)

### C1 — 24G ≠ 48G test-scope split ✅

OGA spike report will tag each measurement against the matrix in §4 of the handoff:
- MPS compatibility → ✅ transfers to 48G
- VRAM headroom → ❌ does NOT transfer; flagged "needs re-test on Mac Mini before JUL-B"
- Latency/quality → ⚠️ informational only, not SLA

Verdict line in §7 of the report will use the exact codes the handoff requested: `PASS | FAIL | CUDA-ONLY | PARTIAL`.

### C2 — Personal device governance ✅

OGA commits to the following cleanup checklist, executed in CEO's presence at session close:

```
Pre-session snapshot (CEO laptop):
  [ ] `brew list > /tmp/brew-before.txt`
  [ ] `ls /Applications > /tmp/apps-before.txt`
  [ ] `ps -ax | grep -iE 'docker|tts|vieneu' > /tmp/proc-before.txt`
  [ ] `docker ps -a > /tmp/docker-before.txt`
  [ ] `du -sh ~/Library/Containers/com.docker.docker 2>/dev/null`

Session install (allowed):
  - Docker Desktop (if not present — CEO confirms before install)
  - `pnnbao/vieneu-tts:serve` container image (>5GB — auto-remove on close)
  - Temp working dir under `/tmp/oga-vineu-spike-2026MMDD/` (deleted at close)

Forbidden during session:
  [ ] No launchctl items / system extensions
  [ ] No keychain writes (no credentials, no API keys)
  [ ] No persistent Docker contexts named anything other than `default`
  [ ] No `~/.zshrc` / `~/.bash_profile` mutations
  [ ] No SSH key generation on CEO device

Session close cleanup:
  [ ] `docker stop $(docker ps -aq -f name=vieneu*)`
  [ ] `docker rm $(docker ps -aq -f name=vieneu*)`
  [ ] `docker rmi pnnbao/vieneu-tts:serve` (or confirm CEO wants to keep)
  [ ] `rm -rf /tmp/oga-vineu-spike-*`
  [ ] Snapshot diff: capture `brew list`, `docker ps -a`, `ls /Applications` again and diff vs `-before.txt`
  [ ] Append residual diff to §5 of spike report
  [ ] If Docker Desktop was newly installed → ask CEO: keep or uninstall?
```

This checklist is appended to the spike report §6 as evidence.

### C3 — Upstream MPS support unknown ✅

Spike report §2 (Upstream check) is the **first gate**. If `pnnbao/vieneu-tts:serve` cannot start with MPS-only torch backend (CUDA-only hard fail), OGA stops the spike there, captures the failure mode, and declares `RESULT=CUDA-ONLY`. This is treated as a **valid result** — it triggers WS-C path C.3 (replace engine) and gets the WS-C decision unblocked early.

OGA will not attempt CPU-fallback adapter work in this session — that's a separate spike if needed.

---

## 3. OGA-side conditions on acceptance

| # | Condition | Reason |
|---|---|---|
| OGA-1 | CEO must explicitly authorize the session window before scheduling (no opportunistic "while CEO is on call" runs). @cto-OGA to email CEO with proposed 3-4h window. | C2 governance — CEO's device, CEO controls access. |
| OGA-2 | Spike runner = @oga-devops (executes) + @cto-OGA (observes + signs report). If @oga-devops unavailable, @cto-OGA can run solo. No subcontracting. | Containment of CEO-device exposure to known operators. |
| OGA-3 | If CEO calendar does not yield a session by 2026-05-22, OGA notifies AI-Platform CTO with revised target date. Hard fallback = wait for Mac Mini July delivery. | Schedule risk transparency. |
| OGA-4 | OGA does NOT debug upstream `pnnbao/vieneu-tts` source in this session. If start fails, capture error → log → stop. Upstream debugging is a separate ticket if WS-C path C.1 (rework) is chosen later. | Time-box discipline; CEO device is not a dev environment. |
| OGA-5 | Spike report verdict is informational for AI-Platform's WS-C decision. OGA does NOT vote on C.1 vs C.3 — that's AI-Platform PJM (R) + AI-Platform CTO (A) decision per the ADR-090 template. | Role boundary respect. |

---

## 4. Schedule commitment

| Milestone | OGA-committed date | Owner |
|---|---|---|
| F6 acceptance filed (this doc) | 2026-05-12 | @cto-OGA ✅ done |
| CEO calendar request sent | 2026-05-13 (Mon next biz day) | @cto-OGA |
| Session scheduled with CEO | by 2026-05-22 | @cto-OGA |
| Spike session executed | 2026-05-15 → 2026-05-22 (CEO-driven) | @oga-devops + @cto-OGA |
| Spike report committed to `OGA/docs/05-test/spike-vineu-mps-ceo-m4pro-2026-MM-DD.md` | within 48h of session | @oga-devops |
| Notification to AI-Platform @cto | same day as report commit | @cto-OGA |
| Combined readout (AI-Platform CUDA + OGA MPS) | 2026-05-29 | AI-Platform PJM (R), @cto-OGA contributes |

If session slips past 2026-05-22 due to CEO calendar, OGA notifies same day with revised date.

---

## 5. Out of scope (matches §8 of handoff)

OGA confirms the spike will NOT:
- Install VieNeu permanently on CEO device (per C2 cleanup)
- Constitute Mac Mini production qualification (separate spike post-July delivery)
- Commit OGA or AI-Platform to path C.1 (rework) — C.3 (replace) remains open
- Unblock ADR-008 live `POST /gpu/admission-request` (that's S14-A 2026-05-20 work, separate track)
- Block S123 WS-A/B/D/E kickoff at AI-Platform

---

## 6. Cross-reference updates required

OGA will update:
- `docs/08-collaborate/CTO-RESPONSE-adr-008-aiplatform-q-2026-05-12.md` Q5: add note "spike redirected to OGA-run F6 session per HO-F6 acceptance"
- `.sdlc-config.json`: add F6 spike to Sprint 13 deliverable list with status=accepted, target_session=2026-05-15-to-2026-05-22
- After session: `docs/04-build/sprints/sprint-13/` spike report path

AI-Platform expected updates (informational):
- AI-Platform impact tracker row 6: F6 entry post-acceptance
- AI-Platform ADR-090 WS-C template: spike result slot reserved for 2026-05-29 readout

---

## 7. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| CEO calendar slips past 2026-05-22 | Med | Low | Notify same-day; fallback Mac Mini July |
| Docker Desktop install rejected by CEO | Low | Med | Abort spike; reschedule with prep ask |
| Residual install on CEO device after cleanup | Low | High (governance) | Snapshot-diff in §5 of report; CEO verifies before sign-off |
| MPS upstream hard-fail (CUDA-only) | Med | Low (still valid result) | Stop at §2 gate; report `CUDA-ONLY`; trigger C.3 |
| 24G memory ceiling masks 48G headroom result | High | Low (already C1) | Flag in every memory-related measurement |

---

## 8. CTO sign

OGA F6 handoff: **ACCEPTED with conditions OGA-1 through OGA-5**.

CEO scheduling request fires Mon 2026-05-13. Session window 2026-05-15 → 2026-05-22. Spike report + AI-Platform notification within 48h of session close.

---

*OGA @cto — handoff F6 acceptance — 2026-05-12 — within 2026-05-14 EOD deadline*
