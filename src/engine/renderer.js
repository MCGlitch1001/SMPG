import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { FORMAT_SPECS, FONT_PROFILES } from './presets.js';

// Register bundled fonts
const FONTS_DIR = path.resolve(process.cwd(), 'assets/fonts');
if (fs.existsSync(FONTS_DIR)) {
    const fontFiles = fs.readdirSync(FONTS_DIR);
    for (const file of fontFiles) {
        if (file.endsWith('.ttf')) {
            const fontName = file.replace('.ttf', '');
            try {
                GlobalFonts.registerFromPath(path.join(FONTS_DIR, file), fontName);
            } catch (e) {
                // Ignore font register warning
            }
        }
    }
}

/**
 * Render a single slide image to buffer
 */
export async function renderSlide({
    quote = "",
    bgResult = { type: 'color', color: '#09090b' },
    mode = "carousel", // 'carousel' or 'reel'
    slideIndex = 0,
    totalSlides = 1,
    fontProfile = "BigShoulders",
    customFontSize = null,
    watermark = null,
    showSwipeArrow = true
}) {
    const spec = FORMAT_SPECS[mode] || FORMAT_SPECS.carousel;
    const canvas = createCanvas(spec.width, spec.height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    if (bgResult.type === 'image' && bgResult.buffer) {
        try {
            const img = await loadImage(bgResult.buffer);
            const scale = Math.max(spec.width / img.width, spec.height / img.height);
            const x = (spec.width / 2) - (img.width / 2) * scale;
            const y = (spec.height / 2) - (img.height / 2) * scale;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            // Dark aesthetic dimming overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(0, 0, spec.width, spec.height);
        } catch (err) {
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, spec.width, spec.height);
        }
    } else {
        ctx.fillStyle = bgResult.color || '#09090b';
        ctx.fillRect(0, 0, spec.width, spec.height);
    }

    // 2. Watermark / Brand Handle (if provided)
    if (watermark) {
        ctx.font = '600 24px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(watermark.toUpperCase(), spec.width / 2, 70);
    }

    // 3. Giant Quotation Mark Decoration
    const quoteFont = GlobalFonts.has('CrimsonPro-Bold') ? 'CrimsonPro-Bold' : 'Georgia, serif';
    ctx.font = `900 ${mode === 'reel' ? 280 : 250}px ${quoteFont}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('“', spec.width / 2, spec.quoteMarginY);

    // 4. Main Quote Typography
    const selectedFont = FONT_PROFILES[fontProfile]?.file?.replace('.ttf', '') || 'BigShoulders-Bold';
    const resolvedFont = GlobalFonts.has(selectedFont) ? selectedFont : 'sans-serif';
    const fontSize = customFontSize || (mode === 'reel' ? spec.defaultFontSize : spec.defaultFontSize);
    const lineHeight = fontSize * 1.25;

    ctx.font = `900 ${fontSize}px ${resolvedFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textToRender = (quote || "").toUpperCase();
    const words = textToRender.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > spec.maxTextWidth && n > 0) {
            lines.push(line.trim());
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    if (line.trim()) lines.push(line.trim());

    const totalHeight = lines.length * lineHeight;
    let startY = (spec.height - totalHeight) / 2 + (lineHeight / 2);

    // Drop shadow for punchy contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;

    for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], spec.width / 2, startY + (j * lineHeight));
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 5. Swipe Arrow & Slide Indicator (for carousels)
    if (mode === 'carousel') {
        const isNotLast = slideIndex < totalSlides - 1;

        // Slide numbering e.g. 01 / 04
        ctx.font = '600 22px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText(`${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, spec.width / 2, spec.height - 90);

        if (showSwipeArrow && isNotLast) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '700 20px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('SWIPE ➔', spec.width - 80, spec.height - 90);
        }
    }

    return canvas.toBuffer('image/png');
}
