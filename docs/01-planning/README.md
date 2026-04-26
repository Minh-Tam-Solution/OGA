# 01-planning — NQH Creative Studio (OGA)

## Purpose

**Key Question:** WHAT are we building?

Sprint 1: Fork, rebrand, provider abstraction, Image Studio local-only (~3–4 ngày).

---

## Functional Requirements — Sprint 1

| ID | Requirement | Priority | Owner |
|----|-------------|----------|-------|
| FR-1 | Fork upstream repo sang github.com/Minh-Tam-Solution/OGA; rebrand UI thành "NQH Creative Studio" | P0 | @coder |
| FR-2 | Tạo provider abstraction layer (`src/lib/providerConfig.js`) để decouple khỏi Muapi.ai hardcoded URLs (6+ locations) | P0 | @architect + @coder |
| FR-3 | Image Studio hoạt động với local mflux server (`LOCAL_API_URL=http://mac-mini:8000`) — sinh ảnh end-to-end | P0 | @coder |
| FR-4 | Model dropdown chỉ hiển thị local models khi ở local mode (Flux Schnell); ẩn 200+ cloud models | P1 | @coder |
| FR-5 | Các tab Video, LipSync, Cinema, Marketing hiển thị badge "Coming Soon"; Workflows + Agents ẩn hoàn toàn | P1 | @coder |

---

## Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Thời gian sinh ảnh 512×512 | < 60s end-to-end |
| NFR-2 | Không có outbound call đến Muapi.ai khi local mode | 0 external calls |
| NFR-3 | UI responsive trên desktop browser (Chrome/Safari) | ✅ |
| NFR-4 | Build Next.js thành công (`npm run build`) | 0 errors |
| NFR-5 | Không cần auth Phase 1 (LAN trust) | ✅ Phase 1 |

---

## Success Criteria — Sprint 1

- [ ] SC-1: `LOCAL_API_URL=http://localhost:8000 npm run dev` → Image Studio sinh ảnh thành công
- [ ] SC-2: Không có request nào đến `api.muapi.ai` trong Network tab khi local mode
- [ ] SC-3: Header/title hiển thị "NQH Creative Studio"
- [ ] SC-4: Model dropdown chỉ show `Flux Schnell (Local)` khi local mode
- [ ] SC-5: Tab Video/LipSync/Cinema show "Coming Soon" — không error
- [ ] SC-6: Workflows/Agents tabs hidden

---

## Sprint Roadmap

| Sprint | Scope | Thời gian | Status |
|--------|-------|-----------|--------|
| Sprint 1 | Fork + rebrand + provider abstraction + Image Studio local-only | 3–4 ngày | 📋 Planning |
| Sprint 2 | Hardening local server + simple auth + Mac mini deployment | 5–7 ngày | Backlog |
| Sprint 3 | Video gen (cloud fallback hoặc local) + UX polish | TBD | Backlog |

---

## Dependencies

| Upstream Stage | Artifact |
|---------------|----------|
| [00-foundation](../00-foundation/) | Problem statement, constraints, stakeholders |

---

## Quality Gate Requirements

This stage feeds gate(s): **G0.1, G1**

- [x] **G0.1**: Requirements documented, prioritized (FR-1→FR-5, NFR-1→NFR-5)
- [x] **G1**: Success criteria defined, sprint roadmap created

---

## Artifact Checklist

| Artifact | Required | Status | Owner |
|----------|----------|--------|-------|
| Requirements (embedded above) | ✅ Required | ✅ Done | @pm |
| Sprint roadmap (embedded above) | ⬜ Optional | ✅ Done | @pm |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Stage 01: Planning*
