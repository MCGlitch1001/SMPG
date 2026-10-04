import fs from 'fs';
import path from 'path';

/**
 * Fetch an AI-generated image buffer or load local image buffer
 */
export async function getBackgroundImage({
    prompt = "",
    mode = "carousel", // 'carousel' (1080x1080) or 'reel' (1080x1920)
    bgMode = "image", // 'image' or 'color'
    bgColor = "#09090b",
    imageUrl = null,
    imagePath = null,
    timeoutMs = 25000
}) {
    if (bgMode === 'color' || (!prompt && !imageUrl && !imagePath)) {
        return {
            type: 'color',
            color: bgColor || '#09090b'
        };
    }

    // If local file path is provided
    if (imagePath && fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath);
        return {
            type: 'image',
            buffer,
            source: imagePath
        };
    }

    // If direct URL is provided
    if (imageUrl) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(imageUrl, { signal: controller.signal });
            clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`Failed to fetch image URL (${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return {
                type: 'image',
                buffer: Buffer.from(arrayBuffer),
                source: imageUrl
            };
        } catch (err) {
            console.warn(`[ImageGenerator] Direct image fetch failed (${err.message}). Falling back to color mode.`);
            return { type: 'color', color: bgColor || '#09090b' };
        }
    }

    // Generate via Pollinations Flux engine
    const fullPrompt = `${prompt}. Dark aesthetic, moody, high contrast, cinematic lighting, desaturated, gritty, luxury, 8k resolution, instagram aesthetic`;
    const randomSeed = Math.floor(Math.random() * 1000000000);
    const width = 1080;
    const height = mode === 'reel' ? 1920 : 1080;
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}&model=flux`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(pollinationsUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`Pollinations engine returned status ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
            type: 'image',
            buffer,
            source: pollinationsUrl
        };
    } catch (err) {
        console.warn(`[ImageGenerator] Image generation failed (${err.message}). Falling back to color mode.`);
        return {
            type: 'color',
            color: bgColor || '#09090b',
            warning: `Image generation failed: ${err.message}`
        };
    }
}
