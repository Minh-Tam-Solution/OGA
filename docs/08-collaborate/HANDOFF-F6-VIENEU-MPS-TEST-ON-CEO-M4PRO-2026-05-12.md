---
handoff_id: HO-F6-VIENEU-MPS
date: 2026-05-12
from: "AI-Platform @cto + @architect"
to: "OGA team (@cto / @devops / spike-runner)"
scope: "VieNeu Apple Silicon (MPS) compatibility spike on CEO M4 Pro 24G — unblocks WS-C path decision without waiting for July Mac Mini delivery"
related:
  - "OGA `docs/02-design/01-ADRs/ADR-008-cto-cpo-decision-log.md` (D2 VieNeu GPU-only)"
  - "OGA `docs/08-collaborate/oga-adr-008-answers-to-ai-platform-2026-05-12.md` (Q4 + Q5)"
  - "AI-Platform `docs/08-collaborate/03-sprint-management/oga-adr-008-followup-questions-2026-05-12.md` (F1-F5)"
  - "AI-Platform `docs/02-design/12-architecture-decisions/adr-090-ws-c-vineu-path-decision-template-*` (WS-C decision gate 2026-06-15)"
status: "OPEN — awaiting OGA acceptance + schedule confirmation"
---

# Handoff F6 — VieNeu MPS Spike on CEO M4 Pro 24G

## 1. TL;DR

CEO has confirmed his personal **MacBook M4 Pro 24G** is available as the
MPS test target for VieNeu. This **unblocks the OGA-side spike without
waiting for the production Mac Mini M4 Pro 48G** delivery (early July).

AI-Platform requests OGA to:
1. Accept the spike scope (compatibility test, NOT production headroom test)
2. Schedule a session with CEO calendar (a few hours, not permanent access)
3. Run the spike with the **3 caveats in §4** acknowledged
4. Return a structured report per **§5 acceptance**

AI-Platform will run the **functional adapter + Hùng A/B quality spike**
on CUDA in parallel during S123 Days 5-9. Results combine at the WS-C
path decision gate **2026-06-15**.

---

## 2. Context

Per OGA's answer doc 2026-05-12:
- Q4: Mac Mini delivery early July, cannot confirm 2026-06-14 SSH access
- Q5: VieNeu MPS status — **not tested**; AI-Platform S124 spike confirmed non-duplicative

WS-C path decision depends on knowing whether VieNeu runs on Apple
Silicon at all. If not, fallback to path C.3 (replace engine) needs to
be decided **before** the JUL-B 2026-07-03 production cutover, not
after.

CEO providing his personal laptop short-cuts this dependency by ~4-6
weeks.

---

## 3. Test target

| Property | Value |
|---|---|
| Device | CEO personal MacBook M4 Pro 24G |
| Chip | Apple M4 Pro (same family as production Mac Mini M4 Pro 48G) |
| Unified memory | 24 GB (production target = 48 GB — see §4 C1) |
| OS | Latest macOS (CEO to confirm at scheduling) |
| Access | Hands-on session with CEO present OR short-window SSH if CEO authorises — OGA to negotiate |
| Software state | Personal device — see §4 C2 |

---

## 4. Three caveats AI-Platform requires OGA to acknowledge

### C1 — 24G ≠ 48G: test scope must split

Test outcomes on 24G unified memory transfer differently:

| Outcome category | Transfers from 24G to 48G? | Use |
|---|---|---|
| VieNeu **MPS compatibility** ("does it run on Apple Silicon at all?") | ✅ Yes — same chip family, same MPS backend | Decide path C.1 (rework) vs C.3 (replace) |
| **VRAM headroom** ("does it fit budget with content co-resident?") | ❌ No — 24G has different ceilings than 48G | Production fitness — re-test on actual Mac Mini before JUL-B |
| **Latency / quality** on Apple Silicon | ⚠️ Partial — quality transfers, latency may scale with chip differences | Indicator for path decision, not SLA commitment |

Test report must label each measurement against this matrix.

### C2 — CEO personal hardware, not production

This is CEO's personal device. Test session must:
- Be scheduled inside an explicit time window (e.g. 2-4 hours)
- Not install persistent daemons / launchctl items / system extensions
- Not write production credentials to keychain
- Snapshot before-state (running processes, installed brews/apps) and
  diff after for residual cleanup
- Be cleaned up at session close (containers stopped, models removed if
  >5 GB, Docker contexts removed)

AI-Platform CPO has flagged this as a governance touch — OGA should
acknowledge the cleanup checklist before scheduling.

### C3 — VieNeu serve mode upstream MPS status unknown

`pnnbao/vieneu-tts:serve` upstream may not support MPS at all. The
spike's **first checkpoint is upstream behaviour**, not adapter
integration:

1. Pull image / clone repo
2. Try to start `vineu-tts:serve` with MPS-only torch backend
3. Capture: starts cleanly? falls back to CPU? raises CUDA-only error?

If the answer is "CUDA-only, hard fail" → this is **also a valid
result** that triggers WS-C fallback (path C.3 — replace engine).
Surfacing this 4-6 weeks early is a net win.

---

## 5. Acceptance criteria (what AI-Platform needs back)

Single short report at `OGA/docs/05-test/spike-vineu-mps-ceo-m4pro-2026-MM-DD.md`
with these sections:

```
1. Session metadata: date, duration, attendees, device fingerprint
2. Upstream check: did pnnbao/vieneu-tts:serve start with MPS?
   - If YES → continue
   - If NO → capture error, stop, declare RESULT=CUDA-ONLY
3. Compatibility check (only if §2 = YES):
   - Single short Vietnamese synthesis (5-10s audio)
   - Verify output audio file is valid (sample rate, duration, audible)
   - Capture peak unified memory during synthesis
   - Capture wall-clock latency
4. Stability check (only if §3 = PASS):
   - 10 sequential synthesis calls
   - Check for: MPS allocator errors, audio corruption, memory leaks
5. Residual diff: before/after snapshot of CEO device
6. Cleanup checklist confirmed
7. Verdict: PASS / FAIL / CUDA-ONLY / PARTIAL with reasoning
```

Return path: commit report to OGA repo, ping `@cto AI-Platform` in
handoff response doc.

---

## 6. What AI-Platform is doing in parallel (so no duplicate work)

S123 Days 5-9 (2026-06-02 to 2026-06-06) runway:

| AI-Platform task | Owner | Output |
|---|---|---|
| Hùng A/B Vietnamese quality eval: VieNeu vs Piper vs MeloTTS (CUDA host) | @pm + Hùng | Quality score table → informs C.1 (rework) vs C.3 (replace) cost-benefit |
| `vineu_adapter.py` rework draft against `pnnbao/vieneu-tts:serve` SDK shape | @architect + @coder | Adapter PR (DRAFT, behind feature flag) ready for C.1 path if MPS spike PASSES |

OGA spike is **not on the critical path** for AI-Platform's S123 close
(WS-C remains formally deferred to S124 per CPO hold). But OGA spike
result accelerates the S124 decision.

---

## 7. Schedule request

| Item | Target |
|---|---|
| OGA accepts handoff | 2026-05-14 EOD (same as F1-F5 schema reply deadline) |
| OGA + CEO schedule spike session | 2026-05-15 → 2026-05-22 window |
| OGA spike report committed | Within 48h of session |
| Combined readout (AI-Platform + OGA) | 2026-05-29 readout, feeding WS-C decision gate 2026-06-15 |

If CEO calendar pushes session past 2026-05-22, that's fine — surface
the new date and AI-Platform will adjust readout timing accordingly.

---

## 8. What this handoff is NOT

- ❌ Not a request to install VieNeu permanently on CEO device
- ❌ Not a Mac Mini production qualification (separate spike post-delivery)
- ❌ Not a commit to path C.1 (rework) — could still pivot to C.3 (replace)
- ❌ Not unblocking OGA ADR-008 live POST or any cross-platform GPU governance
- ❌ Not a precondition for S123 WS-A/B/D/E kickoff (those proceed independently)

---

## 9. Cross-references

- AI-Platform impact tracker row 6 (new): `docs/08-collaborate/03-sprint-management/oga-adr-008-impact-tracker-2026-05-11.md` § "Update 2026-05-12" will gain F6 entry post-handoff acceptance
- OGA ADR-008 D2: VieNeu GPU-only stance owned by AI-Platform PJM — this spike is the evidence-gathering arm
- WS-C decision template: `adr-090-ws-c-vineu-path-decision-template-2026-05-11.md` will absorb spike verdict at decision gate

---

*AI-Platform @cto + @architect, 2026-05-12 — handoff filed in OGA repo for CEO M4 Pro 24G spike. Awaiting OGA acceptance + scheduling.*
