#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { executeWorkflow } from '../engine/workflow.js';
import { renderSlide } from '../engine/renderer.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../engine/presets.js';
import { getAgentHelp } from '../engine/help.js';
import { setApiKey, clearApiKey, resolveApiKey } from '../engine/config.js';
import { listCategories } from '../engine/database.js';

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

// Register Tool List
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
                        }
                    },
                    required: ['workflow']
                }
            },
            {
                name: 'smpg_generate_post',
                description: 'Fast convenience tool to generate social media carousels or reels. Supports AI generation, local database quotes, custom JSON quotes, AI backgrounds, plain colors, or custom images.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'Core topic or niche concept e.g. "Stoic discipline in chaos"'
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
                        imageUrl: {
                            type: 'string',
                            description: "Remote image URL if bgType is 'custom'"
                        },
                        imagePath: {
                            type: 'string',
                            description: "Local file path if bgType is 'custom'"
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
                        apiKey: {
                            type: 'string',
                            description: 'Optional Gemini API key override'
                        }
                    },
                    required: ['topic']
                }
            },
            {
                name: 'smpg_render_slide',
                description: 'Render a single slide with custom text quote, styling, and background color or image.',
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
                        fontProfile: {
                            type: 'string',
                            enum: ['BigShoulders', 'Outfit', 'Lora', 'GeistMono', 'Bricolage', 'Crimson'],
                            default: 'BigShoulders'
                        },
                        watermark: {
                            type: 'string',
                            description: 'Watermark tag'
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
                    content: [{ type: 'text', text: 'API key successfully stored inside app (.smpg_config.json).' }]
                };
            }
            if (args.action === 'clear') {
                clearApiKey();
                return {
                    content: [{ type: 'text', text: 'Stored API key cleared from app.' }]
                };
            }
            const key = resolveApiKey();
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
            const result = await executeWorkflow(args.workflow || {});
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
            const workflowSpec = {
                name: `Agent-${args.topic.slice(0, 20)}`,
                format: args.format || 'carousel',
                input: {
                    topic: args.topic,
                    numPosts: 1,
                    slidesPerPost: args.slidesPerPost || (args.format === 'reel' ? 1 : 3),
                    contentSource: args.contentSource,
                    dbCategory: args.dbCategory,
                    quotes: args.quotes || null,
                    bgType: args.bgType,
                    bgColor: args.bgColor || '#09090b',
                    imageUrl: args.imageUrl || null,
                    imagePath: args.imagePath || null
                },
                theme: {
                    fontProfile: args.fontProfile || 'BigShoulders',
                    watermark: args.watermark || null
                },
                generator: {
                    apiKey: args.apiKey || null
                },
                output: {
                    directory: './output',
                    saveImages: true,
                    generateCaptions: true
                }
            };

            const result = await executeWorkflow(workflowSpec);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        }

        if (name === 'smpg_render_slide') {
            const outputPath = args.outputPath || path.resolve(process.cwd(), `output/custom_slide_${Date.now()}.png`);
            const buffer = await renderSlide({
                quote: args.quote,
                bgResult: { type: 'color', color: args.bgColor || '#09090b' },
                mode: args.format || 'carousel',
                slideIndex: 0,
                totalSlides: 1,
                fontProfile: args.fontProfile || 'BigShoulders',
                watermark: args.watermark || null
            });

            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(outputPath, buffer);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            outputPath,
                            bytes: buffer.length
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
            const schemaPath = path.resolve(process.cwd(), 'schemas/workflow.schema.json');
            const schemaContent = fs.existsSync(schemaPath)
                ? JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))
                : { error: 'Schema file not found' };
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

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SMPG MCP Server started over stdio");
}

main().catch((err) => {
    console.error("Fatal error starting SMPG MCP server:", err);
    process.exit(1);
});
