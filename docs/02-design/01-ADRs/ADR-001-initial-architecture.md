---
adr_id: ADR-001
title: "Initial Architecture — NQH Creative Studio (Open-Generative-AI Fork)"
adr_version: "1.0.0"
status: Proposed
tier: STANDARD
stage: "02-design"
owner: "@architect"
created: 2026-04-26
last_updated: 2026-05-06
gate: G2
---

# ADR-001: Initial Architecture — NQH Creative Studio

## Status

Proposed — pending CTO review and G2 approval.

---

## Context

NQH/MTS operates an internal marketing, design, and content team that generates AI-assisted
creative assets (images, videos, lip-sync, cinema-grade compositions) daily. The current
production workflow is entirely cloud-dependent on **Muapi.ai**, which charges per-request.
A validated POC confirmed that local image inference is viable on Mac hardware, and Sprint 9
deployment prep established **GPU Server S1 (CUDA)** as the stronger primary runtime for local
inference. Mac Mini remains a valid fallback node for image workloads.

The upstream repository (`github.com/Anil-matcha/Open-Generative-AI`) hardcodes Muapi.ai
API endpoints throughout `src/lib/muapi.js` and `packages/studio/src/muapi.js`. Three
structural problems block a straightforward provider swap:

1. **Provider coupling** — `src/lib/muapi.js` and `src/lib/localInferenceClient.js` are
   parallel but disconnected; the UI routing in `src/lib/models.js` defaults to cloud
   endpoints even when a local model is registered in `src/lib/localModels.js`.
2. **Cost unsustainability** — per-request billing scales linearly with team usage; a fixed
   hardware investment breaks even within 1–2 months at current spend ($400–600/month).
3. **Data governance risk** — submitting unreleased brand assets to a third-party API
   violates NQH/MTS data governance expectations.

This ADR establishes the architectural baseline: a self-hosted, local-inference
fork of Open-Generative-AI, operating on the LAN under the "NQH Creative Studio" brand,
with a provider abstraction layer decoupling the UI from any specific inference backend.

---

## Decision

### 1. Runtime Platform — Next.js (App Router) on Node.js

The existing codebase is a **Next.js** application (`next` in `package.json`). The fork
preserves this choice. All server-side proxy routes (local inference relay, model download
orchestration) are implemented as Next.js API routes (`/api/*`) to avoid introducing a
separate backend process in Phase 1. Runtime host is environment-dependent: GPU Server S1 is
primary for deployment, while Mac Mini remains supported for fallback and local validation.

### 2. Provider Abstraction Layer — `src/lib/providerConfig.js` (new file)

A single environment flag (`NEXT_PUBLIC_LOCAL_MODE=true`) controls provider routing. The
new `providerConfig.js` module exports a `getProvider()` function that returns either the
local inference client or the Muapi client. All components and lib files that currently
import from `muapi.js` will import from `providerConfig.js` instead, eliminating all
direct provider references from UI components.

### 3. Hardware Baseline (Revised)

- **Primary host:** GPU Server S1 (Ubuntu 22.04+, CUDA 12.1+, NVIDIA driver 535+)
- **Fallback host:** Mac Mini M4 Pro (MPS path)
- **Device policy:** `cuda` if available, else `mps`, else `cpu`
- **Workload policy:** image/marketing local-first, video/cinema/lipsync cloud-first in current phase

