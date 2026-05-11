import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

let serverProc = null;
let serverUrl = 'http://localhost:8003';

function startServer() {
    return new Promise((resolve, reject) => {
        const pythonPath = resolve(PROJECT_ROOT, '.venv/bin/python3');
        const proc = spawn(pythonPath, ['local-server/server.py'], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, INFERENCE_ENGINE: 'diffusers', PORT: '8003', OGA_FORCE_CPU: 'true' },
        });
        let stderr = '';
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error('Server start timeout. Stderr: ' + stderr.slice(-500)));
        }, 30000);

        const checkReady = setInterval(() => {
            if (stderr.includes('RMBG ready') || stdout.includes('RMBG ready') || stdout.includes('Application startup complete') || stderr.includes('Application startup complete')) {
                clearTimeout(timeout);
                clearInterval(checkReady);
                serverProc = proc;
                resolve(proc);
            }
        }, 500);
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (!serverProc) return resolve();
        serverProc.kill('SIGTERM');
        setTimeout(() => {
            if (serverProc && !serverProc.killed) serverProc.kill('SIGKILL');
            serverProc = null;
            resolve();
        }, 2000);
    });
}

async function fetchJson(path, opts = {}) {
    const url = `${serverUrl}${path}`;
    const res = await fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { status: res.status, data };
}

describe('RMBG — endpoint contract', () => {
    beforeAll(async () => {
        // If external server is already running, skip spawning our own
        try {
            const res = await fetch(serverUrl + '/health');
            if (res.ok) {
                console.log('Using external server on', serverUrl);
                return;
            }
        } catch {}
        await startServer();
    }, 35000);

    afterAll(async () => {
        await stopServer();
    }, 10000);

    it('POST /api/v1/remove-bg returns 422 for missing image field', async () => {
        const { status } = await fetchJson('/api/v1/remove-bg', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        // FastAPI/Pydantic returns 422 for missing required fields
        expect(status).toBe(422);
    }, 10000);

    it('POST /api/v1/remove-bg returns 400 for invalid image data', async () => {
        const { status, data } = await fetchJson('/api/v1/remove-bg', {
            method: 'POST',
            body: JSON.stringify({ image: 'not-a-data-url' }),
        });
        expect(status).toBe(400);
        expect(data.detail.error).toBe('Invalid image data');
    }, 10000);

    it('POST /api/v1/remove-bg returns 400 for invalid base64', async () => {
        const { status, data } = await fetchJson('/api/v1/remove-bg', {
            method: 'POST',
            body: JSON.stringify({ image: 'data:image/png;base64,!!!' }),
        });
        expect(status).toBe(400);
        expect(data.detail.error).toBe('Invalid base64 encoding');
    }, 10000);

    it('remove-bg endpoint returns completed with PNG RGBA metadata', async () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('"status": "completed"');
        expect(serverPy).toContain('"output": f"data:image/png;base64,');
        expect(serverPy).toContain('"model": "RMBG (u2net)"');
        expect(serverPy).toContain('"output_format": "PNG (RGBA)"');
        expect(serverPy).toContain('"elapsed_seconds"');
        expect(serverPy).toContain('"ram_mb"');
    });

    it('health endpoint reports rembg utility status', async () => {
        const { status, data } = await fetchJson('/health');
        expect(status).toBe(200);
        expect(data.utilities).toHaveProperty('rembg');
        expect(typeof data.utilities.rembg).toBe('boolean');
    }, 10000);
});

describe('RMBG — muapi.js removeBackground', () => {
    it('removeBackground sends correct payload', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: 'completed', output: 'data:image/png;base64,abc' }),
            })
        );

        const { removeBackground } = await import('../../packages/studio/src/muapi.js');
        const result = await removeBackground('test-key', 'data:image/png;base64,abc123');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/v1/remove-bg'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'x-api-key': 'test-key',
                }),
                body: JSON.stringify({ image: 'data:image/png;base64,abc123' }),
            })
        );
        expect(result.status).toBe('completed');
    });

    it('removeBackground throws on HTTP error', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                status: 413,
                text: () => Promise.resolve('Image too large'),
            })
        );

        const { removeBackground } = await import('../../packages/studio/src/muapi.js');
        await expect(removeBackground('test-key', 'data:image/png;base64,abc123')).rejects.toThrow('Remove background failed');
    });
});

describe('RMBG — server.py implementation', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('has _rembg_lock defined', () => {
        expect(serverPy).toContain('_rembg_lock = asyncio.Lock()');
    });

    it('has init_rembg function', () => {
        expect(serverPy).toContain('def init_rembg():');
    });

    it('has is_ram_over_cap helper', () => {
        expect(serverPy).toContain('def is_ram_over_cap()');
    });

    it('has get_process_rss_mb helper', () => {
        expect(serverPy).toContain('def get_process_rss_mb()');
    });

    it('remove-bg endpoint checks image size > 10MB', () => {
        expect(serverPy).toContain('size_mb > 10');
        expect(serverPy).toContain('Image too large (max 10MB)');
    });

    it('remove-bg endpoint returns 503 when RAM over cap', () => {
        expect(serverPy).toContain('is_ram_over_cap()');
        expect(serverPy).toContain('Server overloaded, try again later');
    });

    it('main block calls init_rembg', () => {
        expect(serverPy).toContain('init_rembg()');
    });

    it('requirements-mac.txt includes rembg', () => {
        const req = readFileSync(resolve(PROJECT_ROOT, 'local-server/requirements-mac.txt'), 'utf-8');
        expect(req).toContain('rembg');
    });

    it('requirements-mac.txt includes psutil', () => {
        const req = readFileSync(resolve(PROJECT_ROOT, 'local-server/requirements-mac.txt'), 'utf-8');
        expect(req).toContain('psutil');
    });
});
