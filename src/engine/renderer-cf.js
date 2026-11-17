import './cf-polyfill.js';
import { satori } from '@cf-wasm/satori';
import { Resvg } from '@cf-wasm/resvg';
import { FORMAT_SPECS, FONT_PROFILES } from './presets.js';

// In-memory font cache across Cloudflare Worker isolate invocations
const fontCache = new Map();

/**
 * Fetch or load font binary as ArrayBuffer
 */
async function loadFontWithCache(fontFileName, fontLoader) {
    if (fontCache.has(fontFileName)) {
        return fontCache.get(fontFileName);
    }

    let fontData = null;

    if (typeof fontLoader === 'function') {
        fontData = await fontLoader(fontFileName);
    } else {
        // Fallback for Node.js environments (tests / hybrid)
        try {
            const fs = await import('fs');
            const path = await import('path');
            const localPath = path.resolve('assets/fonts', fontFileName);
            if (fs.existsSync(localPath)) {
                const buf = fs.readFileSync(localPath);
                fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            }
        } catch {
            // fs unavailable in pure Cloudflare Workers
        }
    }

    if (fontData) {
        fontCache.set(fontFileName, fontData);
    }
    return fontData;
}

/**
 * Cloudflare Pages Functions WebAssembly slide renderer
 * Uses Satori + @cf-wasm/resvg without Node.js N-API dependencies
 */
export async function renderSlideCF({
    quote = "",
    bgResult = { type: 'color', color: '#09090b' },
    mode = "carousel",
    slideIndex = 0,
    totalSlides = 1,
    fontProfile = "BigShoulders",
    customFontSize = null,
    watermark = null,
    showSwipeArrow = true,
    fontLoader = null
}) {
    const spec = FORMAT_SPECS[mode] || FORMAT_SPECS.carousel;
    const profile = FONT_PROFILES[fontProfile] || FONT_PROFILES["BigShoulders"];
    const primaryFontFile = profile.file || 'BigShoulders-Bold.ttf';
    const primaryFontFamily = profile.family || 'BigShoulders';

    // 1. Load Primary Font (cached across invocations)
    const primaryFontData = await loadFontWithCache(primaryFontFile, fontLoader);

    const satoriFonts = [];
    if (primaryFontData) {
        satoriFonts.push({
            name: primaryFontFamily,
            data: primaryFontData,
            weight: 900,
            style: 'normal'
        });
    }

    // 2. Prepare Background
    const hasImageBg = bgResult.type === 'image' && (bgResult.buffer || bgResult.base64 || bgResult.source || bgResult.url);
    let imageSrc = null;

    if (hasImageBg) {
        if (bgResult.base64) {
            imageSrc = bgResult.base64;
        } else if (bgResult.buffer) {
            const base64Str = typeof Buffer !== 'undefined'
                ? Buffer.from(bgResult.buffer).toString('base64')
                : btoa(String.fromCharCode(...new Uint8Array(bgResult.buffer)));
            imageSrc = `data:image/png;base64,${base64Str}`;
        } else if (bgResult.url || bgResult.source) {
            imageSrc = bgResult.url || bgResult.source;
        }
    }

    const fontSize = customFontSize || spec.defaultFontSize;
    const quoteText = (quote || "").toUpperCase();

    // 3. Build Satori Virtual DOM
    const children = [];

    // Background Image & Dimming Overlay
    if (hasImageBg && imageSrc) {
        children.push({
            type: 'img',
            props: {
                src: imageSrc,
                style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                }
            }
        });
        children.push({
            type: 'div',
            props: {
                style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)'
                }
            }
        });
    }

    // Watermark
    if (watermark) {
        children.push({
            type: 'div',
            props: {
                style: {
                    position: 'absolute',
                    top: 70,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase'
                },
                children: watermark.toUpperCase()
            }
        });
    }

    // Giant Quotation Mark Decoration
    children.push({
        type: 'div',
        props: {
            style: {
                position: 'absolute',
                top: mode === 'reel' ? 240 : 130,
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                fontFamily: 'serif',
                fontSize: mode === 'reel' ? 280 : 250,
                fontWeight: 900,
                color: 'rgba(255, 255, 255, 0.12)'
            },
            children: '“'
        }
    });

    // Main Quote Typography
    children.push({
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: primaryFontFamily,
                fontSize,
                fontWeight: 900,
                color: '#ffffff',
                textAlign: 'center',
                lineHeight: 1.25,
                textShadow: '0 8px 24px rgba(0, 0, 0, 0.95)',
                maxWidth: spec.maxTextWidth,
                wordBreak: 'break-word',
                padding: '0 20px'
            },
            children: quoteText
        }
    });

    // Slide indicator & swipe arrow for carousels
    if (mode === 'carousel') {
        const slideCounter = `${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
        children.push({
            type: 'div',
            props: {
                style: {
                    position: 'absolute',
                    bottom: 70,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.35)',
                    letterSpacing: '0.05em'
                },
                children: slideCounter
            }
        });

        if (showSwipeArrow && slideIndex < totalSlides - 1) {
            children.push({
                type: 'div',
                props: {
                    style: {
                        position: 'absolute',
                        bottom: 70,
                        right: 80,
                        display: 'flex',
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'rgba(255, 255, 255, 0.7)',
                        letterSpacing: '0.05em'
                    },
                    children: 'SWIPE ➔'
                }
            });
        }
    }

    const rootElement = {
        type: 'div',
        props: {
            style: {
                width: spec.width,
                height: spec.height,
                backgroundColor: hasImageBg ? '#09090b' : (bgResult.color || '#09090b'),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            },
            children
        }
    };

    // 4. Render to SVG
    const svg = await satori(rootElement, {
        width: spec.width,
        height: spec.height,
        fonts: satoriFonts
    });

    // 5. Convert SVG to PNG Buffer via Resvg WebAssembly
    const resvg = await Resvg.async(svg);
    const pngBuffer = resvg.render().asPng();

    const base64Str = typeof Buffer !== 'undefined'
        ? Buffer.from(pngBuffer).toString('base64')
        : btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));

    const base64 = `data:image/png;base64,${base64Str}`;
    const fileName = `slide_${slideIndex + 1}.png`;

    return {
        buffer: pngBuffer,
        base64,
        fileName,
        length: pngBuffer.length
    };
}
