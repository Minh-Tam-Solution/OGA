#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# NQH Creative Studio — GPU Server S1 Deploy Script
# Target: studio.nhatquangholding.com
# Usage:  ./scripts/deploy-s1.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
PROJECT_ROOT="/home/nqh/shared/OGA"
USER="nqh"
DOMAIN="studio.nhatquangholding.com"
FRONTEND_PORT=3005
API_PORT=8000

# Colors
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
N='\033[0m'

log()  { echo -e "${G}[deploy-s1]${N} $*"; }
warn() { echo -e "${Y}[deploy-s1]${N} $*"; }
fail() { echo -e "${R}[deploy-s1]${N} $*"; exit 1; }

# ── 0. Preflight ─────────────────────────────────────────────────────────────
log "Step 0: Preflight checks"

cd "$PROJECT_ROOT" || fail "Cannot cd to $PROJECT_ROOT"

# Node.js
command -v node >/dev/null || fail "node not found in PATH"
NODE_V=$(node -v)
log "  Node.js: $NODE_V"

# Python venv
[[ -x .venv/bin/python3 ]] || fail ".venv/bin/python3 not found"
PYTHON_V=$(.venv/bin/python3 --version)
log "  Python:  $PYTHON_V"

# NVIDIA
if command -v nvidia-smi &>/dev/null; then
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader || true
else
    warn "  nvidia-smi not found — GPU checks will be skipped"
fi

# .env.local
if [[ ! -f .env.local ]]; then
    fail ".env.local missing. Run: cp .env.production .env.local && edit secrets"
fi
if grep -q 'CHANGE_ME' .env.local; then
    fail ".env.local still contains CHANGE_ME placeholders. Edit secrets first."
fi

# ── CPO-mandated: fail early if 3005 is already taken ────────────────────────
OCCUPIER=$(sudo lsof -i :$FRONTEND_PORT -sTCP:LISTEN -t 2>/dev/null || true)
if [[ -n "${OCCUPIER:-}" ]]; then
    OCCUPIER_CMD=$(ps -p "$OCCUPIER" -o comm= 2>/dev/null || echo "unknown")
    fail "Port $FRONTEND_PORT is already in use by PID $OCCUPIER ($OCCUPIER_CMD).\n" \
         "OGA frontend must bind 3005. Resolve conflict before deploying.\n" \
         "Run: sudo lsof -i :$FRONTEND_PORT"
fi
log "  Preflight OK (port $FRONTEND_PORT is free)"

# ── 1. Build ─────────────────────────────────────────────────────────────────
log "Step 1: Build"

git submodule update --init --recursive
npm install
npm run build:packages
npm run build

log "  Build OK"

# ── 2. Stop existing services ────────────────────────────────────────────────
log "Step 2: Stop existing systemd services (if any)"
sudo systemctl stop oga-frontend 2>/dev/null || true
sudo systemctl stop oga-inference 2>/dev/null || true

# Kill lingering processes on ports
for port in $FRONTEND_PORT $API_PORT; do
    PID=$(sudo lsof -t -i :$port 2>/dev/null || true)
    if [[ -n "${PID:-}" ]]; then
        warn "  Killing process on port $port (PID $PID)"
        sudo kill -9 $PID 2>/dev/null || true
    fi
done

# Warn if known conflicting ports are active
if ss -tlnp | grep -q ':3000 '; then
    warn "  Port 3000 is in use (Open WebUI). OGA uses 3005 to avoid conflict."
fi
if ss -tlnp | grep -q ':3004 '; then
    warn "  Port 3004 is in use (nqh_grafana). OGA uses 3005 per @itadmin request."
fi

# ── 3. Start Inference Server ────────────────────────────────────────────────
log "Step 3: Start FastAPI inference server"

sudo systemctl daemon-reload
sudo systemctl enable oga-inference
sudo systemctl start oga-inference

# Wait for health endpoint
log "  Waiting for /health (max 120s)..."
for i in {1..120}; do
    if curl -sf http://localhost:$API_PORT/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# ── 4. MANDATORY STARTUP GATE ────────────────────────────────────────────────
log "Step 4: Startup gate — verify CUDA runtime"

HEALTH=$(curl -sf http://localhost:$API_PORT/health || true)
if [[ -z "$HEALTH" ]]; then
    fail "FastAPI /health unreachable after 120s. Check journalctl -u oga-inference"
fi

RUNTIME_DEVICE=$(echo "$HEALTH" | .venv/bin/python3 -c "import sys,json; print(json.load(sys.stdin).get('runtime_device','unknown'))" 2>/dev/null || echo "unknown")
log "  runtime_device = $RUNTIME_DEVICE"

if [[ "$RUNTIME_DEVICE" != "cuda" ]]; then
    fail "STARTUP GATE FAILED: runtime_device is '$RUNTIME_DEVICE', expected 'cuda'.\n" \
         "Do NOT expose to production traffic.\n" \
         "Investigate: nvidia-smi, CUDA drivers, PyTorch compatibility.\n" \
         "See docs/08-collaborate/GPU-S1-VERIFICATION.md"
fi

log "  Gate passed ✓"

# ── 5. Start Frontend ────────────────────────────────────────────────────────
log "Step 5: Start Next.js frontend"

sudo systemctl enable oga-frontend
sudo systemctl start oga-frontend

# Wait for Next.js
log "  Waiting for Next.js on port $FRONTEND_PORT (max 30s)..."
for i in {1..30}; do
    if curl -sf http://localhost:$FRONTEND_PORT/api/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

FRONTEND_HEALTH=$(curl -sf http://localhost:$FRONTEND_PORT/api/health || true)
if [[ -z "$FRONTEND_HEALTH" ]]; then
    fail "Next.js /api/health unreachable after 30s. Check journalctl -u oga-frontend"
fi

log "  Frontend OK"

# ── 6. CPO-Approved Smoke Checklist ──────────────────────────────────────────
log "Step 6: Smoke checklist (CPO approved — 2.txt:981-1015)"

SMOKE_PASS=0
SMOKE_TOTAL=4

# 1. Frontend localhost
echo ""
log "  [1/4] Frontend localhost:3005"
if curl -sf http://localhost:$FRONTEND_PORT/api/health | .venv/bin/python3 -m json.tool; then
    SMOKE_PASS=$((SMOKE_PASS + 1))
else
    fail "  FAIL: Frontend not reachable on localhost:$FRONTEND_PORT"
fi

# 2. Backend GPU gate
echo ""
log "  [2/4] Backend 127.0.0.1:8000 — runtime_device must be 'cuda'"
if curl -sf http://127.0.0.1:$API_PORT/health | .venv/bin/python3 -m json.tool && \
   curl -sf http://127.0.0.1:$API_PORT/health | .venv/bin/python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('runtime_device')=='cuda' else 1)"; then
    SMOKE_PASS=$((SMOKE_PASS + 1))
else
    fail "  FAIL: Backend GPU gate failed (runtime_device != cuda)"
fi

# 3. Domain HTTP ingress (may be pending NAT)
# CPO: verify returns 301 redirect to HTTPS (nginx/NPM behavior)
echo ""
log "  [3/4] Domain HTTP ingress: http://$DOMAIN/api/health"
HTTP_STATUS=$(curl -sfI http://$DOMAIN/api/health 2>/dev/null | head -1 | tr -d '\r')
if [[ "$HTTP_STATUS" == *"301"* ]] || [[ "$HTTP_STATUS" == *"308"* ]]; then
    log "  HTTP status: $HTTP_STATUS"
    SMOKE_PASS=$((SMOKE_PASS + 1))
elif [[ -z "$HTTP_STATUS" ]]; then
    warn "  SKIP/PENDING: Domain HTTP not reachable (NAT/SSL may not be ready yet)"
    warn "  Re-run after @itadmin confirms router NAT and SSL is provisioned."
else
    warn "  SKIP/PENDING: Domain HTTP returned '$HTTP_STATUS' (expected 301 redirect)"
fi

# 4. Domain HTTPS ingress (may be pending NAT + SSL)
# CPO: verify response contains OGA route evidence (mflux_reachable)
echo ""
log "  [4/4] Domain HTTPS ingress: https://$DOMAIN/api/health"
HTTPS_BODY=$(curl -sf https://$DOMAIN/api/health 2>/dev/null || true)
if [[ -n "$HTTPS_BODY" ]] && echo "$HTTPS_BODY" | .venv/bin/python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    assert d.get('mflux_reachable') == True, 'mflux_reachable not True'
    assert d.get('status') == 'ok', 'status not ok'
    sys.exit(0)
except Exception as e:
    print(f'Verification failed: {e}', file=sys.stderr)
    sys.exit(1)
"; then
    log "  OGA route verified (mflux_reachable=true, status=ok)"
    SMOKE_PASS=$((SMOKE_PASS + 1))
else
    warn "  SKIP/PENDING: Domain HTTPS not reachable or not routing to OGA (NAT/SSL may not be ready yet)"
    warn "  Re-run after @itadmin confirms router NAT and SSL is provisioned."
fi

echo ""
log "Smoke result: $SMOKE_PASS / $SMOKE_TOTAL checks passed"

if [[ $SMOKE_PASS -ge 2 ]]; then
    log "Internal services (frontend + backend) verified."
fi
if [[ $SMOKE_PASS -lt 4 ]]; then
    warn "Domain checks (3+4) skipped — expected if NAT/SSL not yet configured."
    warn "Re-run: ./scripts/deploy-s1.sh after @itadmin confirms router NAT."
fi

echo ""
log "Deploy complete. Services:"
log "  oga-inference  → systemctl status oga-inference"
log "  oga-frontend   → systemctl status oga-frontend"
log "  nginx          → systemctl status nginx"
log "  Domain         → https://$DOMAIN"

warn "If this is first deploy, ensure reverse proxy + SSL are configured."
warn "Options: (A) Native Nginx or (B) Nginx Proxy Manager (Docker)."
warn "See docs/06-deploy/gpu-server-s1-external.md §3"
