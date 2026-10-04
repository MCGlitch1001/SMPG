#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { executeWorkflow } from '../src/engine/workflow.js';
import { VIBE_PRESETS, FONT_PROFILES, PRO_PALETTE } from '../src/engine/presets.js';

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

    if (command === 'help') {
        console.log(`
SMPG Agent CLI - Headless Social Media Post Workflow Engine
===========================================================

Commands:
  run <file.json>          Execute workflow specification from JSON file
  run -                    Execute workflow specification piped from stdin
  generate [options]       Generate posts using flags
  presets                  List vibe presets, palettes, and font profiles
  mcp                      Start the Model Context Protocol (MCP) server
  serve                    Start the N8N / REST API server

Options for 'generate':
  --topic <text>           Topic / concept (e.g. "Stoic discipline")
  --format <type>          "carousel" (default) or "reel"
  --slides <number>        Number of slides per post (default: 3)
  --font <profile>         Font profile (BigShoulders, Outfit, Lora, GeistMono, etc.)
  --watermark <handle>     Watermark tag (e.g. @discipline_archive)
  --out <dir>              Output directory (default: ./output)
  --json                   Output machine-readable JSON to stdout
`);
        process.exit(0);
    }

    if (command === 'presets') {
        const data = {
            vibePresets: VIBE_PRESETS,
            fontProfiles: Object.keys(FONT_PROFILES),
            colorPalette: PRO_PALETTE
        };
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    }

    if (command === 'mcp') {
        await import('../src/mcp/server.js');
        return;
    }

    if (command === 'serve') {
        await import('../src/api/server.js');
        return;
    }

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

    if (command === 'generate') {
        const topic = parsed.topic || VIBE_PRESETS[0];
        const format = (parsed.format || 'carousel').toLowerCase();
        const slides = parseInt(parsed.slides || 3, 10);
        const font = parsed.font || 'BigShoulders';
        const watermark = parsed.watermark || null;
        const outDir = parsed.out || './output';

        const workflowSpec = {
            name: `CLI-Generation-${Date.now()}`,
            format,
            input: {
                topic,
                numPosts: 1,
                slidesPerPost: slides
            },
            theme: {
                fontProfile: font,
                watermark
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
            console.log('\n[SMPG] Generation Completed Successfully:');
            console.log(`- Format: ${result.format}`);
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
