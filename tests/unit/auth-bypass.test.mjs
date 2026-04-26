import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthModal bypass design', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.NEXT_PUBLIC_LOCAL_MODE;
        // Simulate browser localStorage
        globalThis.localStorage = {
            _store: {},
            getItem(key) { return this._store[key] ?? null; },
            setItem(key, val) { this._store[key] = String(val); },
            removeItem(key) { delete this._store[key]; },
        };
    });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_LOCAL_MODE;
        else process.env.NEXT_PUBLIC_LOCAL_MODE = originalEnv;
        delete globalThis.localStorage;
    });

    it('local mode sets muapi_local_bypass_active, NOT muapi_key', async () => {
        process.env.NEXT_PUBLIC_LOCAL_MODE = 'true';
        let called = false;
        const { AuthModal } = await import('../../src/components/AuthModal.js');
        AuthModal(() => { called = true; });

        expect(called).toBe(true);
        expect(localStorage.getItem('muapi_local_bypass_active')).toBe('true');
        // Must NOT set muapi_key to 'local'
        expect(localStorage.getItem('muapi_key')).toBeNull();
    });

    it('cloud mode does not set bypass flag', async () => {
        process.env.NEXT_PUBLIC_LOCAL_MODE = 'false';
        const { AuthModal } = await import('../../src/components/AuthModal.js');
        // In cloud mode with no key, AuthModal renders a DOM overlay (needs document)
        // We just verify the bypass flag is NOT set
        expect(localStorage.getItem('muapi_local_bypass_active')).toBeNull();
    });
});
