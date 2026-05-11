---
sprint: 13
status: PLANNED
start_date: 2026-05-13
planned_duration: 1 week
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto", "@cpo"]
  cpo_cosign: "2026-05-10"
  cto_cosign: "2026-05-10"
  trigger: "Sprint 12 closed — G2 Audio Production PASS (ADR-007 v4 Accepted); Piper + MeloTTS validated; voice integration ready for production"
branch: "sprint-13/stabilization-governance"
baseline_commit: "HEAD"
rollback: "git checkout main"
---

# Sprint 13 — Stabilization, Governance & Next-Engine Evaluation

**Sprint**: 13 | **Phase**: Phase B (Production Hardening + Governance)
**Previous**: Sprint 12 (Audio Production Spike E v2 — COMPLETE, G2-audio PASSED)
**Branch**: `sprint-13/stabilization-governance` (off `main@HEAD`)

---

## Sprint Goal

1. **Harden** the audio production pipeline (Track B consumer wrapper integration, brand-text guidelines)
2. **Govern** cross-platform GPU resource contention (ADR-008 proposal)
3. **Evaluate** next-engine candidates (VieNeu solo eval, OmniVoice license unblock)
4. **Track** AI-Platform S118 deliverables (MeloTTS image persistence, OOM stability)

**CPO Guardrail:** If VieNeu GPU is not freed by Sprint 13 start (2026-05-13), scope locks to **2-engine MVP** (Piper + MeloTTS). No sprint delay for external blockers.

No new engine integrations until S118 closes and ADR-008 is accepted.

---

## Context

### Sprint 12 Learning

Audio production architecture validated at G2:
- **Piper VAIS1000** → production primary (low latency, 22050Hz, acceptable quality)
- **MeloTTS Vietnamese** → fallback (higher latency, 44100Hz, natural quality)
- **ADR-007 v4** → Accepted (CTO + CPO co-signed)
- **Track B consumer wrapper** → Landed (`src/lib/aiPlatformVoiceClient.js` + `app/api/voice/tts/route.js`)

Remaining gaps:
- VieNeu deferred (GPU OOM + adapter broken at v0.1.0)
- MeloTTS container changes non-persistent (image rebuild required)
- OOM kill recurrence (2× in 45 min)
- Brand initials ("NQH") pronunciation weak on both engines
- Cross-platform GPU governance unmanaged (ollama + video + voice contention)

---

## Backlog (Priority Order)

| Task | Description | Priority | Points | Owner | Condition |
|------|-------------|----------|--------|-------|-----------|
| 13.0a | **ADR-008 draft** — Cross-platform GPU resource arbiter policy + interface contract (extends RULE-VRAM-001 to all NQH GPU consumers: OGA video, AI-Platform voice, ollama, future training) | P0 | 3 | @architect + @cto | Must complete before any new GPU-heavy engine integration |
| | **Scope boundary (CTO-locked):** IN = policy + interface contract + consumer registry + escalation path + RULE-VRAM-001 deprecation. OUT = implementation, deployment, monitoring, retry strategies → ADR-009 in S14. | | | | |
| 13.0b | **Spike E v3 — VieNeu solo eval** — Run upstream `pnnbao/vieneu-tts:serve` Docker on freed GPU; 5-sample smoke + pronunciation check | P0 | 5 | @coder | Blocked until ollama owner coordinates unload window OR S118 adapter fix lands |
| | **Drop-day (CTO-locked):** If still blocked at S13 Day 3 (Wed 2026-05-15) → drop from S13, re-plan in S14. Do not burn bandwidth on indefinite wait. | | | | |
| 13.1 | **Brand-text guideline** — Document script-writing rules for TTS input (initials → spelled out, domain terms → verified phoneme) | P1 | 2 | @pm + @marketing | Parallel; feeds production content workflow |
| 13.2 | **Track B integration** — Wire `aiPlatformVoiceClient` into Voice Studio UI; env var setup; error handling for 503/404 | P1 | 3 | @coder | **✅ COMPLETE — live smoke PASSED 2026-05-10** |
| | **Done criteria:** (a) UI button triggers synthesis, (b) audio player renders returned URL, (c) Cypress test covers 200 + 503 paths | | | | |
| ~~13.3~~ | ~~**OmniVoice license unblock**~~ | ~~P1~~ | ~~2~~ | ~~@coder~~ | ~~**REMOVED at kickoff** — CTO hard expiry triggered. URL/LICENSE not received. Moved to S14 candidate.~~ |
| ~~13.4~~ | ~~**S118 tracking**~~ — ~~Monitor AI-Platform PJM ticket execution; verify MeloTTS image rebuild + auto-restart policy~~ | ~~P1~~ | ~~1~~ | ~~@pm~~ | **✅ CLOSED 2026-05-10** — All 4 criteria PASS. See [`s118-tracking-log.md`](sprint-13/s118-tracking-log.md) + [`pm-advisory-s118-rebuild.md`](sprint-13/pm-advisory-s118-rebuild.md) |
| | ~~**Cadence (CTO-locked):** PM sends advisory ping to @ai-platform-pjm every Monday + Thursday. Capture status in `sprint-13/s118-tracking-log.md`. Escalate to @human if ticket has zero progress 2 weeks running.~~ | | | | |
| | **Artifacts:** [`s118-tracking-log.md`](sprint-13/s118-tracking-log.md) · [`pm-advisory-s118-rebuild.md`](sprint-13/pm-advisory-s118-rebuild.md) | | | | |
| 13.5 | **ADR-007 v4 operational runbook** — Document failover behavior, retry policy, MinIO presigned URL fetch pattern (container-level) | P2 | 1 | @architect | Post-13.2 |

**Total**: 17 points. P0 (13.0a + 13.0b) = 8 points; 13.0b blocked on external coordination.

---

## Task Dependencies

```
13.0a (ADR-008 draft)
   │
   ▼
13.2 (Track B integration) ──► 13.5 (Runbook)
   │
   ├── needs: S118 image rebuild (external)
   └── needs: brand-text guideline (13.1)

13.0b (VieNeu solo eval)
   │
   ├── blocked: ollama GPU unload window
   └── blocked: AI-Platform S118 adapter fix

13.3 (OmniVoice)
   └── blocked: user-provided repo URL + LICENSE
```

---

## Preconditions

| Precondition | Status | Gate |
|-------------|--------|------|
| G2-audio PASSED | ✅ | CTO + CPO co-signed |
| ADR-007 v4 Accepted | ✅ | `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` |
| AI-Platform S118/S123 closed | ✅ | All 4 criteria PASS; origin/main @ `18f43ea84` |
| Track B wrapper landed | ✅ | `src/lib/aiPlatformVoiceClient.js` + `app/api/voice/tts/route.js` |
| VieNeu GPU availability | ⏳ | S1 GPU still blocked; F6 MPS spike on CEO M4 Pro accepted as parallel path |
| OmniVoice repo URL | ⏳ | User input pending |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ~~S118 slips past Sprint 13~~ | ~~Track B integration delayed~~ | ✅ **RESOLVED** — S118 closed early 2026-05-10; Track B unblocked |
| ollama owner unresponsive | VieNeu S1 eval blocked indefinitely | F6 MPS spike on CEO M4 Pro provides parallel path; accept 2-engine config if both blocked |
| OmniVoice license unresolved | Spike F blocked | Accept Piper+MeloTTS as production pair; OmniVoice = future |
| ADR-008 scope creep | Governance doc becomes architecture rewrite | Time-box 3 points; defer deep arbiter implementation to S14 |

---

## Definition of Done

- [x] ADR-008 v1.1 APPROVED — CTO+CPO countersigned 2026-05-11; D1-D6 + Q1-Q5 locked
- [ ] VieNeu eval: S1 GPU still blocked (deferral trail) OR F6 MPS spike report committed
- [ ] Brand-text guideline published in `docs/08-collaborate/content-guidelines/`
- [ ] Track B integration merged to `main` (or branch-ready for S14)
- [x] S118 weekly check-in logged with AI-Platform PJM — **CLOSED early 2026-05-10**
- [ ] OmniVoice spike unblocked OR formally deferred to backlog

---

## References

- ADR-007 v4 (Accepted): `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md`
- Spike E v2 results: `docs/04-build/sprints/sprint-12/spike-e-results.md`
- PJM S118 ticket: `AI-Platform/audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md`
- Track B wrapper: `src/lib/aiPlatformVoiceClient.js`
- Track B proxy route: `app/api/voice/tts/route.js`

---

---

## Sprint 13 Status Roll-Up (CTO 2026-05-10)

| Task | Status | Note |
|------|--------|------|
| 13.0a ADR-008 | ✅ **APPROVED — CTO+CPO countersigned 2026-05-11** | v1.1 D1-D6 + Q1-Q5 locked; S1=dev/test Ollama-first, Mac Mini production July |
| 13.0b VieNeu eval | ⏳ Redirected to F6 | S1 GPU still blocked; F6 MPS spike on CEO M4 Pro 2026-05-15→22 accepted |
| F6 VieNeu MPS spike | ✅ **ACCEPTED** | HO-F6 handoff; CEO session window 2026-05-15→22; report +48h |
| 13.1 Brand-text guideline | 📋 Sprint 13 work | CPO+marketing |
| 13.2 Track B UI wire | ✅ **COMPLETE — CPO FINAL COUNTERSIGN** | Live smoke + 14/14 tests + 3 CPO fixes |
| 13.3 OmniVoice license | ❌ Removed | Hard expiry at S13 kickoff |
| 13.4 S118 tracking | ✅ **CLOSED early** | Artifacts in `sprint-13/` |
| 13.5 ADR-007 runbook | ✅ **COMPLETE** | Runbook drafted: ops checklist + failover + rollback + on-call + alerting |

### Outstanding (Compact View)

| Item | Owner | Urgency |
|------|-------|---------|
| ~~CPO countersign Sprint 13 plan~~ | ~~@cpo~~ | **✅ DONE 2026-05-11** |
| F6 spike session scheduling | @cto-OGA | **P0** — CEO calendar request fires 2026-05-13 |
| ~~ADR-007 runbook~~ | ~~@architect~~ | **✅ COMPLETE** — `docs/04-build/sprints/sprint-13/ADR-007-runbook.md` |
| Update `.sdlc-config.json` (G2-audio passed, sprint_12.audio = closed) | @oga-pjm | Hours |
| API key management (security-sensitive) | @oga-devops | **DEFERRED** — No 1Password vault yet; API key stays in `.env.local` (git-ignored). Revisit when vault provisioned. |
| ~~Execute Track B (13.2)~~ | ~~@coder~~ | **✅ COMPLETE** — Live smoke + CPO fixes passed |
| S13 kickoff Mon 2026-05-13 — ADR-008 + 13.1 | @coder/@architect | Scheduled |

---

*Sprint 13 — Stabilization & Governance | Proposed by @pm | CTO+CPO countersigned 2026-05-10 | CPO sprint plan final countersign 2026-05-10 | CTO progress ack 2026-05-10 | ADR-008 v1.1 CTO+CPO countersigned 2026-05-11 | Q1-Q5 answers locked 2026-05-12*
