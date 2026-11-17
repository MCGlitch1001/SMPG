import '../src/engine/cf-polyfill.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSmpgMcpServer } from '../src/mcp/server.js';
import { renderSlideCF } from '../src/engine/renderer-cf.js';
import { executeWorkflow } from '../src/engine/workflow.js';
import { getAgentHelp } from '../src/engine/help.js';
import { listCategories } from '../src/engine/database.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../src/engine/presets.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-smpg-token, x-gemini-api-key, Accept, MCP-Protocol-Version',
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
    const queryToken = url.searchParams.get('token');
    if (queryToken && queryToken.trim() === expectedToken.trim()) {
        return true;
    }

    const customHeader = request.headers.get('x-smpg-token');
    if (customHeader && customHeader.trim() === expectedToken.trim()) {
        return true;
    }

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

    if (!env.SMPG_AUTH_TOKEN) {
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            const match = authHeader.match(/^Bearer\s+(.+)$/i);
            if (match && match[1]?.trim()) return match[1].trim();
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

    if (!isApiRoute && !isMcpRoute) {
        return env.ASSETS.fetch(request);
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
            message: 'Invalid or missing SMPG authentication token. Supply token via Authorization: Bearer <TOKEN>, x-smpg-token header, or ?token=<TOKEN>'
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
    // MCP Remote Endpoint (/mcp)
    // ==========================================
    if (isMcpRoute) {
        const server = createSmpgMcpServer(geminiKey, customRenderer);
        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode for Cloudflare
            enableJsonResponse: true
        });

        await server.connect(transport);

        // Normalize Accept header so standard curl and MCP clients succeed with JSON or SSE
        let reqForMcp = request;
        const accept = request.headers.get('accept') || '';
        if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
            const newHeaders = new Headers(request.headers);
            newHeaders.set('accept', 'application/json, text/event-stream');
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

            return jsonResponse({
                success: true,
                fileName: renderResult.fileName,
                base64: renderResult.base64
            });
        } catch (err) {
            console.error('[Cloudflare /api/render Error]:', err);
            return jsonResponse({ success: false, error: err.message }, 500);
        }
    }

    return jsonResponse({ error: 'Not Found', path: pathname }, 404);
}
