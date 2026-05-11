---
adr_id: ADR-008
title: "Cross-Platform GPU Resource Governance — Extending RULE-VRAM-001"
status: "APPROVED — CTO+CPO countersigned (2026-05-11) | v1.1 Q1-Q5 answers locked"
date: "2026-05-10"
revised: "2026-05-12 (v1.1 — D6 registry: add ai-platform-gateway as priority-llm consumer; D5: add POST /gpu/heartbeat spec)"
deciders: ["@cto", "@architect", "@cpo"]
authority: "@cto (co-author with @architect)"
gate: "G3-preparation"
scope_boundary:
  IN: ["Policy", "Interface contract", "Consumer registry", "Escalation path", "RULE-VRAM-001 deprecation", "Handoff signal specification"]
  OUT: ["Implementation", "Deployment", "Monitoring", "Retry strategies"]
related:
  - ADR-003 (Hot-Swap Architecture)
  - ADR-007 (Audio Production)
  - RULE-VRAM-001 (OGA-internal GPU arbitration)
  - PJM ticket S118 (OOM stability)
---

# ADR-008: Cross-Platform GPU Resource Governance

## Status

**APPROVED — CTO+CPO (2026-05-11)**

> **Scope boundary (CTO-locked):**
> - IN: Policy, interface contract, consumer registry, escalation path, RULE-VRAM-001 deprecation, handoff signal specification
> - OUT: Implementation, deployment, monitoring, retry strategies → **ADR-009 in Sprint 14**

> **CEO infrastructure directive (2026-05-11):**
> - S1 is the development and testing environment for Marketing stack platforms.
> - S1 prioritizes Ollama-hosted LLM services used by AI-Platform, Bflow, NQH-Bot, and NQH-POS.
> - Production content workloads (audio, image, video) target Mac Mini M4 Pro 48G (delivery expected early July).
> - This ADR governs S1 transition and defines migration-safe policy for July cutover.

---

## Context

### Problem: Unmanaged Cross-Platform GPU Contention

GPU Server S1 (RTX 5090 32GB) is shared by multiple NQH platform components for development/testing, with priority reserved for Ollama-backed LLM platform services, but without a unified arbitration mechanism:

| Consumer | VRAM Claim | Current Arbiter | Incidents |
|----------|-----------|-----------------|-----------|
| OGA Video (Wan2.1) | ~11 GB | RULE-VRAM-001 (OGA-internal) | 0 |
| OGA Video (LTX) | ~9 GB | RULE-VRAM-001 (OGA-internal) | 0 |
| OGA Video (CogVideoX) | ~14 GB | RULE-VRAM-001 (OGA-internal) | 0 |
| AI-Platform Voice (VieNeu) | ~2-4 GB | **NONE** | Blocked by ollama |
| Ollama (LLM inference) | ~12 GB | **NONE** | 2× OOM in 45 min |
| Future: training jobs | TBD | **NONE** | N/A |

**Incidents this sprint:**
1. IndexTTS coexistence test blocked by Wan2.1 VRAM (Sprint 11)
2. VieNeu eval blocked by ollama GPU occupancy (Sprint 12)
3. Voice service OOM kill 2× in 45 min (Sprint 12)

**Pattern:** Two data points = trend. Cross-platform GPU governance is an architectural gap.

---

## Current State Diagram

```
GPU Server S1 (RTX 5090 32GB ~27GB available)
├─ OGA Video Pipeline (Next.js → local Diffusers server)
│  ├─ Wan2.1 T2V  (~11 GB)  ── RULE-VRAM-001 idle-unload after 300s
│  ├─ LTX-Video    (~9 GB)   ── RULE-VRAM-001 idle-unload after 300s
│  ├─ CogVideoX 5B (~14 GB)  ── RULE-VRAM-001 no-unload (monopolizes)
│  ├─ AnimateDiff  (~6 GB)   ── RULE-VRAM-001 idle-unload after 300s
│  └─ LivePortrait (~4 GB)   ── RULE-VRAM-001 idle-unload after 300s
│
├─ OGA Studio Frontend (Next.js, port 3005)
│  └─ No GPU ── CPU-only, no arbiter needed
│
├─ AI-Platform Voice Service (Docker, bflow-ai-voice)
│  ├─ Piper CPU    (0 GB)    ── No GPU, no arbiter needed
│  ├─ MeloTTS CPU  (0 GB)    ── No GPU, no arbiter needed
│  └─ VieNeu GPU   (~2-4 GB) ── lmdeploy CUDA, NO ARBITER (deferred S118)
│
├─ Ollama (Docker, maintained by IT/Admin)
│  └─ LLM inference (~12 GB) ── NO ARBITER, idle-unload 300s (OLLAMA_KEEP_ALIVE=5m)
│     └─ MAX_LOADED_MODELS=2 (self-caps to 2 models)
│
├─ ComfyUI (apps/comfyui, sd.nhatquangholding.com)
│  └─ Image generation (~8-15 GB) ── NO ARBITER
│
├─ Stable Diffusion (host-native)
│  └─ Image generation (~8 GB) ── NO ARBITER
│
└─ [Future] Training / fine-tuning
   └─ TBD ── NO ARBITER
```

**Critical observation:** Three independent systems (OGA, AI-Platform, ollama) each believe they "own" the GPU. No single source of truth for VRAM allocation.

---

## Decision

### D1: Unify GPU arbitration across ALL NQH S1 GPU consumers with Ollama-first platform priority

RULE-VRAM-001 currently governs OGA video pipelines only. ADR-008 extends governance to:
- AI-Platform voice services (VieNeu when GPU mode)
- Ollama / LLM inference (priority lane for AI-Platform, Bflow, NQH-Bot, NQH-POS)
- Future training / fine-tuning jobs
- Any new GPU-consuming service used in S1 dev/test

### D2: Policy Principles

| Principle | Rule |
|-----------|------|
| **Fail-loud** | Overcommitment = explicit rejection, not silent degradation |
| **Priority tiers** | `priority-llm` (Ollama platform services) > `production` (content inference) > `training` > `experimental` |
| **Idle unload** | Hot-swapped models unload after N seconds (extends RULE-VRAM-001) |
| **Emergency eviction** | CTO-on-call can force-unload non-production consumers |
| **Audit trail** | Every admission/rejection/eviction logged with consumer ID + timestamp |
| **Graceful degradation** | CPU fallback preferred over GPU queue starvation |

### D3: Handoff Signal Options

Three candidate mechanisms for consumers to coordinate GPU handoff:

| Mechanism | Pros | Cons | Complexity |
|-----------|------|------|------------|
| **HTTP probe** (`GET /gpu/status`) | Standard, language-agnostic, observable | Requires network connectivity, polling overhead | Low |
| **File lock** (`/var/run/gpu.lock`) | Zero network dependency, OS-level atomic | Cross-container visibility issues, no queue semantics | Medium |
| **Shared queue** (Redis / Unix socket) | Rich semantics (FIFO, priority, TTL), audit-friendly | Requires additional infrastructure | High |

**Decision:** Phase 1 = HTTP probe (simplest, covers 80% of cases). Phase 2 = Shared queue (when training jobs need queue semantics).

**HTTP probe contract:**
```
GET /gpu/status
Response: {
  "gpu_id": "s1-rtx5090",
  "total_mb": 32768,
  "available_mb": 8192,
  "active_consumers": ["oga-video-wan21", "ollama-inference"],
  "degrade_level": "normal" | "warn" | "critical"
}
```

**Arbiter deployment:** systemd host-native on S1, bind `0.0.0.0:8200`. Docker rejected (daemon restart = arbiter death, circular bootstrap dependency with Docker consumers).

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

**Network:** UFW allow `172.19.0.0/16 → 8200/tcp` (Docker bridge to host). No public NAT.

### D4: Lease Lifecycle & Heartbeat

**Hybrid approach** (PID watch baseline + optional HTTP heartbeat + VRAM probe):

| Tier | Mechanism | Applicability | Frequency | Action on Failure |
|------|-----------|---------------|-----------|-------------------|
| **Tier 1** | PID/cgroup watch | All consumers | 10s poll | Reclaim lease immediately |
| **Tier 2** | HTTP heartbeat | High-stakes consumers (VieNeu GPU) | 30s POST | Eviction notice after 2 misses (60s) |
| **Tier 3** | VRAM probe (nvidia-smi) | Arbiter self-check | 60s | Suspect zombie context → force unload |

**OGA video pipelines:** PID watch sufficient (RULE-VRAM-001 already has idle-unload).  
**Ollama:** PID watch (Docker entrypoint PID available).  
**VieNeu GPU mode:** HTTP heartbeat required (lmdeploy prone to hangs).

### D5: Interface Contract

#### 5.1 Admission Request

```
POST /gpu/admission-request
Headers: X-Consumer-Token: <token>
  S14-A: static format token (arbiter validates format only; no signature check)
  S14-B: registry-issued JWT (full signature validation)
Body: {
  "consumer_id": "bflow-ai-voice",
  "requested_mb": 4096,
  "priority": "production",        // production | training | experimental
  "duration_estimate_sec": 300,
  "idle_unload_sec": 60,           // 0 = no auto-unload
  "cpu_fallback_ok": true          // can run on CPU if GPU denied
}

Response 200 (admitted):
{
  "admitted": true,
  "lease_id": "lease-uuid",
  "budget_remaining_mb": 20480,
  "evicted_consumers": [],
  "expires_at": "2026-05-10T10:05:00Z",
  "renewal_endpoint": "/gpu/lease/lease-uuid/renew"
}

Response 200 (rejected):
{
  "admitted": false,
  "reason": "insufficient_budget",
  "budget_remaining_mb": 1024,
  "suggested_action": "wait_or_cpu_fallback",
  "retry_after_sec": 60
}

Response 200 (rejected with eviction):
{
  "admitted": true,
  "lease_id": "lease-uuid",
  "budget_remaining_mb": 20480,
  "evicted_consumers": ["ollama-inference"],
  "eviction_notice_sec": 30,
  "expires_at": "2026-05-10T10:05:00Z"
}
```

#### 5.2 Eviction Notification

```
POST /gpu/eviction-notice  (callback to consumer)
Body: {
  "lease_id": "lease-uuid",
  "reason": "higher_priority_request",
  "grace_period_sec": 30,
  "checkpoint_recommended": true
}
```

Consumer must acknowledge within grace period or be force-killed.

#### 5.3 Lease Renewal

```
POST /gpu/lease/{lease_id}/renew
Body: { "extension_sec": 300 }
```

Lease expires if not renewed. Auto-expire on consumer process death (via heartbeat or PID watch).

#### 5.4 Heartbeat (mandatory for priority-llm consumers)

```
POST /gpu/heartbeat
Headers: X-Consumer-Token: <same as admission>
Body: {
  "consumer_id": "ai-platform-gateway",
  "class": "priority-llm",
  "lease_id": "lease-uuid-or-null",   // null if no active lease
  "timestamp": "ISO8601",
  "health": "ok" | "degraded" | "critical"
}

Response 200:
{ "ack": true, "lease_status": "active" | "expired" | "unknown" }
```

- Interval: 30s
- Failure: 2 consecutive missed → eviction notice (30s grace)
- Applicability: `priority-llm` tier consumers only; `production`/`content` consumers use PID watch

#### 5.5 Health Probe

```
GET /gpu/health
Response: {
  "status": "healthy",
  "arbiter_version": "0.1.0",
  "gpu_devices": [{
    "id": "s1-rtx5090",
    "degrade_level": "normal",
    "active_leases": 3,
    "queue_depth": 0
  }]
}
```

### D6: Consumer Registry

Registry priorities below represent business criticality in the S1 dev/test environment.
After July cutover, production content traffic is expected on Mac Mini and S1 remains validation/staging with Ollama-first platform priority.

| Consumer ID | Owner | Priority | Max VRAM (MB) | Idle Unload | CPU Fallback | Current Status |
|-------------|-------|----------|---------------|-------------|--------------|----------------|
| `oga-video-wan21` | OGA | production | 11264 | 300s | No | Active |
| `oga-video-ltx` | OGA | production | 9216 | 300s | No | Active |
| `oga-video-cogvideox` | OGA | production | 14336 | 0s (monopolizes) | No | Active |
| `oga-video-animatediff` | OGA | production | 6144 | 300s | No | Active |
| `oga-video-liveportrait` | OGA | production | 4096 | 300s | No | Active |
| `aiplatform-voice-piper` | AI-Platform | production | 0 | N/A | N/A | CPU-only, no registry |
| `aiplatform-voice-melotts` | AI-Platform | production | 0 | N/A | N/A | CPU-only, no registry |
| `ai-platform-gateway` | AI-Platform | **priority-llm** | 14336 | 600s | No | Pre-S14-A scaffold |
| `aiplatform-voice-vieneu` | AI-Platform | production | 4096 | **60s** | No (CPU unsupported) | Deferred S118 |
| `ai-platform-gateway` | AI-Platform | **priority-llm** | 14336 | 600s | No | Pre-S14-A scaffold — proxies LLM traffic to ollama for AI-Platform/Bflow/NQH-Bot/NQH-POS |
| `ollama-inference` | IT/Admin | **priority-llm** | 14336 | **600s** | No | Active, Docker, multi-model |
| `comfyui-image` | IT/Admin | production | 15360 | 300s | No | Active (sd.nhatquangholding.com) |
| `stable-diffusion-host` | IT/Admin | production | 8192 | 300s | No | Active (host-native) |
| `oga-studio-frontend` | OGA | production | 0 | N/A | N/A | Active (port 3005, no GPU) |
| `future-train-melotts` | TBD | experimental | TBD | TBD | TBD | Not yet planned |
| `future-train-diffusers` | TBD | experimental | TBD | TBD | TBD | Not yet planned |

**Registry rules:**
- `max_vram` is a **hard cap**, not a suggestion
- Consumers requesting > max_vram = auto-rejected
- `idle_unload = 0` = consumer monopolizes GPU until explicit release (CogVideoX only)
- `multi_model = true` = single lease covers multiple loaded models (Ollama MAX_LOADED_MODELS=2)
- New consumers = PR to registry + CTO approval

**Multi-model consumers:** Ollama loads up to 2 models simultaneously within its lease. Arbiter treats Ollama as a single "VRAM pool" consumer, not per-model slots. Ollama self-caps via `MAX_LOADED_MODELS=2`.

### D7: Escalation Path

| Level | Trigger | Auto-Action | Human Action |
|-------|---------|-------------|--------------|
| L0 — Normal | Admission granted | Log to audit trail | None |
| L1 — Warn | 1 rejection / 5 min | Return `retry_after_sec` to caller | None |
| L2 — Degraded | 3+ rejections / 5 min | Page @devops on-call | Investigate queue depth, consider idle-unload reduction |
| L3 — Critical | GPU at 95%+ for >2 min | Auto-evict lowest-priority idle consumer | Page @architect + @cto |
| L4 — Emergency | Priority LLM consumer starved for >30 sec | Force-evict all non-priority consumers outside blackout window | @cto-on-call decides: kill ollama? move service to CPU? |

**Eviction blackout windows:** Production-critical consumers (e.g. `ollama-inference`) may register blackout hours where force-evict is prohibited. During blackout, arbiter degrades other consumers (longer queue wait) instead of evicting. Example: `08:00-18:00 weekdays` for Ollama serving OpenWebUI staff.

**SLIs / SLOs:**

| Metric | SLO | Measurement |
|--------|-----|-------------|
| Admission latency p99 | < 50ms | Arbiter response time |
| Priority LLM rejection rate (S1) | < 0.1% | % of priority LLM requests rejected on S1 |
| Idle-unload accuracy | ± 10% | Actual vs configured unload time |
| Audit log completeness | 100% | Every admission/rejection/eviction logged |

**RACI and Incident SLA (from decision log):**

| Level | Trigger | R | A | C | I | Ack SLA | Mitigate SLA | Escalate |
|-------|---------|---|---|---|---|---------|--------------|----------|
| L2 Degraded | 3+ rejections/5min OR queue p95>15s/10min | @oga-devops | @architect | AI-Platform PJM, @coder | @pm, @cpo | ≤10 min | ≤60 min | L3 |
| L3 Critical | GPU>95%/>2min OR queue p95>30s/10min OR LLM gateway 5xx>3%/15min | @oga-devops | @architect | @cto, AI-Platform PJM | @pm, @cpo, @marketing | ≤5 min | ≤30 min | L4 |
| L4 Emergency | Priority LLM starved>30s OR forced eviction fails OR L3×2 in 30min | @architect | CTO | IT/Admin, AI-Platform PJM | All | ≤2 min | Immediate | Force-evict / safe mode |

**Quantitative Rollback Triggers:**

| Metric | Warning | Critical | Rollback Trigger | Lookback |
|--------|---------|----------|------------------|----------|
| GPU admission failure rate | >5% | >10% | Revert delegate→advisory if >10% for 2×15min | 15 min sliding |
| p95 queue wait | >15s | >30s | Revert if >30s for 10 min | 10 min rolling |
| Forced eviction count | ≥2/hr | ≥5/hr | Revert if ≥5/hr or any L4 in 24h | 1 hr + 24h |
| LLM gateway 5xx rate | >1% | >3% | Freeze non-priority + revert if >3% for 15 min | 15 min rolling |

---

## RULE-VRAM-001 Deprecation

Current RULE-VRAM-001 (OGA-internal, SPEC-VRAM-001) will be **superseded** by ADR-008 policy. OGA video pipelines become one consumer class in the unified registry.

**What RULE-VRAM-001 does today:**
- Serial scheduling: only ONE GPU-heavy model loaded at any time
- Idle-unload: models unload after timeout
- Hot-swap: `src/lib/localModels.js` manages model lifecycle

**What ADR-008 replaces:**
- Serial scheduling → admission-controlled parallel scheduling (compatible pairs allowed)
- Idle-unload → unified idle-unload with registry-configured timeouts
- Hot-swap logic → calls arbiter before load, respects eviction notices

**Migration path:**
1. **Sprint 13:** ADR-008 accepted (policy + interface only)
2. **Sprint 14:** ADR-009 (implementation) — build arbiter service + real-time dashboard
3. **Sprint 14:** MPS decision — re-enable MPS (complements arbiter) or stay disabled (arbiter enforces strict serial)
4. **Sprint 14:** OGA refactors `src/lib/localModels.js` to call unified arbiter `POST /gpu/admission-request` before `model.to('cuda')`
5. **Sprint 15:** AI-Platform voice registers as consumer (VieNeu GPU mode)
6. **Sprint 15+:** Ollama registers as consumer; ComfyUI + SD host register
7. **End of June / Early July:** Mac Mini M4 Pro 48G cutover for production audio/image/video workloads; S1 remains dev/test only
8. **Post-cutover:** S1 continues as integration/test host with Ollama-first priority for AI-Platform, Bflow, NQH-Bot, NQH-POS

**Backward compatibility during migration:**
- Phase 1-2: RULE-VRAM-001 continues operating, arbiter runs in advisory mode (logs only)
- Phase 3: RULE-VRAM-001 delegates to arbiter; arbiter enforces
- Phase 4+: RULE-VRAM-001 code removed; OGA uses arbiter client library

**Auth for S14-A advisory mode:**
- Arbiter accepts **any well-formed `X-Consumer-Token` header** — validates format but does not enforce token authenticity in advisory mode.
- Static token for scaffold: `X-Consumer-Token: aiplatform-scaffold-s14a-static`
- S14-B (delegate): full JWT validation. Issuance spec in ADR-009.

**Sprint 14 operational scope additions (ADR-009):**
- Real-time dashboard: VRAM pie chart + active leases + queue depth
- Eviction blackout window configuration
- MPS integration decision and implementation

---

## Consequences

### Positive
- **No more silent OOM** — explicit admission control prevents overcommitment
- **Fairness** — training/experimental workloads cannot starve production inference
- **Observability** — full audit trail of who uses GPU when
- **Scalability** — new GPU consumers plug into registry without architecture changes
- **Fail-loud** — rejection is explicit, debuggable, actionable
- **Platform continuity** — shared LLM services on S1 are protected for AI-Platform, Bflow, NQH-Bot, and NQH-POS

### Negative
- **Complexity** — adds a new arbiter service/component to maintain
- **Latency** — admission check adds ~5-10ms per GPU request (acceptable for video/TTS)
- **Coordination** — requires OGA + AI-Platform + ollama owner to agree on priorities
- **Migration cost** — RULE-VRAM-001 refactor touches OGA video hot-swap logic (`src/lib/localModels.js`)
- **Ollama risk** — root-owned ollama cannot be gracefully evicted without owner coordination or sudo

---

## Alternatives Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| **Status quo (no arbiter)** | ❌ Rejected | OOM incidents prove unsustainable |
| **Dedicated GPU per consumer on S1** | ❌ Rejected | Cost-prohibitive and not aligned with transitional S1 dev/test role |
| **OGA-only arbiter (extend RULE-VRAM-001)** | ❌ Rejected | Doesn't solve cross-platform contention (ollama, AI-Platform) |
| **Process-level CUDA MPS** | ❌ Rejected | MPS has context-switch overhead; doesn't solve memory overcommit |
| **Unified arbiter (ADR-008)** | ✅ Selected | Addresses root cause; scalable; fail-loud |

---

## Open Questions (for CTO review Monday)

1. **Ollama ownership:** Ollama runs as root with no idle-unload. Can we get owner agreement on 600s idle timeout, or does ollama move to separate GPU?
2. **VieNeu CPU mode:** lmdeploy CPU mode is broken in upstream Docker. Is VieNeu GPU-only forever, or do we fix CPU mode?
3. **Arbiter deployment:** ✅ systemd host-native on S1, port 8200
4. **Heartbeat mechanism:** ✅ Hybrid — PID baseline + mandatory HTTP for priority LLM consumers
5. **Queue semantics:** ✅ Weighted fair across priority classes; FIFO within same class
6. **MPS state:** Pending Monday decision — re-enable or stay disabled
7. **Eviction blackout:** ✅ Approved for priority consumers (e.g. Ollama 08:00-18:00)
8. **Dashboard scope:** ✅ Real-time GPU dashboard in Sprint 14
9. **Registration API:** ✅ Static config (D6) = registration; runtime = `POST /gpu/admission-request`
10. **Heartbeat spec:** ✅ `POST /gpu/heartbeat` with lease_id, 30s interval, 2-miss eviction
11. **Prometheus scrape:** ✅ Direct pull; host-port `127.0.0.1:8120:8120`
12. **Mac Mini access:** ⏳ CTO escalating to CEO; fallback 2026-07-03
13. **VieNeu MPS:** ✅ AI-Platform S124 spike pre-authorized; no OGA duplication

---

## References

- RULE-VRAM-001: `docs/04-build/sprints/sprint-11/vram-arbiter-spec.md`
- ADR-003: Hot-Swap Architecture
- ADR-007: Audio Production (OGA consumer model)
- PJM S118 ticket: `AI-Platform/audit/2026-05-10-pjm-ticket-s118-voice-image-rebuild.md`
- OOM incident log: `AI-Platform/audit/2026-05-10-oga-handoff-voice-integration.md` §Appendix
- GPU S1 verification: `docs/08-collaborate/GPU-S1-VERIFICATION.md`

---

*ADR-008 v1.1 | 2026-05-12 | Added ai-platform-gateway to D6 (priority-llm); POST /gpu/heartbeat spec (D5.4); responses to AI-Platform Q1–Q5 in docs/08-collaborate/CTO-RESPONSE-adr-008-aiplatform-q-2026-05-12.md | Implementation → ADR-009 Sprint 14*
