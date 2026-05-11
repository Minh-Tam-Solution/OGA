// Frontend-side local model catalog.
// Two providers:
//   - sdcpp: bundled engine, weights live on disk
//   - wan2gp: user-run remote Gradio server
// Mirrors electron/lib/modelCatalog.js (sd.cpp) and electron/lib/wan2gpProvider.js (wan2gp).
//
// `engines` restricts which backend the model is exposed on. If omitted, the model
// is shown everywhere (legacy fallback). Use this to hide Mac-only or sd.cpp-only
// models when running on the CUDA/diffusers backend (GPU Server S1).
const CURRENT_ENGINE = process.env.NEXT_PUBLIC_INFERENCE_ENGINE || '';

function isModelAvailable(m) {
    if (!CURRENT_ENGINE) return true;
    if (!m.engines) return true;
    return m.engines.includes(CURRENT_ENGINE);
}

const ALL_LOCAL_MODELS = [
    // ── sd.cpp: Z-Image (Tongyi-MAI) ────────────────────────────────────────
    {
        id: 'z-image-turbo',
        name: 'Z-Image Turbo',
        description: 'WaveSpeed\'s featured local model — 6B params, ultra-fast 8-step generation. No API key needed.',
        type: 'z-image',
        provider: 'sdcpp',
        engines: ['sdcpp'],
        filename: 'z_image_turbo-Q4_K.gguf',
        sizeGB: 3.4,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 8,
        defaultGuidance: 1.0,
        tags: ['turbo', 'fast', 'local', 'featured'],
        featured: true,
    },
    {
        id: 'z-image-base',
        name: 'Z-Image Base',
        description: 'Full-quality 6B parameter model from Tongyi-MAI — higher detail, 50-step generation.',
        type: 'z-image',
        provider: 'sdcpp',
        engines: ['sdcpp'],
        filename: 'Z-Image-Q4_K_M.gguf',
        sizeGB: 3.5,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 50,
        defaultGuidance: 7.5,
        tags: ['high-quality', 'local', 'detailed'],
        featured: true,
    },
    // ── Local Diffusers: FLUX.2 Klein 4B (GPU Server S1) ──────────────────
    // DISABLED: SDNQ 4-bit quantizer fails on torch nightly (cu128) with
    // torch._dynamo.exc.FailOnRecompileLimitHit. Re-enable after SDNQ fixes
    // the torch.compile compatibility or we downgrade torch.
    // {
    //     id: 'flux2-klein-4b',
    //     name: 'FLUX.2 Klein 4B',
    //     description: 'Ultra-fast FLUX.2 distilled model — 4B params, 4-step generation. Excellent prompt understanding and detail.',
    //     type: 'flux',
    //     provider: 'local',
    //     engines: ['diffusers'],
    //     aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    //     defaultSteps: 4,
    //     defaultGuidance: 1.0,
    //     tags: ['flux', 'fast', 'high-quality', 'featured'],
    //     featured: true,
    // },
    // ── sd.cpp: SD 1.5 (small, M2-friendly) ─────────────────────────────────
    {
        id: 'dreamshaper-8',
        name: 'Dreamshaper 8',
        description: 'Versatile SD 1.5 model — great for portraits, landscapes, and artistic styles.',
        type: 'sd1',
        provider: 'sdcpp',
        engines: ['diffusers'],
        filename: 'DreamShaper_8_pruned.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 20,
        defaultGuidance: 7.5,
        tags: ['photorealistic', 'artistic', 'versatile'],
    },
    {
        id: 'realistic-vision-v51',
        name: 'Realistic Vision v5.1',
        description: 'Highly photorealistic people and scenes, based on SD 1.5.',
        type: 'sd1',
        provider: 'sdcpp',
        engines: ['diffusers'],
        filename: 'realisticVisionV51_v51VAE.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 25,
        defaultGuidance: 7,
        tags: ['photorealistic', 'portraits', 'people'],
    },
    {
        id: 'anything-v5',
        name: 'Anything v5',
        description: 'High quality anime and illustration style image generation.',
        type: 'sd1',
        provider: 'sdcpp',
        engines: ['diffusers'],
        filename: 'Anything-v5.0-PRT.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 20,
        defaultGuidance: 7,
        tags: ['anime', 'illustration', 'artistic'],
    },
    // ── sd.cpp: SDXL ────────────────────────────────────────────────────────
    {
        id: 'stable-diffusion-xl-base',
        name: 'SDXL Base 1.0',
        description: 'Official Stable Diffusion XL base model — higher resolution, excellent quality.',
        type: 'sdxl',
        provider: 'sdcpp',
        engines: ['diffusers'],
        filename: 'sd_xl_base_1.0.safetensors',
        sizeGB: 6.9,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 30,
        defaultGuidance: 7.5,
        tags: ['sdxl', 'high-quality', 'versatile'],
    },

    // ── Wan2GP: image models ────────────────────────────────────────────────
    {
        id: 'wan2gp:flux-dev',
        name: 'Flux.1 Dev (Wan2GP)',
        description: 'Image — FLUX.1 dev served by Wan2GP. Requires running Wan2GP server.',
        type: 'image',
        family: 'flux',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 28,
        defaultGuidance: 3.5,
        tags: ['image', 'flux', 'remote'],
    },
    {
        id: 'wan2gp:qwen-image',
        name: 'Qwen Image (Wan2GP)',
        description: 'Image — Qwen-Image text-to-image served by Wan2GP.',
        type: 'image',
        family: 'qwen',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 30,
        defaultGuidance: 4.0,
        tags: ['image', 'qwen', 'remote'],
    },
    // ── Local Diffusers: video models (GPU Server S1) ──────────────────────
    {
        id: 'cogvideox-5b',
        name: 'CogVideoX 5B',
        description: 'High-quality text-to-video by Zhipu AI. 5B parameters. Output clamped to 720×480/480×720 (VRAM-safe on RTX 5090 32GB).',
        type: 'video',
        family: 'cogvideox',
        provider: 'local',
        engines: ['diffusers'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        defaultSteps: 25,
        defaultGuidance: 6.0,
        tags: ['video', 'cogvideox', 'text-to-video', 'high-quality'],
        featured: true,
    },
    {
        id: 'wan2.1-t2v-1.3b',
        name: 'Wan2.1 T2V 1.3B',
        description: 'Alibaba Wan2.1 — SOTA open-source video. 81 frames (~5s), 832×480. Low VRAM (~11GB). Visual text generation support.',
        type: 'video',
        family: 'wan',
        provider: 'local',
        engines: ['diffusers'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        defaultSteps: 30,
        defaultGuidance: 1.0,
        tags: ['video', 'wan', 'text-to-video', 'sota', 'long-video'],
        featured: true,
    },
    {
        id: 'ltx-video',
        name: 'LTX-Video',
        description: 'Lightricks LTX — Ultra-fast text-to-video. 65 frames (~2.7s), 768×512. Lowest VRAM (~9GB). Real-time generation speed.',
        type: 'video',
        family: 'ltx',
        provider: 'local',
        engines: ['diffusers'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        defaultSteps: 30,
        defaultGuidance: 3.0,
        tags: ['video', 'ltx', 'text-to-video', 'fast', 'real-time'],
        featured: true,
    },

    // ── Wan2GP: video models ────────────────────────────────────────────────
    {
        id: 'wan2gp:wan22-t2v',
        name: 'Wan 2.2 (Text-to-Video)',
        description: 'Video — Wan 2.2 text-to-video. Slow on consumer GPUs.',
        type: 'video',
        family: 'wan',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        aspectRatios: ['16:9', '1:1', '9:16'],
        defaultSteps: 25,
        defaultGuidance: 5.0,
        tags: ['video', 'wan', 'text-to-video'],
    },
    {
        id: 'wan2gp:wan22-i2v',
        name: 'Wan 2.2 (Image-to-Video)',
        description: 'Video — Wan 2.2 image-to-video. Provide a start frame.',
        type: 'video',
        family: 'wan',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        needsImage: true,
        aspectRatios: ['16:9', '1:1', '9:16'],
        defaultSteps: 25,
        defaultGuidance: 5.0,
        tags: ['video', 'wan', 'image-to-video'],
    },
    {
        id: 'wan2gp:hunyuan-video',
        name: 'Hunyuan Video (Wan2GP)',
        description: 'Video — Hunyuan text-to-video via Wan2GP.',
        type: 'video',
        family: 'hunyuan',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        aspectRatios: ['16:9', '1:1', '9:16'],
        defaultSteps: 30,
        defaultGuidance: 6.0,
        tags: ['video', 'hunyuan'],
    },
    {
        id: 'wan2gp:ltx-video',
        name: 'LTX Video (Wan2GP)',
        description: 'Video — LTX text-to-video. Fastest video option in Wan2GP.',
        type: 'video',
        family: 'ltx',
        provider: 'wan2gp',
        engines: ['wan2gp'],
        aspectRatios: ['16:9', '1:1', '9:16'],
        defaultSteps: 20,
        defaultGuidance: 3.0,
        tags: ['video', 'ltx', 'fast'],
    },
];

export const LOCAL_MODEL_CATALOG = ALL_LOCAL_MODELS.filter(isModelAvailable);

export function getLocalModelById(id) {
    return LOCAL_MODEL_CATALOG.find(m => m.id === id) || null;
}

export const isWan2gpModelId = (id) => getLocalModelById(id)?.provider === 'wan2gp';
export const isLocalModelId  = (id) => !!getLocalModelById(id);

export const localT2VModels = LOCAL_MODEL_CATALOG.filter(m => (m.provider === 'wan2gp' || m.provider === 'local') && m.type === 'video' && !m.needsImage);
export const localI2VModels = LOCAL_MODEL_CATALOG.filter(m => (m.provider === 'wan2gp' || m.provider === 'local') && m.type === 'video' &&  m.needsImage);
