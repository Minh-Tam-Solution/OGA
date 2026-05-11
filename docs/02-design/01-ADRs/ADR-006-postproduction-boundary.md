---
adr_id: ADR-006
title: "Post-Production Tool Boundary — OpenReel Integration"
status: Proposed
date: 2026-05-09
deciders: ["@cto", "@architect", "@cpo"]
gate: G2
references:
  - docs/01-planning/external-repo-assessment-2026-05-06.md
  - docs/08-collaborate/CTO-REVIEW-external-repos-2026-05-09.md
  - ADR-004 (AI-Platform Integration)
---

# ADR-006: Post-Production Tool Boundary — OpenReel Integration

## Status

**Proposed** — pending G2 approval after S11 spike.

## Context

OGA generates images and videos via local diffusers pipelines (Image Studio, Video Studio). The output workflow today is:

1. Generate asset → download MP4/PNG to local machine
2. Open CapCut / Premiere / Figma to edit
3. Export final → upload to BAP (Postiz) for publishing

This creates friction: users leave OGA, lose context, and must manage files manually. OpenReel Video (MIT, client-side editor) fills the "edit" gap but must NOT be merged into OGA monorepo due to stack divergence (Vite + pnpm vs Next.js + npm).

## Decision

Deploy OpenReel as a **standalone subdomain application** at `editor.studio.nhatquangholding.com`, NOT as an iframe or embedded component inside OGA.

### Rationale

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| iframe in OGA | Fastest integration | WebGPU context conflicts, IndexedDB origin isolation, keyboard shortcut breakage | ❌ Rejected by CTO |
| Embedded component (import packages/core) | Shared UI shell | 130k LOC merge into OGA monorepo, pnpm→npm conflict, build complexity | ❌ Rejected by CTO |
| **Subdomain deployment** | Clean separation, independent deploy, no stack conflict | Requires cross-origin handoff contract | ✅ Approved |
| Standalone tab (new window) | Zero integration effort | Users lose navigation context, no deep-link | ❌ PM rejected |

### Architecture

```
User in OGA Video Studio
  └── Clicks "Edit in Post-Production"
      └── OGA uploads MP4 to MinIO/S3 (presigned URL, 15-min expiry)
          └── Redirects to editor.studio.nhatquangholding.com?import=<presigned-url>
              └── OpenReel fetches MP4, loads into timeline
                  └── User edits → Export MP4 → Upload back to MinIO/S3
                      └── OGA gallery polls S3 → shows "edited" version
```

### Handoff Contract (OGA ↔ OpenReel)

| Field | OGA Responsibility | OpenReel Responsibility |
|-------|-------------------|------------------------|
| Asset storage | Upload source MP4 to MinIO/S3; generate presigned GET URL | Read from URL, load into timeline |
| Project persistence | None (OpenReel owns `.openreel` project files) | Save `.openreel` to IndexedDB; optional export to MinIO |
| Edited asset return | Poll MinIO/S3 for new object key; update gallery | Upload exported MP4 to presigned PUT URL |
| Auth | OGA session cookie (LAN) or PIN | None (subdomain behind same firewall) |

### Deployment Spec

```
Domain:    editor.studio.nhatquangholding.com
Port:      3006 (internal)
Service:   oga-editor.service (systemd)
Host:      GPU Server S1 (Ubuntu 22.04)
Build:     pnpm install && pnpm build (Vite static + optional Node server)
Reverse:   Nginx proxy_pass to localhost:3006
SSL:       Let's Encrypt (same cert as studio.nhatquangholding.com)
```

### Security & Supply-Chain

- Pin OpenReel to specific commit SHA in deploy script; do NOT track `main`
- Run `npm audit --production` + Snyk scan before every deploy
- Re-evaluate upstream quarterly; if abandoned → fork to `github.com/Minh-Tam-Solution/openreel-video`

## Consequences

### Positive
- Users stay in NQH domain throughout Gen → Edit workflow
- No code merge into OGA monorepo = zero build risk
- Independent deploy schedule = OpenReel updates don't block OGA releases

### Negative
- Cross-origin asset handoff requires MinIO/S3 intermediate storage
- IndexedDB project files are browser-local; team sharing requires explicit `.openreel` export/import
- Additional systemd service to monitor on S1

## Alternatives Considered

- **CapCut web** — proprietary, requires Bytedance account, data leaves LAN. Rejected.
- **FFmpeg wasm in OGA** — insufficient for interactive editing timeline. Rejected.
- **Build our own editor** — 6+ month effort. Rejected (not core competency).

---

*ADR-006 | Proposed 2026-05-09 | G2 pending S11 spike*
