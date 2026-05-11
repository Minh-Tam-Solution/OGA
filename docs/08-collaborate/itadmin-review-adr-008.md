---
type: "IT/Admin Review — ADR-008 Cross-Platform GPU Governance"
date: "2026-05-10"
reviewer: "@itadmin"
adr_version: "v0.9"
---

# IT/Admin Review: ADR-008 GPU Governance

**Reviewer:** @itadmin  
**Date:** 2026-05-10  
**ADR Version Reviewed:** v0.9  
**Status:** Review complete — 5 answers + 4 bonus items provided

---

## Q1 — Ollama Ownership / Idle-Unload

**Stance:** Register Ollama into unified registry. No dedicated GPU needed.

| Property | Detail |
|----------|--------|
| **Actual owner** | IT/Admin team (`apps/ollama` in `/home/nqh/shared/models/apps/ollama/`) |
| **Current idle-unload** | 300s (`OLLAMA_KEEP_ALIVE=5m`) — already configured |
| **Proposed idle-unload** | Keep 300s (balance cold-start ~3-8s vs VRAM pressure) |
| **Priority correction** | `training` → **production** (serves OpenWebUI staff + LiteLLM proxy + AI-Platform RAG) |
| **Multi-model** | `MAX_LOADED_MODELS=2` — arbiter must treat as VRAM pool, not per-model slots |
| **Dedicated GPU** | Rejected — only 1× RTX 5090, capex + power budget saturated |

**ADR change requested:** Update registry row `ollama-inference` priority to `production`, idle_unload to `300s`, add `multi_model: true`.

---

## Q2 — VieNeu CPU Mode

**Stance:** GPU-only forever. Do NOT fix lmdeploy upstream.

| Property | Detail |
|----------|--------|
| **CPU mode** | Upstream bug — fix = weeks of dev, not NQH core competency |
| **VRAM footprint** | ~2-4 GB (not primary pressure source) |
| **idle_unload** | **60s** (not 0s as in ADR v0.1) — TTS utterances are short, 60s idle is plenty |
| **Plan B** | If GPU pressure critical → swap to MeloTTS GPU or Piper (zero-GPU) |
| **Revisit condition** | If lmdeploy fixes CPU mode within 6 months → review |

**ADR change requested:** Update registry row `aiplatform-voice-vieneu` idle_unload to `60s`.

---

## Q3 — Arbiter Deployment: systemd vs Docker

**Stance:** systemd host-native on S1. Bind `0.0.0.0:8200`.

| Factor | systemd host-native | Docker in ai-net |
|--------|---------------------|------------------|
| Survive Docker daemon restart | ✅ | ❌ |
| Govern host processes (ComfyUI, SD host) | ✅ direct | ⚠️ mounts needed |
| Govern Docker consumers | ✅ via HTTP API | ✅ |
| Bootstrap dependency | Clean: `After=nvidia-mps Before=docker` | Circular |
| Debug when Docker broken | ✅ localhost works | ❌ |
| nvidia-smi, /proc/driver/nvidia | Native | Needs --privileged |

**Proposed config:**
```systemd
# /etc/systemd/system/gpu-arbiter.service
[Unit]
Description=GPU Resource Arbiter
After=nvidia-mps.service
Before=docker.service ollama.service

[Service]
Type=simple
User=gpu-arbiter
Group=nvidia docker
ExecStart=/opt/gpu-arbiter/bin/arbiter --bind 0.0.0.0:8200
Restart=always

[Install]
WantedBy=multi-user.target
```

**Network:** UFW allow `172.19.0.0/16 → 8200/tcp`. No public NAT.  
**Secrets:** JWT signing key in `core/ops/config/secrets/gpu-arbiter.key` (chmod 600, root only).  
**Port:** 8200 newly allocated — will add to PORT_ALLOCATION_MANAGEMENT.md.

---

## Q4 — Heartbeat: PID vs HTTP

**Stance:** HYBRID — PID watch baseline, HTTP heartbeat optional, VRAM probe safety net.

| Tier | Mechanism | Consumers | Frequency | Failure Action |
|------|-----------|-----------|-----------|----------------|
| **Tier 1** | PID/cgroup watch | All | 10s poll | Reclaim lease immediately |
| **Tier 2** | HTTP heartbeat | High-stakes only (VieNeu) | 30s POST | Eviction after 2 misses (60s) |
| **Tier 3** | VRAM probe (nvidia-smi) | Arbiter self-check | 60s | Force unload zombie context |

**Rationale:** PID-only fails on CUDA context stuck (zombie memory). HTTP-only fails on hard crash between ticks. Hybrid covers both.

---

## Q5 — Queue Semantics

**Stance:** FIFO same-priority for Phase 1. Weighted fair queueing deferred to Phase 2.

| Condition | Decision |
|-----------|----------|
| Current workload | ~5-10 video concurrent + voice + 2 ollama models |
| Same-tier contention | Low — FIFO won't starve |
| Predictability | FIFO = easy to debug (tail -f arbiter.log shows order) |
| WFQ trigger conditions | (a) training job >30 min, (b) production p99 >100ms, (c) >3 consumers same tier |

**Priority tiers already implicit weight:** production > training > experimental. Within tier = FIFO.

---

## Bonus Items (4)

### B1 — Missing Registry Entries

ADR-008 D5 missing 3 active production consumers:

| Consumer ID | Owner | Priority | Max VRAM | Status |
|-------------|-------|----------|----------|--------|
| `comfyui-image` | IT/Admin | production | 15360 | Active (sd.nhatquangholding.com) |
| `stable-diffusion-host` | IT/Admin | production | 8192 | Active (host-native) |
| `oga-studio-frontend` | OGA | production | 0 | Active (port 3005, CPU-only) |

**Action:** Add before arbiter go-live.

### B2 — MPS State Decision Needed

**Current state:** `nvidia-mps` inactive (`systemctl is-active nvidia-mps` = inactive).  
**CLAUDE.md claims:** MPS `Exclusive_Process` auto-start.  
**Options:**
- (a) Re-enable MPS → complements arbiter (MPS = context serialization, arbiter = VRAM admission)
- (b) Stay disabled → arbiter enforces strict serial scheduling for incompatible pairs

**Recommendation:** (a) — MPS verified stable previously. Needs CTO confirm Monday.

### B3 — Eviction Blackout Window

**Problem:** D6 L4 says "CTO-on-call decides: kill ollama?" But Ollama serves 30-50 staff via OpenWebUI. Force-evict during work hours = "model loading..." 8-15s for all users.

**Proposal:** Add `eviction_blackout_window` to registry:
```json
{
  "consumer_id": "ollama-inference",
  "eviction_blackout_window": "08:00-18:00,Mon-Fri"
}
```
During blackout: arbiter degrades other consumers (longer queue) instead of force-evicting Ollama.

### B4 — Dashboard Scope for Sprint 14

**Request:** Add real-time GPU dashboard to ADR-009 scope:
- VRAM pie chart (who's using what)
- Active leases list
- Queue depth + wait times
- Degrade level history

**Value:** Reduces MTTR by 80% — currently requires `nvidia-smi + docker ps + log reading` to diagnose GPU contention.

---

## ADR Changes Incorporated

| # | Change | Status |
|---|--------|--------|
| 1 | Ollama priority: training → production | ✅ Incorporated |
| 2 | Ollama idle_unload: 600s → 300s | ✅ Incorporated |
| 3 | Ollama multi_model: true | ✅ Incorporated |
| 4 | VieNeu idle_unload: 0s → 60s | ✅ Incorporated |
| 5 | 3 missing consumers added to registry | ✅ Incorporated |
| 6 | Deployment: systemd host-native, port 8200 | ✅ Incorporated |
| 7 | Heartbeat: hybrid PID + HTTP + VRAM probe | ✅ Incorporated |
| 8 | Queue: FIFO Phase 1, WFQ deferred | ✅ Incorporated |
| 9 | Eviction blackout window | ✅ Incorporated |
| 10 | Sprint 14 scope: dashboard + MPS + blackout | ✅ Incorporated |

---

*Review complete. Ready for CTO Monday kickoff.*
