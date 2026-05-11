---
Version: 6.3.1
Date: 2026-05-11
Status: ACTIVE — CTO directive to @pm for post-F6 design doc update
Authority: "@cto (OGA)"
Stage: "08-collaborate"
target_executor: "Kimi CLI on GPU server (S1) / OGA repo / @pm role"
sprint: "Sprint 13"
related:
  - "docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md (F6 result)"
  - "docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md (CTO triage)"
  - "docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md"
  - "docs/04-build/sprints/sprint-13-plan.md"
---

# CTO Directive — @pm: Post-F6 Design Doc Update

**From**: OGA @cto  
**To**: @pm (executed by Kimi CLI on GPU server S1 repo)  
**Date**: 2026-05-11  
**Re**: VieNeu is dead. Update Sprint 13 plan + ADR-007. Do NOT touch ADR-008 D6 row yet.

---

## 1. Background

F6 spike closed 2026-05-11 ~10 min: upstream image `pnnbao/vieneu-tts:serve` is `linux/amd64` only. No arm64 build → cannot run on Mac Mini production target → cannot run on Apple Silicon at all.

CEO has closed the local MacBook session. Kimi CLI is now operating from the GPU server (S1) inside the OGA repo. We continue Sprint 13 work per the plan.

**Decision waterfall from F6**:
- WS-C path C.1 (rework adapter) → **DEAD** until upstream ships arm64
- WS-C path C.3 (replace engine) → **Default**, but likely resolves to **"drop VieNeu, keep existing Piper + MeloTTS"** (both already in production allowlist with Hùng PASS)
- VieNeu evaluation tasks → **CANCEL**, not "defer"

---

## 2. Scope of this directive

**@pm authority (you can edit):**
- ✅ `docs/04-build/sprints/sprint-13-plan.md` — task 13.0b status, risk register, DoD
- ✅ Propose draft updates to `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` (architect-owned, but PM can draft + flag for @architect approval)
- ✅ `docs/04-build/sprints/sprint-13/` working artifacts as needed

**OUT of scope (do NOT touch):**
- ❌ `docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md` D6 registry — the `aiplatform-voice-vieneu` row stays as-is with F6 footnote. Removal is AI-Platform CTO decision pending response 2026-05-15 EOD. Wait for their countersign before removing.
- ❌ `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` direct edit — PM drafts, @architect commits. Use a separate draft file at `docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md` for the proposed changes.
- ❌ Any Sprint 14 plan creation — that's a PJM ticket after WS-C decision lands
- ❌ Roadmap edits — pending CEO + CPO review

---

## 3. Required updates — `sprint-13-plan.md`

Locate and replace these specific sections. Use Edit tool with exact context.

### 3.1 — Sprint objectives (line ~30)

Find:
```
3. **Evaluate** next-engine candidates (VieNeu solo eval, OmniVoice license unblock)
```

Replace with:
```
3. **Evaluate** next-engine candidates — **VieNeu CANCELLED post-F6 spike 2026-05-11** (upstream amd64-only, no Apple Silicon path); OmniVoice still license-blocked
```

### 3.2 — CPO Guardrail (line ~33)

Find:
```
**CPO Guardrail:** If VieNeu GPU is not freed by Sprint 13 start (2026-05-13), scope locks to **2-engine MVP** (Piper + MeloTTS). No sprint delay for external blockers.
```

Replace with:
```
**CPO Guardrail:** Scope is **locked to 2-engine MVP** (Piper + MeloTTS) per F6 spike outcome 2026-05-11. VieNeu cannot reach Mac Mini production target (upstream amd64-only). 2-engine stack ratified as production by Hùng sign-off Spike C + Spike E v2.
```

### 3.3 — Current state list (line ~50)

Find:
```
- VieNeu deferred (GPU OOM + adapter broken at v0.1.0)
```

Replace with:
```
- VieNeu **CANCELLED** post-F6 spike 2026-05-11 — upstream `pnnbao/vieneu-tts:serve` is amd64-only, no Apple Silicon path. Mac Mini production cutover incompatible with VieNeu.
```

### 3.4 — Task 13.0b (line ~64)

Find the task 13.0b row:
```
| 13.0b | **Spike E v3 — VieNeu solo eval** — Run upstream `pnnbao/vieneu-tts:serve` Docker on freed GPU; 5-sample smoke + pronunciation check | P0 | 5 | @coder | Blocked until ollama owner coordinates unload window OR S118 adapter fix lands |
```

Replace with:
```
| 13.0b | ~~Spike E v3 — VieNeu solo eval~~ — **CANCELLED 2026-05-11** per F6 spike result (upstream amd64-only). 5h reclaimed → reassigned to S118 cleanup if needed, otherwise sprint slack. | ~~P0~~ | 0 | — | CANCELLED — see `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md` + `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md` |
```

### 3.5 — Task ordering list (line ~90)

Find:
```
13.0b (VieNeu solo eval)
```

Replace with:
```
~~13.0b (VieNeu solo eval — CANCELLED)~~
```

### 3.6 — Risk register row (line ~109)

Find:
```
| VieNeu GPU availability | ⏳ | S1 GPU still blocked; F6 MPS spike on CEO M4 Pro accepted as parallel path |
```

Replace with:
```
| VieNeu GPU availability | ✅ RESOLVED (cancelled) | F6 MPS spike CLOSED 2026-05-11 verdict FAIL — upstream amd64-only. VieNeu no longer in Mac Mini path. Risk closed; 2-engine production stack ratified. |
```

### 3.7 — Mitigation row (line ~119)

Find:
```
| ollama owner unresponsive | VieNeu S1 eval blocked indefinitely | F6 MPS spike on CEO M4 Pro provides parallel path; accept 2-engine config if both blocked |
```

Replace with:
```
| ollama owner unresponsive | ~~VieNeu S1 eval blocked~~ (moot — VieNeu cancelled) | N/A — 2-engine config (Piper + MeloTTS) is the production stack |
```

### 3.8 — DoD checklist (line ~128)

The line is already updated to reflect F6 FAIL — leave as is but VERIFY content:
```
- [x] VieNeu eval: F6 MPS spike report committed — **FAIL**; upstream `pnnbao/vieneu-tts:serve` = linux/amd64 only; no Apple Silicon support
```

If exists, no change. If missing, add to DoD.

### 3.9 — Status table (line ~153-154)

Find:
```
| 13.0b VieNeu eval | ⏳ S1 GPU still blocked | F6 MPS spike COMPLETED — verdict FAIL; see report |
| F6 VieNeu MPS spike | ✅ **COMPLETE — FAIL** | Report: `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md`; upstream = CUDA-only/x86_64-only |
```

Replace with:
```
| 13.0b VieNeu eval | ❌ CANCELLED 2026-05-11 | F6 spike closed at upstream gate; task removed from sprint scope |
| F6 VieNeu MPS spike | ✅ COMPLETE — FAIL (≡ CUDA-ONLY) | Report: `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md`; disposition: `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md` |
| WS-C decision gate | 🚀 Accelerated 06-15 → 05-20 (recommended) | Evidence-ready; AI-Platform CTO response pending 2026-05-15 EOD |
```

---

## 4. Required updates — ADR-007 draft

Create new file: `docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md`

This file is a DRAFT — PM authors, @architect commits to the canonical ADR-007 after review.

Content template:

```markdown
---
Version: 6.3.1
Date: 2026-05-11
Status: DRAFT — @pm proposal for ADR-007 update post-F6
Authority: "@pm draft → @architect approval"
Stage: "04-build / sprint-13"
target_doc: "docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md"
---

# ADR-007 Update Draft — Post-F6 VieNeu Cancellation

**Drafted by**: @pm (Kimi CLI on GPU server S1)
**For approval**: @architect
**Date**: 2026-05-11
**Trigger**: F6 spike closed FAIL 2026-05-11 (`docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md`)

## Required edits to canonical ADR-007

### Edit 1 — VieNeu status table (around line 37)

Find:
| VieNeu Vietnamese (default) | Adapter deferred S118; GPU OOM upstream | ⏳ **DEFERRED** |

Replace with:
| VieNeu Vietnamese (default) | F6 spike 2026-05-11: upstream `pnnbao/vieneu-tts:serve` amd64-only, no Apple Silicon → cannot reach Mac Mini production | ❌ **CANCELLED** |

### Edit 2 — Architecture diagram comment (around line 66)

Find:
│   ├── Adapter routing (melotts | piper | vineu)

Replace with:
│   ├── Adapter routing (piper | melotts) — vineu removed post-F6

### Edit 3 — Boundary rule (around line 74)

Find:
**Boundary rule:** No Python import of `melo`, `piper`, `vineu`, or any TTS library into OGA's Next.js process. REST only.

Replace with:
**Boundary rule:** No Python import of `melo`, `piper`, or any TTS library into OGA's Next.js process. REST only. (VieNeu cancelled post-F6 — no longer in scope.)

### Edit 4 — 2026-05-10 update note (around line 85)

Find:
> **2026-05-10 update:** VieNeu (`vi-vineu-southern-male`) removed from default chain. Adapter deferred S118; registry rows are residue only. Piper promoted to primary VN voice pending Spike E v2 Hùng sign-off.

Append (do not replace) immediately after that block:
> **2026-05-11 update:** F6 MPS compatibility spike on CEO M4 Pro 24G returned **FAIL** in 10 minutes — upstream `pnnbao/vieneu-tts:serve` ships `linux/amd64` only with no `arm64` manifest. VieNeu **cannot** reach the Mac Mini M4 Pro 48G production target. Status moves from DEFERRED → **CANCELLED**. 2-engine stack (Piper primary, MeloTTS fallback) is the ratified production configuration. See `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md` and `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md`.

### Edit 5 — Routing decision (around line 98)

Find:
- **VieNeu** = adapter deferred S118; registry rows are residue → returns 503 if called

Replace with:
- **VieNeu** = cancelled post-F6; registry rows scheduled for removal pending AI-Platform CTO countersign (2026-05-15 EOD)

### Edit 6 — Future evaluation entry (around line 117)

Find:
- **VieNeu future** → Evaluate when S118 adapter fix lands + GPU available (ollama must be stopped)

Replace with:
- ~~**VieNeu future** → Evaluate when S118 adapter fix lands + GPU available~~ — **CANCELLED 2026-05-11 per F6.** Re-evaluation only possible if upstream ships arm64 build (request issued to maintainer `pnnbao` with 14-day window).

### Edit 7 — Spike reference (around line 124)

Find:
**Spike E v2:** Piper vs MeloTTS A/B. See `docs/04-build/sprints/sprint-12/spike-e-results.md`. VieNeu unavailable → deferred evaluation.

Replace with:
**Spike E v2:** Piper vs MeloTTS A/B. See `docs/04-build/sprints/sprint-12/spike-e-results.md`. **VieNeu cancelled per F6 (2026-05-11) — no further evaluation planned.**

### Edit 8 — Evaluation roadmap row (around line 148)

Find:
| 4 | VieNeu evaluation | ⏳ DEFERRED | Blocked: GPU OOM + AI-Platform S118 |

Replace with:
| 4 | ~~VieNeu evaluation~~ | ❌ CANCELLED | F6 spike 2026-05-11: upstream amd64-only |

### Edit 9 — Code comments (around line 231-232)

Find:
        // VieNeu deferred S118:
        // { id: "vi-vineu-southern-male", status: "deferred", engine: "vineu" },

Replace with:
        // VieNeu CANCELLED 2026-05-11 per F6 — upstream amd64-only:
        // { id: "vi-vineu-southern-male", status: "cancelled", engine: "vineu" },

### Edit 10 — VRAM table (around line 280)

Find:
| **VieNeu-TTS** | **~2-4GB** | **GPU-preferred**; **DEFERRED S118** |

Replace with:
| ~~VieNeu-TTS~~ | ~~~2-4GB~~ | ❌ **CANCELLED 2026-05-11** — not viable on Mac Mini (upstream amd64-only) |

### Edit 11 — Model mount path (around line 322)

Find:
| VieNeu | `/opt/nqh/vineu-tts-v2-turbo/` | `/models/vineu-tts-v2-turbo/` | Model weights |

Strike through entire row with HTML or leave as historical reference. Recommended:
| ~~VieNeu~~ | ~~`/opt/nqh/vineu-tts-v2-turbo/`~~ | ~~`/models/vineu-tts-v2-turbo/`~~ | **Cancelled — model not deployed; cleanup ticket if any residue** |

### Edit 12 — SQL seed comment (around line 347-348)

Find:
-- VieNeu (deferred — registry residue only)
-- INSERT INTO voice.tts_voices (...) VALUES ('vi-vineu-southern-male', ...);

Replace with:
-- VieNeu CANCELLED 2026-05-11 per F6 spike — DO NOT INSERT
-- INSERT INTO voice.tts_voices (...) VALUES ('vi-vineu-southern-male', ...);

## Architect review request

@architect — please review the 12 edits above. If approved, apply to canonical `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` and bump version to v5 with revision date 2026-05-11.

Do NOT change the deciders, scope, or core architecture (still: Piper primary, MeloTTS fallback, REST-only boundary). The change is **status only**: VieNeu DEFERRED → CANCELLED.

If you want a different word than "CANCELLED" (e.g. "ARCHIVED", "REMOVED", "NOT_SHIPPING"), specify and I'll redraft.
```

---

## 5. Definition of Done for this directive

- [ ] `sprint-13-plan.md` — 8 edits applied per §3 above
- [ ] `docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md` created with 12 proposed edits per §4
- [ ] Git commit grouping: ONE commit with message: `docs(pm): post-F6 sprint-13 plan update + ADR-007 draft proposal`
- [ ] Push to main
- [ ] Notify @architect via doc reference (no Slack — async)

---

## 6. Time budget

- sprint-13-plan.md edits: ~20 minutes (8 surgical edits with Edit tool)
- ADR-007 draft creation: ~20 minutes (one new file)
- Verification + commit + push: ~10 minutes
- **Total**: ~50 minutes

If a section can't be found at the line number indicated (file may have drifted), grep for the unique phrase in the "Find:" block and edit from there.

---

## 7. What this directive does NOT do

- Does NOT remove `aiplatform-voice-vieneu` from ADR-008 D6 registry — wait for AI-Platform CTO countersign 2026-05-15 EOD
- Does NOT remove VieNeu adapter code from AI-Platform repo — that's @aip-coder + @aip-architect call
- Does NOT change `vi-vineu-southern-male` voice ID handling in `app/api/voice/tts/route.js` — Track B allowlist already excludes it; route returns 400 for unknown voice IDs
- Does NOT initiate replacement engine search — WS-C C.3 likely resolves to "no replacement needed, keep 2-engine stack"; final call is AI-Platform CTO at WS-C gate
- Does NOT touch `roadmap.md` or any foundation docs — that's CPO/CEO turf

---

## 8. Stand-down note

After this directive completes:
- @pm reports `[CTO: docs updated per directive 2026-05-11; pending architect review]`
- Sprint 13 continues per remaining tasks (13.1 brand-text, 13.2 Track B already complete, 13.3 OmniVoice still license-blocked, 13.4 S118 closed, 13.5 ADR-007 runbook complete)
- Sprint 13 close target: still on track

Next CTO touchpoint: @architect approval of the ADR-007 draft, then merge to canonical ADR-007 v5.

---

*OGA @cto | post-F6 PM directive | 2026-05-11 | Kimi CLI executor on GPU server S1*
