# SMPG Agent Architecture & Usage Guide

This guide is designed for **AI Agents (Hermes Agent, Claude, Cursor)** and **Workflow Platforms (n8n)** to interact with and orchestrate SMPG.

---

## 1. Content & Quotes Choices (`contentSource`)

When initiating a workflow, post generation, or tool call, choose how quotes are sourced:

| Choice | Value | API Key Needed? | Description | Example Payload |
|---|---|---|---|---|
| **AI Generated** | `"ai"` | Yes (or fallback) | Uses Gemini AI to brainstorm concepts and punchy quotes based on `topic`. | `{"input": {"contentSource": "ai", "topic": "Stoic discipline"}}` |
| **Direct JSON** | `"json"` | **NO** | Provide exact quotes in a JSON array. Skips all LLM calls. | `{"input": {"contentSource": "json", "quotes": ["REST AT THE END.", "EXECUTE NOW."]}}` |
| **Local Database** | `"db"` | **NO** | Pulls from local curated quote database (`data/quotes_db.json`). | `{"input": {"contentSource": "db", "dbCategory": "stoicism", "slidesPerPost": 3}}` |

### Available Database Categories
- `stoicism`
- `discipline`
- `grind`
- `mamba_mentality`
- `dark_luxury`
- `villain_arc`
- `tech_startup`

---

## 2. Background Visual Choices (`bgType`)

Choose how the slide visual canvas is styled:

| Choice | Value | Description | Required Parameters |
|---|---|---|---|
| **AI Generated** | `"ai"` | Generates dark cinematic high-contrast backgrounds via Pollinations Flux. | `backgroundPrompt` (optional: defaults to topic-based dark aesthetic) |
| **Plain Solid Color** | `"plain"` | Renders text directly on a minimalist solid color canvas. | `bgColor` (e.g. `"#09090b"`, `"#18181b"`, `"#000000"`) |
| **Custom Image** | `"custom"` | Uses your own image asset. | `imagePath` (local file) OR `imageUrl` (remote URL) OR `imageBase64` |

---

## 3. Gemini API Key Handling

You have 3 flexible ways to handle the Gemini API key:

### Option A: Store Inside the App
Store the API key permanently in `.smpg_config.json` so you never have to pass it again:
- **CLI**: `./bin/smpg.js config set-key <GEMINI_API_KEY>`
- **API**: `POST http://localhost:3000/api/config` with `{"apiKey": "..."}`
- **MCP Tool**: `smpg_manage_config(action: "set", apiKey: "...")`

### Option B: Supply Per Request
Pass the key dynamically in the workflow JSON, API payload, or CLI flag:
- Workflow JSON: `{"generator": {"apiKey": "..."}}`
- API Payload: `{"apiKey": "..."}`
- CLI Flag: `--api-key <KEY>`

### Option C: Omit Entirely (No Key Needed)
If you select `contentSource: "json"` (passing quotes) or `contentSource: "db"` (local database), the engine operates completely offline without ever asking for or requiring an API key.

---

## 4. Agent Self-Discovery (`smpg help`)

Agents can discover all available capabilities, options, and commands dynamically:

- **CLI**:
  ```bash
  # Machine-readable JSON output for AI subagents
  ./bin/smpg.js help --json
  ```
- **MCP Tool**:
  Call the `smpg_help` tool to get the complete schema and guide in JSON.
- **REST API**:
  `GET http://localhost:3000/api/help`

---

## 5. CLI Cheat Sheet

```bash
# 1. Self-discovery
smpg help --json

# 2. Store API key inside app
smpg config set-key AIzaSy...

# 3. Check current API key configuration
smpg config get-key

# 4. Generate with local database quotes and plain dark background (ZERO API KEY)
smpg generate --content-source db --db-category stoicism --bg-type plain --bg-color "#09090b" --slides 3

# 5. Generate with custom image background
smpg generate --content-source json --quotes '["QUOTE 1", "QUOTE 2"]' --bg-type custom --image-path "./photo.jpg"

# 6. Run full declarative workflow file
smpg run examples/database_quotes_plain_bg.workflow.json

# 7. Pipe workflow from stdin (agent pipe)
cat my_workflow.json | smpg run - --json
```

---

## 6. HTTP API Endpoints (for n8n & Webhooks)

Start the server: `npm run serve` (default port: 3000).

- **`POST /api/generate`**: Streamlined generation endpoint.
- **`POST /api/workflow/run`**: Full declarative workflow specification execution.
- **`GET /api/help`**: Self-discovery guide for agents.
- **`GET /api/presets`**: Available vibe presets, swatches, and fonts.
- **`GET /api/db/categories`**: Available database quote categories.
- **`POST /api/config`**: Store or clear API key inside app.
- **`GET /output/:filename`**: Direct URL access to generated image files for social posting nodes.
