import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock fetch globally ────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Tests for aiPlatformVoiceClient ────────────────────────────────────────

describe('AIPlatformVoiceClient', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.AIP_VOICE_API_KEY;
    delete process.env.AIPLATFORM_VOICE_API_KEY;
    delete process.env.AIP_GATEWAY_URL;
  });

  it('accepts AIP_VOICE_API_KEY (primary env var)', async () => {
    process.env.AIP_VOICE_API_KEY = 'test-key-primary';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    expect(voiceClient).toBeDefined();
  });

  it('falls back to AIPLATFORM_VOICE_API_KEY (backward compat)', async () => {
    process.env.AIPLATFORM_VOICE_API_KEY = 'test-key-fallback';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    expect(voiceClient).toBeDefined();
  });

  it('throws if no API key is set', async () => {
    delete process.env.AIP_VOICE_API_KEY;
    delete process.env.AIPLATFORM_VOICE_API_KEY;
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    // Module-level singleton instantiation throws when no key is set
    await expect(import('../../src/lib/aiPlatformVoiceClient.js')).rejects.toThrow('AIP_VOICE_API_KEY or AIPLATFORM_VOICE_API_KEY is required');
  });

  it('synthesize sends correct payload with fallback voice', async () => {
    process.env.AIP_VOICE_API_KEY = 'test-key';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        audio_url: 'http://minio/audio.wav',
        duration_ms: 4000,
        engine: 'piper',
        voice_id: 'vi-piper-vais1000',
      }),
    });

    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    const result = await voiceClient.synthesize('Xin chào', { voice_id: 'vi-piper-vais1000' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8120/api/v1/voice/tts/synthesize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
        }),
        body: expect.stringContaining('"voice_id":"vi-piper-vais1000"'),
      })
    );
    expect(result.audio_url).toBe('http://minio/audio.wav');
  });

  it('synthesize respects forced voice override (not default)', async () => {
    process.env.AIP_VOICE_API_KEY = 'test-key';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        audio_url: 'http://minio/audio-melo.mp3',
        duration_ms: 4000,
        engine: 'melotts',
        voice_id: 'vi-melotts-default',
      }),
    });

    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    const result = await voiceClient.synthesize('Xin chào', { voice_id: 'vi-melotts-default' });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.voice_id).toBe('vi-melotts-default');
    expect(result.voice_id).toBe('vi-melotts-default');
    expect(result.engine).toBe('melotts');
  });

  it('health() probes gateway health endpoint', async () => {
    process.env.AIP_VOICE_API_KEY = 'test-key';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    const result = await voiceClient.health();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8120/api/v1/voice/health',
      expect.any(Object)
    );
  });

  it('listVoices() returns voice list', async () => {
    process.env.AIP_VOICE_API_KEY = 'test-key';
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';

    const voices = [{ id: 'vi-piper-vais1000', name: 'VAIS1000' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => voices,
    });

    const { voiceClient } = await import('../../src/lib/aiPlatformVoiceClient.js');
    const result = await voiceClient.listVoices();
    expect(result).toEqual(voices);
  });
});

// ─── Tests for API route (app/api/voice/tts/route.js) ───────────────────────

describe('POST /api/voice/tts', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.AIP_GATEWAY_URL;
    delete process.env.AIP_VOICE_API_KEY;
    delete process.env.AIPLATFORM_VOICE_API_KEY;
  });

  it('returns 400 when text is missing', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';
    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ language: 'vi' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_text');
  });

  it('returns 400 when text exceeds 5000 chars', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';
    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ text: 'a'.repeat(5001) }),
    };
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_text');
  });

  it('returns 400 for invalid voice_id (not in allowlist)', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';
    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ text: 'Hello', language: 'en', voice_id: 'hacker-voice-999' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_voice_id');
  });

  it('returns 400 for invalid language', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';
    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ text: 'Hello', language: 'fr' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_language');
  });

  it('returns 400 for invalid format', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';
    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ text: 'Hello', language: 'en', format: 'ogg' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_format');
  });

  it('proxies valid request to AI-Platform gateway', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        audio_url: 'http://minio/audio.mp3',
        duration_ms: 3000,
        engine: 'melotts',
        voice_id: 'vi-melotts-default',
      }),
    });

    const { POST } = await import('../../app/api/voice/tts/route.js');
    const request = {
      json: async () => ({ text: 'Hello', language: 'en', voice_id: 'en-piper-libritts-f' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.audio_url).toBe('http://minio/audio.mp3');
  });
});

describe('GET /api/voice/tts', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.AIP_GATEWAY_URL;
    delete process.env.AIP_VOICE_API_KEY;
    delete process.env.AIPLATFORM_VOICE_API_KEY;
  });

  it('returns voice list from gateway', async () => {
    process.env.AIP_GATEWAY_URL = 'http://localhost:8120';
    process.env.AIP_VOICE_API_KEY = 'proxy-key';

    const voices = [
      { id: 'vi-piper-vais1000', language: 'vi' },
      { id: 'vi-melotts-default', language: 'vi' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => voices,
    });

    const { GET } = await import('../../app/api/voice/tts/route.js');
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.voices).toEqual(voices);
  });
});
