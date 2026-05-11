---
sprint: 11
status: PLANNED
start_date: 2026-05-12
planned_duration: 1 week
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto", "@cpo"]
  trigger: "Sprint 10 closed — Wan2.1 + LTX integration complete; external repo evaluation approved by CPO+CTO"
branch: "sprint-11/external-repo-spikes"
baseline_commit: "HEAD"
rollback: "git checkout main"
---

# Sprint 11 — External Repo Evaluation Spikes (OpenReel + IndexTTS)

**Sprint**: 11 | **Phase**: Phase A (Studios Activation — Extension)
**Previous**: Sprint 10 (Wan2.1 + LTX-Video local video integration — COMPLETE)
**Branch**: `sprint-11/external-repo-spikes` (off `main@HEAD`)

---

## Sprint Goal

Evaluate two external open-source repos for integration into NQH Creative Studio:
1. **OpenReel Video** — client-side video editor (MOP Post-Production)
2. **Draft to Take / IndexTTS** — local script-to-audio studio (MOP Voice)

Both spikes must produce pass/fail reports per CTO-locked acceptance criteria.
No integration code merges until spikes pass AND ADR-006/007 are approved at G2.

---

## Context

### Sprint 10 Learning

Wan2.1 T2V-1.3B and LTX-Video successfully integrated into Video Studio:
- Local video generation: ✅ PASS (Wan2.1 ~130s, LTX ~10s)
- Async job queue: ✅ PASS
- Quality verified: ✅ PASS

Remaining gap: **post-production** (edit generated video) and **audio production**
(TTS/voiceover for ads). These are MOP-tier capabilities, not OGA generation.

### What Already Exists
- OGA Video Studio: generates MP4 via Wan2.1/LTX/CogVideoX
- LipSync Studio: cloud-only (audio + image → lip-sync video)
- No video editor, no TTS engine, no audio mixing

### External Repo Decisions (CPO + CTO locked)

| Repo | Verdict | Integration Pattern | Preconditions |
|------|---------|---------------------|---------------|
| OpenReel | ✅ SPIKE → INTEGRATE | Subdomain `editor.studio.nhatquangholding.com` | A1–A6 pass |
| IndexTTS | ⚠️ SPIKE → CONDITIONAL | Companion microservice on S1 | 3 hard gates (legal, Linux, VRAM) |
| OpenShorts | ❌ REJECTED | None — UX reference only | N/A |

---

## Backlog (Priority Order)

| Task | Description | Priority | Points | Owner | Condition |
|------|-------------|----------|--------|-------|-----------|
| 11.0a | **Spike: OpenReel deployment** — build, systemd, Nginx, SSL, smoke test on S1 | P0 | 3 | @architect + @coder | Must produce spike report |
| 11.0b | **Spike: IndexTTS evaluation** — Day 1 legal, Day 2 Linux smoke, Day 3 VRAM + VN quality | P0 | 5 | @coder + @cto | Must produce spike report; Day 1 = HARD GATE |
| 11.1 | **VRAM-arbiter spec** — Design GPU memory arbitration for IndexTTS + video coexistence | P0 | 2 | @architect | Must complete BEFORE any IndexTTS integration code |
| 11.2 | **ADR-006 draft revision** — Update with spike findings, G2 readiness review | P1 | 1 | @architect | After 11.0a completes |
| 11.3 | **ADR-007 draft revision** — Update with spike findings, G2 readiness review | P1 | 1 | @architect | After 11.0b completes |
| 11.4 | **DevOps provisioning** — DNS + Nginx proxy for `editor.studio.nhatquangholding.com` | P1 | 2 | @devops | Parallel with 11.0a |
| 11.5 | **User guide update** — Document two-URL workflow (OGA vs editor.*) + IndexedDB origin warning | P2 | 1 | @pm | After 11.0a completes |

**Total**: 15 points. P0 spikes (11.0a + 11.0b + 11.1) = 10 points guaranteed.

---

## Task Dependencies

```
11.0a (OpenReel spike) ──PASS──→ 11.2 (ADR-006 revision) ──→ 11.5 (User guide)
         │                                                  └──→ 11.4 (DevOps deploy)
         │
11.0b (IndexTTS spike) ──PASS──→ 11.3 (ADR-007 revision)
         │
         └── Day 1 LEGAL HARD GATE ──FAIL──→ DEFERRED (escalate CEO)

11.1 (VRAM-arbiter spec) ── independent, must finish before 11.0b concludes
```

---

## Task Details

### 11.0a — OpenReel Deployment Spike

**Duration**: 1 day max
**Script**: `docs/04-build/sprints/sprint-11-openreel-spike-plan.md`
**Key questions**:
- Does `pnpm install && pnpm build` succeed on S1 (Ubuntu 22.04, Node 18+)?
- Does systemd unit `oga-editor.service` run stably on port 3006?
- Does Nginx reverse proxy + SSL resolve correctly?
- Can user import MP4, add text overlay, export MP4?
- Any high/critical CVEs in `npm audit --production`?

**Pass criteria (all must pass)**:
1. Build exits 0
2. systemd service healthy
3. Nginx + SSL resolves
4. Smoke test (import → edit → export) succeeds
5. 0 high/critical CVEs (or documented waiver)
6. Resource usage within S1 headroom

### 11.0b — IndexTTS Evaluation Spike

**Duration**: 3 days max
**Script**: `docs/04-build/sprints/sprint-11-indextts-spike-plan.md`
**Key questions**:
- Are IndexTTS2 / OmniVoice / Qwen3 weights commercial-safe?
- Does Docker Compose stack run on Ubuntu 22.04 (not just Windows WSL2)?
- Does TTS endpoint return valid WAV in <30s?
- Can Wan2.1 + IndexTTS coexist on RTX 5090 32GB without OOM?
- Is Vietnamese TTS quality ≥3/5 "acceptable" vs ElevenLabs benchmark?

**Day 1 — Legal HARD GATE (must pass before days 2–3)**:
- Read `BETA_TERMS.md` + `THIRD_PARTY_NOTICES.md`
- Document commercial posture for each model weight
- If any "non-commercial" or "research-only" → HALT, escalate CEO

**Day 2 — Linux smoke**:
- `docker compose up -d` on S1
- All 5 containers healthy
- English TTS returns WAV in <30s

**Day 3 — VRAM + VN quality**:
- Concurrent Wan2.1 + IndexTTS: confirm no OOM
- 5 VN scripts: A/B vs ElevenLabs, Hùng rates ≥3/5 acceptable

### 11.1 — VRAM-Arbiter Spec

**Owner**: @architect
**Output**: Spec document (Markdown) defining:
- `nvidia-smi` polling mechanism
- VRAM threshold gates (e.g., >28GB allocated → block or CPU-fallback)
- Queue semantics for concurrent requests
- CPU-fallback trigger for IndexTTS

**Constraint**: Must be drafted BEFORE any IndexTTS integration code. Reverse order = tech debt.

---

## Acceptance Criteria

### Guaranteed (regardless of spike outcomes)
- [ ] Spike report(s) for every repo actually run: OpenReel, IndexTTS (2 reports)
- [ ] License status verified for IndexTTS (Day 1 hard gate documented)
- [ ] VRAM-arbiter spec drafted and reviewed by @architect + @cto
- [ ] ADR-006 and ADR-007 updated with spike findings
- [ ] `.sdlc-config.json` updated with S11 status
- [ ] 0 regressions in existing tests (155 logic tests pass)

### Conditional (if spikes PASS)
- [ ] OpenReel subdomain deployed and healthy (S12 plan ready)
- [ ] IndexTTS integration plan drafted for S12-13 (if 3 preconditions pass)

### Negative verification
- [ ] No PR opens against `OGA/main` for OpenShorts code
- [ ] No IndexTTS integration code merged before VRAM-arbiter spec approved

---

## Definition of Done

- [ ] Spike reports submitted and reviewed by @cto
- [ ] At least one spike passes → integration plan drafted OR all spikes documented with rationale
- [ ] ADR-006/007 revised with spike evidence
- [ ] VRAM-arbiter spec approved by @architect + @cto
- [ ] All tests pass (155+ logic tests, 0 regressions)
- [ ] `npm run build` exits 0
- [ ] Sprint plan updated to `status: DONE`
- [ ] Branch merged to main (spike reports + ADR updates + spec docs only — no integration code unless G2 passed)
- [ ] No code PRs opened against `OGA/main` during S11; spike artifacts + ADR revisions only

---

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| OpenReel build fails on S1 (Node/pnpm mismatch) | Low | Medium | Use nvm to pin Node 18; install pnpm globally |
| IndexTTS Day 1 legal ambiguity | Medium | Critical | CEO escalation path pre-defined; halt spike immediately |
| IndexTTS Linux incompatible | Medium | High | Test Docker natively on S1 Day 2; if fails → DEFERRED |
| VRAM coexistence OOM | Medium | High | CPU-fallback mode documented in spike plan |
| Vietnamese TTS quality <3/5 | Medium | Medium | Document fallback to cloud TTS for VN content |
| DevOps DNS delay | Low | Low | Parallel track; internal hosts file workaround for spike |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 11 Plan*
