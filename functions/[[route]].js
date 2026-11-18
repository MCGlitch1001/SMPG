import '../src/engine/cf-polyfill.js';
import { Buffer } from 'node:buffer';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSmpgMcpServer } from '../src/mcp/server.js';
import { renderSlideCF } from '../src/engine/renderer-cf.js';
import { executeWorkflow } from '../src/engine/workflow.js';
import { getAgentHelp } from '../src/engine/help.js';
import { listCategories } from '../src/engine/database.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../src/engine/presets.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

function validateAuth(request, env) {
    const expectedToken = env.SMPG_AUTH_TOKEN;
    if (!expectedToken || !expectedToken.trim()) {
        return true;
    }

    const url = new URL(request.url);

    // 1. Path-based token: /mcp/<TOKEN>
    if (url.pathname.startsWith('/mcp/')) {
        const pathSegments = url.pathname.slice(5).split('/').filter(Boolean);
        const pathToken = pathSegments[0];
        if (pathToken && pathToken.trim() === expectedToken.trim()) {
            return true;
        }
    }

    // 2. Query parameter: ?token=<TOKEN>
    const queryToken = url.searchParams.get('token');
    if (queryToken && queryToken.trim() === expectedToken.trim()) {
        return true;
    }

    // 3. Custom header: x-smpg-token: <TOKEN>
    const customHeader = request.headers.get('x-smpg-token');
    if (customHeader && customHeader.trim() === expectedToken.trim()) {
        return true;
    }

    // 4. Authorization: Bearer <TOKEN>
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1]?.trim() === expectedToken.trim()) {
            return true;
        }
    }

    return false;
}

function extractGeminiApiKey(request, env) {
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get('apiKey');
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();

    const fromHeader = request.headers.get('x-gemini-api-key');
    if (fromHeader && fromHeader.trim()) return fromHeader.trim();

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1]?.trim() && match[1].trim() !== env.SMPG_AUTH_TOKEN?.trim()) {
            return match[1].trim();
        }
    }

    if (env.GEMINI_API_KEY && typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim()) {
        return env.GEMINI_API_KEY.trim();
    }

    return null;
}

function createCloudflareFontLoader(env) {
    return async (fontFileName) => {
        try {
            const fontUrl = fontFileName.endsWith('.wasm')
                ? `https://assets.local/assets/${fontFileName}`
                : `https://assets.local/assets/fonts/${fontFileName}`;
            const res = await env.ASSETS.fetch(fontUrl);
            if (!res.ok) {
                console.warn(`[AssetLoader] Could not fetch ${fontFileName} from env.ASSETS: ${res.status}`);
                return null;
            }
            return await res.arrayBuffer();
        } catch (err) {
            console.error(`[AssetLoader] Error fetching ${fontFileName}:`, err);
            return null;
        }
    };
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight for all endpoints
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Pass static assets and client-side SPA routes straight to Cloudflare Pages Assets
    const isApiRoute = pathname.startsWith('/api');
    const isMcpRoute = pathname === '/mcp' || pathname.startsWith('/mcp/');
    const isImageRoute = pathname.startsWith('/i/') || pathname.startsWith('/output/');

    if (!isApiRoute && !isMcpRoute && !isImageRoute) {
        return env.ASSETS.fetch(request);
    }

    // ==========================================
    // Public Ephemeral Image Delivery (/i/* and /output/*)
    // 100% Free - 5-min TTL for Instagram Auto-Uploaders & Webhooks
    // ==========================================
    if (isImageRoute && request.method === 'GET') {
        const cache = typeof caches !== 'undefined' ? caches.default : null;

        // 1. Check Cloudflare Edge Cache first
        if (cache) {
            try {
                const cached = await cache.match(request.url);
                if (cached) {
                    return cached;
                }
            } catch {}
        }

        // 2. Check KV Storage if bound
        const idWithExt = pathname.split('/').pop() || '';
        const rawId = idWithExt.replace(/\.(png|jpg|jpeg|webp)$/i, '');

        if (env.SMPG_KV) {
            try {
                const kvBuffer = await env.SMPG_KV.get(rawId, 'arrayBuffer');
                if (kvBuffer) {
                    return new Response(kvBuffer, {
                        status: 200,
                        headers: {
                            'Content-Type': 'image/png',
                            'Content-Length': String(kvBuffer.byteLength),
                            'Cache-Control': 'public, max-age=300, s-maxage=300',
                            ...corsHeaders
                        }
                    });
                }
            } catch {}
        }

        // 3. Fallback: Self-Contained Encoded Slide Payload (s_<base64url>)
        if (rawId.startsWith('s_')) {
            try {
                const payloadJson = Buffer.from(rawId.slice(2), 'base64url').toString('utf-8');
                const p = JSON.parse(payloadJson);

                // Enforce 5-minute TTL (with 60-second grace buffer)
                if (p.exp && Date.now() > p.exp + 60000) {
                    return jsonResponse({
                        error: 'Image Expired',
                        message: 'This direct image URL was valid for 5 minutes and has expired. Generate a fresh image for your auto-upload workflow.'
                    }, 410);
                }

                const fontLoader = createCloudflareFontLoader(env);
                const renderRes = await renderSlideCF({
                    quote: p.q || '',
                    bgResult: p.u ? { type: 'image', url: p.u } : { type: 'color', color: p.bg || '#09090b' },
                    mode: p.m || 'carousel',
                    slideIndex: p.i || 0,
                    totalSlides: p.t || 1,
                    fontProfile: p.f || 'BigShoulders',
                    watermark: p.w || null,
                    fontLoader
                });

                if (renderRes?.buffer) {
                    const imgResp = new Response(renderRes.buffer, {
                        status: 200,
                        headers: {
                            'Content-Type': 'image/png',
                            'Content-Length': String(renderRes.buffer.byteLength || renderRes.buffer.length),
                            'Cache-Control': 'public, max-age=300, s-maxage=300',
                            ...corsHeaders
                        }
                    });

                    // Cache in Cloudflare Edge Cache for subsequent crawler hits
                    if (cache && context.waitUntil) {
                        context.waitUntil(cache.put(request.url, imgResp.clone()));
                    }

                    return imgResp;
                }
            } catch (err) {
                console.error('[ImageRoute Error]:', err);
            }
        }

        return jsonResponse({
            error: 'Image Not Found',
            message: 'Image does not exist or has expired.'
        }, 404);
    }

    // 1. Healthcheck is always open without token
    if (pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({
            status: 'ok',
            service: 'SMPG Serverless Engine',
            version: '2.0.0',
            platform: 'Cloudflare Pages Functions (WebAssembly + Satori)',
            timestamp: new Date().toISOString()
        });
    }

    // 2. Token-Based Authentication Guard (SMPG_AUTH_TOKEN)
    if (!validateAuth(request, env)) {
        return jsonResponse({
            error: 'Unauthorized',
            message: 'Invalid or missing SMPG authentication token. Supply token via /mcp/<TOKEN>, Authorization: Bearer <TOKEN>, x-smpg-token header, or ?token=<TOKEN>'
        }, 401);
    }

    // Font Loader & WebAssembly Satori Renderer
    const fontLoader = createCloudflareFontLoader(env);
    const customRenderer = (params) => renderSlideCF({
        ...params,
        fontLoader: params.fontLoader || fontLoader
    });

    const geminiKey = extractGeminiApiKey(request, env);

    // ==========================================
    // MCP Remote Endpoint (/mcp or /mcp/<TOKEN>)
    // ==========================================
    if (isMcpRoute) {
        // Handle GET probes (Gemini / SSE verification)
        if (request.method === 'GET') {
            const endpointPath = url.pathname + (url.search || '');
            const ssePayload = `: connected\n\nevent: endpoint\ndata: ${endpointPath}\n\n`;
            return new Response(ssePayload, {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    ...corsHeaders
                }
            });
        }

        const server = createSmpgMcpServer(geminiKey, customRenderer);
        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode for Cloudflare
            enableJsonResponse: true
        });

        await server.connect(transport);

        // Normalize missing, wildcard, or restricted Accept / Content-Type headers for MCP clients
        let reqForMcp = request;
        const accept = request.headers.get('accept') || '';
        const contentType = request.headers.get('content-type') || '';
        const needsAcceptFix = !accept.includes('application/json') || !accept.includes('text/event-stream');
        const needsContentTypeFix = request.method === 'POST' && !contentType.includes('application/json');

        if (needsAcceptFix || needsContentTypeFix) {
            const newHeaders = new Headers(request.headers);
            if (needsAcceptFix) {
                newHeaders.set('accept', 'application/json, text/event-stream');
            }
            if (needsContentTypeFix) {
                newHeaders.set('content-type', 'application/json');
            }
            reqForMcp = new Request(request, { headers: newHeaders });
        }

        const response = await transport.handleRequest(reqForMcp);
        const finalHeaders = new Headers(response.headers);
        for (const [key, val] of Object.entries(corsHeaders)) {
            finalHeaders.set(key, val);
        }

        return new Response(response.body, {
            status: response.status,
            headers: finalHeaders
        });
    }

    // ==========================================
    // REST API Endpoints (/api/*)
    // ==========================================

    // Self-Discovery Guide
    if (pathname === '/api/help' && request.method === 'GET') {
        const help = getAgentHelp();
        return jsonResponse(help);
    }

    // Presets & Palette
    if (pathname === '/api/presets' && request.method === 'GET') {
        return jsonResponse({
            vibePresets: VIBE_PRESETS,
            colorPalette: PRO_PALETTE,
            fontProfiles: FONT_PROFILES,
            dbCategories: listCategories()
        });
    }

    // Database Categories
    if (pathname === '/api/db/categories' && request.method === 'GET') {
        return jsonResponse({
            categories: listCategories()
        });
    }

    // Config Status
    if (pathname === '/api/config' && request.method === 'GET') {
        return jsonResponse({
            hasApiKey: Boolean(geminiKey),
            maskedKey: geminiKey ? `${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)}` : null
        });
    }

    // Streamlined Generation Endpoint (/api/generate)
    if (pathname === '/api/generate' && request.method === 'POST') {
        try {
            const body = await request.json().catch(() => ({}));
            const resolvedFormat = (body.format || body.mode || 'carousel').toLowerCase() === 'reel' ? 'reel' : 'carousel';
            const apiKey = body.apiKey || geminiKey;

            const workflowSpec = {
                name: `CF-Generation-${Date.now()}`,
                format: resolvedFormat,
                input: {
                    contentSource: body.contentSource,
                    dbCategory: body.dbCategory,
                    topic: body.topic,
                    numPosts: 1,
                    slidesPerPost: resolvedFormat === 'reel' ? 1 : (body.slidesCount || 3),
                    quotes: body.quotes,
                    bgType: body.bgType || body.bgMode,
                    bgColor: body.bgColor || '#09090b',
                    backgroundPrompt: body.backgroundPrompt,
                    imageUrl: body.imageUrl,
                    imagePath: body.imagePath,
                    imageBase64: body.imageBase64
                },
                theme: {
                    fontProfile: body.fontProfile || 'BigShoulders',
                    watermark: body.watermark
                },
                generator: {
                    apiKey
                },
                output: {
                    saveImages: false,
                    returnBase64: true,
                    generateCaptions: true
                }
            };

            const result = await executeWorkflow(workflowSpec, {
                baseUrl: url.origin,
                customRenderer,
                fontLoader
            });

            // Attach 5-minute direct public image URLs for auto-uploaders
            const cache = typeof caches !== 'undefined' ? caches.default : null;
            for (const post of result.posts || []) {
                for (const slide of post.slides || []) {
                    const slidePayload = {
                        q: slide.quote,
                        bg: post.backgroundSource || '#09090b',
                        u: post.backgroundType === 'image' && typeof post.backgroundSource === 'string' && post.backgroundSource.startsWith('http') ? post.backgroundSource : null,
                        m: post.mode || 'carousel',
                        i: (slide.slideIndex || 1) - 1,
                        t: post.slides.length,
                        f: workflowSpec.theme?.fontProfile || 'BigShoulders',
                        w: workflowSpec.theme?.watermark || null,
                        exp: Date.now() + 5 * 60 * 1000 // 5 minutes TTL
                    };
                    const payloadB64 = Buffer.from(JSON.stringify(slidePayload)).toString('base64url');
                    const directUrl = `${url.origin}/i/s_${payloadB64}.png`;
                    slide.url = directUrl;
                    slide.directImageUrl = directUrl;

                    if (slide.base64 && cache && context.waitUntil) {
                        try {
                            const rawBytes = Uint8Array.from(atob(slide.base64.replace(/^data:image\/png;base64,/, '')), c => c.charCodeAt(0));
                            const imgResp = new Response(rawBytes, {
                                status: 200,
                                headers: {
                                    'Content-Type': 'image/png',
                                    'Content-Length': String(rawBytes.length),
                                    'Cache-Control': 'public, max-age=300, s-maxage=300',
                                    ...corsHeaders
                                }
                            });
                            context.waitUntil(cache.put(directUrl, imgResp.clone()));
                            const outUrl = `${url.origin}/output/${slide.fileName}`;
                            context.waitUntil(cache.put(outUrl, imgResp.clone()));
                        } catch {}
                    }
                }
            }

            return jsonResponse(result);
        } catch (err) {
            console.error('[Cloudflare /api/generate Error]:', err);
            return jsonResponse({ success: false, error: err.message, stack: err.stack }, 500);
        }
    }

    // Workflow Run (/api/workflow/run)
    if (pathname === '/api/workflow/run' && request.method === 'POST') {
        try {
            const body = await request.json().catch(() => ({}));
            const workflowSpec = body.workflow || body;

            if (!workflowSpec.generator) workflowSpec.generator = {};
            if (!workflowSpec.generator.apiKey && geminiKey) {
                workflowSpec.generator.apiKey = geminiKey;
            }
            if (!workflowSpec.output) workflowSpec.output = {};
            workflowSpec.output.saveImages = false;
            workflowSpec.output.returnBase64 = true;

            const result = await executeWorkflow(workflowSpec, {
                baseUrl: url.origin,
                customRenderer,
                fontLoader
            });

            // Attach 5-minute direct public image URLs
            const cache = typeof caches !== 'undefined' ? caches.default : null;
            for (const post of result.posts || []) {
                for (const slide of post.slides || []) {
                    const slidePayload = {
                        q: slide.quote,
                        bg: post.backgroundSource || '#09090b',
                        u: post.backgroundType === 'image' && typeof post.backgroundSource === 'string' && post.backgroundSource.startsWith('http') ? post.backgroundSource : null,
                        m: post.mode || 'carousel',
                        i: (slide.slideIndex || 1) - 1,
                        t: post.slides.length,
                        f: workflowSpec.theme?.fontProfile || 'BigShoulders',
                        w: workflowSpec.theme?.watermark || null,
                        exp: Date.now() + 5 * 60 * 1000 // 5 minutes TTL
                    };
                    const payloadB64 = Buffer.from(JSON.stringify(slidePayload)).toString('base64url');
                    const directUrl = `${url.origin}/i/s_${payloadB64}.png`;
                    slide.url = directUrl;
                    slide.directImageUrl = directUrl;

                    if (slide.base64 && cache && context.waitUntil) {
                        try {
                            const rawBytes = Uint8Array.from(atob(slide.base64.replace(/^data:image\/png;base64,/, '')), c => c.charCodeAt(0));
                            const imgResp = new Response(rawBytes, {
                                status: 200,
                                headers: {
                                    'Content-Type': 'image/png',
                                    'Content-Length': String(rawBytes.length),
                                    'Cache-Control': 'public, max-age=300, s-maxage=300',
                                    ...corsHeaders
                                }
                            });
                            context.waitUntil(cache.put(directUrl, imgResp.clone()));
                            const outUrl = `${url.origin}/output/${slide.fileName}`;
                            context.waitUntil(cache.put(outUrl, imgResp.clone()));
                        } catch {}
                    }
                }
            }

            return jsonResponse(result);
        } catch (err) {
            console.error('[Cloudflare /api/workflow/run Error]:', err);
            return jsonResponse({ success: false, error: err.message }, 500);
        }
    }

    // Single Slide Render (/api/render)
    if (pathname === '/api/render' && request.method === 'POST') {
        try {
            const body = await request.json().catch(() => ({}));
            const renderResult = await customRenderer({
                quote: body.quote || "EXECUTE IN SILENCE.",
                bgResult: { type: 'color', color: body.bgColor || '#09090b' },
                mode: body.format || "carousel",
                slideIndex: 0,
                totalSlides: 1,
                fontProfile: body.fontProfile || "BigShoulders",
                watermark: body.watermark || null
            });

            const slidePayload = {
                q: body.quote || "EXECUTE IN SILENCE.",
                bg: body.bgColor || '#09090b',
                u: body.imageUrl || null,
                m: body.format || "carousel",
                i: 0,
                t: 1,
                f: body.fontProfile || "BigShoulders",
                w: body.watermark || null,
                exp: Date.now() + 5 * 60 * 1000
            };
            const payloadB64 = Buffer.from(JSON.stringify(slidePayload)).toString('base64url');
            const directUrl = `${url.origin}/i/s_${payloadB64}.png`;

            const cache = typeof caches !== 'undefined' ? caches.default : null;
            if (renderResult?.base64 && cache && context.waitUntil) {
                try {
                    const rawBytes = Uint8Array.from(atob(renderResult.base64.replace(/^data:image\/png;base64,/, '')), c => c.charCodeAt(0));
                    const imgResp = new Response(rawBytes, {
                        status: 200,
                        headers: {
                            'Content-Type': 'image/png',
                            'Content-Length': String(rawBytes.length),
                            'Cache-Control': 'public, max-age=300, s-maxage=300',
                            ...corsHeaders
                        }
                    });
                    context.waitUntil(cache.put(directUrl, imgResp.clone()));
                } catch {}
            }

            return jsonResponse({
                success: true,
                fileName: renderResult.fileName,
                url: directUrl,
                directImageUrl: directUrl,
                base64: renderResult.base64
            });
        } catch (err) {
            console.error('[Cloudflare /api/render Error]:', err);
            return jsonResponse({ success: false, error: err.message }, 500);
        }
    }

    return jsonResponse({ error: 'Not Found', path: pathname }, 404);
}
