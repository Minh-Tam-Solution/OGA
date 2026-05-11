#!/usr/bin/env node
/**
 * Track B Live Smoke Test
 * Tests OGA → AI-Platform Gateway TTS pipeline end-to-end
 * Run: node scripts/smoke_track_b.mjs
 */

import { performance } from 'perf_hooks';

const GATEWAY = 'http://localhost:8120';
const API_KEY = process.env.AIP_VOICE_API_KEY || process.env.AIPLATFORM_VOICE_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing env: AIP_VOICE_API_KEY or AIPLATFORM_VOICE_API_KEY');
  process.exit(1);
}

const TEST_TEXT = 'Xin chào quý khách. Chúc quý khách một ngày tốt lành.';
const VOICES = [
  { id: 'vi-piper-vais1000', name: 'Piper VAIS1000', lang: 'vi' },
  { id: 'vi-melotts-default', name: 'MeloTTS VN', lang: 'vi' },
];

async function smokeSynthesize(voice) {
  const start = performance.now();
  const res = await fetch(`${GATEWAY}/api/v1/voice/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      text: TEST_TEXT,
      language: voice.lang,
      voice_id: voice.id,
      format: 'mp3',
    }),
  });
  const latency = Math.round(performance.now() - start);

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, latency, error: text };
  }

  const data = await res.json();
  return {
    ok: true,
    status: res.status,
    latency,
    audio_url: data.audio_url,
    duration_ms: data.duration_ms,
    engine: data.engine,
    voice_id: data.voice_id,
    processing_time_ms: data.processing_time_ms,
  };
}

async function smokeListVoices() {
  const res = await fetch(`${GATEWAY}/api/v1/voice/tts/voices`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  return { ok: true, voices: data.voices || data };
}

async function smokeInvalidVoice() {
  const res = await fetch(`${GATEWAY}/api/v1/voice/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      text: TEST_TEXT,
      language: 'vi',
      voice_id: 'nonexistent-voice-999',
      format: 'mp3',
    }),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  Track B Live Smoke Test');
  console.log('  Gateway:', GATEWAY);
  console.log('  Time:', new Date().toISOString());
  console.log('═'.repeat(60));

  // 1. List voices
  console.log('\n[1/5] Listing voices...');
  const list = await smokeListVoices();
  if (!list.ok) {
    console.error('  ❌ Voice list failed:', list.status);
    process.exit(1);
  }
  const registered = list.voices.map(v => v.voice_id || v.id);
  console.log('  ✅ Voices registered:', registered.join(', '));
  const missing = VOICES.filter(v => !registered.includes(v.id));
  if (missing.length) {
    console.error('  ❌ Missing expected voices:', missing.map(v => v.id).join(', '));
    process.exit(1);
  }

  // 2. Piper synthesis
  console.log('\n[2/5] Piper synthesis...');
  const piper = await smokeSynthesize(VOICES[0]);
  if (!piper.ok) {
    console.error('  ❌ Piper failed:', piper.status, piper.error);
    process.exit(1);
  }
  console.log('  ✅ Piper:', piper.latency, 'ms total');
  console.log('     Audio:', piper.audio_url?.slice(0, 80) + '...');
  console.log('     Duration:', piper.duration_ms, 'ms | Processing:', piper.processing_time_ms, 'ms');

  // 3. MeloTTS synthesis
  console.log('\n[3/5] MeloTTS synthesis...');
  const melo = await smokeSynthesize(VOICES[1]);
  if (!melo.ok) {
    console.error('  ❌ MeloTTS failed:', melo.status, melo.error);
    process.exit(1);
  }
  console.log('  ✅ MeloTTS:', melo.latency, 'ms total');
  console.log('     Audio:', melo.audio_url?.slice(0, 80) + '...');
  console.log('     Duration:', melo.duration_ms, 'ms | Processing:', melo.processing_time_ms, 'ms');

  // 4. Invalid voice (404 path)
  console.log('\n[4/5] Invalid voice (expect 404)...');
  const invalid = await smokeInvalidVoice();
  if (invalid.status !== 404 && invalid.status !== 400) {
    console.error('  ❌ Expected 404/400, got:', invalid.status);
    process.exit(1);
  }
  console.log('  ✅ Invalid voice rejected:', invalid.status, invalid.body?.error || invalid.body?.message);

  // 5. Fetch audio (verify URL reachable)
  // Defect #20 workaround: rewrite internal MinIO hostname to localhost mapping
  console.log('\n[5/5] Fetching audio bytes (presigned URL)...');
  const audioUrl = piper.audio_url.replace('http://ai-platform-minio:9000', 'http://localhost:9020');
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    // Defect #20: presigned URL signatures are hostname-bound
    console.log('  ⚠️ Audio fetch:', audioRes.status, '(Defect #20: hostname-bound presigned URL)');
    console.log('     Workaround: fetch from within docker network (ai-net)');
  } else {
    const bytes = await audioRes.arrayBuffer();
    console.log('  ✅ Audio downloaded:', bytes.byteLength, 'bytes');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  SMOKE TEST PASSED');
  console.log('═'.repeat(60));
  console.log('\n  Latency Baseline (for q15min monitoring):');
  console.log('    Piper   total:', piper.latency, 'ms | processing:', piper.processing_time_ms, 'ms');
  console.log('    MeloTTS total:', melo.latency, 'ms | processing:', melo.processing_time_ms, 'ms');
  console.log('    p95 threshold (2× baseline):');
  console.log('      Piper  :', Math.round(piper.latency * 2), 'ms');
  console.log('      MeloTTS:', Math.round(melo.latency * 2), 'ms');
  console.log('');
}

main().catch(err => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});
