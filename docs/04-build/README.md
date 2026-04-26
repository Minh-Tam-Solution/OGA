# 04-build — NQH Creative Studio (OGA)

## Purpose

**Key Question:** Are we BUILDING it right?

---

## Sprint 1 Build Guidelines

### File Inventory

| File | Action | Sprint Task |
|------|--------|-------------|
| `src/lib/providerConfig.js` | NEW | 1.3 |
| `src/lib/muapi.js` | MODIFY — import providerConfig | 1.3 |
| `packages/studio/src/muapi.js` | MODIFY — replace BASE_URL | 1.3 |
| `middleware.js` | MODIFY — use providerConfig | 1.3 |
| `app/api/*/route.js` (4 files) | MODIFY — env-based URL | 1.3 |
| `package.json` | MODIFY — rebrand | 1.1 |
| `components/StandaloneShell.js` | MODIFY — rebrand + tabs | 1.2, 1.5 |
| `src/components/ImageStudio.js` | MODIFY — local model filter | 1.4 |
| `src/components/AuthModal.js` | MODIFY — skip in local mode | 1.4 |
| `src/components/SettingsModal.js` | MODIFY — rebrand settings | 1.2 |
| `src/components/Header.js` | MODIFY — rebrand header | 1.2 |
| `src/lib/models.js` | MODIFY — add local model entry | 1.4 |
| `.env.local` | NEW | 1.7 |
| `IDENTITY.md` | MODIFY — project identity | 1.7 |
| `CLAUDE.md` | MODIFY — project context | 1.7 |

### Build Commands

```bash
# Development
npm run dev                    # Next.js dev server (port 3000)
python local-server/server.py  # Local Flux server (port 8000)

# Build
npm run build:studio           # Rebuild studio package after muapi.js changes
npm run build                  # Production build

# Verify
curl http://localhost:8000/health  # Local server healthy
curl http://localhost:3000         # Next.js running
```

### Verification Checklist

- [ ] `npm run build` — 0 errors
- [ ] `python local-server/server.py` → health OK
- [ ] Image Studio generate → ảnh hiển thị
- [ ] Network tab → 0 requests tới `api.muapi.ai`
- [ ] Header shows "NQH Creative Studio"
- [ ] Video/LipSync/Cinema → "Coming Soon"
- [ ] Workflows/Agents → hidden

---

## Quality Gate Requirements

This stage feeds gate(s): **G-Sprint**

- [ ] **G-Sprint**: Sprint 1 all tasks completed, verification checklist passed

---

## Dependencies

| Upstream Stage | What to Consume |
|---------------|-----------------|
| [01-planning](../01-planning/) | FR-1→FR-5, NFRs, success criteria |
| [02-design](../02-design/) | Architecture, providerConfig spec, API flow |

---

## Sprint Plans

| Sprint | Plan | Status |
|--------|------|--------|
| Sprint 1 | [sprint-1-plan.md](sprints/sprint-1-plan.md) | 📋 Ready |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Stage 04: Build*
