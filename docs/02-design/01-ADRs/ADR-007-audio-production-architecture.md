---
adr_id: ADR-007
title: "Audio Production Architecture — OGA as Consumer of AI-Platform Voice Services"
status: "ACCEPTED — VieNeu CANCELLED per F6 spike 2026-05-11; production stack = Piper primary + MeloTTS fallback"
date: 2026-05-12
revised: "v5 2026-05-12 — VieNeu status flip DEFERRED → CANCELLED across all sections"
deciders: ["@cto", "@architect", "@cpo"]
gate: G2 (post-spike)
cpo_cosign: "2026-05-10"
cto_cosign: "2026-05-10"
references:
  - docs/01-planning/external-repo-assessment-2026-05-06.md
  - docs/08-collaborate/CTO-REVIEW-external-repo-assessment-2026-05-09.md
  - ADR-003 (Hot-Swap Architecture)
  - ADR-004 (AI-Platform Integration — Layer 4 Consumer Contract)
  - ADR-090 (AI-Platform Voice Service Extraction — canonical spec)
  - spike-report-indexTTS.md (Spike 11.0b — DEFERRED)
  - spike-report-melotts-vn.md (Spike 11.0c — PASSED)
  - spike-e-results.md (Spike 12.0e — Piper vs MeloTTS A/B pending Hùng)
---

# ADR-007: Audio Production Architecture — OGA as Consumer of AI-Platform Voice Services

## Status

**Proposed — ALL TTS ROUTED VIA AI-PLATFORM. OGA HOSTS NO AUDIO ENGINE.**

G2 ready to open upon:
- Spike E v2 (Piper vs MeloTTS Hùng A/B) PASS
- AI-Platform S118 image rebuild (MeloTTS persistence)
- CTO final legal tick on AI-Platform contract registry update

| Path | Preconditions | Status |
|------|--------------|--------|
| Piper Vietnamese (primary) | End-to-end verified 2026-05-10 | ✅ **READY** |
| MeloTTS Vietnamese (fallback) | Adapter + registry seeded; image non-persistent | ✅ **READY** (S118 rebuild required for persistence) |
| VieNeu Vietnamese (default) | F6 spike 2026-05-11: upstream `pnnbao/vieneu-tts:serve` amd64-only, no Apple Silicon → cannot reach Mac Mini production | ❌ **CANCELLED** |
| IndexTTS2 English | 3/4 pass + VN FAIL | ⏳ **DEFERRED** |

---

## Context

OGA has LipSync Studio (image/video + audio → lip-synced video) but lacks TTS/voice generation. User story US-TTS-LIPSYNC (Sprint 8, Could Have) identifies the need for text-to-speech as input to lip-sync.

**Architectural reframe (CTO-mandated, 2026-05-06):** OGA does NOT host any audio engine. All TTS, STT, and voice cloning execution happens in **AI-Platform Layer 4** (`services/voice/`). OGA is a pure consumer via the AI-Platform gateway at `/api/v1/voice/*`.

This ADR governs OGA's **consumer contract** with AI-Platform voice services. For canonical voice-service internals (adapters, registry, orchestrator), see **ADR-090** in the AI-Platform repository.

---

## Decision

### D1: OGA hosts NO audio engine

OGA does not install, run, or import any TTS model. All audio synthesis flows through:

```
OGA Frontend/Backend (Next.js)
  └── OGA Proxy Route (/api/voice/tts)
      └── AI-Platform Gateway (:8120)
          └── POST /api/v1/voice/tts/synthesize
              └── AI-Platform Voice Service (:8121)
                  ├── TTS Orchestrator (tts_service.py)
                  │   ├── Voice registry lookup (voice.tts_voices)
                  │   ├── Adapter routing (piper | melotts) — vineu removed post-F6
                  │   ├── Text normalization (vn_text_normalizer)
                  │   ├── Watermark embed (AudioSeal)
                  │   ├── MinIO upload + presigned URL
                  │   └── Audit log (voice.tts_jobs)
                  └── Returns: {audio_url, duration_ms, engine, voice_id, ...}
```

**Boundary rule:** No Python import of `melo`, `piper`, or any TTS library into OGA's Next.js process. REST only. (VieNeu cancelled post-F6 — no longer in scope.)

### D2: Voice Routing Strategy

| Use Case | Language | Default Voice | Engine | Fallback Chain |
|----------|----------|---------------|--------|----------------|
| Vietnamese content | `vi` | `vi-piper-vais1000` | piper | melotts → error |
| Vietnamese (CPU-only) | `vi` | `vi-melotts-default` | melotts | piper |
| English content | `en` | `en-piper-libritts-f` | piper | `en-piper-libritts-m` |
| Code-switch vi-en | `vi-en` | `vi-piper-vais1000` | piper | — |

> **2026-05-10 update:** VieNeu (`vi-vineu-southern-male`) removed from default chain. Adapter deferred S118; registry rows are residue only. Piper promoted to primary VN voice pending Spike E v2 Hùng sign-off.
>
> **2026-05-11 update:** F6 MPS compatibility spike on CEO M4 Pro 24G returned **FAIL** in 10 minutes — upstream `pnnbao/vieneu-tts:serve` ships `linux/amd64` only with no `arm64` manifest. VieNeu **cannot** reach the Mac Mini M4 Pro 48G production target. Status moves from DEFERRED → **CANCELLED**. 2-engine stack (Piper primary, MeloTTS fallback) is the ratified production configuration. See `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md` and `docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md`.

**Selection logic:**
1. Caller explicitly provides `voice_id` → registry resolves engine
2. No `voice_id` + `language="vi"` → `tts_default_voice_vi` = `vi-piper-vais1000`
3. Piper unavailable (503) → auto-fallback to `vi-melotts-default` via client wrapper
4. MeloTTS unavailable → propagate 503 to user (no further fallback)

### D3: Piper vs MeloTTS — Production Voice Routing

**Current truth (2026-05-10, post-re-test):**
- **Piper** = primary production voice (`vi-piper-vais1000`, `vi-piper-central`). End-to-end verified. Low latency (~330ms), 22050Hz.
- **MeloTTS** = fallback voice (`vi-melotts-default`). **NOW CALLABLE** via gateway (200 OK confirmed). Higher latency (~3.2s first inference), 44100Hz. Container changes (melo VN package + deps) are **non-persistent** — must be baked into image by AI-Platform PJM before S118 close.
- **VieNeu** = cancelled post-F6; registry rows scheduled for removal pending AI-Platform CTO countersign (2026-05-15 EOD)

| Criterion | Piper | MeloTTS |
|-----------|-------|---------|
| **Quality** | Neutral/robotic | Natural, Hùng 5/5 accepted |
| **License** | MIT ✅ | MIT ✅ |
| **Voice cloning** | ❌ No | ❌ No |
| **vi-en code-switch** | ❌ No | ❌ No |
| **GPU required** | No (ONNX CPU) | No (CPU-only) |
| **VRAM** | 0 GB | 0 GB |
| **Latency (first)** | ~330ms | ~3.2s |
| **Sample rate** | 22050Hz | 44100Hz |
| **Multi-speaker** | ❌ Preset only | ❌ Preset only |
| **Registry status** | ✅ Seeded, callable | ✅ **Seeded, callable** (done 2026-05-10) |
| **Image persistence** | ✅ Baked in | ⚠️ Container-only (S118 image rebuild required) |

**Rule (Track B consumer code):**
- **Default production traffic** → Piper (`vi-piper-vais1000`)
- **MeloTTS fallback** → Auto-fallback on `voice_not_found` or 503 via `aiPlatformVoiceClient`
- ~~**VieNeu future** → Evaluate when S118 adapter fix lands + GPU available~~ — **CANCELLED 2026-05-11 per F6.** Re-evaluation only possible if upstream ships arm64 build (request issued to maintainer `pnnbao` with 14-day window).

**Defect #20 (MinIO presigned URL):** `audio_url` returns internal DNS (`ai-platform-minio:9000`). Host-level fetch fails. Workarounds:
1. Fetch audio from inside `ai-net` / `ai-platform_ai-platform-network` container
2. Gateway streaming proxy (S118(p) fix)
3. Host `/etc/hosts` override + port 9020 (signature may still mismatch)

**Spike E v2:** Piper vs MeloTTS A/B. See `docs/04-build/sprints/sprint-12/spike-e-results.md`. **VieNeu cancelled per F6 (2026-05-11) — no further evaluation planned.**

---

## Preconditions

### Spike 11.0c — MeloTTS Vietnamese (COMPLETE)

| # | Precondition | Status | Date |
|---|-------------|--------|------|
| 1 | License chain audit — MIT + deps permissive | ✅ PASS | 2026-05-06 |
| 2 | Voice-clone verification — preset only | ✅ PASS | 2026-05-06 |
| 3 | Architecture — AI-Platform adapter | ✅ PASS | 2026-05-06 |
| 4 | Smoke test — 5 VN samples valid | ✅ PASS | 2026-05-06 |
| 5 | Performance — RTF 0.168, ~760MB | ✅ PASS | 2026-05-06 |
| 6 | VN Quality — Hùng 5/5 acceptable | ✅ PASS | 2026-05-06 |

### Spike 12.0e — Piper vs MeloTTS Quality Validation (IN PROGRESS)

| # | Precondition | Status | Date |
|---|-------------|--------|------|
| 1 | MeloTTS baseline samples (5/5 valid WAV) | ✅ DONE | 2026-05-06 |
| 2 | Piper samples via AI-Platform gateway (5/5 valid WAV) | ✅ DONE | 2026-05-10 |
| 3 | Hùng blind A/B Piper vs MeloTTS | ⏳ PENDING | TBD |
| 4 | ~~VieNeu evaluation~~ | ❌ CANCELLED | F6 spike 2026-05-11: upstream amd64-only |

**Spike E v2 disposition gates:**
- Piper mean ≥ MeloTTS mean → confirm Piper as production voice
- Piper = MeloTTS (within 10%) → keep Piper (integration + stability tiebreakers)
- Piper < MeloTTS by >10% → flip primary to MeloTTS; Piper becomes emergency fallback

### Spike 12.0a — OmniVoice (ON HOLD)

| # | Precondition | Status |
|---|-------------|--------|
| 1 | License verification — Apache 2.0 | ✅ PRELIMINARY PASS |
| 2 | CTO reconciliation with prior removal | ⏳ BLOCKED |
| 3 | 5-sample smoke + Hùng review | ⏳ HOLD until unblocked |

---

## OGA-Side Integration Spec

### API Client Wrapper

**Landed 2026-05-10:** `src/lib/aiPlatformVoiceClient.js` — production JS client.

```javascript
import { AIPlatformVoiceClient } from '@/src/lib/aiPlatformVoiceClient';

const client = new AIPlatformVoiceClient({
    baseUrl: process.env.AIP_GATEWAY_URL,
    apiKey: process.env.AIP_VOICE_API_KEY,
});

// Primary: Piper; Fallback: MeloTTS (auto)
const result = await client.synthesize("Xin chào quý khách.", {
    language: "vi",
    voice_id: "vi-piper-vais1000",  // optional — defaults per language
    format: "wav",
    autoFallback: true,
});
// → { audio_url, duration_ms, engine, voice_id, job_id, watermark_key }
```

**Key design:**
- Server-side only — API key never reaches browser
- Auto-fallback: Piper → MeloTTS on `voice_not_found` or 503
- Presigned URL fetch: container-level (defect #20 workaround)

### Proxy Route

**Landed 2026-05-10:** `app/api/voice/tts/route.js` — Next.js API route.

```
POST /api/voice/tts
Body: { text, language?, voice_id?, format? }
→ Proxies to AI-Platform gateway with X-API-Key header
→ Returns JSON with audio_url, duration_ms, engine, voice_id
```

### Retry Policy

| Failure Mode | Retry | Backoff | Fallback |
|-------------|-------|---------|----------|
| HTTP 503 (service busy) | 1 retry | 1s | MeloTTS voice swap |
| HTTP 502/504 (gateway timeout) | 2 retries | 1s, 2s | Propagate 504 |
| HTTP 400 (validation error) | No retry | — | Return 400 to caller |
| HTTP 404 (voice not found) | 1 retry | — | Swap to fallback voice |
| Connection error | 2 retries | 2s, 4s | Log alert |

### Timeout

- **Connect timeout:** 5s
- **Read timeout:** 30s (TTS synthesis for 30s audio)
- **Total timeout:** 35s

### Voice Parameter Validation

OGA validates `voice_id` against allowlist before calling AI-Platform:

```javascript
const VALID_VOICES = {
    vi: [
        { id: "vi-piper-vais1000", status: "primary", engine: "piper" },
        { id: "vi-piper-central", status: "alternate", engine: "piper" },
        { id: "vi-melotts-default", status: "fallback", engine: "melotts" },
        // VieNeu CANCELLED 2026-05-11 per F6 — upstream amd64-only:
        // { id: "vi-vineu-southern-male", status: "cancelled", engine: "vineu" },
    ],
    en: [
        { id: "en-piper-libritts-f", status: "primary", engine: "piper" },
        { id: "en-piper-libritts-m", status: "alternate", engine: "piper" },
    ],
};
```

Invalid `voice_id` → HTTP 400 before AI-Platform call (fail-fast).

---

## Revoked from Prior CTO Sign-Off (2026-05-09)

The following deliverables from ADR-007 v1/v2 are **REVOKED** and no longer applicable:

| Item | Status | Reason |
|------|--------|--------|
| Port 8002 spec (MeloTTS standalone) | ❌ REVOKED | Not standalone — AI-Platform adapter |
| `systemd oga-melotts.service` unit | ❌ REVOKED | Single `ai-platform-voice.service` only |
| S1 installation procedure for MeloTTS | ❌ REVOKED | Model mount only; no separate install |
| `requirements.txt` pinning at OGA level | ❌ REVOKED | TTS deps live in AI-Platform venv only |
| `HF_TOKEN` env injection at OGA level | ❌ REVOKED | AI-Platform handles model auth |

---

## Retained from Prior CTO Sign-Off

| Item | Status | Location |
|------|--------|----------|
| MeloTTS license chain audit | ✅ RETAINED | Spike 11.0c report |
| MeloTTS VN quality: Hùng 5/5 PASS | ✅ RETAINED | Spike 11.0c report |
| Voice-clone discrepancy resolved | ✅ RETAINED | Spike 11.0c report |
| IndexTTS2 VRAM arbiter spec | ✅ RETAINED | `docs/04-build/sprints/sprint-11/vram-arbiter-spec.md` — applies if IndexTTS2 EN path reactivated |
| VRAM RULE-001 | ✅ RETAINED | Applies to GPU TTS on AI-Platform side |

---

## VRAM Budget & Scheduling

GPU Server S1: RTX 5090 32GB

| Service | VRAM Claim | Notes |
|---------|-----------|-------|
| OGA Video (Wan2.1) | ~11 GB | Hot-swapped, idle-unload after 300s |
| OGA Video (LTX) | ~9 GB | Hot-swapped, idle-unload after 300s |
| OGA Video (CogVideoX) | ~14 GB | Monopolizes GPU; unload before any TTS |
| ~~VieNeu-TTS~~ | ~~~2-4GB~~ | ❌ **CANCELLED 2026-05-11** — not viable on Mac Mini (upstream amd64-only) |
| **MeloTTS Vietnamese** | **0 GB** | **CPU-only** — no VRAM conflict |
| **Piper TTS** | **0 GB** | **CPU-only (ONNX)** |
| **IndexTTS2** | **~5.3 GB idle, ~21.5 GB peak** | **DEFERRED** — EN-only future path |
| OmniVoice | TBD (est. 4-8GB) | **ON HOLD** — Spike F if unblocked |

**AI-Platform GPU admission control** (`should_admit_request()` in `gpu_budget.py`) handles scheduling. OGA does not manage VRAM directly.

---

## Data Flow: TTS → LipSync

```
User in Voice Studio
  └── Script "Bia tươi NQH..." → OGA calls /api/voice/tts (proxy route)
      └── AI-Platform /api/v1/voice/tts/synthesize
          └── Receive presigned audio URL (WAV/MP3)
              └── Click "Use in LipSync"
                  └── OGA downloads audio (container-level fetch, defect #20)
                      └── Pass to LipSync Studio as audio input
                          └── User uploads portrait → LipSync generates MP4
```

No intermediate file management by user; OGA handles blob URLs / temp paths.

---

## Deployment Spec

### AI-Platform Voice Service (Single Service, All Adapters)

```
Internal endpoint:  AI-Platform voice service @ :8121 (via gateway :8120)
Gateway proxy:      /api/v1/voice/tts/* → voice-service:8121/v1/tts/*
Systemd:            ai-platform-voice.service
Docker Compose:     bflow-ai-platform-voice (part of AI-Platform stack)
```

### Model Mounts (Host → Container)

| Engine | Host Path | Container Path | Files |
|--------|-----------|----------------|-------|
| ~~VieNeu~~ | ~~`/opt/nqh/vineu-tts-v2-turbo/`~~ | ~~`/models/vineu-tts-v2-turbo/`~~ | **Cancelled — model not deployed; cleanup ticket if any residue** |
| MeloTTS | `/opt/nqh/melotts-vn/models/` | `/models/melotts-vietnamese/` | `config.json`, `G_463000.pth` |
| Piper | `/opt/nqh/piper-voices/` | `/models/piper-voices/` | `.onnx`, `.onnx.json` |

### DB Seed (voice.tts_voices)

```sql
-- Piper (primary Vietnamese)
INSERT INTO voice.tts_voices (
    voice_id, display_name, engine, language, gender, sample_rate,
    source_provenance, review_status, default_for_use_case, allowed_app_ids
) VALUES (
    'vi-piper-vais1000', 'Piper Vietnamese (VAIS1000 Female)', 'piper', 'vi',
    'female', 22050, 'preset', 'active', '{"vi-tts-primary"}', '{"oga-studio","mop-app"}'
);

-- MeloTTS (fallback Vietnamese)
INSERT INTO voice.tts_voices (
    voice_id, display_name, engine, language, gender, sample_rate,
    source_provenance, review_status, default_for_use_case, allowed_app_ids
) VALUES (
    'vi-melotts-default', 'MeloTTS Vietnamese (Default)', 'melotts', 'vi',
    null, 44100, 'preset', 'active', '{}', '{"oga-studio","mop-app"}'
);

-- VieNeu CANCELLED 2026-05-11 per F6 spike — DO NOT INSERT
-- INSERT INTO voice.tts_voices (...) VALUES ('vi-vineu-southern-male', ...);
-- NOTE: Requires ALTER TABLE voice.tts_voices DROP CONSTRAINT ck_tts_voices_engine;
--       Then ADD CONSTRAINT with 'melotts' in allowed array.
```

> **2026-05-10:** `vi-melotts-default` seeded successfully. Constraint `ck_tts_voices_engine` modified to include `'melotts'`. This change is **DB-only** and persists across container recreates. However, the `melo` Python package in the container is a manual hot-patch — will revert to upstream (no VI support) if image is rebuilt without PJM ticket S118 changes.

---

## Consequences

### Positive
- **Single authority:** AI-Platform owns all voice engines — no drift between OGA and MOP
- **Clean boundary:** OGA is pure consumer; TTS expertise stays in AI-Platform
- **CPU fallback:** MeloTTS guarantees TTS works even when GPU is saturated
- **License isolation:** GPL `unidecode` contained inside AI-Platform; OGA never imports it
- **Scalability:** New engines (OmniVoice, etc.) plug into AI-Platform without OGA code changes

### Negative
- **Network dependency:** OGA TTS requires AI-Platform to be up (mitigated by caching + fallback)
- **Latency overhead:** HTTP round-trip vs local inference (~10-50ms, negligible vs synthesis time)
- **Ops coordination:** AI-Platform deploys affect OGA voice features
- **MeloTTS image fragility:** If container is recreated before S118 image rebuild, MeloTTS reverts to broken state → fallback chain breaks
- **MinIO presigned URL hostname mismatch (defect #20):** Audio fetch requires container-level proxy or DNS override
- **Initials/abbreviation pronunciation limitation (Spike E v2 CEO preview):** Latin initials (e.g., "NQH") are not clearly pronounced by either Piper (espeak-ng) or MeloTTS (underthesea). General Vietnamese text and brand descriptions ("bia tươi hương vị đậm đà") are acceptable. Workaround: script writers spell out initials in text input ("N Q H" or full name) instead of abbreviations. Custom lexicon deferred to post-Hùng follow-up if needed.

---

## Alternatives Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| **TTS engine inside OGA** | ❌ Rejected | Violates AI-Platform-first architecture; GPL contamination risk |
| **Standalone MeloTTS on S1:8002** | ❌ Rejected (v1/v2) | CTO revoked — redundant with AI-Platform adapter pattern |
| **ElevenLabs API** | ❌ Rejected | Cloud, $0.30/min, violates zero-cost mandate |
| **Cloud fallback as default** | ❌ Rejected | CPO: emergency/manual override only |
| **Fine-tune MeloTTS** | ⏳ Deferred | Sprint 13+ if OmniVoice also fails to surpass MeloTTS |

---

## References

- **ADR-004** — AI-Platform Integration (Layer 4 Consumer Contract)
- **ADR-090** — AI-Platform Voice Service Extraction (canonical spec, lives in AI-Platform repo)
- **Spike 11.0c** — MeloTTS Vietnamese Evaluation (`docs/04-build/sprints/sprint-11/spike-report-melotts-vn.md`)
- **Spike 12.0e** — Piper vs MeloTTS A/B (`docs/04-build/sprints/sprint-12/spike-e-results.md`)
- **Spike 12.0a** — OmniVoice Plan (`docs/04-build/sprints/sprint-12/spike-omnivoice-vn-plan.md`)
- **AI-Platform adapter code:** `services/voice/app/services/tts/adapters/melotts_adapter.py`
- **PJM Ticket S118:** `AI-Platform/audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md`
- **OGA consumer wrapper:** `src/lib/aiPlatformVoiceClient.js`
- **OGA proxy route:** `app/api/voice/tts/route.js`

---

*ADR-007 v5 | 2026-05-12 | VieNeu CANCELLED per F6; production = Piper + MeloTTS | Supersedes v4*
>
> **Final Note (G2 promotion):**
> - Spike E v2 reviewers (both PASS): CEO Tai Dang + Hùng (Marketing Manager)
> - Production primary voice: `vi-piper-vais1000` (Piper VAIS1000)
> - Fallback voice: `vi-melotts-default` (MeloTTS Vietnamese)
> - Architecture: OGA → AI-Platform `/api/v1/voice/tts` (REST consumer boundary)
> - License posture: clean (microservice REST boundary contains GPL unidecode)
> - G2 unlocked: 2026-05-10
> - Outstanding (non-blocking): brand-initials caveat; AI-Platform S118 image rebuild; OOM stability
