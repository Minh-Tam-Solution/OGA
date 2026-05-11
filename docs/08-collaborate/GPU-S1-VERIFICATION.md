---
spec_id: SPEC-08COLLAB-001
title: "gpu server s1 verification log"
spec_version: "1.0.0"
status: active
tier: STANDARD
stage: "08-collaborate"
category: verification
owner: "@coder"
created: 2026-05-06
last_updated: 2026-05-06
references:
  - docs/08-collaborate/HANDOFF-SPRINT9-PM-GPU-SERVER.md
  - docs/03-integrate/bap-mop-alignment-checklist.md
---

# GPU Server S1 — Verification Log

**Version:** 1.0.0  
**Date:** 2026-05-06  
**Status:** ACTIVE — Awaiting execution on GPU Server S1  
**Authority:** @pm (priority), @coder (execution), @pjm (tracking)  
**Purpose:** Produce evidence to tick items 6.4 and 6.5 in `bap-mop-alignment-checklist.md` (G3 close).

---

## Environment

| Component | Expected |
|-----------|----------|
| Host | GPU Server S1 (Ubuntu 22.04+, CUDA 12.1+) |
| Repo | `https://github.com/Minh-Tam-Solution/OGA.git` @ `main` |
| Node.js | 20+ |
| Python | 3.12 |

---

## Phase 1 — Build Verification (Item 6.4)

**Command:**
```bash
git clone https://github.com/Minh-Tam-Solution/OGA.git
cd OGA
npm install
npm run build
```

**Evidence to capture:**
- [ ] Exit code (`echo $?`)
- [ ] Last 20 lines of stdout/stderr
- [ ] Screenshot or paste into this doc

**Pass criteria:** Exit code 0, 0 errors.

**Result log:**
```
Date: 2026-05-07
Executor: @coder (Kimi CLI)
Exit code: 0
Errors: 0
Notes: Next.js 15.5.15 optimized production build. 10 static pages generated. 
  Submodules: git submodule update --init --recursive (Open-Poe-AI, Vibe-Workflow).
  Workspace packages: npm run build:packages (ai-agent, workflow-builder, studio).
  Verified on GPU Server S1 (RTX 5090, Ubuntu 22.04, Node 20, Python 3.12).
```

---

## Phase 2 — Test Verification (Item 6.5)

**Command:**
```bash
npm test
```

**Evidence to capture:**
- [ ] Total tests count
- [ ] Passed count
- [ ] Failed count (expect 4 pre-existing server-connection fails)
- [ ] Exit code

**Pass criteria:** 140+ pass, 4 pre-existing fails acceptable.

**Result log:**
```
Date: 2026-05-07
Executor: @coder (Kimi CLI)
Total: 144
Passed: 144
Failed: 0
Exit code: 0
Notes: 
  - Luồng B (GPU CUDA): Server boots with runtime_device="cuda", Z-Image Turbo loaded.
  - Full test suite: 144 pass / 144 total (0 fail).
  - rmbg.test.mjs: 16/16 pass
  - concurrency.test.mjs: 13/13 pass (swap-while-generating 409 verified)
  - Stack: PyTorch nightly 2.12.0.dev20260407+cu128, CUDA 12.8, RTX 5090 Blackwell.
  - Resolution: IT Admin stopped NVIDIA MPS service to unblock CUDA context creation.
```

---

## Phase 3 — Smoke E2E (Handoff §7 Checklist)

**Prerequisites:** Local server running on `:8000`, frontend on `:3000`.

```bash
# Terminal 1
source .venv/bin/activate
python local-server/server.py

# Terminal 2
npm run dev
```

### 3.1 Health Check
```bash
curl -s http://localhost:8000/health | jq .
```
- [ ] Returns `{"status":"ok"}`

**Result:**
```
Date: 2026-05-07
Output: Server boot SUCCESS on GPU (Luồng B).
  Health check: {"status":"ok","runtime_device":"cuda","pipeline_state":"ready",
    "model":"Z-Image Turbo","utilities":{"rembg":true},"process_rss_mb":5183}
  
  Resolution:
  - PyTorch nightly 2.12.0.dev20260407+cu128 installed.
  - IT Admin stopped NVIDIA MPS service + set GPU compute mode to Default.
  - torch.cuda.is_available() → True, Device: NVIDIA GeForce RTX 5090, Arch: (12, 0).
  - Server loads ZImagePipeline on CUDA in ~6.2GB RAM.
  
  Test Results:
  - Full suite: 144 pass / 144 total (0 fail).
  - rmbg.test.mjs: 16/16 pass
  - concurrency.test.mjs: 13/13 pass (including swap-while-generating 409)
```

### 3.2 Image Studio E2E
- [ ] Open `http://localhost:3000`
- [ ] Navigate to Image Studio
- [ ] Generate image with prompt "a red apple"
- [ ] PNG displays correctly

**Result:**
```
Date: ____
Executor: ____
Status: ____
Latency: ____
Notes: ____
```

### 3.3 Marketing Studio (RMBG)
- [ ] Upload image with background
- [ ] Remove background
- [ ] Transparent PNG received

**Result:**
```
Date: ____
Status: ____
Notes: ____
```

### 3.4 Cloud-Only Studios (Banner Visible)
- [ ] Video Studio → cloud banner visible, no local endpoint errors
- [ ] Lip Sync Studio → cloud banner visible, no local endpoint errors
- [ ] Cinema Studio → cloud banner visible, no local endpoint errors

**Result:**
```
Date: ____
Status: ____
Notes: ____
```

---

## Phase 4 — CUDA Verification

```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

**Expected:** `CUDA available: True`, device name = NVIDIA GPU.

**Result:**
```
Date: ____
Output: ____
```

### Luồng B Architecture Decision (@architect)

```
Date: 2026-05-07
Decision: Move GPU Server S1 to Blackwell-compatible PyTorch nightly (cu128) on Linux.
Why: PyTorch 2.5.1+cu121 hangs during CUDA init on RTX 5090; blocker is platform stack, not app logic.
Implementation:
  1) Install deps from local-server/requirements-linux-blackwell.txt inside .venv.
  2) Disable OGA_FORCE_CPU and boot server on :8000.
  3) Verify runtime_device="cuda" via GET /health.
  4) Re-run 4 pipeline-dependent tests in tests/unit/concurrency.test.mjs.
Exit Criteria:
  - torch.cuda.is_available() returns True within 10s
  - Server loads default pipeline without hang
  - 4 currently expected FORCE_CPU failures are resolved
Owner: @architect (stack decision), @coder (execution), @pm (timeline/risk)
```

---

## Completion Criteria

Tick G3 checklist items after ALL of the above pass:

| G3 Item | Condition | Tick when |
|---------|-----------|-----------|
| 6.4 | Build 0 errors | Phase 1 exit code = 0 |
| 6.5 | 140+ tests pass | Phase 2 passed ≥ 140 |
| Handoff §7 | Full smoke pass | Phase 3.1–3.4 all ticked |

---

## 7. Operational Requirement (Post-G3)

### 7.1 Startup Gate Check

Before opening traffic to OGA server on GPU S1, **mandatory** health check:

```bash
curl -s http://localhost:8000/health | jq -e '.runtime_device == "cuda"'
```

- Must return `true` (exit code 0).
- If `runtime_device != "cuda"`, server is in CPU fallback mode — **do not route production traffic**.
- This check must be included in systemd/launchd service `ExecStartPost` or container readiness probe.

### 7.2 Post-Deploy Monitoring

| Check | Frequency | Alert if |
|-------|-----------|----------|
| `/health` → `runtime_device == "cuda"` | Every 30s | Not `cuda` |
| `/health` → `pipeline_state == "ready"` | Every 30s | Not `ready` |
| GPU VRAM usage | Every 60s | > 90% |
| nvidia-mps status | Every 5min | Running (must be stopped) |

---

## Sign-Off (after execution)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Executor | | | ☐ |
| PM | | | ☐ |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.0 | GPU Server S1 Verification Log*
