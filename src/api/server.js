import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { executeWorkflow } from '../engine/workflow.js';
import { renderSlide } from '../engine/renderer.js';
import { VIBE_PRESETS, PRO_PALETTE, FONT_PROFILES } from '../engine/presets.js';
import { getAgentHelp } from '../engine/help.js';
import { setApiKey, clearApiKey, resolveApiKey, extractApiKeyFromRequest } from '../engine/config.js';
import { listCategories } from '../engine/database.js';
import { createSmpgMcpServer } from '../mcp/server.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Module-relative path resolution
const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.join(ROOT_DIR, 'output');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Enable reverse proxy trust (for container / cloud deployments)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper to determine base URL
const getBaseUrl = (req) => {
    if (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim()) {
        return process.env.PUBLIC_BASE_URL.trim().replace(/\/+$/, '');
    }
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}`;
};

// ==========================================
// 1. MCP Endpoints (Remote SSE Transport)
// ==========================================
const mcpSessions = new Map();

app.get('/mcp/sse', async (req, res) => {
    try {
        const sessionApiKey = extractApiKeyFromRequest(req);
        const server = createSmpgMcpServer(sessionApiKey);
        const transport = new SSEServerTransport('/mcp/messages', res);

        mcpSessions.set(transport.sessionId, { transport, server });

        transport.onclose = () => {
            mcpSessions.delete(transport.sessionId);
        };
        req.on('close', () => {
            mcpSessions.delete(transport.sessionId);
        });

        await server.connect(transport);
    } catch (err) {
        console.error('[MCP SSE Error]:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId query parameter' });
    }
    const session = mcpSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: `Session not found: ${sessionId}` });
    }
    try {
        await session.transport.handlePostMessage(req, res, req.body);
    } catch (err) {
        console.error('[MCP POST Error]:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// ==========================================
// 2. REST API Endpoints
// ==========================================

// Healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SMPG Dual-Mode Engine (Web UI + REST + MCP)',
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
    const key = resolveApiKey(req);
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
        if (!workflowSpec.generator) workflowSpec.generator = {};
        if (!workflowSpec.generator.apiKey) {
            const key = resolveApiKey(req);
            if (key) workflowSpec.generator.apiKey = key;
        }
        if (!workflowSpec.output) workflowSpec.output = {};
        if (!workflowSpec.output.directory) {
            workflowSpec.output.directory = OUTPUT_DIR;
        }

        const isProduction = process.env.NODE_ENV === 'production';
        if (workflowSpec.output.returnBase64 === undefined && isProduction) {
            workflowSpec.output.returnBase64 = true;
        }

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

// Streamlined Generation Endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const returnBase64 = req.body.returnBase64 !== undefined ? Boolean(req.body.returnBase64) : isProduction;

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
        const resolvedApiKey = apiKey || resolveApiKey(req);

        const workflowSpec = {
            name: `Generation-${Date.now()}`,
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
                apiKey: resolvedApiKey
            },
            output: {
                directory: OUTPUT_DIR,
                saveImages: true,
                returnBase64,
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
        const isProduction = process.env.NODE_ENV === 'production';
        const returnBase64 = req.body.returnBase64 !== undefined ? Boolean(req.body.returnBase64) : isProduction;

        const {
            quote = "EXECUTE IN SILENCE.",
            format = "carousel",
            bgColor = "#09090b",
            fontProfile = "BigShoulders",
            watermark = null
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

// ==========================================
// 3. Static Asset Delivery (/output)
// ==========================================
app.use('/output', express.static(OUTPUT_DIR));

// ==========================================
// 4. Built Vite Frontend SPA Delivery
// ==========================================
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
}

// Catch-all route for SPA history routing (excluding /api, /mcp, /output)
app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path.startsWith('/output')) {
        return next();
    }
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.status(404).send('SMPG: Frontend not yet built. Please run `npm run build` to compile the Vite human UI into dist/.');
});

// Start Server
app.listen(PORT, () => {
    console.log(`[SMPG API] Dual-Mode Server listening on port ${PORT}`);
    console.log(`[SMPG API] Web UI (SPA): http://localhost:${PORT}/`);
    console.log(`[SMPG API] REST API & Self-Discovery: http://localhost:${PORT}/api/help`);
    console.log(`[SMPG API] MCP Remote SSE: http://localhost:${PORT}/mcp/sse`);
    console.log(`[SMPG API] Static Media Outputs: http://localhost:${PORT}/output`);
});

export default app;
