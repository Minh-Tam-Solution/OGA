import { NextResponse } from 'next/server';

const LOCAL_API_URL = process.env.LOCAL_API_URL || '';

// Proxy /api/v1/* to local inference server (no Edge Runtime timeout)
// In cloud mode, middleware rewrites to api.muapi.ai directly

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
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
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
        const body = await request.text();
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}

// Allow long-running generation (up to 5 minutes)
export const maxDuration = 300;
