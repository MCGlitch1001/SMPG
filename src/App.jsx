import React, { useState, useRef, useEffect } from 'react';
import { Download, Image as ImageIcon, Loader2, Wand2, Type, RefreshCw, CheckCircle2, ArrowRight, Package, Settings, Edit3, UploadCloud, Plus, Trash2, Zap } from 'lucide-react';

// Removed hardcoded apiKey to use state-based configuration bridge

// Exponential Backoff Fetch with Detailed Error Diagnostics
const fetchWithRetry = async (url, options, maxRetries = 3) => {
    let retries = 0;
    const delays = [1000, 2000, 4000];
    while (retries <= maxRetries) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const message = errorBody.error?.message || response.statusText;
                throw new Error(`API Error [${response.status}]: ${message}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed:`, error.message);
            if (retries >= maxRetries) throw error;
            await new Promise(res => setTimeout(res, delays[retries]));
            retries++;
        }
    }
};

// Helper to dynamically load external scripts without bundler errors
const loadExternalScript = (url, globalName) => {
    return new Promise((resolve, reject) => {
        if (window[globalName]) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

const VIBE_PRESETS = [
    "Unrelenting discipline, 1% mindset, success",
    "Stoicism, inner strength, quiet power",
    "Gym motivation, pushing physical limits",
    "Dark luxury, old money, silent wealth",
    "Entrepreneur grind, building an empire",
    "Mamba mentality, sports psychology, winning",
    "Deep focus, monk mode, minimalist hustle",
    "Escaping the matrix, financial freedom",
    "Villain arc, proving them wrong, comeback",
    "Late nights, coding, tech startup grind"
];

const PRO_PALETTE = [
    "#000000", "#09090b", "#27272a", "#52525b", "#a1a1aa", "#ffffff",
    "#ef4444", "#7f1d1d", "#f97316", "#ea580c", "#eab308", "#22c55e",
    "#166534", "#14b8a6", "#3b82f6", "#1e40af", "#7c3aed", "#4c1d95",
    "#d4af37", "#b45309"
];

// Hexagon Grid Generator with HSL mapping
const generateHoneycomb = (rings = 6, radius = 9) => {
    const cells = [];
    const hexHeight = Math.sqrt(3) * radius;
    const hexWidth = 2 * radius;
    
    for (let q = -rings; q <= rings; q++) {
        for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
            const x = q * (hexWidth * 0.75);
            const y = (r + q / 2) * hexHeight;
            
            // Calculate HSL based on position
            const angle = Math.atan2(y, x) * (180 / Math.PI);
            const dist = Math.sqrt(x * x + y * y);
            const maxDist = rings * (hexWidth * 0.75);
            
            // Center is white, outer is pure color
            const h = (angle + 360) % 360;
            const s = Math.min(100, (dist / maxDist) * 100);
            const l = Math.max(50, 100 - (dist / maxDist) * 50);
            
            // Convert HSL to Hex
            const hex = hslToHex(h, s, l);
            cells.push({ q, r, x, y, hex });
        }
    }
    return cells;
};

const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

function CustomColorPicker({ color, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef(null);
    const [honeycomb, setHoneycomb] = useState([]);

    useEffect(() => {
        setHoneycomb(generateHoneycomb(6, 12));
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={pickerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-500 transition-all group"
            >
                <div 
                    className="w-10 h-10 rounded shadow-inner border border-white/10" 
                    style={{ backgroundColor: color }}
                />
                <span className="font-mono text-sm tracking-widest uppercase font-bold text-zinc-400 group-hover:text-zinc-100 italic">
                    {color}
                </span>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 p-5 bg-zinc-900/98 backdrop-blur-2xl border border-zinc-700/50 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-[320px] animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="space-y-6">
                        {/* Swatches Grid */}
                        <div>
                            <p className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-[0.2em]">Master Palette</p>
                            <div className="grid grid-cols-5 gap-2">
                                {PRO_PALETTE.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => { onChange(p); setIsOpen(false); }}
                                        className={`w-full aspect-square rounded-md border border-white/10 hover:scale-110 transition-all ${color === p ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`}
                                        style={{ backgroundColor: p }}
                                        title={p}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* High-Density Honeycomb */}
                        <div className="flex flex-col items-center">
                            <p className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-[0.2em] w-full text-left">RGB Honeycomb</p>
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5 w-full flex justify-center overflow-visible">
                                <svg width="250" height="220" viewBox="-125 -110 250 220" className="overflow-visible">
                                    {honeycomb.map((cell, i) => {
                                        const isSelected = color.toUpperCase() === cell.hex;
                                        return (
                                            <path
                                                key={i}
                                                d="M 10.39 0 L 5.2 9 L -5.2 9 L -10.39 0 L -5.2 -9 L 5.2 -9 Z"
                                                transform={`translate(${cell.x}, ${cell.y})`}
                                                fill={cell.hex}
                                                onClick={() => { onChange(cell.hex); setIsOpen(false); }}
                                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                                style={{ stroke: isSelected ? 'white' : 'rgba(255,255,255,0.1)', strokeWidth: isSelected ? '2px' : '0.5px' }}
                                            />
                                        );
                                    })}
                                </svg>
                            </div>
                        </div>

                        {/* Visual State & Manual Input */}
                        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
                            <div className="w-8 h-8 rounded border border-white/10" style={{ backgroundColor: color }} />
                            <input 
                                type="text"
                                value={color}
                                onChange={(e) => onChange(e.target.value)}
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-center outline-none focus:border-zinc-500 italic uppercase tracking-widest"
                                placeholder="#000000"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || "");

    useEffect(() => {
        const loadConfig = async () => {
            // If apiKey is missing (standard in pre-built Cloudflare deployments), fetch from runtime bridge
            if (!apiKey) {
                console.log("Config: Local key missing. Synchronizing with Cloudflare Engine...");
                try {
                    const res = await fetch('/api/config');
                    const data = await res.json();
                    if (data.apiKey) {
                        setApiKey(data.apiKey);
                        console.log("System Status: API Engine Linked.");
                    } else {
                        console.warn("CRITICAL: VITE_API_KEY is not defined in Cloudflare Environment.");
                        setError("Configuration Error: API Key is missing. Please check Cloudflare Environment Variables.");
                    }
                } catch (e) {
                    console.error("Config Sync Failed:", e);
                    setError("System Error: Failed to link with Cloudflare configuration bridge.");
                }
            } else {
                console.log("System Status: Build-time Key Active.");
            }
        };
        loadConfig();
    }, [apiKey]);

    // App State
    const [step, setStep] = useState(1); // 1: Config, 2: Loading AI, 3: Review/Edit, 4: Rendering Canvas, 5: Done
    const [topic, setTopic] = useState(VIBE_PRESETS[0]);
    const [showVibes, setShowVibes] = useState(false);
    const [createMode, setCreateMode] = useState('carousel'); // 'carousel' or 'reel'
    const [numPosts, setNumPosts] = useState(3);
    const [minSlides, setMinSlides] = useState(2);
    const [maxSlides, setMaxSlides] = useState(6);
    const [error, setError] = useState("");
    const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, text: "" });
    const [drafts, setDrafts] = useState([]); // Array of { id, bgPrompt, bgUrl, quotes: [] }
    const [finalPosts, setFinalPosts] = useState([]);
    const [isZipping, setIsZipping] = useState(false);
    const [isRedoing, setIsRedoing] = useState({}); // Track which image is regenerating

    // Memory System for Deduplication
    const getUsedQuotes = () => {
        try {
            return JSON.parse(localStorage.getItem('smpg_history')) || [];
        } catch { return []; }
    };

    const saveUsedQuotes = (newQuotes) => {
        const history = getUsedQuotes();
        const updatedHistory = [...newQuotes, ...history].slice(0, 200);
        localStorage.setItem('smpg_history', JSON.stringify(updatedHistory));
    };

    // 1A. Start Manual Mode
    const startManualMode = () => {
        const postsToCreate = createMode === 'reel' ? 1 : numPosts;
        const emptyDrafts = Array.from({ length: postsToCreate }).map((_, i) => ({
            id: Date.now() + i,
            bgPrompt: "", // Empty so user can type
            bgUrl: null,
            bgMode: 'image', // 'image' or 'color'
            bgColor: '#09090b', // Default dark zinc
            quotes: Array(createMode === 'reel' ? 1 : minSlides).fill(""),
            createMode: createMode
        }));
        setDrafts(emptyDrafts);
        setStep(3);
    };

    // 1B. Generate Content (Auto Mode)
    const handleGenerateContent = async () => {
        const postsToGenerate = createMode === 'reel' ? 1 : numPosts;
        if (!topic || postsToGenerate < 1 || postsToGenerate > 20) {
            setError("Please enter a topic and a valid number of posts (1-20).");
            return;
        }
        setStep(2);
        setError("");
        setProgressInfo({ current: 0, total: 0, text: "Brainstorming hardcore concepts with AI..." });

        try {
            const history = getUsedQuotes();
            let antiRepetitionPrompt = "";
            if (history.length > 0) {
                antiRepetitionPrompt = `CRITICAL RULE: DO NOT use any of these past quotes or anything semantically similar:\n${JSON.stringify(history.slice(0, 50))}`;
            }

            let promptText = "";
            if (createMode === 'reel') {
                promptText = `Create 1 distinct Reel concept about: "${topic}".
            The tone MUST be hardcore, gritty, unapologetic, stoic, and focused on grinding/success mentality (millionaire/hustler aesthetic).
            Since this is for a Reel, write 1 single long, high-quality, impactful, and poetic quote or monologue that grabs attention (about 40-70 words).
            Write a single prompt to generate a dark, moody, high-contrast, cinematic background image in a 9:16 aspect ratio.
            ${antiRepetitionPrompt}
            Return ONLY a valid JSON object matching this schema exactly:
            { "posts": [ { "backgroundPrompt": "A serene minimalist landscape...", "quotes": ["quote text"] } ] }`;
            } else {
                promptText = `Create ${postsToGenerate} distinct Instagram carousel concepts about: "${topic}".
            The tone MUST be hardcore, gritty, unapologetic, stoic, and focused on grinding/success mentality (millionaire/hustler aesthetic).
            Each post must have between ${minSlides} and ${maxSlides} short, aggressive, punchy quotes. Keep them brief.
            For EACH post, write a single prompt to generate a dark, moody, high-contrast, cinematic background image.
            ${antiRepetitionPrompt}
            Return ONLY a valid JSON object matching this schema exactly:
            { "posts": [ { "backgroundPrompt": "A serene minimalist landscape...", "quotes": ["quote 1", "quote 2"] } ] }`;
            }

            const payload = {
                contents: [{
                    parts: [{
                        text: promptText
                    }]
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

            const result = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
            );

            const responseText = result.candidates[0].content.parts[0].text;
            const data = JSON.parse(responseText);
            const postsData = data.posts.slice(0, numPosts);

            await generateInitialImages(postsData);

        } catch (err) {
            console.error(err);
            setError(`Failed to generate text content: ${err.message}`);
            setStep(1);
        }
    };

    // 2. Fetch Initial Images (Auto Mode)
    const generateInitialImages = async (postsData) => {
        let currentDrafts = [];

        for (let i = 0; i < postsData.length; i++) {
            setProgressInfo({
                current: i + 1, total: postsData.length,
                text: `Generating dark aesthetics ${i + 1} of ${postsData.length}...`
            });

            try {
                const imgUrl = await fetchSingleImage(postsData[i].backgroundPrompt, createMode);
                currentDrafts.push({ id: Date.now() + i, ...postsData[i], bgUrl: imgUrl, bgMode: 'image', bgColor: '#09090b', createMode: createMode });
                if (i < postsData.length - 1) await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`Failed image ${i + 1}`, err);
                currentDrafts.push({ id: Date.now() + i, ...postsData[i], bgUrl: null, bgMode: 'image', bgColor: '#09090b', createMode: createMode });
            }
        }

        setDrafts(currentDrafts);
        setStep(3);
    };

    // Helper for Imagen API
    const fetchSingleImage = async (prompt, mode = 'carousel') => {
        const fullPrompt = `${prompt}. Dark aesthetic, moody, high contrast, cinematic lighting, desaturated, gritty, luxury, 8k resolution, instagram aesthetic`;
        const randomSeed = Math.floor(Math.random() * 1000000000);
        const width = 1080;
        const height = mode === 'reel' ? 1920 : 1080;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}&model=flux`;
        
        // Fetch the image from pollinations
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Image engine failed: ${response.statusText}`);
        const blob = await response.blob();
        
        // Convert to Base64 for the app's canvas and EXIF logic
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    };

    // --- STUDIO / REVIEW ACTIONS ---

    const handleGenerateImage = async (index) => {
        const promptToUse = drafts[index].bgPrompt.trim();
        if (!promptToUse) {
            alert("Please type a prompt first.");
            return;
        }

        setIsRedoing(prev => ({ ...prev, [index]: true }));
        try {
            // If the URL exists, we are "redoing", so add a variation hint to force a slightly different output
            const finalPrompt = promptToUse + (drafts[index].bgUrl ? " variation" : "");
            const newUrl = await fetchSingleImage(finalPrompt, drafts[index].createMode);

            const newDrafts = [...drafts];
            newDrafts[index].bgUrl = newUrl;
            setDrafts(newDrafts);
        } catch (err) {
            setError(`Image Generation Failed: ${err.message}`);
        } finally {
            setIsRedoing(prev => ({ ...prev, [index]: false }));
        }
    };

    const updateDraft = (postIndex, field, value) => {
        const newDrafts = [...drafts];
        newDrafts[postIndex][field] = value;
        setDrafts(newDrafts);
    };

    const updateBgPrompt = (postIndex, text) => {
        updateDraft(postIndex, 'bgPrompt', text);
    };

    const handleUploadImage = (index, event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newDrafts = [...drafts];
                newDrafts[index].bgUrl = e.target.result;
                setDrafts(newDrafts);
            };
            reader.readAsDataURL(file);
        }
    };

    const updateQuote = (postIndex, quoteIndex, text) => {
        const newDrafts = [...drafts];
        newDrafts[postIndex].quotes[quoteIndex] = text;
        setDrafts(newDrafts);
    };

    const addSlide = (postIndex) => {
        const newDrafts = [...drafts];
        newDrafts[postIndex].quotes.push("");
        setDrafts(newDrafts);
    };

    const removeSlide = (postIndex, quoteIndex) => {
        const newDrafts = [...drafts];
        newDrafts[postIndex].quotes.splice(quoteIndex, 1);
        setDrafts(newDrafts);
    };

    const handleAddPost = () => {
        setDrafts([...drafts, {
            id: Date.now(),
            bgPrompt: "",
            bgUrl: null,
            bgMode: 'image',
            bgColor: '#09090b',
            quotes: Array(createMode === 'reel' ? 1 : minSlides).fill(""),
            createMode: createMode
        }]);
    };

    const handleDeletePost = (id) => {
        setDrafts(drafts.filter(d => d.id !== id));
    };

    const generateCaption = (firstQuote) => {
        const baseQuote = firstQuote || "Lock in";
        return `${baseQuote}...\n#mindset #mentality #motivation #discipline #success`;
    };

    // --- RENDERING PHASE ---
    const startFinalRender = async () => {
        const missingImages = drafts.some(d => d.bgMode === 'image' && !d.bgUrl);
        if (missingImages) {
            alert("Please generate or upload a background image for every post, or switch them to solid color mode.");
            return;
        }

        setStep(4);
        const renderedPosts = [];
        const allQuotesThisSession = drafts.flatMap(d => d.quotes);
        saveUsedQuotes(allQuotesThisSession);

        try {
            await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/piexifjs/1.0.6/piexif.js', 'piexif');
        } catch (err) {
            console.warn("Could not load EXIF metadata library. Images will render without invisible tags.");
        }

        for (let i = 0; i < drafts.length; i++) {
            setProgressInfo({
                current: i + 1, total: drafts.length,
                text: `Typesetting text for post ${i + 1} of ${drafts.length}...`
            });

            const caption = generateCaption(drafts[i].quotes[0]);
            const slides = await renderPostSlides(drafts[i], caption);
            renderedPosts.push({ postNum: i + 1, slides, caption });
        }

        setFinalPosts(renderedPosts);
        setStep(5);
    };

    // Canvas Helper Logic (HARDCORE AESTHETIC)
    const renderPostSlides = async (draft, caption) => {
        const loadImage = (src) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.src = src;
        });

        let bgImage = null;
        if (draft.bgMode === 'image' && draft.bgUrl) {
            bgImage = await loadImage(draft.bgUrl);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = draft.createMode === 'reel' ? 1920 : 1080;
        const ctx = canvas.getContext('2d');
        const generatedSlides = [];
        const quotes = draft.quotes;

        for (let i = 0; i < quotes.length; i++) {
            if (bgImage) {
                const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height);
                const x = (canvas.width / 2) - (bgImage.width / 2) * scale;
                const y = (canvas.height / 2) - (bgImage.height / 2) * scale;
                ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = draft.bgColor || '#09090b';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.font = `900 250px Georgia, serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('"', canvas.width / 2, 280);

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const maxTextWidth = 850;
            const fontSize = draft.createMode === 'reel' ? 65 : 85;
            const lineHeight = fontSize * 1.2;
            ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;

            const textToRender = quotes[i].toUpperCase();
            const words = textToRender.split(' ');
            let line = '';
            const lines = [];

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxTextWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            const totalHeight = lines.length * lineHeight;
            let startY = (canvas.height - totalHeight) / 2 + (lineHeight / 2);

            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 8;

            for (let j = 0; j < lines.length; j++) {
                ctx.fillText(lines[j].trim(), canvas.width / 2, startY + (j * lineHeight));
            }

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            if (draft.createMode !== 'reel') {
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.font = `600 30px "Arial", sans-serif`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.letterSpacing = "5px";
                ctx.fillText(`${i + 1} / ${quotes.length}`, canvas.width / 2, canvas.height - 60);
            }

            let dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            try {
                if (window.piexif) {
                    const zeroth = {};
                    zeroth[window.piexif.ImageIFD.ImageDescription] = `${caption}\n\nLocation: New York USA`;
                    zeroth[window.piexif.ImageIFD.Software] = "SMPG by Dalvi Consultancy";
                    const exifObj = { "0th": zeroth, "Exif": {}, "GPS": {} };
                    const exifbytes = window.piexif.dump(exifObj);
                    dataUrl = window.piexif.insert(exifbytes, dataUrl);
                }
            } catch (e) {
                console.error("EXIF injection failed", e);
            }

            generatedSlides.push(dataUrl);
        }
        return generatedSlides;
    };

    // ZIP Download Logic
    const downloadAllAsZip = async () => {
        setIsZipping(true);
        try {
            await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
            const JSZip = window.JSZip;
            const zip = new JSZip();

            finalPosts.forEach(post => {
                const folderName = `Post_${post.postNum.toString().padStart(2, '0')}`;
                const folder = zip.folder(folderName);
                post.slides.forEach((slideSrc, idx) => {
                    const base64Data = slideSrc.split(',')[1];
                    folder.file(`slide_${idx + 1}.jpg`, base64Data, { base64: true });
                });
                folder.file('caption.txt', post.caption);
            });

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `hardcore_carousel_batch_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error(err);
            alert("An error occurred while creating the ZIP file.");
        } finally {
            setIsZipping(false);
        }
    };

    const handleNavClick = (targetStepIndex) => {
        if (targetStepIndex === 1) setStep(1);
        if (targetStepIndex === 2 && drafts.length > 0) setStep(3);
        if (targetStepIndex === 3 && finalPosts.length > 0) setStep(5);
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8 gap-2">
            {[1, 2, 3].map(s => {
                const mappedStep = step === 1 ? 1 : (step === 2 || step === 3) ? 2 : 3;
                const labels = ["Setup", "Studio Review", "Export"];

                let isClickable = false;
                if (s === 1) isClickable = true;
                if (s === 2 && drafts.length > 0) isClickable = true;
                if (s === 3 && finalPosts.length > 0) isClickable = true;

                return (
                    <div key={s} className="flex items-center gap-2">
                        <button
                            onClick={() => isClickable ? handleNavClick(s) : null}
                            disabled={!isClickable}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition-all
                          ${mappedStep >= s ? 'bg-zinc-100 text-zinc-950 shadow-lg' : 'bg-zinc-800 text-zinc-500'} 
                          ${isClickable && mappedStep !== s ? 'hover:bg-zinc-300 hover:text-zinc-900 cursor-pointer' : ''}
                          ${!isClickable && mappedStep !== s ? 'cursor-not-allowed opacity-50' : ''}
                      `}
                        >
                            {s}. {labels[s - 1]}
                        </button>
                        {s < 3 && <div className={`w-8 h-1 rounded-full ${mappedStep > s ? 'bg-zinc-100' : 'bg-zinc-800'}`} />}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col font-sans selection:bg-zinc-500/30">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                <header className="flex justify-between items-center mb-10 border-b border-zinc-900 pb-6 px-4">
                    <div className="w-20"></div> {/* Spacer for symmetry */}
                    <div className="text-center flex flex-col items-center flex-1">
                        <h1 className="text-5xl font-black tracking-widest text-white uppercase inline-flex items-center gap-3">
                            <Zap className="w-10 h-10 text-white fill-white" /> SMPG
                        </h1>
                        <p className="text-zinc-500 font-bold uppercase tracking-[0.4em] text-sm mt-3">New York, USA</p>
                    </div>
                    <div className="w-20"></div> {/* Spacer for symmetry */}
                </header>

                {renderStepIndicator()}

                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-center font-bold">
                        {error}
                    </div>
                )}

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden mb-8">
                    {/* STEP 1: INPUT */}
                    {step === 1 && (
                        <div className="p-8 space-y-8 animate-in fade-in">
                            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-2">
                                <button 
                                    onClick={() => setCreateMode('carousel')} 
                                    className={`flex-1 py-3 text-sm font-bold uppercase rounded-md transition-all ${createMode === 'carousel' ? 'bg-zinc-100 text-zinc-900 shadow-md' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    6 Posts / Carousels
                                </button>
                                <button 
                                    onClick={() => setCreateMode('reel')} 
                                    className={`flex-1 py-3 text-sm font-bold uppercase rounded-md transition-all ${createMode === 'reel' ? 'bg-zinc-100 text-zinc-900 shadow-md' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    1 Reel (9:16)
                                </button>
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-bold text-zinc-300 mb-2 uppercase tracking-wider">What's the Master Vibe?</label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    onFocus={() => setShowVibes(true)}
                                    onBlur={() => setTimeout(() => setShowVibes(false), 200)}
                                    placeholder="Type a custom vibe or select below..."
                                    className="w-full bg-zinc-950 border-2 border-zinc-800 text-white rounded-lg px-5 py-4 outline-none focus:border-zinc-400 transition-all text-xl font-medium"
                                />
                                {showVibes && (
                                    <div className="absolute z-20 w-full mt-2 bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto hide-scrollbar">
                                        {VIBE_PRESETS.map((vibe, idx) => (
                                            <div
                                                key={idx}
                                                className="px-5 py-4 hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0 font-medium"
                                                onClick={() => { setTopic(vibe); setShowVibes(false); }}
                                            >
                                                {vibe}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {createMode === 'carousel' && (
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="p-6 bg-zinc-950 rounded-lg border border-zinc-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-sm font-bold text-zinc-300 flex items-center gap-2 uppercase"><Settings className="w-4 h-4" /> Post Count</label>
                                            <span className="text-zinc-100 font-black text-xl">{numPosts}</span>
                                        </div>
                                        <input
                                            type="range" min="1" max="20"
                                            value={numPosts} onChange={(e) => setNumPosts(Number(e.target.value))}
                                            className="w-full accent-zinc-100"
                                        />
                                    </div>

                                    <div className="p-6 bg-zinc-950 rounded-lg border border-zinc-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-sm font-bold text-zinc-300 flex items-center gap-2 uppercase"><Type className="w-4 h-4" /> Slides / Post</label>
                                            <span className="text-zinc-100 font-black text-xl">{minSlides} - {maxSlides}</span>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <input
                                                    type="number" min="1" max={maxSlides} value={minSlides} onChange={(e) => setMinSlides(Number(e.target.value))}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white outline-none focus:border-zinc-400 font-bold"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="number" min={minSlides} max="10" value={maxSlides} onChange={(e) => setMaxSlides(Number(e.target.value))}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white outline-none focus:border-zinc-400 font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-zinc-800">
                                <button
                                    onClick={handleGenerateContent}
                                    className="w-full py-5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg font-black text-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wide"
                                >
                                    <Wand2 className="w-6 h-6" /> Auto Generate with AI
                                </button>
                                <button
                                    onClick={startManualMode}
                                    className="w-full py-5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wide"
                                >
                                    <Edit3 className="w-6 h-6" /> Manual Setup
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 & 4: LOADING STATES */}
                    {(step === 2 || step === 4) && (
                        <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in">
                            <Loader2 className="w-16 h-16 text-zinc-100 animate-spin" />
                            <div className="max-w-md w-full">
                                <h3 className="text-2xl font-bold text-zinc-100 mb-4 tracking-tight">
                                    {progressInfo.text}
                                </h3>
                                {progressInfo.total > 0 && (
                                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                                        <div
                                            className="bg-zinc-100 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(progressInfo.current / progressInfo.total) * 100}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: REVIEW STUDIO */}
                    {step === 3 && (
                        <div className="flex flex-col">
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                                <div>
                                    <h2 className="text-2xl font-black uppercase">The Studio</h2>
                                    <p className="text-zinc-400 text-sm font-bold">Review, edit, or upload custom backgrounds.</p>
                                </div>
                                <button
                                    onClick={startFinalRender}
                                    className="px-8 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded uppercase tracking-wider shadow-lg flex gap-2 items-center"
                                >
                                    Render All Posts <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-20 shadow-md">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Master Vibe Controls</label>
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white outline-none focus:border-zinc-500 text-sm font-medium"
                                    />
                                </div>
                                <button onClick={handleAddPost} className="px-5 py-2 mt-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold uppercase text-sm flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Add New Post
                                </button>
                            </div>

                            <div className="p-6 space-y-8 bg-zinc-950/30">
                                {drafts.map((draft, postIndex) => (
                                    <div key={draft.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 pr-12 shadow-xl relative group/card">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-black uppercase tracking-wider">Post {postIndex + 1}</h3>
                                            {drafts.length > 1 && (
                                                <button onClick={() => handleDeletePost(draft.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-2" title="Delete Post">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid md:grid-cols-12 gap-8">
                                            {/* Left Col: Background Image */}
                                            <div className="md:col-span-5 space-y-3">
                                                <div className="flex gap-2 mb-2">
                                                    <button onClick={() => updateDraft(postIndex, 'bgMode', 'image')} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded transition-colors ${draft.bgMode === 'image' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Image</button>
                                                    <button onClick={() => updateDraft(postIndex, 'bgMode', 'color')} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded transition-colors ${draft.bgMode === 'color' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Plain Color</button>
                                                </div>

                                                {draft.bgMode === 'image' ? (
                                                    <>
                                                        <div className="aspect-square bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative group flex items-center justify-center">
                                                            {draft.bgUrl ? (
                                                                <img src={draft.bgUrl} alt="Background Preview" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="text-zinc-600 font-bold uppercase flex flex-col items-center gap-2">
                                                                    <ImageIcon className="w-12 h-12" />
                                                                    <span className="text-center px-4 text-xs mt-2">No Image<br />Type a prompt or upload below.</span>
                                                                </div>
                                                            )}

                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                                                                <label className="px-4 py-2 bg-zinc-800 text-white border border-zinc-600 font-bold rounded-md flex items-center gap-2 hover:bg-zinc-700 cursor-pointer uppercase text-sm">
                                                                    <UploadCloud className="w-4 h-4" />
                                                                    Upload Custom
                                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImage(postIndex, e)} />
                                                                </label>
                                                            </div>
                                                        </div>

                                                        {/* Prompt Input & Generate Button */}
                                                        <div className="flex gap-2 items-stretch mt-3">
                                                            <input
                                                                type="text"
                                                                value={draft.bgPrompt}
                                                                onChange={(e) => updateBgPrompt(postIndex, e.target.value)}
                                                                placeholder="Enter AI image prompt..."
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-zinc-500 text-sm font-medium"
                                                            />
                                                            <button
                                                                onClick={() => handleGenerateImage(postIndex)}
                                                                disabled={isRedoing[postIndex]}
                                                                className="px-4 bg-zinc-100 text-zinc-950 rounded-lg hover:bg-white disabled:opacity-50 transition-colors flex items-center justify-center"
                                                                title="Generate AI Image"
                                                            >
                                                                {isRedoing[postIndex] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                <div className="space-y-4">
                                                    <CustomColorPicker 
                                                        color={draft.bgColor} 
                                                        onChange={(newVal) => updateDraft(postIndex, 'bgColor', newVal)}
                                                    />
                                                </div>
                                                )}
                                            </div>

                                            {/* Right Col: Text Slides */}
                                            <div className="md:col-span-7 space-y-3">
                                                {draft.quotes.map((quote, quoteIdx) => (
                                                    <div key={quoteIdx} className="flex gap-2 relative">
                                                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                                                            {quoteIdx + 1}
                                                        </div>
                                                        <textarea
                                                            value={quote}
                                                            onChange={(e) => updateQuote(postIndex, quoteIdx, e.target.value)}
                                                            placeholder={`Slide ${quoteIdx + 1} text...`}
                                                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-white outline-none focus:border-zinc-500 min-h-[60px] resize-y uppercase font-bold text-sm tracking-wide"
                                                        />
                                                        {draft.quotes.length > 1 && (
                                                            <button 
                                                                onClick={() => removeSlide(postIndex, quoteIdx)} 
                                                                className="text-zinc-600 hover:text-red-500 absolute -right-9 top-3 transition-colors p-1"
                                                                title="Remove Slide"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addSlide(postIndex)}
                                                    className="mt-4 flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm uppercase"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Slide
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 5: PREVIEW & DOWNLOAD */}
                    {step === 5 && (
                        <div className="p-8 space-y-8 animate-in fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-zinc-800 pb-6">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight">Mission Complete</h2>
                                    <p className="text-zinc-400 text-sm font-bold uppercase mt-1">Ready to post to the grid.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => { setStep(1); setDrafts([]); setFinalPosts([]); }} className="px-5 py-3 rounded bg-zinc-800 hover:bg-zinc-700 font-bold flex items-center gap-2 uppercase text-sm">
                                        <RefreshCw className="w-4 h-4" /> Restart
                                    </button>
                                    <button
                                        onClick={downloadAllAsZip} disabled={isZipping}
                                        className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded font-black flex items-center gap-2 uppercase text-sm shadow-xl"
                                    >
                                        {isZipping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                                        Download ZIP
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-12">
                                {finalPosts.map((post) => (
                                    <div key={post.postNum} className="space-y-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-zinc-800 text-white text-sm font-black px-3 py-1 uppercase tracking-widest border border-zinc-700">
                                                Post {post.postNum}
                                            </span>
                                        </div>

                                        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
                                            {post.slides.map((slideSrc, idx) => (
                                                <div key={idx} className="min-w-[280px] max-w-[280px] flex-none snap-start relative">
                                                    <img src={slideSrc} alt="Slide" className="w-full aspect-square object-cover rounded-md shadow-2xl border border-zinc-800" />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                                            <h4 className="text-zinc-500 text-xs font-bold uppercase mb-2">Generated Caption (Included in ZIP)</h4>
                                            <textarea
                                                readOnly
                                                value={post.caption}
                                                className="w-full bg-transparent text-zinc-300 outline-none resize-none h-16 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="mt-auto pt-8 pb-4 text-center">
                    <p className="text-zinc-700 font-black uppercase tracking-[0.3em] text-xs">
                        Made by Dalvi Consultancy
                    </p>
                </footer>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #e4e4e7; }

        .hide-scrollbar::-webkit-scrollbar { height: 6px; }
        .hide-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .hide-scrollbar::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 10px; }
        .hide-scrollbar::-webkit-scrollbar-thumb:hover { background: #e4e4e7; }
      `}} />
        </div>
    );
}