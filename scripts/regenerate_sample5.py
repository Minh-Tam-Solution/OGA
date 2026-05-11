#!/usr/bin/env python3
"""
C-Sample5-Clean — regenerate sample5_emotion.wav for Piper + MeloTTS.

Byte-verified Vietnamese text. No copy-paste from any previous file.
Run this script, then verify output WAVs with `file` command.
"""

import os
import sys
import json
import subprocess

# ---------------------------------------------------------------------------
# 1. Construct target text from scratch — no external string sources
# ---------------------------------------------------------------------------

# ASCII letters + Vietnamese diacritics composed via Unicode escapes
T = "\u0054"   # T
h = "\u0068"   # h
_a_dot = "\u1ead"  # ậ
t = "\u0074"   # t
space = "\u0020"
u = "\u0075"   # u
y = "\u0079"   # y
_e_circumflex_dot = "\u1ec7"  # ệ
v = "\u0076"   # v
a = "\u0061"   # a
_o_horn_grave = "\u1edd"  # ờ
i = "\u0069"   # i (ASCII Latin small letter i)
bang = "\u0021"  # !
C = "\u0043"   # C
u_acute = "\u00fa"  # ú
n = "\u006e"   # n
g = "\u0067"   # g
d_stroke = "\u0111"  # đ
a_tilde = "\u00e3"  # ã
c = "\u0063"   # c
_e_circumflex_acute = "\u1ebf"  # ế
_o_horn_acute = "\u1eaf"  # ắ

TARGET_TEXT = (
    T + h + _a_dot + t + space +
    t + u + y + _e_circumflex_dot + t + space +
    v + _o_horn_grave + i + bang + space +
    C + h + u_acute + n + g + space +
    t + a + space +
    d_stroke + a_tilde + space +
    c + h + i + _e_circumflex_acute + n + space +
    t + h + _o_horn_acute + n + g + bang
)

# ---------------------------------------------------------------------------
# 2. Byte-level verification (mandatory — must pass before any API call)
# ---------------------------------------------------------------------------

print(f"[VERIFY] Length: {len(TARGET_TEXT)} chars")
print(f"[VERIFY] UTF-8 hex: {TARGET_TEXT.encode('utf-8').hex()}")

ARABIC_BLOCK = range(0x0600, 0x0700)
suspicious = [c for c in TARGET_TEXT if ord(c) in ARABIC_BLOCK]
assert not suspicious, (
    f"FATAL: Arabic characters detected in TARGET_TEXT: "
    f"{[(c, hex(ord(c))) for c in suspicious]}"
)
print("[VERIFY] ✅ No Arabic block characters (U+0600–U+06FF)")

# Also assert exact expected hex for full audit trail
EXPECTED_HEX = (
    "5468e1baad7420747579e1bb87742076e1bb9d692120"
    "4368c3ba6e6720746120c491c3a320636869e1babf6e20"
    "7468e1baaf6e6721"
)
actual_hex = TARGET_TEXT.encode("utf-8").hex()
assert actual_hex == EXPECTED_HEX, (
    f"FATAL: UTF-8 hex mismatch.\n"
    f"  Expected: {EXPECTED_HEX}\n"
    f"  Actual:   {actual_hex}"
)
print("[VERIFY] ✅ UTF-8 hex matches expected fingerprint")

# ---------------------------------------------------------------------------
# 3. API config
# ---------------------------------------------------------------------------

GATEWAY = os.environ.get("AIP_GATEWAY_URL", "http://localhost:8120")
API_KEY = os.environ.get("AIP_VOICE_API_KEY", "")

if not API_KEY:
    # Fallback: read from OGA .env.local
    env_path = "/home/nqh/shared/OGA/.env.local"
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("AIPLATFORM_VOICE_API_KEY="):
                    API_KEY = line.split("=", 1)[1].strip().strip('"')
                    break
    except FileNotFoundError:
        pass

assert API_KEY and API_KEY.startswith("aip_"), (
    "FATAL: AIP_VOICE_API_KEY not found in env or .env.local"
)
print(f"[VERIFY] API key prefix: {API_KEY[:8]}")

# ---------------------------------------------------------------------------
# 4. Synthesize via gateway
# ---------------------------------------------------------------------------

import urllib.request
import urllib.error


def synthesize(voice_id: str, output_path: str) -> dict:
    url = f"{GATEWAY}/api/v1/voice/tts/synthesize"
    payload = json.dumps({
        "text": TARGET_TEXT,
        "voice_id": voice_id,
        "format": "wav",
        "language": "vi",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    audio_url = result.get("audio_url")
    if not audio_url:
        raise RuntimeError(f"No audio_url in response: {result}")

    # Download via gateway container (internal DNS resolution)
    docker_cmd = [
        "docker", "exec", "bflow-ai-gateway",
        "curl", "-s", "-L", audio_url, "-o", "/tmp/sample5_tmp.wav"
    ]
    subprocess.run(docker_cmd, check=True, capture_output=True)

    # Copy from container to host
    subprocess.run(
        ["docker", "cp", "bflow-ai-gateway:/tmp/sample5_tmp.wav", output_path],
        check=True, capture_output=True,
    )

    return result


PIPER_OUT = "/home/nqh/shared/OGA/docs/04-build/sprints/sprint-12/spike-e-samples/piper/sample5_emotion.wav"
MELO_OUT = "/home/nqh/shared/OGA/docs/04-build/sprints/sprint-12/spike-e-samples/melotts/sample5_emotion.wav"

print(f"\n[REGEN] Piper  → {PIPER_OUT}")
piper_meta = synthesize("vi-piper-vais1000", PIPER_OUT)
print(f"  engine={piper_meta['engine']} duration_ms={piper_meta['duration_ms']} proc_ms={piper_meta['processing_time_ms']}")

print(f"\n[REGEN] MeloTTS → {MELO_OUT}")
melo_meta = synthesize("vi-melotts-default", MELO_OUT)
print(f"  engine={melo_meta['engine']} duration_ms={melo_meta['duration_ms']} proc_ms={melo_meta['processing_time_ms']}")

# ---------------------------------------------------------------------------
# 5. Final file verification
# ---------------------------------------------------------------------------

for path in (PIPER_OUT, MELO_OUT):
    result = subprocess.run(
        ["file", path], capture_output=True, text=True, check=True
    )
    print(f"[VERIFY] {path}: {result.stdout.strip()}")

print("\n✅ C-Sample5-Clean complete. Both WAVs verified.")
