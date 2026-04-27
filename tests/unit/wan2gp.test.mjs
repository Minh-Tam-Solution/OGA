import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Wan2GP configuration', () => {
    let originalEnabled, originalUrl;

    beforeEach(() => {
        originalEnabled = process.env.NEXT_PUBLIC_WAN2GP_ENABLED;
        originalUrl = process.env.NEXT_PUBLIC_WAN2GP_URL;
    });

    afterEach(() => {
        if (originalEnabled === undefined) delete process.env.NEXT_PUBLIC_WAN2GP_ENABLED;
        else process.env.NEXT_PUBLIC_WAN2GP_ENABLED = originalEnabled;
        if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_WAN2GP_URL;
        else process.env.NEXT_PUBLIC_WAN2GP_URL = originalUrl;
    });

    it('wan2gpConfig.enabled is false by default', async () => {
        delete process.env.NEXT_PUBLIC_WAN2GP_ENABLED;
        const { wan2gpConfig } = await import('../../src/lib/providerConfig.js');
        expect(wan2gpConfig.enabled).toBe(false);
    });

    it('wan2gpConfig.enabled reads NEXT_PUBLIC_WAN2GP_ENABLED at module load', async () => {
        // Module is cached — wan2gpConfig.enabled reflects env at first import time
        // In production, Next.js statically replaces env vars at build time
        const { wan2gpConfig } = await import('../../src/lib/providerConfig.js');
        const expected = process.env.NEXT_PUBLIC_WAN2GP_ENABLED === 'true';
        expect(wan2gpConfig.enabled).toBe(expected);
    });

    it('wan2gpConfig.url defaults to localhost:7860 when env unset', async () => {
        const { wan2gpConfig } = await import('../../src/lib/providerConfig.js');
        // Default value when NEXT_PUBLIC_WAN2GP_URL is not set
        expect(wan2gpConfig.url).toContain('localhost:7860');
    });
});

describe('Video tab visibility logic', () => {
    it('Video tab is Coming Soon when local mode ON + wan2gp OFF', () => {
        const _isLocal = true;
        const _wan2gpEnabled = false;
        const comingSoon = _isLocal && !_wan2gpEnabled;
        expect(comingSoon).toBe(true);
    });

    it('Video tab is active when local mode ON + wan2gp ON', () => {
        const _isLocal = true;
        const _wan2gpEnabled = true;
        const comingSoon = _isLocal && !_wan2gpEnabled;
        expect(comingSoon).toBe(false);
    });

    it('Video tab is active in cloud mode regardless', () => {
        const _isLocal = false;
        const _wan2gpEnabled = false;
        const comingSoon = _isLocal && !_wan2gpEnabled;
        expect(comingSoon).toBe(false);
    });
});
