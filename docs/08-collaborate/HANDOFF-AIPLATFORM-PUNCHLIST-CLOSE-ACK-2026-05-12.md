---
handoff_id: HO-PUNCHLIST-ACK
date: 2026-05-12
from: "AI-Platform @cto"
to: "OGA @cto / OGA team"
scope: "AI-Platform acknowledgement of OGA CTO-CONSOLIDATED-RESPONSE — closes punch list cycle, commits to ADR-091 deliverable"
related:
  - "OGA `docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md`"
  - "OGA `docs/08-collaborate/CTO-CONSOLIDATED-RESPONSE-aiplatform-punchlist-2026-05-12.md`"
  - "AI-Platform `docs/08-collaborate/03-sprint-management/oga-adr-008-impact-tracker-2026-05-11.md` (Update 2026-05-12 #2)"
  - "AI-Platform `docs/02-design/12-architecture-decisions/adr-091-mac-mini-content-tier-governance-2026-05-12.md` (DRAFT skeleton)"
status: "PUNCH LIST CLOSED — 11 items tracked, next CTO touchpoint 2026-05-19"
---

# AI-Platform → OGA: Punch List Close Acknowledgement

**From**: AI-Platform @cto  
**To**: OGA @cto + OGA team  
**Date**: 2026-05-12  
**Re**: Acknowledgement of CTO-CONSOLIDATED-RESPONSE + CTO-RATIFY-aiplatform-f6-response

---

## TL;DR

**Punch list closed.** All blocking items answered with binding decisions on
both sides. AI-Platform commits to 2 new deliverables (ADR-091 draft +
mirror of OGA spike SOP). 11 open items tracked, next CTO touchpoint
**2026-05-19** (JWT spec from OGA + ADR-091 draft from AI-Platform).

---

## 1. F1-F5 — all consumed into AI-Platform artifacts

| F# | OGA decision | AI-Platform artifact updated |
|---|---|---|
| F1 | `127.0.0.1:8120` loopback hardening | Tracked for @devops at S123 Day-0 (docker-compose port mapping change `"8120:8120"` → `"127.0.0.1:8120:8120"`) |
| F2 | OMIT Phase 1, ARBITER-MINT Phase 2 (client-gen REJECTED) | Scaffold spec §5 rewritten with `LeaseManager` class for Phase 2; Phase 1 uses `exclude_none=True` to drop the field from wire |
| F3 | Asia/Ho_Chi_Minh timezone | consumers.yaml updated: `"08:00-18:00 Asia/Ho_Chi_Minh,Mon-Fri"` |
| F4 | SIGTERM + 30s grace + SIGKILL | consumers.yaml voice-service entry gained `eviction_grace_sec: 30` reference; **R1 risk DOWNGRADED HIGH→LOW** (MeloTTS typical <30s completes within grace; long-form >30s residual risk accepted for S123/S124) |
| F5 | HS256 Phase 2 / RS256 Phase 3; spec by 2026-05-19 | Scaffold spec §2 config bifurcated by phase: `OGA_AUTH_PHASE`, `OGA_JWT_HS256_SECRET`, `OGA_JWT_PUBLIC_KEY_PATH`. Implementation waits on OGA JWT spec 2026-05-19. |

Scaffold + consumers.yaml are now **F1-F5 RESOLVED and ready** for code
implementation at S123 Day-0 (Phase 1 only; Phase 2 awaits JWT spec).

---

## 2. F6 ratification — fully accepted

| Item | OGA decision | AI-Platform status |
|---|---|---|
| Q1 reclassification FAIL ≡ CUDA-ONLY | ACK | Consumed |
| Q2 gate 2026-06-01 | **ACK 2026-06-01** | Locked |
| Q3 sub-decision | **CONFIRM (a) B.1 + B.3 combo** | Path B prep complete; soft-delete migration ready for S123 Day-0 |
| D2 footnote | **RATIFIED** | OGA-side action; AI-Platform tracker references |
| Q4 owner | ACK | AI-Platform CTO posts both upstream issues 2026-05-13 morning |

WS-C gate **2026-06-01** is now firm on both sides.

---

## 3. New AI-Platform commitments accepted

### ADR-091 Mac Mini Content-Tier Governance (Option B confirmed)

**AI-Platform owns Mac Mini arbiter; OGA owns S1 arbiter.**

- **DRAFT skeleton landed** in this commit:
  `AI-Platform/docs/02-design/12-architecture-decisions/adr-091-mac-mini-content-tier-governance-2026-05-12.md`
- Full content draft target **2026-05-19** (next CTO touchpoint)
- OGA co-sign target **2026-05-23**

Skeleton covers:
- Decision + rationale (Option B per OGA rationale: role boundary +
  CEO directive + avoids OGA over-reach)
- Consequences split (AI-Platform Mac Mini ownership vs OGA S1
  ownership vs joint coordination)
- Implications for OGA ADR-008 scope post-JUL-B
- Risks + mitigations
- 4 detailed-design subsections with [ ] placeholders to fill before 2026-05-19

Architectural direction (preliminary, to be ratified at 2026-05-19):
**per-service VRAM budgets on Mac Mini**, same `gpu_budget.py` pattern as
S1 WS-A. No new arbiter service. Voice + future image + future video each
declare VRAM ceiling; AI-Platform monitors aggregate.

### F6 ROI SOP mirror

OGA commits to pre-procurement spike template v1 at OGA Sprint 14 kickoff
**2026-05-20**, at OGA `docs/02-design/spike-templates/`.

**AI-Platform mirror**: at S124 sprint planning, we'll add the template
reference to sprint planning checklist + adopt the pattern for future
cross-platform pre-procurement validations. Not a code deliverable.

---

## 4. Sprint calendar — 6 sync points mapped, no misalignment

| Date | Event |
|---|---|
| 2026-05-19 (Mon) | **CTO async sync** — OGA delivers JWT spec; AI-Platform delivers ADR-091 full draft |
| 2026-05-22 (Thu) | **S14-B go/no-go** — OGA arbiter delegate mode start; AI-Platform Phase 2 activation gate |
| 2026-06-01 (Mon) | **WS-C gate** — AI-Platform VieNeu removal + ADR-090 §D6 amendment landed |
| 2026-06-15 (Mon) | **arm64 outcome readout** — combined readout on pnnbao upstream + rhasspy license inquiries |
| 2026-06-28 (Sun) | **JUL-A baseline** — OGA Mac Mini baseline benchmarks |
| 2026-07-02 (Thu) | **JUL-B cutover** — production traffic switches to Mac Mini |

---

## 5. Upstream issues posting 2026-05-13 confirmed

AI-Platform CTO posts both issues tomorrow morning:
- `pnnbao97/VieNeu-TTS` — arm64 build request (Q4)
- `rhasspy/piper-voices` — 25hours_single license inquiry (B.1)

Both async, 14-day hard close 2026-05-26 (S123 kickoff). No OGA co-sign
needed. OGA acknowledgement noted.

---

## 6. Internal hygiene note (informational only)

OGA flagged self-authored Kimi commit (`df77098`) — content fine but
lacked preceding CTO directive on disk. This is **OGA-internal SDLC
discipline**, not a cross-team concern. AI-Platform records the flag for
future shared-team learning; no action on AI-Platform side.

---

## 7. Next CTO touchpoint

**Mon 2026-05-19 (async)**

Joint deliverables:
- OGA delivers: full JWT spec (HS256 Phase 2 details + RS256 Phase 3 transition plan + key distribution + rotation)
- AI-Platform delivers: ADR-091 full draft (skeleton landed today; detailed-design sections filled in over the week)

Both teams review before 2026-05-22 S14-B go/no-go gate.

---

## 8. ROI restatement — for CEO + CPO visibility

The F6 spike pattern + this consolidated punch list cycle saved an
estimated **6-7 weeks of engineering waste** by surfacing the upstream
VieNeu arm64 blocker in 10 minutes of CEO time instead of post-Mac-Mini-
delivery discovery. The OGA spike template SOP (commitment for 2026-05-20)
codifies this pattern for reuse across future cross-platform
pre-procurement validations.

Both teams thank CEO for providing the M4 Pro 24G test target that
unblocked this entire decision tree.

---

*AI-Platform @cto — 2026-05-12*  
*Filed in OGA repo for cross-team coordination + audit trail. Mirror artifacts in AI-Platform tracker + scaffold + consumers.yaml + new ADR-091 skeleton.*
