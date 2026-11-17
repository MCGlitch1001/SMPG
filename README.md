# SMPG - Headless Social Media Post Workflow Engine (`agent` branch)

An agent-native, headless workflow engine for generating high-contrast, viral social media carousels (1080x1080, 1:1) and vertical Reels/Stories (1080x1920, 9:16).

Designed specifically for **AI Agents (Hermes Agent, Claude, Cursor, Antigravity)** and **Automation Platforms (n8n)** without browser or HTML dependencies.

---

## Key Highlights

- **Zero HTML / DOM dependencies**: Image typesetting and slide rendering run 100% server-side via high-performance Rust canvas (`@napi-rs/canvas`).
- **Declarative Workflow Language**: Control posts, slides, quotes, typography, and backgrounds via structured JSON/YAML specifications validated against JSON Schema.
- **Model Context Protocol (MCP)**: Native stdio MCP server exposing `smpg_generate_post`, `smpg_run_workflow`, `smpg_render_slide`, and `smpg_list_presets`.
- **N8N Ready**: Built-in HTTP REST & Webhook server (`/api/generate`, `/api/workflow/run`) and an importable N8N workflow template (`integrations/n8n/smpg_n8n_workflow.json`).
- **Hermes Agent Tools**: Pre-configured OpenAI/Hermes function calling definitions in `integrations/hermes/hermes_tools.json`.
- **Bundled Typography**: Includes high-impact typography fonts (`BigShoulders`, `Outfit`, `Lora`, `GeistMono`, `Crimson`, `BricolageGrotesque`).

---

## Architecture

```
                               ┌─────────────────────────┐
                               │  Hermes Agent / Claude  │ (via MCP or CLI)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │    n8n Orchestration    │ (via HTTP Webhook / REST)
                               └────────────┬────────────┘
                                            │
               ═════════════════════════════╪═════════════════════════════
                                            │
                        ┌───────────────────▼───────────────────┐
                        │   SMPG Declarative Workflow Engine    │
                        └───────┬───────────────────────┬───────┘
                                │                       │
            ┌───────────────────▼──────────┐ ┌──────────▼───────────────────┐
            │  Text Generator (LLM / Bank) │ │ Image Generator (Flux / Hex) │
            └───────────────────┬──────────┘ └──────────┬───────────────────┘
                                │                       │
                                └───────────┬───────────┘
                                            │
                               ┌────────────▼────────────┐
                               │ Headless Canvas Renderer│ (1080x1080 / 1080x1920)
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │  PNG Slides + Captions  │ (/output/*.png + JSON)
                               └─────────────────────────┘
```

---

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Run with CLI

```bash
# Execute an existing workflow specification:
npm run cli -- run examples/stoic_carousel.workflow.json

# Pipe workflow JSON from stdin (ideal for shell scripts & agents):
cat examples/custom_quotes.workflow.json | npm run cli -- run - --json

# Quick generation via flags:
npm run cli -- generate --topic "Stoic discipline" --format carousel --slides 3
```

### 3. Start the N8N / REST API Server

```bash
npm run serve
```
Server starts on `http://localhost:3000`:
- **`POST /api/generate`**: Fast generation endpoint (ideal for N8N "HTTP Request" node).
- **`POST /api/workflow/run`**: Full declarative workflow execution.
- **`GET /api/presets`**: List vibe presets, palettes, and fonts.
- **`GET /output/:filename`**: Direct URL access to generated image files for social posting nodes.

### 4. Run as MCP Server (for AI Agents)

```bash
npm run mcp
```
Connect your MCP client to `node src/mcp/server.js` using stdio transport.

---

## Workflow Language Specification

Workflows are defined in JSON (validated against `schemas/workflow.schema.json`):

```json
{
  "$schema": "./schemas/workflow.schema.json",
  "version": "1.0",
  "name": "Stoic Discipline Carousel",
  "format": "carousel",
  "input": {
    "topic": "Stoic discipline in the face of chaos",
    "numPosts": 1,
    "slidesPerPost": 3,
    "bgMode": "image",
    "backgroundPrompt": "ancient obsidian marble colosseum in fog, cinematic dark contrast"
  },
  "theme": {
    "fontProfile": "BigShoulders",
    "watermark": "@stoic.archive"
  },
  "output": {
    "directory": "./output/stoic_carousel",
    "saveImages": true,
    "generateCaptions": true
  }
}
```

### Output JSON Format

When a workflow runs, it outputs structured data:

```json
{
  "success": true,
  "workflowName": "Stoic Discipline Carousel",
  "format": "carousel",
  "topic": "Stoic discipline in the face of chaos",
  "postsCount": 1,
  "totalSlides": 3,
  "outputDirectory": "/path/to/output/stoic_carousel",
  "posts": [
    {
      "postIndex": 1,
      "mode": "carousel",
      "caption": "WE SUFFER MORE OFTEN IN IMAGINATION THAN IN REALITY...\n\n#mindset #discipline...",
      "slides": [
        {
          "slideIndex": 1,
          "quote": "WE SUFFER MORE OFTEN IN IMAGINATION THAN IN REALITY.",
          "fileName": "post_1_slide_1.png",
          "filePath": "/path/to/output/stoic_carousel/post_1_slide_1.png",
          "url": "http://localhost:3000/output/post_1_slide_1.png"
        }
      ]
    }
  ]
}
```

---

## Integration with N8N

Import `integrations/n8n/smpg_n8n_workflow.json` into n8n:
1. Open n8n -> **Workflow menu** -> **Import from File**.
2. Select `integrations/n8n/smpg_n8n_workflow.json`.
3. Set your input variables in the "Set Post Parameters" node.
4. Execute to receive ready-to-post URLs and captions.

See `integrations/n8n/README.md` for full instructions.

---

## Integration with Hermes Agent

1. Load function definitions from `integrations/hermes/hermes_tools.json`.
2. Follow the prompt guidelines in `integrations/hermes/system_prompt.md`.
3. Check `integrations/hermes/example_conversation.json` for a sample function calling exchange.

---

## Available Fonts & Presets

- **Typography Profiles**: `BigShoulders` (condensed hardcore), `Outfit` (clean modern), `Lora` (luxury editorial), `GeistMono` (tech minimalist), `Crimson` (dark stoic), `Bricolage` (bold contemporary).
- **Vibe Presets**:
  - `Unrelenting discipline, 1% mindset, success`
  - `Stoicism, inner strength, quiet power`
  - `Gym motivation, pushing physical limits`
  - `Dark luxury, old money, silent wealth`
  - `Entrepreneur grind, building an empire`
  - `Mamba mentality, sports psychology, winning`
  - `Deep focus, monk mode, minimalist hustle`
  - `Late nights, coding, tech startup grind`
