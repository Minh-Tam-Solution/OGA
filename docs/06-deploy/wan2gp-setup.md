# Wan2GP Video Engine Setup

**Purpose:** Enable video generation in NQH Creative Studio via Wan2GP Gradio server.
**Hardware:** Mac mini M4 Pro 24GB (or any Apple Silicon Mac for dev)
**Sprint:** 3

---

## Prerequisites

- Python 3.10+ with pip
- ~10GB disk for model weights
- Apple Silicon Mac (M1/M2/M4)

---

## 1. Install Wan2GP

```bash
# Clone Wan2GP
git clone https://github.com/deepbeepmeep/Wan2GP.git
cd Wan2GP

# Create venv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 2. Start Gradio Server

```bash
cd Wan2GP
source .venv/bin/activate
python app.py --server-port 7860

# Expected: "Running on local URL: http://127.0.0.1:7860"
```

---

## 3. Verify API

```bash
# Probe health
curl http://localhost:7860/info

# Test generation (text-to-video)
curl -X POST http://localhost:7860/api/predict \
  -H "Content-Type: application/json" \
  -d '{"fn_index": 0, "data": ["a cat walking", "", 20, 7.5, 5, "16:9"]}'
```

---

## 4. Configure NQH Creative Studio

Add to `.env.local`:

```
NEXT_PUBLIC_WAN2GP_ENABLED=true
NEXT_PUBLIC_WAN2GP_URL=http://localhost:7860
```

Restart Next.js server. Video Studio tab should now be active.

---

## 5. launchd Service (Production)

Save as `~/Library/LaunchAgents/com.nqh.wan2gp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nqh.wan2gp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/admin/Wan2GP/.venv/bin/python</string>
        <string>/Users/admin/Wan2GP/app.py</string>
        <string>--server-port</string>
        <string>7860</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/admin/Wan2GP</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/nqh/wan2gp-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/nqh/wan2gp-stderr.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.nqh.wan2gp.plist
```

---

## Known Limitations

- Video generation takes 60-180s depending on model and duration
- First run downloads model weights (~5-10GB)
- Only one video generation at a time (GPU memory constraint)
- M4 Pro 24GB: 5s clips work, 10s clips may OOM on larger models

---

*NQH Creative Studio | Wan2GP Setup Guide | Sprint 3*
