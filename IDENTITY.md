# NQH Creative Studio (OGA) — Project Identity

## Core Identity

**Project:** NQH Creative Studio
**ID:** mts-oga
**Tier:** STANDARD
**Framework:** SDLC 6.3.1
**Upstream:** github.com/Anil-matcha/Open-Generative-AI (fork, no upstream merge)
**Remote:** github.com/Minh-Tam-Solution/OGA

---

## MOP Integration

NQH Creative Studio is **Tier 1 + Tier 2** of the NQH Marketing Operations Platform (MOP).

| MOP Tier | Component | OGA Role |
|----------|-----------|----------|
| **Tier 1 — AI Generation** | `local-server/server.py` | Diffusers + MPS CPU offload microservice on Mac Mini :8123 |
| **Tier 2 — Creative UI** | Next.js frontend | Web UI for marketing team (image, video, lipsync, cinema, marketing studios) |
| Tier 3 — DAM | Directus | Not in OGA scope |
| Tier 4 — Brand Rules | Custom engine | Not in OGA scope |
| Tier 5 — Automation | Dify + n8n | Not in OGA scope |
| Tier 6 — Distribution | Postiz | Not in OGA scope |
| Tier 7 — Analytics | ClickHouse | Not in OGA scope |

**AI-Platform integration:** OGA server.py exposes OpenAI-compatible `/v1/images/generations` endpoint. AI-Platform gateway (S1 :8120) routes requests via `image_models.yaml` — see ADR-004.

---

## Tech Stack

- **Language:** JavaScript (frontend) + Python (inference server)
- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS 4
- **Package Manager:** npm
- **Backend:** FastAPI (Python) + Diffusers (HuggingFace)
- **Image Engine:** Diffusers pipeline + `enable_model_cpu_offload(device="mps")`
- **Models:** Z-Image Turbo (SDNQ uint4) + Flux2 Klein 4B (SDNQ 4-bit dynamic)
- **Kill switch:** `INFERENCE_ENGINE=mflux` env var falls back to mflux CLI subprocess

---

## Hardware Strategy

| Environment | Hardware | Available RAM | Role |
|------------|----------|-------------|------|
| **Pilot/Dev** | MacBook M4 Pro 24GB | ~10GB | Development + validation |
| **Production** | Mac Mini M4 Pro 48GB | ~36-40GB | Deployment server (purchasing) |

---

## Description

NQH Creative Studio is a self-hosted AI creative studio for NQH/MTS employees. It provides a web-based UI for generating AI images and videos using locally-hosted models on Apple Silicon, with zero per-image cost.

Part of NQH MOP (Marketing Operations Platform) — provides Tier 1 AI Generation + Tier 2 Creative UI. Integrates with AI-Platform gateway for auth, routing, cost attribution, and multi-provider fallback (local → cloud).

---

## Purpose

> Cung cấp cho nhân viên NQH/MTS công cụ tạo ảnh/video AI nội bộ, self-hosted trên Mac Mini công ty, không phụ thuộc cloud API trả phí. Marketing, design, content team có thể tạo asset chuyên nghiệp trong <60s mà không cần kỹ năng AI/ML. Tích hợp vào MOP pipeline: AI gen → brand check → approval → distribution.

---

## Stakeholders

| Role | Người | Responsibility |
|------|-------|---------------|
| CEO / Product Owner | Tai Dang | Final decision, product direction |
| IT Admin / DevOps | dvhiep | Mac Mini deploy, LAN config, ops |
| Marketing Manager | Nguyễn Tuấn Hùng | MOP pilot lead, ThơmBrand content |
| End Users | NQH/MTS employees | Daily image/video generation |
| Development | EndiorBot + Claude Code | Implementation, testing, review |

---

## Success Criteria

- [x] POC: Local image gen works on M4 Pro 24GB (mflux, 34-49s/image)
- [x] Sprint 1: Image Studio 100% local, no Muapi.ai calls
- [x] Sprint 2: Production deploy guide + simple auth + health endpoint
- [x] Sprint 3: Video gen capability (Wan2GP stub + config)
- [x] Sprint 5: Diffusers engine migration (MPS CPU offload, no OOM at 1024x1024)
- [ ] Sprint 6: Pipeline hot-swap + Marketing Studio + Video cloud tab
- [ ] Sprint 7-9: Cinema, LipSync, Video local (conditional)
- [ ] MOP Integration: AI-Platform gateway routes to OGA server

---

## Constraints

- **Hardware:** Mac Mini M4 Pro 48GB (production), MacBook M4 Pro 24GB (pilot)
- **Network:** LAN-only Phase 1
- **Budget:** Zero per-image cost (self-hosted)
- **Auth:** PIN-based (Sprint 2) + AI-Platform X-API-Key (MOP integration)
- **Scale:** ~10-20 concurrent users
- **MOP Boundary:** OGA = generation only. Brand check, DAM, distribution = MOP Tier 3-7

---

## Quality Standards

| Metric | Target |
|--------|--------|
| Image gen latency | < 60s (1024×1024 with MPS offload) |
| Peak RAM | ≤ 10GB per generation (MPS CPU offload) |
| Build time | < 60s |
| External API calls (local mode) | 0 |
| Unit tests | 42+ pass |
| UI responsive | Desktop Chrome/Safari |

---

## Related Projects

| Project | Relationship |
|---------|-------------|
| **NQH MOP** | Parent project — OGA = Tier 1+2 |
| **AI-Platform** | Gateway routing to OGA server (Bflow-Platform repo) |
| **EndiorBot** | Development orchestrator (CLI + Telegram + tmux bridge) |
| **Directus** | DAM for MOP Tier 3 (separate deploy) |
| **Postiz** | Distribution layer for MOP Tier 6 (separate deploy) |
| **ZPix** | Reference implementation for Diffusers + MPS offload pattern |

---

*NQH Creative Studio (OGA) | MOP Tier 1+2 | SDLC Framework v6.3.1*
