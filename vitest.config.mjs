import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.{js,mjs}'],
        coverage: {
            provider: 'v8',
            include: ['src/lib/providerConfig.js', 'src/lib/pendingJobs.js', 'src/lib/wan2gpClient.js', 'src/lib/aiPlatformVoiceClient.js', 'app/api/voice/tts/route.js'],
            reporter: ['text', 'text-summary'],
        },
    },
});
