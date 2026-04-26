import { describe, it, expect } from 'vitest';

// Test the SSRF allowlist logic extracted from upload-binary route
const ALLOWED_HOST_PATTERNS = [
    /\.amazonaws\.com$/,
    /\.s3\.[\w-]+\.amazonaws\.com$/,
];

function isAllowedTarget(targetUrl) {
    try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'https:') return { allowed: false, reason: 'not-https' };
        const isAllowed = ALLOWED_HOST_PATTERNS.some(p => p.test(parsed.hostname));
        return { allowed: isAllowed, reason: isAllowed ? 'ok' : 'not-in-allowlist' };
    } catch {
        return { allowed: false, reason: 'invalid-url' };
    }
}

describe('upload-binary SSRF protection', () => {
    it('allows S3 amazonaws.com URLs', () => {
        expect(isAllowedTarget('https://my-bucket.s3.us-east-1.amazonaws.com/upload').allowed).toBe(true);
    });

    it('allows S3 URLs with different regions', () => {
        expect(isAllowedTarget('https://bucket.s3.ap-southeast-1.amazonaws.com/key').allowed).toBe(true);
    });

    it('blocks cloud metadata endpoint (169.254.169.254)', () => {
        expect(isAllowedTarget('https://169.254.169.254/latest/meta-data/').allowed).toBe(false);
    });

    it('blocks HTTP (non-HTTPS) URLs', () => {
        const result = isAllowedTarget('http://my-bucket.s3.us-east-1.amazonaws.com/upload');
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('not-https');
    });

    it('blocks arbitrary external URLs', () => {
        expect(isAllowedTarget('https://evil.com/steal-data').allowed).toBe(false);
    });

    it('blocks localhost', () => {
        expect(isAllowedTarget('https://localhost:8080/api').allowed).toBe(false);
    });

    it('blocks internal IPs', () => {
        expect(isAllowedTarget('https://10.0.0.1/internal').allowed).toBe(false);
        expect(isAllowedTarget('https://192.168.1.1/admin').allowed).toBe(false);
    });

    it('rejects invalid URLs', () => {
        expect(isAllowedTarget('not-a-url').allowed).toBe(false);
        expect(isAllowedTarget('').allowed).toBe(false);
    });

    it('blocks file:// protocol', () => {
        expect(isAllowedTarget('file:///etc/passwd').allowed).toBe(false);
    });
});
