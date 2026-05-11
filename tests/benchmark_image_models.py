#!/usr/bin/env python3
"""
Image Studio Model Benchmark — NQH Creative Studio (S1)
=======================================================
Mục đích: benchmark tất cả model ảnh trong local mode,
            đo latency + VRAM + lưu sample output cho đánh giá chất lượng.

Chạy:
    cd /home/nqh/shared/OGA
    python3 tests/benchmark_image_models.py
"""
import base64
import json
import subprocess
import sys
from pathlib import Path
from time import time

API_URL = "http://localhost:8000"
OUTPUT_DIR = Path(__file__).parent / "benchmark-output"
OUTPUT_DIR.mkdir(exist_ok=True)

MODELS = [
    {
        "id": "dreamshaper-8",
        "name": "Dreamshaper 8",
        "strength": "Đa năng, phong cách nghệ thuật (fantasy, concept art, landscapes)",
        "prompt": "a majestic dragon flying over a medieval castle, fantasy art, highly detailed, cinematic lighting",
        "aspect_ratio": "16:9",
    },
    {
        "id": "realistic-vision-v51",
        "name": "Realistic Vision v5.1",
        "strength": "Chân thực, chân dung ngườì, ánh sáng studio",
        "prompt": "professional portrait of a young woman, soft studio lighting, 85mm lens, shallow depth of field, photorealistic",
        "aspect_ratio": "3:4",
    },
    {
        "id": "anything-v5",
        "name": "Anything v5",
        "strength": "Anime, illustration, màu sắc rực rỡ, phong cách Nhật Bản",
        "prompt": "cute anime girl with pink hair, cherry blossom background, vibrant colors, detailed eyes, studio ghibli style",
        "aspect_ratio": "9:16",
    },
    {
        "id": "stable-diffusion-xl-base",
        "name": "SDXL Base 1.0",
        "strength": "Độ phân giải cao, chi tiết tốt, đa dụng",
        "prompt": "futuristic cityscape at sunset, neon lights, flying cars, ultra detailed, cinematic, 8k",
        "aspect_ratio": "16:9",
    },
]


def bench(model):
    print(f"\n{'='*60}")
    print(f"🧪 Testing: {model['name']} ({model['id']})")
    print(f"   Prompt: {model['prompt']}")
    print(f"   AR:     {model['aspect_ratio']}")

    payload = {
        "prompt": model["prompt"],
        "aspect_ratio": model["aspect_ratio"],
    }

    t0 = time()
    proc = subprocess.run(
        [
            "curl", "-sf", "-X", "POST",
            f"{API_URL}/api/v1/{model['id']}",
            "-H", "Content-Type: application/json",
            "-H", "x-api-key: local-bypass",
            "-d", json.dumps(payload),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time() - t0

    if proc.returncode != 0:
        print(f"   ❌ CURL FAILED: {proc.stderr}")
        return None

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        print(f"   ❌ JSON PARSE FAILED: {e}")
        return None

    status = data.get("status")
    meta = data.get("_meta", {})
    latency = meta.get("elapsed_seconds")
    ram = meta.get("peak_ram_mb")

    print(f"   ✅ Status: {status}")
    print(f"   ⏱  Backend latency: {latency}s")
    print(f"   📊 Peak VRAM: {ram} MB")
    print(f"   🔄 Wall-clock: {elapsed:.1f}s")

    # Save image
    out = data.get("outputs", [""])[0]
    if out.startswith("data:image/png;base64,"):
        b64 = out.split(",", 1)[1]
        img_path = OUTPUT_DIR / f"{model['id']}.png"
        img_path.write_bytes(base64.b64decode(b64))
        print(f"   💾 Saved: {img_path}")
    else:
        print(f"   ⚠️  No image output (unexpected format)")
        return None

    return {
        "id": model["id"],
        "name": model["name"],
        "latency_s": latency,
        "wall_s": round(elapsed, 1),
        "peak_ram_mb": ram,
        "img_path": str(img_path),
    }


def main():
    results = []
    for m in MODELS:
        r = bench(m)
        if r:
            results.append(r)

    print(f"\n{'='*60}")
    print("📋 SUMMARY")
    print(f"{'='*60}")
    for r in results:
        print(f"  {r['name']:25s} | {r['latency_s']:>5.1f}s | {r['peak_ram_mb']:>5} MB")

    report_path = OUTPUT_DIR / "benchmark_report.json"
    report_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\n📁 Report saved: {report_path}")
    print(f"📁 Images saved: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
