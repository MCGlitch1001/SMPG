#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import defaultWorkflowSchema from '../engine/workflow-schema-data.js';
import { executeWorkflow } from '../engine/workflow.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../engine/presets.js';
import { getAgentHelp } from '../engine/help.js';
import { setApiKey, clearApiKey, resolveApiKey, resolveBaseUrl } from '../engine/config.js';
import { listCategories } from '../engine/database.js';

async function getDefaultRenderer() {
    const mod = await import(String('../engine/renderer.js'));
    return mod.renderSlide;
}

let SCHEMA_PATH = null;
let DEFAULT_OUTPUT_DIR = './output';
try {
    SCHEMA_PATH = fileURLToPath(new URL('../../schemas/workflow.schema.json', import.meta.url));
    DEFAULT_OUTPUT_DIR = process.env.OUTPUT_DIR || fileURLToPath(new URL('../../output', import.meta.url));
} catch {}

/**
 * Factory function to create an MCP Server instance with optional session-scoped API key and renderer.
 * Used for local stdio, Node Express SSE, and Cloudflare Pages Functions WebStandard HTTP.
 */
export function createSmpgMcpServer(defaultApiKey = null, customRenderer = null, defaultBaseUrl = null) {
    const server = new Server(
        {
            name: 'smpg-agent-engine',
            version: '2.0.0'
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Register all 8 tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: 'smpg_help',
                    description: 'Agent self-discovery tool: returns the complete guide, choices for content/database, choices for backgrounds, API key options, and command cheat sheet.',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'smpg_run_workflow',
                    description: 'Execute an end-to-end SMPG workflow specification (JSON) to generate concepts, backgrounds, rendered typography slides, captions, and export images.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            workflow: {
                                type: 'object',
                                description: 'Complete workflow object following smpg.workflow schema'
                            },
                            baseUrl: {
                                type: 'string',
                                description: 'Optional base URL override for direct image URLs (e.g. https://<project>.pages.dev)'
                            }
                        },
                        required: ['workflow']
                    }
                },
                {
                    name: 'smpg_generate_post',
                    description: 'Fast convenience tool to generate social media carousels or reels. Supports AI generation, local database quotes, custom JSON quotes, AI backgrounds, plain colors, or custom images. Returns slides with 5-minute direct image URLs.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topic: {
                                type: 'string',
                                description: 'Core topic or niche concept e.g. "Stoic discipline in chaos" (optional if contentSource is "db" or "json")'
                            },
                            format: {
                                type: 'string',
                                enum: ['carousel', 'reel'],
                                default: 'carousel',
                                description: 'Post format: square carousel (1:1) or vertical reel (9:16)'
                            },
                            slidesPerPost: {
                                type: 'integer',
                                minimum: 1,
                                maximum: 10,
                                default: 3,
                                description: 'Number of slides to generate for carousels'
                            },
                            contentSource: {
                                type: 'string',
                                enum: ['ai', 'json', 'db'],
                                default: 'ai',
                                description: "Choice for content: 'ai' (generate with Gemini), 'json' (pass quotes array), 'db' (load from local quote database)"
                            },
                            dbCategory: {
                                type: 'string',
                                description: "Category if contentSource is 'db' (e.g. 'stoicism', 'discipline', 'grind', 'dark_luxury')"
                            },
                            quotes: {
                                type: 'array',
                                items: { type: 'string' },
                                description: "Explicit quotes if contentSource is 'json'"
                            },
                            bgType: {
                                type: 'string',
                                enum: ['ai', 'plain', 'custom'],
                                default: 'ai',
                                description: "Choice for background: 'ai' (Pollinations Flux AI image), 'plain' (solid color), 'custom' (user supplied image)"
                            },
                            bgColor: {
                                type: 'string',
                                default: '#09090b',
                                description: "Hex color if bgType is 'plain'"
                            },
                            backgroundPrompt: {
                                type: 'string',
                                description: "Custom visual prompt for AI generated background when bgType is 'ai' (e.g. 'dark moody brutalist architecture, neon ambient lighting')"
                            },
                            imageUrl: {
                                type: 'string',
                                description: "Remote image URL if bgType is 'custom'"
                            },
                            imagePath: {
                                type: 'string',
                                description: "Local file path if bgType is 'custom'"
                            },
                            imageBase64: {
                                type: 'string',
                                description: "Custom background image as Base64 data URI string"
                            },
                            fontProfile: {
                                type: 'string',
                                enum: ['BigShoulders', 'Outfit', 'Lora', 'GeistMono', 'Bricolage', 'Crimson'],
                                default: 'BigShoulders'
                            },
                            watermark: {
                                type: 'string',
                                description: 'Handle/watermark displayed on slide e.g. @discipline.archive'
                            },
                            baseUrl: {
                                type: 'string',
                                description: 'Base URL for generating absolute direct image URLs (e.g. https://<project>.pages.dev or http://localhost:3000)'
                            },
                            returnBase64: {
                                type: 'boolean',
                                default: true,
                                description: 'Whether to include base64 image data URIs in slide results'
                            },
                            saveImages: {
                                type: 'boolean',
                                default: true,
                                description: 'Whether to save rendered PNG slides to disk'
                            },
                            apiKey: {
                                type: 'string',
                                description: 'Optional Gemini API key override'
                            }
                        }
                    }
                },
                {
                    name: 'smpg_get_image_url',
                    description: 'Instant zero-latency tool to create a 5-minute ephemeral direct image URL for a slide quote without waiting for rendering or disk writes. Returns a valid public image URL suitable for webhooks, auto-uploaders, and media previews.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            quote: {
                                type: 'string',
                                description: 'The quote text to typeset on the slide'
                            },
                            format: {
                                type: 'string',
                                enum: ['carousel', 'reel'],
                                default: 'carousel',
                                description: 'Post format: square carousel (1:1) or vertical reel (9:16)'
                            },
                            bgColor: {
                                type: 'string',
                                default: '#09090b',
                                description: "Hex background color (e.g. '#09090b')"
                            },
                            imageUrl: {
                                type: 'string',
                                description: 'Optional remote background image URL'
                            },
                            fontProfile: {
                                type: 'string',
                                enum: ['BigShoulders', 'Outfit', 'Lora', 'GeistMono', 'Bricolage', 'Crimson'],
                                default: 'BigShoulders',
                                description: 'Typography font profile'
                            },
                            watermark: {
                                type: 'string',
                                description: 'Watermark or brand tag e.g. @discipline.archive'
                            },
                            slideIndex: {
                                type: 'integer',
                                default: 0,
                                description: '0-indexed slide position'
                            },
                            totalSlides: {
                                type: 'integer',
                                default: 1,
                                description: 'Total number of slides in post'
                            },
                            baseUrl: {
                                type: 'string',
                                description: 'Optional base URL override (e.g. https://<project>.pages.dev or http://localhost:3000)'
                            }
                        },
                        required: ['quote']
                    }
                },
                {
                    name: 'smpg_render_slide',
                    description: 'Render a single slide with custom text quote, styling, and background color or image. Returns rendered buffer, base64, and a 5-minute direct image URL.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            quote: {
                                type: 'string',
                                description: 'The quote text to typeset on the slide'
                            },
                            format: {
                                type: 'string',
                                enum: ['carousel', 'reel'],
                                default: 'carousel'
                            },
                            bgColor: {
                                type: 'string',
                                default: '#09090b'
                            },
                            imageUrl: {
                                type: 'string',
                                description: 'Optional remote background image URL'
                            },
                            fontProfile: {
                                type: 'string',
                                enum: ['BigShoulders', 'Outfit', 'Lora', 'GeistMono', 'Bricolage', 'Crimson'],
                                default: 'BigShoulders'
                            },
                            watermark: {
                                type: 'string',
                                description: 'Watermark tag'
                            },
                            baseUrl: {
                                type: 'string',
                                description: 'Base URL for generating absolute direct image URLs (e.g. https://<project>.pages.dev)'
                            },
                            outputPath: {
                                type: 'string',
                                description: 'Target filepath to save rendered PNG'
                            }
                        },
                        required: ['quote']
                    }
                },
                {
                    name: 'smpg_manage_config',
                    description: 'Store, check, or clear the Gemini API key inside the app configuration.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            action: {
                                type: 'string',
                                enum: ['get', 'set', 'clear'],
                                description: 'Action to perform'
                            },
                            apiKey: {
                                type: 'string',
                                description: "The Gemini API key to save (required for 'set')"
                            }
                        },
                        required: ['action']
                    }
                },
                {
                    name: 'smpg_list_presets',
                    description: 'List available vibe presets, database categories, color swatches, and typography font profiles.',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'smpg_get_schema',
                    description: 'Get the full JSON Schema for SMPG workflow specifications.',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                }
            ]
        };
    });

    // Tool Handlers
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            if (name === 'smpg_help') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(getAgentHelp(), null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_manage_config') {
                if (args.action === 'set') {
                    setApiKey(args.apiKey);
                    return {
                        content: [{ type: 'text', text: 'API key successfully stored inside app configuration.' }]
                    };
                }
                if (args.action === 'clear') {
                    clearApiKey();
                    return {
                        content: [{ type: 'text', text: 'Stored API key cleared from app.' }]
                    };
                }
                const key = defaultApiKey || resolveApiKey();
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            hasApiKey: Boolean(key),
                            maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null
                        }, null, 2)
                    }]
                };
            }

            if (name === 'smpg_run_workflow') {
                const workflow = args.workflow || {};
                const resolvedBaseUrl = resolveBaseUrl(args.baseUrl || workflow.baseUrl || defaultBaseUrl);
                if (!workflow.generator) workflow.generator = {};
                if (!workflow.generator.apiKey && defaultApiKey) {
                    workflow.generator.apiKey = defaultApiKey;
                }
                const result = await executeWorkflow(workflow, { baseUrl: resolvedBaseUrl, customRenderer });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_generate_post') {
                const resolvedTopic = args.topic || args.dbCategory || (args.quotes && args.quotes[0]) || VIBE_PRESETS[0];
                const resolvedBaseUrl = resolveBaseUrl(args.baseUrl || defaultBaseUrl);

                const workflowSpec = {
                    name: `Agent-${resolvedTopic.slice(0, 20)}`,
                    format: args.format || 'carousel',
                    baseUrl: resolvedBaseUrl,
                    input: {
                        topic: resolvedTopic,
                        numPosts: 1,
                        slidesPerPost: args.slidesPerPost || (args.format === 'reel' ? 1 : 3),
                        contentSource: args.contentSource,
                        dbCategory: args.dbCategory,
                        quotes: args.quotes || null,
                        bgType: args.bgType,
                        bgColor: args.bgColor || '#09090b',
                        backgroundPrompt: args.backgroundPrompt || null,
                        imageUrl: args.imageUrl || null,
                        imagePath: args.imagePath || null,
                        imageBase64: args.imageBase64 || null
                    },
                    theme: {
                        fontProfile: args.fontProfile || 'BigShoulders',
                        watermark: args.watermark || null
                    },
                    generator: {
                        apiKey: args.apiKey || defaultApiKey || null
                    },
                    output: {
                        directory: DEFAULT_OUTPUT_DIR,
                        saveImages: args.saveImages !== false,
                        generateCaptions: true,
                        returnBase64: args.returnBase64 !== undefined ? Boolean(args.returnBase64) : true
                    }
                };

                const result = await executeWorkflow(workflowSpec, { baseUrl: resolvedBaseUrl, customRenderer });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_get_image_url') {
                const resolvedBaseUrl = resolveBaseUrl(args.baseUrl || defaultBaseUrl);
                const expTimestamp = Date.now() + 5 * 60 * 1000;
                const slidePayload = {
                    q: args.quote || '',
                    bg: args.bgColor || '#09090b',
                    u: args.imageUrl || null,
                    m: args.format || 'carousel',
                    i: args.slideIndex || 0,
                    t: args.totalSlides || 1,
                    f: args.fontProfile || 'BigShoulders',
                    w: args.watermark || null,
                    exp: expTimestamp
                };

                const payloadB64 = Buffer.from(JSON.stringify(slidePayload)).toString('base64url');
                const relativeUrl = `/i/s_${payloadB64}.png`;
                const directImageUrl = resolvedBaseUrl ? `${resolvedBaseUrl}${relativeUrl}` : relativeUrl;

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                directImageUrl,
                                url: directImageUrl,
                                relativeUrl,
                                quote: args.quote,
                                format: args.format || 'carousel',
                                fontProfile: args.fontProfile || 'BigShoulders',
                                expiresAt: new Date(expTimestamp).toISOString(),
                                expiresInSeconds: 300
                            }, null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_render_slide') {
                const resolvedBaseUrl = resolveBaseUrl(args.baseUrl || defaultBaseUrl);
                const renderFn = customRenderer || (await getDefaultRenderer());
                const bgResult = args.imageUrl
                    ? { type: 'image', url: args.imageUrl }
                    : { type: 'color', color: args.bgColor || '#09090b' };

                const renderResult = await renderFn({
                    quote: args.quote,
                    bgResult,
                    mode: args.format || 'carousel',
                    slideIndex: args.slideIndex || 0,
                    totalSlides: args.totalSlides || 1,
                    fontProfile: args.fontProfile || 'BigShoulders',
                    watermark: args.watermark || null
                });

                let buffer = renderResult?.buffer || renderResult;
                let base64 = renderResult?.base64;
                if (!base64 && (Buffer.isBuffer(buffer) || buffer instanceof Uint8Array)) {
                    base64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
                }

                let outputPath = null;
                if (args.outputPath) {
                    outputPath = path.isAbsolute(args.outputPath) ? args.outputPath : path.resolve(args.outputPath);
                    try {
                        const dir = path.dirname(outputPath);
                        if (typeof fs !== 'undefined' && fs.existsSync && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        if (typeof fs !== 'undefined' && fs.writeFileSync) fs.writeFileSync(outputPath, buffer);
                    } catch {}
                }

                const slidePayload = {
                    q: args.quote || '',
                    bg: args.bgColor || '#09090b',
                    u: args.imageUrl || null,
                    m: args.format || 'carousel',
                    i: args.slideIndex || 0,
                    t: args.totalSlides || 1,
                    f: args.fontProfile || 'BigShoulders',
                    w: args.watermark || null,
                    exp: Date.now() + 5 * 60 * 1000
                };
                let directUrl = null;
                let relativeUrl = null;
                try {
                    const payloadB64 = Buffer.from(JSON.stringify(slidePayload)).toString('base64url');
                    relativeUrl = `/i/s_${payloadB64}.png`;
                    directUrl = resolvedBaseUrl ? `${resolvedBaseUrl}${relativeUrl}` : relativeUrl;
                } catch {}

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                outputPath,
                                url: directUrl,
                                directImageUrl: directUrl,
                                relativeUrl,
                                bytes: buffer?.length || 0,
                                base64
                            }, null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_list_presets') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                vibePresets: VIBE_PRESETS,
                                colorPalette: PRO_PALETTE,
                                fontProfiles: FONT_PROFILES,
                                dbCategories: listCategories()
                            }, null, 2)
                        }
                    ]
                };
            }

            if (name === 'smpg_get_schema') {
                let schemaContent = defaultWorkflowSchema;
                if (SCHEMA_PATH) {
                    try {
                        if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(SCHEMA_PATH)) {
                            schemaContent = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
                        }
                    } catch {}
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(schemaContent, null, 2)
                        }
                    ]
                };
            }

            throw new Error(`Unknown tool: ${name}`);
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
                    }
                ],
                isError: true
            };
        }
    });

    return server;
}

/**
 * Start standard input/output MCP server for local agents
 */
export async function startStdioServer() {
    const server = createSmpgMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SMPG MCP Server started over stdio");
}

let isDirectExecution = false;
try {
    isDirectExecution = process.argv[1] && (
        fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
        process.argv[1].endsWith('smpg.js') ||
        process.argv[1].endsWith('smpg')
    );
} catch {}

if (isDirectExecution) {
    startStdioServer().catch((err) => {
        console.error("Fatal error starting SMPG MCP server:", err);
        process.exit(1);
    });
}
