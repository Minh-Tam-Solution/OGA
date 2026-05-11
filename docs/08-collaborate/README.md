# 08-collaborate — Collaborate

## Purpose

**Key Question:** Is the team EFFECTIVE?

This stage contains cross-functional handoff documents, IT admin requests, verification logs, and team coordination artifacts for Open-Generative-AI.

---

## Quality Gate Requirements

This stage feeds gate(s): **G-Sprint**

- [x] **G-Sprint**: Handoff docs complete, verification evidence captured, team alignment confirmed

---

## Dependencies

| Upstream Stage | What to Consume |
|---------------|-----------------|
| [04-build](../04-build/) | Build artifacts, package versions |
| [06-deploy](../06-deploy/) | Deploy guides, environment configs |
| [07-operate](../07-operate/) | Runbooks, monitoring procedures |

---

## Artifact Checklist — Stage 08 (Collaborate)

| Artifact | Required | Status | Owner | Path |
|----------|----------|--------|-------|------|
| IT Admin port request | ✅ Yes | ✅ Complete | @devops | [`itadmin-port-request-s1.md`](itadmin-port-request-s1.md) |
| IT Admin port response | ✅ Yes | ✅ Complete | @itadmin | [`itadmin-port-response-s1.md`](itadmin-port-response-s1.md) |
| GPU verification log | ✅ Yes | ✅ Complete | @coder | [`GPU-S1-VERIFICATION.md`](GPU-S1-VERIFICATION.md) |
| Sprint handoff (PM → GPU) | ✅ Yes | ✅ Complete | @pm | [`HANDOFF-SPRINT9-PM-GPU-SERVER.md`](HANDOFF-SPRINT9-PM-GPU-SERVER.md) |
| Sprint handoff (OGA Sprint 1) | ✅ Yes | ✅ Complete | @pm | [`HANDOFF-OGA-SPRINT1.md`](HANDOFF-OGA-SPRINT1.md) |
| Contributing guidelines | ⬜ Optional | 🔄 Pending | @pm | — |
| Team agreements | ⬜ Optional | 🔄 Pending | @pm | — |

---

## Handoff Chain

```
@coder  →  @devops  →  @itadmin  →  @pm (sign-off)
   │          │            │            │
   ▼          ▼            ▼            ▼
Build   →  Deploy   →  Network   →  Verify
         Runbook    Firewall     Gate Close
```

### Current Handoff Status: S1 External Deploy

| Step | From | To | Artifact | Status |
|------|------|-----|----------|--------|
| Code & build | @coder | @devops | Repo + `.env.production` | ✅ Ready |
| Deploy guide | @coder | @devops | `gpu-server-s1-external.md` | ✅ Ready |
| Port allocation | @itadmin | — | `PORT_ALLOCATION_MANAGEMENT.md` v4.2 | ✅ Done |
| Port request | @devops | @itadmin | `itadmin-port-request-s1.md` | ✅ Sent |
| S1 hardening | @itadmin | @devops | `HOST=127.0.0.1`, IP confirmed | ✅ Done |
| CPO review | @pm | — | Port mapping + deploy docs | ✅ Approved |
| NAT apply (router) | @itadmin | @devops | `80/443 → 192.168.2.2` | ✅ Done |
| SSL + proxy | @devops | @devops | NPM / Nginx config → `192.168.2.2:3005` | ✅ Done |
| Smoke test | @devops | @pm | CPO-approved 4-check smoke | ✅ Passed |
| Gate close | @pm | — | Sign-off table | 🔄 Pending PM sign-off |

**Key facts from @itadmin response & port allocation doc:**
- S1 LAN IP: `192.168.2.2` (confirmed)
- Public IP: `118.69.128.23` (DNS A record set)
- FastAPI hardened: binds `127.0.0.1:8000` only (external `:8000` refused)
- OGA frontend port: **`3005`** (avoids Open WebUI `3000` + nqh_grafana `3004`)
- Router NAT `80/443 → 192.168.2.2` is active
- Cloudflare Tunnel backup: `studio.nqh.vn` reserved (optional)
- Port `8000` must remain localhost-only per security policy

**CPO Approval Round 1 (`2.txt:981-1015`):**
- ✅ Approve port mapping: `Frontend=3005`, `API=127.0.0.1:8000`
- ✅ Keep `studio.nqh.vn` as DR/backup only
- ✅ Mandatory pre-deploy check: fail nếu `3005` đã bị chiếm
- ✅ Mandatory post-deploy smoke: 4-check checklist (frontend + backend + HTTP + HTTPS)

**CPO Approval Round 2 (`2.txt:984-1015`) — FINAL PORT ALLOCATION FREEZE:**
- ✅ **Final port allocation approved**: `Frontend=localhost:3005`, `Backend=127.0.0.1:8000`
- ✅ **No further port changes** for this deployment cycle
- ✅ Preflight hard-fail nếu `3005` bị chiếm (không warning)
- ✅ Smoke domain check: verify HTTP `301` redirect + HTTPS `mflux_reachable=true` (OGA đúng route)
- **Current state (2026-05-08):** `studio.nhatquangholding.com` is live on HTTPS with a dedicated Let's Encrypt certificate. NPM reverse proxy now reaches host-native OGA via UFW allow `172.19.0.0/16 -> 3005/tcp`.
- **Next:** @pm final sign-off / gate close.

---

## Verification Evidence

All verification evidence for GPU Server S1 is centralized in [`GPU-S1-VERIFICATION.md`](GPU-S1-VERIFICATION.md):

- Phase 1: Build results (`npm run build` 0 errors)
- Phase 2: Test results (144/144 pass)
- Phase 3: Smoke E2E (`runtime_device == "cuda"`)
- Phase 4: Operational requirements & startup gate mandate

---

## Cross-Functional Requests

| Request | To | Status | Doc |
|---------|-----|--------|-----|
| S1 security hardening (`HOST=127.0.0.1`) | @itadmin | ✅ Resolved | [`itadmin-port-response-s1.md`](itadmin-port-response-s1.md) §1.2 |
| S1 IP confirmation + DNS A record | @itadmin | ✅ Resolved | [`itadmin-port-response-s1.md`](itadmin-port-response-s1.md) §1.1 |
| NAT port forwarding (80, 443 → 192.168.2.2) | @itadmin | ✅ Resolved | [`itadmin-port-request-s1.md`](itadmin-port-request-s1.md) |
| GPU driver / CUDA support | @itadmin | ✅ Resolved | [`GPU-S1-VERIFICATION.md`](GPU-S1-VERIFICATION.md) §Root Cause |
| MPS service stop + compute mode | @itadmin | ✅ Resolved | [`GPU-S1-VERIFICATION.md`](GPU-S1-VERIFICATION.md) §Root Cause |

---

*Generated by EndiorBot — SDLC Framework v6.3.0 | Updated by @devops 2026-05-07*
