---
adr_id: ADR-004
title: "AI-Platform Integration — OGA as MOP Tier 1 Microservice"
status: Approved
date: 2026-05-05
deciders: ["@cto", "@ceo"]
gate: G2
references:
  - MOP Phase A Spec v3.1
  - ADR-002 (Diffusers engine)
  - IDENTITY.md (MOP Tier 1+2 positioning)
---

# ADR-004: AI-Platform Integration

## Status

**Approved** — CTO countersigned 2026-05-05.

## Context

OGA server.py is MOP Tier 1 (AI Generation). AI-Platform gateway (S1 :8120) needs to
route image generation requests to OGA on Mac Mini. Endpoint contract must be
OpenAI-compatible so frontend consumers (OpenWebUI, Dify, OGA Next.js) don't need to
know whether backend is local or cloud.

## Decision

OGA server.py runs on Mac Mini at `PORT=8123` (configurable via env var).
AI-Platform `image_models.yaml` routes to it with priority-based fallback.

### Endpoint Contract

```
POST /api/v1/{model}              — Muapi-compatible (OGA frontend uses this)
POST /v1/images/generations       — OpenAI-compatible (AI-Platform uses this)
GET  /health                      — Liveness probe
GET  /api/model-status            — Loaded model + memory metrics
POST /api/v1/remove-bg            — RMBG utility (Sprint 6)
POST /api/v1/swap-model           — Hot-swap pipeline (Sprint 6)
```

### AI-Platform Routing (image_models.yaml)

```yaml
# In Bflow-Platform/Sub-Repo/AI-Platform/apps/ai-platform/config/
models:
  z-image-turbo:
    providers:
      - name: oga-local
        endpoint: http://192.168.2.x:8123/v1/images/generations
        priority: 1
        health_check: http://192.168.2.x:8123/health
        timeout_s: 120
      - name: fal-ai
        endpoint: https://fal.run/fal-ai/flux/schnell
        priority: 2
        api_key_env: FAL_API_KEY
    cost_per_image_vnd:
      oga-local: 0
      fal-ai: 600
```

### Response Headers (AI-Platform adds)

```
X-Provider-Used: oga-local | fal-ai | replicate
X-Generation-Time-Ms: 42000
X-Cost-Vnd: 0
```

OGA server does NOT add these headers — AI-Platform gateway adds them after proxying.

### Auth Layers

| Layer | Mechanism | Owner |
|-------|-----------|-------|
| Dev (MacBook) | PIN cookie (`ACCESS_PIN` env) | OGA middleware.js |
| Production (MOP) | `X-API-Key: sk-nqh-*` | AI-Platform gateway |
| Internal (Mac Mini LAN) | No auth (firewall isolated) | IT Admin |

### Failure Modes

| Failure | Detection | Fallback |
|---------|-----------|----------|
| Mac Mini down | Health check fail 3x | AI-Platform skips oga-local → fal-ai |
| OOM during generation | HTTP 507 | Same fallback |
| Model swap in progress | HTTP 503 | Retry after 30s or cloud |

## Consequences

### Positive
- Zero API changes needed in OGA server.py (endpoints already match)
- Cloud fallback transparent to user
- Cost attribution via AI-Platform (not OGA concern)

### Negative
- Mac Mini must have static LAN IP (IT Admin configure)
- Health check latency adds ~100ms to routing decision

### Deployment Config (Sprint 6 deliverable)

```bash
# .env.production (Mac Mini)
PORT=8123
HOST=0.0.0.0
INFERENCE_ENGINE=diffusers
NEXT_PUBLIC_LOCAL_MODE=true
```

---

*NQH Creative Studio (OGA) | ADR-004 | Approved 2026-05-05*
