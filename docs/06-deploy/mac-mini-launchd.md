# Mac Mini Production Deploy — launchd Guide

**Target:** Mac mini M4 Pro 24GB, macOS 15+
**Services:** Next.js (port 3000) + mflux/FastAPI (port 8000)
**Owner:** dvhiep (IT Admin)

---

## Prerequisites

```bash
# Verify Node.js and Python are installed
which node     # e.g. /opt/homebrew/bin/node
which python3  # e.g. /opt/homebrew/bin/python3

# Note absolute paths — launchd does NOT inherit shell PATH
```

---

## 1. Create Log Directory

```bash
sudo mkdir -p /var/log/nqh
sudo chown $(whoami) /var/log/nqh
```

---

## 2. Next.js Service Plist

Save as `~/Library/LaunchAgents/com.nqh.creative-studio.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nqh.creative-studio</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/Users/admin/OGA/node_modules/.bin/next</string>
        <string>start</string>
        <string>-p</string>
        <string>3000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/admin/OGA</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NEXT_PUBLIC_LOCAL_MODE</key>
        <string>true</string>
        <key>LOCAL_API_URL</key>
        <string>http://localhost:8000</string>
        <key>ACCESS_PIN</key>
        <string>CHANGE_ME</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/nqh/nextjs-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/nqh/nextjs-stderr.log</string>
</dict>
</plist>
```

**Important:** Replace `/opt/homebrew/bin/node` with output of `which node` on the Mac mini. Replace `/Users/admin/OGA` with the actual clone path. Set `ACCESS_PIN` to a real PIN.

---

## 3. mflux/FastAPI Service Plist

Save as `~/Library/LaunchAgents/com.nqh.mflux.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nqh.mflux</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/admin/OGA/.venv/bin/python</string>
        <string>/Users/admin/OGA/local-server/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/admin/OGA</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>MFLUX_MODEL</key>
        <string>schnell</string>
        <key>MFLUX_QUANTIZE</key>
        <string>8</string>
        <key>PORT</key>
        <string>8000</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/nqh/mflux-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/nqh/mflux-stderr.log</string>
</dict>
</plist>
```

---

## 4. Load and Start Services

```bash
# Load (registers + starts if RunAtLoad=true)
launchctl load ~/Library/LaunchAgents/com.nqh.creative-studio.plist
launchctl load ~/Library/LaunchAgents/com.nqh.mflux.plist

# Verify running
launchctl list | grep nqh

# Manual start/stop
launchctl start com.nqh.creative-studio
launchctl stop com.nqh.creative-studio
```

---

## 5. Verify

```bash
# Health check
curl http://localhost:3000/api/health

# Expected: {"status":"ok","uptime":...,"mflux_reachable":true,...}

# Check logs
tail -f /var/log/nqh/nextjs-stdout.log
tail -f /var/log/nqh/mflux-stderr.log
```

---

## 6. Reboot Test

```bash
sudo reboot
# After reboot, verify both services auto-started:
curl http://localhost:3000/api/health
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `node: command not found` in logs | Use absolute path from `which node` in ProgramArguments |
| Port 3000 already in use | `lsof -i :3000` → kill conflicting process |
| mflux OOM on first model load | Wait ~60s for Flux Schnell model to load into memory |
| Service keeps restarting | Check `StandardErrorPath` log for crash reason |

---

*NQH Creative Studio | Deploy Guide v1.0 | Sprint 2*
