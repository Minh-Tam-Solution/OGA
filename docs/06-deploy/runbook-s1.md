# Runbook — GPU Server S1 Production Operations

**Environment:** `studio.nhatquangholding.com` → GPU Server S1  
**S1 LAN IP:** `192.168.2.2`  
**Public IP:** `118.69.128.23`  
**Owner:** @devops  
**Escalation:** @itadmin (network/firewall), @architect (system design)  
**Last Updated:** 2026-05-08

---

## 1. Service Inventory

| Service | Process | Port | Manager | Auto-start |
|---------|---------|------|---------|------------|
| Next.js Frontend | `node next start -p 3005` | `3005` (host-native, reachable from NPM Docker subnet) | systemd `oga-frontend` | ✅ |
| FastAPI Inference | `python server.py` | `8000` (`127.0.0.1`) | systemd `oga-inference` | ✅ |
| Nginx Native | `nginx` | `80`, `443` | systemd `nginx` | ✅ |
| Nginx Proxy Manager | `docker` | `80`, `443`, `81` | Docker Compose | ✅ |

**Port Allocation Context:**
- S1 port `3000` is allocated to **Open WebUI** (`chat.nhatquangholding.com`).
- Port `3004` was initially reserved but is occupied by **nqh_grafana**.
- @itadmin approved **3005** for OGA frontend (per [`PORT_ALLOCATION_MANAGEMENT.md`](../../../models/core/docs/admin/infrastructure/PORT_ALLOCATION_MANAGEMENT.md) v4.2).
- Port `8000` is localhost-only (`HOST=127.0.0.1`) per IT Admin security policy.
- UFW allows NPM Docker subnet `172.19.0.0/16` to access `3005/tcp` so reverse proxy can reach the host-native frontend.

> Only one reverse proxy (native **or** NPM) should be active at a time.

---

## 2. Daily Health Check

Run once per day or after any restart:

```bash
# 1. systemd status
sudo systemctl is-active oga-inference oga-frontend

# 2. GPU runtime gate (CRITICAL)
curl -s http://localhost:8000/health | jq -e '.runtime_device == "cuda"'
# Expected: exit 0

# 3. End-to-end via domain
curl -s https://studio.nhatquangholding.com/api/health | jq
# Expected: status ok, mflux_reachable true

# 4. VRAM headroom
nvidia-smi --query-gpu=name,memory.used,memory.free --format=csv
# Expected: memory.free > 4GB (to accommodate inference spikes)
```

If any check fails → see [Section 6: Incident Response](#6-incident-response).

---

## 3. Common Procedures

### 3a. Restart Services (Rolling)

```bash
# Restart inference only (keep frontend serving static pages)
sudo systemctl restart oga-inference
sleep 30
curl -s http://localhost:8000/health | jq -e '.runtime_device == "cuda"'

# Restart frontend
sudo systemctl restart oga-frontend
```

### 3b. Full Redeploy (New Build)

```bash
cd /home/nqh/shared/OGA
./scripts/deploy-s1.sh
```

### 3c. View Logs

```bash
# Real-time
curl -s https://studio.nhatquangholding.com/api/health | jq

# FastAPI inference
sudo journalctl -u oga-inference -f -n 200

# Next.js frontend
sudo journalctl -u oga-frontend -f -n 200

# Nginx native
sudo tail -f /var/log/nginx/studio.nhatquangholding.com-error.log

# Nginx Proxy Manager
docker logs -f nginx-proxy-manager --tail 200
```

### 3d. SSL Certificate Renewal Check

**Native Nginx:**
```bash
sudo certbot renew --dry-run
```

**NPM:**
- Open UI → Hosts → click icon `Renew Now` on `studio.nhatquangholding.com`
- Or check SSL expiry column.

### 3e. Post-Deploy Smoke Checklist (CPO Approved — Final Port Allocation Freeze)

Mandatory after every deploy or restart. All must pass before go-live:

```bash
# 1. Frontend localhost:3005
curl -sf http://localhost:3005/api/health | jq -e '.status == "ok"'

# 2. Backend GPU gate (127.0.0.1:8000)
curl -sf http://127.0.0.1:8000/health | jq -e '.runtime_device == "cuda"'

# 3. Domain HTTP ingress — verify 301/308 redirect to HTTPS
curl -sfI http://studio.nhatquangholding.com/api/health | grep -q '301\|308'

# 4. Domain HTTPS ingress — verify OGA full chain (nginx → Next.js → FastAPI)
curl -sf https://studio.nhatquangholding.com/api/health | jq -e '.mflux_reachable == true and .status == "ok"'
```

> **Policy:** If any check fails, do **not** declare go-live. Investigate and rerun.
> **Port Freeze:** `3005` is the final approved frontend port. No further changes without CPO approval.
> **Current state (2026-05-08):** `studio.nhatquangholding.com` is live on HTTPS with a dedicated Let's Encrypt certificate and passing end-to-end smoke checks.

---

## 4. Monitoring Checklist

| Metric | Check Frequency | Threshold | Action |
|--------|----------------|-----------|--------|
| `runtime_device` | Every health check | Must be `"cuda"` | Stop traffic, investigate GPU |
| GPU memory free | Every health check | `< 4 GB` | Kill non-essential GPU processes (e.g., ollama) |
| Disk usage | Weekly | `> 85%` | Clean `/tmp`, model cache, logs |
| Uptime | Continuous | Unexpected restart | Check `journalctl` for crash reason |
| SSL expiry | Weekly | `< 7 days` | Renew cert (native: `certbot renew`, NPM: UI) |
| NPM Admin UI | Monthly | Accessible on LAN:81 | Verify password, review proxy hosts |

---

## 5. Backup & Recovery

### What to Back Up

```bash
# 1. Environment secrets
/home/nqh/shared/OGA/.env.local

# 2. Systemd service files
/etc/systemd/system/oga-*.service

# 3. Nginx config (if native)
/etc/nginx/sites-available/studio.nhatquangholding.com

# 4. NPM data (if NPM)
/home/nqh/shared/OGA/npm-data/
/home/nqh/shared/OGA/npm-letsencrypt/
```

### Recovery (Total Rebuild on Fresh S1)

```bash
# 1. Restore code & venv
git clone ... /home/nqh/shared/OGA
cd /home/nqh/shared/OGA && python3 -m venv .venv && .venv/bin/pip install -r local-server/requirements-linux-blackwell.txt

# 2. Restore .env.local
# (paste backed-up content)

# 3. Restore systemd / nginx / NPM
# (paste backed-up service files & config)

# 4. Run deploy script
./scripts/deploy-s1.sh
```

---

## 6. Incident Response

### P1 — `runtime_device == "cpu"` (GPU Down)

1. **Do not restart frontend.** Keep serving static / error page if possible.
2. Check GPU:
   ```bash
   nvidia-smi
   # If MPS is running:
   sudo systemctl stop nvidia-cuda-mps-server
   sudo nvidia-smi -c 0  # set compute mode to Default
   ```
3. Restart inference:
   ```bash
   sudo systemctl restart oga-inference
   sleep 30
   curl -s http://localhost:8000/health | jq -e '.runtime_device == "cuda"'
   ```
4. If still CPU → escalate to @itadmin (driver/hardware) and @architect.
5. Once gate passes, restart frontend:
   ```bash
   sudo systemctl restart oga-frontend
   ```

### P1 — Service Crash Loop

```bash
# Check last 100 lines
sudo journalctl -u oga-inference -n 100 --no-pager

# Common causes:
# - OOM → check nvidia-smi, kill ollama or other GPU consumers
# - Port conflict → sudo lsof -i :8000 or :3005
# - Missing env var → verify .env.local exists and secrets set
```

### P2 — SSL Expired

- **Native:** `sudo certbot renew --force-renewal -d studio.nhatquangholding.com && sudo systemctl reload nginx`
- **NPM:** Open UI → Hosts → `Renew Now` → force SSL.

### P2 — Domain Unreachable (External)

1. Check NAT rules with @itadmin:
   ```bash
   # From outside network:
   curl -I http://studio.nhatquangholding.com
   curl -I https://studio.nhatquangholding.com
   ```
2. Check public IP hasn't changed (if dynamic):
   ```bash
   curl -s https://api.ipify.org
   ```
3. Check DNS A record resolves correctly:
   ```bash
   dig studio.nhatquangholding.com +short
   ```

### P3 — High VRAM Usage

```bash
nvidia-smi
# Identify top GPU consumers
sudo fuser -v /dev/nvidia*
# If ollama consuming >20GB and not needed:
sudo systemctl stop ollama  # or docker stop ollama
```

---

## 7. Contact Escalation

| Issue | First Contact | Escalation |
|-------|--------------|------------|
| Network / NAT / Firewall | @itadmin | — |
| GPU / Driver / CUDA | @itadmin | NVIDIA support |
| Application crash / bug | @devops | @coder, @architect |
| SSL / Domain / DNS | @devops | @itadmin |
| Security incident | @devops | @architect, @pm |

---

## 8. Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-07 | Initial runbook for S1 external deploy | @devops |

---

*Generated by EndiorBot — SDLC Framework v6.3.0*
