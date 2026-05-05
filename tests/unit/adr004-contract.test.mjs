import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
let serverProc = null;
let serverUrl = 'http://localhost:8003';

function startServer() {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', ['local-server/server.py'], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, INFERENCE_ENGINE: 'mflux', PORT: '8003' },
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

describe('ADR-004 — endpoint contracts', () => {
    beforeAll(async () => {
        await startServer();
    }, 35000);

    afterAll(async () => {
        await stopServer();
    }, 10000);

    it('health returns 200 with required top-level fields', async () => {
        const { status, data } = await fetchJson('/health');
        expect(status).toBe(200);
        expect(data.status).toBe('ok');
        expect(data).toHaveProperty('engine');
        expect(data).toHaveProperty('pipeline_state');
        expect(data).toHaveProperty('model');
        expect(data).toHaveProperty('peak_ram_mb');
        expect(data).toHaveProperty('memory_baseline_mb');
        expect(data).toHaveProperty('mps_current_mb');
        expect(data).toHaveProperty('last_gen_latency_s');
    }, 10000);

    it('health includes utilities object', async () => {
        const { data } = await fetchJson('/health');
        expect(data).toHaveProperty('utilities');
        expect(typeof data.utilities).toBe('object');
    }, 10000);

    it('health includes process_rss_mb', async () => {
        const { data } = await fetchJson('/health');
        expect(data).toHaveProperty('process_rss_mb');
        expect(typeof data.process_rss_mb).toBe('number');
    }, 10000);

    it('/v1/images/generations endpoint exists and accepts valid payload shape', async () => {
        const { status } = await fetchJson('/v1/images/generations', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'a cat', size: '512x512' }),
        });
        // mflux subprocess may fail (500) but the endpoint exists and accepts the payload
        expect([200, 500, 503]).toContain(status);
    }, 10000);

    it('/v1/images/generations rejects missing prompt with 422', async () => {
        const { status } = await fetchJson('/v1/images/generations', {
            method: 'POST',
            body: JSON.stringify({ size: '512x512' }),
        });
        expect(status).toBe(422);
    }, 10000);

    it('/v1/models returns list of models with required fields', async () => {
        const { status, data } = await fetchJson('/v1/models');
        expect(status).toBe(200);
        expect(data.object).toBe('list');
        expect(Array.isArray(data.data)).toBe(true);
        for (const m of data.data) {
            expect(m).toHaveProperty('id');
            expect(m).toHaveProperty('name');
            expect(m).toHaveProperty('ram_gb');
            expect(m).toHaveProperty('features');
            expect(m).toHaveProperty('default');
            expect(m).toHaveProperty('model_type');
            expect(m).toHaveProperty('loaded');
        }
    }, 10000);

    it('/api/model-status returns pipeline state and memory metrics', async () => {
        const { status, data } = await fetchJson('/api/model-status');
        expect(status).toBe(200);
        expect(data).toHaveProperty('pipeline_state');
        expect(data).toHaveProperty('loaded_model');
        expect(data).toHaveProperty('engine');
        expect(data).toHaveProperty('available_models');
        expect(data).toHaveProperty('peak_ram_mb');
        expect(data).toHaveProperty('mps_current_mb');
        expect(data).toHaveProperty('memory_baseline_mb');
    }, 10000);
});

describe('ADR-004 — endpoint existence', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('has POST /api/v1/{model} (muapi-compatible)', () => {
        expect(serverPy).toContain('@app.post("/api/v1/{model_endpoint:path}")');
    });

    it('has POST /v1/images/generations (OpenAI-compatible)', () => {
        expect(serverPy).toContain('@app.post("/v1/images/generations")');
    });

    it('has GET /health', () => {
        expect(serverPy).toContain('@app.get("/health")');
    });

    it('has GET /api/model-status', () => {
        expect(serverPy).toContain('@app.get("/api/model-status")');
    });

    it('has POST /api/v1/remove-bg (Sprint 6)', () => {
        expect(serverPy).toContain('@app.post("/api/v1/remove-bg")');
    });

    it('has POST /api/v1/swap-model (Sprint 6)', () => {
        expect(serverPy).toContain('@app.post("/api/v1/swap-model")');
    });
});
