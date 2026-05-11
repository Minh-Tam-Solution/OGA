#!/usr/bin/env python3
"""
Spike Script — Wan2.1 T2V-1.3B on GPU Server S1 (RTX 5090, CUDA 12.8)
Text-to-video generation via Diffusers 0.38.0
"""

import os
import sys
import time
import gc

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.schedulers.scheduling_unipc_multistep import UniPCMultistepScheduler
from diffusers.utils import export_to_video

# ── Configuration ──
MODEL_ID = "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Test matrix: (label, torch_dtype, use_cpu_offload)
# RTX 5090 (Blackwell) may need float16 like CogVideoX
TEST_CONFIGS = [
    ("float16 + cpu_offload", torch.float16, True),
    ("bfloat16 + cpu_offload", torch.bfloat16, True),
]

PROMPT = "A cat and a dog baking a cake together in a kitchen. The cat is carefully measuring flour, while the dog is stirring the batter with a wooden spoon. The kitchen is cozy, with sunlight streaming through the window."
NEGATIVE_PROMPT = "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards"

# 480P settings (flow_shift=3.0)
HEIGHT = 480
WIDTH = 832
NUM_FRAMES = 81
GUIDANCE_SCALE = 5.0
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
    """Unload pipeline and reclaim VRAM."""
    global pipe_ref
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
    print("\n[1/4] Loading Wan2.1-T2V-1.3B...")
    t0 = time.time()
    try:
        vae = AutoencoderKLWan.from_pretrained(
            MODEL_ID, subfolder="vae", torch_dtype=torch.float32
        )
        flow_shift = 3.0  # 3.0 for 480P, 5.0 for 720P
        scheduler = UniPCMultistepScheduler(
            prediction_type="flow_prediction",
            use_flow_sigmas=True,
            num_train_timesteps=1000,
            flow_shift=flow_shift,
        )
        pipe = WanPipeline.from_pretrained(
            MODEL_ID,
            vae=vae,
            torch_dtype=dtype,
        )
        pipe.scheduler = scheduler

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
            negative_prompt=NEGATIVE_PROMPT,
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
    output_path = os.path.join(OUTPUT_DIR, f"wan21_spike_{label.replace(' ', '_').replace('+', '')}.mp4")
    print(f"\n[3/4] Main inference ({NUM_INFERENCE_STEPS} steps)...")
    print(f"Resolution: {WIDTH}x{HEIGHT}, Frames: {NUM_FRAMES}")
    t0 = time.time()
    try:
        result = pipe(
            prompt=PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
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
        export_to_video(frames, output_path, fps=16)
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
    print("Wan2.1 T2V-1.3B Spike — GPU Server S1")
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")
        print(f"CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    print("=" * 70)

    results = []
    for label, dtype, offload in TEST_CONFIGS:
        ok, latency, vram, path = test_config(label, dtype, offload)
        results.append((label, ok, latency, vram, path))
        # Small delay between runs
        time.sleep(2)

    # Final comparison
    print("\n" + "=" * 70)
    print("SPIKE COMPARISON")
    print("=" * 70)
    print(f"{'Config':<30} {'Status':<10} {'Latency':<12} {'Peak VRAM':<12}")
    print("-" * 70)
    for label, ok, latency, vram, path in results:
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"{label:<30} {status:<10} {latency:.1f}s{'':<5} {vram/1024:.2f} GB")

    # Best config recommendation
    passing = [(l, o, la, vr, p) for l, o, la, vr, p in results if o]
    if passing:
        best = min(passing, key=lambda x: x[2])  # lowest latency
        print(f"\n🏆 BEST CONFIG: {best[0]} ({best[2]:.1f}s, {best[3]/1024:.2f} GB peak)")
        print(f"   Output: {best[4]}")
    else:
        print("\n⚠️ No config passed all gates.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
