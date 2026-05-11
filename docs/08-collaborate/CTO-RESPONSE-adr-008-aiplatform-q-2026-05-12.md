---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — CTO Response to AI-Platform ADR-008 open questions
Authority: "@cto (OGA)"
Stage: "08-collaborate"
References:
  - docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md
  - docs/02-design/01-ADRs/ADR-008-cto-cpo-decision-log.md
  - AI-Platform docs/08-collaborate/03-sprint-management/oga-adr-008-acknowledgement-2026-05-12.md
---

# OGA CTO → AI-Platform: ADR-008 Q1–Q5 Response

**From**: OGA @cto  
**To**: AI-Platform @pm, @architect, @coder  
**Date**: 2026-05-12  
**Re**: Responses to ADR-008 open questions (acknowledgement dated 2026-05-11, dispatch 2026-05-12)  
**Deadline met**: Yes — within the 2026-05-14 EOD window

---

## Scope note

This response covers the 5 questions blocking AI-Platform's consumer-registration and heartbeat scaffold work. All answers are binding for the S14-A advisory mode (2026-05-20) pre-code window. Full ADR-009 (arbiter implementation spec) will be written in Sprint 14 — until then, these answers are the authoritative source.

---

## Q1 — Arbiter Registration API

**Short answer: no live `POST /register` endpoint. Consumers are pre-declared in a static config file that the arbiter reads at startup. Use `POST /gpu/admission-request` for runtime GPU requests.**

### Registration protocol

Consumers are registered in the arbiter's registry config (derived from ADR-008 D6 table). There is no live self-registration endpoint. For S14-A pre-build:

1. Submit a PR to `docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md` adding your consumer entries to the D6 registry table (see additions below).
2. The arbiter reads this table from config at startup — no HTTP call needed to "register."
3. At runtime, call `POST /gpu/admission-request` every time you want to load a GPU-bound model.

### D6 registry additions (CTO-approved, effective immediately)

Add these two rows to ADR-008 D6:

| Consumer ID | Owner | Priority | Max VRAM (MB) | Idle Unload | CPU Fallback | Current Status |
|---|---|---|---|---|---|---|
| `ai-platform-gateway` | AI-Platform | **priority-llm** | 14336 | 600s | No | Pre-S14-A scaffold |
| `aiplatform-voice-vieneu` | AI-Platform | production | 4096 | 60s | No | Deferred S118 — already in D6 |

**Rationale for `ai-platform-gateway` as priority-llm:** The gateway proxies all LLM inference traffic for AI-Platform, Bflow, NQH-Bot, and NQH-POS through Ollama. D1 (CEO-aligned) reserves priority-llm tier for these cross-platform services. Registering the gateway as priority-llm ensures that when the gateway submits an admission request, it has preemption rights over `production`-class content consumers (OGA video, ComfyUI). The gateway and `ollama-inference` (IT/Admin) will both hold priority-llm leases; the arbiter accounts for their combined footprint.

### Admission request schema (confirmed)

```
POST /gpu/admission-request
Host: <s1-host>:8200
Headers:
  X-Consumer-Token: <static-token-for-S14A>    # JWT in S14-B; static for advisory scaffold
  Content-Type: application/json

Body:
{
  "consumer_id": "ai-platform-gateway",          # string, matches registry entry
  "requested_mb": 14336,                         # int, must be <= max_vram in registry
  "priority": "priority-llm",                   # "priority-llm" | "production" | "training" | "experimental"
  "duration_estimate_sec": 600,                  # int, lease duration hint
  "idle_unload_sec": 600,                        # int, auto-unload timer; 0 = monopolize
  "cpu_fallback_ok": false                       # bool; false = return 200 rejected, not degrade
}
```

Response schema: see ADR-008 §D5.1 (admitted / rejected / rejected-with-eviction variants).

### Auth for S14-A advisory mode

- S14-A (advisory = log-only, no enforcement): arbiter accepts **any well-formed `X-Consumer-Token` header** — it validates format but does not enforce token authenticity in advisory mode. Use a static UUID token for your scaffold: `X-Consumer-Token: aiplatform-scaffold-s14a-static`.
- S14-B (delegate = enforcing): full JWT validation. Issuance spec will be in ADR-009. CTO will provide draft schema 2 weeks before S14-B (target 2026-05-19).

---

## Q2 — Heartbeat Schema

**Short answer: your proposed schema is accepted with one field addition (`lease_id`). Endpoint confirmed as `POST /gpu/heartbeat`.**

### Confirmed heartbeat spec

```
POST /gpu/heartbeat
Host: <s1-host>:8200
Headers:
  X-Consumer-Token: <same token as admission>
  Content-Type: application/json

Body:
{
  "consumer_id": "ai-platform-gateway",
  "class": "priority-llm",
  "lease_id": "lease-uuid-or-null",   # ADDED — null if no active lease; correlates heartbeat to admission
  "timestamp": "2026-05-12T10:30:00Z",
  "health": "ok"                      # "ok" | "degraded" | "critical"
}

Response 200:
{ "ack": true, "lease_status": "active" | "expired" | "unknown" }
```

- **Interval**: 30 seconds (D4 confirmed)
- **Failure policy**: 2 consecutive missed heartbeats (60s window) → arbiter sends eviction notice to consumer. Consumer has 30s grace period to respond before force-unload.
- **Auth**: same `X-Consumer-Token` as admission request
- **Applicability**: `ai-platform-gateway` (priority-llm) → mandatory HTTP heartbeat. Voice service (`aiplatform-voice-vieneu`) → PID watch only (no HTTP heartbeat required; it is production/content class per D4 tier table).

---

## Q3 — Prometheus Scrape Topology

**Short answer: direct pull (arbiter scrapes gateway), no push required. Expose gateway metrics on a fixed host-port; no extra network attachment needed.**

### Topology

```
S1 Host (Ubuntu 22.04)
├── gpu-arbiter (systemd, 0.0.0.0:8200)
│   └── Prometheus: scrape targets config
│       ├── localhost:8200/metrics          (self)
│       ├── 127.0.0.1:8120/metrics         ← AI-Platform gateway [host-port]
│       └── 127.0.0.1:11434/metrics        ← Ollama [if metrics enabled]
│
└── Docker (172.19.0.0/16 ai-net)
    └── bflow-ai-gateway:8120/metrics
```

**AI-Platform action required**: publish gateway metrics port to loopback in your compose file:

```yaml
# docker-compose.yml — bflow-ai-gateway service
ports:
  - "127.0.0.1:8120:8120"   # metrics port, loopback-only (not exposed to LAN)
```

The arbiter (systemd on host) will scrape `http://127.0.0.1:8120/metrics` directly. No `ai-net` external network attachment needed for this; the host-port binding is sufficient. UFW allows loopback traffic by default — no rule change needed.

**If you already expose 8120 differently** (e.g. on `172.19.x.x` bridge only), provide the static container IP or use Docker DNS from host (`docker inspect bflow-ai-gateway | grep IPAddress`) and update the arbiter scrape config accordingly. Preferred approach is loopback binding as above.

---

## Q4 — Mac Mini SSH/Docker Access Timeline

**Short answer: 2026-06-14 is NOT confirmed. Hardware is expected early July. Realistic access date is 2026-07-03. CTO is flagging your access need to CEO for hardware acceleration decision.**

### Hardware timeline reality

| Milestone | CTO-confirmed date | AI-Platform impact |
|---|---|---|
| Mac Mini M4 Pro 48G delivery (expected) | Early July (circa 2026-07-01–03) | SSH/Docker access available after delivery + OS setup (~1 day) |
| JUL-A baseline benchmark start (ADR-008) | 2026-06-28 (assuming early delivery) | If machine arrives 07-01, JUL-A shifts to 2026-07-04 |
| JUL-B production cutover | 2026-07-03 (ADR-008 target) | Compresses if JUL-A slips |

**AI-Platform's 2026-06-14 access request** requires hardware delivery before mid-June, which is ahead of the current CEO delivery expectation. Two paths:

1. **CEO accelerates delivery** (e.g. order machine immediately): If ordered this week, delivery by late June is possible. CTO will escalate your 2026-06-14 need to @human (CEO) today so they can decide. If accelerated: you get access by ~2026-06-14 and a comfortable 3-week testing window before JUL-A.

2. **Hardware arrives July 1–3**: SSH/Docker access ~2026-07-03. AI-Platform gets ~2 weeks testing window (July 3–17). JUL-A and JUL-B milestone dates shift accordingly (both CTO and CPO must re-confirm). This is the fallback if CEO cannot accelerate.

**Action on OGA side**: CTO escalating to CEO today with explicit request: "AI-Platform needs Mac Mini SSH access by 2026-06-14 for 2-week pre-production benchmark window. Can we accelerate hardware procurement?"

> **2026-05-12 UPDATE**: After HO-F6 acceptance (see Q5 update), MPS compatibility no longer depends on Mac Mini delivery — CEO's personal M4 Pro 24G covers it. Production headroom (24G→48G) still requires the actual Mac Mini, but this is no longer P0 — drops to P1. Original CEO escalation continues but at reduced urgency.

**AI-Platform action**: Register your dependency formally. Update your sprint planning to show a hard dependency on "Mac Mini access >= 2026-06-14" with CEO-decides fallback date of 2026-07-03.

---

## Q5 — VieNeu Apple Silicon / MPS Status

> **2026-05-12 UPDATE — Scope redirect**: After this response, AI-Platform issued handoff HO-F6 requesting OGA run the MPS spike on CEO's personal M4 Pro 24G to unblock WS-C decision ~4-6 weeks earlier. **OGA accepted the handoff** — see [HANDOFF-F6-ACCEPTANCE-vineu-mps-ceo-m4pro-2026-05-12.md](HANDOFF-F6-ACCEPTANCE-vineu-mps-ceo-m4pro-2026-05-12.md). The S124 AI-Platform spike below is now superseded by the OGA-run F6 session. AI-Platform parallel work (Hùng A/B + adapter draft on CUDA) continues unchanged.

**Short answer (original): no MPS test done by OGA. AI-Platform S124 spike is pre-authorized — no duplication risk.**

### Current OGA status

- OGA's Spike E v3 (VieNeu solo eval) is pre-authorized but targets **S1 GPU** (RTX 5090 CUDA), not Mac Mini MPS. It fires when S1 GPU is freed + S118 adapter fix lands.
- No OGA engineer has tested `pnnbao/vieneu-tts:serve` on Apple Silicon MPS, not even in a dev/test configuration.
- ADR-008 D2 says "VieNeu is GPU-only for production path on Mac Mini target in July; CPU mode remains unsupported." MPS on Apple Silicon IS a GPU path, so D2 intent is to evaluate MPS as the Mac Mini equivalent of CUDA.

### Pre-authorization for AI-Platform S124 MPS spike

**CTO pre-authorizes AI-Platform to run S124 VieNeu MPS spike independently.** There is no duplication risk with OGA work. If AI-Platform's spike succeeds, it directly unblocks ADR-008 D2 and adds `aiplatform-voice-vieneu` to the Mac Mini consumer registry.

Spike success criteria (aligned with ADR-008 D2):
- `docker run --platform linux/arm64 pnnbao/vieneu-tts:serve` starts cleanly on Mac Mini M4 Pro
- Inference uses MPS (not CPU fallback) — verify via `mps` device in torch logs
- p50 latency < 2000ms for a 50-word Vietnamese script (same bar as S1 CUDA)
- MPS VRAM footprint measured and reported (expected ~2-4GB, confirm on 48GB)

Share spike report with OGA CTO. If MPS works: CTO will update D2 and ADR-008 D6 to mark `aiplatform-voice-vieneu` as "Active (Mac Mini MPS)" for post-cutover. This directly determines the WS-C voice path for July production.

---

## Registry update — what AI-Platform needs to PR

To complete the S14-A pre-registration:

1. **ADR-008 D6 table**: add `ai-platform-gateway` row (values above in Q1 section). PR to `OGA/docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md`.
2. **Heartbeat implementation**: wire `POST /gpu/heartbeat` (30s interval) from gateway. Use `http://host.docker.internal:8200/gpu/heartbeat` from inside Docker (already works via `extra_hosts` in voice compose).
3. **Gateway compose**: add `127.0.0.1:8120:8120` port binding for Prometheus scrape.
4. **No code changes needed for D5 (queue semantics)** — confirmed in acknowledgement.

---

## Summary table

| Question | Answer | Action owner | Deadline |
|---|---|---|---|
| Q1 — Registration API | `POST /gpu/admission-request`; D6 static config; auth = static token for S14-A | AI-Platform: PR to ADR-008 D6 | 2026-05-19 |
| Q2 — Heartbeat schema | `POST /gpu/heartbeat`; schema confirmed (add lease_id); 30s; 2-miss eviction | AI-Platform: implement heartbeat emitter | 2026-05-19 |
| Q3 — Prometheus scrape | Direct pull; host-port `127.0.0.1:8120:8120`; no extra network needed | AI-Platform: add port binding in compose | 2026-05-19 |
| Q4 — Mac Mini access | NOT confirmed for June 14; CTO escalating to CEO; fallback July 3 | CTO: escalate to CEO today | 2026-05-12 |
| Q5 — VieNeu MPS | No OGA tests done; AI-Platform S124 spike pre-authorized, no duplication | AI-Platform: plan S124 VieNeu MPS spike | S124 start |

---

*OGA @cto | ADR-008 Q1–Q5 responses | 2026-05-12 | Binding for S14-A scaffold window*
