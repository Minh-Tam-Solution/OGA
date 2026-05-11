# ADR-008 CTO + CPO Decision Log (1-Page)

## Session metadata

- Session date: 2026-05-13
- Artifact reviewed: `docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md`
- Chair: CTO
- Business approver: CPO
- Scope: Sprint 14 to Sprint 15 governance rollout on S1 with Ollama-first priority for shared LLM services (AI-Platform, Bflow, NQH-Bot, NQH-POS), plus July production migration readiness to Mac Mini M4 Pro 48G
- Decision mode: One final decision per open question (no unresolved "TBD")

## Final decisions (must be fully filled in session)

| ID | Decision topic | Final decision | Why this option won | Owner | Effective from | Review date |
|---|---|---|---|---|---|---|
| D1 | Ollama ownership | Set `ollama-inference` as S1 priority consumer for Sprint 14-15 because it serves shared LLM workloads for AI-Platform, Bflow, NQH-Bot, and NQH-POS. Enforce `idle_unload=600s`, lease renewal, and blackout windows; non-LLM content workloads are preemptible on S1. | Aligns CEO directive and protects cross-platform business services while S1 remains the integration/test hub. | IT/Admin (R), CTO (A) | S14-A (2026-05-20) | Post-cutover review (2026-07-10) |
| D2 | VieNeu CPU mode stance | Official stance: VieNeu is GPU-only for production path on Mac Mini target in July; CPU mode remains unsupported until upstream lmdeploy fix is validated. Keep feature flag for future CPU re-entry. | Avoids repeated failed effort on known-broken upstream path and keeps migration plan focused on reliable GPU deployment. | AI-Platform PJM (R), CTO (A) | Immediate (2026-05-13) | First week after cutover (2026-07-10) |
| D3 | Arbiter deployment model (`systemd` vs `docker ai-net`) | Deploy arbiter as host-native `systemd` service on S1 (`:8200`), not Docker. | Removes circular dependency risk (Docker restart taking down arbiter), improves boot ordering and recovery behavior. | OGA DevOps (R), Architect (A) | S14-A (2026-05-20) | S14-B go/no-go (2026-05-22) |
| D4 | Heartbeat standard (`HTTP` vs `PID`) | Hybrid standard: PID watch baseline for all consumers; mandatory HTTP heartbeat for priority LLM consumers and other high-stakes GPU consumers. | Balances implementation speed and reliability; catches process death and hung-but-alive cases. | Architect (R), CTO (A) | S14-A (2026-05-20) | End of S14 (2026-05-26) |
| D5 | Queue semantics (`FIFO` vs `weighted fair`) | Weighted fair queuing across priority classes; FIFO within the same class. Ollama-backed LLM platform services > content test workloads > training > batch. | Prevents starvation under mixed workloads while keeping behavior predictable for equal-priority jobs. | Architect (R), CTO (A) | S14-B (2026-05-22) | Early S15 (2026-05-28) |

## RACI and incident SLA (L2/L3/L4)

| Level | Trigger condition | Responsible | Accountable | Consulted | Informed | Acknowledge SLA | Mitigate SLA | Escalation target |
|---|---|---|---|---|---|---|---|---|
| L2 Degraded | 3+ admission rejections in 5 min OR queue p95 > 15s for 10 min | @oga-devops on-call | @architect | AI-Platform PJM, @coder | @pm, @cpo | <= 10 min | <= 60 min | L3 |
| L3 Critical | GPU > 95% for > 2 min OR queue p95 > 30s for 10 min OR LLM gateway 5xx > 3% for 15 min | @oga-devops on-call | @architect | @cto, AI-Platform PJM | @pm, @cpo, @marketing | <= 5 min | <= 30 min | L4 |
| L4 Emergency | Priority LLM consumer starved > 30s OR forced eviction fails OR repeated L3 twice in 30 min | @architect on-call | CTO | IT/Admin (Ollama owner), AI-Platform PJM | @pm, @cpo, @marketing, @oga-devops | <= 2 min | immediate | Force-evict / safe mode |

## Quantitative rollback triggers

Use this block to define hard thresholds for fallback from delegate mode to advisory mode.

| Metric | Warning threshold | Critical threshold | Rollback trigger | Lookback window | Source of truth |
|---|---|---|---|---|---|
| GPU admission failure rate | > 5% | > 10% | Revert delegate -> advisory if > 10% for 2 consecutive 15-min windows | 15 min sliding | Arbiter logs + Prometheus counter |
| p95 queue wait time | > 15s | > 30s | Revert delegate -> advisory if > 30s for 10 min | 10 min rolling | Arbiter metrics (`queue_wait_ms`) |
| Forced eviction count | >= 2 / hour | >= 5 / hour | Revert delegate -> advisory if >= 5 in any hour or any L4 event in 24h | 1 hour + 24h | Arbiter eviction audit log |
| LLM gateway 5xx rate (Ollama-backed services) | > 1% | > 3% | Freeze non-priority consumers + revert delegate if > 3% for 15 min | 15 min rolling | AI-Platform/Bflow/NQH-Bot/NQH-POS gateway metrics |

## Sprint timeline lock (S14 and S15)

| Milestone | Date (or sprint boundary) | Entry criteria | Exit criteria | Owner |
|---|---|---|---|---|
| S14-A Advisory mode start | Sprint 14 Day 1 (2026-05-20) | Arbiter service deployed, all target consumers registered, dashboards live | 72h stable advisory telemetry with no data gaps | @architect + @oga-devops |
| S14-B Delegate mode start | Sprint 14 Day 3 (2026-05-22) | S14-A exit met, CTO go/no-go recorded | No rollback trigger breached through Sprint 14 close | @architect (R), CTO (A) |
| S15-A `RULE-VRAM-001` deprecation notice | Sprint 15 Day 1 (2026-05-27) | Delegate mode stable in Sprint 14, owner acknowledgment collected | Notice published in docs + channel, migration FAQ linked | @pm + @architect |
| S15-B `RULE-VRAM-001` removal | Sprint 15 Day 4 (2026-05-30) | Backward-compat checklist green, no open Sev-1/Sev-2 from arbiter rollout | Legacy rule removed, post-change review completed | @architect + @oga-devops |
| JUL-A Mac Mini cutover prep | End of June (2026-06-28) | Mac Mini M4 Pro 48G received, baseline benchmarks complete, deployment checklist signed | Go/No-Go approved by CTO+CPO | @architect + @oga-devops + @marketing |
| JUL-B Production cutover to Mac Mini | Early July (target 2026-07-03) | JUL-A approved, smoke tests green for audio/image/video on Mac Mini | S1 marked dev/test-only in runbooks and ADR notes | CTO (A), @architect (R) |

## ADR update checklist (after session)

- [ ] Copy all D1-D5 final decisions into ADR-008.
- [ ] Replace all remaining `TBD` in governance-critical sections.
- [ ] Add RACI and SLA table to escalation section.
- [ ] Add quantitative rollback triggers to migration section.
- [ ] Add S14/S15 date locks to implementation roadmap.
- [ ] Add July Mac Mini production cutover milestone and mark S1 as dev/test-only after cutover.
- [ ] Set ADR-008 status gate note based on CTO+CPO outcome.

## Sign-off

- CTO sign: ✅ APPROVED 2026-05-11
  - Concessions: D3 systemd correct (was Docker), D5 WFQ better (was FIFO), D4 hybrid right
  - CTO accountability: D2 VieNeu, D4 heartbeat, D5 queue, S14-B go/no-go, JUL-B cutover
  - Flag: Mac Mini cutover requires ADR-009 by mid-June
- CPO sign: ✅ APPROVED 2026-05-11
  - Conditions acknowledged: S1 Ollama-first for shared LLM services; content production cutover to Mac Mini in July
  - CPO accountability: D1 business priority guardrails, L2/L3 communication cadence, JUL-A/JUL-B readiness with Marketing

