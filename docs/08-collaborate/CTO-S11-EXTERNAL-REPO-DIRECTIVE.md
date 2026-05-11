---
Version: 6.3.1
Date: 2026-05-09
Status: ACTIVE — CTO Sprint 11 External-Repo Integration Directive
Authority: "@cto"
Stage: "08-collaborate"
References:
  - docs/01-planning/external-repo-assessment-2026-05-06.md (PM/Architect report)
  - docs/08-collaborate/CTO-SPRINT10-DIRECTIVE.md
  - IDENTITY.md
  - /home/dttai/.claude/plans/ticklish-honking-codd.md (CTO planning artifact)
---

# CTO Directive — Sprint 11 External Repo Integration

**From:** @cto  
**To:** @pm, @pjm, @architect, @coder, @devops  
**Date:** 2026-05-09  
**Context:** Decisions on 3 candidate OSS repos for OGA / MOP integration.

---

## 1. Boundary Policy (CTO ratifies CPO formulation)

```
OGA  = AI generation (image, video, lip-sync) — local-first, zero per-asset cost
MOP  = post-production (edit, voice, distribute) — companion tools, separate boundaries
BAP  = social distribution + employee advocacy — Postiz fork, untouched
```

**Rule**: each tool owns one verb. Do not duplicate generative surfaces across OGA and MOP. Do not embed publishing into OGA (that is BAP territory).

---

## 2. Decisions

| Repo | Verdict | Target | ADR |
|---|---|---|---|
| [Augani/openreel-video](https://github.com/Augani/openreel-video) | **SPIKE → INTEGRATE** | MOP — subdomain `editor.studio.nhatquangholding.com` (port 3006) | ADR-006 |
| [mutonby/openshorts](https://github.com/mutonby/openshorts) | **REJECT** | — | none |
| [JaySpiffy/IndexTTS-Workflow-Studio](https://github.com/JaySpiffy/IndexTTS-Workflow-Studio) | **SPIKE → CONDITIONAL** | MOP — companion microservice on S1 | ADR-007 |

### Rationale highlights

- **OpenReel**: closes OGA's biggest gap (post-production edit). Stack incompatible with OGA monorepo (Vite/pnpm vs Next.js/npm) → **subdomain deployment, NOT iframe-in-OGA, NOT monorepo merge**.
- **OpenShorts**: 5 paid SaaS dependencies → violates OGA zero-cost mandate. AI-actor likeness rights = legal exposure. Massive surface overlap with OGA + BAP. Read-only UX reference allowed; no code/contract reuse.
- **IndexTTS**: highest reward (audio production, complete the pipeline) and highest risk (closed GHCR images, beta license, Linux unverified, VRAM coexistence). Spike gated behind 3 hard preconditions.

Full technical analysis: see CTO planning artifact `/home/dttai/.claude/plans/ticklish-honking-codd.md`.

---

## 3. Spike Acceptance Criteria (CTO-locked)

### Spike A — OpenReel deploy on S1

**Owner**: @architect + @coder | **Duration**: 1 day | **Branch**: `spike/openreel-deploy`

- [ ] `git clone openreel-video && pnpm install && pnpm build` exits 0 on S1
- [ ] systemd unit `oga-editor.service` runs on port 3006
- [ ] NPM proxy `editor.studio.nhatquangholding.com` resolves with valid SSL
- [ ] Smoke test: import 5s MP4, add text overlay, export MP4 → file plays in VLC
- [ ] `npm audit --production` shows 0 high/critical CVEs
- [ ] Pin to specific commit SHA (NOT `main`); document SHA in spike report

**Output**: `docs/04-build/sprints/sprint-11-openreel-spike-report.md`

### Spike B — IndexTTS legal + Linux + VRAM (3 days, sequential)

**Owner**: @coder (exec) + @cto (legal review Day 1) | **Branch**: `spike/indextts-eval`

**Day 1 — Legal pre-clear (HARD GATE — Day 2 blocked until passed):**
- [ ] Read BETA_TERMS.md + THIRD_PARTY_NOTICES.md from upstream repo
- [ ] Document commercial-use posture for each model: IndexTTS2, OmniVoice, Qwen3-8B, MusicGen, DeepFilterNet
- [ ] Escalate to @human (CEO Tai Dang) if ANY model = non-commercial / research-only

**Day 2 — Linux smoke (S1 Ubuntu 22.04):**
- [ ] `docker compose up -d` brings all 5 containers healthy
- [ ] TTS endpoint returns valid WAV in <30s for an EN sample script
- [ ] Pin every container image by digest (`@sha256:...`) — no `:latest` tags

**Day 3 — VRAM coexistence + VN quality:**
- [ ] Load Wan2.1 in OGA → run TTS concurrently → capture `nvidia-smi` peak VRAM, confirm no OOM
- [ ] Generate 5 VN sample scripts → blind A/B vs ElevenLabs VN, reviewed by @marketing-manager (Hùng)
- [ ] Pass = ≥3/5 rated "acceptable" by Hùng

**Output**: `docs/04-build/sprints/sprint-11-indextts-spike-report.md`

**Halt condition**: any of (Day 1 legal, Day 2 Linux, Day 3 VRAM) fails → integration **DEFERRED**, not failed. Re-evaluate after upstream v3 / out of beta.

---

## 4. Hard Constraints

1. **No monorepo merge** of any of the 3 repos into `OGA/main`. Subdomain or external Compose only.
2. **No iframe of OpenReel inside OGA UI** — WebGPU context conflicts + IndexedDB origin isolation. Use deep-link export pattern instead (OGA exports MP4 → `editor.*` opens with `?import=<url>`).
3. **No code or API contract borrowed from OpenShorts** without @cpo + @cto explicit approval.
4. **Pin upstream artifacts**: OpenReel = git commit SHA; IndexTTS = container image digest. Forbidden to chase `main` / `:latest`.
5. **VRAM arbiter**: before integrating IndexTTS, @architect designs a VRAM-aware coordinator between OGA `server.py` hot-swap state machine and IndexTTS Docker stack. Currently `server.py` does not see external Docker VRAM consumers.

---

## 5. Risk Register

| ID | Risk | P | I | Owner |
|---|---|---|---|---|
| R-EXT-001 | OpenReel beta breaks on upstream pull | Med | Med | @coder — pin SHA |
| R-EXT-002 | OpenReel projects trapped in IndexedDB (no team sync) | High | Med | @architect — ADR-006 export contract |
| R-EXT-003 | IndexTTS GHCR upstream goes dark | Low | High | @coder — mirror digest, document exit plan |
| R-EXT-004 | IndexTTS VRAM conflict with video pipeline | Med | High | @architect — VRAM-arbiter design |
| R-EXT-005 | IndexTTS commercial license non-compliance | Med | Critical | @cto — Day 1 legal gate |
| R-EXT-006 | OpenShorts UX patterns leaking via "reference only" | Low | Low | @cpo — gate any borrowing |

---

## 6. Out of Scope

- OpenShorts integration (rejected).
- Mac Mini deployment of these tools (S1-only for now — Apple Silicon support not target).
- BAP modifications (Postiz fork stays untouched).
- Re-litigating feature fit (PM owns) or product strategy (CPO owns).

---

## 7. Directive Summary

```
[@pjm]      → Schedule Sprint 11 with Spike A (1 day) + Spike B (3 days, sequential).
              Do NOT mark any G2 passed for these features pre-spike.

[@architect]→ Draft ADR-006 (Post-Production Boundary) + ADR-007 (Audio Architecture)
              skeletons before Sprint 11 kickoff. Spec the VRAM-arbiter design for
              IndexTTS coexistence with server.py state machine.

[@coder]    → Execute spikes per acceptance criteria. Halt + escalate on any ❌.
              Pin SHAs / digests. No latest-tag deploys.

[@devops]   → Provision DNS + NPM proxy host for editor.studio.nhatquangholding.com.
              UFW rule for 172.19.0.0/16 → tcp/3006.

[@cto]      → Day 1 legal review (Spike B). Authority on Go/No-Go after spikes complete.

[@cpo]      → Lock decision: OpenShorts UX-pattern borrowing requires explicit approval
              per case. No osmosis.
```

---

## 8. Co-Signatures

### CPO Sign-Off — 2026-05-09

> **Approved (CPO):** External repo plan per CTO review — **OpenReel** P1 spike→deploy on MOP subdomain + deep-link (no iframe); **IndexTTS** P2 spike with 3 precondition gates; **OpenShorts** rejected; **BAP** scope unchanged; boundary **OGA = create / MOP = edit+voice+distribute / BAP = publish** ratified. Conditions: ADR-006/007 + spike artifacts + risk register as CTO locked.

CPO operational notes (incorporated, no gate change):

1. **Two-URL onboarding clarity** — OGA (`studio.*`) vs editor (`editor.*`) creates IndexedDB origin separation. @pjm to add a one-line user-guide note: *"Projects edited in editor.studio.* live only in that browser profile; export `.openreel` + MP4 before switching machines."* Owner: @pjm | Sprint: S12 deploy task.

2. **IndexTTS quality bar escalation** — spike threshold (≥3/5 VN samples acceptable per @marketing-manager) is sufficient to **proceed**. **Production threshold** to be raised in ADR-007 after spike succeeds. CTO ratifies. Owner: @architect (ADR-007 author).

### CTO Sign-Off — 2026-05-09

@cto issues this directive. Combined with CPO co-sign above, this constitutes joint Product+Technical authorization for Sprint 11 spike execution. Any deviation from the locked acceptance criteria or boundary policy requires re-approval from both CPO and CTO (or CEO escalation if outside their joint mandate).

---

*@cto + @cpo | NQH Creative Studio (OGA) + MOP boundary | SDLC Framework v6.3.1 | 2026-05-09*
