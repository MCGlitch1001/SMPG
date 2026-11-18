import { VIBE_PRESETS, FONT_PROFILES, PRO_PALETTE } from './presets.js';
import { listCategories } from './database.js';

export function getAgentHelp() {
    return {
        title: "SMPG Agent Engine - Integration & Execution Guide",
        description: "Unified Social Media Post Generator & Declarative Workflow Engine designed for Human Web UI, AI Agents (Hermes Agent, Claude, Antigravity), and N8N with Dual MCP (stdio + remote SSE) and REST API.",
        
        choices: {
            contentSource: {
                description: "Choose how quotes/text are sourced",
                options: [
                    {
                        name: "ai",
                        usage: '{"input": {"contentSource": "ai", "topic": "Stoic grit"}}',
                        details: "Generates high-impact quotes via Gemini API. Uses per-request key, stored API key, or env key."
                    },
                    {
                        name: "json",
                        usage: '{"input": {"contentSource": "json", "quotes": ["QUOTE 1", "QUOTE 2"]}}',
                        details: "Directly supplies custom quotes in JSON. Requires ZERO API key."
                    },
                    {
                        name: "db",
                        usage: '{"input": {"contentSource": "db", "dbCategory": "stoicism", "slidesPerPost": 3}}',
                        details: "Loads curated quotes from local JSON database. Requires ZERO API key."
                    }
                ],
                availableDbCategories: listCategories()
            },
            backgroundType: {
                description: "Choose background visuals for slides",
                options: [
                    {
                        name: "ai",
                        usage: '{"input": {"bgType": "ai", "backgroundPrompt": "dark marble palace in mist"}}',
                        details: "Generates dark aesthetic cinematic backgrounds using Pollinations Flux engine."
                    },
                    {
                        name: "plain",
                        usage: '{"input": {"bgType": "plain", "bgColor": "#09090b"}}',
                        details: "Renders on solid dark minimalist color swatch (e.g. #09090b, #18181b)."
                    },
                    {
                        name: "custom",
                        usage: '{"input": {"bgType": "custom", "imageUrl": "https://...", "imagePath": "./photo.jpg", "imageBase64": "..."}}',
                        details: "Use your own custom images via local filesystem path, remote URL, or Base64 string."
                    }
                ]
            },
            apiKeyHandling: {
                description: "Flexible API Key options for Gemini AI generation",
                options: [
                    {
                        mode: "per_request_auth",
                        header: "Authorization: Bearer <KEY> or x-gemini-api-key: <KEY>",
                        body: '{"apiKey": "YOUR_KEY"}',
                        mcpParam: "?apiKey=YOUR_KEY on /mcp/sse",
                        details: "Safely pass API key per request or per MCP connection without modifying server config."
                    },
                    {
                        mode: "environment_variable",
                        env: "GEMINI_API_KEY",
                        details: "Set in deployment container environment variables."
                    },
                    {
                        mode: "store_inside_app_local",
                        cli: "smpg config set-key <GEMINI_API_KEY>",
                        api: "POST /api/config with {\"apiKey\": \"...\"}",
                        details: "Stores key in local .smpg_config.json for local CLI workflows."
                    },
                    {
                        mode: "omit_entirely",
                        details: "Use contentSource 'json' or 'db'. Zero API key needed."
                    }
                ]
            }
        },

        cliCheatSheet: [
            { cmd: "smpg help", desc: "Show agent guide and instructions" },
            { cmd: "smpg run workflow.json", desc: "Execute a workflow from file" },
            { cmd: "cat workflow.json | smpg run - --json", desc: "Execute workflow piped from stdin with JSON stdout" },
            { cmd: "smpg generate --topic \"Discipline\" --format carousel --slides 3", desc: "Fast flag-based generation" },
            { cmd: "smpg config set-key <KEY>", desc: "Store Gemini API key inside app" },
            { cmd: "smpg config get-key", desc: "Check if API key is currently configured" },
            { cmd: "smpg config clear-key", desc: "Remove stored API key from app" },
            { cmd: "smpg db list", desc: "List categories in local quotes database" },
            { cmd: "smpg presets", desc: "List all vibe presets, palettes, and font profiles" },
            { cmd: "smpg serve", desc: "Start HTTP REST / Webhook API & remote MCP server" },
            { cmd: "smpg mcp", desc: "Start Model Context Protocol (MCP) server over local stdio" }
        ],

        apiEndpoints: [
            { method: "GET", path: "/api/health", desc: "Service healthcheck and version status" },
            { method: "GET", path: "/api/help", desc: "Returns this machine-readable guide for agents" },
            { method: "POST", path: "/api/generate", desc: "Streamlined generation endpoint (returns slide data + image URLs / base64)" },
            { method: "POST", path: "/api/workflow/run", desc: "Full declarative workflow specification execution" },
            { method: "POST", path: "/api/render", desc: "Low-level single slide render to buffer / base64" },
            { method: "GET", path: "/api/presets", desc: "Returns presets, swatches, fonts, and db categories" },
            { method: "GET", path: "/api/db/categories", desc: "List local database quote categories" },
            { method: "GET", path: "/api/config", desc: "Inspect current API key configuration status" },
            { method: "POST", path: "/api/config", desc: "Store or update API key inside app" },
            { method: "GET", path: "/output/:filename", desc: "Direct URL access to generated image PNGs" }
        ],

        mcpEndpoints: [
            { method: "GET", path: "/mcp/sse", desc: "Establish remote Model Context Protocol (MCP) Server-Sent Events (SSE) session. Supports ?apiKey=<KEY> or Authorization: Bearer <KEY>" },
            { method: "POST", path: "/mcp/messages", desc: "Submit JSON-RPC messages to an active MCP SSE session (?sessionId=<ID>)" }
        ],

        mcpTools: [
            { name: "smpg_help", desc: "Agent discovery: returns complete guide, schemas, and endpoints" },
            { name: "smpg_run_workflow", desc: "Execute raw declarative workflow spec" },
            { name: "smpg_generate_post", desc: "High-level generation tool with 5-minute direct image URLs (topic, format, contentSource, bgType)" },
            { name: "smpg_get_image_url", desc: "Fast zero-latency tool: returns 5-minute ephemeral direct image URL for quote" },
            { name: "smpg_render_slide", desc: "Typeset single quote on custom background with direct image URL" },
            { name: "smpg_manage_config", desc: "Store, check, or clear API key inside app" },
            { name: "smpg_list_presets", desc: "List vibe presets, database categories, and font profiles" },
            { name: "smpg_get_schema", desc: "Retrieve JSON schema for declarative workflow validation" }
        ],

        availableFonts: Object.keys(FONT_PROFILES),
        vibePresets: VIBE_PRESETS,
        colorPalette: PRO_PALETTE
    };
}
