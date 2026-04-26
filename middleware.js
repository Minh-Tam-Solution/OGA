import { NextResponse } from 'next/server';

// Local MLX server URL — set LOCAL_API_URL env var to use local image gen
const LOCAL_API_URL = process.env.LOCAL_API_URL || '';

export function middleware(request) {
    const url = request.nextUrl;

    // Catch requests to /api/workflow, /api/app, and /api/v1
    const isMuApi = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isMuApi) {
        if (url.pathname.startsWith('/api/v1')) {
            // Route to local MLX server or Muapi cloud
            const backend = LOCAL_API_URL || 'https://api.muapi.ai';

            // Local server returns results synchronously — skip polling endpoint
            const isPollingPath = url.pathname.match(/^\/api\/v1\/predictions\/[^/]+\/result$/);
            if (LOCAL_API_URL && isPollingPath) {
                return NextResponse.next();
            }

            const targetUrl = new URL(url.pathname + url.search, backend);
            return NextResponse.rewrite(targetUrl);
        }
    }

    return NextResponse.next();
}

// Match the paths we want to proxy
export const config = {
    matcher: [
        '/api/workflow/:path*', 
        '/api/app/:path*',
        '/api/v1/:path*'
    ],
};
