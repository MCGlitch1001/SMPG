# N8N Integration with SMPG

This directory contains integration resources to run SMPG workflows inside [n8n](https://n8n.io/).

## Overview

The SMPG Workflow Engine runs headlessly without HTML/browser dependencies. N8N can trigger post generation automatically (via cron schedule, webhooks, Airtable triggers, or LLM agent nodes) and receive ready-to-publish image URLs, file paths, and formatted captions.

## Quick Start

### 1. Start the SMPG API Server

```bash
npm run serve
```
By default, the server runs on `http://localhost:3000`.
- API endpoints: `http://localhost:3000/api/generate`, `http://localhost:3000/api/workflow/run`
- Static images: `http://localhost:3000/output/:filename`

> **Note for Docker users**: If n8n runs inside Docker on the same machine, use `http://host.docker.internal:3000/api/generate` instead of `localhost`.

### 2. Import Workflow into N8N

1. Open your n8n canvas.
2. Click **Workflow Menu (top right) -> Import from File**.
3. Select `integrations/n8n/smpg_n8n_workflow.json`.
4. Click **Execute Workflow**.

### 3. Workflow Flow

```
[Trigger (Manual / Webhook / Schedule)]
   ↓
[Set Parameters] (topic, format, slidesCount, fontProfile, watermark)
   ↓
[HTTP Request Node] -> POST http://localhost:3000/api/generate
   ↓
[Code Node (Format For Social Nodes)]
   ↓
[Publishing Nodes] (Instagram Graph API, Buffer, Telegram, Google Drive, Discord)
```

### 4. Input Parameters in N8N

| Field | Type | Description |
|---|---|---|
| `topic` | String | Concept or niche e.g. "Stoic discipline in chaos" |
| `format` | String | `"carousel"` (1080x1080) or `"reel"` (1080x1920) |
| `slidesCount` | Number | Number of slides (1-10) |
| `fontProfile` | String | `"BigShoulders"`, `"Outfit"`, `"Lora"`, `"GeistMono"`, `"Bricolage"`, `"Crimson"` |
| `watermark` | String | Optional handle e.g. `@stoic.archive` |
| `quotes` | Array | (Optional) Direct quotes array if you want custom text |

### 5. Output Payload Structure

```json
{
  "workflowName": "N8N-Generation-1718000000",
  "format": "carousel",
  "topic": "Stoic discipline in the face of chaos",
  "caption": "WE SUFFER MORE OFTEN IN IMAGINATION THAN IN REALITY...\n\n#mindset #discipline...",
  "totalSlides": 3,
  "imageUrls": [
    "http://localhost:3000/output/post_1_slide_1.png",
    "http://localhost:3000/output/post_1_slide_2.png",
    "http://localhost:3000/output/post_1_slide_3.png"
  ],
  "imageFilePaths": [
    "/home/ishaan/Work/SMPG/output/post_1_slide_1.png",
    "/home/ishaan/Work/SMPG/output/post_1_slide_2.png",
    "/home/ishaan/Work/SMPG/output/post_1_slide_3.png"
  ]
}
```
