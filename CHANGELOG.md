# Changelog — NQH Creative Studio (OGA)

## [1.1.0] — 2026-04-28

### Sprint 3: Video Generation
- Wan2GP Gradio HTTP client for web local mode
- `/api/video-stub` upgraded to full Gradio proxy
- Video Studio tab activates when `NEXT_PUBLIC_WAN2GP_ENABLED=true`
- `wan2gpConfig` in providerConfig with env-driven enable flag
- Wan2GP setup guide (`docs/06-deploy/wan2gp-setup.md`)

### Sprint 2: Production Hardening
- PIN-based LAN auth with HMAC-signed session cookies
- Rate limiting: 5 attempts/IP/min with memory eviction
- Health endpoint: `GET /api/health` (unauthenticated)
- Image-to-image: local data URL upload (no cloud S3)
- Pending job persistence with 10-min expiry pruning
- launchd deploy guide (`docs/06-deploy/mac-mini-launchd.md`)

### Sprint 1: Foundation
- Rebrand: Open-Generative-AI → NQH Creative Studio (10 files)
- Provider abstraction: `providerConfig.js` — single env flag for local/cloud
- Image Studio local mode: auth bypass, local model dropdown, dual-path generate
- Tab visibility: Coming Soon badges, Workflows/Agents hidden
- Security: SSRF allowlist, console.log gated, XSS fixes, key isolation
- SDLC documentation: 13 artifacts across 6 stages
- 42 unit tests (vitest)

## [1.0.7] — Upstream
- Original Open-Generative-AI release (Anil-matcha fork)
