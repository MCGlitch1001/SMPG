import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'data/quotes_db.json');

/**
 * Load the complete JSON quote database
 */
export function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        }
    } catch (e) {
        console.warn('Warning: Could not read quotes database:', e.message);
    }
    return {};
}

/**
 * Save database to file
 */
export function saveDatabase(data) {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('Error saving database:', e.message);
        return false;
    }
}

/**
 * List all available categories in the database
 */
export function listCategories() {
    const db = loadDatabase();
    return Object.keys(db).map(category => ({
        category,
        count: (db[category] || []).length
    }));
}

/**
 * Retrieve quotes from database by category or search query
 */
export function getQuotesFromDatabase({ category = null, query = null, count = 3 }) {
    const db = loadDatabase();
    let candidates = [];

    if (category && db[category.toLowerCase()]) {
        candidates = db[category.toLowerCase()];
    } else if (category) {
        // Fuzzy match category
        const key = Object.keys(db).find(k => k.toLowerCase().includes(category.toLowerCase()));
        if (key) candidates = db[key];
    }

    if (candidates.length === 0 && query) {
        // Search quotes across all categories
        const searchLower = query.toLowerCase();
        for (const cat of Object.keys(db)) {
            for (const q of db[cat]) {
                if (q.toLowerCase().includes(searchLower)) {
                    candidates.push(q);
                }
            }
        }
    }

    // Fallback: if nothing matched, pool all quotes
    if (candidates.length === 0) {
        candidates = Object.values(db).flat();
    }

    // Shuffle and pick `count`
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Add quotes to a category in the database
 */
export function addQuotesToDatabase(category, newQuotes = []) {
    if (!category || !Array.isArray(newQuotes) || newQuotes.length === 0) return false;
    const db = loadDatabase();
    const cat = category.toLowerCase().trim();
    if (!db[cat]) db[cat] = [];

    for (const q of newQuotes) {
        const trimmed = q.trim().toUpperCase();
        if (trimmed && !db[cat].includes(trimmed)) {
            db[cat].push(trimmed);
        }
    }

    return saveDatabase(db);
}
