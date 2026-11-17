import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const isProduction = process.env.NODE_ENV === 'production';
const CONFIG_FILE = fileURLToPath(new URL('../../.smpg_config.json', import.meta.url));

let inMemoryConfig = {};

/**
 * Load persisted config from local file (or in-memory in production)
 */
export function loadConfig() {
    if (isProduction) {
        return { ...inMemoryConfig };
    }
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch {
        // Ignore read errors
    }
    return { ...inMemoryConfig };
}

/**
 * Save config object to local file (or in-memory in production)
 */
export function saveConfig(updates = {}) {
    if (isProduction) {
        inMemoryConfig = { ...inMemoryConfig, ...updates };
        return inMemoryConfig;
    }
    try {
        const current = loadConfig();
        const merged = { ...current, ...updates };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
        return merged;
    } catch (err) {
        console.error('Failed to save config:', err.message);
        return null;
    }
}

/**
 * Store an API key inside the app
 */
export function setApiKey(key) {
    return saveConfig({ apiKey: key ? key.trim() : "" });
}

/**
 * Clear stored API key
 */
export function clearApiKey() {
    return saveConfig({ apiKey: "" });
}

/**
 * Extract an API key from an Express or Node.js request object
 */
export function extractApiKeyFromRequest(req) {
    if (!req || typeof req !== 'object') return null;

    if (typeof req.apiKey === 'string' && req.apiKey.trim()) {
        return req.apiKey.trim();
    }
    if (req.body && typeof req.body.apiKey === 'string' && req.body.apiKey.trim()) {
        return req.body.apiKey.trim();
    }
    if (req.query && typeof req.query.apiKey === 'string' && req.query.apiKey.trim()) {
        return req.query.apiKey.trim();
    }
    if (req.headers) {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (authHeader && typeof authHeader === 'string') {
            const match = authHeader.match(/^Bearer\s+(.+)$/i);
            if (match && match[1]?.trim()) {
                return match[1].trim();
            }
        }
        const customKeyHeader = req.headers['x-gemini-api-key'] || req.headers['X-Gemini-Api-Key'];
        if (customKeyHeader && typeof customKeyHeader === 'string' && customKeyHeader.trim()) {
            return customKeyHeader.trim();
        }
    }
    return null;
}

/**
 * Resolve API Key in priority order:
 * 1. Per-request key:
 *    - explicitKey (string)
 *    - request.apiKey (if request/payload object passed)
 *    - Authorization: Bearer <KEY> header
 *    - x-gemini-api-key header
 * 2. process.env.GEMINI_API_KEY (and fallback VITE_API_KEY / API_KEY)
 * 3. Local .smpg_config.json (fallback for local CLI only, skipped in production)
 * 4. Empty string
 */
export function resolveApiKey(explicitKeyOrReq = null) {
    if (typeof explicitKeyOrReq === 'string' && explicitKeyOrReq.trim()) {
        return explicitKeyOrReq.trim();
    }

    if (explicitKeyOrReq && typeof explicitKeyOrReq === 'object') {
        const fromReq = extractApiKeyFromRequest(explicitKeyOrReq);
        if (fromReq) return fromReq;
    }

    const envKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
        return envKey.trim();
    }

    if (!isProduction) {
        const config = loadConfig();
        if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.trim()) {
            return config.apiKey.trim();
        }
    }

    return "";
}
