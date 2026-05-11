---
adr_id: ADR-009
title: "Mac Mini M4 Pro Production Substrate — Compatibility Audit + Migration Plan"
status: "PROPOSED — Triggered by ADR-008 v1.0 CTO flag"
date: "2026-05-11"
deciders: ["@cto", "@architect"]
authority: "@cto (co-author with @architect)"
gate: "G3-preparation"
trigger: "ADR-008 v1.0 CTO flag: Mac Mini cutover requires migration plan by mid-June"
---

# ADR-009: Mac Mini M4 Pro Production Substrate

## Status

**PROPOSED** — Triggered by ADR-008 v1.0 CTO flag (2026-05-11)

> **Trigger condition:** Mac Mini M4 Pro 48G delivery expected early July. Production cutover target: 2026-07-03. Plan must be drafted by mid-June for 2-week buffer.

---

## Context

**CEO infrastructure directive (2026-05-11):**
- S1 (RTX 5090 32GB) remains dev/test host with Ollama-first priority
- Mac Mini M4 Pro 48GB becomes production substrate for audio/image/video content
- Cutover target: early July 2026

**Risk:** Mac Mini changes the compute substrate from CUDA to Apple Silicon (MPS). Not all models have verified MPS paths.

---

## Audit Scope

| Model | Pipeline | Current S1 VRAM | MPS Support | Risk | Migration Order |
|-------|----------|-----------------|-------------|------|-----------------|
| **Piper** | TTS | 0 GB (ONNX CPU) | ✅ ONNX Runtime MPS | Low | **1st** (audio, lowest risk) |
| **MeloTTS** | TTS | 0 GB (CPU) | ✅ PyTorch MPS | Low | **1st** (audio) |
| **Whisper** | STT | ~6 GB (CUDA) | ⚠️ OpenAI Whisper MPS path exists but slower | Medium | **2nd** |
| **Wan2.1** | Video T2V | ~11 GB | ⚠️ Diffusers MPS support partial; may need CPU offload | High | **3rd** |
| **LTX-Video** | Video T2V | ~9 GB | ⚠️ Untested on MPS | High | **3rd** |
| **CogVideoX** | Video T2V | ~14 GB | ❌ Likely CUDA-only; 5B model may not fit MPS memory | Critical | **Last** (or defer) |
| **AnimateDiff** | Video | ~6 GB | ⚠️ Diffusers MPS partial | Medium | **3rd** |
| **LivePortrait** | Video | ~4 GB | ⚠️ Untested on MPS | Medium | **3rd** |
| **VieNeu** | TTS | ~2-4 GB | ❌ **F6 FAIL** — `pnnbao/vieneu-tts:serve` = linux/amd64 only; no Apple Silicon support | Critical | **Replace** (WS-C path C.3) |
| **ComfyUI** | Image | ~8-15 GB | ⚠️ ComfyUI has MPS node but workflow compatibility unknown | High | **2nd** |

**Key concerns:**
1. **Unified memory ≠ VRAM:** 48GB unified is more flexible than 32GB dedicated, but bandwidth is lower
2. **CUDA-only optimizations:** Many diffusers models use CUDA-specific ops (flash-attention, xformers)
3. **MPS fallback:** PyTorch auto-falls back to CPU for unsupported ops — performance hit unknown
4. **Arbiter substrate:** ADR-008 arbiter built for CUDA/nvidia-smi semantics; Mac Mini needs MPS-aware adapter

---

## Migration Order (Risk-Ordered)

```
Phase 1 — Audio (July Week 1)
├── Piper → MPS/ONNX (low risk, portable)
├── MeloTTS → MPS PyTorch (low risk, CPU already works)
└── Voice arbiter → MPS-aware adapter

Phase 2 — Image (July Week 2)
├── ComfyUI → MPS node validation
├── Stable Diffusion → MPS diffusers
└── Image arbiter → MPS-aware adapter

Phase 3 — Video (July Week 3-4, or defer)
├── Wan2.1 → MPS diffusers + CPU offload fallback
├── LTX-Video → MPS validation
├── AnimateDiff → MPS validation
├── LivePortrait → MPS validation
└── Video arbiter → MPS-aware adapter

Phase 4 — Deferred / Blocked
├── CogVideoX 5B → May not fit MPS memory or lack CUDA ops
├── VieNeu (lmdeploy) → **F6 FAIL** — no MPS path; WS-C path C.3 (replace engine)
└── Decision: replace with Apple Silicon-native TTS engine; S1 CUDA-only fallback if needed
```

---

## Benchmark Requirements

| Metric | S1 Baseline | Mac Mini Target | Tolerance |
|--------|-------------|-----------------|-----------|
| Piper latency | ~330ms | < 500ms | +50% |
| MeloTTS latency | ~3.2s cold | < 5s cold | +50% |
| Wan2.1 5s video | ~45s | < 90s | +100% |
| LTX 5s video | ~30s | < 60s | +100% |
| ComfyUI 1024px | ~8s | < 16s | +100% |

> **Rule:** If Mac Mini is >2× slower than S1 for any metric → keep S1 as production fallback for that pipeline.

---

## Rollback Plan

| Condition | Action |
|-----------|--------|
| Audit finds >2 critical blockers by mid-June | Delay cutover to August |
| Phase 1 audio migration fails | Keep audio on S1, retry Phase 1 |
| Phase 2 image migration fails | Keep image on S1, Mac Mini = audio only |
| Phase 3 video migration fails | Keep video on S1, Mac Mini = audio+image |
| Arbiter MPS adapter not ready | Run arbiter in advisory-only mode on Mac Mini |

---

## Sprint Timeline

| Milestone | Date | Owner | Deliverable |
|-----------|------|-------|-------------|
| Audit start | 2026-05-20 (S14-A) | @architect | Compatibility matrix populated |
| Audit complete | 2026-06-10 (mid-June) | @architect + @coder | Benchmark report, blocker list |
| CTO go/no-go | 2026-06-15 | CTO | Approve/disapprove cutover |
| Migration scripts | 2026-06-20 | @coder | Dockerfiles, model configs, arbiter MPS adapter |
| Smoke tests | 2026-06-25 | @tester | End-to-end on Mac Mini |
| Production cutover | 2026-07-03 (target) | @architect + @oga-devops | DNS switch, monitoring |

---

## Open Questions

1. **Mac Mini delivery date:** Confirmed early July?
2. **MPS vs CUDA performance gap:** How much slower is acceptable?
3. **CogVideoX 5B:** 14GB VRAM model on 48GB unified — fits but bandwidth-bound. Worth migrating?
4. **VieNeu:** ❌ **F6 FAIL** — no MPS path. Decision: **replace engine** (WS-C path C.3). MeloTTS already Apple Silicon-compatible. No cloud needed.
5. **Arbiter MPS adapter:** Build separate MPS probe or unified abstraction layer?

---

*ADR-009 PROPOSED 2026-05-11 | Trigger: ADR-008 v1.0 CTO flag | Draft deadline: mid-June 2026*
