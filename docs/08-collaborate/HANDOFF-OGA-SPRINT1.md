# OGA Sprint 1 — Handoff Document for Team OGA

**Date:** 2026-04-26
**From:** CEO (Tai Dang) via EndiorBot session
**To:** Team OGA (IT Admin dvhiep + assigned developers)
**Remote repo:** https://github.com/Minh-Tam-Solution/OGA

---

## 1. Project Overview

**NQH Creative Studio (OGA)** — Internal AI creative studio for NQH/MTS employees. Self-hosted image generation via Apple Silicon MLX, zero per-image cost.

**Upstream fork:** [Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) — Next.js 15 app with 7 studio tabs (Image, Video, LipSync, Cinema, Marketing, Workflows, Agents). Currently depends on Muapi.ai cloud API.

**Our goal:** Decouple from Muapi.ai, self-host image gen on Mac mini M4 Pro 24GB using mflux (MLX-native Flux Schnell).

---

## 2. Current State (POC Complete)

### What's proven
- Flux Schnell chạy local via mflux v0.17.5 + 8-bit quantize: **34-49s/image @ 512×512**
- Custom FastAPI server (`local-server/server.py`) wraps mflux CLI
- OpenAI-compatible + Muapi-compatible API endpoints
- CORS enabled, health check, fake balance endpoint
- Frontend patched: `src/lib/muapi.js` reads `localStorage.local_server_url`
- Middleware patched: `LOCAL_API_URL` env var routes `/api/v1/*` to local server

### What's NOT done (Sprint 1 scope)
- [ ] Rebrand UI → "NQH Creative Studio"
- [ ] Provider abstraction (`src/lib/providerConfig.js`)
- [ ] Model dropdown filtered to local-only
- [ ] Video/LipSync/Cinema tabs → "Coming Soon"
- [ ] Workflows/Agents tabs hidden
- [ ] `.env.local` template
- [ ] Push to github.com/Minh-Tam-Solution/OGA

---

## 3. Architecture

```
[Browser — NQH/MTS Employee]
        │
        ▼
[Next.js 15 — port 3000]
        │
        ├── middleware.js → proxy /api/v1/* → LOCAL_API_URL
        │
        └── src/components/ImageStudio.js → muapi.generateImage()
                  │
                  ▼
        [local-server/server.py — FastAPI, port 8000]
                  │
                  ▼
        [mflux-generate CLI — MLX, Apple Silicon]
                  │
                  ▼
        [PNG base64 response]
```

### Key files

| File | Purpose | Status |
|------|---------|--------|
| `local-server/server.py` | FastAPI wrapper for mflux | POC done |
| `src/lib/muapi.js` | API client (class, 527 lines) | Partially patched (localStorage check) |
| `packages/studio/src/muapi.js` | Studio package API client (functions, 580 lines) | Partially patched (BASE_URL) |
| `middleware.js` | Next.js proxy routing | Patched (LOCAL_API_URL env) |
| `src/components/ImageStudio.js` | Image generation UI (1,318 lines) | Needs model filter |
| `src/components/AuthModal.js` | API key gate | Patched (bypass in local mode) |
| `components/StandaloneShell.js` | App shell, tabs, branding (350 lines) | Needs rebrand |

---

## 4. Sprint 1 Tasks

Full plan: `docs/04-build/sprints/sprint-1-plan.md`

| Task | Description | Effort | Dependencies |
|------|-------------|--------|-------------|
| 1.1 | Fork → github.com/Minh-Tam-Solution/OGA, update package.json | 30min | — |
| 1.2 | Rebrand UI: Header → "NQH Creative Studio", title, favicon | 1h | 1.1 |
| 1.3 | Create `src/lib/providerConfig.js` — centralized provider abstraction | 2h | 1.1 |
| 1.4 | Image Studio local mode: skip auth, filter models to Flux Schnell only | 3h | 1.3 |
| 1.5 | Tab visibility: Video/LipSync/Cinema → "Coming Soon"; Workflows/Agents → hidden | 1h | 1.1 |
| 1.6 | Integration test: local server → generate image end-to-end | 1h | 1.4 |
| 1.7 | Docs: `.env.local.example`, README with local setup instructions | 30min | 1.6 |

---

## 5. SDLC Documentation (Already Created)

EndiorBot `compliance fix` generated these artifacts:

| Stage | File | Content |
|-------|------|---------|
| 00-foundation | `docs/00-foundation/problem-statement.md` | Pain points, codebase evidence, stakeholders |
| 00-foundation | `docs/00-foundation/business-case.md` | Cloud vs self-hosted, 12/24-month savings |
| 01-planning | `docs/01-planning/requirements.md` | 15 FRs, 10 NFRs, 8 BDD scenarios |
| 02-design | `docs/02-design/01-ADRs/ADR-001-initial-architecture.md` | Provider abstraction, local-server spec |
| 05-test | `docs/05-test/test-plans/test-plan.md` | 7 unit suites, E2E, G3 gate checklist |

---

## 6. Environment Setup

### Prerequisites
- Node.js >= 20
- Python 3.12 (for mflux)
- macOS with Apple Silicon (M1/M2/M4)
- HuggingFace account with Flux.1-schnell access

### Setup
```bash
# 1. Clone
git clone https://github.com/Minh-Tam-Solution/OGA.git
cd OGA

# 2. Init submodules + install + build packages
npm run setup

# 3. Python venv for mflux
python3.12 -m venv .venv
source .venv/bin/activate
pip install mflux fastapi uvicorn

# 4. HuggingFace login (Flux.1-schnell is gated)
hf auth login
# Accept license at: https://huggingface.co/black-forest-labs/FLUX.1-schnell

# 5. Create .env.local
cat > .env.local << 'EOF'
LOCAL_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PROVIDER_MODE=local
EOF

# 6. Start local server (first run downloads ~23GB model)
python local-server/server.py

# 7. In another terminal: start Next.js
npm run dev

# 8. Open http://localhost:3000
```

### Mac Mini Production Deploy
```bash
# After Sprint 2 — launchd services for auto-start
# See docs/06-deploy/ for production deployment guide
```

---

## 7. Known Issues & Workarounds

| Issue | Workaround |
|-------|-----------|
| Flux model download ~23GB on first run | Pre-download: `mflux-generate --model schnell --prompt "test" --steps 1 --output /tmp/test.png` |
| `mlx-openai-server` GPU stream error | Use custom `local-server/server.py` instead (wraps mflux CLI) |
| `packages/studio/src/muapi.js` BASE_URL hardcoded | Partially patched — Sprint 1 task 1.3 completes this |
| Port 3000 conflict | Use `npm run dev -- -p 3001` |
| HF token needs "access public gated repos" permission | Use Read token type, not fine-grained |

---

## 8. MLX Test Results (CEO MacBook M4 Pro 24GB)

| Test | Result | Details |
|------|--------|---------|
| Voice TTS (Kokoro 82M) | PASS 9/10 | English only, Vietnamese not supported |
| Voice STT (Whisper Medium) | PASS | WER 6.2%, Vietnamese supported but untested |
| Image Gen (Diffusers MPS) | OOM | 24GB insufficient for bfloat16 FLUX |
| **Image Gen (mflux MLX Q8)** | **PASS** | **34-49s/image @ 512×512** |
| API Smoke (FastAPI) | PASS | OpenAI-compatible endpoint works |

**Conclusion:** mflux MLX-native + Q8 is the production path. Mac mini M4 Pro 24GB sufficient.

---

## 9. Contacts

| Role | Person | Contact |
|------|--------|---------|
| CEO / Product Owner | Tai Dang | taidt@mtsolution.com.vn |
| IT Admin / DevOps | dvhiep | cntt@nqh.com.vn / 0938559119 |
| Development Tool | EndiorBot | CLI: `endiorbot @coder`, Telegram: @Endior_bot |

---

## 10. EndiorBot Workflow for OGA Development

```bash
# Register OGA workspace
endiorbot repos add oga /path/to/OGA

# Focus on OGA
endiorbot focus oga

# Use agents
endiorbot @coder --patch "rebrand header to NQH Creative Studio"
endiorbot @architect "review providerConfig design"
endiorbot @tester "write tests for local model filtering"

# Check compliance
endiorbot compliance check --tier STANDARD

# tmux bridge (from Telegram)
/launch claude --as coder --risk patch
/send "Create providerConfig.js"
/capture
```

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Handoff Document — 2026-04-26*
