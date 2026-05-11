---
sprint: 11
task: 11.0a
status: PLANNED
owner: "@architect + @coder"
date: 2026-05-09
branch: "spike/openreel-deploy"
---

# Sprint 11.0a — OpenReel Deployment Spike Plan

## Objective

Validate OpenReel Video deploys and runs correctly on GPU Server S1 as a standalone subdomain app. Output: spike report with ✅/❌ per acceptance criterion.

## Duration

1 day

## Environment

| Item | Value |
|------|-------|
| Host | GPU Server S1 (Ubuntu 22.04) |
| Domain | `editor.studio.nhatquangholding.com` (internal DNS or hosts file for test) |
| Port | 3006 |
| Node.js | 18+ (verify on S1) |
| Package manager | pnpm (install if missing) |

## Tasks

### T1 — Clone & Build (2 hours)
- [ ] `git clone https://github.com/Augani/openreel-video.git /tmp/openreel-spike`
- [ ] `cd /tmp/openreel-spike && git checkout <commit-sha>` (pin to latest stable, record SHA)
- [ ] `pnpm install` — must exit 0
- [ ] `pnpm build` — must exit 0, no TypeScript errors
- [ ] Record build time and output size

### T2 — systemd Service + Port Binding (1 hour)
- [ ] Create `oga-editor.service` systemd unit (port 3006, `pnpm preview` or `node server`)
- [ ] `sudo systemctl start oga-editor.service`
- [ ] `curl http://localhost:3006` → HTTP 200 + HTML

### T3 — Nginx Reverse Proxy + SSL (1 hour)
- [ ] Add Nginx server block for `editor.studio.nhatquangholding.com` → `localhost:3006`
- [ ] Verify SSL cert (Let's Encrypt staging or self-signed for spike)
- [ ] `curl -I https://editor.studio.nhatquangholding.com` → HTTP 200

### T4 — Smoke Test: Edit & Export (2 hours)
- [ ] Upload 5s test MP4 (Wan2.1 or LTX output) into OpenReel
- [ ] Add text overlay ("NQH Test")
- [ ] Export MP4
- [ ] Verify exported file plays in VLC/ffplay
- [ ] Record export time and file size

### T5 — Security Scan (1 hour)
- [ ] `pnpm audit --production` → record high/critical CVE count
- [ ] If >0 high/critical, document and escalate to @cto
- [ ] Optional: Snyk scan if tool available on S1

### T6 — Resource Monitoring (30 min)
- [ ] Record CPU and RAM usage during build, during edit, during export
- [ ] Confirm no memory leak after export completes

## Acceptance Criteria

| # | Criterion | Pass Threshold |
|---|-----------|----------------|
| A1 | `pnpm install && pnpm build` exits 0 | Must pass |
| A2 | systemd unit starts and serves on port 3006 | Must pass |
| A3 | Nginx reverse proxy resolves with valid SSL | Must pass |
| A4 | Smoke test: import 5s MP4, add text, export MP4 → plays in VLC | Must pass |
| A5 | `npm audit --production` shows 0 high/critical CVEs | Must pass (or documented waiver) |
| A6 | Memory + CPU under load ≤ S1 idle headroom | Must pass |

## Output Artifact

`docs/04-build/sprints/sprint-11-openreel-spike-report.md`

Template:
- Environment table
- Commit SHA pinned
- Pass/fail per criterion (A1–A6)
- Build metrics (time, size)
- Smoke test recording (screenshot or terminal log)
- Security scan results
- Resource usage snapshot
- Recommendation: INTEGRATE / DEFER / REJECT

## Rollback

```bash
sudo systemctl stop oga-editor.service
sudo rm /etc/systemd/system/oga-editor.service
sudo rm -rf /tmp/openreel-spike
```

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 11.0a Spike Plan*
