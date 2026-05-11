---
doc_type: "Cross-platform response"
stage: "08 - COLLABORATE"
title: "OGA → AI-Platform: ADR-008 Open Questions Answer Document"
status: "DRAFT — @cto to approve before 2026-05-14 EOD"
authored_by: "@architect (OGA)"
send_to: "AI-Platform @pm / @architect / @coder"
related:
  - "AI-Platform docs/08-collaborate/03-sprint-management/oga-adr-008-acknowledgement-2026-05-12.md"
  - "OGA docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md"
---

# OGA → AI-Platform: ADR-008 Answers

**From**: OGA Architect  
**To**: AI-Platform PM / Architect / Coder  
**Date**: 2026-05-12  
**Re**: Answers to 5 open questions from `oga-adr-008-acknowledgement-2026-05-12.md`

---

## Q1 — Arbiter Registration API

**Answer:** Two-phase approach: config-file for S14-A advisory mode, API for S14-B delegate mode.

### Phase 1 (S14-A advisory, 2026-05-20): Config-file registry

No live `POST /register` endpoint yet. Arbiter reads static registry from YAML at startup:

```yaml
# /etc/gpu-arbiter/consumers.yaml
consumers:
  - consumer_id: "ai-platform-gateway"
    class: "priority-llm"
    priority_weight: 100
    max_vram_mb: 14336
    idle_unload_sec: 600
    heartbeat_required: true
    heartbeat_interval_sec: 30
    eviction_blackout: "08:00-18:00,Mon-Fri"
    cpu_fallback_ok: false
    
  - consumer_id: "aiplatform-voice-vieneu"
    class: "production"
    priority_weight: 50
    max_vram_mb: 4096
    idle_unload_sec: 60
    heartbeat_required: true
    heartbeat_interval_sec: 30
    cpu_fallback_ok: false
    
  - consumer_id: "aiplatform-voice-piper"
    class: "production"
    priority_weight: 50
    max_vram_mb: 0
    # CPU-only, no arbiter needed — listed for completeness
```

**Auth:** File owned by `gpu-arbiter:gpu-arbiter`, chmod 600. No API auth needed in advisory mode.

### Phase 2 (S14-B delegate, 2026-05-22): `POST /register` endpoint

```
POST /gpu/register
Headers: Authorization: Bearer <arbiter-admin-token>
Body: {
  "consumer_id": "string",          // required, unique, kebab-case
  "class": "priority-llm|production|training|experimental",
  "priority_weight": integer,       // 0-100, higher = more priority
  "max_vram_mb": integer,           // required
  "idle_unload_sec": integer,       // 0 = no unload
  "heartbeat_required": boolean,    // default false
  "heartbeat_interval_sec": integer,// default 30, min 10
  "eviction_blackout": "string",    // optional, cron-like: "HH:MM-HH:MM,DOW"
  "cpu_fallback_ok": boolean,       // default true
  "callback_url": "string"          // optional, for eviction notices
}

Response 201:
{
  "consumer_id": "ai-platform-gateway",
  "registered_at": "2026-05-22T10:00:00Z",
  "lease_endpoint": "/gpu/lease/{lease_id}",
  "status": "active"
}

Response 409: { "error": "consumer_id already registered" }
Response 400: { "error": "invalid class or missing required field" }
```

**AI-Platform action:** Use config-file for S14-A. No code needed. For S14-B, implement `POST /register` call once arbiter v0.2 deployed.

---

## Q2 — Heartbeat Schema

**Answer:** Confirmed spec below.

### Endpoint

```
POST /gpu/heartbeat
Headers: 
  Content-Type: application/json
  X-Consumer-Token: <JWT-issued-at-registration>

Body:
{
  "consumer_id": "ai-platform-gateway",
  "lease_id": "lease-uuid",           // required if holding active lease
  "timestamp": "2026-05-22T10:00:00Z",
  "health": "ok|degraded|critical",
  "metrics": {
    "active_requests": 3,
    "queue_depth": 0,
    "avg_latency_ms": 45
  }
}

Response 200:
{
  "acknowledged": true,
  "lease_valid": true,
  "lease_expires_at": "2026-05-22T10:05:00Z",
  "arbiter_degrade_level": "normal"
}

Response 404: { "error": "lease not found or expired" }
```

### Interval

| Consumer Class | Interval | Miss Tolerance | Action on Miss |
|----------------|----------|----------------|----------------|
| `priority-llm` | 30s | 2 misses (60s) | Eviction notice + grace period 30s |
| `production` | 60s | 2 misses (120s) | Eviction notice + grace period 60s |
| `training` | 120s | 3 misses (360s) | Eviction notice + grace period 120s |

**AI-Platform action:**
- Gateway (`priority-llm`): Implement `POST /gpu/heartbeat` every 30s with JWT auth
- Voice service (`production`, PID-watch only): **No heartbeat needed** — arbiter watches Docker container PID via cgroup

---

## Q3 — Prometheus Scrape Topology

**Answer:** **Scrape model** (arbiter pulls from consumers). Arbiter runs on S1 host with access to both host network and Docker networks.

### Network topology

```
S1 Host (192.168.2.2)
├─ gpu-arbiter (systemd, :8200)
│  ├─ Scrapes: localhost:8120 (bflow-ai-gateway via port-forward)
│  ├─ Scrapes: localhost:8121 (bflow-ai-voice via port-forward)
│  └─ Scrapes: localhost:9000 (prometheus node exporter)
│
└─ Docker networks
   ├─ ai-net (172.19.0.0/16)
   │  └─ bflow-ai-gateway:8120
   │  └─ bflow-ai-voice:8121
   └─ ai-platform_ai-platform-network (172.26.0.0/16)
      └─ bflow-ai-voice:8121
```

### Arbiter scrape config

Arbiter exposes its own `/metrics` on `:8200/metrics` for external Prometheus. For consumer metrics, arbiter scrapes:

```yaml
# /etc/gpu-arbiter/scrape-targets.yaml
scrape_targets:
  - job_name: "ai-platform-gateway"
    static_configs:
      - targets: ["localhost:8120"]
    metrics_path: "/metrics"
    scrape_interval: 15s
    
  - job_name: "ai-platform-voice"
    static_configs:
      - targets: ["localhost:8121"]
    metrics_path: "/metrics"
    scrape_interval: 15s
```

**Port-forward requirement:** AI-Platform gateway and voice containers must publish metrics ports to host:

```yaml
# In docker-compose.yml
gateway:
  ports:
    - "8120:8120"    # already exposed
  # Add host binding for metrics if not already:
  # network_mode: host  # OR explicit port binding above
```

**AI-Platform action:** Confirm `gateway:8120/metrics` is reachable from S1 host (`curl localhost:8120/metrics`). No push code needed.

---

## Q4 — Mac Mini SSH/Docker Access Timeline

**Answer:** **Cannot confirm 2026-06-14.** Pending @itadmin procurement status.

| Milestone | Date | Status |
|-----------|------|--------|
| Mac Mini M4 Pro 48G delivery | Early July 2026 | ⏳ Procurement in progress |
| SSH/Docker access ready | TBD (est. 2026-07-05) | ⏳ Waiting for hardware |
| AI-Platform testing window | 2 weeks before cutover | Target: 2026-06-28 → 2026-07-03 |

**Risk:** If delivery slips past early July, JUL-B cutover (2026-07-03) is at risk.

**Mitigation:** OGA will request @itadmin to confirm delivery date by **2026-05-20**. If delivery is after 2026-07-01, cutover slips to August.

**AI-Platform action:** Plan S124 spike (2026-06-09 → 2026-06-20) for MPS compatibility audit. Do NOT block S124 waiting for hardware — audit can run on any M4/M4 Pro Mac with 48GB RAM.

---

## Q5 — VieNeu Apple Silicon Status

**Answer:** **No.** VieNeu has NOT been tested on Apple Silicon (MPS).

**Current knowledge:**
- `pnnbao/vieneu-tts:serve` uses `lmdeploy` for model serving
- lmdeploy is CUDA-only; no MPS backend exists
- Container image is `linux/amd64`; no `linux/arm64` variant published

**Recommendation:** AI-Platform S124 spike to evaluate VieNeu on Apple Silicon is **correct and non-duplicative**. OGA has not run this spike.

**Fallback plan if VieNeu fails on MPS:**
1. Keep VieNeu on S1 (GPU-only, stays in arbiter registry as S1 consumer)
2. Mac Mini production uses MeloTTS GPU or Piper for Vietnamese TTS
3. Re-evaluate VieNeu MPS in Sprint 16 if lmdeploy adds MPS support

---

## Summary Table

| Q | Question | Answer | AI-Platform Action | OGA Action |
|---|----------|--------|-------------------|------------|
| Q1 | Registration API | Config-file S14-A; `POST /register` S14-B | Read `consumers.yaml` format; prepare S14-B `POST /register` | Deploy arbiter with YAML registry 2026-05-20 |
| Q2 | Heartbeat schema | `POST /gpu/heartbeat`, 30s interval, JWT auth | Implement gateway heartbeat emitter | Verify heartbeat endpoint in arbiter v0.2 |
| Q3 | Prometheus scrape | Arbiter scrapes `localhost:8120/metrics` | Confirm metrics reachable from host | Configure scrape targets in arbiter |
| Q4 | Mac Mini access | Cannot confirm 2026-06-14; delivery early July | Plan S124 MPS audit on any M4 Mac | @itadmin confirm delivery by 2026-05-20 |
| Q5 | VieNeu MPS | **Not tested.** AI-Platform S124 spike is correct. | Run S124 VieNeu MPS spike | None — no duplication |

---

## Timing Confirmation

| Milestone | Date | Owner |
|-----------|------|-------|
| This answer doc approved by OGA CTO | 2026-05-13 | @cto |
| AI-Platform receives answers | 2026-05-14 EOD | @pm |
| Arbiter v0.1 deployed (config-file registry) | 2026-05-20 | @oga-devops |
| AI-Platform feature-flagged scaffold | 2026-05-20 | AI-Platform @coder |
| Full live integration (S124 start) | 2026-06-09 | Both teams |

---

*OGA Architect — 2026-05-12*  
*Pending CTO approval before dispatch to AI-Platform*
