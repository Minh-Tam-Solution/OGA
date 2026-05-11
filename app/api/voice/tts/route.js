/**
 * OGA → AI-Platform Voice TTS Proxy
 *
 * Server-side route that hides the AI-Platform API key from the browser
 * and enforces the Piper-primary / MeloTTS-fallback voice policy.
 *
 * POST /api/voice/tts
 * Body: { text: string, language?: 'vi'|'en', voice_id?: string, format?: 'wav'|'mp3' }
 */

import { NextResponse } from 'next/server';
import { voiceClient } from '@/src/lib/aiPlatformVoiceClient';

// Server-side allowlist — must match client-side ALLOWED_VOICES in VoiceStudio.jsx
const ALLOWED_VOICES = [
    'vi-piper-vais1000',
    'vi-melotts-default',
    'en-piper-libritts-f',
];
const ALLOWED_LANGUAGES = ['vi', 'en'];
const ALLOWED_FORMATS = ['wav', 'mp3'];

export async function POST(request) {
    try {
        const body = await request.json();
        const { text, language = 'vi', voice_id, format = 'wav' } = body;

        if (!text || typeof text !== 'string' || text.length > 5000) {
            return NextResponse.json(
                { error: 'invalid_text', message: 'Text required, max 5000 chars' },
                { status: 400 }
            );
        }

        if (!ALLOWED_LANGUAGES.includes(language)) {
            return NextResponse.json(
                { error: 'invalid_language', message: `Language must be one of: ${ALLOWED_LANGUAGES.join(', ')}` },
                { status: 400 }
            );
        }

        if (voice_id && !ALLOWED_VOICES.includes(voice_id)) {
            return NextResponse.json(
                { error: 'invalid_voice_id', message: `Voice not allowed. Allowed: ${ALLOWED_VOICES.join(', ')}` },
                { status: 400 }
            );
        }

        if (!ALLOWED_FORMATS.includes(format)) {
            return NextResponse.json(
                { error: 'invalid_format', message: `Format must be one of: ${ALLOWED_FORMATS.join(', ')}` },
                { status: 400 }
            );
        }

        const result = await voiceClient.synthesize(text, {
            language,
            voice_id,
            format,
            autoFallback: true,
        });

        return NextResponse.json({
            success: true,
            audio_url: result.audio_url,
            duration_ms: result.duration_ms,
            engine: result.engine,
            voice_id: result.voice_id,
            job_id: result.job_id,
            watermark_key: result.watermark_key,
        });
    } catch (err) {
        console.error('[voice/tts]', err);
        const status = err.status || 502;
        const code = err.code || 'voice_service_error';
        return NextResponse.json(
            { error: code, message: err.message },
            { status }
        );
    }
}

export async function GET() {
    // Health / list voices passthrough
    try {
        const voices = await voiceClient.listVoices();
        return NextResponse.json({ voices: voices.voices || voices });
    } catch (err) {
        return NextResponse.json(
            { error: err.code || 'voice_service_error', message: err.message },
            { status: err.status || 502 }
        );
    }
}
