# 00-foundation — NQH Creative Studio (OGA)

## Purpose

**Key Question:** WHY are we building this?

NQH/MTS cần một công cụ AI sáng tạo nội bộ để nhân viên (marketing, design, content) có thể tạo ảnh/video AI mà không phụ thuộc vào cloud API trả phí theo từng request.

---

## Problem Statement

CEO đã thử nghiệm Muapi.ai (cloud) — chất lượng tốt nhưng **chi phí per-request không bền vững** cho team nội bộ dùng hàng ngày. POC chứng minh local image gen chạy được trên MacBook M4 Pro 24GB qua mflux (MLX-native Flux Schnell): 34–49s/image @ 512×512, zero per-image cost.

Vấn đề cần giải quyết:
- Cloud API (Muapi.ai) = $$/request → không scalable cho internal use
- Open-Generative-AI upstream hardcodes Muapi.ai URLs → không thể swap provider
- Nhân viên cần UI thân thiện, không cần biết AI/ML internals

## Business Case

| Approach | CapEx | OpEx (monthly) | Latency | Data Privacy |
|----------|-------|----------------|---------|-------------|
| Cloud (Muapi.ai) | $0 | $$$ (per-request) | 5-15s | Data qua API bên ngoài |
| **Self-hosted (Mac mini MLX)** | ~$1,300 | $0 | 34-49s | Data không rời công ty |

ROI: Mac mini hoàn vốn sau ~2-3 tháng sử dụng so với cloud, tùy volume.

---

## Vision

**Self-hosted AI creative studio trên Mac mini công ty — zero per-image cost.**

- Giai đoạn 1 (Sprint 1): Image Studio hoạt động 100% local, deploy trên LAN công ty
- Giai đoạn 2 (Sprint 2): Hardening, auth đơn giản, production-ready
- Giai đoạn 3 (Sprint 3+): Video gen (cloud fallback hoặc local khi hardware sẵn sàng)

---

## Stakeholders

| Role | Người | Trách nhiệm |
|------|-------|-------------|
| CEO / Product Owner | Tai Dang (taidt@mtsolution.com.vn) | Quyết định cuối, định hướng sản phẩm |
| IT Admin / DevOps | dvhiep (cntt@nqh.com.vn) | Deploy Mac mini, LAN config, server ops |
| End Users | Nhân viên NQH/MTS (marketing, design, content) | Tạo ảnh AI hàng ngày |
| Upstream Reference | github.com/Anil-matcha/Open-Generative-AI | Fork source, không merge ngược |

---

## Constraints

| Constraint | Detail |
|-----------|--------|
| Hardware | Mac mini M4 Pro 24GB — Apple Silicon, MLX only |
| Network | LAN-only Phase 1, không expose ra internet |
| Auth | Không có auth Phase 1 (internal trust model) |
| External APIs | Không phụ thuộc Muapi.ai cho image gen |
| Budget | Zero per-image API cost (self-hosted) |
| Scale | ~10–20 concurrent users nội bộ |
| Image gen engine | mflux v0.17.5 (MLX-native Flux), quantize 8-bit |
| Resolution | 512×512 Phase 1 (1024×1024 cần benchmark thêm) |

---

## Quality Gate Requirements

This stage feeds gate(s): **G0**

- [x] **G0**: Problem statement documented, stakeholders identified, constraints enumerated

---

## Artifact Checklist

| Artifact | Required | Status | Owner |
|----------|----------|--------|-------|
| Problem statement (embedded above) | ✅ Required | ✅ Done | @pm |
| Business case (embedded above) | ✅ Required | ✅ Done | @pm |
| Vision (embedded above) | ⬜ Optional | ✅ Done | @pm |

---

*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Stage 00: Foundation*
