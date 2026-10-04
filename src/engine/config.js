import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.resolve(process.cwd(), '.smpg_config.json');

/**
 * Load persisted config from local file
 */
export function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch {
        // Ignore read errors
    }
    return {};
}

/**
 * Save config object to local file
 */
export function saveConfig(updates = {}) {
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
 * Resolve API Key in priority order:
 * 1. Explicitly passed argument (from workflow or request)
 * 2. Stored inside the app config file (.smpg_config.json)
 * 3. Environment variables (GEMINI_API_KEY, VITE_API_KEY, API_KEY)
 * 4. Empty string (if not needed, e.g. for JSON/manual or DB quote mode)
 */
export function resolveApiKey(explicitKey = null) {
    if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
        return explicitKey.trim();
    }

    const config = loadConfig();
    if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.trim()) {
        return config.apiKey.trim();
    }

    return process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.API_KEY || "";
}
