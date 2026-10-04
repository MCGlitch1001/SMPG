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

const server = new Server(
    {
        name: 'smpg-agent-engine',
        version: '1.0.0'
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
                name: 'smpg_run_workflow',
                description: 'Execute an end-to-end SMPG workflow specification (JSON) to generate concepts, AI backgrounds, rendered typography slides, captions, and export images.',
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
                description: 'Fast convenience tool to generate social media carousels or reels for a specific topic, returning image paths and captions.',
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
                        quotes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional custom quotes. If omitted, quotes will be generated'
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
                        bgMode: {
                            type: 'string',
                            enum: ['image', 'color'],
                            default: 'image'
                        },
                        bgColor: {
                            type: 'string',
                            default: '#09090b'
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
                name: 'smpg_list_presets',
                description: 'List available vibe presets, color swatches, and typography font profiles.',
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
                    quotes: args.quotes || null,
                    bgMode: args.bgMode || 'image',
                    bgColor: args.bgColor || '#09090b'
                },
                theme: {
                    fontProfile: args.fontProfile || 'BigShoulders',
                    watermark: args.watermark || null
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
                            fontProfiles: FONT_PROFILES
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
