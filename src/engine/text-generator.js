import fs from 'fs';
import path from 'path';
import { resolveApiKey } from './config.js';
import { getQuotesFromDatabase } from './database.js';

const HISTORY_FILE = path.resolve(process.cwd(), '.smpg_history.json');

// Deduplication memory helper
export function getUsedQuotes() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }
    } catch {
        // Fallback gracefully
    }
    return [];
}

export function saveUsedQuotes(newQuotes) {
    try {
        const history = getUsedQuotes();
        const updatedHistory = [...newQuotes, ...history].slice(0, 300);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
    } catch {
        // Fallback gracefully
    }
}

/**
 * Generate or resolve content across 3 choices:
 * 1. "json": Explicitly provided quotes in the request (zero API key needed)
 * 2. "db": Pulled from local JSON quotes database (zero API key needed)
 * 3. "ai": Generated with Gemini AI using configured/provided API key (falls back to db if no key)
 */
export async function generateContent({
    contentSource = null, // "ai" | "json" | "db"
    topic = "Unrelenting discipline",
    mode = "carousel",
    numPosts = 1,
    slidesPerPost = 3,
    apiKey = null,
    model = "gemini-2.5-flash",
    providedQuotes = null,
    dbCategory = null,
    providedBackgroundPrompt = null
}) {
    // 1. Determine Source
    let resolvedSource = (contentSource || "").toLowerCase();
    if (!resolvedSource) {
        if (providedQuotes && Array.isArray(providedQuotes) && providedQuotes.length > 0) {
            resolvedSource = "json";
        } else if (dbCategory) {
            resolvedSource = "db";
        } else {
            resolvedSource = "ai";
        }
    }

    // CHOICE 1: Explicit JSON Quotes (No API key needed)
    if (resolvedSource === 'json' && providedQuotes && Array.isArray(providedQuotes) && providedQuotes.length > 0) {
        return {
            contentSource: 'json',
            posts: [{
                backgroundPrompt: providedBackgroundPrompt || `${topic}, dark moody cinematic lighting, high contrast minimalist aesthetic`,
                quotes: providedQuotes
            }]
        };
    }

    // CHOICE 2: Pull from Local JSON Quotes Database (No API key needed)
    if (resolvedSource === 'db') {
        const dbQuotes = getQuotesFromDatabase({
            category: dbCategory || topic,
            query: topic,
            count: mode === 'reel' ? 1 : slidesPerPost
        });

        return {
            contentSource: 'db',
            posts: [{
                backgroundPrompt: providedBackgroundPrompt || `${topic}, obsidian marble, dark cinematic shadows, high contrast`,
                quotes: dbQuotes
            }]
        };
    }

    // CHOICE 3: AI Generation (Gemini)
    // Resolve API key in priority: explicit argument -> stored in app config -> environment variable
    const activeKey = resolveApiKey(apiKey);

    const history = getUsedQuotes();
    const antiRepetitionPrompt = history.length > 0
        ? `CRITICAL RULE: DO NOT use any of these past quotes or anything semantically similar:\n${JSON.stringify(history.slice(0, 40))}`
        : "";

    if (activeKey) {
        try {
            let promptText = "";
            if (mode === 'reel') {
                promptText = `Create ${numPosts} distinct Reel concept(s) about: "${topic}".
The tone MUST be hardcore, gritty, unapologetic, stoic, and focused on grinding/success mentality (millionaire/hustler aesthetic).
Since this is for a Reel, write 1 single long, high-quality, impactful, and poetic quote or monologue that grabs attention (about 40-70 words).
Write a single prompt to generate a dark, moody, high-contrast, cinematic background image in a 9:16 aspect ratio.
${antiRepetitionPrompt}
Return ONLY a valid JSON object matching this schema exactly:
{ "posts": [ { "backgroundPrompt": "A serene minimalist landscape...", "quotes": ["quote text"] } ] }`;
            } else {
                promptText = `Create ${numPosts} distinct Instagram carousel concepts about: "${topic}".
The tone MUST be hardcore, gritty, unapologetic, stoic, and focused on grinding/success mentality (millionaire/hustler aesthetic).
Each post must have exactly ${slidesPerPost} short, aggressive, punchy quotes. Keep them brief, punchy, memorable.
For EACH post, write a single prompt to generate a dark, moody, high-contrast, cinematic background image.
${antiRepetitionPrompt}
Return ONLY a valid JSON object matching this schema exactly:
{ "posts": [ { "backgroundPrompt": "A serene minimalist landscape...", "quotes": ["quote 1", "quote 2", "quote 3"] } ] }`;
            }

            const payload = {
                contents: [{
                    parts: [{ text: promptText }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            posts: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        backgroundPrompt: { type: "STRING" },
                                        quotes: { type: "ARRAY", items: { type: "STRING" } }
                                    },
                                    required: ["backgroundPrompt", "quotes"]
                                }
                            }
                        },
                        required: ["posts"]
                    }
                }
            };

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(`Gemini API Error [${response.status}]: ${errJson.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) {
                throw new Error("No candidate content returned from Gemini API");
            }

            const parsed = JSON.parse(textResponse);
            return {
                contentSource: 'ai',
                ...parsed
            };
        } catch (err) {
            console.warn(`[TextGenerator] Gemini API generation failed (${err.message}). Falling back to local database.`);
        }
    }

    // Seamless Fallback to local quotes database when API key is missing or calls fail
    const posts = [];
    for (let p = 0; p < numPosts; p++) {
        const dbQuotes = getQuotesFromDatabase({
            category: topic,
            query: topic,
            count: mode === 'reel' ? 1 : slidesPerPost
        });

        posts.push({
            backgroundPrompt: providedBackgroundPrompt || `${topic}, dark cinematic atmosphere, obsidian marble, high contrast dramatic shadows, 8k luxury aesthetic`,
            quotes: dbQuotes
        });
    }

    return {
        contentSource: activeKey ? 'fallback_db' : 'db',
        posts
    };
}
