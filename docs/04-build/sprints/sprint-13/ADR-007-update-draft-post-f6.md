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
```
| VieNeu Vietnamese (default) | Adapter deferred S118; GPU OOM upstream | ⏳ **DEFERRED** |
```

Replace with:
```
| VieNeu Vietnamese (default) | F6 spike 2026-05-11: upstream `pnnbao/vieneu-tts:serve` amd64-only, no Apple Silicon → cannot reach Mac Mini production | ❌ **CANCELLED** |
```

### Edit 2 — Architecture diagram comment (around line 66)

Find:
```
│   ├── Adapter routing (melotts | piper | vineu)
```

Replace with:
```
│   ├── Adapter routing (piper | melotts) — vineu removed post-F6
```

### Edit 3 — Boundary rule (around line 74)

Find:
```
**Boundary rule:** No Python import of `melo`, `piper`, `vineu`, or any TTS library into OGA's Next.js process. REST only.
```

Replace with:
```
**Boundary rule:** No Python import of `melo`, `piper`, or any TTS library into OGA's Next.js process. REST only. (VieNeu cancelled post-F6 — no longer in scope.)
```

### Edit 4 — 2026-05-10 update note (around line 85)

Find:
```
> **2026-05-10 update:** VieNeu (`vi-vineu-southern-male`) removed from default chain. Adapter deferred S118; registry rows are residue only. Piper promoted to primary VN voice pending Spike E v2 Hùng sign-off.
```

Append (do not replace) immediately after that block:
```
> **2026-05-11 update:** F6 MPS compatibility spike on CEO M4 Pro 24G returned **FAIL** in 10 minutes — upstream `pnnbao/vieneu-tts:serve` ships `linux/amd64` only with no `arm64` manifest. VieNeu **cannot** reach the Mac Mini M4 Pro 48G production target. Status moves from DEFERRED → **CANCELLED**. 2-engine stack (Piper primary, MeloTTS fallback) is the ratified production configuration. See `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md` and `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md`.
```

### Edit 5 — Routing decision (around line 98)

Find:
```
- **VieNeu** = adapter deferred S118; registry rows are residue → returns 503 if called
```

Replace with:
```
- **VieNeu** = cancelled post-F6; registry rows scheduled for removal pending AI-Platform CTO countersign (2026-05-15 EOD)
```

### Edit 6 — Future evaluation entry (around line 117)

Find:
```
- **VieNeu future** → Evaluate when S118 adapter fix lands + GPU available (ollama must be stopped)
```

Replace with:
```
- ~~**VieNeu future** → Evaluate when S118 adapter fix lands + GPU available~~ — **CANCELLED 2026-05-11 per F6.** Re-evaluation only possible if upstream ships arm64 build (request issued to maintainer `pnnbao` with 14-day window).
```

### Edit 7 — Spike reference (around line 124)

Find:
```
**Spike E v2:** Piper vs MeloTTS A/B. See `docs/04-build/sprints/sprint-12/spike-e-results.md`. VieNeu unavailable → deferred evaluation.
```

Replace with:
```
**Spike E v2:** Piper vs MeloTTS A/B. See `docs/04-build/sprints/sprint-12/spike-e-results.md`. **VieNeu cancelled per F6 (2026-05-11) — no further evaluation planned.**
```

### Edit 8 — Evaluation roadmap row (around line 148)

Find:
```
| 4 | VieNeu evaluation | ⏳ DEFERRED | Blocked: GPU OOM + AI-Platform S118 |
```

Replace with:
```
| 4 | ~~VieNeu evaluation~~ | ❌ CANCELLED | F6 spike 2026-05-11: upstream amd64-only |
```

### Edit 9 — Code comments (around line 231-232)

Find:
```
        // VieNeu deferred S118:
        // { id: "vi-vineu-southern-male", status: "deferred", engine: "vineu" },
```

Replace with:
```
        // VieNeu CANCELLED 2026-05-11 per F6 — upstream amd64-only:
        // { id: "vi-vineu-southern-male", status: "cancelled", engine: "vineu" },
```

### Edit 10 — VRAM table (around line 280)

Find:
```
| **VieNeu-TTS** | **~2-4GB** | **GPU-preferred**; **DEFERRED S118** |
```

Replace with:
```
| ~~VieNeu-TTS~~ | ~~~2-4GB~~ | ❌ **CANCELLED 2026-05-11** — not viable on Mac Mini (upstream amd64-only) |
```

### Edit 11 — Model mount path (around line 322)

Find:
```
| VieNeu | `/opt/nqh/vineu-tts-v2-turbo/` | `/models/vineu-tts-v2-turbo/` | Model weights |
```

Strike through entire row with HTML or leave as historical reference. Recommended:
```
| ~~VieNeu~~ | ~~`/opt/nqh/vineu-tts-v2-turbo/`~~ | ~~`/models/vineu-tts-v2-turbo/`~~ | **Cancelled — model not deployed; cleanup ticket if any residue** |
```

### Edit 12 — SQL seed comment (around line 347-348)

Find:
```
-- VieNeu (deferred — registry residue only)
-- INSERT INTO voice.tts_voices (...) VALUES ('vi-vineu-southern-male', ...);
```

Replace with:
```
-- VieNeu CANCELLED 2026-05-11 per F6 spike — DO NOT INSERT
-- INSERT INTO voice.tts_voices (...) VALUES ('vi-vineu-southern-male', ...);
```

## Architect review request

@architect — please review the 12 edits above. If approved, apply to canonical `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` and bump version to v5 with revision date 2026-05-11.

Do NOT change the deciders, scope, or core architecture (still: Piper primary, MeloTTS fallback, REST-only boundary). The change is **status only**: VieNeu DEFERRED → CANCELLED.

If you want a different word than "CANCELLED" (e.g. "ARCHIVED", "REMOVED", "NOT_SHIPPING"), specify and I'll redraft.
