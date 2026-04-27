import { NextResponse } from 'next/server';

const WAN2GP_URL = process.env.NEXT_PUBLIC_WAN2GP_URL || 'http://localhost:7860';
const WAN2GP_ENABLED = process.env.NEXT_PUBLIC_WAN2GP_ENABLED === 'true';

export async function GET() {
    if (!WAN2GP_ENABLED) {
        return NextResponse.json(
            { error: 'not_implemented', target: 'sprint-3', message: 'Video generation not enabled. Set NEXT_PUBLIC_WAN2GP_ENABLED=true.' },
            { status: 501 }
        );
    }
    // Probe Wan2GP health
    try {
        const res = await fetch(`${WAN2GP_URL}/info`, { signal: AbortSignal.timeout(5000) });
        return NextResponse.json({ status: 'ok', wan2gp_reachable: res.ok });
    } catch {
        return NextResponse.json({ status: 'ok', wan2gp_reachable: false });
    }
}

export async function POST(request) {
    if (!WAN2GP_ENABLED) {
        return NextResponse.json(
            { error: 'not_implemented', message: 'Video generation not enabled.' },
            { status: 501 }
        );
    }

    try {
        const { prompt, aspect_ratio, duration, steps } = await request.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Forward to Wan2GP Gradio API
        const gradioRes = await fetch(`${WAN2GP_URL}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fn_index: 0,
                data: [prompt, '', steps || 20, 7.5, duration || 5, aspect_ratio || '16:9'],
            }),
            signal: AbortSignal.timeout(180_000),
        });

        if (!gradioRes.ok) {
            const err = await gradioRes.text();
            return NextResponse.json({ error: `Wan2GP error: ${err.slice(0, 200)}` }, { status: 502 });
        }

        const result = await gradioRes.json();
        const videoData = result.data?.[0];
        let videoUrl;
        if (typeof videoData === 'string') {
            videoUrl = videoData.startsWith('http') ? videoData : `${WAN2GP_URL}/file=${videoData}`;
        } else if (videoData?.url) {
            videoUrl = videoData.url;
        } else if (videoData?.name) {
            videoUrl = `${WAN2GP_URL}/file=${videoData.name}`;
        }

        if (!videoUrl) {
            return NextResponse.json({ error: 'No video URL in Wan2GP response' }, { status: 502 });
        }

        return NextResponse.json({ url: videoUrl, mediaType: 'video' });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
