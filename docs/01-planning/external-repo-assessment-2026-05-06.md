---
spec_id: SPEC-01PLANNING-ERA-001
title: "External Repo Assessment — OpenReel, OpenShorts, IndexTTS"
spec_version: "1.1.0"
status: approved
tier: STANDARD
stage: "01-planning"
category: research
owner: "@pm + @architect"
date: 2026-05-06
references:
  - docs/01-planning/requirements.md
  - docs/01-planning/scope.md
  - docs/01-planning/user-stories.md
  - AGENTS.md (SDLC 6.3.0)
---

# Đánh Giá 3 Repo Ngoại Vi — Khả Năng Tích Hợp Vào OGA/MOP NQH

> **Ngườii yêu cầu:** CTO / Product Owner  
> **Ngườii thực hiện:** @pm (feature fit) + @architect (tech stack + integration)  
> **Ngày:** 2026-05-06  
> **Framework:** SDLC 6.3.0 — Iceberg Model + Design Thinking

---

## Tóm Tắt Điều Hành (Executive Summary)

| Repo | Kết Luận | Mức Độ Ưu Tiên | Ghi Chú |
|------|----------|----------------|---------|
| **OpenReel Video** | ✅ **Tích hợp được — khuyến nghị P1** | Medium | Bổ sung khả năng *edit* video sau sinh — lấp đầy gap lớn trong OGA |
| **OpenShorts** | ⚠️ **Không tích hợp trực tiếp — khuyến nghị tham khảo UX** | Low | Platform độc lập, overlap nặng với OGA Studios, licensing risk từ AI actors |
| **IndexTTS / Draft to Take** | ✅ **Tích hợp được — khuyến nghị P2** | Medium-High | Bổ sung TTS + audio production — hoàn thiện pipeline content creation cho NQH |

**Quan điểm tổng thể:** OGA hiện tại giỏi ở *generative* (sinh ảnh, sinh video). Cả 3 repo được đánh giá đều bổ sung *post-production* hoặc *audio/voice* — đúng hướng để biến OGA thành nền tảng content creation end-to-end. Tuy nhiên, chỉ **OpenReel** và **IndexTTS** phù hợp để tích hợp kiến trúc; **OpenShorts** nên xem như benchmark UX thay vì code integration.

---

## 1. OpenReel Video — "Open Source CapCut Alternative"

🔗 https://github.com/Augani/openreel-video

### 1.1 Tóm Tắt Sản Phẩm

Video editor chạy hoàn toàn client-side trên trình duyệt. Không upload, không cloud processing. Đối tượng: content creator muốn edit video nhanh mà không cần cài đặt phần mềm nặng.

### 1.2 Phù Hợp Tính Năng (PM Assessment)

#### Pain Point của NQH mà OpenReel giải quyết

| Pain Point NQH | Mức Độ | OpenReel Có Giải Quyết? |
|----------------|--------|------------------------|
| "Video sinh ra chỉ 2–5 giây, cần ghép/nối/loop lại" | 🔴 Cao | ✅ Có — multi-track timeline, speed control, export |
| "Cần thêm text overlay, logo NQH vào video" | 🔴 Cao | ✅ Có — professional text editor, shapes, SVG |
| "Cần color grade video cho đồng bộ brand" | 🟡 Trung bình | ✅ Có — color wheels, LUT, HSL |
| "Cần cắt video dài thành shorts/reels nhanh" | 🟡 Trung bình | ✅ Có — cut/trim/split + export 9:16 |
| "Cần thêm nhạc nền / voiceover vào video" | 🟡 Trung bình | ✅ Có — multi-track audio, ducking, import audio |

#### Gap Analysis

OGA hiện tại: **Generate** (ảnh + video) → tải về máy → mở CapCut/Premiere để edit.

Với OpenReel tích hợp: **Generate** → **Edit** → **Export final** — trong cùng một tab/tab lân cận. Giảm friction đáng kể cho team marketing NQH.

#### User Story Mapping

| User Story NQH | OpenReel Feature | Fit |
|----------------|------------------|-----|
| US-VIDEO-TAB (Sprint 6): Sinh video ad | Export MP4 từ OGA → import vào OpenReel timeline | ✅ Tích hợp mượt |
| US-MARKETING-TAB (Sprint 6): Tạo multi-asset campaign | Ghép nhiều clip, thêm text CTA, logo | ✅ Tích hợp mượt |
| "Tạo Reels/TikTok từ video sinh ra" | Crop 9:16, thêm subtitle karaoke, thêm nhạc | ✅ Native support |

### 1.3 Tech Stack (Architect Assessment)

| Component | OpenReel | OGA Hiện Tại | Tương Thích |
|-----------|----------|--------------|-------------|
| Frontend framework | React 18 + TypeScript | Next.js 15 + React (JS) | ✅ Cao — cùng React ecosystem |
| State management | Zustand | React hooks + context | ✅ Dễ adapt |
| Styling | TailwindCSS | TailwindCSS | ✅ Giống nhau |
| Video processing | WebCodecs API + WebGPU | diffusers (Python backend) | ⚠️ Khác layer — bổ sung, không conflict |
| Rendering | WebGPU → Canvas2D fallback | N/A (server-side generation) | ✅ Bổ sung capability client-side |
| Storage | IndexedDB (local project) | localStorage (jobs) | ✅ Cùng local-first philosophy |
| Build tool | Vite (pnpm) | Next.js (npm) | ⚠️ Khác build tool — không blocker |

#### Kiến Trúc Integration

```
OGA Tab: "Video Editor" (hoặc "Post-Production")
  └── iframe hoặc embedded component
      └── OpenReel core engine (packages/core/)
          └── Đọc video output từ OGA (base64 / blob URL)
          └── Edit → Export MP4 → Lưu vào OGA gallery
```

**Lựa chọn integration:**
1. **iframe** (nhanh nhất): Host OpenReel tại `/editor` route, truyền video URL qua query param.
2. **Embedded component** (tốt hơn): Import `packages/core/` engines vào OGA React app, dùng shared UI shell.
3. **Standalone** (ít tích hợp nhất): Mở OpenReel ở tab mới, user tự upload video.

> **Khuyến nghị:** Bắt đầu với Option 1 (iframe) để validate UX trong 1 sprint, sau đó chuyển Option 2 nếu adoption cao.

### 1.4 Best Practices Assessment

| Tiêu Chí | Đánh Giá | Ghi Chú |
|----------|----------|---------|
| License | ✅ MIT — commercial safe | Free forever, no watermark |
| Code organization | ✅ Monorepo rõ ràng (apps/web + packages/core) | ~125k lines, well-structured |
| Documentation | ✅ Good — có quick start, architecture diagram | Dễ onboard |
| AI-assisted dev | ⚠️ Experiment — code quality phụ thuộc review | Cần audit nếu fork |
| Browser support | ✅ Chrome 94+, Edge 94+, Firefox 130+, Safari 16.4+ | Team NQH dùng Chrome/Edge |
| Offline capability | ✅ 100% client-side | Phù hợp LAN-only policy |

### 1.5 Risk Assessment

| Risk | Mức Độ | Mitigation |
|------|--------|------------|
| WebGPU chưa support trên tất cả browser | Medium | Graceful fallback Canvas2D; team dùng Chrome |
| Large video files trong IndexedDB | Medium | Giới hạn project size; purge policy |
| Không thể edit 4K mượt trên GPU cũ | Low | RTX 5090 dư sức; WebCodecs dùng hardware decode |
| AI-generated code quality | Medium | Code review trước khi fork |

### 1.6 Kết Luận — OpenReel

**Verdict: ✅ RECOMMENDED FOR INTEGRATION (P1)**

Bổ sung capability *video editing* mà OGA hoàn toàn thiếu. Stack React + Tailwind + client-side processing align hoàn hảo với OGA philosophy. Integration effort thấp (iframe trong sprint, embedded trong 2–3 sprint). MIT license commercial-safe.

**Đề xuất tên tab:** "Editor" hoặc "Post-Production" — đặt cạnh Video Studio.

---

## 2. OpenShorts — "Free & Open Source AI Video Platform"

🔗 https://github.com/mutonby/openshorts

### 2.1 Tóm Tắt Sản Phẩm

Platform 3-in-1: (1) Clip Generator (cắt video dài thành shorts), (2) AI Shorts (UGC video với AI actors), (3) YouTube Studio (thumbnails, titles, descriptions). Self-hosted qua Docker.

### 2.2 Phù Hợp Tính Năng (PM Assessment)

#### Pain Point của NQH

| Pain Point NQH | Mức Độ | OpenShorts Có Giải Quyết? |
|----------------|--------|------------------------|
| "Cần tạo video marketing nhanh cho F&B, hotel" | 🔴 Cao | ✅ AI Shorts — AI actors, voiceover, b-roll |
| "Cần cắt webinar/interview thành clips viral" | 🟡 Trung bình | ✅ Clip Generator — auto-cut |
| "Cần tạo thumbnail YouTube chuyên nghiệp" | 🟡 Trung bình | ✅ YouTube Studio — AI thumbnails |

#### Overlap Analysis — Vấn Đề Nghiêm Trọng

| Feature | OpenShorts | OGA (Sprint 9+) | Overlap? |
|---------|-----------|-----------------|----------|
| Text-to-Video | AI Shorts (AI actors) | Video Studio (LTX/Wan2.1) | 🟡 Trung bình — khác approach |
| Lip-sync | AI actors with lip-sync | LipSync Studio (cloud/local) | 🔴 Cao — cùng use case |
| Video editing | Clip Generator | Chưa có (OpenReel sẽ bổ sung) | 🟡 Trung bình |
| Image generation | YouTube thumbnails | Image Studio (local) | 🟡 Trung bình |

**Vấn đề cốt lõi:** OpenShorts là một *platform độc lập* với frontend riêng, DB riêng, inference riêng. Tích hợp vào OGA đồng nghĩa với việc chạy 2 app song song hoặc refactor lớn. ROI không cao so với việc tự phát triển hoặc dùng OpenReel + OGA native.

#### Cost Model Red Flag 🚩

Repo đề cập "Low Cost ($0.65/video)" và "Premium ($2/video)" — điều này gợi ý:
- OpenShorts có thể dùng cloud APIs bên dưới (replicate, fal.ai)
- Hoặc model weights có licensing tier

Cả hai đều **vi phạm zero-cost mandate** của NQH (scope.md §5.3: "$0.00 per image generation").

### 2.3 Tech Stack (Architect Assessment)

| Component | OpenShorts | OGA | Tương Thích |
|-----------|-----------|-----|-------------|
| Deployment | Docker Compose | FastAPI + Next.js | ⚠️ Khác kiến trúc hoàn toàn |
| Frontend | React (unknown version) | Next.js 15 | ⚠️ Có thể tương thích nhưng không shared |
| Backend | Unknown (Docker) | FastAPI Python | ❌ Khác stack |
| AI Models | AI actors, TTS, lip-sync | diffusers, LivePortrait | ⚠️ Khác engine |
| Database | Likely PostgreSQL/Mongo | Chưa có (localStorage) | ❌ Thêm infra complexity |

**Integration effort: VERY HIGH.** Cần chạy OpenShorts như một microservice riêng biệt, hoặc reverse-engineer và port features vào OGA codebase.

### 2.4 Best Practices Assessment

| Tiêu Chí | Đánh Giá | Ghi Chú |
|----------|----------|---------|
| License | ⚠️ README ghi MIT; vẫn cần verify file `LICENSE` trong repo + compliance AGPL/BAP tách biệt | Không dùng code — chỉ tham khảo UX nên license không blocker |
| Code quality | ⚠️ Khó đánh giá — không có architecture doc, không có test visible | Repo mới, ít stars |
| Documentation | ⚠️ Tối thiểu — chủ yếu là screenshots và demo video | Khó onboard |
| AI Actor licensing | 🚩 **Risk** — AI actors có thể dính likeness rights | Commercial risk cho NQH |

### 2.5 Risk Assessment

| Risk | Mức Độ | Ghi Chú |
|------|--------|---------|
| License cần verify | 🟡 Trung bình | README ghi MIT nhưng chưa thấy `LICENSE` file trong repo; không dùng code nên không blocker |
| Cost model vi phạm zero-cost mandate | 🔴 Cao | $0.65–$2/video không phù hợp NQH |
| AI actor likeness rights | 🔴 Cao | Risk pháp lý khi dùng synthetic faces cho commercial |
| Double infrastructure | 🔴 Cao | Chạy song song với OGA = 2x resource |
| Code quality không verify được | 🟡 Trung bình | Không có tests, metrics |

### 2.6 Kết Luận — OpenShorts

**Verdict: ❌ NOT RECOMMENDED FOR DIRECT INTEGRATION**

Overlap feature quá lớn với OGA Studios. Kiến trúc độc lập (Docker platform) không phù hợp integration. License rủi ro, cost model vi phạm zero-cost mandate, AI actor có commercial liability.

**Khuyến nghị thay thế:**
1. **Tham khảo UX patterns** — Cách OpenShorts tổ chức "AI Shorts" workflow (product URL → script → video) là hay. Có thể học để thiết kế OGA Marketing Studio nâng cao.
2. **Không fork, không integrate code.** Nếu cần feature tương tự, xây dựng trong OGA sử dụng model local (Wan2.1, LTX) + OpenReel (edit).

---

## 3. IndexTTS-Workflow-Studio / Draft to Take — "Local-first AI Audio Production"

🔗 https://github.com/JaySpiffy/IndexTTS-Workflow-Studio

### 3.1 Tóm Tắt Sản Phẩm

Studio sản xuất audio từ kịch bản (script-to-audio). Multi-speaker TTS với emotion, sound design (SFX, ambience, music), timeline mixing. Chạy local qua Docker.

### 3.2 Phù Hợp Tính Năng (PM Assessment)

#### Pain Point của NQH mà Draft to Take giải quyết

| Pain Point NQH | Mức Độ | Draft to Take Có Giải Quyết? |
|----------------|--------|------------------------------|
| "Cần voiceover tiếng Việt/Anh cho video" | 🔴 Cao | ✅ IndexTTS2 + OmniVoice — multi-speaker, emotion |
| "Cần tạo audio quảng cáo từ script" | 🔴 Cao | ✅ Script Canvas — write → cast → generate → export |
| "Cần thêm SFX, nhạc nền vào video" | 🟡 Trung bình | ✅ SFX + ambience + music sidecars |
| "Cần lip-sync từ text mà không cần thu âm" | 🟡 Trung bình | ⚠️ Gián tiếp — TTS → audio → lip-sync pipeline |

#### Gap Analysis

OGA hiện tại có **LipSync Studio** (image/video + audio → lip-sync video) nhưng **không có TTS/voice generation**. User story US-TTS-LIPSYNC (Sprint 8, Could Have) đề cập đến nhu cầu này.

Draft to Take lấp đầy gap: **Text → TTS (multi-speaker, emotion) → Audio mix → LipSync** — hoàn thiện pipeline.

#### Use Case cho NQH

- **F&B:** Script "Bia tươi NQH — thơm ngon từng giọt" → TTS voiceover (giọng nam trầm, enthusiastic) → mix với SFX "cheers" + nhạc nền upbeat → export → đưa vào LipSync Studio với ảnh bartender.
- **Hotel & Tourism:** Script mô tả resort → multi-speaker (narrator + khách testimonial) → emotion: calm, relaxing → ambience: ocean waves → export → ghép vào video drone.
- **Real Estate:** Script bất động sản → voiceover chuyên nghiệp → export → dùng làm audio track cho video sinh từ Wan2.1.

### 3.3 Tech Stack (Architect Assessment)

| Component | Draft to Take | OGA | Tương Thích |
|-----------|--------------|-----|-------------|
| Deployment | Docker Compose (multi-container) | FastAPI + Next.js | ⚠️ Khác pattern nhưng compatible |
| Frontend | React (v3 beta) | Next.js 15 + React | ✅ Cùng ecosystem |
| Backend | Python (FastAPI/Flask — chưa rõ) | FastAPI Python | ✅ Cùng stack! |
| LLM | Qwen3-8B-GGUF (llama.cpp sidecar) | Chưa có | ⚠️ Bổ sung LLM capability |
| TTS | IndexTTS2 | Chưa có | ✅ Bổ sung TTS |
| Voice cloning | OmniVoice | Chưa có | ✅ Bổ sung voice design |
| SFX/Ambience | Woosh-DFlow, MusicGen | Chưa có | ✅ Bổ sung sound design |
| Storage | Local shared folder (`%USERPROFILE%`) | `/tmp/nqh-output/` | ✅ Cùng local-first |

#### Kiến Trúc Integration

```
OGA Tab: "Voice Studio" (hoặc "Audio Studio")
  └── Gọi Draft to Take backend API (nếu expose REST)
      └── Hoặc: Chạy Draft to Take như microservice tại `localhost:3000/8001`
          └── OGA frontend embed Script Canvas UI (iframe hoặc component)
```

**Lựa chọn integration:**
1. **Microservice pattern** (khuyến nghị): Chạy Draft to Take containers trên S1. OGA gọi API để submit script, nhận audio output URL. UI dùng iframe hoặc redirect.
2. **Feature port**: Port IndexTTS2 + OmniVoice vào OGA `local-server/server.py`. Effort cao hơn nhưng unified stack.
3. **Launcher integration**: Dùng `start.bat` / `start.sh` của Draft to Take để khởi động cùng OGA stack.

> **Khuyến nghị:** Bắt đầu với Option 1 — chạy Draft to Take như companion service. Nếu adoption cao, xem xét Option 2 (port vào OGA backend).

#### Hardware Requirements vs S1

| Requirement | Draft to Take | S1 (RTX 5090 32GB) | Fit? |
|-------------|---------------|-------------------|------|
| GPU | NVIDIA, 12–16GB VRAM recommended | RTX 5090 32GB | ✅ Dư sức |
| RAM | 32GB recommended | 64GB+ (server) | ✅ Dư sức |
| OS | Windows 11 recommended | Ubuntu 22.04 | ⚠️ Cần test Linux compatibility |
| Docker | Docker Desktop + WSL2 | Docker native | ✅ Tốt hơn Windows |

**Lưu ý:** Repo beta hướng đến Windows (`.bat` files). Cần viết `start.sh` tương đương cho Ubuntu hoặc dùng `docker compose up` trực tiếp.

### 3.4 Best Practices Assessment

| Tiêu Chí | Đánh Giá | Ghi Chú |
|----------|----------|---------|
| Launcher license | ✅ MIT | Commercial safe |
| Model licenses | ⚠️ Tùy model — cần verify từng cái | IndexTTS2: cần check; MusicGen: MIT; Whisper: MIT |
| Architecture | ✅ Microservices rõ ràng (5 containers) | Scalable, maintainable |
| Documentation | ✅ Good — user manual, authoring guide, smoke test | Beta nhưng đầy đủ |
| Data privacy | ✅ Local-first — scripts, voices, outputs ở local | Phù hợp NQH data governance |
| Diagnostics | ✅ `collect-diagnostics.bat` — best practice | Dễ debug |

### 3.5 Risk Assessment

| Risk | Mức Độ | Mitigation |
|------|--------|------------|
| Beta stability | 🟡 Trung bình | v3.0.0-beta.7 — chưa production-ready |
| Linux support chưa verify | 🟡 Trung bình | Test Docker trên S1 trước khi commit |
| Model license từng cái | 🟡 Trung bình | Audit từng model trước integration |
| VRAM khi chạy song song OGA + Draft to Take | 🟡 Trung bình | OGA idle unload + Draft to Take lazy load |
| Tiếng Việt support | 🟡 Trung bình | Qwen3 hỗ trợ tiếng Việt; IndexTTS2 cần test |

### 3.6 Kết Luận — Draft to Take / IndexTTS

**Verdict: ✅ RECOMMENDED FOR INTEGRATION (P2)**

Lấp đầy gap TTS + audio production mà OGA hoàn toàn thiếu. Kiến trúc microservices Docker tương thích với S1. Local-first philosophy align với NQH data governance. MIT license cho launcher.

**Điều kiện tiên quyết:**
1. Verify Linux Docker compatibility (1 spike day)
2. Verify tiếng Việt TTS quality (1 spike day)
3. Audit model licenses (IndexTTS2 weights, OmniVoice)

**Đề xuất tên tab:** "Voice Studio" hoặc "Audio Studio" — đặt cạnh LipSync Studio.

---

## 4. So Sánh Tổng Hợp

| Tiêu Chí | OpenReel Video | OpenShorts | Draft to Take |
|----------|---------------|------------|---------------|
| **Giá trị cho NQH** | ⭐⭐⭐⭐⭐ (fill gap lớn) | ⭐⭐ (overlap nhiều) | ⭐⭐⭐⭐⭐ (fill gap lớn) |
| **Tích hợp effort** | Thấp–Trung bình | Cao | Trung bình |
| **Tech stack fit** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **License an toàn** | ✅ MIT | ⚠️ Không rõ | ✅ MIT (launcher) |
| **Commercial safe** | ✅ Yes | 🚩 Risk (AI actor) | ⚠️ Cần verify models |
| **Zero-cost phù hợp** | ✅ Yes | ❌ No ($0.65–$2/vid) | ✅ Yes (local inference) |
| **Offline/LAN-first** | ✅ 100% client-side | ⚠️ Self-hosted nhưng có thể gọi cloud | ✅ Local-first |
| **Bảo trì effort** | Thấp | Cao | Trung bình |
| **Khuyến nghị** | ✅ **Tích hợp P1** | ❌ **Không tích hợp** | ✅ **Tích hợp P2** |

---

## 5. Iceberg Model — Phân Tích Hệ Thống

| Layer | Phát Hiện |
|-------|-----------|
| **Event** | 3 repo được đề xuất để tích hợp |
| **Pattern** | OGA giỏi ở *generation* nhưng thiếu *post-production* (edit, audio, voice) |
| **Structure** | NQH cần end-to-end content pipeline: **Gen → Edit → Voice → Lip Sync** thuộc OGA; **Publish** (lịch đăng, Brand Ambassador) thuộc BAP. Hiện tại OGA chỉ có Gen. |

| **Mental Model** | "Mua tool riêng cho từng bước" vs "Một nền tảng unified" — NQH đang xây unified platform; nên integrate complementary tools thay vì duplicate. |

---

## 6. Lộ Trình Đề Xuất

### Phase A (Sprint hiện tại — Sprint 10)
- [ ] **Spike: OpenReel integration** (1–2 ngày): Embed OpenReel trong iframe, test với video output từ Wan2.1/LTX
- [ ] **Spike: Draft to Take Linux** (1 ngày): Chạy Docker trên S1, verify containers khởi động

### Phase B (Sprint 11)
- [ ] **Implement OpenReel tab** (3–5 điểm): "Post-Production Studio" — iframe hoặc embedded, truyền video URL từ OGA gallery
- [ ] **Spike: Draft to Take tiếng Việt** (1 ngày): Test TTS quality với script tiếng Việt NQH

### Phase C (Sprint 12)
- [ ] **Implement Voice Studio tab** (5–8 điểm): Tích hợp Draft to Take API hoặc iframe
- [ ] **Pipeline TTS → LipSync** (3–5 điểm): Voice Studio export audio → tự động hiện trong LipSync Studio

### Phase D (Post-Sprint 12 — BAP Handoff)
- [ ] **Export → BAP**: Final assets (video + audio) từ OGA Post-Production / Voice Studio export sang BAP (Brand Ambassador / lịch đăng). OGA không làm social publishing — tránh trở thành "mini social suite".

### Không Làm
- [ ] ~~Integrate OpenShorts~~ — Overlap cao, cost model không phù hợp, license risk; chỉ tham khảo UX patterns


---

## 7. Appendix: Detail Questions cho CTO Review

1. **OpenReel:** Có muốn fork về `github.com/Minh-Tam-Solution` và customize UI cho NQH brand không? Hay dùng upstream MIT trực tiếp?
2. **Draft to Take:** Có muốn mua/commercial license cho IndexTTS2 weights nếu không phải Apache 2.0? Budget?
3. **Tiếng Việt:** NQH content chủ yếu tiếng Việt hay tiếng Anh? Ảnh hưởng đến model selection (Qwen3 hỗ trợ cả hai).
4. **OpenShorts:** Có muốn dùng như benchmark UX (không integrate code) cho future Marketing Studio redesign?

---

## 8. CPO Sign-off

> **Approved:** OpenReel P1, Draft-to-Take P2 spike-then-integrate, OpenShorts no-integration (reference UX only); publish path owned by BAP.
>
> *— CPO, 2026-05-06*

---

*Prepared by @pm + @architect | NQH Creative Studio (OGA) | SDLC Framework v6.3.1*
