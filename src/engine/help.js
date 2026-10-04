import { VIBE_PRESETS, FONT_PROFILES, PRO_PALETTE } from './presets.js';
import { listCategories } from './database.js';

export function getAgentHelp() {
    return {
        title: "SMPG Agent Engine - Integration & Execution Guide",
        description: "Headless Social Media Post Generator & Declarative Workflow Engine designed for AI Agents (Hermes Agent, Claude) and n8n without browser or HTML dependencies.",
        
        choices: {
            contentSource: {
                description: "Choose how quotes/text are sourced",
                options: [
                    {
                        name: "ai",
                        usage: '{"input": {"contentSource": "ai", "topic": "Stoic grit"}}',
                        details: "Generates high-impact quotes via Gemini API. Uses stored API key, env key, or explicit key."
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
                        mode: "store_inside_app",
                        cli: "smpg config set-key <GEMINI_API_KEY>",
                        api: "POST /api/config with {\"apiKey\": \"...\"}",
                        details: "Stores key in local .smpg_config.json so you never need to pass it again."
                    },
                    {
                        mode: "supply_per_request",
                        workflow: '{"generator": {"apiKey": "YOUR_KEY"}}',
                        api: '{"apiKey": "YOUR_KEY"}',
                        details: "Pass explicitly in workflow JSON or API body."
                    },
                    {
                        mode: "omit_entirely",
                        details: "Use contentSource 'json' or 'db'. No API key is asked for or required!"
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
            { cmd: "smpg serve", desc: "Start HTTP REST / Webhook API server for n8n" },
            { cmd: "smpg mcp", desc: "Start Model Context Protocol (MCP) server over stdio" }
        ],

        apiEndpoints: [
            { method: "POST", path: "/api/generate", desc: "Streamlined single call for n8n (accepts topic, contentSource, bgType, etc.)" },
            { method: "POST", path: "/api/workflow/run", desc: "Full declarative workflow specification execution" },
            { method: "GET", path: "/api/help", desc: "Returns this machine-readable guide for agents" },
            { method: "GET", path: "/api/presets", desc: "Returns presets, swatches, and fonts" },
            { method: "GET", path: "/api/db/categories", desc: "List local database quote categories" },
            { method: "POST", path: "/api/config", desc: "Store or update API key inside app" },
            { method: "GET", path: "/output/:filename", desc: "Direct URL access to generated image PNGs" }
        ],

        mcpTools: [
            { name: "smpg_help", desc: "Agent discovery: returns this complete guide and schemas" },
            { name: "smpg_generate_post", desc: "High-level generation tool (topic, format, contentSource, bgType)" },
            { name: "smpg_run_workflow", desc: "Execute raw declarative workflow spec" },
            { name: "smpg_render_slide", desc: "Typeset single quote on custom background" },
            { name: "smpg_list_presets", desc: "List vibe presets, database categories, and font profiles" },
            { name: "smpg_manage_config", desc: "Store or check API key inside app" }
        ],

        availableFonts: Object.keys(FONT_PROFILES),
        vibePresets: VIBE_PRESETS,
        colorPalette: PRO_PALETTE
    };
}
