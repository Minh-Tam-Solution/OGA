import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

describe('Sprint 9 — Spike Reports', () => {
    it('Wav2Lip spike report exists', () => {
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-wav2lip-spike-report.md');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });

    it('Wav2Lip spike report documents license failure', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-wav2lip-spike-report.md'), 'utf-8');
        expect(report).toContain('FAIL');
        expect(report).toContain('License');
        expect(report).toContain('All rights reserved');
    });

    it('MuseTalk spike report exists', () => {
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-musetalk-spike-report.md');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });

    it('MuseTalk spike report documents dependency failure', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-musetalk-spike-report.md'), 'utf-8');
        expect(report).toContain('FAIL');
        expect(report).toContain('mmpose');
        expect(report).toContain('mmcv');
    });

    it('MuseTalk spike report confirms license is safe', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-musetalk-spike-report.md'), 'utf-8');
        expect(report).toContain('MIT');
        expect(report).toContain('Apache 2.0');
    });
});

describe('Sprint 9 — ADR-005 Revision', () => {
    const adr = readFileSync(resolve(PROJECT_ROOT, 'docs/02-design/01-ADRs/ADR-005-lipsync-architecture.md'), 'utf-8');

    it('ADR-005 has revision history', () => {
        expect(adr).toContain('Revision History');
        expect(adr).toContain('v2.0');
    });

    it('ADR-005 documents all spike results', () => {
        expect(adr).toContain('Wav2Lip');
        expect(adr).toContain('MuseTalk');
        expect(adr).toContain('LivePortrait');
    });

    it('ADR-005 declares cloud-only decision', () => {
        expect(adr).toContain('Cloud-Only');
        expect(adr).toContain('cloud-only');
    });

    it('ADR-005 references CogVideoX fallback', () => {
        expect(adr).toContain('CogVideoX');
    });
});

describe('Sprint 9 — Sprint 8 Report Annotation (CPO Feedback)', () => {
    const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-8-spike-report.md'), 'utf-8');

    it('Sprint 8 report has cold start annotation', () => {
        expect(report).toContain('cold start');
        expect(report).toContain('CPO Feedback');
    });

    it('Sprint 8 report clarifies load time context', () => {
        expect(report).toContain('first download');
        expect(report).toContain('JIT compile');
    });
});

describe('Sprint 9 — Lip Sync Cloud-Only State', () => {
    const lipSyncStudio = readFileSync(resolve(PROJECT_ROOT, 'packages/studio/src/components/LipSyncStudio.jsx'), 'utf-8');

    it('LipSyncStudio still has cloud-only banner', () => {
        expect(lipSyncStudio).toContain('cloud-only');
        expect(lipSyncStudio).toContain('isLocal && (');
    });

    it('StandaloneShell has lipsync tab active', () => {
        const shell = readFileSync(resolve(PROJECT_ROOT, 'components/StandaloneShell.js'), 'utf-8');
        const lipsyncLine = shell.split('\n').find(l => l.includes('lipsync') && l.includes('comingSoon'));
        expect(lipsyncLine).toBeDefined();
        expect(lipsyncLine).toContain('comingSoon: false');
    });
});

describe('Sprint 9 — CogVideoX Spike', () => {
    it('spike_cogvideox.py exists', () => {
        const path = resolve(PROJECT_ROOT, 'local-server/spike_cogvideox.py');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });

    it('spike script uses CogVideoXPipeline', () => {
        const script = readFileSync(resolve(PROJECT_ROOT, 'local-server/spike_cogvideox.py'), 'utf-8');
        expect(script).toContain('CogVideoXPipeline');
        expect(script).toContain('THUDM/CogVideoX-2b');
    });

    it('CogVideoX spike report exists', () => {
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-cogvideox-spike-report.md');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });

    it('CogVideoX spike report documents latency failure', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-cogvideox-spike-report.md'), 'utf-8');
        expect(report).toContain('FAIL');
        expect(report).toContain('latency');
        expect(report).toContain('TIMEOUT');
    });

    it('CogVideoX spike report references AnimateDiff pattern', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-cogvideox-spike-report.md'), 'utf-8');
        expect(report).toContain('AnimateDiff');
    });
});

describe('Sprint 9 — Sprint Plan Status', () => {
    it('sprint-9-plan.md exists', () => {
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-9-plan.md');
        expect(() => readFileSync(path, 'utf-8')).not.toThrow();
    });
});
