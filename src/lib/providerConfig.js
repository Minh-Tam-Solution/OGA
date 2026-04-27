// Provider abstraction — Single Source of Truth for local vs cloud routing.
// All modules read from here. See TS-001 §3 for design rationale.

/**
 * Returns 'local' | 'cloud' based on NEXT_PUBLIC_LOCAL_MODE env var.
 * NEXT_PUBLIC_* is statically inlined by Next.js at build time,
 * so this works in both server and browser runtimes.
 */
export function getProvider() {
    return process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' ? 'local' : 'cloud';
}

/** Convenience boolean — avoids repetitive string comparison at call sites. */
export const isLocalMode = () => getProvider() === 'local';

/**
 * Wan2GP video engine configuration.
 * enabled: false until Sprint 3 activates it.
 */
export const wan2gpConfig = {
    enabled: false,
    url: process.env.NEXT_PUBLIC_WAN2GP_URL || 'http://localhost:7860',
};
