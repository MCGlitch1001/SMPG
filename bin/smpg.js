#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { executeWorkflow } from '../src/engine/workflow.js';
import { VIBE_PRESETS, FONT_PROFILES, PRO_PALETTE } from '../src/engine/presets.js';
import { getAgentHelp } from '../src/engine/help.js';
import { setApiKey, clearApiKey, loadConfig, resolveApiKey } from '../src/engine/config.js';
import { listCategories, getQuotesFromDatabase } from '../src/engine/database.js';

const args = process.argv.slice(2);

async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}

function parseCliArgs(rawArgs) {
    const parsed = { _: [] };
    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = rawArgs[i + 1];
            if (next && !next.startsWith('--')) {
                parsed[key] = next;
                i++;
            } else {
                parsed[key] = true;
            }
        } else {
            parsed._.push(arg);
        }
    }
    return parsed;
}

async function run() {
    const parsed = parseCliArgs(args);
    const command = parsed._[0] || 'help';

    // 1. HELP & AGENT DISCOVERY
    if (command === 'help') {
        const helpData = getAgentHelp();
        if (parsed.json) {
            console.log(JSON.stringify(helpData, null, 2));
            process.exit(0);
        }

        console.log(`
================================================================================
                    SMPG AGENT WORKFLOW ENGINE GUIDE
================================================================================
Headless Social Media Post Generator & Declarative Engine
Built for AI Agents (Hermes Agent, Claude, Cursor) & n8n

--------------------------------------------------------------------------------
1. CONTENT CHOICES (Quotes / Text Source)
--------------------------------------------------------------------------------
  • AI Generated ("ai") : Uses Gemini AI to brainstorm hardcore concepts & quotes.
  • Direct JSON  ("json") : Pass explicit quotes in JSON array. (NO API KEY NEEDED)
  • Database     ("db")   : Pulls quotes from local curated database. (NO API KEY NEEDED)

  Available DB categories: ${listCategories().map(c => c.category).join(', ')}

--------------------------------------------------------------------------------
2. BACKGROUND CHOICES (Visuals)
--------------------------------------------------------------------------------
  • AI Generated ("ai")    : Dark aesthetic cinematic images via Pollinations Flux.
  • Plain Color  ("plain") : Solid minimalist color swatch (e.g. #09090b, #18181b).
  • Custom Image ("custom"): Supply your own image (local file, URL, or Base64).

--------------------------------------------------------------------------------
3. API KEY OPTIONS (Gemini AI)
--------------------------------------------------------------------------------
  • Store in App   : ./bin/smpg.js config set-key <GEMINI_API_KEY>
  • Pass in Request: --api-key <KEY> or {"generator": {"apiKey": "..."}}
  • Omit Entirely  : Use "json" or "db" contentSource. Completely offline!

--------------------------------------------------------------------------------
4. COMMAND CHEAT SHEET
--------------------------------------------------------------------------------
  smpg help [--json]                   Show this guide (use --json for AI agents)
  smpg run <workflow.json>             Execute workflow from file
  cat workflow.json | smpg run - --json Execute workflow piped from stdin
  smpg generate [options]              Quick flag-based generation
  smpg config set-key <KEY>            Store API key inside app config
  smpg config get-key                  View current API key configuration
  smpg config clear-key                Remove stored API key from app
  smpg db list                         List categories in local quotes database
  smpg presets                         List vibe presets, palettes, and fonts
  smpg serve                           Start HTTP REST & Webhook server for n8n
  smpg mcp                             Start Model Context Protocol (MCP) server

--------------------------------------------------------------------------------
5. OPTIONS FOR 'generate'
--------------------------------------------------------------------------------
  --topic <text>           Topic or concept (e.g. "Stoic resilience")
  --format <type>          "carousel" (default, 1080x1080) or "reel" (1080x1920)
  --slides <number>        Number of slides per post (default: 3)
  --content-source <type>  "ai" (default), "json", or "db"
  --db-category <cat>      Category name if content-source is "db"
  --bg-type <type>         "ai" (default), "plain", or "custom"
  --bg-color <hex>         Hex color if bg-type is "plain" (default: #09090b)
  --image-url <url>        Image URL if bg-type is "custom"
  --image-path <path>      Local file path if bg-type is "custom"
  --font <profile>         Font: BigShoulders, Outfit, Lora, GeistMono, Crimson
  --watermark <handle>     Watermark tag (e.g. @discipline.archive)
  --api-key <key>          Gemini API key override
  --out <dir>              Output directory (default: ./output)
  --json                   Output machine-readable JSON to stdout
================================================================================
`);
        process.exit(0);
    }

    // 2. CONFIG COMMANDS (STORE API KEY INSIDE APP)
    if (command === 'config') {
        const subAction = parsed._[1];
        if (subAction === 'set-key') {
            const keyToSet = parsed._[2] || parsed.key;
            if (!keyToSet) {
                console.error('Error: Please provide key. Usage: smpg config set-key <KEY>');
                process.exit(1);
            }
            setApiKey(keyToSet);
            console.log('✓ API Key successfully stored inside app (.smpg_config.json).');
            process.exit(0);
        }

        if (subAction === 'get-key') {
            const current = resolveApiKey();
            if (current) {
                const masked = current.slice(0, 4) + '...' + current.slice(-4);
                console.log(`Active API Key: ${masked} (ready for AI generation)`);
            } else {
                console.log('No API Key configured. (Engine will use local DB/JSON mode or fallback)');
            }
            process.exit(0);
        }

        if (subAction === 'clear-key') {
            clearApiKey();
            console.log('✓ Stored API Key cleared from app.');
            process.exit(0);
        }

        console.error('Unknown config action. Use: set-key, get-key, or clear-key.');
        process.exit(1);
    }

    // 3. DATABASE COMMANDS
    if (command === 'db') {
        const subAction = parsed._[1] || 'list';
        if (subAction === 'list') {
            const categories = listCategories();
            console.log(JSON.stringify(categories, null, 2));
            process.exit(0);
        }
    }

    // 4. PRESETS
    if (command === 'presets') {
        const data = {
            vibePresets: VIBE_PRESETS,
            fontProfiles: Object.keys(FONT_PROFILES),
            colorPalette: PRO_PALETTE,
            dbCategories: listCategories()
        };
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    }

    // 5. MCP SERVER
    if (command === 'mcp') {
        await import('../src/mcp/server.js');
        return;
    }

    // 6. REST API SERVER
    if (command === 'serve') {
        await import('../src/api/server.js');
        return;
    }

    // 7. RUN WORKFLOW (FILE OR STDIN)
    if (command === 'run') {
        let jsonStr = '';
        const target = parsed._[1];

        if (target === '-' || (!target && !process.stdin.isTTY)) {
            jsonStr = await readStdin();
        } else if (target) {
            const fullPath = path.resolve(process.cwd(), target);
            if (!fs.existsSync(fullPath)) {
                console.error(`Error: Workflow file not found at ${fullPath}`);
                process.exit(1);
            }
            jsonStr = fs.readFileSync(fullPath, 'utf-8');
        } else {
            console.error('Error: Please provide a workflow JSON file path or pipe JSON into stdin.');
            process.exit(1);
        }

        const workflowSpec = JSON.parse(jsonStr);
        const result = await executeWorkflow(workflowSpec);

        if (parsed.json) {
            console.log(JSON.stringify(result));
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
    }

    // 8. GENERATE VIA CLI FLAGS
    if (command === 'generate') {
        const topic = parsed.topic || VIBE_PRESETS[0];
        const format = (parsed.format || 'carousel').toLowerCase();
        const slides = parseInt(parsed.slides || 3, 10);
        const font = parsed.font || 'BigShoulders';
        const watermark = parsed.watermark || null;
        const outDir = parsed.out || './output';

        const contentSource = parsed['content-source'] || parsed.contentSource || (parsed['db-category'] ? 'db' : 'ai');
        const dbCategory = parsed['db-category'] || parsed.dbCategory || null;

        const bgType = parsed['bg-type'] || parsed.bgType || (parsed['image-url'] || parsed['image-path'] ? 'custom' : (parsed['bg-color'] ? 'plain' : 'ai'));
        const bgColor = parsed['bg-color'] || parsed.bgColor || '#09090b';
        const imageUrl = parsed['image-url'] || parsed.imageUrl || null;
        const imagePath = parsed['image-path'] || parsed.imagePath || null;
        const apiKey = parsed['api-key'] || parsed.apiKey || null;

        const workflowSpec = {
            name: `CLI-Generation-${Date.now()}`,
            format,
            input: {
                contentSource,
                dbCategory,
                topic,
                numPosts: 1,
                slidesPerPost: slides,
                bgType,
                bgColor,
                imageUrl,
                imagePath
            },
            theme: {
                fontProfile: font,
                watermark
            },
            generator: {
                apiKey
            },
            output: {
                directory: outDir,
                saveImages: true,
                generateCaptions: true
            }
        };

        const result = await executeWorkflow(workflowSpec);

        if (parsed.json) {
            console.log(JSON.stringify(result));
        } else {
            console.log('\n[SMPG] Generation Completed:');
            console.log(`- Format: ${result.format}`);
            console.log(`- Content Source: ${result.contentSource}`);
            console.log(`- Background Type: ${result.backgroundType}`);
            console.log(`- Total Slides: ${result.totalSlides}`);
            console.log(`- Output Directory: ${result.outputDirectory}`);
            console.log(`- Caption:\n${result.posts[0].caption}\n`);
            result.posts[0].slides.forEach(s => {
                console.log(`  Slide ${s.slideIndex}: ${s.fileName} -> "${s.quote}"`);
            });
        }
        process.exit(0);
    }

    console.error(`Unknown command: ${command}. Run 'smpg help' for usage.`);
    process.exit(1);
}

run().catch(err => {
    console.error('CLI Execution Error:', err.message);
    process.exit(1);
});
