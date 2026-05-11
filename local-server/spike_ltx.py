#!/usr/bin/env python3
"""
Spike Script — LTX-Video (2B base) on GPU Server S1 (RTX 5090, CUDA 12.8)
Text-to-video generation via Diffusers 0.38.0
"""

import os
import sys
import time
import gc

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
from diffusers import LTXPipeline
from diffusers.utils import export_to_video

# ── Configuration ──
# Try base model ID first; 2B distilled variant may be available under subfolders or separate repos
MODEL_ID = "Lightricks/LTX-Video"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

TEST_CONFIGS = [
    ("float16 + cpu_offload + vae_tiling", torch.float16, True),
    ("bfloat16 + cpu_offload + vae_tiling", torch.bfloat16, True),
]

PROMPT = "A baker carefully decorating a birthday cake with colorful frosting, warm kitchen lighting, close-up shot"

# LTX requires: resolution divisible by 32, frames divisible by 8+1
HEIGHT = 512
WIDTH = 768
NUM_FRAMES = 65  # 8*8 + 1 = 65 (~2.7s @ 24fps)
GUIDANCE_SCALE = 3.0
NUM_INFERENCE_STEPS = 30
OUTPUT_DIR = "/tmp/nqh-output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Helpers ──

def get_vram_mb():
    if torch.cuda.is_available():
        return torch.cuda.memory_allocated() / 1024 / 1024
    return 0.0

def get_vram_peak_mb():
    if torch.cuda.is_available():
        return torch.cuda.max_memory_allocated() / 1024 / 1024
    return 0.0

def reset_vram_peak():
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()

def unload_pipe(pipe):
    del pipe
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()

# ── Main ──

def test_config(label, dtype, use_cpu_offload):
    print("\n" + "=" * 70)
    print(f"CONFIG: {label}")
    print(f"dtype={dtype}, cpu_offload={use_cpu_offload}")
    print("=" * 70)

    reset_vram_peak()
    vram_before = get_vram_mb()
    print(f"VRAM before load: {vram_before:.1f} MB")

    # Step 1: Load
    print("\n[1/4] Loading LTX-Video...")
    t0 = time.time()
    try:
        pipe = LTXPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=dtype,
        )
        pipe.vae.enable_tiling()

        if use_cpu_offload and DEVICE == "cuda":
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(DEVICE)

        load_time = time.time() - t0
        vram_after_load = get_vram_mb()
        print(f"✅ Load complete in {load_time:.1f}s")
        print(f"VRAM after load: {vram_after_load:.1f} MB (delta: +{vram_after_load - vram_before:.1f} MB)")
    except Exception as e:
        print(f"❌ Load failed: {e}")
        import traceback
        traceback.print_exc()
        return False, 0, 0, 0

    # Step 2: Warm-up inference (fewer steps)
    print("\n[2/4] Warm-up inference (8 steps)...")
    t0 = time.time()
    try:
        _ = pipe(
            prompt=PROMPT,
            height=HEIGHT,
            width=WIDTH,
            num_frames=NUM_FRAMES,
            num_inference_steps=8,
            guidance_scale=GUIDANCE_SCALE,
            generator=torch.Generator(device=DEVICE).manual_seed(42),
        ).frames[0]
        warm_time = time.time() - t0
        vram_after_warm = get_vram_mb()
        print(f"✅ Warm-up complete in {warm_time:.1f}s")
        print(f"VRAM after warm-up: {vram_after_warm:.1f} MB")
    except Exception as e:
        print(f"❌ Warm-up failed: {e}")
        import traceback
        traceback.print_exc()
        unload_pipe(pipe)
        return False, 0, 0, 0

    # Step 3: Main inference
    output_path = os.path.join(OUTPUT_DIR, f"ltx_spike_{label.replace(' ', '_').replace('+', '')}.mp4")
    print(f"\n[3/4] Main inference ({NUM_INFERENCE_STEPS} steps)...")
    print(f"Resolution: {WIDTH}x{HEIGHT}, Frames: {NUM_FRAMES}")
    t0 = time.time()
    try:
        result = pipe(
            prompt=PROMPT,
            height=HEIGHT,
            width=WIDTH,
            num_frames=NUM_FRAMES,
            num_inference_steps=NUM_INFERENCE_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            generator=torch.Generator(device=DEVICE).manual_seed(42),
        )
        frames = result.frames[0]
        infer_time = time.time() - t0
        vram_after_infer = get_vram_mb()
        vram_peak = get_vram_peak_mb()
        print(f"✅ Inference complete in {infer_time:.1f}s")
        print(f"VRAM after inference: {vram_after_infer:.1f} MB")
        print(f"Peak VRAM: {vram_peak:.1f} MB ({vram_peak/1024:.2f} GB)")
        print(f"Output frames: {len(frames)}")
    except Exception as e:
        print(f"❌ Inference failed: {e}")
        import traceback
        traceback.print_exc()
        unload_pipe(pipe)
        return False, 0, 0, 0

    # Step 4: Export
    print("\n[4/4] Exporting video...")
    t0 = time.time()
    try:
        export_to_video(frames, output_path, fps=24)
        export_time = time.time() - t0
        file_size = os.path.getsize(output_path) / 1024 / 1024
        print(f"✅ Video exported to {output_path}")
        print(f"   File size: {file_size:.1f} MB")
        print(f"   Export time: {export_time:.1f}s")
    except Exception as e:
        print(f"❌ Export failed: {e}")
        import traceback
        traceback.print_exc()
        unload_pipe(pipe)
        return False, 0, 0, 0

    # Cleanup
    unload_pipe(pipe)
    vram_after_unload = get_vram_mb()
    print(f"VRAM after unload: {vram_after_unload:.1f} MB")

    # Summary
    print("\n" + "-" * 70)
    print(f"RESULT for {label}")
    print("-" * 70)
    print(f"Load time:      {load_time:.1f}s")
    print(f"Warm-up time:   {warm_time:.1f}s")
    print(f"Inference time: {infer_time:.1f}s")
    print(f"Export time:    {export_time:.1f}s")
    print(f"Peak VRAM:      {vram_peak:.1f} MB ({vram_peak/1024:.2f} GB)")
    print(f"Output:         {output_path}")

    # Verdict
    ok = True
    if vram_peak > 32 * 1024:
        print("VRAM: ❌ FAIL (>32GB)")
        ok = False
    elif vram_peak > 28 * 1024:
        print("VRAM: ⚠️ BORDERLINE (28-32GB)")
    else:
        print("VRAM: ✅ PASS (<28GB)")

    if infer_time > 600:
        print("Latency: ❌ FAIL (>10min)")
        ok = False
    elif infer_time > 300:
        print("Latency: ⚠️ SLOW (5-10min)")
    else:
        print("Latency: ✅ PASS (<5min)")

    return ok, infer_time, vram_peak, output_path


def main():
    print("=" * 70)
    print("LTX-Video Spike — GPU Server S1")
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")
        print(f"CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    print(f"Model ID: {MODEL_ID}")
    print("=" * 70)

    results = []
    for label, dtype, offload in TEST_CONFIGS:
        ok, latency, vram, path = test_config(label, dtype, offload)
        results.append((label, ok, latency, vram, path))
        time.sleep(2)

    # Final comparison
    print("\n" + "=" * 70)
    print("SPIKE COMPARISON")
    print("=" * 70)
    print(f"{'Config':<40} {'Status':<10} {'Latency':<12} {'Peak VRAM':<12}")
    print("-" * 70)
    for label, ok, latency, vram, path in results:
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"{label:<40} {status:<10} {latency:.1f}s{'':<5} {vram/1024:.2f} GB")

    passing = [(l, o, la, vr, p) for l, o, la, vr, p in results if o]
    if passing:
        best = min(passing, key=lambda x: x[2])
        print(f"\n🏆 BEST CONFIG: {best[0]} ({best[2]:.1f}s, {best[3]/1024:.2f} GB peak)")
        print(f"   Output: {best[4]}")
    else:
        print("\n⚠️ No config passed all gates.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
