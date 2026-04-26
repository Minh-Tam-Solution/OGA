---
sprint: 1
status: IN PROGRESS
start_date: 2026-04-26
planned_duration: 3-4d
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "CEO directive — restructure OGA for NQH/MTS internal use"
---

# Sprint 1 — Fork + Rebrand + Provider Abstraction + Image Studio Local-Only

## Context

Open-Generative-AI (upstream) hardcodes Muapi.ai cloud API. Sprint 1 decouples this dependency, rebrands for NQH/MTS internal use, and makes Image Studio work 100% with the local mflux server (POC proven: 34-49s/image @ 512×512 on M4 Pro 24GB).

## Tasks

| Task | Description | Effort | Depends on | Owner |
|------|-------------|--------|-----------|-------|
| 1.1 | **Repo setup:** set remote origin → github.com/Minh-Tam-Solution/OGA; update `package.json` name/description | 30 min | — | @coder |
| 1.2 | **Rebrand UI:** Header → "NQH Creative Studio"; update title, favicon, SettingsModal labels | 1h | 1.1 | @coder |
| 1.3 | **Provider abstraction:** create `src/lib/providerConfig.js`; patch `muapi.js` (×2), `middleware.js`, `app/api/` route handlers (×4) | 2h | 1.1 | @architect + @coder |
| 1.4 | **Image Studio local mode:** skip AuthModal; filter model dropdown to local-only; wire `generateImage()` through providerConfig | 3h | 1.3 | @coder |
| 1.5 | **Tab visibility:** Video/LipSync/Cinema/Marketing → "Coming Soon" badge; Workflows/Agents → hidden | 1h | 1.1 | @coder |
| 1.6 | **Integration test:** `LOCAL_API_URL=http://localhost:8000 npm run dev` → generate image end-to-end; verify 0 external API calls | 1h | 1.4 | @tester |
| 1.7 | **Docs + config:** create `.env.local.example`; update IDENTITY.md, CLAUDE.md, README.md with local setup instructions | 30 min | 1.6 | @coder |

**Total estimated effort:** ~9.5 hours (~2 working days)

## Task Dependencies

```
1.1 (repo setup)
 ├── 1.2 (rebrand)
 ├── 1.3 (provider abstraction) ──→ 1.4 (image studio local mode)
 ├── 1.5 (tab visibility)                    │
 └────────────────────────────────────────── 1.6 (integration test)
                                              │
                                             1.7 (docs)
```

## Acceptance Criteria

- [ ] `npm run build` — 0 errors
- [ ] `python local-server/server.py` + `npm run dev` → Image Studio generates image
- [ ] Network tab: 0 requests to `api.muapi.ai`
- [ ] UI shows "NQH Creative Studio" branding
- [ ] Model dropdown: only "Flux Schnell (Local)" in local mode
- [ ] Video/LipSync/Cinema tabs: "Coming Soon" badge, no crash
- [ ] Workflows/Agents tabs: not visible
- [ ] `.env.local.example` documents all env vars

## Rollback Criteria

- If provider abstraction breaks cloud mode: revert to dual-mode (both hardcoded URLs + providerConfig)
- If Image Studio can't display base64 images: check response format (data:image/png;base64 prefix)

## Gate Evidence

| Gate | Evidence |
|------|----------|
| G0 | docs/00-foundation/README.md — problem statement, business case |
| G0.1 | docs/01-planning/README.md — FR-1→FR-5, NFRs |
| G2 | docs/02-design/README.md — architecture, providerConfig spec |
| G-Sprint | This plan + acceptance criteria above |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 1 Plan*
