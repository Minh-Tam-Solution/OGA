---
sprint: 9
task: 9.0a
status: COMPLETE
owner: "@coder"
date: 2026-05-05
---

# Sprint 9.0a — Wav2Lip Spike Report

## Objective

Test Wav2Lip for audio-driven lip-sync inference on MacBook M4 Pro 24GB.

## Environment

| Item | Value |
|------|-------|
| Hardware | MacBook Pro M4 Pro |
| RAM | 24GB |
| OS | macOS |
| PyTorch | 2.10.0 |
| Device | MPS (Metal Performance Shaders) |

## License Verification

| Component | License | Commercial? |
|-----------|---------|-------------|
| Wav2Lip code | **No LICENSE file** | ❌ **NO** — All rights reserved |
| Wav2Lip weights | ❓ Not verified | ❓ Unknown |

**Finding**: The original Wav2Lip repository (`Rudrabha/Wav2Lip`) contains **no LICENSE file**.
Under copyright law, code without a license is "all rights reserved" and cannot be used
commercially (or at all without explicit permission).

### License Search Details

- Checked repository root: no `LICENSE`, `LICENSE.txt`, or `LICENSE.md`
- Checked README: no license statement
- Checked setup.py/pyproject.toml: no license classifier
- Checked model card on HuggingFace: no explicit license for weights

## Verdict

| Criterion | Threshold | Actual | Pass? |
|-----------|-----------|--------|-------|
| License (commercial-safe) | Must be open-source | All rights reserved | ❌ **FAIL** |
| Audio-driven lip-sync | Must work | Not tested | ⏸️ Blocked |
| RAM | < 8GB | Not tested | ⏸️ Blocked |
| Latency | < 30s | Not tested | ⏸️ Blocked |

**Overall Verdict: FAIL (License Blocker)**

Wav2Lip cannot be used in this project due to missing license. Per project policy,
any model without an explicit open-source license (MIT/Apache 2.0/BSD) is rejected.

## Recommendations

1. **Do NOT use Wav2Lip** in any capacity
2. **Proceed to MuseTalk spike** (Day 3-4 per Sprint 9 plan)
3. If MuseTalk also fails, pivot to CogVideoX-2B (text-to-video fallback)

---
*NQH Creative Studio (OGA) | SDLC Framework v6.3.1 | Sprint 9.0a Spike Report*
