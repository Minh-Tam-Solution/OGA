import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

describe('Lip Sync — tab activation', () => {
    const standAloneShell = readFileSync(resolve(PROJECT_ROOT, 'components/StandaloneShell.js'), 'utf-8');

    it('Lip Sync tab is not comingSoon in local mode', () => {
        // comingSoon: false for lipsync (activated)
        const lipsyncLine = standAloneShell.split('\n').find(l => l.includes("lipsync") && l.includes("comingSoon"));
        expect(lipsyncLine).toBeDefined();
        expect(lipsyncLine).toContain('comingSoon: false');
    });

    it('LipSyncStudio receives isLocal prop', () => {
        expect(standAloneShell).toContain('<LipSyncStudio');
        expect(standAloneShell).toContain('isLocal={_isLocal}');
    });

    it('Cinema tab is also not comingSoon (pattern consistency)', () => {
        const cinemaLine = standAloneShell.split('\n').find(l => l.includes("cinema") && l.includes("comingSoon"));
        expect(cinemaLine).toBeDefined();
        expect(cinemaLine).toContain('comingSoon: false');
    });
});

describe('Lip Sync — Studio component', () => {
    const lipSyncStudio = readFileSync(resolve(PROJECT_ROOT, 'packages/studio/src/components/LipSyncStudio.jsx'), 'utf-8');

    it('has isLocal prop with default false', () => {
        expect(lipSyncStudio).toContain('isLocal = false');
    });

    it('renders cloud-only banner when isLocal is true', () => {
        expect(lipSyncStudio).toContain('isLocal && (');
        expect(lipSyncStudio).toContain('cloud-only on this device');
        expect(lipSyncStudio).toContain('bg-[#d9ff00]/10');
    });
});

describe('Lip Sync — spike report', () => {
    it('sprint-8-spike-report.md exists', () => {
        const fs = require('fs');
        const path = resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-8-spike-report.md');
        expect(fs.existsSync(path)).toBe(true);
    });

    it('spike report documents LivePortrait audio limitation', () => {
        const report = readFileSync(resolve(PROJECT_ROOT, 'docs/04-build/sprints/sprint-8-spike-report.md'), 'utf-8');
        expect(report).toContain('FAIL');
        expect(report).toContain('audio-driven');
        expect(report).toContain('LivePortrait');
    });
});

describe('Lip Sync — server.py contract (ready for future activation)', () => {
    const serverPy = readFileSync(resolve(PROJECT_ROOT, 'local-server/server.py'), 'utf-8');

    it('server.py has _gen_lock and _swap_lock (concurrency ready)', () => {
        expect(serverPy).toContain('_gen_lock = asyncio.Lock()');
        expect(serverPy).toContain('_swap_lock = asyncio.Lock()');
    });

    it('server.py has is_ram_over_cap() helper', () => {
        expect(serverPy).toContain('def is_ram_over_cap()');
    });

    it('server.py has base64 validate=True fix', () => {
        expect(serverPy).toContain('base64.b64decode(b64data, validate=True)');
    });
});

describe('Lip Sync — models.json schema', () => {
    const models = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'local-server/models.json'), 'utf-8'));

    it('all models have model_type field', () => {
        for (const m of models) {
            expect(m).toHaveProperty('model_type');
            expect(['diffusers', 'utility', 'custom', 'cloud-only']).toContain(m.model_type);
        }
    });

    // AnimateDiff retired after Sprint 7 spike FAIL — see ADR-005 v2.0
    it('does NOT have retired AnimateDiff entry', () => {
        const ad = models.find(m => m.id === 'guoyww/animatediff-motion-adapter-v1-5-2');
        expect(ad).toBeUndefined();
    });

    it('has IP-Adapter entry (from Sprint 7)', () => {
        const ip = models.find(m => m.id === 'h94/IP-Adapter-SD15');
        expect(ip).toBeDefined();
        expect(ip.model_type).toBe('diffusers');
    });
});
