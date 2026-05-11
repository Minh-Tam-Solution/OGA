# Product Decision: ComfyUI vs OGA Image/Video Studio

> **Status:** DRAFT — PM Review  
> **Date:** 2026-05-08  
> **Stakeholders:** @pm, @itadmin, @architect, @devops  
> **Scope:** NQH Creative Platform — AI Image/Video Generation

---

## 1. Bối cảnh

### ComfyUI (hiện có)
- **Vị trí:** `/home/nqh/shared/models/apps/comfyui`
- **Domain:** `sd.nhatquangholding.com` — **không accessible từ bên ngoài** (timeout)
- **Interface:** Node-based workflow — **phức tạp** cho ngườì dùng phổ thông
- **Models:** FLUX Schnell FP8 (17GB), SDXL Base, SDXL Lightning, SD 1.5
- **Disk:** ~38.5 GB
- **VRAM:** Reserve 4GB cho Ollama, chạy trong Docker

### OGA Image/Video Studio (đang phát triển)
- **Domain:** `studio.nhatquangholding.com` — sẽ accessible qua NAT
- **Interface:** Prompt bar + dropdown model + Generate — **đơn giản**
- **Image models:** Dreamshaper 8, Realistic Vision v5.1, Anything v5, SDXL Base 1.0
- **Video model:** AnimateDiff Lightning
- **Disk:** ~2 GB (code + venv)
- **VRAM:** Lazy-load, auto-unload sau 5 phút idle

---

## 2. Phân tích đối chiếu

### A. Ngườì dùng mục tiêu — NQH

| Persona | Kỹ năng | Nhu cầu | ComfyUI phù hợp? | OGA phù hợp? |
|---------|---------|---------|------------------|--------------|
| **Marketing Executive** | Không chuyên design | Banner, post social | ❌ Quá phức tạp | ✅ Chỉ cần nhập prompt |
| **Sales BĐS** | Không chuyên design | Ảnh phối cảnh, chân dung | ❌ Cần setup workflow | ✅ Chọn model + generate |
| **F&B Manager** | Không chuyên design | Ảnh món ăn, menu | ❌ Node graph khó hiểu | ✅ Prompt đơn giản |
| **Designer chuyên nghiệp** | Chuyên design | Inpainting, ControlNet, custom workflow | ✅ Cần node flexibility | ⚠️ Có thể hạn chế |

**Kết luận:** 80–90% ngườì dùng NQH là **non-technical**. OGA phù hợp đa số. ComfyUI chỉ phù hợp designer chuyên nghiệp (~10%).

### B. Models overlap

| Model | ComfyUI | OGA | Ghi chú |
|-------|---------|-----|---------|
| SD 1.5 Base | ✅ 4.3 GB | ✅ (Dreamshaper, Realistic Vision, Anything) | OGA có 3 variant chuyên biệt |
| SDXL Base | ✅ 6.9 GB | ✅ 6.9 GB | Trùng lặp hoàn toàn |
| SDXL Lightning | ✅ 5.1 GB | ❌ | OGA chưa có, nhưng tốc độ OGA SD 1.5 đã đủ nhanh (~1.5s) |
| **FLUX Schnell FP8** | ✅ **17.2 GB** | ❌ | **Đây là thiếu sót lớn nhất của OGA** |
| FLUX.2 Klein 4B | ❌ | ✅ (backend ready, chưa expose frontend) | Có thể bật nhanh |

### C. Chi phí vận hành

| Yếu tố | ComfyUI | OGA | Chênh lệch |
|--------|---------|-----|------------|
| Disk | 38.5 GB | ~2 GB | +36.5 GB |
| VRAM idle | 4GB reserved + model loaded | 0 GB (lazy unload) | ComfyUI tốn hơn |
| Maintenance | Docker, custom nodes, workflow | Next.js + FastAPI | ComfyUI phức tạp hơn |
| Domain/NAT | sd.nhatquangholding.com (dead) | studio.nhatquangholding.com (pending) | Cần quyết định 1 domain |
| Security | Expose port 8188 | Proxy qua Next.js + PIN gate | OGA bảo mật hơn |

### D. Tính năng nâng cao

| Tính năng | ComfyUI | OGA | Đánh giá |
|-----------|---------|-----|----------|
| Node-based workflow | ✅ Linh hoạt tối đa | ❌ Không có | ComfyUI thắng |
| ControlNet | ✅ Sẵn có | ❌ Chưa có | ComfyUI thắng |
| Inpainting | ✅ Sẵn có | ❌ Chưa có | ComfyUI thắng |
| IP-Adapter | ✅ Sẵn có | ✅ Backend có, chưa expose UI | Ngang nhau |
| LoRA loading | ✅ Sẵn có | ❌ Chưa có | ComfyUI thắng |
| Video generation | ⚠️ Có thể nhưng phức tạp | ✅ AnimateDiff tích hợp sẵn | OGA thắng |
| Batch generation | ✅ | ❌ Chưa có | ComfyUI thắng |

---

## 3. Khuyến nghị

### Quyết định chính: **OGA là platform chính thức. ComfyUI chuyển sang chế độ "Power User Backend".**

#### Lý do:
1. **Ngườì dùng NQH đa số không phải designer chuyên nghiệp** — họ cần tool đơn giản, không cần node graph
2. **OGA đã cover 80% use case** (ảnh BĐS, F&B, tour, portrait, banner)
3. **Bảo mật:** OGA có PIN gate, proxy qua Next.js. ComfyUI expose trực tiếp port 8188
4. **Chi phí:** Chạy song song 2 hệ thống tốn VRAM và disk không cần thiết

#### Hành động cụ thể:

| STT | Hành động | Owner | Priority | Timeline |
|-----|-----------|-------|----------|----------|
| 1 | **Expose FLUX.2 Klein 4B** trên OGA frontend (đã có backend) | @coder | High | Ngay |
| 2 | **Đánh giá FLUX Schnell FP8** — nếu cần, migrate vào OGA backend | @architect | Medium | 1 tuần |
| 3 | **Tắt ComfyUI public domain** `sd.nhatquangholding.com` — không expose ra ngoài | @itadmin | High | Ngay |
| 4 | **Giữ ComfyUI chạy local** (port 8188) cho designer chuyên nghiệp khi cần | @itadmin | Low | Duy trì |
| 5 | **Backup models ComfyUI** sang cold storage trước khi xóa (dự phòng) | @devops | Medium | 1 tuần |
| 6 | **Sau 30 ngày** — nếu không có usage log ComfyUI, xóa hoàn toàn, giải phóng 38GB | @pm + @devops | Low | 1 tháng |

---

## 4. Rủi ro & Mitigation

| Rủi ro | Xác suất | Impact | Mitigation |
|--------|----------|--------|------------|
| Designer chuyên nghiệp phản đối vì mất ControlNet/Inpainting | Medium | Medium | Giữ ComfyUI chạy nội bộ port 8188 cho đến khi OGA có tính năng tương đương |
| FLUX Schnell FP8 không migrate được vào OGA (VRAM 17GB) | Low | High | Đánh giá trước — nếu không được, giữ ComfyUI chỉ để chạy FLUX |
| Ngườì dùng quen ComfyUI không chuyển được | Low | Low | Training + tài liệu hướng dẫn OGA đã có sẵn |
| OGA crash khi load model nặng (SDXL + FLUX cùng lúc) | Low | Medium | Auto-swap + idle unload đã xử lý. Monitor VRAM. |

---

## 5. Appendix: Model Migration Checklist

### Từ ComfyUI → OGA

```
ComfyUI models/              →  OGA local-server/models.json
├── unet/flux1-schnell-fp8   →  [EVALUATE] Có thể load quan diffusers?
├── checkpoints/sd_xl_base   →  ✅ Đã có
├── checkpoints/sd_v1-5      →  ✅ Có Dreamshaper/Realistic Vision/Anything
├── checkpoints/sdxl_lightning → [EVALUATE] Có thể thêm pipeline Lightning?
└── clip/t5xxl + clip_l      →  [NEED] Nếu muốn chạy FLUX trong OGA
```

### Notes kỹ thuật
- `flux1-schnell-fp8.safetensors` (17GB) là **diffusion model** — có thể load qua `FluxPipeline` của diffusers nếu convert đúng format
- `sdxl_lightning_4step_unet.safetensors` (5.1GB) là **UNet distilled** — có thể tích hợp vào `StableDiffusionXLPipeline` với custom scheduler
- Cần kiểm tra xem `diffusers` version trong OGA có hỗ trợ FLUX Schnell FP8 không

---

*Decision Owner: @pm  
Reviewers: @architect, @itadmin, @devops  
Next Review: 2026-06-08 (30 days)*
