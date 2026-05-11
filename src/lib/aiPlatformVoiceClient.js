/**
 * AI-Platform Voice Service — Consumer Client (OGA Track B)
 *
 * Wraps AI-Platform Layer 4 voice gateway for TTS synthesis.
 * Designed as server-side only (API key must NOT reach browser).
 *
 * Architecture:
 *   OGA Next.js API Route → this client → AI-Platform Gateway (:8120)
 *                             → Voice Service (:8121) → Piper/MeloTTS adapter
 *
 * Voice routing (empirical, post-Spike E):
 *   1. Piper  vi-piper-vais1000  ← PRIMARY  (production, 22050Hz, ~330ms)
 *   2. MeloTTS vi-melotts-default ← FALLBACK (44100Hz, ~3.2s, S118 persistent)
 *   3. VieNeu ← DEFERRED S118 (adapter broken, GPU OOM)
 *
 * Defect workarounds baked in:
 *   - #7  GPU budget fail-loud override (voice service startup)
 *   - #20 MinIO presigned URL hostname mismatch (internal DNS)
 *         → audio fetch routes through gateway container or host DNS override
 *
 * Reference: ADR-007 v3, ADR-090, spike-report-melotts-vn.md
 */

const GATEWAY_BASE = process.env.AIP_GATEWAY_URL || 'http://localhost:8120';
const API_KEY = process.env.AIP_VOICE_API_KEY || process.env.AIPLATFORM_VOICE_API_KEY;
const PROXY_TIMEOUT_MS = Number(process.env.AIP_VOICE_TIMEOUT_MS || '30000');

const PRIMARY_VOICE_VI = 'vi-piper-vais1000';
const FALLBACK_VOICE_VI = 'vi-melotts-default';
const PRIMARY_VOICE_EN = 'en-piper-libritts-f';

class AIPlatformVoiceError extends Error {
  constructor(status, code, detail) {
    super(`AI-Platform Voice [${status}]: ${code}`);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

class AIPlatformVoiceClient {
  constructor({ baseUrl = GATEWAY_BASE, apiKey = API_KEY } = {}) {
    if (!apiKey) {
      throw new Error('AIP_VOICE_API_KEY or AIPLATFORM_VOICE_API_KEY is required');
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  _headers() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async _fetch(path, opts = {}) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { ...this._headers(), ...(opts.headers || {}) },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new AIPlatformVoiceError(res.status, body.detail?.error || 'unknown', body.detail);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Health probe (anonymous OK) */
  async health() {
    return this._fetch('/api/v1/voice/health', { headers: {} });
  }

  /** List all voices visible to this API key */
  async listVoices() {
    return this._fetch('/api/v1/voice/tts/voices');
  }

  /**
   * Synthesize speech with automatic fallback.
   *
   * @param {string} text
   * @param {object} opts
   * @param {string} opts.language - 'vi' | 'en'
   * @param {string} [opts.voice_id] - force specific voice
   * @param {string} [opts.format='wav'] - 'wav' | 'mp3' | 'ogg'
   * @param {number} [opts.sample_rate] - target sample rate
   * @param {boolean} [opts.autoFallback=true] - try fallback voice on failure
   * @returns {Promise<{audio_url:string, duration_ms:number, engine:string, voice_id:string, job_id:string, watermark_key:string}>}
   */
  async synthesize(text, opts = {}) {
    const {
      language = 'vi',
      voice_id,
      format = 'wav',
      sample_rate,
      autoFallback = true,
    } = opts;

    const primary = voice_id || (language === 'vi' ? PRIMARY_VOICE_VI : PRIMARY_VOICE_EN);
    const fallback = language === 'vi' ? FALLBACK_VOICE_VI : PRIMARY_VOICE_EN;

    const body = {
      text,
      voice_id: primary,
      language,
      format,
      ...(sample_rate ? { sample_rate } : {}),
    };

    try {
      return await this._fetch('/api/v1/voice/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (!autoFallback || err.code !== 'voice_not_found') throw err;

      // Fallback attempt
      const fbBody = { ...body, voice_id: fallback };
      return this._fetch('/api/v1/voice/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify(fbBody),
      });
    }
  }

  /**
   * Fetch audio bytes from presigned URL.
   * Defect #20 workaround: MinIO internal hostname is not resolvable from host.
   * Options:
   *   A. Run this inside a container on ai-net (recommended for server-side)
   *   B. Override /etc/hosts: ai-platform-minio → 127.0.0.1 + use :9020
   *   C. Gateway streaming proxy (if implemented in S118(p))
   */
  async fetchAudio(presignedUrl) {
    // Option B fallback: rewrite internal URL to external MinIO port
    const externalUrl = presignedUrl.replace(
      'http://ai-platform-minio:9000/',
      'http://localhost:9020/'
    );
    // Note: presigned URL signature is tied to hostname, so rewrite may 403.
    // Server-side inside ai-net is the ONLY reliable method today.
    const res = await fetch(externalUrl, { redirect: 'follow' });
    if (!res.ok) {
      throw new AIPlatformVoiceError(res.status, 'audio_fetch_failed', { url: externalUrl });
    }
    return res.arrayBuffer();
  }
}

// Singleton for server-side import
export const voiceClient = new AIPlatformVoiceClient();
export { AIPlatformVoiceClient, AIPlatformVoiceError };
