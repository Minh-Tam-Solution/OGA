# IT Admin Request — NAT / Port Forwarding for GPU Server S1

**To:** @itadmin  
**From:** @devops / OGA Deploy Team  
**Date:** 2026-05-06  
**Priority:** High  
**Ticket Type:** Network / Firewall / NAT Configuration

---

## 1. Purpose

Enable external public access to **NQH Creative Studio** (`studio.nhatquangholding.com`) hosted on **GPU Server S1**.

The application stack requires HTTP/HTTPS traffic to be forwarded from the public internet through the router/firewall to S1.

---

## 2. Service Overview

| Layer | Service | Internal Port | Internal IP | Protocol | Notes |
|-------|---------|---------------|-------------|----------|-------|
| Public entry | Domain `studio.nhatquangholding.com` | — | — | DNS | A record → Public IP của router |
| Reverse Proxy | Nginx | `80` / `443` | S1 | TCP | SSL termination + proxy to Next.js |
| Frontend | Next.js | `3005` | S1 | TCP | Node.js app (internal only, Nginx → localhost:3005). Port 3005 chosen to avoid conflict with Open WebUI on `3000`. |
| Backend API | FastAPI (Diffusers) | `8000` | S1 | TCP | Python inference server (internal only, Next.js API routes → localhost:8000) |

> **Important:** Only ports `80` and `443` need to be exposed to the internet. Ports `3000` and `8000` are localhost-only on S1 and must NOT be forwarded directly from the router.

---

## 3. Required NAT / Port Forwarding Rules

### 3a. IPv4 Port Forwarding (Router/Firewall → S1)

| External Port | Protocol | Internal IP | Internal Port | Description |
|---------------|----------|-------------|---------------|-------------|
| `80` | TCP | `S1_INTERNAL_IP` | `80` | HTTP redirect to HTTPS |
| `443` | TCP | `S1_INTERNAL_IP` | `443` | HTTPS — Nginx SSL termination |
| `81`¹ | TCP | `S1_INTERNAL_IP` | `81` | Nginx Proxy Manager Admin UI (LAN/VPN only) |

> Replace `S1_INTERNAL_IP` with the actual LAN IP of GPU Server S1 (e.g., `10.0.0.x` or `192.168.1.x`).
>
> ¹ Port `81` is only needed if using **Nginx Proxy Manager** (Option B in deploy guide). If using native Nginx (Option A), port `81` can be omitted.

### 3b. Firewall Rules (if applicable)

Allow inbound TCP `80` and `443` from `ANY` (or restrict to VN/VPN ranges if security policy requires).

If using **Nginx Proxy Manager** (Option B), also allow inbound TCP `81` but **restrict to LAN/VPN ranges only** — the NPM admin UI must not be exposed to the public internet.

Block direct inbound to ports `3000` and `8000` from external sources.

---

## 4. DNS Record

Please confirm or create the following DNS A record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `studio.nhatquangholding.com` | `[Public IP của router/firewall]` | 300 |

> If the public IP is dynamic, please advise on DDNS setup or static IP assignment.

---

## 5. SSL Certificate

SSL will be handled internally on S1 via **Let's Encrypt + Certbot** (nginx plugin). No SSL offloading required at the router/firewall level unless preferred.

If the router performs SSL inspection / deep packet inspection, please whitelist `studio.nhatquangholding.com` to avoid breaking the certbot challenge or client connections.

---

## 6. Verification Steps for @itadmin

After applying NAT rules, please run:

```bash
# From outside the LAN
curl -I http://studio.nhatquangholding.com
# Expected: HTTP/1.1 301 Moved Permanently (redirect to HTTPS)

curl -I https://studio.nhatquangholding.com
# Expected: HTTP/1.1 200 OK
```

Or provide the public IP so @devops can verify from S1:

```bash
curl -s https://api.ipify.org
```

---

## 7. Rollback / Emergency

If issues arise, @itadmin can temporarily disable the port forward rules. S1 will continue running internally without external exposure. @devops will handle application-level shutdown if needed.

---

## 8. Related Docs

- Deploy guide: `docs/06-deploy/gpu-server-s1-external.md`
- GPU verification log: `docs/08-collaborate/GPU-S1-VERIFICATION.md`

---

**Approval Required:** Yes — please confirm when NAT rules are applied so @devops can proceed with SSL cert provisioning and final smoke tests.

**Contact:** @devops (OGA Deploy Team)
