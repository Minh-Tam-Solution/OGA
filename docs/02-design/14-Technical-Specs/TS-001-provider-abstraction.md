---
ts_id: TS-001
title: "Provider Abstraction Layer — Sprint 1"
ts_version: "1.0.0"
status: Proposed
tier: STANDARD
stage: "02-design"
owner: "@architect"
created: 2026-04-26
last_updated: 2026-04-26
references:
  - ADR-001 (docs/02-design/01-ADRs/ADR-001-initial-architecture.md)
  - requirements.md (docs/01-planning/requirements.md) — FR-L01, FR-L02, FR-L03
gate: G2
---

# TS-001: Provider Abstraction Layer

## 1. Purpose

Sprint 1 replaces hardcoded Muapi.ai endpoints with a provider abstraction that routes
generation requests to either the local inference engine or the cloud API based on a single
environment flag. This spec defines the design of every module that touches that routing
boundary.

Driven by: **ADR-001 §2**, **FR-L01–FR-L03** (requirements.md §2.2).

---

## 2. Environment Control

| Variable | Location | Effect |
|---|---|---|
| `NEXT_PUBLIC_LOCAL_MODE` | `.env.local` / process env | `"true"` → local provider; any other value → cloud |
| `LOCAL_API_URL` | server-side only (`middleware.js`) | HTTP origin of local inference server (e.g. `http://localhost:8000`) |

These two variables are intentionally separated: `NEXT_PUBLIC_LOCAL_MODE` is readable by
browser-side code; `LOCAL_API_URL` stays server-side and is never exposed to the client bundle.

---

## 3. Module: `src/lib/providerConfig.js` (new)

Single source of truth for provider selection. All other modules read from here.

### 3.1 API

