---
spec_id: SPEC-03INTEGRATE-000
title: "stage 03 integrate overview"
spec_version: "1.0.0"
status: active
tier: STANDARD
stage: "03-integrate"
category: integration
owner: "@architect"
created: 2026-05-06
last_updated: 2026-05-06
---

# 03-integrate — NQH Creative Studio (OGA)

## Purpose

**Key Question:** How do systems connect safely and consistently?

This stage defines integration contracts between:
- OGA frontend/backend components
- Local inference host (GPU Server S1 primary, Mac fallback)
- AI-Platform gateway and cloud fallbacks

## Stage 03 Artifacts

| Document | Purpose | Owner |
|----------|---------|-------|
| `gpu-server-integration.md` | Runtime, network, env, health and fallback integration | `@architect` |
| `api-contracts.md` | Canonical API contracts and response/error model | `@architect` |
| `bap-mop-alignment-checklist.md` | G3 gate checklist for PM/CPO to verify BAP+MOP alignment | `@coder` |

## Integration Baseline

- Primary runtime: GPU Server S1 (`cuda`)
- Fallback runtime: Mac Mini (`mps`)
- Device policy: `cuda` -> `mps` -> `cpu`
- Workload policy: image/marketing/video local-first, cinema/lipsync cloud-first

## Cross-Project Alignment

This stage is aligned with:

- **BAP** (`/home/nqh/shared/BAP`): AI-Platform contract using `OPENAI_BASE_URL` and custom header auth (`X-API-Key`).
- **MOP** (`/home/nqh/shared/models/core/projects/mop`): hybrid routing policy and AI-Platform gateway observability (`X-Provider-Used`, cost/time headers).

Alignment intent:
- Keep OGA integration contracts compatible with BAP's existing AI-Platform auth pattern.
- Keep OGA runtime policy consistent with MOP cloud-first governance for non-local-viable workloads.

## Gate Mapping

This stage feeds **G3 (Integration Ready)** and is consumed by:
- `docs/04-build/` for sprint implementation checklists
- `docs/06-deploy/` for environment rollout
- `docs/05-test/` for integration test plans

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Stage 03: Integrate*
