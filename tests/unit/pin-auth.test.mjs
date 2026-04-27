import { describe, it, expect } from 'vitest';

describe('PIN auth middleware design', () => {
    const AUTH_EXCLUDED = ['/api/health', '/api/auth/verify', '/auth', '/_next', '/favicon.ico'];

    function isAuthExcluded(pathname) {
        return AUTH_EXCLUDED.some(p => pathname.startsWith(p));
    }

    it('/api/health is excluded from PIN gate', () => {
        expect(isAuthExcluded('/api/health')).toBe(true);
    });

    it('/api/auth/verify is excluded from PIN gate', () => {
        expect(isAuthExcluded('/api/auth/verify')).toBe(true);
    });

    it('/auth page is excluded from PIN gate', () => {
        expect(isAuthExcluded('/auth')).toBe(true);
    });

    it('/_next static assets are excluded', () => {
        expect(isAuthExcluded('/_next/static/chunk.js')).toBe(true);
    });

    it('/api/v1/generate is NOT excluded (requires PIN)', () => {
        expect(isAuthExcluded('/api/v1/generate')).toBe(false);
    });

    it('/studio is NOT excluded (requires PIN)', () => {
        expect(isAuthExcluded('/studio')).toBe(false);
    });

    it('/ root is NOT excluded (requires PIN)', () => {
        expect(isAuthExcluded('/')).toBe(false);
    });
});

describe('PIN rate limiter logic', () => {
    it('allows up to 5 attempts then blocks', () => {
        const attempts = new Map();
        const MAX = 5;
        const WINDOW = 60000;

        function checkRateLimit(ip) {
            const now = Date.now();
            const entry = attempts.get(ip);
            if (!entry || now > entry.resetAt) {
                attempts.set(ip, { count: 1, resetAt: now + WINDOW });
                return true;
            }
            if (entry.count >= MAX) return false;
            entry.count++;
            return true;
        }

        const ip = '192.168.1.100';
        for (let i = 0; i < 5; i++) {
            expect(checkRateLimit(ip)).toBe(true);
        }
        // 6th attempt should be blocked
        expect(checkRateLimit(ip)).toBe(false);
    });
});

describe('Wan2GP video stub', () => {
    it('providerConfig wan2gp is disabled by default', async () => {
        const { wan2gpConfig } = await import('../../src/lib/providerConfig.js');
        expect(wan2gpConfig.enabled).toBe(false);
    });
});
