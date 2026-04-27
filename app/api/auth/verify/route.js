import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// ── Rate limiter: IP → { count, resetAt } ────────────────────────────────────
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip) {
    const now = Date.now();
    // I2 fix: evict expired entries on each check
    for (const [key, entry] of attempts) {
        if (now > entry.resetAt) attempts.delete(key);
    }
    const entry = attempts.get(ip);
    if (!entry || now > entry.resetAt) {
        attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_ATTEMPTS) return false;
    entry.count++;
    return true;
}

// ── HMAC session token ───────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ACCESS_PIN || 'nqh-fallback';

export function signSession(payload) {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(payload);
    return `${payload}.${hmac.digest('hex')}`;
}

export function verifySession(token) {
    if (!token || !token.includes('.')) return false;
    const dotIndex = token.lastIndexOf('.');
    const payload = token.slice(0, dotIndex);
    const expected = signSession(payload);
    // Timing-safe comparison of full signed token
    try {
        return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
        return false;
    }
}

export async function POST(request) {
    const ACCESS_PIN = process.env.ACCESS_PIN;
    if (!ACCESS_PIN) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    // I1: x-forwarded-for is spoofable without trusted proxy — documented limitation.
    // On direct LAN deployment, all clients may share 'unknown' bucket (global rate limit).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: 'Too many attempts. Try again in 1 minute.' },
            { status: 429 }
        );
    }

    try {
        const { pin } = await request.json();

        // C2 fix: timing-safe PIN comparison
        if (!pin || pin.length !== ACCESS_PIN.length
            || !crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(ACCESS_PIN))) {
            return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }

        // C1 fix: HMAC-signed session token
        const payload = `${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
        const token = signSession(payload);

        const cookieStore = await cookies();
        cookieStore.set('nqh_session', token, {
            httpOnly: true,
            sameSite: 'strict',
            // secure: false — intentional for HTTP LAN deployment. Add secure: true if HTTPS enabled.
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}
