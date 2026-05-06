#!/usr/bin/env python3
"""
Sprint 9.0c — CogVideoX-2B Spike Script
Text-to-video generation on MacBook M4 Pro 24GB
"""

import os
import sys
import time
import gc
import tracemalloc

# Add project paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
from diffusers import CogVideoXPipeline
from diffusers.utils import export_to_video

# Configuration
MODEL_ID = "THUDM/CogVideoX-2b"
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
# CogVideoX has float64 tensors that MPS doesn't support — use float32 on MPS
DTYPE = torch.float32
PROMPT = "A panda playing a guitar in a bamboo forest, high quality"
NUM_FRAMES = 49  # CogVideoX default
HEIGHT = 480
WIDTH = 480
GUIDANCE_SCALE = 6.0
NUM_INFERENCE_STEPS = 50
OUTPUT_PATH = "/tmp/cogvideox_spike_output.mp4"

def get_ram_mb():
    """Get current process RAM in MB."""
    import psutil
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

def main():
    print("=" * 60)
    print("CogVideoX-2B Spike — Text-to-Video")
    print("=" * 60)
    print(f"Device: {DEVICE}")
    print(f"Dtype: {DTYPE}")
    print(f"Model: {MODEL_ID}")
    print(f"Frames: {NUM_FRAMES}, Resolution: {WIDTH}x{HEIGHT}")
    print()

    ram_before = get_ram_mb()
    print(f"RAM before load: {ram_before:.1f} MB")

    # Step 1: Load model
    print("\n[1/4] Loading CogVideoX-2B pipeline...")
    t0 = time.time()
    try:
        pipe = CogVideoXPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=DTYPE,
        )
        # MPS doesn't support float64 — force float32 for all tensors
        if DEVICE == "mps":
            pipe = pipe.to(torch.float32)
        pipe.to(DEVICE)
        load_time = time.time() - t0
        ram_after_load = get_ram_mb()
        print(f"✅ Load complete in {load_time:.1f}s")
        print(f"RAM after load: {ram_after_load:.1f} MB (delta: +{ram_after_load - ram_before:.1f} MB)")
    except Exception as e:
        print(f"❌ Load failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Step 2: Warm-up / compile
    print("\n[2/4] Warm-up inference (shortened)...")
    t0 = time.time()
    try:
        # Use fewer steps for warm-up
        _ = pipe(
            prompt=PROMPT,
            num_frames=NUM_FRAMES,
            height=HEIGHT,
            width=WIDTH,
            num_inference_steps=NUM_INFERENCE_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            generator=torch.Generator(device=DEVICE).manual_seed(42),
        ).frames[0]
        warm_time = time.time() - t0
        ram_after_warm = get_ram_mb()
        print(f"✅ Warm-up complete in {warm_time:.1f}s")
        print(f"RAM after warm-up: {ram_after_warm:.1f} MB (delta: +{ram_after_warm - ram_after_load:.1f} MB)")
    except Exception as e:
        print(f"❌ Warm-up failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Step 3: Main inference
    print("\n[3/4] Main inference...")
    print(f"Prompt: '{PROMPT}'")
    print(f"Resolution: {WIDTH}x{HEIGHT}, Frames: {NUM_FRAMES}")
    t0 = time.time()
    try:
        result = pipe(
            prompt=PROMPT,
            num_frames=NUM_FRAMES,
            height=HEIGHT,
            width=WIDTH,
            num_inference_steps=NUM_INFERENCE_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            generator=torch.Generator(device=DEVICE).manual_seed(42),
        )
        frames = result.frames[0]
        infer_time = time.time() - t0
        ram_after_infer = get_ram_mb()
        print(f"✅ Inference complete in {infer_time:.1f}s")
        print(f"RAM after inference: {ram_after_infer:.1f} MB (delta: +{ram_after_infer - ram_after_warm:.1f} MB)")
        print(f"Output frames: {len(frames)}")
    except Exception as e:
        print(f"❌ Inference failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Step 4: Export video
    print("\n[4/4] Exporting video...")
    t0 = time.time()
    try:
        export_to_video(frames, OUTPUT_PATH, fps=8)
        export_time = time.time() - t0
        file_size = os.path.getsize(OUTPUT_PATH) / 1024 / 1024
        print(f"✅ Video exported to {OUTPUT_PATH}")
        print(f"   File size: {file_size:.1f} MB")
        print(f"   Export time: {export_time:.1f}s")
    except Exception as e:
        print(f"❌ Export failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Summary
    print("\n" + "=" * 60)
    print("SPIKE SUMMARY")
    print("=" * 60)
    print(f"Load time:        {load_time:.1f}s")
    print(f"Warm-up time:     {warm_time:.1f}s")
    print(f"Inference time:   {infer_time:.1f}s")
    print(f"Export time:      {export_time:.1f}s")
    print(f"Peak RAM:         {ram_after_infer:.1f} MB ({ram_after_infer/1024:.1f} GB)")
    print(f"Output:           {OUTPUT_PATH} ({file_size:.1f} MB)")

    # Verdict
    print("\n" + "=" * 60)
    print("VERDICT")
    print("=" * 60)
    if ram_after_infer > 30 * 1024:
        print("RAM: ❌ FAIL (>30GB)")
    elif ram_after_infer > 25 * 1024:
        print("RAM: ⚠️ PROD-ONLY (25-30GB)")
    elif ram_after_infer > 10 * 1024:
        print("RAM: ⚠️ PROD-ONLY (10-25GB)")
    else:
        print("RAM: ✅ PASS (<10GB)")

    if infer_time > 300:
        print("Latency: ❌ FAIL (>300s)")
    elif infer_time > 120:
        print("Latency: ⚠️ PROD-ONLY (120-300s)")
    else:
        print("Latency: ✅ PASS (<120s)")

    return 0

if __name__ == "__main__":
    sys.exit(main())
