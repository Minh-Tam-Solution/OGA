import { describe, it, expect } from 'vitest';

describe('wan2gpClient', () => {
    it('exports wan2gp singleton', async () => {
        const { wan2gp } = await import('../../src/lib/wan2gpClient.js');
        expect(wan2gp).toBeDefined();
        expect(typeof wan2gp.probe).toBe('function');
        expect(typeof wan2gp.generateVideo).toBe('function');
    });

    it('baseUrl reads from wan2gpConfig', async () => {
        const { wan2gp } = await import('../../src/lib/wan2gpClient.js');
        expect(wan2gp.baseUrl).toContain('localhost:7860');
    });

    it('generateVideo throws when wan2gp not enabled', async () => {
        const { wan2gp } = await import('../../src/lib/wan2gpClient.js');
        // wan2gpConfig.enabled defaults to false in test
        await expect(wan2gp.generateVideo({ prompt: 'test' }))
            .rejects.toThrow('Wan2GP is not enabled');
    });

    it('probe returns ok:false when server unreachable', async () => {
        const { wan2gp } = await import('../../src/lib/wan2gpClient.js');
        const result = await wan2gp.probe();
        expect(result.ok).toBe(false);
    });
});
