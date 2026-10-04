import fs from 'fs';
import path from 'path';
import { generateContent, saveUsedQuotes } from './text-generator.js';
import { getBackgroundImage } from './image-generator.js';
import { renderSlide } from './renderer.js';
import { generateCaption } from './caption-generator.js';
import { VIBE_PRESETS, FONT_PROFILES } from './presets.js';
import { resolveApiKey } from './config.js';

export async function executeWorkflow(spec = {}, baseUrl = "") {
    const startTime = Date.now();

    // 1. Normalize and apply defaults
    const name = spec.name || "SMPG-Workflow";
    const mode = (spec.format || spec.mode || "carousel").toLowerCase() === 'reel' ? 'reel' : 'carousel';
    
    const input = spec.input || {};
    const topic = input.topic || VIBE_PRESETS[0];
    const numPosts = Math.max(1, Math.min(10, parseInt(input.numPosts || spec.numPosts || 1, 10)));
    const slidesPerPost = mode === 'reel' ? 1 : Math.max(1, Math.min(10, parseInt(input.slidesPerPost || spec.slidesPerPost || 3, 10)));
    
    // Content choices: "ai", "json", "db"
    const contentSource = input.contentSource || spec.contentSource || null;
    const dbCategory = input.dbCategory || spec.dbCategory || null;
    const providedQuotes = input.quotes || spec.quotes || null;
    const providedBackgroundPrompt = input.backgroundPrompt || spec.backgroundPrompt || null;
    
    // Background choices: "ai", "plain", "custom"
    const bgType = input.bgType || spec.bgType || input.bgMode || spec.bgMode || null;
    const bgColor = input.bgColor || spec.bgColor || "#09090b";
    const imageUrl = input.imageUrl || spec.imageUrl || null;
    const imagePath = input.imagePath || spec.imagePath || null;
    const imageBase64 = input.imageBase64 || spec.imageBase64 || null;

    const theme = spec.theme || {};
    const fontProfile = theme.fontProfile || spec.fontProfile || "BigShoulders";
    const customFontSize = theme.fontSize || spec.fontSize || null;
    const watermark = theme.watermark || spec.watermark || null;

    const generator = spec.generator || {};
    // API key resolution: explicit param -> stored app config -> env var -> null
    const apiKey = resolveApiKey(generator.apiKey || spec.apiKey || null);
    const model = generator.model || spec.model || "gemini-2.5-flash";

    const outputSpec = spec.output || {};
    const outputDir = path.resolve(process.cwd(), outputSpec.directory || "./output");
    const saveImages = outputSpec.saveImages !== false;
    const returnBase64 = Boolean(outputSpec.returnBase64);
    const generateCaptionsFlag = outputSpec.generateCaptions !== false;

    if (saveImages && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 2. Resolve Content (AI, JSON, or DB)
    const contentData = await generateContent({
        contentSource,
        topic,
        mode,
        numPosts,
        slidesPerPost,
        apiKey,
        model,
        providedQuotes,
        dbCategory,
        providedBackgroundPrompt
    });

    const postsToProcess = contentData.posts.slice(0, numPosts);
    const finalPosts = [];
    const allQuotesRendered = [];

    // 3. Process Each Post
    for (let pIdx = 0; pIdx < postsToProcess.length; pIdx++) {
        const postData = postsToProcess[pIdx];
        const postNum = pIdx + 1;
        const quotes = postData.quotes;
        allQuotesRendered.push(...quotes);

        // Resolve Background (AI, plain color, or custom image)
        const bgResult = await getBackgroundImage({
            bgType,
            prompt: postData.backgroundPrompt || topic,
            mode,
            bgColor,
            imageUrl,
            imagePath,
            imageBase64
        });

        const slides = [];

        for (let sIdx = 0; sIdx < quotes.length; sIdx++) {
            const slideNum = sIdx + 1;
            const quote = quotes[sIdx];

            const slideBuffer = await renderSlide({
                quote,
                bgResult,
                mode,
                slideIndex: sIdx,
                totalSlides: quotes.length,
                fontProfile,
                customFontSize,
                watermark,
                showSwipeArrow: true
            });

            const fileName = `post_${postNum}_slide_${slideNum}.png`;
            const filePath = path.join(outputDir, fileName);

            if (saveImages) {
                fs.writeFileSync(filePath, slideBuffer);
            }

            const slideItem = {
                slideIndex: slideNum,
                quote,
                fileName,
                filePath: saveImages ? filePath : null,
                url: baseUrl ? `${baseUrl}/output/${fileName}` : `/output/${fileName}`
            };

            if (returnBase64) {
                slideItem.base64 = `data:image/png;base64,${slideBuffer.toString('base64')}`;
            }

            slides.push(slideItem);
        }

        const caption = generateCaptionsFlag
            ? generateCaption({
                firstQuote: quotes[0] || topic,
                topic,
                mode,
                watermark
            })
            : null;

        finalPosts.push({
            postIndex: postNum,
            mode,
            contentSource: contentData.contentSource,
            backgroundType: bgResult.mode || bgResult.type,
            backgroundSource: bgResult.source || bgResult.color || 'solid',
            caption,
            slides
        });
    }

    saveUsedQuotes(allQuotesRendered);

    const result = {
        success: true,
        workflowName: name,
        format: mode,
        topic,
        contentSource: contentData.contentSource,
        backgroundType: bgType || (imageUrl || imagePath || imageBase64 ? 'custom' : (providedBackgroundPrompt || topic ? 'ai' : 'plain')),
        postsCount: finalPosts.length,
        totalSlides: finalPosts.reduce((acc, p) => acc + p.slides.length, 0),
        outputDirectory: saveImages ? outputDir : null,
        posts: finalPosts,
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString()
    };

    if (saveImages) {
        fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(result, null, 2));
    }

    return result;
}
