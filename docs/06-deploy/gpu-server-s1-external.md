# GPU Server S1 — External Domain Deploy Guide

**Target:** `studio.nhatquangholding.com` → GPU Server S1 (Ubuntu 22.04+, RTX 5090)
**Services:** Next.js frontend (port **3005**) + FastAPI inference server (port 8000)

> **Port Allocation — FINAL FREEZE (CPO approved `2.txt:984-1015`):**
> - `3005` → OGA Next.js frontend (final, no further changes without CPO approval)
> - `8000` → OGA FastAPI backend (internal-only, `HOST=127.0.0.1`)
> - `3000` occupied by **Open WebUI** (`chat.nhatquangholding.com`)
> - `3004` occupied by **nqh_grafana**
> - Per [`PORT_ALLOCATION_MANAGEMENT.md`](../../../models/core/docs/admin/infrastructure/PORT_ALLOCATION_MANAGEMENT.md) v4.2
**Owner:** @devops
**S1 LAN IP:** `192.168.2.2`
**Public IP:** `118.69.128.23`
**Last Updated:** 2026-05-08

> **Live Status (2026-05-08):** `https://studio.nhatquangholding.com/auth` is live via Nginx Proxy Manager with a dedicated Let's Encrypt certificate. HTTP ingress redirects to HTTPS. UFW explicitly allows NPM Docker subnet `172.19.0.0/16` to reach host-native OGA frontend on `3005/tcp`.

---

## Architecture

```
Internet ──→ Router/NAT ──→ S1 (192.168.2.2)
                                      │
                                      ▼
                              ┌───────────────┐
                              │   Nginx / NPM │  :443 SSL termination
                              │   (reverse    │  :80 → 443 redirect
                              │    proxy)     │
                              └───────┬───────┘
                                      │
                              ┌───────┴───────┐
                              │  Next.js      │  :3005 (Node.js)
                              │  (frontend)   │     `npm run start -p 3005`
                              └───────┬───────┘
                                      │
                              ┌───────┴───────┐
                              │  FastAPI      │  :8000 (Python)
                              │  (diffusers)  │     `HOST=127.0.0.1`
                              └───────────────┘
```

- **Nginx/NPM** terminates SSL and proxies all traffic to Next.js `:3005`.
- **Next.js** API routes (`/api/v1/*`, `/api/health`) proxy to FastAPI `:8000` via `LOCAL_API_URL`.
- **FastAPI** binds to `127.0.0.1:8000` only (enforced by `HOST` env var, applied by @itadmin). Direct external access to `:8000` is refused.
- **Port 3005** is allocated for OGA to avoid conflict with Open WebUI on `3000` per IT Admin port allocation table.
- **Firewall bridge** is required because OGA runs natively on S1 while NPM runs in Docker. Allow `172.19.0.0/16 -> tcp/3005` on UFW so NPM can proxy into the host app.

---

## Prerequisites

| Check | Command |
|-------|---------|
| Node.js 20.x | `node -v` |
| Python 3.12 + venv | `python3 --version && ls .venv/bin/python3` |
| NVIDIA driver 595+ | `nvidia-smi` |
| CUDA 12.8 (PyTorch nightly) | `python3 -c "import torch; print(torch.version.cuda)"` |
| npm build already green | `npm run build` exits 0 |

---

## 1. Set Production Environment

Copy the production env template and fill secrets:

```bash
cd /home/nqh/shared/OGA        # adjust to actual clone path on S1
cp .env.production .env.local

# EDIT .env.local — set real values:
#   ACCESS_PIN=xxxxxx
#   SESSION_SECRET=$(openssl rand -hex 32)
```

**Critical:** Do **not** set `OGA_FORCE_CPU=true`. The startup gate (§5) will block traffic if GPU is unavailable.

---

## 2. Build

```bash
git submodule update --init --recursive
npm install
npm run build:packages
npm run build
```

Expected: `○  (Static)  prerendered 10 static pages`, exit code 0.

---

## 3. Reverse Proxy + SSL

Choose **Option A** (Nginx native) or **Option B** (Nginx Proxy Manager with GUI).

---

### Option A — Nginx Native (Command Line)

```bash
sudo apt update
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/studio.nhatquangholding.com`:

```nginx
server {
    listen 80;
    server_name studio.nhatquangholding.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name studio.nhatquangholding.com;

    ssl_certificate     /etc/letsencrypt/live/studio.nhatquangholding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/studio.nhatquangholding.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
sudo ln -sf /etc/nginx/sites-available/studio.nhatquangholding.com \
            /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d studio.nhatquangholding.com
```

Follow prompts. Certbot will auto-update the nginx config above.

---

### Option B — Nginx Proxy Manager (NPM) ⭐ Recommended for GUI Management

If IT Admin prefers a web UI for managing reverse proxies and SSL certificates.

#### B1. Stop native Nginx (if installed) to avoid port conflict

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

#### B2. Start NPM via Docker Compose

```bash
cd /home/nqh/shared/OGA
docker compose -f docker-compose.proxy.yml up -d
```

Ports exposed by NPM:
- `80`   — HTTP (public)
- `443`  — HTTPS (public)
- `81`   — NPM Admin UI (internal LAN access only)

#### B3. Initial NPM Setup

1. Open `http://192.168.2.2:81` in a browser
2. Default login:
   - Email: `admin@example.com`
   - Password: `changeme`
3. **Immediately change the default email and password**
4. Go to **Dashboard → Hosts → Proxy Hosts → Add Proxy Host**
   - **Domain Names:** `studio.nhatquangholding.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `localhost`
   - **Forward Port:** `3005`
   - ✅ **Cache assets**
   - ✅ **Block Common Exploits**
5. Switch to the **SSL** tab:
   - **SSL Certificate:** `Request a new SSL Certificate`
   - ✅ **Force SSL**
   - ✅ **HTTP/2 Support**
   - ✅ **HSTS Enabled**
   - **Agree to Let's Encrypt ToS**
6. Click **Save**

NPM will automatically provision and renew the Let's Encrypt certificate.

#### B4. Lock down Admin UI (Optional but Recommended)

Restrict port `81` to LAN/VPN only at the router/firewall level so the NPM admin panel is not exposed to the public internet.

---

## 5. Systemd Services

### 5a. FastAPI Inference Server

Create `/etc/systemd/system/oga-inference.service`:

```ini
[Unit]
Description=NQH Creative Studio — FastAPI Inference Server
After=network.target

[Service]
Type=simple
User=nqh
WorkingDirectory=/home/nqh/shared/OGA
Environment="PATH=/home/nqh/shared/OGA/.venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PORT=8000"
Environment="HOST=127.0.0.1"
Environment="INFERENCE_ENGINE=diffusers"
Environment="OGA_FORCE_CPU=false"
ExecStart=/home/nqh/shared/OGA/.venv/bin/python3 local-server/server.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> **Security note:** @itadmin has enforced `HOST=127.0.0.1` as the default bind in `server.py`. FastAPI will refuse connections from `192.168.2.2:8000` or external sources. Only Next.js on localhost can reach `:8000`.

### 5b. Next.js Frontend

Create `/etc/systemd/system/oga-frontend.service`:

```ini
[Unit]
Description=NQH Creative Studio — Next.js Frontend
After=network.target oga-inference.service

[Service]
Type=simple
User=nqh
WorkingDirectory=/home/nqh/shared/OGA
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="NODE_ENV=production"
Environment="NEXT_PUBLIC_LOCAL_MODE=true"
Environment="LOCAL_API_URL=http://localhost:8000"
Environment="ACCESS_PIN=CHANGE_ME"
Environment="SESSION_SECRET=CHANGE_ME_LONG_RANDOM_STRING"
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3005
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> **Important:** Replace `User=nqh`, `WorkingDirectory`, `PATH`, `ACCESS_PIN`, and `SESSION_SECRET` with real values. The `ACCESS_PIN` and `SESSION_SECRET` must match what you set in `.env.local` (§1).

### 5c. Enable & Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable oga-inference oga-frontend
sudo systemctl start oga-inference

# Wait for pipeline cold load (~10-30s depending on model cache)
sleep 30

# ── MANDATORY STARTUP GATE ──
curl -s http://localhost:8000/health | jq -e '.runtime_device == "cuda"'
# Expected: exit code 0
# If non-zero: STOP. Do not start frontend. Investigate GPU/CUDA.

sudo systemctl start oga-frontend
```

---

## 6. Verify

### 6a. Internal Health

```bash
# FastAPI direct
curl -s http://localhost:8000/health | jq

# Next.js health (proxied)
curl -s http://localhost:3005/api/health | jq
```

Expected FastAPI health:
```json
{
  "status": "ok",
  "engine": "diffusers",
  "runtime_device": "cuda",
  "pipeline_state": "ready",
  "model": "Z-Image Turbo",
  "utilities": { "rembg": true }
}
```

### 6b. External Health (via domain)

```bash
curl -s https://studio.nhatquangholding.com/api/health | jq
```

Should return Next.js health with `mflux_reachable: true`.

### 6c. PIN Gate

Browse to `https://studio.nhatquangholding.com` → should redirect to `/auth`. Enter `ACCESS_PIN` → should grant access.

---

## 6d. Mandatory Post-Deploy Smoke Checklist (CPO Approved)

> **Source:** CPO review `2.txt:981-1015` — must pass before declaring go-live.

Run in order:

```bash
# 1. Frontend port is listening on localhost:3005
curl -sf http://localhost:3005/api/health | jq -e '.status == "ok"'
# Expected: exit 0

# 2. Backend is listening on 127.0.0.1:8000 AND runtime_device == "cuda"
curl -sf http://127.0.0.1:8000/health | jq -e '.runtime_device == "cuda"'
# Expected: exit 0

# 3. Domain HTTP ingress — must redirect to HTTPS (301/308)
curl -sfI http://studio.nhatquangholding.com/api/health
# Expected: HTTP/1.1 301 Moved Permanently

# 4. Domain HTTPS ingress — must route to OGA (mflux_reachable proves full chain)
curl -sf https://studio.nhatquangholding.com/api/health | jq -e '.mflux_reachable == true and .status == "ok"'
# Expected: exit 0
```

**If any check fails → STOP. Do not declare go-live.**

> **Verification note (2026-05-08):** all four smoke checks passed on S1 after NAT activation, NPM route creation, UFW bridge allowance, and Let's Encrypt issuance for `studio.nhatquangholding.com`.

| Check | Command | Pass Criteria | Owner |
|-------|---------|---------------|-------|
| Frontend up | `curl localhost:3005/api/health` | `status == "ok"` | @devops |
| Backend GPU | `curl 127.0.0.1:8000/health` | `runtime_device == "cuda"` | @devops |
| Domain HTTP | `curl -I http://studio...` | `301` redirect to HTTPS | @devops |
| Domain HTTPS | `curl https://studio.../api/health` | `mflux_reachable == true` + `status == "ok"` | @devops |
| CPO sign-off | — | All 4 checks pass | @pm |

---

## 7. Reboot Test

```bash
sudo reboot
# After boot:
curl -s https://studio.nhatquangholding.com/api/health | jq
```

Both services should auto-start via systemd.

---

## 8. Logs & Monitoring

```bash
# FastAPI
sudo journalctl -u oga-inference -f

# Next.js
sudo journalctl -u oga-frontend -f

# Nginx (native)
sudo tail -f /var/log/nginx/studio.nhatquangholding.com-error.log

# Nginx Proxy Manager (Docker)
docker logs -f nginx-proxy-manager
```

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `runtime_device == "cpu"` | GPU unavailable / MPS running / wrong driver | Check `nvidia-smi`, stop MPS, verify CUDA 12.8. See `docs/08-collaborate/GPU-S1-VERIFICATION.md` |
| Next.js `502` on `/api/v1/*` | FastAPI not running or wrong `LOCAL_API_URL` | `systemctl status oga-inference`, verify `LOCAL_API_URL=http://localhost:8000` |
| Nginx `502 Bad Gateway` | Nothing on `:3005` | `systemctl status oga-frontend`, check `node` path |
| Port 3005 in use | nqh_grafana or other service already bound | `sudo lsof -i :3005`, check [`PORT_ALLOCATION_MANAGEMENT.md`](../../../models/core/docs/admin/infrastructure/PORT_ALLOCATION_MANAGEMENT.md) |
| SSL warning | Certbot not run or expired | `sudo certbot renew --dry-run` (native) or check NPM SSL expiry |
| NPM admin UI unreachable | Port 81 blocked by firewall | Ask @itadmin to allow TCP 81 on LAN/VPN |
| NPM "Bad Gateway" | Next.js not running on :3005 | `systemctl status oga-frontend` |
| OOM during model load | ollama or other processes consume VRAM | `nvidia-smi`, stop non-essential GPU consumers |
| Port 3000/8000 in use | Previous process not killed | `sudo lsof -i :3000` / `:8000`, `sudo kill -9 <pid>` |

---

## Operational Checklist

- [ ] `.env.local` created from `.env.production`, secrets changed
- [ ] `npm run build` passes (0 errors)
- [ ] `curl localhost:8000/health` → `runtime_device == "cuda"`
- [ ] FastAPI binds `127.0.0.1:8000` only (verified by @itadmin)
- [ ] Next.js listens on `localhost:3005` (no conflict with Open WebUI on `3000`)
- [ ] Nginx / NPM config active
- [ ] SSL certificate active (`https://` works)
- [ ] Router NAT `80/443 → 192.168.2.2` confirmed by @itadmin
- [ ] systemd services enabled (`systemctl is-enabled oga-inference oga-frontend`)
- [ ] Reboot test passed
- [ ] PIN gate functional
- [ ] @pm notified for sign-off

---

*NQH Creative Studio | Deploy Guide v1.0 | S1 External Domain*
