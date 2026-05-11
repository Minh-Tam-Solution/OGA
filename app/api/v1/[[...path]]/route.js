import { NextResponse } from 'next/server';

const LOCAL_API_URL = process.env.LOCAL_API_URL || '';

// Proxy /api/v1/* to local inference server (no Edge Runtime timeout)
// In cloud mode, middleware rewrites to api.muapi.ai directly

async function proxyResponse(res) {
    // Pass through JSON or plain-text responses faithfully so the frontend
    // sees the real backend error message instead of a cryptic 502.
    const body = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (isJson) {
        try {
            const data = JSON.parse(body);
            return NextResponse.json(data, { status: res.status });
        } catch {
            // Malformed JSON from backend — return raw text with original status
        }
    }
    return new NextResponse(body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'text/plain' } });
}

export async function GET(request, { params }) {
    const slug = await params;
    const path = (slug.path || []).join('/');
    const { search } = new URL(request.url);
    const target = LOCAL_API_URL || 'https://api.muapi.ai';
    const targetUrl = `${target}/api/v1/${path}${search}`;

    try {
        const res = await fetch(targetUrl, {
            headers: { 'Content-Type': 'application/json' },
        });
        return await proxyResponse(res);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}

export async function POST(request, { params }) {
    const slug = await params;
    const path = (slug.path || []).join('/');
    const { search } = new URL(request.url);
    const target = LOCAL_API_URL || 'https://api.muapi.ai';
    const targetUrl = `${target}/api/v1/${path}${search}`;

    try {
        // Detect content-type to preserve multipart uploads (image/video)
        const contentType = request.headers.get('content-type') || '';
        const isMultipart = contentType.includes('multipart/form-data');

        let body;
        let headers = {};
        if (isMultipart) {
            body = await request.arrayBuffer();
            headers['Content-Type'] = contentType;
        } else {
            body = await request.text();
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body,
        });
        return await proxyResponse(res);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}

// Allow long-running generation (up to 5 minutes)
export const maxDuration = 300;
