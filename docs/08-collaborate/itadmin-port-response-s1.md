# IT Admin Response — NAT / Port Forwarding for GPU Server S1

**To:** @devops / OGA Deploy Team  
**From:** @itadmin  
**Date:** 2026-05-07  
**Related Request:** `docs/08-collaborate/itadmin-port-request-s1.md`

---

## 1) Scope handled on S1 (completed)

### 1.1 Confirmed S1 LAN IP and DNS target

- S1 internal IP: `192.168.2.2`
- DNS A for `studio.nhatquangholding.com`: `118.69.128.23`

### 1.2 Enforced backend API localhost-only (security hardening)

Per request, FastAPI `:8000` must not be exposed directly.

Actions applied:
- Updated OGA backend startup to bind host from env `HOST`, default `127.0.0.1`
- Restarted OGA API on `HOST=127.0.0.1 PORT=8000`

Code change:
- File: `/home/nqh/shared/OGA/local-server/server.py`
- Before: `uvicorn.run(app, host="0.0.0.0", port=port)`
- After: `uvicorn.run(app, host=host, port=port)` with `host = os.environ.get("HOST", "127.0.0.1")`

Validation:
- `ss -ltnp '( sport = :8000 )'` shows listen on `127.0.0.1:8000`
- `curl http://127.0.0.1:8000/health` returns `status: ok`, `runtime_device: cuda`
- `curl http://192.168.2.2:8000/health` is refused

Result: requirement "ports 3000/8000 internal-only" is now enforced for API `:8000` at host bind level.

---

## 2) NAT / Router status (pending action outside S1)

Public checks from current environment:
- `curl -I http://studio.nhatquangholding.com` -> timeout
- `curl -I https://studio.nhatquangholding.com` -> timeout

Interpretation:
- External path to studio is not reachable yet.
- NAT/port forwarding on router/firewall for `80/443 -> 192.168.2.2:80/443` still needs to be applied/verified.

Requested router rules (as per [`PORT_ALLOCATION_MANAGEMENT.md`](../../../models/core/docs/admin/infrastructure/PORT_ALLOCATION_MANAGEMENT.md) v4.2):
- TCP `80` -> `192.168.2.2:80`
- TCP `443` -> `192.168.2.2:443`
- Do not forward `3005` or `8000` (internal-only ports)

---

## 3) Additional note

No active nginx `server_name studio.nhatquangholding.com` entry was found in current enabled nginx configs on S1.  
After NAT is applied, @devops should provision/enable the vhost + SSL (Certbot) for `studio.nhatquangholding.com` to complete go-live.

---

## 4) Port Allocation Confirmation

Per [`PORT_ALLOCATION_MANAGEMENT.md`](../../../models/core/docs/admin/infrastructure/PORT_ALLOCATION_MANAGEMENT.md) v4.2 (updated 2026-05-07):

| Port | Service | Status |
|------|---------|--------|
| `80/443` | Edge ingress (nginx/NPM) → OGA | 🆕 Allocated, pending NAT |
| `3005` | OGA Next.js frontend | 🆕 Allocated (avoids Open WebUI `3000` + nqh_grafana `3004`) |
| `8000` | OGA FastAPI backend | 🆕 Internal-only, `HOST=127.0.0.1` enforced |
| `81` | NPM Admin UI (LAN-only) | 🆕 If using NPM |

Cloudflare Tunnel backup route `studio.nqh.vn` is also reserved.

## 5) Handoff

Ready for @devops smoke test immediately after router NAT is confirmed:

```bash
curl -I http://studio.nhatquangholding.com
curl -I https://studio.nhatquangholding.com
```

If needed, @itadmin can support quick verification from gateway/router side for inbound 80/443 hits.
