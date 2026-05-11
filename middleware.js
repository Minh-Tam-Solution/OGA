import { NextResponse } from 'next/server';

// Local MLX server URL — set LOCAL_API_URL env var to use local image gen
const LOCAL_API_URL = process.env.LOCAL_API_URL || '';

// PIN-based access control — set ACCESS_PIN env var to enable
const ACCESS_PIN = process.env.ACCESS_PIN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ACCESS_PIN || 'nqh-fallback';

// Paths excluded from PIN gate (unauthenticated)
const AUTH_EXCLUDED = ['/api/health', '/api/auth/verify', '/api/v1/upload_file', '/auth', '/_next', '/favicon.ico'];

function isAuthExcluded(pathname) {
    return AUTH_EXCLUDED.some(p => pathname.startsWith(p));
}

/** HMAC-verify session token using Web Crypto API (Edge Runtime compatible) */
async function isValidSession(token) {
    if (!token || !token.includes('.')) return false;
    try {
        const dotIndex = token.lastIndexOf('.');
        const payload = token.slice(0, dotIndex);
        const sig = token.slice(dotIndex + 1);
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(SESSION_SECRET),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        const expected = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
        return sig === expected;
    } catch {
        return false;
    }
}

export async function middleware(request) {
    const url = request.nextUrl;

    // ── PIN gate (when ACCESS_PIN is configured) ─────────────────────────
    if (ACCESS_PIN && !isAuthExcluded(url.pathname)) {
        const session = request.cookies.get('nqh_session')?.value;
        if (!session || !(await isValidSession(session))) {
            // Redirect browser requests to /auth; block API calls with 401
            if (url.pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/auth', request.url));
        }
    }

    // ── API proxy routing ────────────────────────────────────────────────
    const isMuApi = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isMuApi) {
        if (url.pathname.startsWith('/api/v1')) {
            if (LOCAL_API_URL) {
                // Local mode: let Next.js API route handle the proxy (no Edge timeout issues)
                return NextResponse.next();
            }
            // Cloud mode: rewrite to Muapi.ai
            const targetUrl = new URL(url.pathname + url.search, 'https://api.muapi.ai');
            return NextResponse.rewrite(targetUrl);
        }
    }

    return NextResponse.next();
}

// Match all paths for PIN gate + API proxy
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
