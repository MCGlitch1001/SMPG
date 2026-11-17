import fs from 'fs';
import path from 'path';

/**
 * Resolve background image or color based on 3 distinct choices:
 * 1. "ai": Generate with AI using Pollinations Flux text-to-image
 * 2. "plain": Use a solid background color (e.g. hex #09090b)
 * 3. "custom": Use user's own image (local file path, remote URL, or base64)
 */
export async function getBackgroundImage({
    bgType = null, // "ai" | "plain" | "custom"
    bgMode = null, // legacy alias for bgType ("image" | "color")
    prompt = "",
    bgColor = "#09090b",
    imageUrl = null,
    imagePath = null,
    imageBase64 = null,
    imageBuffer = null,
    mode = "carousel", // 'carousel' (1080x1080) or 'reel' (1080x1920)
    timeoutMs = 25000
}) {
    // Normalize type
    let resolvedType = (bgType || bgMode || "").toLowerCase();
    if (!resolvedType) {
        if (imageUrl || imagePath || imageBase64 || imageBuffer) {
            resolvedType = "custom";
        } else if (prompt) {
            resolvedType = "ai";
        } else {
            resolvedType = "plain";
        }
    }

    if (resolvedType === 'color') resolvedType = 'plain';
    if (resolvedType === 'image') resolvedType = (imageUrl || imagePath || imageBase64 || imageBuffer) ? 'custom' : 'ai';

    // Choice 1: Plain solid color
    if (resolvedType === 'plain') {
        return {
            type: 'color',
            color: bgColor || '#09090b',
            mode: 'plain'
        };
    }

    // Choice 2: Custom user-supplied image
    if (resolvedType === 'custom') {
        // Direct buffer
        if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
            return { type: 'image', buffer: imageBuffer, source: 'custom_buffer', mode: 'custom' };
        }

        // Base64 string
        if (imageBase64 && typeof imageBase64 === 'string') {
            try {
                const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(cleanBase64, 'base64');
                return { type: 'image', buffer, source: 'custom_base64', mode: 'custom' };
            } catch (err) {
                console.warn(`[ImageGenerator] Base64 decode failed (${err.message}). Falling back to plain color.`);
                return { type: 'color', color: bgColor || '#09090b', mode: 'plain' };
            }
        }

        // Local file path
        if (imagePath) {
            const resolvedPath = path.resolve(process.cwd(), imagePath);
            if (fs.existsSync(resolvedPath)) {
                const buffer = fs.readFileSync(resolvedPath);
                return { type: 'image', buffer, source: resolvedPath, mode: 'custom' };
            }
            console.warn(`[ImageGenerator] Local file not found: ${resolvedPath}. Falling back to plain color.`);
            return { type: 'color', color: bgColor || '#09090b', mode: 'plain' };
        }

        // Remote URL
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
                    source: imageUrl,
                    mode: 'custom'
                };
            } catch (err) {
                console.warn(`[ImageGenerator] Remote image fetch failed (${err.message}). Falling back to plain color.`);
                return { type: 'color', color: bgColor || '#09090b', mode: 'plain' };
            }
        }

        return { type: 'color', color: bgColor || '#09090b', mode: 'plain' };
    }

    // Choice 3: AI-generated image (Pollinations Flux)
    const fullPrompt = `${prompt || "dark obsidian luxury minimalist architecture"}. Dark aesthetic, moody, high contrast, cinematic lighting, desaturated, gritty, luxury, 8k resolution, instagram aesthetic`;
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
            source: pollinationsUrl,
            mode: 'ai'
        };
    } catch (err) {
        console.warn(`[ImageGenerator] AI image generation failed (${err.message}). Falling back to plain color.`);
        return {
            type: 'color',
            color: bgColor || '#09090b',
            warning: `AI generation failed: ${err.message}`,
            mode: 'plain'
        };
    }
}
