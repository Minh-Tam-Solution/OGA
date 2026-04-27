import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
beforeEach(() => {
    globalThis.localStorage = {
        _store: {},
        getItem(key) { return this._store[key] ?? null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; },
    };
});

describe('pendingJobs', () => {
    it('savePendingJob stores job in localStorage', async () => {
        const { savePendingJob, getPendingJobs } = await import('../../src/lib/pendingJobs.js');
        savePendingJob({ requestId: 'r1', studioType: 'image', submittedAt: Date.now() });
        const jobs = getPendingJobs('image');
        expect(jobs.length).toBe(1);
        expect(jobs[0].requestId).toBe('r1');
    });

    it('removePendingJob removes by requestId', async () => {
        const { savePendingJob, removePendingJob, getPendingJobs } = await import('../../src/lib/pendingJobs.js');
        savePendingJob({ requestId: 'r2', studioType: 'image', submittedAt: Date.now() });
        removePendingJob('r2');
        expect(getPendingJobs('image').length).toBe(0);
    });

    it('getPendingJobs filters by studioType', async () => {
        const { savePendingJob, getPendingJobs } = await import('../../src/lib/pendingJobs.js');
        savePendingJob({ requestId: 'r3', studioType: 'image', submittedAt: Date.now() });
        savePendingJob({ requestId: 'r4', studioType: 'video', submittedAt: Date.now() });
        expect(getPendingJobs('image').length).toBe(1);
        expect(getPendingJobs('video').length).toBe(1);
    });

    it('prunes expired jobs (>10min old)', async () => {
        const { savePendingJob, getPendingJobs } = await import('../../src/lib/pendingJobs.js');
        // Save a job that's 15 minutes old
        savePendingJob({ requestId: 'old', studioType: 'image', submittedAt: Date.now() - 15 * 60 * 1000 });
        const jobs = getPendingJobs('image');
        expect(jobs.length).toBe(0); // should be pruned
    });

    it('keeps recent jobs (<10min old)', async () => {
        const { savePendingJob, getPendingJobs } = await import('../../src/lib/pendingJobs.js');
        savePendingJob({ requestId: 'fresh', studioType: 'image', submittedAt: Date.now() - 5 * 60 * 1000 });
        const jobs = getPendingJobs('image');
        expect(jobs.length).toBe(1);
    });

    it('getJobElapsed returns seconds since submission', async () => {
        const { savePendingJob, getJobElapsed } = await import('../../src/lib/pendingJobs.js');
        const submitted = Date.now() - 30_000; // 30s ago
        savePendingJob({ requestId: 'elapsed1', studioType: 'image', submittedAt: submitted });
        const elapsed = getJobElapsed('elapsed1');
        expect(elapsed).toBeGreaterThanOrEqual(29);
        expect(elapsed).toBeLessThanOrEqual(32);
    });

    it('getJobElapsed returns 0 for unknown job', async () => {
        const { getJobElapsed } = await import('../../src/lib/pendingJobs.js');
        expect(getJobElapsed('nonexistent')).toBe(0);
    });
});
