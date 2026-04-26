# NQH Creative Studio (OGA) — Project Identity

## Core Identity

**Project:** NQH Creative Studio
**ID:** mts-oga
**Tier:** STANDARD
**Framework:** SDLC 6.3.1
**Upstream:** github.com/Anil-matcha/Open-Generative-AI (fork, no upstream merge)
**Remote:** github.com/Minh-Tam-Solution/OGA

---

## Tech Stack

- **Language:** JavaScript
- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS 4
- **Package Manager:** npm
- **Backend:** FastAPI (Python) + mflux (MLX, Apple Silicon)
- **Image Engine:** Flux Schnell via mflux v0.17.5, quantize 8-bit
- **Hardware Target:** Mac mini M4 Pro 24GB

---

## Description

NQH Creative Studio is a self-hosted AI creative studio for NQH/MTS employees. It provides a web-based UI for generating AI images using locally-hosted Flux models on Apple Silicon, with zero per-image cost.

Forked from Open-Generative-AI and restructured to remove cloud API dependency (Muapi.ai), replace with local MLX inference, and rebrand for internal company use.

---

## Purpose

> Cung cấp cho nhân viên NQH/MTS công cụ tạo ảnh AI nội bộ, self-hosted trên Mac mini công ty, không phụ thuộc cloud API trả phí. Marketing, design, content team có thể tạo ảnh chuyên nghiệp trong <60s mà không cần kỹ năng AI/ML.

---

## Stakeholders

| Role | Người | Responsibility |
|------|-------|---------------|
| CEO / Product Owner | Tai Dang | Final decision, product direction |
| IT Admin / DevOps | dvhiep | Mac mini deploy, LAN config, ops |
| End Users | NQH/MTS employees | Daily image generation |
| Development | EndiorBot + Claude Code | Implementation, testing, review |

---

## Success Criteria

- [x] POC: Local image gen works on M4 Pro 24GB (mflux, 34-49s/image)
- [ ] Sprint 1: Image Studio 100% local, no Muapi.ai calls
- [ ] Sprint 2: Production deploy on Mac mini, simple auth
- [ ] Sprint 3: Video gen capability

---

## Constraints

- **Hardware:** Mac mini M4 Pro 24GB (Apple Silicon only)
- **Network:** LAN-only Phase 1
- **Budget:** Zero per-image cost (self-hosted)
- **Auth:** No auth Phase 1 (internal LAN trust)
- **Scale:** ~10-20 concurrent users

---

## Quality Standards

| Metric | Target |
|--------|--------|
| Image gen latency | < 60s (512×512) |
| Build time | < 60s |
| External API calls (local mode) | 0 |
| UI responsive | Desktop Chrome/Safari |

---

## Related Projects

- **EndiorBot** — Development orchestrator (CLI + Telegram + tmux bridge)
- **AI-Platform** — NQH centralized AI infrastructure (future integration)

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1*
