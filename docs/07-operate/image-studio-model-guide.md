# Hướng dẫn chọn Model — Image Studio (NQH Creative Studio)

> **Phiên bản:** 1.1 — Cập nhật theo ngành NQH  
> **Ngày:** 2026-05-08  
> **Áp dụng:** GPU Server S1 (RTX 5090) — Local Mode  
> **Ngườì đọc:** Marketing, Sales, F&B, Front Office, BĐS, Tech Team

---

## 1. Tổng quan

Image Studio là công cụ AI tạo ảnh **nội bộ** của NQH, chạy trên GPU Server S1.  
Mục đích chính: hỗ trợ team tạo ảnh nhanh cho **social media, banner, poster, ảnh mẫu BĐS, concept F&B, ảnh khách sạn/tour** — không cần thuê photographer hay designer tốn kém.

> 💡 **Ngoài công việc:** Nhân viên hoàn toàn có thể dùng Image Studio cho nhu cầu cá nhân (ảnh đại diện, thiết kế cá nhân, v.v.). Chỉ cần tuân thủ đạo đức AI và không tạo nội dung vi phạm.

### 4 model hiện có

| Model | Tốc độ | VRAM | Thế mạnh chính | Ngành phù hợp nhất |
|-------|--------|------|----------------|-------------------|
| **Dreamshaper 8** | ~1.5s | ~2.6 GB | Phong cảnh, concept art, ánh sáng cinematic | **Tourism**, Resort, Khách sạn nghỉ dưỡng |
| **Realistic Vision v5.1** | ~1.5s | ~2.1 GB | Chân dung chân thực, ánh sáng studio | **BĐS** (agent portrait), **F&B** (chef, nhân viên) |
| **Anything v5** | ~1.5s | ~2.6 GB | Anime, illustration, màu rực rỡ | **Tech marketing**, Social media trẻ, Campaign sáng tạo |
| **SDXL Base 1.0** | ~2.7s | ~6.6 GB | Chi tiết cao, độ phân giải lớn | **BĐS** (render nội thất, phối cảnh), Poster lớn |

---

## 2. Chọn model theo ngành — NQH

### 🏨 Khách sạn & Resort

| Nhu cầu | Model khuyên dùng | Ví dụ prompt |
|---------|-------------------|--------------|
| Ảnh phòng khách sạn sang trọng | **SDXL Base 1.0** | `luxury hotel suite with ocean view, king bed, modern interior, warm lighting, 5-star resort` |
| Ảnh resort, hồ bơi, biển | **Dreamshaper 8** | `tropical beach resort at sunset, infinity pool, palm trees, cinematic lighting, travel poster` |
| Ảnh nhân viên lễ tân chuyên nghiệp | **Realistic Vision v5.1** | `professional hotel receptionist portrait, warm smile, uniform, soft studio lighting` |

**Mẹo:** Thêm từ khóa `luxury`, `5-star`, `resort`, `boutique hotel` để tăng độ sang trọng.

---

### 🍽️ F&B — Nhà hàng & Ẩm thực

| Nhu cầu | Model khuyên dùng | Ví dụ prompt |
|---------|-------------------|--------------|
| Ảnh món ăn hấp dẫn (food photography) | **Realistic Vision v5.1** | `gourmet Vietnamese pho in elegant bowl, steam rising, fresh herbs, food photography, macro shot, warm lighting` |
| Không gian nhà hàng, quán cà phê | **SDXL Base 1.0** | `cozy Vietnamese coffee shop interior, wooden furniture, warm ambient light, modern rustic design` |
| Ảnh đầu bếp / nhân viên F&B | **Realistic Vision v5.1** | `professional chef portrait, white uniform, confident pose, kitchen background, soft lighting` |
| Menu visual, poster sáng tạo | **Anything v5** | `colorful illustration of Vietnamese street food, vibrant colors, hand-drawn style, festival poster` |

**Mẹo:** Thêm `food photography`, `macro`, `bokeh`, `steam rising` để món ăn trông hấp dẫn hơn.

---

### 🌄 Tham quan & Du lịch

| Nhu cầu | Model khuyên dùng | Ví dụ prompt |
|---------|-------------------|--------------|
| Ảnh điểm tham quan, phong cảnh | **Dreamshaper 8** | `Ha Long Bay at golden hour, limestone karsts, junk boat, misty atmosphere, travel poster` |
| Poster tour, quảng cáo du lịch | **Dreamshaper 8** | `vibrant travel poster of Hoi An ancient town, lanterns, river, colorful sunset, illustration style` |
| Ảnh tour guide chuyên nghiệp | **Realistic Vision v5.1** | `friendly tour guide portrait, outdoor setting, Vietnamese landscape background, natural lighting` |

**Mẹo:** Dreamshaper rất mạnh với phong cảnh Việt Nam. Thêm địa danh cụ thể (`Ha Long`, `Hoi An`, `Sapa`) để kết quả gần gũi hơn.

---

### 🏠 Bất động sản

| Nhu cầu | Model khuyên dùng | Ví dụ prompt |
|---------|-------------------|--------------|
| Render nội thất căn hộ | **SDXL Base 1.0** | `modern apartment living room, floor-to-ceiling windows, minimalist furniture, city view, interior design render` |
| Phối cảnh dự án, nhà mẫu | **SDXL Base 1.0** | `luxury villa exterior, tropical garden, swimming pool, modern architecture, golden hour, real estate render` |
| Ảnh đại diện agent / sales | **Realistic Vision v5.1** | `professional real estate agent portrait, business suit, confident smile, office background, studio lighting` |
| Ảnh nội thất cozy, ấm cúng | **Dreamshaper 8** | `cozy living room with fireplace, warm lighting, comfortable sofa, interior design, cinematic atmosphere` |

**Mẹo:** SDXL cho ra độ chi tiết cao nhất cho nội thất. Thêm `interior design render`, `architectural visualization` để kết quả chuyên nghiệp.

---

### 💻 Tech & Nội bộ

| Nhu cầu | Model khuyên dùng | Ví dụ prompt |
|---------|-------------------|--------------|
| Banner tech event, hackathon | **Anything v5** | `futuristic tech conference banner, neon lights, digital particles, vibrant colors, modern illustration` |
| Ảnh đại diện nhân viên công nghệ | **Realistic Vision v5.1** | `young tech professional portrait, casual smart outfit, modern office background, natural lighting` |
| Infographic concept, visual sáng tạo | **Anything v5** | `colorful tech infographic illustration, AI brain, data visualization, flat design, vibrant colors` |
| Poster startup, sản phẩm công nghệ | **Dreamshaper 8** | `futuristic smart city with AI technology, holographic interfaces, cinematic lighting, concept art` |

---

## 3. Tham khảo nhanh theo model

### 🎨 Dreamshaper 8 — "Chuyên gia phong cảnh & concept"

| | |
|---|---|
| **Tốc độ** | ⭐⭐⭐⭐⭐ (1.5s) |
| **VRAM** | ~2.6 GB |
| **Ngành NQH** | **Tourism**, Khách sạn resort, Concept art |
| **Điểm mạnh** | Phong cảnh đẹp, ánh sáng cinematic, concept art |
| **Điểm yếu** | Chân dung không chân thực bằng Realistic Vision |

**Prompt mẫu cho NQH:**
```
Ha Long Bay at golden hour, limestone karsts, traditional junk boat,
misty atmosphere, travel poster, cinematic lighting, highly detailed
```

---

### 📸 Realistic Vision v5.1 — "Chuyên gia chân dung & ảnh thật"

| | |
|---|---|
| **Tốc độ** | ⭐⭐⭐⭐⭐ (1.5s) |
| **VRAM** | ~2.1 GB (nhẹ nhất) |
| **Ngành NQH** | **BĐS** (agent), **F&B** (chef, món ăn), Nhân sự |
| **Điểm mạnh** | Chân dung chân thực, food photography, studio lighting |
| **Điểm yếu** | Phong cảnh không bằng Dreamshaper |

**Prompt mẫu cho NQH:**
```
gourmet Vietnamese banh mi on wooden board, fresh vegetables,
food photography, macro shot, warm natural lighting, steam rising
```

---

### 🌸 Anything v5 — "Chuyên gia illustration & anime"

| | |
|---|---|
| **Tốc độ** | ⭐⭐⭐⭐⭐ (1.5s) |
| **VRAM** | ~2.6 GB |
| **Ngành NQH** | **Tech marketing**, Social media, Campaign sáng tạo |
| **Điểm mạnh** | Màu sắc rực rỡ, anime, illustration, hand-drawn feel |
| **Điểm yếu** | Không phù hợp ảnh chân thực hoặc BĐS render |

**Prompt mẫu cho NQH:**
```
colorful illustration of Vietnamese night market, street food stalls,
lanterns, vibrant colors, hand-drawn style, festival poster
```

---

### 🏙️ SDXL Base 1.0 — "Chuyên gia chi tiết & độ phân giải cao"

| | |
|---|---|
| **Tốc độ** | ⭐⭐⭐ (2.7s) |
| **VRAM** | ~6.6 GB (nặng nhất) |
| **Ngành NQH** | **BĐS** (nội thất, phối cảnh), Poster in lớn |
| **Điểm mạnh** | Chi tiết cao, hiểu prompt tốt, độ phân giải lớn |
| **Điểm yếu** | Chậm hơn, tốn VRAM gấp đôi |

**Prompt mẫu cho NQH:**
```
luxury penthouse apartment interior, floor-to-ceiling windows,
minimalist furniture, city skyline view, interior design render,
soft ambient lighting, ultra detailed
```

---

## 4. Bảng tra cứu nhanh

| Tôi cần tạo... | Chọn model |
|----------------|------------|
| Ảnh phong cảnh du lịch (Hạ Long, Sapa, Hội An) | **Dreamshaper 8** |
| Ảnh món ăn, menu, food photography | **Realistic Vision v5.1** |
| Ảnh chân dung nhân viên, agent BĐS | **Realistic Vision v5.1** |
| Ảnh resort, hồ bơi, biển | **Dreamshaper 8** |
| Render nội thất căn hộ, nhà mẫu | **SDXL Base 1.0** |
| Poster sáng tạo, campaign marketing | **Anything v5** |
| Banner tech event, infographic | **Anything v5** |
| Phối cảnh dự án BĐS | **SDXL Base 1.0** |
| Ảnh khách sạn 5 sao, lobby, suite | **SDXL Base 1.0** |
| Không biết chọn gì | **Dreamshaper 8** |

---

## 5. Hạn chế & Lưu ý

### VRAM & Swap
- S1 có **32 GB VRAM** (RTX 5090)
- Mỗi lúc chỉ **1 model** được giữ trong VRAM (auto-swap)
- Model đang dùng bị unload sau **5 phút** idle để giải phóng VRAM
- Nếu thấy lỗi "Pipeline swap in progress" — đợi 10–15 giây rồi thử lại

### Z-Image Turbo (tạm dừng)
- Model này hiện bị lỗi `torch._dynamo` với torch nightly → crash server
- Đang tạm ẩn. Sẽ khôi phục khi PyTorch/SDNQ fix.

### Cloud models trong dropdown
- Các model cloud (Seedance, Kling, Veo...) hiện vẫn hiển thị ở Video Studio
- Nhưng **không chạy được** ở local mode → sẽ báo lỗi 400
- Đang lên kế hoạch ẩn trong bản cập nhật tiếp

---

## 6. Quy trình sử dụng

1. Mở **studio.nhatquangholding.com** → nhập PIN
2. Chọn tab **Image Studio**
3. Viết prompt mô tả ảnh cần tạo (tham khảo prompt mẫu ở trên)
4. Click nút model hiện tại → chọn model phù hợp ngành
5. Click **Generate ✨**
6. Ảnh xuất hiện trong 1–3 giây → click **Download** hoặc **Regenerate**

> 💡 **Mẹo:** Nhấn **Ctrl+Shift+R** nếu gặp lỗi load (cache cũ).

---

## 7. Liên hệ & Hỗ trợ

| Vấn đề | Liên hệ |
|--------|---------|
| Server lỗi / crash | @devops — check `nvidia-smi` + server log |
| Chất lượng ảnh không như ý | @tester — tuning prompt & model |
| Yêu cầu thêm model mới | @pm — đánh giá VRAM & license |
| Hướng dẫn sử dụng | @assistant — cập nhật tài liệu |
| Dùng cho nhu cầu cá nhân | ✅ Hoàn toàn được — chỉ cần tuân thủ đạo đức AI |

---

*Generated by @tester + @coder — NQH Creative Studio | S1 Benchmark 2026-05-08*
