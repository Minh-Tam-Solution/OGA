import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('providerConfig', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.NEXT_PUBLIC_LOCAL_MODE;
    });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_LOCAL_MODE;
        else process.env.NEXT_PUBLIC_LOCAL_MODE = originalEnv;
    });

    it('getProvider() returns "local" when NEXT_PUBLIC_LOCAL_MODE=true', async () => {
        process.env.NEXT_PUBLIC_LOCAL_MODE = 'true';
        // Re-import to pick up env change
        const { getProvider } = await import('../../src/lib/providerConfig.js');
        expect(getProvider()).toBe('local');
    });

    it('getProvider() returns "cloud" when NEXT_PUBLIC_LOCAL_MODE is unset', async () => {
        delete process.env.NEXT_PUBLIC_LOCAL_MODE;
        const { getProvider } = await import('../../src/lib/providerConfig.js');
        expect(getProvider()).toBe('cloud');
    });

    it('getProvider() returns "cloud" when NEXT_PUBLIC_LOCAL_MODE=false', async () => {
        process.env.NEXT_PUBLIC_LOCAL_MODE = 'false';
        const { getProvider } = await import('../../src/lib/providerConfig.js');
        expect(getProvider()).toBe('cloud');
    });

    it('isLocalMode() returns true when NEXT_PUBLIC_LOCAL_MODE=true', async () => {
        process.env.NEXT_PUBLIC_LOCAL_MODE = 'true';
        const { isLocalMode } = await import('../../src/lib/providerConfig.js');
        expect(isLocalMode()).toBe(true);
    });

    it('isLocalMode() returns false when unset', async () => {
        delete process.env.NEXT_PUBLIC_LOCAL_MODE;
        const { isLocalMode } = await import('../../src/lib/providerConfig.js');
        expect(isLocalMode()).toBe(false);
    });
});
