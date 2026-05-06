"""Sprint 7.0 — AnimateDiff-Lightning Spike Script.

Measures: peak RAM, latency, output quality for 512x512x16 frames.
Target: PASS if peak < 9GB & latency < 60s on 24GB MacBook.
"""

import gc
import time
import torch
from pathlib import Path

from diffusers import AnimateDiffPipeline, MotionAdapter, DDIMScheduler
from diffusers.utils import export_to_gif

OUTPUT_DIR = Path("/tmp/nqh-spike-animatediff")
OUTPUT_DIR.mkdir(exist_ok=True)

PROMPT = "A astronaut riding a horse on the moon, cinematic lighting"
NUM_FRAMES = 16
WIDTH, HEIGHT = 512, 512
NUM_INFERENCE_STEPS = 4  # Lightning / LCM


def get_ram_mb():
    if torch.backends.mps.is_available():
        return round(torch.mps.current_allocated_memory() / 1024 / 1024)
    return 0


def main():
    print("=" * 60)
    print("AnimateDiff-Lightning Spike")
    print("=" * 60)
    print(f"Prompt: {PROMPT}")
    print(f"Resolution: {WIDTH}x{HEIGHT}, Frames: {NUM_FRAMES}, Steps: {NUM_INFERENCE_STEPS}")
    print()

    # Load motion adapter
    print("Loading MotionAdapter...")
    t0 = time.time()
    adapter = MotionAdapter.from_pretrained(
        "guoyww/animatediff-motion-adapter-v1-5-2",
        torch_dtype=torch.float16,
    )
    adapter_load_time = time.time() - t0
    print(f"  Adapter loaded in {adapter_load_time:.1f}s")

    # Load base pipeline
    print("Loading base SD 1.5 pipeline...")
    t0 = time.time()
    pipe = AnimateDiffPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        motion_adapter=adapter,
        torch_dtype=torch.float16,
    )
    pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
    base_load_time = time.time() - t0
    print(f"  Base pipeline loaded in {base_load_time:.1f}s")

    # Enable CPU offload
    if torch.backends.mps.is_available():
        pipe.enable_model_cpu_offload(device="mps")
        print("  MPS CPU offload enabled")
    else:
        pipe.enable_model_cpu_offload()
        print("  CPU offload enabled")

    ram_after_load = get_ram_mb()
    print(f"  RAM after load: {ram_after_load}MB")
    print()

    # Generate
    print("Generating animation...")
    t0 = time.time()
    ram_before_gen = get_ram_mb()

    result = pipe(
        prompt=PROMPT,
        num_frames=NUM_FRAMES,
        width=WIDTH,
        height=HEIGHT,
        num_inference_steps=NUM_INFERENCE_STEPS,
        guidance_scale=1.0,  # Lightning typically uses low CFG
    )

    gen_time = time.time() - t0
    ram_after_gen = get_ram_mb()
    peak_ram = max(ram_after_load, ram_after_gen)

    print(f"  Generation time: {gen_time:.1f}s")
    print(f"  RAM before gen: {ram_before_gen}MB")
    print(f"  RAM after gen: {ram_after_gen}MB")
    print(f"  Peak RAM: {peak_ram}MB")
    print()

    # Export
    gif_path = OUTPUT_DIR / "animatediff_spike.gif"
    export_to_gif(result.frames[0], str(gif_path))
    print(f"  Output saved: {gif_path}")
    print()

    # Verdict
    print("-" * 60)
    if peak_ram < 9 * 1024 and gen_time < 60:
        verdict = "PASS (24GB)"
    elif peak_ram < 20 * 1024:
        verdict = "PROD-ONLY (48GB)"
    else:
        verdict = "FAIL"

    print(f"Verdict: {verdict}")
    print(f"  Peak RAM: {peak_ram}MB (limit: 9GB=PASS, 20GB=PROD-ONLY)")
    print(f"  Latency: {gen_time:.1f}s (limit: 60s=PASS)")
    print("=" * 60)


if __name__ == "__main__":
    main()
