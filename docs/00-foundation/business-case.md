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
last_updated: 2026-05-09
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

### 1.1 Cost Reduction with Hybrid Runtime

Muapi.ai charges approximately $0.02–0.05 per image. At current team usage patterns, this
produces a monthly bill of $400–600. That spend scales linearly with headcount and campaign
volume — both of which are projected to grow in 2026–2027. The current direction is a
hybrid runtime: local image workloads on owned hardware (GPU Server S1 and Mac Mini), cloud only
for workloads not yet viable locally (video/cinema/lipsync). The economic model shifts from
mostly **variable OpEx** to controlled hybrid spend.

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

- **Net monthly savings:** $400 - $10 (electricity) = $390/month
- **Hardware payback (24 GB, already sunk):** $1,300 / $390 = **3.3 months**
- **Year-1 net savings:** ($390 x 12) = **$4,680**
- **Year-2 cumulative:** **$9,360** (hardware fully amortised)

Even under pessimistic assumptions ($300/month cloud spend), break-even occurs in under 5 months.

### 2.3 Mac Mini M4 Pro 48 GB — Upgraded Production Target

Following Sprint 5 validation (Diffusers + MPS CPU offload, 1024x1024 without OOM), the team
upgraded the production inference server to **Mac Mini M4 Pro 48 GB** (~$2,000 one-time CapEx).
This unlocks:

| Capability | 24 GB | 48 GB |
|------------|-------|-------|
| Max resolution (no OOM) | 512x512 | 1024x1024+ |
| Concurrent pipelines (hot-swap) | 1 | 2 (Image + Marketing) |
| RMBG (background removal) | Marginal headroom | Comfortable |
| Video pre-processing | Not feasible | Feasible (frames in RAM) |

**Updated ROI (48 GB target):**

| Item | Value |
|------|-------|
| Mac Mini M4 Pro 48 GB | ~$2,000 one-time |
| Monthly electricity (24/7) | ~$10–14/month |
| Cloud equivalent (fal.ai, $0.025/image) | $500–750/month at 20k–30k images/month |
| **Net monthly savings** | **$486–736/month** |
| **Break-even** | **2.7–4.1 months** |
| **Year-1 net savings** | **$5,832–8,832** |

---

## 3. MOP Context — OGA as Tier 1 + Tier 2

Open-Generative-AI (OGA) operates within the **Master Operations Plan (MOP)** as a dual-tier
platform:

### 3.1 Tier 1 — AI Generation Engine

Local inference stack running primarily on GPU Server S1 (CUDA), with Mac Mini M4 Pro 48 GB
as supplementary node:
- **Image generation:** Flux Schnell (Diffusers, CUDA-first on GPU server)
- **Background removal:** RMBG-2.0 (local, zero API cost)
- **Hot-swap pipeline management:** Switch between Image/Marketing/Video pre-processing without
  server restart

### 3.2 Tier 2 — Creative UI (NQH Creative Studio)

Next.js-based studio interface that surfaces AI capabilities to non-technical creative staff:
- Image Studio — prompt-to-image with local inference
- Marketing Studio — multi-asset ad campaign generation
- Video Studio — local video generation (Wan2.1, LTX-Video) + cloud fallback (Seedance, Kling)
- Post-Production Studio (Sprint 12) — OpenReel video editor at `editor.studio.nhatquangholding.com`
- Voice Studio (Sprint 12-13) — Draft to Take TTS/audio production companion on S1

### 3.3 Tier 3 — MOP/BAP Boundary

- **MOP** owns post-production (edit, voice, distribute) — companion tools on S1
- **BAP** owns social publishing + employee advocacy — Postiz fork, untouched by OGA
- Rule: each tool owns one verb; no generative surface duplication across tiers

### 3.3 MOP Phase A Timeline

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| Phase A kick-off | 05/05/2026 | Sprint 6 plan approved |
| Sprint 6 complete | 06/16/2026 | Hot-swap + RMBG + Marketing/Video tabs |
| Sprint 10 complete | 05/06/2026 | Wan2.1 + LTX-Video local video integration |
| Sprint 11 complete | 05/20/2026 | OpenReel + IndexTTS spikes evaluated |
| Phase A close | 06/16/2026 | Production readiness for multi-studio |

---

## 5. External Repo Integration (New — Sprint 11)

### 5.1 OpenReel Video (Post-Production)

MIT-licensed client-side video editor fills the "edit" gap: Gen → Edit → Export. Deployed as standalone subdomain on S1, zero marginal cost.

### 5.2 Draft to Take / IndexTTS (Audio Production)

MIT launcher + conditional commercial model weights. Multi-speaker TTS, emotion, SFX, music mixing. Companion microservice on S1, zero per-minute cost vs ElevenLabs cloud ($0.30/min).

### 5.3 Boundary Economics

| Capability | Before (cloud) | After (local + companion) |
|------------|---------------|--------------------------|
| Video editing | CapCut Pro ~$70/year/user | OpenReel $0 (MIT) |
| TTS voiceover | ElevenLabs ~$0.30/min | IndexTTS $0 (local inference) |
| SFX/ambience | Epidemic Sound subscription | Woosh-DFlow/MusicGen local |

> **Cumulative effect:** Zero marginal cost across Gen + Edit + Voice pipeline.

---

## 4. Cloud vs Local Cost Comparison

### 4.1 Per-Image Economics

| Provider | Cost/Image | Model | Notes |
|----------|-----------|-------|-------|
| **Local (OGA)** | **$0.000** | Flux Schnell (Diffusers) | Electricity amortised |
| fal.ai | $0.025 | SDXL / Flux | Pay-per-request |
| Muapi.ai | $0.02–0.05 | Various | Current vendor |
| Replicate | $0.01–0.04 | Flux Schnell | Per-second billing |
| Midjourney (API) | ~$0.03 | MJ v6 | Subscription + overage |

### 4.2 Monthly Volume Scenarios

| Monthly Volume | Local Cost | Cloud Cost (fal.ai @ $0.025) | Savings |
|----------------|-----------|------------------------------|---------|
| 5,000 images | $12 (electricity) | $125 | $113/month |
| 15,000 images | $12 | $375 | $363/month |
| 20,000 images | $12 | $500 | $488/month |
| 30,000 images | $14 | $750 | $736/month |

### 4.3 Total Cost of Ownership (3-Year Projection)

| Scenario | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|--------|--------|--------|--------------|
| **Local (OGA, 48 GB)** | $2,000 + $144 = $2,144 | $144 | $144 | **$2,432** |
| **Cloud (fal.ai, 20k/month)** | $6,000 | $6,000 | $6,000 | **$18,000** |
| **Cloud (Muapi.ai, current)** | $6,000 | $7,200 | $8,400 | **$21,600** |

> **3-year savings vs cloud:** $15,568–$19,168
> **ROI multiplier:** 7.8x–9.6x return on hardware investment

### 4.4 Qualitative Advantages (Local)

- **Zero marginal cost** — creative team generates freely without cost anxiety
- **No rate limits** — batch generation limited only by hardware throughput
- **Data sovereignty** — no brand assets leave the LAN
- **Predictable budget** — no surprise invoices from usage spikes
- **Latency** — LAN inference (3–8s) vs cloud round-trip (5–15s + queue)

### 4.5 When Cloud Still Makes Sense

- **Video generation** — still cloud-routed for reliability/cost control in current phase
- **Burst capacity** — campaign launches needing 100k+ images in < 24 hours
- **Exotic models** — models not yet ported to MPS/MLX (e.g., Sora, Kling)

This hybrid approach is reflected in the Video Studio tab (Sprint 6), which uses fal.ai for
cloud-based video generation while keeping image generation entirely local.

---

## 5. Risk Factors

| Risk | Mitigation |
|------|-----------|
| Hardware failure (GPU Server or Mac Mini) | Dual-node fallback (GPU Server S1 and Mac Mini) + cloud fallback path |
| Model quality gap vs cloud | Track FID/CLIP scores quarterly; upgrade models as community releases improve |
| RAM exhaustion under load | Hot-swap architecture (Sprint 6) ensures only one pipeline loaded at a time |
| CUDA/MPS backend variance across environments | Device auto-detection + workload-specific routing (image local, video/lipsync cloud) |
| External repo beta stability | Pin to commit SHA; quarterly re-evaluation; fork if upstream abandoned |
| GHCR supply-chain risk (IndexTTS) | Pin image digest; local registry mirror; exit plan to bare IndexTTS2 |
| VRAM coexistence (video + TTS) | VRAM-arbiter design: CPU-fallback or queue when GPU saturated |

---

## 6. Recommendation

**Proceed with GPU Server S1 as primary inference runtime** and keep Mac Mini M4 Pro 48 GB as
supporting node for image workloads and fallback capacity. This keeps local cost advantages while
preserving delivery reliability for workloads that remain cloud-only in the current phase.

**Decision required:** None — hardware purchased, POC validated, Sprint 6 plan approved.
**Next action:** Execute Sprint 6 (hot-swap + RMBG + Marketing/Video tabs) per MOP Phase A plan.
