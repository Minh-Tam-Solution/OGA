---
spec_id: SPEC-00FOUNDATION-001
title: "problem statement"
spec_version: "1.0.0"
status: draft
tier: STANDARD
stage: "00-foundation"
category: functional
owner: "@pm"
created: 2026-04-26
last_updated: 2026-04-26
---

# Problem Statement — Open-Generative-AI (NQH Creative Studio)

## 1. Problem Description

NQH/MTS operates a marketing, design, and content team that generates AI-assisted creative assets
(images, videos, lip-sync, cinema-grade compositions) on a daily basis. The current workflow depends
entirely on **Muapi.ai**, a cloud-hosted generative AI platform that charges per-request. While the
output quality is acceptable, the **per-request cost model is structurally unsustainable** for a
team that runs dozens to hundreds of generation jobs each working day.

A proof-of-concept validated in early 2026 demonstrated that **Flux Schnell (mflux v0.17.5,
MLX-native)** runs on a Mac mini M4 Pro 24 GB at 34–49 s/image @ 512×512 with **zero per-image
cost**. The upstream repository (`github.com/Anil-matcha/Open-Generative-AI`) hardcodes Muapi.ai
API endpoints throughout `src/lib/muapi.js` and `packages/studio/src/muapi.js`, making provider
swapping non-trivial without a dedicated fork and integration layer.

Three distinct pain points block the team from moving to self-hosted generation:

1. **Cost pain** — Muapi.ai per-request billing scales linearly with team usage; internal
   creative workflows are incompatible with pay-per-generation economics.
2. **Provider lock-in** — `src/lib/muapi.js` and `src/lib/localInferenceClient.js` contain
   parallel but disconnected code paths; the UI routing in `src/lib/models.js` still defaults
   to cloud endpoints even when a local model is registered in `src/lib/localModels.js`.
3. **Data privacy** — Cloud submission of internal brand assets (unreleased product visuals,
   campaign concepts) to a third-party API conflicts with NQH/MTS data governance expectations.

## 2. Stakeholders

| Role | Actor | Email / Handle | Responsibility |
|------|-------|----------------|----------------|
| CEO / Product Owner | Tai Dang | taidt@mtsolution.com.vn | Final decisions, product direction, G0 sign-off |
| IT Admin / DevOps | dvhiep | cntt@nqh.com.vn | Mac mini deployment, LAN config, server ops |
| End Users — Marketing | NQH/MTS marketing staff | — | Daily image/video generation for campaigns |
| End Users — Design | NQH/MTS design staff | — | High-fidelity asset creation, cinema studio |
| End Users — Content | NQH/MTS content staff | — | Lip-sync and short-form video production |
| Upstream Reference | Anil-matcha/Open-Generative-AI | github.com | Fork source; no reverse merges planned |

Consulted but not primary decision-makers: individual end users who participated in the internal
POC feedback session (3 participants across marketing and design teams).

## 3. Impact Analysis

### 3.1 Current State (Cloud-Only)

| Dimension | Cloud (Muapi.ai) |
|-----------|-----------------|
| CapEx | $0 — no hardware |
| OpEx (monthly) | Variable $$$; scales with generation volume |
| Latency | 5–15 s/image (dependent on API queue) |
| Data privacy | All assets transmitted to external API |
| Availability | Dependent on Muapi.ai uptime SLA |
| Provider flexibility | None — hardcoded endpoints in `src/lib/muapi.js` |

### 3.2 Target State (Self-Hosted)

| Dimension | Self-Hosted (Mac mini M4 Pro 24 GB) |
|-----------|-------------------------------------|
| CapEx | ~$1,300 (Mac mini hardware, one-time) |
| OpEx (monthly) | ~$0 — electricity only |
| Latency | 34–49 s/image @ 512×512 (POC measured) |
| Data privacy | All assets remain on-premises, LAN-only |
| Availability | Controlled by internal IT; no third-party SLA |
| Provider flexibility | Pluggable via `src/lib/localInferenceClient.js` + `localModels.js` |

### 3.3 ROI Projection

Assuming current Muapi.ai spend of $400–600/month (estimated from POC usage patterns):

- **Break-even:** 2–3 months post-hardware purchase
- **12-month net savings:** $3,500–$5,900 vs. continued cloud-only operation
- **24-month net savings:** $8,300–$13,100

The ROI case is conservative — it does not account for the volume increase that is suppressed today
by per-request cost friction. Teams self-report skipping generation tasks when cost feels
prohibitive, understating the true latent demand.

### 3.4 Risk If Problem Is Not Solved

- Creative bottleneck persists; teams remain rationed on AI generation capacity.
- Growing cloud API bill as team scales headcount in 2026–2027.
- Competitive disadvantage vs. peers running self-hosted pipelines at zero marginal cost.
- Data governance exposure if sensitive brand assets continue to be sent to third-party APIs.

## 4. Success Metrics

Success at G0 (Problem Validated) is measured by the ability to articulate the problem with
evidence. The following metrics define what "solved" looks like at product delivery:

| Metric | Baseline (current) | Target (Phase 1 complete) |
|--------|--------------------|---------------------------|
| Per-image API cost | $0.02–0.05/image (cloud) | $0.00/image (self-hosted) |
| Monthly AI tooling OpEx | $400–600 | <$10 (electricity) |
| Image generation latency | 5–15 s (cloud) | ≤60 s @ 512×512 local |
| Data leaving premises | 100% of assets | 0% for image generation |
| Provider swap feasibility | 0% — hardcoded | 100% — switchable via UI setting |
| Team generation requests blocked by cost | ~30% (self-reported) | 0% |
| Local engine availability (uptime) | N/A | ≥99% during business hours |
| Concurrent users supported | Unlimited (cloud scales) | 10–20 (LAN, Phase 1) |

Secondary quality signal: end-user satisfaction score ≥4/5 in post-Phase-1 internal survey
(planned for end of Sprint 2).

## 5. Validation Evidence

### 5.1 Technical POC Results

POC executed by CEO (Tai Dang) on Mac mini M4 Pro 24 GB, macOS, using mflux v0.17.5:

- **Engine:** MLX-native Flux Schnell, 8-bit quantized
- **Resolution tested:** 512×512
- **Measured generation time:** 34–49 seconds per image
- **Cost:** $0.00 per image (local inference, no API call)
- **Conclusion:** Technically viable for internal daily use

The local inference code path exists in `src/lib/localInferenceClient.js` and model registration
in `src/lib/localModels.js`, confirming the upstream project has scaffolding for local engines.
The gap is that `src/lib/models.js` routing and `src/components/` UI components (notably
`AgentStudio.js`, `CinemaStudio.js`, `VideoStudio.js`) do not yet surface local-engine selection
as the default or primary path.

### 5.2 User Feedback (Internal POC)

Three internal participants (marketing × 1, design × 2) tested the local POC build:

- All three confirmed the 34–49 s latency was acceptable for non-time-critical asset generation.
- Two of three reported they would prefer local over cloud even at higher latency due to privacy.
- Primary friction point identified: no progress indicator during local generation (the
  `react-hot-toast` notification pattern in `src/components/Header.js` was noted as insufficient
  for long-running jobs).

### 5.3 Codebase State Evidence

The following files were inspected to confirm the problem is real and the integration gap is
addressable:

| File | Observation |
|------|-------------|
| `src/lib/muapi.js` | Cloud API calls hardcoded; local fallback absent |
| `src/lib/localInferenceClient.js` | Local engine client exists but not wired to UI routing |
| `src/lib/localModels.js` | Model registry exists; populated with local model entries |
| `src/lib/models.js` | Route selector — currently defaults to cloud; needs conditional |
| `src/components/AuthModal.js` | Auth gating present; must not block LAN-only Phase 1 flow |
| `src/components/CameraControls.js` | Cinema-specific controls — depend on cloud video API |
| `packages/studio/src/muapi.js` | Duplicate cloud bindings in workspace package |
| `middleware.js` | Routing middleware — modified in working tree (unreviewed) |

### 5.4 Business Case Sign-Off

CEO Tai Dang reviewed the POC results and ROI projection on 2026-04-26 and directed the team to
proceed with the self-hosted integration as the primary product direction. This constitutes the
stakeholder consultation required for G0 passage.

## Quality Gates

This document feeds gate **G0 — Problem Validation**.

### G0 Pass Criteria

| Criterion | Evidence Location | Status |
|-----------|-------------------|--------|
| Problem clearly articulated with evidence | §1 Problem Description + §5.1 POC Results | ✅ |
| Business case justified with ROI analysis | §3.3 ROI Projection | ✅ |
| Stakeholders identified and consulted | §2 Stakeholders + §5.4 Sign-Off | ✅ |
| Success metrics defined and measurable | §4 Success Metrics table | ✅ |
| Validation evidence documented | §5 Validation Evidence | ✅ |

### Next Gate

**G0.1 — Problem Validated**: requires CPO/CEO explicit approval of this document, after which
`@pm` may proceed to `docs/01-planning/` requirements and scope documents for Sprint 1.

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Stage 00-foundation*
*Owner: @pm | Review: @cpo / @ceo*