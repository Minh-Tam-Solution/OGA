# OGA Studios Activation Plan — Sprint 6+ (MOP-Aligned)

**Status:** Pending CTO + CPO approval
**MOP Reference:** MOP Phase A Spec v3.1 (CEO approved 26/04/2026)
**ADR Reference:** ADR-004 (mflux/AI-Platform integration)

## Context

NQH Creative Studio (OGA) = **MOP Tier 1 (AI Generation) + Tier 2 (Creative UI)**. 4 studios showing "Coming Soon". Sprint 5 established Diffusers + MPS CPU offload. This plan synthesizes **4 independent reviews** (CTO, CPO, Reviewer, CTO Research) + **CEO modifications** + **MOP Phase A alignment**.

### MOP Alignment (new)
- OGA `server.py` = microservice on Mac Mini :8123 per ADR-004
- AI-Platform gateway (S1 :8120) routes to OGA via `image_models.yaml`
- OGA scope = **media generation ONLY** (no brand check, no DAM, no distribution)
- MOP Phase A kick-off: **05/05/2026** — OGA Sprint 6 syncs with MOP W2-W3
- Mac Mini M4 Pro **48GB** (CEO purchasing decision) = production target

### CEO Modifications Applied
1. Video cloud tab merged into Sprint 6 (not separate sprint — just a tab flip)
2. Each conditional sprint gets a **spike protocol**: 2 days max, 3-tier result
3. IP-Adapter moved out of Sprint 6 → Sprint 7
4. OGA positioned as MOP Tier 1+2, not standalone product

---

## Consensus Across All Reviews

| Point | All 4 Agree |
|-------|-------------|
| **Hot-swap is P0 prerequisite** | Must build unload/swap infra before any new studio |
| **Sequential, not parallel** | 1 developer, shared memory, incremental validation |
| **PM's "all Apache 2.0" is wrong** | RMBG-2.0 weights = CC BY-NC 4.0, InsightFace = NC risk |
| **Video local RAM unproven** | CogVideoX-2B needs spike before commit |
| **Cinema "simplest" is wrong** | AnimateDiff needs 3 components + unvalidated LoRA mapping |

---

## Pre-Sprint: License Matrix (CPO Mandate)

| Engine | Code | Weights | Commercial OK? | Action |
|--------|------|---------|---------------|--------|
| `rembg` + u2net | MIT | MIT | **YES** | Use for Marketing bg removal |
| ~~briaai/RMBG-2.0~~ | **Verify Bria repo** | **CC BY-NC 4.0** | **NO** | ~~Rejected by CPO — weights NC~~ |
| IP-Adapter | Apache 2.0 | Apache 2.0 | **YES** | Product placement (Sprint 7) |
| AnimateDiff-Lightning | Apache 2.0 | **VERIFY ByteDance** | TBD | Spike before Sprint 8 |
| CogVideoX-2B | Apache 2.0 | **VERIFY THUDM** | TBD | Cloud-first, local spike |
| LivePortrait code | MIT | MIT | **YES** | Code OK |
| LivePortrait detector | - | **InsightFace = NC risk** | **NO** | Swap detector before use |
| OpenMontage | **AGPLv3** | - | **REF ONLY** | Architecture reference, no code copy |
| agentic-video-editor | MIT | - | **YES** | Pattern reference |
| VideoLingo | Apache 2.0 | - | **YES** | Localization engine |
| VibeVoice | MIT | MIT | **YES** | Voice foundation |
| marketmenow | MIT | - | **YES** | Distribution layer |

---

## Sprint 6: Hot-Swap Infrastructure + Marketing Studio

### Rationale (all reviewers agree)
- Hot-swap = prerequisite for everything (CTO)
- Marketing = lowest RAM (~2GB), highest reuse, proves architecture (Reviewer)
- `rembg` MIT license = no legal risk (CPO)
- Immediate NQH business value (CPO)

### Tasks

**6.0 Pipeline Hot-Swap (P0)**

File: `local-server/server.py`

- State machine: `IDLE → LOADING → READY → GENERATING`
- `unload_pipeline()`: `del pipe` + `gc.collect()` + `torch.mps.empty_cache()`
- Separate `_swap_lock` from `_gen_lock` — no swap during generation, no generation during swap
- `POST /api/v1/swap-model` endpoint
- `model_type` field in `models.json`: `"diffusers"` | `"utility"` | `"custom"` | `"cloud-only"`
- **Gate**: MPS memory returns to baseline within 5s after unload

Reference: ZPix `swap_model()` (app.py:212-221) + `pipe_is_busy` flag

**6.1 RMBG Utility Endpoint**

Files: `local-server/server.py`, `local-server/requirements-mac.txt`

- `pip install rembg` (MIT, uses u2net — NOT briaai/RMBG-2.0)
- Note: `rembg[gpu]` targets CUDA ONNX; on Apple Silicon use CPU ONNX path (`pip install rembg`)
- `POST /api/v1/remove-bg`: base64 image → PNG with alpha channel
- Lightweight (~1-2GB), runs as utility alongside main pipeline (no hot-swap needed)
- Policy: cap utility RAM in `/api/health` metrics; no concurrent heavy gen + utility if exceeds budget

**6.2 Activate Marketing Tab**

Files: `components/StandaloneShell.js`, `packages/studio/src/muapi.js`

- Change `comingSoon: _isLocal` → `comingSoon: false` for Marketing tab
- Add `removeBackground()` to muapi.js
- MarketingStudio.jsx already has full UI — wire RMBG for bg removal
- Cloud Muapi stays for video ad generation (cloud-only feature initially)

**6.3 Activate Video Tab (Cloud-Only)** *(CEO mod: merged from Sprint 7)*

Files: `components/StandaloneShell.js`

- Change `comingSoon: _isLocal && !_wan2gpEnabled` → `comingSoon: false` for Video tab
- VideoStudio.jsx already has full cloud UI with Muapi.ai endpoints
- `generateVideo()`, `generateI2V()` already exist in `packages/studio/src/muapi.js`
- Just flip the tab flag — ~1 day work, ships alongside Marketing

**6.4 Tests**

- Hot-swap: load → unload → verify memory released → reload
- RMBG: accepts image, returns transparent PNG
- Studio switch: Image → Marketing → Image without OOM
- 45+ total tests

### Sprint 6 Acceptance Criteria

- [ ] `unload_pipeline()` releases MPS memory within 5s
- [ ] Studio tab switching works without server restart
- [ ] `POST /api/v1/remove-bg` returns transparent PNG
- [ ] Marketing Studio tab active and functional
- [ ] Video Studio tab active (cloud mode via Muapi)
- [ ] All existing Image Studio tests pass (0 regressions)
- [ ] `npm run build` — 0 errors
- [ ] 45+ tests pass

---

## Sprint 7: IP-Adapter + Cinema Studio (Conditional)

### Spike Protocol (2 days max — before sprint starts)
- **Target**: AnimateDiff-Lightning (ByteDance) via diffusers on MacBook 24GB
- **PASS (24GB)**: peak RAM < 9GB, latency < 60s, 512×512×16 frames → enable local both
- **PROD-ONLY**: peak RAM 9-20GB (OOM on 24GB, fits 48GB) → local on Mac Mini only
- **FAIL**: peak RAM > 30GB or crash → Cinema cloud-only, sprint pivots to Lip Sync
- **Owner**: @coder reports spike results before sprint planning
- **Also verify**: ByteDance license terms for commercial use

### Tasks (if spike passes)
- **7.1** IP-Adapter endpoint: `POST /api/v1/product-placement` (Apache 2.0, ~2-3GB)
  - Product image + scene prompt → product in new context
  - Utility mode, runs alongside RMBG (~4-5GB total)
- **7.2** AnimateDiff-Lightning via diffusers (4-step inference)
  - Map CinemaStudio.js camera/lens/focal UI → motion LoRA weights
  - Hot-swap between Image pipeline and AnimateDiff pipeline
- **7.3** Activate Cinema tab, wire to local pipeline
- Reference: OpenMontage cinema pipeline patterns (arch ref only — AGPL)

---

## Sprint 8: Lip Sync Studio (LivePortrait — Conditional)

### Spike Protocol (2 days max)
- **Target**: LivePortrait on MacBook 24GB with MPS
- **PASS (24GB)**: peak RAM < 8GB, latency < 30s for 5s video → enable local both
- **PROD-ONLY**: peak RAM 8-20GB → local on Mac Mini only
- **FAIL**: crash or license blocked → Lip Sync cloud-only
- **License gate**: InsightFace detector resolved before spike starts
  - Option A: swap to RetinaFace (MIT)
  - Option B: cloud-only for face detection

### Tasks (if spike + license pass)
- LivePortrait integration (non-diffusers, custom PyTorch)
- New `model_type: "custom"` loading path in server.py
- Audio + image → video endpoint
- VibeVoice TTS integration for voice input (MIT)

---

## Sprint 9: Video Local + Polish (Conditional)

### Spike Protocol (2 days max)
- **Target**: CogVideoX-2B via diffusers on MacBook 24GB
- **PASS (24GB)**: peak RAM < 10GB, 480p 4s video → enable local both
- **PROD-ONLY**: peak RAM 10-25GB (fits 48GB Mac Mini) → local on prod only
- **FAIL**: crash or > 30GB → Video stays cloud-only
- **Also verify**: THUDM license terms for commercial use

### Tasks (if spike passes)
- CogVideoX-2B added to `models.json` with hot-swap support
- VideoStudio.jsx gets local/cloud toggle (like Image Studio)
- Reference: OpenMontage provider scoring pattern (arch ref only)

---

## External Systems Integration

### AI-Platform (LLM Backend)
Local LLM inference uses NQH AI-Platform (separate infrastructure). Studios needing LLM
(prompt enhancement, content generation, agentic workflows) call AI-Platform API —
NOT embedded in OGA server.py. This keeps OGA focused on media generation only.

| Use Case | Consumer | AI-Platform Role |
|----------|----------|-----------------|
| Prompt enhancement | Image/Video/Cinema Studios | Rewrite user prompt for better generation |
| Ad copy generation | Marketing Studio | Generate ad scripts from product descriptions |
| Content optimization | Postiz integration | Optimize posts per platform |
| Agent workflows | Future agentic features | OpenMontage-style multi-step pipelines |

### Postiz (Distribution Layer — AGPL-3.0, self-hosted)

**What**: Open-source social media scheduling + publishing platform (34+ channels).
**Role**: NQH Creative Studio generates content → Postiz distributes to social platforms.
**License**: AGPL-3.0 — self-hosted OK, modifications must be open-sourced.

| Feature | NQH Studio Integration |
|---------|----------------------|
| 34+ social channels | Publish generated images/videos directly |
| Temporal scheduling | Schedule content campaigns |
| AI Copilot (Mastra) | Content optimization per channel (uses AI-Platform LLM) |
| REST API | `POST /v1/posts` with media from OGA |
| Team workspace | NQH marketing team collaboration |
| Analytics | Cross-platform engagement metrics |

**Integration point**: Marketing Studio → "Publish" button → Postiz API → 34+ channels.
Not Sprint 6 scope — Sprint 10+ after all studios active.

---

## Future: Post-Production + Voice + Distribution Layers

Not in Sprint 6-9 scope but architecturally planned:

### ASR Stack (always-resident, tiny RAM)

| Engine | Purpose | Size | RAM | License |
|--------|---------|------|-----|---------|
| **gipformer** | Vietnamese ASR (SOTA, #1 on 9/12 benchmarks) | 280MB ONNX | <1GB | MIT |
| **cohere_transcribe_rs** | Multilingual ASR (Rust, MLX Metal native) | 2.8GB | ~5.6GB | Apache 2.0 |
| VibeVoice-ASR | Long-form 60min+ (7B) | ~14GB | 14-16GB | MIT |

**Key insight**: gipformer (280MB) can be **always-resident** alongside Diffusers pipeline — no hot-swap needed. Real-time Vietnamese subtitle generation for all studio outputs.

### Post-Production + Distribution

| Layer | Engine | License | Sprint |
|-------|--------|---------|--------|
| Auto-edit | agentic-video-editor patterns | MIT | 10+ |
| Clip factory | openfang-auto-clip | MIT | 10+ |
| Localization | VideoLingo (translate + dub) | Apache 2.0 | 10+ |
| Voice TTS | VibeVoice-Realtime (300ms) + TTS (1.5B) | MIT | 10+ |
| Subtitles | gipformer (VI) + cohere_transcribe (multi) | MIT/Apache 2.0 | 10+ |
| Distribution | **Postiz** (34+ platforms, self-hosted) | AGPL-3.0 | 10+ |
| Distribution alt | marketmenow (6 platforms, lightweight) | MIT | 11+ |

### Reference Architecture Only (license restrictions)

| Repo | Use | License | Restriction |
|------|-----|---------|-------------|
| OpenMontage | Video/Cinema pipeline patterns, provider scoring | AGPLv3 | REF ONLY — no code copy |
| KrillinAI | Translation reference | GPLv3 | REF ONLY |

---

## Files to Modify (Sprint 6 Only)

| File | Change |
|------|--------|
| `local-server/server.py` | Hot-swap state machine, unload, swap endpoint, RMBG endpoint |
| `local-server/models.json` | Add `model_type` field, RMBG utility entry |
| `local-server/requirements-mac.txt` | Add `rembg` (CPU ONNX, not `rembg[gpu]`) |
| `components/StandaloneShell.js` | Activate Marketing + Video tabs |
| `packages/studio/src/muapi.js` | Add `removeBackground()` function |
| `tests/unit/hot-swap.test.mjs` | New: state machine + memory release tests |
| `tests/unit/rmbg.test.mjs` | New: RMBG endpoint tests |

---

## Verification (Sprint 6)

1. `source .venv/bin/activate && pip install rembg`  *(CPU ONNX on Apple Silicon, not rembg[gpu])*
2. `python local-server/server.py` — server starts, Image pipeline loads
3. Generate image via Image Studio → works
4. `curl -X POST /api/v1/swap-model -d '{"model":"rmbg"}'` → old pipeline unloaded
5. `curl /api/health` → `peak_ram_mb` shows memory released within 5s
6. Test RMBG: `curl -X POST /api/v1/remove-bg` → transparent PNG
7. Switch back to Image Studio → generate works (re-loaded pipeline)
8. Marketing Studio tab visible + RMBG functional in browser
9. Video Studio tab visible + cloud generation via Muapi works
10. `npm test` → 45+ pass
11. `npm run build` → 0 errors

## Final Sprint Map (CEO Approved)

| Sprint | Scope | Duration |
|--------|-------|----------|
| **6** | Hot-swap infra + RMBG + Marketing tab + Video cloud tab | 2 weeks |
| **7** | IP-Adapter + Cinema spike (2d) + Cinema Studio (conditional) | 2 weeks |
| **8** | Lip Sync (LivePortrait + RetinaFace MIT) | 2 weeks |
| **9** | CogVideoX local spike + Video local (conditional) + polish | 2 weeks |

**Total: 8 weeks → 4 studios active (mix local + cloud)**

---

## Hardware Strategy (CEO Decision)

| Environment | Hardware | Available RAM | Role |
|------------|----------|-------------|------|
| **Pilot/Dev** | MacBook M4 Pro 24GB | ~10GB | Development + validation |
| **Production** | Mac Mini M4 Pro 48GB | ~36-40GB | Deployment server (purchasing) |

### Spike Protocol: 3-Tier Result (not binary)

Each spike produces one of 3 outcomes:

| Result | Meaning | Action |
|--------|---------|--------|
| **PASS (24GB)** | Works on pilot hardware | Enable local on both pilot + prod |
| **PROD-ONLY** | OOM on 24GB but fits 48GB estimate | Enable local on prod only, cloud on pilot |
| **FAIL** | OOM even on 48GB estimate | Cloud-only, revisit when hardware available |

Example: CogVideoX-2B spike on 24GB → OOM at 16GB peak → but 48GB has 36GB available → **PROD-ONLY** → Video Studio local on Mac Mini, cloud fallback on MacBook.

### Production Architecture (48GB Mac Mini)

```
Mac Mini M4 Pro 48GB — Available: ~36-40GB

ALWAYS RESIDENT (~4-5GB)
├── gipformer Vietnamese ASR     280MB
├── RMBG (u2net)                 1.5GB
└── Server overhead              ~0.5GB

HOT-SWAP SLOT (~15-20GB available)
├── Image: Diffusers (4-6GB)
├── Video: CogVideoX-2B (12-16GB)
├── Cinema: AnimateDiff (8-12GB)
└── Lip Sync: LivePortrait (4-8GB)

LRU CACHE: keep 2 most-recent pipelines warm on 48GB
           (vs strict unload-before-load on 24GB)
```

### Sprint Plan: Unchanged for Sprint 6

Sprint 6 builds hot-swap on 24GB pilot — conservative, correct. 48GB production is bonus headroom, not dependency. Code that works on 24GB = guaranteed on 48GB.

---

## MOP Phase A Timeline Sync

| MOP Week | MOP Task | OGA Sprint 6 Task |
|----------|---------|-------------------|
| W1 (05/05) | Brand Rules Engine ADR + POC | — (no OGA dependency) |
| W2 (12/05) | Cloud API (fal.ai) + Mac Mini order | 6.0 Hot-swap infra + 6.1 RMBG |
| W3 (19/05) | Mac Mini deploy + mflux service skeleton | 6.2 Marketing tab + 6.3 Video cloud tab |
| W4 (26/05) | Approval workflow + delegation matrix | 6.4 Tests + sprint close |
| W5-W6 | ThơmBrand pilot live + Gate A | Sprint 7 spike + planning |

**Key dependency:** OGA server.py on Mac Mini :8123 must be ready by MOP W3 for AI-Platform routing test.

---

## MOP Scope Boundary (OGA vs MOP Tier 3-7)

| Concern | OGA Scope | MOP Scope (not OGA) |
|---------|----------|---------------------|
| Image/video generation | ✅ `server.py` endpoints | ❌ |
| Background removal | ✅ `/api/v1/remove-bg` | ❌ |
| Brand compliance check | ❌ | ✅ Tier 4 Brand Rules Engine |
| Asset storage | ❌ | ✅ Tier 3 Directus DAM |
| Approval workflow | ❌ | ✅ Tier 5 Dify + Telegram |
| Content distribution | ❌ | ✅ Tier 6 Postiz |
| Auth / rate limit | ❌ (PIN for dev) | ✅ AI-Platform X-API-Key |
| Cost attribution | ❌ | ✅ AI-Platform X-Provider-Used header |
| Analytics | ❌ | ✅ Tier 7 ClickHouse (Phase B) |

---

## CEO Pre-Execute Notes

1. **gipformer "always-resident"**: validate ONNX Runtime + PyTorch MPS concurrent compatibility before Sprint 10+. Not blocking Sprint 6.
2. **Sprint 7 thin if Cinema spike fails**: pull Lip Sync spike forward into Sprint 7 → deliver IP-Adapter + Lip Sync spike instead of IP-Adapter alone.
3. **ADR-004 compliance**: OGA server.py endpoint contract (`/v1/images/generations`, `/health`) already matches ADR-004 spec. No API changes needed for MOP integration.
