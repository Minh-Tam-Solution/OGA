---
doc_id: CTO-REVIEW-EXT-001
title: "CTO Review — External Repo Integration Assessment"
date: 2026-05-09
owner: "@cto"
gate: G2
references:
  - docs/01-planning/external-repo-assessment-2026-05-06.md
  - IDENTITY.md
  - docs/02-design/01-ADRs/ADR-004-aiplatform-integration.md
---

# CTO Review — External Repo Integration Assessment (3 repos)

> **Scope:** CTO-specific technical layer on top of PM/CPO assessments.  
> **Does NOT re-litigate:** feature fit (PM owns) or product strategy (CPO owns).  
> **Locks:** spike acceptance criteria + decision gates + supply-chain risk.  
> **Date:** 2026-05-09

---

## Boundary Policy (CTO ratifies CPO formulation)

| Domain | Owns | Does NOT Own |
|--------|------|--------------|
| **OGA** | AI generation (image, video, lip-sync) — local-first, zero per-asset cost | Post-production, audio, publishing |
| **MOP** | Post-production (edit, voice, distribute) — companion tools, separate boundaries | Generation, social advocacy |
| **BAP** | Social distribution + employee advocacy — Postiz fork, untouched | Generation, editing |

**Rule:** Each tool owns one verb. Do not duplicate generative surfaces across OGA and MOP. Do not embed publishing into OGA (BAP territory).

---

## Repo 1 — OpenReel Video → APPROVED FOR SPIKE

🔗 https://github.com/Augani/openreel-video

### Stack Reality
React 18 + TypeScript + Vite + pnpm + Zustand + WebGPU/WebCodecs + IndexedDB. ~130k LOC monorepo. MIT. Beta status (v0.2.0, May 2026, 2.1k stars).

### Concerns & Mitigation

| Concern | Severity | Mitigation |
|---------|----------|------------|
| Vite + pnpm vs OGA's Next.js + npm | Medium | **Do NOT merge into OGA monorepo.** Deploy as separate app at `editor.studio.nhatquangholding.com` (subdomain). New systemd service on S1, port 3006. |
| Browser compat (WebCodecs requires Chrome 94+/FF 130+/Safari 16.4+) | Low | Internal team uses Chrome — acceptable. Document min-browser in user guide. |
| Beta stability (v0.2.0) | Medium | Pin to specific commit SHA in deploy. Re-evaluate quarterly. Do NOT chase main. |
| Supply-chain (130k LOC + transitive npm deps) | Medium | Run `npm audit` + Snyk scan before deploy. Re-scan on every upstream pull. |
| 4K editing requires "dedicated GPU" client-side | Low | Internal users on M-series Macs / decent Win laptops — acceptable. |
| Storage: IndexedDB → projects local to browser | Medium-High | **Gap:** project files don't sync. Need handoff contract: export `.openreel` project + MP4 → MinIO/S3 → import elsewhere. Document in ADR-006. |

### Integration Pattern (CTO-locked)

**Subdomain deployment, NOT iframe-in-OGA.**

PM's "iframe tab" suggestion is **rejected at CTO level**. Reasons:
- WebGPU context conflicts inside iframe
- IndexedDB origin isolation issues
- Keyboard shortcuts break inside iframe

**Deep-link pattern instead:**
1. OGA exports MP4 to a known URL (e.g., MinIO presigned URL)
2. User clicks "Open in Editor" → opens `editor.studio.nhatquangholding.com?import=<url>`
3. OpenReel reads query param, fetches MP4, loads into timeline

### Decision

| Field | Value |
|-------|-------|
| Verdict | SPIKE → INTEGRATE |
| Target | MOP (subdomain `editor.*`) |
| Sprint | S11 spike, S12 deploy |
| Owner | @architect (spike), @coder (deploy), @devops (subdomain) |
| ADR Required | ADR-006: Post-Production tool boundary |
| Gate | G2 before deploy |

---

## Repo 2 — OpenShorts → REJECTED

🔗 https://github.com/mutonby/openshorts

### Stack Reality
Python 3.11 FastAPI + Vite React + Docker Compose. Heavy cloud dependencies: Gemini, fal.ai, ElevenLabs, Upload-Post, AWS S3.

### CTO-Grade Red Flags

| Risk | Severity | Detail |
|------|----------|--------|
| Multi-vendor cloud lock-in | **HIGH** | 5 paid SaaS dependencies. ElevenLabs alone $0.30/min. Multiplies the per-video cost claim (~$0.65–$2). Direct violation of OGA "zero per-image cost" success criterion in `IDENTITY.md`. |
| License unclear in README | **HIGH** | README says "MIT" but file-level `LICENSE` not verified. Per-feature licenses for AI actor models (Hailuo, Kling Avatar, VEED on fal.ai) NOT MIT — they have commercial-use restrictions. Cannot ship NQH-branded UGC without legal sign-off. |
| Likeness rights for AI actors | **HIGH** | Synthetic actors generated via fal.ai (Kling Avatar) carry real-person likeness contamination risk. NQH cannot publish to social channels with these without face-rights audit. Postiz/BAP already handles publishing — this would be a parallel tool with legal exposure. |
| Public gallery + SEO JSON-LD | Medium | OpenShorts ships a public gallery feature. If deployed internally, must be disabled — otherwise leaks UGC and SEO-poisons NQH brand. |
| Architectural overlap with OGA + BAP + MOP | High | Clip Generator overlaps Video Studio. AI Shorts overlaps Lip Sync + Video. YouTube Studio overlaps Image Studio. Publishing overlaps BAP (Postiz). Three NQH platforms already cover this surface. |

### Decision

| Field | Value |
|-------|-------|
| Verdict | REJECTED |
| Allowed usage | Read-only reference for UX patterns in future OGA Marketing Studio redesign |
| Code/Docker/API | NONE — no code, no Docker images, no API contracts borrowed |

---

## Repo 3 — IndexTTS-Workflow-Studio (Draft to Take) → APPROVED FOR SPIKE WITH CONDITIONS

🔗 https://github.com/JaySpiffy/IndexTTS-Workflow-Studio

### Stack Reality
Docker Compose multi-container (5 services). IndexTTS2 + OmniVoice + Qwen3-8B (GGUF/llama.cpp) + optional MusicGen + DeepFilterNet. Launcher MIT; container images private GHCR; model weights "governed separately".

### CTO-Grade Concerns

| Risk | Severity | Mitigation |
|------|----------|------------|
| Beta license ambiguity (`BETA_TERMS.md`) | **HIGH** | Launcher is MIT but ACTUAL value (GHCR images + weights) is not. Risk: NQH cannot redistribute, cannot guarantee uptime if GHCR images are pulled. **MUST read `BETA_TERMS.md` before any spike.** |
| GHCR images = closed-source supply chain | **HIGH** | We deploy binary blobs we cannot audit or rebuild. If upstream goes dark, the audio service breaks. Mitigation: pin image digest (`@sha256:...`), keep local registry mirror, plan exit strategy to bare IndexTTS2 if needed. |
| Linux deployment unverified | Medium | README is Windows + WSL2-centric. S1 is Ubuntu 22.04. Spike day 1 = bring up Compose stack on S1, smoke-test TTS endpoint. If fails → escalate or drop. |
| VRAM budget conflict on S1 | Medium-High | RTX 5090 = 32GB. Wan2.1 ~11GB, LTX ~9GB, CogVideoX ~30GB, IndexTTS2 (claimed 12-16GB), Qwen3-8B GGUF (CPU-only via llama.cpp = no VRAM). If TTS holds 12-16GB while video pipe is loaded → OOM. Hot-swap state machine in `server.py` does NOT cover external Docker services. Mitigation: dedicate IndexTTS to CPU-only or gate via VRAM monitor before allowing video gen concurrency. |
| Tiếng Việt TTS quality | Medium | IndexTTS2 trained primarily on EN/ZH per upstream. CTO-locked acceptance criterion: 5 sample VN scripts → blind A/B vs ElevenLabs Vietnamese. Pass = ≥3/5 rated "acceptable" by Marketing Manager (Hùng). |
| Local model weights disk | Low | ~30-50GB across IndexTTS+Qwen+OmniVoice+SFX. S1 has space. Plan storage budget. |
| Multi-container ops complexity | Medium | 5 containers = 5 things to monitor/restart. Add to S1 runbook. systemd unit per container or docker-compose unit. |

### 3 Hard Preconditions (Must-Pass Before Any Integration)

1. **Legal pre-clear** — Read `BETA_TERMS.md` + `THIRD_PARTY_NOTICES.md`, summarize commercial-use posture for IndexTTS2 / OmniVoice / Qwen3 / MusicGen weights. Escalate to @human (CEO) if any "non-commercial" or "research-only" clause found.
2. **Linux smoke test** — `docker compose up -d` on S1, TTS endpoint returns valid WAV in <30s for an English sample.
3. **VRAM coexistence test** — Run IndexTTS while Wan2.1 pipeline loaded; confirm no OOM, both produce correct output.

**If any of (1)(2)(3) fails → mark integration as DEFERRED, not failed. Re-evaluate after upstream releases v3 or moves out of beta.**

### Decision

| Field | Value |
|-------|-------|
| Verdict | SPIKE → CONDITIONAL |
| Target | MOP companion microservice on S1 |
| Sprint | S11 spike (3 days), S12-13 integrate IF preconditions pass |
| Owner | @coder (spike), @cto (legal review), @architect (VRAM design) |
| ADR Required | ADR-007: Audio production architecture |
| Gate | G2 (post-spike) |

---

## Decision Matrix (CTO-Locked)

| Repo | Verdict | Target | Sprint | Owner | ADR Required | Gate |
|------|---------|--------|--------|-------|--------------|------|
| OpenReel | SPIKE → INTEGRATE | MOP (subdomain `editor.*`) | S11 spike, S12 deploy | @architect (spike), @coder (deploy), @devops (subdomain) | ADR-006 | G2 before deploy |
| OpenShorts | REJECT | — | — | — | — | — |
| IndexTTS | SPIKE → CONDITIONAL | MOP companion microservice on S1 | S11 spike (3 days), S12-13 integrate IF preconditions pass | @coder (spike), @cto (legal review), @architect (VRAM design) | ADR-007 | G2 (post-spike) |

---

## Risk Register Additions

| ID | Risk | Probability | Impact | Mitigation Owner |
|----|------|-------------|--------|-----------------|
| R-EXT-001 | OpenReel beta breaks on upstream pull | Med | Med | @coder — pin commit SHA |
| R-EXT-002 | OpenReel project files trapped in IndexedDB (no team sync) | High | Med | @architect — ADR-006 export contract |
| R-EXT-003 | IndexTTS GHCR upstream goes dark | Low | High | @coder — mirror digest, exit plan documented in spike |
| R-EXT-004 | IndexTTS VRAM conflict with video pipeline | Med | High | @architect — VRAM-arbiter design pre-integrate |
| R-EXT-005 | IndexTTS commercial license non-compliance | Med | Critical | @cto — legal pre-clear gate (Day 1 of spike) |
| R-EXT-006 | OpenShorts UX patterns leaking via "reference only" path | Low | Low | @cpo — gate any borrowing decision |

---

## Verification — How to Confirm This Plan is Followed

- [ ] After S11: both spike reports exist with ✅/❌ on every acceptance criterion.
- [ ] ADR-006 (OpenReel boundary) and ADR-007 (Audio architecture) drafted before any code merge.
- [ ] `.sdlc-config.json` shows S11 status, no premature gate ticking.
- [ ] No PR opens against `OGA/main` for OpenShorts code (negative verification).
- [ ] `editor.studio.nhatquangholding.com` reachable + healthy after S12 deploy.

---

## Critical Files / References

- `docs/01-planning/external-repo-assessment-2026-05-06.md` — PM/Architect detailed report (precondition reading)
- `IDENTITY.md` — OGA boundaries and zero-cost mandate
- `docs/02-design/01-ADRs/` — ADR-006 + ADR-007 to be added
- `docs/06-deploy/runbook-s1.md` — must extend after S12 deploys
- `docs/08-collaborate/CTO-SPRINT10-DIRECTIVE.md` — current sprint directives

---

## CPO Concurrence & Sign-off

> **Approved (CPO):** External repo plan theo CTO review — **OpenReel** P1 spike→deploy trên MOP subdomain + deep-link (no iframe); **IndexTTS** P2 spike với 3 precondition gates; **OpenShorts** rejected; **BAP** không mở scope; boundary **OGA = create / MOP = edit+voice+distribute / BAP = publish** ratified. Điều kiện: ADR-006/007 + artifact spike + risk register như CTO khóa.
>
> *CPO | NQH Creative Studio (OGA) + MOP boundary | 2026-05-09*

---

*@cto | NQH Creative Studio (OGA) + MOP | SDLC Framework v6.3.1 | 2026-05-09*
