const PENDING_KEY = 'muapi_pending_jobs';

export function savePendingJob(job) {
    try {
        const jobs = getAllPendingJobs().filter(j => j.requestId !== job.requestId);
        jobs.push(job);
        localStorage.setItem(PENDING_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.warn('[PendingJobs] Failed to save:', e);
    }
}

export function removePendingJob(requestId) {
    try {
        const jobs = getAllPendingJobs().filter(j => j.requestId !== requestId);
        localStorage.setItem(PENDING_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.warn('[PendingJobs] Failed to remove:', e);
    }
}

export function getPendingJobs(studioType) {
    const all = getAllPendingJobs();
    return studioType ? all.filter(j => j.studioType === studioType) : all;
}

// Max age for pending jobs: 10 minutes (stale jobs are pruned on read)
const MAX_AGE_MS = 10 * 60 * 1000;

function getAllPendingJobs() {
    try {
        const now = Date.now();
        const jobs = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        // Prune expired or completed jobs
        const active = jobs.filter(j => {
            if (j.status === 'completed' || j.status === 'error') return false;
            if (j.submittedAt && (now - j.submittedAt) > MAX_AGE_MS) return false;
            return true;
        });
        // Write back pruned list if anything was removed
        if (active.length !== jobs.length) {
            localStorage.setItem(PENDING_KEY, JSON.stringify(active));
        }
        return active;
    } catch {
        return [];
    }
}

/**
 * Get elapsed seconds since job was submitted.
 * Used by UI to restore elapsed-time display on page reload.
 */
export function getJobElapsed(requestId) {
    const job = getAllPendingJobs().find(j => j.requestId === requestId);
    if (!job?.submittedAt) return 0;
    return Math.floor((Date.now() - job.submittedAt) / 1000);
}
