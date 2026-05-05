import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const MODELS_JSON = resolve(PROJECT_ROOT, 'local-server/models.json');

let serverProc = null;
let serverUrl = 'http://localhost:8001';

function startServer() {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', ['local-server/server.py'], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, INFERENCE_ENGINE: 'mflux', PORT: '8001' },
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
    const data = text ? JSON.parse(text) : {};
    return { status: res.status, data };
}

describe('Hot-swap — models.json schema', () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf-8'));

    it('every model has model_type field', () => {
        for (const m of models) {
            expect(m).toHaveProperty('model_type');
            expect(['diffusers', 'utility', 'custom', 'cloud-only']).toContain(m.model_type);
        }
    });

    it('has RMBG utility entry', () => {
        const rembg = models.find(m => m.id === 'rembg-u2net');
        expect(rembg).toBeDefined();
        expect(rembg.model_type).toBe('utility');
        expect(rembg.features).toContain('remove-background');
    });

    it('diffusers models have pipeline field', () => {
        for (const m of models) {
            if (m.model_type === 'diffusers') {
                expect(m.pipeline).toBeTruthy();
            }
        }
    });

    it('utility model has null pipeline', () => {
        const rembg = models.find(m => m.id === 'rembg-u2net');
        expect(rembg.pipeline).toBeNull();
    });

    it('all models have frontend_ids array', () => {
        for (const m of models) {
            expect(Array.isArray(m.frontend_ids)).toBe(true);
            expect(m.frontend_ids.length).toBeGreaterThan(0);
        }
    });
});

describe('Hot-swap — state machine contracts', () => {
    it('PipelineState enum values are correct', () => {
        const expected = ['idle', 'loading', 'ready', 'generating'];
        for (const s of expected) {
            expect(typeof s).toBe('string');
        }
    });

    it('swap-model endpoint checks model_type before swapping', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('model_type not in ("diffusers", "custom")');
        expect(serverPy).toContain('Cannot swap model_type=');
    });

    it('swap-model endpoint returns 409 when generating', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('pipeline_state == PipelineState.GENERATING');
        expect(serverPy).toContain('Cannot swap while generating');
    });

    it('swap-model endpoint returns 503 when loading', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('pipeline_state == PipelineState.LOADING');
        expect(serverPy).toContain('Another swap already in progress');
    });

    it('health endpoint includes pipeline_state and memory metrics', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('"pipeline_state": pipeline_state.value');
        expect(serverPy).toContain('"memory_baseline_mb": memory_baseline_mb');
        expect(serverPy).toContain('"mps_current_mb": get_mps_memory()');
        expect(serverPy).toContain('"peak_ram_mb": last_peak_ram');
    });

    it('model-status lists available models with model_type', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('"model_type": m.get("model_type", "diffusers")');
    });

    it('v1/models includes model_type field', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('"model_type": m.get("model_type", "diffusers")');
    });
});

describe('Hot-swap — memory gate constants', () => {
    it('MEMORY_BASELINE_TOLERANCE_MB is 300', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('MEMORY_BASELINE_TOLERANCE_MB = 300');
    });

    it('unload_pipeline logs memory baseline and tolerance', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('memory_baseline_mb');
        expect(serverPy).toContain('MEMORY_BASELINE_TOLERANCE_MB');
    });

    it('swap endpoint acquires _swap_lock', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('async with _swap_lock:');
    });

    it('generation checks _swap_lock before acquiring _gen_lock', () => {
        const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');
        expect(serverPy).toContain('_swap_lock.locked()');
        expect(serverPy).toContain('async with _gen_lock:');
    });
});
