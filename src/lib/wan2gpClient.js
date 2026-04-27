// Wan2GP Gradio HTTP client for web local mode (non-Electron).
// Calls the Gradio API directly via fetch — no window.localAI IPC needed.

import { wan2gpConfig } from './providerConfig.js';

class Wan2GPClient {
    get baseUrl() {
        return wan2gpConfig.url;
    }

    async probe() {
        try {
            const res = await fetch(`${this.baseUrl}/api/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fn_index: 0, data: [] }),
                signal: AbortSignal.timeout(5000),
            });
            return { ok: res.ok, status: res.status };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    async generateVideo({ prompt, model, aspect_ratio, duration, steps }) {
        if (!wan2gpConfig.enabled) {
            throw new Error('Wan2GP is not enabled. Set NEXT_PUBLIC_WAN2GP_ENABLED=true');
        }

        // Gradio queue API: submit job then poll for result
        const submitRes = await fetch(`${this.baseUrl}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fn_index: 0,
                data: [
                    prompt || '',
                    '', // negative prompt
                    steps || 20,
                    7.5, // guidance scale
                    duration || 5,
                    aspect_ratio || '16:9',
                ],
            }),
            signal: AbortSignal.timeout(180_000), // 3 min timeout for video
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text();
            throw new Error(`Wan2GP API error: ${submitRes.status} — ${errText.slice(0, 200)}`);
        }

        const result = await submitRes.json();

        // Gradio returns { data: [{ url: "...", ... }] } or { data: ["filepath"] }
        const videoData = result.data?.[0];
        let videoUrl;
        if (typeof videoData === 'string') {
            // filepath — construct URL from Gradio file server
            videoUrl = videoData.startsWith('http')
                ? videoData
                : `${this.baseUrl}/file=${videoData}`;
        } else if (videoData?.url) {
            videoUrl = videoData.url;
        } else if (videoData?.name) {
            videoUrl = `${this.baseUrl}/file=${videoData.name}`;
        }

        if (!videoUrl) {
            throw new Error('No video URL in Wan2GP response');
        }

        return { url: videoUrl, mediaType: 'video' };
    }
}

export const wan2gp = new Wan2GPClient();
