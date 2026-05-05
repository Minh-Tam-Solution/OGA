---
sprint: 5
status: PLANNED
start_date: 2026-04-29
planned_duration: 5-7d
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto"]
  trigger: "CEO + CTO approved — migrate from mflux subprocess to Diffusers in-process pipeline"
branch: "sprint-5/diffusers-engine"
baseline_commit: "44d446ae"
rollback: "git checkout main"
---

# Sprint 5 — Inference Engine Migration: mflux → Diffusers + MPS CPU Offload

**Sprint**: 5 | **Phase**: Phase 4 (Engine Upgrade)
**Previous**: Sprint 1-3 (features) + Sprint 4 (quality) + Stabilization baseline
**Branch**: `sprint-5/diffusers-engine` (off `main@44d446ae`)

---

## Sprint Goal

Replace the mflux CLI subprocess inference engine with Hugging Face Diffusers in-process
pipeline using `enable_model_cpu_offload(device="mps")`. Eliminate OOM on MacBook M4 Pro
24GB at 1024x1024 resolution while maintaining the existing Next.js frontend + FastAPI
server architecture.

---

## Context

### Problem
mflux subprocess loads entire model into memory per request (~12-15GB Q8, ~6-8GB Q4).
On MacBook 24GB with Chrome + IDE running, this causes OOM. No way to control memory
lifecycle from the server — subprocess owns the process.

### Solution (proven by ZPix)
Diffusers `enable_model_cpu_offload(device="mps")` moves each pipeline component
(text_encoder → transformer → vae) to GPU only during its forward pass, then back to CPU.
Peak RAM ~3-6GB instead of 12-15GB. CEO tested on same hardware — no OOM at 1024x1024.

### Architecture Decision
- **Keep**: Next.js frontend, FastAPI server, providerConfig.js, middleware proxy
- **Replace**: mflux CLI subprocess → Diffusers Python pipeline (in-process)
- **Add**: MPS CPU offload, curated model registry, async generation lock
- **Preserve**: mflux fallback via `INFERENCE_ENGINE=mflux` env flag (kill switch)

---

## Backlog (Priority Order per CTO/CPO)

| Task | Description | Priority | Points | Owner |
|------|-------------|----------|--------|-------|
| 5.1 | **Refactor server.py**: replace mflux subprocess with Diffusers pipeline + `enable_model_cpu_offload(device="mps")` + `asyncio.Lock()` for concurrency. Keep FastAPI. Add `INFERENCE_ENGINE=diffusers|mflux` kill switch | P0 | 8 | @coder |
| 5.2 | **Curated model registry**: adopt ZPix `curated_models.json` format. Lazy download with `/api/model-status` progress endpoint. Pin diffusers version from ZPix | P0 | 5 | @coder |
| 5.3 | **Observability**: log per-step memory peak (via `torch.mps.current_allocated_memory()`) + generation latency. Expose in `/api/health` response | P0 | 3 | @coder |
| 5.4 | **Frontend model dropdown**: show RAM estimate + download status from `/api/model-status`. Update localModels.js to match curated registry | P1 | 3 | @coder |
| 5.5 | **img2img native**: Flux2 Klein 4B supports `image` kwarg natively. Wire UploadPicker → pipeline `image` param | P2 | 3 | @coder |
| 5.6 | **LoRA hot-swap**: `/api/lora/load` + `/api/lora/unload`. Auto-detect trigger words | P2 | 5 | @coder |
| 5.7 | **Acceptance test matrix**: test across models × resolutions on MacBook 24GB. Measure peak RAM + latency. Compare vs baseline | **Gate** | 3 | @tester |

**Total**: 30 points. P0 tasks (5.1-5.3) = 16 points = core deliverable.

---

## Task Dependencies

```
5.1 (Diffusers engine) ──→ 5.2 (model registry) ──→ 5.4 (frontend dropdown)
         │                        │
         └── 5.3 (observability)  └── 5.5 (img2img)
                                       └── 5.6 (LoRA)
                                  5.7 (acceptance test) ← all P0 + P1 done
```

---

## Acceptance Criteria

### KPI (bắt buộc — CTO/CPO condition)

- [ ] 1024x1024 generation completes without OOM on MacBook M4 Pro 24GB (Chrome + IDE open)
- [ ] Peak RAM during generation ≤ 10GB (logged by observability)
- [ ] Generation latency ≤ 2x baseline mflux time (acceptable regression)
- [ ] `INFERENCE_ENGINE=mflux` env flag falls back to old subprocess path (kill switch works)

### Functional

- [ ] `npm run build` — 0 errors
- [ ] Z-Image Turbo + Flux2 Klein 4B models generate successfully
- [ ] Model lazy download: first use triggers download, returns 202 while downloading
- [ ] `/api/health` includes `peak_ram_mb` and `last_gen_latency_ms` fields
- [ ] All Sprint 1-4 acceptance criteria pass (0 regressions)
- [ ] 42+ tests pass

### Test Matrix (Task 5.7)

| Model | Resolution | Expected RAM | Expected Time | OOM? |
|-------|-----------|-------------|--------------|------|
| Z-Image Turbo | 512×512 | ≤ 6GB | ≤ 30s | No |
| Z-Image Turbo | 1024×1024 | ≤ 8GB | ≤ 60s | No |
| Flux2 Klein 4B | 512×512 | ≤ 4GB | ≤ 20s | No |
| Flux2 Klein 4B | 1024×1024 | ≤ 6GB | ≤ 45s | No |
| Flux2 Klein 4B (img2img) | 1024×1024 | ≤ 7GB | ≤ 50s | No |

---

## Definition of Done

- [ ] P0 tasks (5.1, 5.2, 5.3) marked DONE
- [ ] Test matrix (5.7) passes — no OOM, RAM within KPI
- [ ] Kill switch tested: `INFERENCE_ENGINE=mflux` generates image via old path
- [ ] Observability logs show per-step memory + latency
- [ ] Branch merged to main only after KPI met
- [ ] Sprint plan updated to `status: DONE`

---

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Diffusers `from_pretrained` cold start ~10-30s | HIGH | LOW | Load once at server startup, keep in memory. Only first request slow |
| ZPix diffusers commit breaks with newer version | MEDIUM | HIGH | Pin exact commit hash in requirements-mac.txt. Test before upgrading |
| MPS offload slower than mflux Q4 native | MEDIUM | MEDIUM | KPI allows 2x regression. If >2x, tune steps or fallback to mflux |
| Model download ~2-5GB blocks first request | MEDIUM | MEDIUM | 202 Accepted + progress endpoint. Pre-download in setup script |
| Concurrent requests crash pipeline (no lock) | HIGH | HIGH | `asyncio.Lock()` mandatory (AC-2 from CTO review) |

---

## Scope Control (CPO directive)

| Priority | Tasks | Merge when |
|----------|-------|-----------|
| **P0** (must ship) | 5.1, 5.2, 5.3 | KPI met on MacBook 24GB |
| **P1** (ship if time) | 5.4, 5.5 | After P0 merged |
| **P2** (defer if risk) | 5.6 | Sprint 6 if timeline tight |

---

## References

- [ADR-002: Diffusers Engine Migration](../../02-design/01-ADRs/ADR-002-diffusers-engine.md) — architecture decision
- [TS-002: Diffusers Pipeline Integration](../../02-design/14-Technical-Specs/TS-002-diffusers-pipeline.md) — tech spec
- [ZPix source](file:///Users/dttai/Documents/Research/ZPix/app.py) — reference implementation
- [Stabilization baseline](../../CHANGELOG.md) — commit 44d446ae

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 5 Plan*
