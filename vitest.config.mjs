import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.{js,mjs}'],
        coverage: {
            provider: 'v8',
            include: ['src/lib/providerConfig.js', 'src/lib/pendingJobs.js', 'src/lib/wan2gpClient.js'],
            reporter: ['text', 'text-summary'],
        },
    },
});
