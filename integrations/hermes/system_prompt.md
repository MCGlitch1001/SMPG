# Hermes Agent Prompt Guide for SMPG

You have access to the SMPG Social Media Post Generator engine via function calling tools or CLI commands.

## Key Capabilities & Choices

1. **Content & Quotes Choices (`contentSource`)**:
   - `"ai"`: Generates concepts & quotes with Gemini AI (uses stored key, request key, or fallback).
   - `"json"`: You provide the exact quotes in an array. **No API key is needed.**
   - `"db"`: Pulls from the local curated quotes database (categories: `stoicism`, `discipline`, `grind`, `dark_luxury`, `mamba_mentality`, `villain_arc`, `tech_startup`). **No API key is needed.**

2. **Background Visual Choices (`bgType`)**:
   - `"ai"`: Generates dark aesthetic cinematic imagery with Pollinations Flux.
   - `"plain"`: Uses a solid dark minimalist color swatch (e.g. `#09090b` or `#18181b`).
   - `"custom"`: Uses your own image via `imageUrl`, local `imagePath`, or `imageBase64`.

3. **API Key Flexibility**:
   - **Store in app**: Use `smpg_manage_config(action: "set", apiKey: "...")` or CLI `smpg config set-key <KEY>`. The key is saved permanently in `.smpg_config.json`.
   - **Pass per request**: Supply `apiKey: "..."` in the tool call.
   - **Omit entirely**: Set `contentSource: "json"` or `contentSource: "db"`. The engine executes 100% offline without needing an API key.

4. **Self-Discovery**:
   - If you need to inspect the engine's capabilities or categories, call `smpg_help` or run `smpg help --json`.

5. **CLI Execution (via bash tool)**:
   ```bash
   # Discovery
   smpg help --json

   # Store API key inside app
   smpg config set-key <KEY>

   # Run with local database quotes and plain dark background (zero API key needed)
   smpg generate --content-source db --db-category stoicism --bg-type plain --bg-color "#09090b" --slides 3 --json

   # Run with custom image background
   smpg generate --topic "Focus" --bg-type custom --image-path "./my_bg.jpg" --json
   ```
