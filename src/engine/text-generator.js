import fs from 'fs';
import path from 'path';

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

// Built-in fallback quote bank for offline/agent testing when no API key is set
const FALLBACK_BANK = {
    stoic: [
        ["WE SUFFER MORE OFTEN IN IMAGINATION THAN IN REALITY.", "CONTROL WHAT YOU CAN. DISMISS THE REST.", "THE OBSTACLE DOES NOT STOP THE PATH. IT IS THE PATH."],
        ["SUFFER IN SILENCE. WORK IN THE DARK.", "LET THEM SPECULATE WHILE YOU EXECUTE.", "TRUE DISCIPLINE NEEDS NO AUDIENCE."]
    ],
    discipline: [
        ["DISCIPLINE IS CHOOSING BETWEEN WHAT YOU WANT NOW AND WHAT YOU WANT MOST.", "MOTIVATION GETS YOU STARTED. RUTHLESS HABIT KEEPS YOU GOING.", "DO WHAT MUST BE DONE, REGARDLESS OF EMOTION."],
        ["THE PRICE OF EXCELLENCE IS CONSTANT VIGILANCE.", "COMFORT IS THE GREATEST THIEF OF POTENTIAL.", "EXECUTE WITHOUT EXCUSE."]
    ],
    grind: [
        ["WHILE THEY SLEEP, YOU BUILD.", "THE 1% ARE NOT LUCKIER. THEY ARE UNRELENTING.", "FALL IN LOVE WITH THE MONOTONY OF WINNING."],
        ["NO SHORTCUTS. NO HANDOUTS. NO CEILING.", "BUILD AN EMPIRE THAT SPEAKS FOR ITSELF.", "RELENTLESS EXECUTION BEATS NATURAL TALENT EVERY TIME."]
    ]
};

export async function generateContent({
    topic = "Unrelenting discipline",
    mode = "carousel",
    numPosts = 1,
    slidesPerPost = 3,
    apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.API_KEY || "",
    model = "gemini-2.5-flash",
    providedQuotes = null,
    providedBackgroundPrompt = null
}) {
    // If quotes are explicitly supplied by the caller, format them directly
    if (providedQuotes && Array.isArray(providedQuotes) && providedQuotes.length > 0) {
        return {
            posts: [{
                backgroundPrompt: providedBackgroundPrompt || `${topic}, dark moody cinematic lighting, high contrast minimalist aesthetic`,
                quotes: providedQuotes
            }]
        };
    }

    const history = getUsedQuotes();
    const antiRepetitionPrompt = history.length > 0
        ? `CRITICAL RULE: DO NOT use any of these past quotes or anything semantically similar:\n${JSON.stringify(history.slice(0, 40))}`
        : "";

    if (apiKey) {
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

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
            return parsed;
        } catch (err) {
            console.warn(`[TextGenerator] Gemini API generation failed (${err.message}). Falling back to algorithmic engine.`);
        }
    }

    // Fallback algorithmic generation
    const posts = [];
    for (let p = 0; p < numPosts; p++) {
        let quotes = [];
        if (mode === 'reel') {
            quotes = [
                `THEY WANT THE RESULT WITHOUT THE ANONYMOUS SUFFERING. YOU CANNOT CHEAT THE GRIND. WHEN NOBODY IS WATCHING, THAT IS WHEN THE CHAMPION IS FORGED. LOCK IN, SHUT OUT THE NOISE, AND LET YOUR RESILIENCE SPEAK FOR ITSELF.`
            ];
        } else {
            const categoryKeys = Object.keys(FALLBACK_BANK);
            const chosenCategory = FALLBACK_BANK[categoryKeys[p % categoryKeys.length]];
            const baseQuotes = chosenCategory[p % chosenCategory.length];
            quotes = baseQuotes.slice(0, slidesPerPost);
            while (quotes.length < slidesPerPost) {
                quotes.push(`DISCIPLINE OUTLASTS MOTIVATION. STEP ${quotes.length + 1} OF THE ASCENT.`);
            }
        }

        posts.push({
            backgroundPrompt: `${topic}, dark cinematic atmosphere, obsidian marble, high contrast dramatic shadows, 8k luxury aesthetic`,
            quotes
        });
    }

    return { posts };
}
