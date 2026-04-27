import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
    const LOCAL_API_URL = process.env.LOCAL_API_URL || '';
    let mfluxReachable = false;

    if (LOCAL_API_URL) {
        try {
            const res = await fetch(`${LOCAL_API_URL}/health`, {
                signal: AbortSignal.timeout(3000),
            });
            mfluxReachable = res.ok;
        } catch {
            mfluxReachable = false;
        }
    }

    return NextResponse.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        mflux_reachable: mfluxReachable,
        local_mode: process.env.NEXT_PUBLIC_LOCAL_MODE === 'true',
        timestamp: new Date().toISOString(),
    });
}
