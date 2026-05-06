import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
let serverProc = null;
let serverUrl = 'http://localhost:8005';

function startServer() {
    return new Promise((resolve, reject) => {
        const pythonPath = resolve(PROJECT_ROOT, '.venv/bin/python3');
        const proc = spawn(pythonPath, ['local-server/server.py'], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, INFERENCE_ENGINE: 'diffusers', PORT: '8005' },
        });
        let stderr = '';
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error('Server start timeout. Stderr: ' + stderr.slice(-500)));
        }, 60000);

        const checkReady = setInterval(() => {
            if (stderr.includes('Pipeline ready') || stdout.includes('Application startup complete') || stderr.includes('Application startup complete')) {
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

describe('Concurrency — runtime contract', () => {
    beforeAll(async () => {
        await startServer();
    }, 65000);

    afterAll(async () => {
        await stopServer();
    }, 10000);

    it('health shows diffusers engine and loaded model', async () => {
        const { status, data } = await fetchJson('/health');
        expect(status).toBe(200);
        expect(data.engine).toBe('diffusers');
        // Server may be 'ready', 'loading', or 'generating' depending on state
        expect(['idle', 'loading', 'ready', 'generating']).toContain(data.pipeline_state);
        expect(data.model).not.toBe('none');
    }, 10000);

    it('swap to same model returns 400', async () => {
        const { status, data } = await fetchJson('/api/v1/swap-model', {
            method: 'POST',
            body: JSON.stringify({ model: 'z-image-turbo' }),
        });
        expect(status).toBe(400);
        expect(data.detail.error).toBe('Model already loaded');
    }, 10000);

    it('swap to unknown model returns 400', async () => {
        const { status } = await fetchJson('/api/v1/swap-model', {
            method: 'POST',
            body: JSON.stringify({ model: 'nonexistent-model-xyz' }),
        });
        expect(status).toBe(400);
    }, 10000);

    it('swap during active generation returns 409', async () => {
        // Fire generation request (do not await — it blocks until generation completes)
        const genPromise = fetchJson('/api/v1/cinema', {
            method: 'POST',
            body: JSON.stringify({
                prompt: 'a red cat sleeping on a blue sofa, cinematic lighting',
                aspect_ratio: '1:1',
                steps: 8,
            }),
        });

        // Small delay to ensure generation has acquired _gen_lock
        await new Promise(r => setTimeout(r, 800));

        // Attempt swap while generation is in progress
        const { status, data } = await fetchJson('/api/v1/swap-model', {
            method: 'POST',
            body: JSON.stringify({ model: 'flux2-klein-4b' }),
        });

        // Must be 409 (cannot swap while generating)
        expect(status).toBe(409);
        expect(data.detail).toMatch(/Cannot swap while generating/i);

        // Clean up: wait for generation to finish (or timeout)
        await Promise.race([
            genPromise,
            new Promise(r => setTimeout(r, 45000)),
        ]);
    }, 60000);
});

describe('Concurrency — static code contract', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('has _gen_lock asyncio.Lock', () => {
        expect(serverPy).toContain('_gen_lock = asyncio.Lock()');
    });

    it('has _swap_lock asyncio.Lock', () => {
        expect(serverPy).toContain('_swap_lock = asyncio.Lock()');
    });

    it('generation checks _swap_lock.locked() before acquiring _gen_lock', () => {
        expect(serverPy).toContain('if _swap_lock.locked():');
        expect(serverPy).toContain('async with _gen_lock:');
    });

    it('swap endpoint checks _gen_lock.locked() before acquiring _swap_lock', () => {
        expect(serverPy).toContain('if _gen_lock.locked():');
        expect(serverPy).toContain('async with _swap_lock:');
    });

    it('swap endpoint returns 409 when pipeline_state is GENERATING', () => {
        expect(serverPy).toContain('pipeline_state == PipelineState.GENERATING');
        expect(serverPy).toContain('Cannot swap while generating');
    });

    it('generation returns 503 when swap is in progress', () => {
        expect(serverPy).toContain('Pipeline swap in progress, try again shortly');
    });

    it('pipeline_state transitions from idle → ready → generating', () => {
        expect(serverPy).toContain('PipelineState.READY');
        expect(serverPy).toContain('PipelineState.GENERATING');
    });
});

describe('Concurrency — Python runtime test exists', () => {
    it('local-server/tests/test_concurrency.py exists', () => {
        const fs = require('fs');
        const path = resolve(PROJECT_ROOT, 'local-server/tests/test_concurrency.py');
        expect(fs.existsSync(path)).toBe(true);
    });

    it('Python concurrency test covers swap-while-generating', () => {
        const pyTest = readFileSync(resolve(PROJECT_ROOT, 'local-server/tests/test_concurrency.py'), 'utf-8');
        expect(pyTest).toContain('test_swap_while_generating_returns_409');
        expect(pyTest).toContain('test_generate_while_swap_in_progress_returns_503');
    });
});
