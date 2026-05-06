import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
let serverProc = null;
let serverUrl = 'http://localhost:8004';

function startServer() {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', ['local-server/server.py'], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, INFERENCE_ENGINE: 'mflux', PORT: '8004' },
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
            if (stderr.includes('RMBG ready') || stdout.includes('Application startup complete') || stderr.includes('Application startup complete')) {
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
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
    return { status: res.status, data };
}

describe('IP-Adapter — endpoint contract', () => {
    beforeAll(async () => {
        await startServer();
    }, 35000);

    afterAll(async () => {
        await stopServer();
    }, 10000);

    it('POST /api/v1/product-placement returns 422 for missing product_image', async () => {
        const { status } = await fetchJson('/api/v1/product-placement', {
            method: 'POST',
            body: JSON.stringify({ scene_prompt: 'a cat' }),
        });
        // FastAPI/Pydantic returns 422 for missing required fields
        expect(status).toBe(422);
    }, 10000);

    it('POST /api/v1/product-placement returns 400 for invalid image data', async () => {
        const { status, data } = await fetchJson('/api/v1/product-placement', {
            method: 'POST',
            body: JSON.stringify({ product_image: 'bad', scene_prompt: 'a cat' }),
        });
        expect(status).toBe(400);
        expect(data.detail.error).toBe('Invalid product image');
    }, 10000);

    it('POST /api/v1/product-placement returns 400 for invalid base64', async () => {
        const { status, data } = await fetchJson('/api/v1/product-placement', {
            method: 'POST',
            body: JSON.stringify({ product_image: 'data:image/png;base64,!!!', scene_prompt: 'a cat' }),
        });
        // If server RAM > 85%, returns 503; otherwise 400 for invalid base64
        expect([400, 503]).toContain(status);
        if (status === 400) {
            expect(data.detail.error).toBe('Invalid base64 encoding');
        }
    }, 10000);

    it('health endpoint reports IP-Adapter model in registry', async () => {
        const { status, data } = await fetchJson('/v1/models');
        expect(status).toBe(200);
        const ipAdapter = data.data.find(m => m.id === 'ip-adapter');
        expect(ipAdapter).toBeDefined();
        expect(ipAdapter.model_type).toBe('diffusers');
    }, 10000);
});

describe('IP-Adapter — server.py implementation', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('has ProductPlacementRequest model', () => {
        expect(serverPy).toContain('class ProductPlacementRequest(BaseModel):');
        expect(serverPy).toContain('product_image: str');
        expect(serverPy).toContain('scene_prompt: str');
    });

    it('has _load_ip_adapter function', () => {
        expect(serverPy).toContain('async def _load_ip_adapter():');
    });

    it('has _unload_ip_adapter function', () => {
        expect(serverPy).toContain('def _unload_ip_adapter():');
    });

    it('has POST /api/v1/product-placement endpoint', () => {
        expect(serverPy).toContain('@app.post("/api/v1/product-placement")');
    });

    it('load_ip_adapter uses h94/IP-Adapter', () => {
        expect(serverPy).toContain('h94/IP-Adapter');
    });

    it('unload_ip_adapter calls torch.mps.empty_cache()', () => {
        expect(serverPy).toContain('torch.mps.empty_cache()');
    });
});

describe('IP-Adapter — models.json', () => {
    const models = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'local-server/models.json'), 'utf-8'));

    it('has IP-Adapter entry', () => {
        const ip = models.find(m => m.id === 'h94/IP-Adapter-SD15');
        expect(ip).toBeDefined();
        expect(ip.model_type).toBe('diffusers');
        expect(ip.features).toContain('product-placement');
        expect(ip.frontend_ids).toContain('ip-adapter');
    });

    it('has AnimateDiff entry', () => {
        const ad = models.find(m => m.id === 'guoyww/animatediff-motion-adapter-v1-5-2');
        expect(ad).toBeDefined();
        expect(ad.model_type).toBe('diffusers');
        expect(ad.features).toContain('cinema');
    });
});
