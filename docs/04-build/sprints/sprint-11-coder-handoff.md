# Sprint 11 — @coder Handoff Prompt (for Kimi CLI)

**Date:** 2026-05-09
**From:** @pm + @architect → @coder
**Sprint:** 11 (External Repo Evaluation Spikes — OpenReel + IndexTTS)
**Branch:** `sprint-11/external-repo-spikes` (off `main@HEAD`)
**CTO + CPO Approved:** ✅ 2026-05-09

---

## Document Work Completed (Stage 00–03)

All docs updated by @pm + @architect before this handoff:

| Stage | File | Update |
|-------|------|--------|
| 00-Foundation | `docs/00-foundation/business-case.md` | Added external repo ROI, boundary policy, risk factors |
| 00-Foundation | `docs/00-foundation/problem-statement.md` | Added post-production gap, updated success metrics |
| 01-Planning | `docs/01-planning/requirements.md` | Added FR-S11-01..03 (OpenReel spike, IndexTTS spike, VRAM-arbiter spec) |
| 01-Planning | `docs/01-planning/scope.md` | Added Sprint 11 in/out scope, updated hardware constraints |
| 01-Planning | `docs/01-planning/user-stories.md` | Added US-POSTPROD, US-VOICE, US-VRAM + traceability |
| 01-Planning | `docs/01-planning/external-repo-assessment-2026-05-06.md` | PM/Architect assessment (CPO approved) |
| 02-Design | `docs/02-design/01-ADRs/ADR-006-postproduction-boundary.md` | Proposed, G2 pending — OpenReel subdomain deployment |
| 02-Design | `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` | Proposed, G2 post-spike — IndexTTS companion microservice |
| 03-Integrate | `docs/03-integrate/api-contracts.md` | Added OpenReel handoff (MinIO/S3) + IndexTTS REST contract |
| 03-Integrate | `docs/03-integrate/gpu-server-integration.md` | Added OpenReel/IndexTTS ports, VRAM budget map |
| 04-Build | `docs/04-build/sprints/sprint-11-plan.md` | Consolidated sprint plan (this sprint) |
| 04-Build | `docs/04-build/sprints/sprint-11-openreel-spike-plan.md` | Spike A detailed plan |
| 04-Build | `docs/04-build/sprints/sprint-11-indextts-spike-plan.md` | Spike B detailed plan |
| 08-Collaborate | `docs/08-collaborate/CTO-REVIEW-external-repos-2026-05-09.md` | CTO review + CPO concurrence |
| Config | `.sdlc-config.json` | Updated gates: G2 current, S11 planned, OpenShorts rejected |

---

## Prompt for Kimi CLI

```
@coder Sprint 11 implementation — NQH Creative Studio (OGA)

Context: Sprint 11 evaluates two external OSS repos for MOP-tier integration.
NO code merges into OGA/main this sprint — only spike reports + spec docs.
Repo: /home/nqh/shared/OGA
Branch: sprint-11/external-repo-spikes
CTO + CPO approved. All design docs ready.

Task 11.0a — OPENREEL DEPLOYMENT SPIKE (P0, 1 day)
Owner: @architect (spike lead) + @coder (deploy execution)
Spec: docs/04-build/sprints/sprint-11-openreel-spike-plan.md
ADR: docs/02-design/01-ADRs/ADR-006-postproduction-boundary.md

Steps:
1. Clone https://github.com/Augani/openreel-video to /tmp/openreel-spike
2. Pin to specific commit SHA (record in spike report)
3. pnpm install && pnpm build — must exit 0
4. Create systemd unit oga-editor.service (port 3006)
5. Configure Nginx reverse proxy for editor.studio.nhatquangholding.com
6. Smoke test: import 5s MP4 → add text overlay → export MP4 → plays in VLC
7. npm audit --production — record CVE count
8. Document all results in docs/04-build/sprints/sprint-11-openreel-spike-report.md

CTO hard rule: SUBDOMAIN deployment, NOT iframe in OGA.
Pass criteria: A1–A6 all ✅ (see spike plan)

Task 11.0b — INDEXTTS EVALUATION SPIKE (P0, 3 days)
Owner: @coder (spike execution) + @cto (Day 1 legal review)
Spec: docs/04-build/sprints/sprint-11-indextts-spike-plan.md
ADR: docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md

Day 1 — LEGAL HARD GATE (MUST PASS before days 2–3):
1. Read BETA_TERMS.md + THIRD_PARTY_NOTICES.md in repo
2. Summarize commercial-use posture for: IndexTTS2, OmniVoice, Qwen3, MusicGen
3. If ANY model = "non-commercial" or "research-only" → HALT, escalate CEO
4. Document in spike report §Legal Clearance

Day 2 — LINUX SMOKE TEST:
1. Clone repo to /tmp/indextts-spike
2. Create start.sh for Ubuntu (adapt from start.bat)
3. docker compose up -d
4. Verify all 5 containers healthy
5. Submit English sample script → TTS endpoint returns WAV in <30s
6. Record first-run model download time + disk usage

Day 3 — VRAM COEXISTENCE + VN QUALITY:
1. Load Wan2.1 in OGA (curl trigger)
2. Run IndexTTS TTS WHILE Wan2.1 loaded
3. Capture nvidia-smi peak VRAM; confirm NO OOM
4. If OOM → test CPU-only mode for IndexTTS
5. Generate 5 Vietnamese scripts via IndexTTS2
6. Generate same 5 scripts via ElevenLabs VN (cloud benchmark)
7. Send 10 clips (randomized) to Hùng (Marketing) for blind rating
8. Pass threshold: ≥3/5 IndexTTS clips rated "acceptable"
9. Document all results in docs/04-build/sprints/sprint-11-indextts-spike-report.md

CTO hard rule: Day 1 legal gate is NON-NEGOTIABLE. Skip = instant deferral.
Preconditions: (1) legal clear, (2) Linux smoke, (3) VRAM coexistence. Fail any = DEFERRED.

Task 11.1 — VRAM-ARBITER SPEC (P0, parallel)
Owner: @architect (spec author)
Output: Markdown spec document (add to ADR-007 or separate file)

Spec must define:
- nvidia-smi polling mechanism (interval, command)
- VRAM threshold gates (e.g., >28GB allocated → block or CPU-fallback)
- Queue semantics for concurrent video + TTS requests
- CPU-fallback trigger conditions for IndexTTS
- systemd / docker-compose integration for monitoring

Constraint: MUST be drafted BEFORE any IndexTTS integration code. Reverse order = tech debt.

Task 11.2 — ADR-006 REVISION (P1)
Update ADR-006 with OpenReel spike findings:
- Build status (success/failure)
- Commit SHA pinned
- CVE scan results
- Smoke test outcome
- G2 readiness recommendation

Task 11.3 — ADR-007 REVISION (P1)
Update ADR-007 with IndexTTS spike findings:
- Legal clearance summary
- Linux compatibility result
- VRAM coexistence analysis
- Vietnamese quality A/B results
- G2 readiness recommendation (or DEFERRED rationale)

Task 11.4 — DEVOPS PROVISIONING (P1, parallel)
Owner: @devops
- DNS A record: editor.studio.nhatquangholding.com → S1 IP
- Nginx server block: proxy_pass to localhost:3006
- SSL cert: Let's Encrypt (same as studio.nhatquangholding.com)
- UFW: allow 172.19.0.0/16 → tcp/3006 (Docker bridge)

Task 11.5 — USER GUIDE UPDATE (P2)
Owner: @pm
- Document two-URL workflow: OGA (studio.*) vs Editor (editor.*)
- Warn: IndexedDB projects are origin-local; export .openreel files to share
- Add to docs/07-operate/video-studio-model-guide.md

Design docs (read before implementing):
- ADR-006: docs/02-design/01-ADRs/ADR-006-postproduction-boundary.md
- ADR-007: docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md
- API contracts: docs/03-integrate/api-contracts.md
- GPU S1 profile: docs/03-integrate/gpu-server-integration.md
- Sprint plan: docs/04-build/sprints/sprint-11-plan.md
- Spike A plan: docs/04-build/sprints/sprint-11-openreel-spike-plan.md
- Spike B plan: docs/04-build/sprints/sprint-11-indextts-spike-plan.md
- CTO review: docs/08-collaborate/CTO-REVIEW-external-repos-2026-05-09.md

Acceptance criteria:
- [ ] OpenReel spike report exists with ✅/❌ for A1–A6
- [ ] IndexTTS spike report exists with ✅/❌ for B1–B9 + legal summary
- [ ] VRAM-arbiter spec drafted and approved by @architect + @cto
- [ ] ADR-006 revised with spike findings
- [ ] ADR-007 revised with spike findings
- [ ] 155+ logic tests pass, 0 regressions
- [ ] npm run build — 0 errors
- [ ] No PR opens for OpenShorts code (negative verification)
- [ ] No IndexTTS integration code merged before VRAM-arbiter spec approved
```

---

## CTO Hard Reminders (Locked)

1. **Spike B Day 1 = HARD GATE** — `BETA_TERMS.md` ambiguity → escalate CEO immediately, no self-decision.
2. **Pin SHA / digest from commit đầu tiên** — PR đầu phải show pinned ref trong systemd unit / docker-compose. CTO sẽ reject PR không pin.
3. **Spike report = artifact bắt buộc** — không có spike report → không thảo luận G2 promotion. Empty checkboxes = automatic re-spike.
4. **VRAM-arbiter spec phải đến TRƯỚC code IndexTTS integration.** Ngược thứ tự = technical debt vĩnh viễn.

---

*Sprint 11 Handoff | @pm + @architect → @coder | CTO + CPO Approved 2026-05-09*
