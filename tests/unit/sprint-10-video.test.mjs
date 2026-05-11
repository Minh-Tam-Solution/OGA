import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

describe('Sprint 10 — Video Model Registry (models.json)', () => {
    const models = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'local-server/models.json'), 'utf-8'));

    it('has Wan2.1 T2V 1.3B entry', () => {
        const wan = models.find(m => m.id === 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers');
        expect(wan).toBeDefined();
        expect(wan.pipeline).toBe('WanPipeline');
        expect(wan.model_type).toBe('diffusers');
        expect(wan.features).toContain('text-to-video');
    });

    it('has LTX-Video entry', () => {
        const ltx = models.find(m => m.id === 'Lightricks/LTX-Video');
        expect(ltx).toBeDefined();
        expect(ltx.pipeline).toBe('LTXPipeline');
        expect(ltx.model_type).toBe('diffusers');
        expect(ltx.features).toContain('text-to-video');
    });

    it('Wan2.1 defaults match flow-matching spec (cfg=1.0)', () => {
        const wan = models.find(m => m.id === 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers');
        expect(wan.default.steps).toBe(30);
        expect(wan.default.cfg).toBe(1.0);
        expect(wan.default.num_frames).toBe(81);
        expect(wan.default.fps).toBe(16);
        expect(wan.default.flow_shift).toBe(3.0);
    });

    it('LTX-Video defaults match spec', () => {
        const ltx = models.find(m => m.id === 'Lightricks/LTX-Video');
        expect(ltx.default.steps).toBe(30);
        expect(ltx.default.cfg).toBe(3.0);
        expect(ltx.default.num_frames).toBe(65);
        expect(ltx.default.fps).toBe(24);
    });

    it('CogVideoX 5B still present for backward compat', () => {
        const cog = models.find(m => m.id === '/home/nqh/shared/models/cogvideox');
        expect(cog).toBeDefined();
        expect(cog.pipeline).toBe('CogVideoXPipeline');
    });
});

describe('Sprint 10 — Frontend Catalog (localModels.js)', () => {
    const localModels = readFileSync(resolve(PROJECT_ROOT, 'src/lib/localModels.js'), 'utf-8');

    it('has Wan2.1 in frontend catalog', () => {
        expect(localModels).toContain("id: 'wan2.1-t2v-1.3b'");
        expect(localModels).toContain("defaultGuidance: 1.0");
    });

    it('has LTX-Video in frontend catalog', () => {
        expect(localModels).toContain("id: 'ltx-video'");
        expect(localModels).toContain("defaultGuidance: 3.0");
    });

    it('Wan2.1 defaultSteps match backend', () => {
        expect(localModels).toContain("defaultSteps: 30");
    });
});

describe('Sprint 10 — Server Implementation (server.py)', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('has WanPipeline loader with AutoencoderKLWan', () => {
        expect(serverPy).toContain('elif pipeline_name == "WanPipeline":');
        expect(serverPy).toContain('AutoencoderKLWan.from_pretrained');
        expect(serverPy).toContain('WanPipeline.from_pretrained');
    });

    it('has LTXPipeline loader', () => {
        expect(serverPy).toContain('elif pipeline_name == "LTXPipeline":');
        expect(serverPy).toContain('LTXPipeline.from_pretrained');
        expect(serverPy).toContain('pipe.vae.enable_tiling()');
    });

    it('Wan2.1 uses UniPCMultistepScheduler with flow_prediction', () => {
        expect(serverPy).toContain('prediction_type="flow_prediction"');
        expect(serverPy).toContain('use_flow_sigmas=True');
    });

    it('flow_shift is read from model config (not hardcoded)', () => {
        expect(serverPy).toContain('flow_shift = model_config.get("default", {}).get("flow_shift", 3.0)');
    });

    it('Wan2.1 VAE uses float32 (not bfloat16)', () => {
        expect(serverPy).toContain('torch_dtype=torch.float32');
    });

    it('Wan2.1 pipeline uses bfloat16', () => {
        // After VAE load, pipeline uses bfloat16
        const wanSection = serverPy.split('elif pipeline_name == "WanPipeline":')[1].split('elif pipeline_name == "LTXPipeline":')[0];
        expect(wanSection).toContain('torch_dtype=torch.bfloat16');
    });
});

describe('Sprint 10 — Spike Report & Docs', () => {
    it('spike report exists', () => {
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-10-wan21-ltx-spike-report.md');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });

    it('spike report documents PASS for Wan2.1', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-10-wan21-ltx-spike-report.md'), 'utf-8');
        expect(report).toContain('Wan2.1');
        expect(report).toContain('PASS');
        expect(report).toContain('flow_shift');
    });

    it('spike report documents PASS for LTX-Video', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-10-wan21-ltx-spike-report.md'), 'utf-8');
        expect(report).toContain('LTX-Video');
        expect(report).toContain('PASS');
    });

    it('video studio model guide updated', () => {
        const guide = readFileSync(resolve(PROJECT_ROOT, 'docs/07-operate/video-studio-model-guide.md'), 'utf-8');
        expect(guide).toContain('Wan2.1');
        expect(guide).toContain('LTX-Video');
    });

    it('TS-002 has Wan2.1 and LTX pipeline sections', () => {
        const ts = readFileSync(resolve(PROJECT_ROOT, 'docs/02-design/14-Technical-Specs/TS-002-diffusers-pipeline.md'), 'utf-8');
        expect(ts).toContain('WanPipeline');
        expect(ts).toContain('LTXPipeline');
        expect(ts).toContain('flow_shift');
    });
});
