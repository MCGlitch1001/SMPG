import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { executeWorkflow } from '../engine/workflow.js';
import { renderSlide } from '../engine/renderer.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../engine/presets.js';
import { getAgentHelp } from '../engine/help.js';
import { setApiKey, clearApiKey, resolveApiKey } from '../engine/config.js';
import { listCategories } from '../engine/database.js';

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static asset delivery for generated slides (so N8N / Webhooks can access image URLs directly)
app.use('/output', express.static(OUTPUT_DIR));

// Helper to determine base URL
const getBaseUrl = (req) => {
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}`;
};

// Healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SMPG Agent Workflow Engine',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Help & Agent Self-Discovery
app.get('/api/help', (req, res) => {
    res.json(getAgentHelp());
});

// Presets & Available Fonts
app.get('/api/presets', (req, res) => {
    res.json({
        vibePresets: VIBE_PRESETS,
        colorPalette: PRO_PALETTE,
        fontProfiles: FONT_PROFILES,
        dbCategories: listCategories()
    });
});

// Database categories
app.get('/api/db/categories', (req, res) => {
    res.json({
        categories: listCategories()
    });
});

// App-level API Key Management (Store/Inspect/Clear)
app.get('/api/config', (req, res) => {
    const key = resolveApiKey();
    res.json({
        hasApiKey: Boolean(key),
        maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null
    });
});

app.post('/api/config', (req, res) => {
    const { apiKey, clear } = req.body;
    if (clear) {
        clearApiKey();
        return res.json({ success: true, message: 'API key cleared from app.' });
    }
    if (apiKey) {
        setApiKey(apiKey);
        return res.json({ success: true, message: 'API key stored inside app.' });
    }
    res.status(400).json({ success: false, error: 'Please provide apiKey string or clear: true.' });
});

// Full Workflow Run (Declarative Workflow Language Specification)
app.post('/api/workflow/run', async (req, res) => {
    try {
        const workflowSpec = req.body.workflow || req.body;
        const baseUrl = getBaseUrl(req);
        const result = await executeWorkflow(workflowSpec, baseUrl);
        res.json(result);
    } catch (err) {
        console.error('[API Error /workflow/run]:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Streamlined Generation Endpoint (Ideal for N8N "HTTP Request" Node)
app.post('/api/generate', async (req, res) => {
    try {
        const {
            topic = VIBE_PRESETS[0],
            format = 'carousel',
            mode,
            slidesCount = 3,
            contentSource, // 'ai' | 'json' | 'db'
            dbCategory,
            quotes = null,
            fontProfile = 'BigShoulders',
            watermark = null,
            bgType, // 'ai' | 'plain' | 'custom'
            bgMode,
            bgColor = '#09090b',
            imageUrl = null,
            imagePath = null,
            imageBase64 = null,
            backgroundPrompt = null,
            apiKey = null
        } = req.body;

        const resolvedFormat = (format || mode || 'carousel').toLowerCase() === 'reel' ? 'reel' : 'carousel';

        const workflowSpec = {
            name: `N8N-Generation-${Date.now()}`,
            format: resolvedFormat,
            input: {
                contentSource,
                dbCategory,
                topic,
                numPosts: 1,
                slidesPerPost: resolvedFormat === 'reel' ? 1 : slidesCount,
                quotes,
                bgType: bgType || bgMode,
                bgColor,
                backgroundPrompt,
                imageUrl,
                imagePath,
                imageBase64
            },
            theme: {
                fontProfile,
                watermark
            },
            generator: {
                apiKey
            },
            output: {
                directory: OUTPUT_DIR,
                saveImages: true,
                generateCaptions: true
            }
        };

        const baseUrl = getBaseUrl(req);
        const result = await executeWorkflow(workflowSpec, baseUrl);
        res.json(result);
    } catch (err) {
        console.error('[API Error /generate]:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Low-level Single Slide Render
app.post('/api/render', async (req, res) => {
    try {
        const {
            quote = "EXECUTE IN SILENCE.",
            format = "carousel",
            bgColor = "#09090b",
            fontProfile = "BigShoulders",
            watermark = null,
            returnBase64 = false
        } = req.body;

        const buffer = await renderSlide({
            quote,
            bgResult: { type: 'color', color: bgColor },
            mode: format,
            slideIndex: 0,
            totalSlides: 1,
            fontProfile,
            watermark
        });

        const fileName = `custom_slide_${Date.now()}.png`;
        const filePath = path.join(OUTPUT_DIR, fileName);
        fs.writeFileSync(filePath, buffer);

        const baseUrl = getBaseUrl(req);
        const responseData = {
            success: true,
            fileName,
            url: `${baseUrl}/output/${fileName}`
        };

        if (returnBase64) {
            responseData.base64 = `data:image/png;base64,${buffer.toString('base64')}`;
        }

        res.json(responseData);
    } catch (err) {
        console.error('[API Error /render]:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`[SMPG API] Agent & N8N Workflow API listening at http://localhost:${PORT}`);
    console.log(`[SMPG API] Static asset delivery at http://localhost:${PORT}/output`);
    console.log(`[SMPG API] Agent Help & Docs available at http://localhost:${PORT}/api/help`);
});
