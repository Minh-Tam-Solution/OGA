---
spec_id: SPEC-00FOUNDATION-001
title: "business case"
spec_version: "1.0.0"
status: draft
tier: STANDARD
stage: "00-foundation"
category: functional
owner: "@pm"
created: 2026-04-26
last_updated: 2026-04-26
---

# Business Case — Open-Generative-AI (NQH Creative Studio)

## 1. Business Justification

NQH/MTS operates a marketing, design, and content team that generates AI-assisted creative
assets (images, videos, lip-sync, cinema-grade compositions) as a core part of daily operations.
The current workflow is entirely dependent on **Muapi.ai**, a cloud-hosted generative AI platform
billed per-request. This model is structurally incompatible with a team running dozens to hundreds
of generation jobs each working day — cost friction actively suppresses creative output.

A proof-of-concept (POC) validated in early 2026 confirmed that **Flux Schnell (mflux v0.17.5,
MLX-native)** runs on the team's existing Mac mini M4 Pro 24 GB hardware at 34–49 s/image @
512×512 with zero per-image cost. The business case for self-hosted AI generation rests on three
pillars:

### 1.1 Cost Elimination

Muapi.ai charges approximately $0.02–0.05 per image. At current team usage patterns, this
produces a monthly bill of $400–600. That spend scales linearly with headcount and campaign
volume — both of which are projected to grow in 2026–2027. Switching to local inference on
hardware already purchased eliminates marginal generation cost entirely. The economic model
shifts from **variable OpEx** to a fixed, one-time CapEx already sunk into the Mac mini M4 Pro.

### 1.2 Data Governance Alignment

Internal brand assets — unreleased product visuals, campaign concepts, client-facing content —
are currently transmitted to Muapi.ai's API servers for every generation request. NQH/MTS data
governance expectations require that sensitive creative IP remain on-premises. Self-hosted
inference eliminates this exposure entirely: all assets stay on the LAN, processed locally by
`src/lib/localInferenceClient.js` without any external API call.

### 1.3 Operational Independence

The team is currently subject to Muapi.ai's uptime SLA, rate limits, and pricing changes — all
outside NQH/MTS control. A self-hosted stack managed by internal IT (dvhiep) gives the team
full control over availability, capacity, and upgrade cadence. The codebase already contains the
scaffolding: `src/lib/localModels.js` (model registry), `src/lib/localInferenceClient.js`
(inference client), and `src/lib/models.js` (route selector) — the integration gap is closing
the routing path so the UI surfaces local engines as the primary option.

---

## 2. ROI Analysis

### 2.1 Cost Assumptions

| Item | Value | Source |
|------|-------|--------|
| Current monthly Muapi.ai spend | $400–600/month | POC usage pattern estimation |
| Mac mini M4 Pro 24 GB (already purchased) | ~$1,300 one-time CapEx | Actual hardware cost |
| Monthly electricity (24/7 inference server) | ~$8–12/month | M4 Pro TDP estimate |
| Engineering time to close integration gap | ~3 sprints (est.) | Codebase gap analysis |
| Ongoing maintenance (IT admin hours) | ~2 hrs/month | dvhiep estimate |

### 2.2 Break-Even Analysis

Using the conservative $400/month baseline:

