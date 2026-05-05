# Sprint 6 — @coder Handoff Prompt (for Kimi CLI)

**Date:** 2026-05-05
**From:** @pm → @coder
**Sprint:** 6 (Hot-Swap + RMBG + Marketing/Video tabs)
**Branch:** main (commit `aa6a5b99`)
**CTO Approved:** ✅ 2026-05-05

---

## Prompt for Kimi CLI

```
@coder Sprint 6 implementation — NQH Creative Studio (OGA)

Context: OGA = MOP Tier 1 (AI Generation) + Tier 2 (Creative UI).
Repo: /Users/dttai/Documents/Research/Open-Generative-AI
Branch: main
CTO + CPO approved. All design docs ready.

Task 6.0 — HOT-SWAP STATE MACHINE (P0, đã implement trong server.py v3.0)
Status: ĐÃ CODE XONG — cần test + verify memory gate.

Verify:
1. Start server: source .venv/bin/activate && python local-server/server.py
2. Test swap: curl -X POST localhost:8000/api/v1/swap-model -H "Content-Type: application/json" -d '{"model":"flux2-klein-4b"}'
3. Check /health → pipeline_state, mps_current_mb, memory_baseline_mb
4. Generate image: curl -X POST localhost:8000/api/v1/z-image-turbo -H "Content-Type: application/json" -d '{"prompt":"a cat"}'
5. Verify: swap during generation → 409, swap during loading → 503

Gate: peak_ram_mb <= baseline_mb + 300 within 5s after unload_pipeline()

Task 6.1 — RMBG UTILITY ENDPOINT
Spec: TS-004 (docs/02-design/14-Technical-Specs/TS-004-rembg-utility.md)

1. pip install rembg (MIT, CPU ONNX on Apple Silicon — NOT rembg[gpu])
2. Add POST /api/v1/remove-bg to server.py:
   - Request: {"image": "data:image/png;base64,..."}
   - Response: {"status":"ok", "output": "data:image/png;base64,...(with alpha)"}
   - Error: 413 if >10MB, 503 if overloaded
3. RMBG is utility — always-resident, does NOT trigger pipeline swap
4. Add to requirements-mac.txt: rembg

Task 6.2 — ACTIVATE MARKETING TAB
Files: components/StandaloneShell.js, packages/studio/src/muapi.js

1. Change Marketing tab: comingSoon: false
2. Add removeBackground() function to muapi.js:
   async function removeBackground(apiKey, imageBase64) → returns transparent PNG base64
3. Rebuild studio: npm run build:studio

Task 6.3 — ACTIVATE VIDEO TAB (CLOUD-ONLY)
File: components/StandaloneShell.js

1. Change Video tab: comingSoon: false
2. VideoStudio.jsx already has full cloud UI — just flip the flag
3. generateVideo(), generateI2V() already exist in muapi.js

Task 6.4 — TESTS
1. Unit test: hot-swap state machine transitions
2. Unit test: RMBG endpoint contract
3. Unit test: swap-model endpoint (409 during gen, 503 during load)
4. Integration: Image Studio still works after swap cycle
5. Target: 45+ tests pass
6. npm run build → 0 errors

ADR-004 contract test: verify /v1/images/generations + /health match spec.

Design docs (read before implementing):
- ADR-003: docs/02-design/01-ADRs/ADR-003-hot-swap-architecture.md
- TS-003: docs/02-design/14-Technical-Specs/TS-003-pipeline-hot-swap.md
- TS-004: docs/02-design/14-Technical-Specs/TS-004-rembg-utility.md
- Sprint plan: docs/04-build/sprints/sprint-6-plan.md

Acceptance criteria:
- [ ] unload_pipeline() releases MPS memory (peak_ram <= baseline + 300MB) within 5s
- [ ] POST /api/v1/swap-model returns 200 for diffusers, 409 if generating, 503 if loading
- [ ] POST /api/v1/remove-bg returns transparent PNG
- [ ] Marketing Studio tab active
- [ ] Video Studio tab active (cloud mode)
- [ ] npm run build — 0 errors
- [ ] 45+ tests pass
- [ ] No regression on Image Studio generation
```

---

## CTO Minor Notes (follow TS-003, not user stories)

- Endpoint: `POST /api/v1/swap-model` (TS-003) — NOT `/api/pipeline/switch` (US-HOT-SWAP story)
- RMBG: uses `rembg` + `u2net` (MIT) — NOT `briaai/RMBG-2.0` (CC BY-NC)
- Marketing tab: Sprint 6 = tab activation + RMBG wiring. Full campaign gen = existing cloud feature.

---

*Sprint 6 Handoff | @pm → @coder | CTO + CPO Approved 2026-05-05*
