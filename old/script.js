const state = {
profilePicUrl: null,
bgConfigs: [],
visibility: { pfp: true, name: true, handle: true }
};
function debounce(fn, delay = 300) {
let timer;
return (...args) => {
clearTimeout(timer);
timer = setTimeout(() => fn.apply(this, args), delay);
};
}
const debouncedSaveState = debounce(() => saveState(), 500);
document.addEventListener('DOMContentLoaded', () => {
setupEventListeners();
loadState();
loadPresets();
renderGlobalThemeControls();
if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('./sw.js').catch(console.error);
}
});
const DEFAULT_PRESETS = {
'Twitter Style': {
font: 'Roboto',
bgConfigs: [{ type: 'color', value: '#111111', textColor: '#ffffff' }]
},
'Insta Bold': {
font: 'Poppins',
bgConfigs: [
{ type: 'color', value: '#ffffff', textColor: '#000000' },
{ type: 'color', value: '#ff3b30', textColor: '#ffffff' }
]
}
};
function loadState() {
const saved = localStorage.getItem('smpg_state_v2');
if (saved) {
try {
const data = JSON.parse(saved);
if (data.displayName) document.getElementById('displayNameInput').value = data.displayName;
if (data.handle) document.getElementById('handleInput').value = data.handle;
if (data.visibility) {
state.visibility = data.visibility;
document.getElementById('showPfp').checked = state.visibility.pfp;
document.getElementById('showDisplayName').checked = state.visibility.name;
document.getElementById('showHandle').checked = state.visibility.handle;
}
if (data.text) document.getElementById('textInput').value = data.text;
if (data.font) document.getElementById('fontInput').value = data.font;
if (data.isVerified !== undefined) document.getElementById('verifiedInput').checked = data.isVerified;
if (data.profilePicUrl) {
state.profilePicUrl = data.profilePicUrl;
document.getElementById('pfpPreview').style.backgroundImage = `url(${state.profilePicUrl})`;
}
if (data.bgConfigs && data.bgConfigs.length > 0) {
state.bgConfigs = data.bgConfigs;
renderBgRows(data.bgConfigs.length);
} else {
renderBgRows(1);
}
} catch (e) { console.error("Load failed", e); renderBgRows(1); }
} else {
renderBgRows(1);
}
}
function saveState() {
const data = {
displayName: document.getElementById('displayNameInput').value,
handle: document.getElementById('handleInput').value,
visibility: state.visibility,
text: document.getElementById('textInput').value,
font: document.getElementById('fontInput').value,
isVerified: document.getElementById('verifiedInput').checked,
profilePicUrl: state.profilePicUrl,
bgConfigs: state.bgConfigs
};
try {
localStorage.setItem('smpg_state_v2', JSON.stringify(data));
} catch (e) {
console.warn("Storage quota exceeded, could not save state (likely due to images).");
}
}
function loadPresets() {
const select = document.getElementById('presetSelect');
select.innerHTML = '<option value="">Load Preset...</option>';
Object.keys(DEFAULT_PRESETS).forEach(name => {
const opt = document.createElement('option');
opt.value = name;
opt.textContent = name;
select.appendChild(opt);
});
const custom = JSON.parse(localStorage.getItem('smpg_presets') || '{}');
Object.keys(custom).forEach(name => {
const opt = document.createElement('option');
opt.value = name;
opt.textContent = name + ' (Custom)';
select.appendChild(opt);
});
}
function applyPreset(name, type) {
let data;
if (type === 'default') {
data = DEFAULT_PRESETS[name];
} else {
const custom = JSON.parse(localStorage.getItem('smpg_presets') || '{}');
data = custom[name];
}
if (!data) return;
if (data.font) document.getElementById('fontInput').value = data.font;
if (data.bgConfigs) {
state.bgConfigs = JSON.parse(JSON.stringify(data.bgConfigs));
document.getElementById('bgCountInput').value = state.bgConfigs.length;
renderBgRows(state.bgConfigs.length);
}
saveState();
}
function setupEventListeners() {
['displayNameInput', 'handleInput', 'textInput', 'fontInput', 'bgCountInput'].forEach(id => {
document.getElementById(id)?.addEventListener('input', debouncedSaveState);
});
document.getElementById('verifiedInput').addEventListener('change', saveState);
document.getElementById('profilePicInput').addEventListener('change', (e) => {
handleUpload(e.target.files[0], (url) => {
state.profilePicUrl = url;
document.getElementById('pfpPreview').style.backgroundImage = `url(${url})`;
saveState();
});
});
document.getElementById('showPfp').addEventListener('change', (e) => { state.visibility.pfp = e.target.checked; saveState(); });
document.getElementById('showDisplayName').addEventListener('change', (e) => { state.visibility.name = e.target.checked; saveState(); });
document.getElementById('showHandle').addEventListener('change', (e) => { state.visibility.handle = e.target.checked; saveState(); });
document.getElementById('savePresetBtn').onclick = () => {
const name = prompt("Name this preset:");
if (name) {
const presets = JSON.parse(localStorage.getItem('smpg_presets') || '{}');
presets[name] = {
font: document.getElementById('fontInput').value,
bgConfigs: state.bgConfigs
};
localStorage.setItem('smpg_presets', JSON.stringify(presets));
loadPresets();
alert("Preset saved!");
}
};
document.getElementById('deletePresetBtn').onclick = () => {
const name = document.getElementById('presetSelect').value;
if (!name || !confirm(`Delete preset "${name}"?`)) return;
const presets = JSON.parse(localStorage.getItem('smpg_presets') || '{}');
delete presets[name];
localStorage.setItem('smpg_presets', JSON.stringify(presets));
loadPresets();
};
document.getElementById('presetSelect').onchange = (e) => {
if (!e.target.value) return;
const presets = { ...DEFAULT_PRESETS, ...JSON.parse(localStorage.getItem('smpg_presets') || '{}') };
const p = presets[e.target.value];
if (p) {
document.getElementById('fontInput').value = p.font;
state.bgConfigs = JSON.parse(JSON.stringify(p.bgConfigs));
const firstColor = state.bgConfigs[0]?.value;
if (firstColor) renderGlobalThemeControls();
renderBgRows(state.bgConfigs.length);
saveState();
}
};
document.getElementById('bgCountInput').addEventListener('change', (e) => {
const count = parseInt(e.target.value);
renderBgRows(count);
});
document.getElementById('generateBtn').addEventListener('click', generatePosts);
document.getElementById('textInput').addEventListener('keydown', (e) => {
if (e.ctrlKey && e.key === 'Enter') {
e.preventDefault();
generatePosts();
}
});
}
function renderGlobalThemeControls() {
const container = document.getElementById('simpleThemePresets');
if (!container) return;
container.innerHTML = '';
const currentColor = state.bgConfigs[0]?.value || PRESET_COLORS[0];
PRESET_COLORS.forEach(color => {
const dot = document.createElement('div');
dot.className = `color-dot ${color === currentColor ? 'active' : ''}`;
dot.style.backgroundColor = color;
dot.onclick = () => applyGlobalTheme(color);
container.appendChild(dot);
});
const customWrapper = document.createElement('label');
customWrapper.className = `eyedropper-btn ${!PRESET_COLORS.includes(currentColor) ? 'active' : ''}`;
customWrapper.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>`;
const inp = document.createElement('input');
inp.type = 'color';
inp.value = PRESET_COLORS.includes(currentColor) ? '#ffffff' : currentColor;
inp.oninput = (e) => applyGlobalTheme(e.target.value);
customWrapper.appendChild(inp);
container.appendChild(customWrapper);
}
function applyGlobalTheme(color) {
state.bgConfigs.forEach(config => {
config.type = 'color';
config.value = color;
if (config.textColor === 'auto') {
config.textColor = 'auto';
}
});
renderGlobalThemeControls();
renderBgRows(state.bgConfigs.length);
saveState();
}
function renderBgRows(count) {
const container = document.getElementById('bgConfigContainer');
container.innerHTML = '';
const oldConfigs = state.bgConfigs;
state.bgConfigs = [];
for (let i = 0; i < count; i++) {
const existing = oldConfigs[i] || { type: 'color', value: '#111111', textColor: 'auto' };
state.bgConfigs.push(existing);
const row = document.createElement('div');
row.className = 'bg-row';
row.innerHTML = `<div style="margin-bottom:0.8rem; font-size:0.85rem; color:var(--text-muted); font-weight:600;">Slide ${i + 1}</div>`;
const content = document.createElement('div');
content.className = 'bg-config-content grid-2';
const bgCol = document.createElement('div');
bgCol.innerHTML = '<label>Background Color</label>';
bgCol.appendChild(createColorPresets(existing.value, (val) => {
existing.value = val;
existing.type = 'color';
saveState();
}));
const textCol = document.createElement('div');
textCol.innerHTML = '<label>Text Color</label>';
textCol.appendChild(createTextPresets(existing.textColor, (val) => {
existing.textColor = val;
saveState();
}));
content.appendChild(bgCol);
content.appendChild(textCol);
row.appendChild(content);
container.appendChild(row);
}
}
const PRESET_COLORS = ['#111111', '#ffffff', '#ff3b30', '#34c759', '#007aff', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#a2845e'];
function createColorPresets(currentVal, onSelect) {
const div = document.createElement('div');
div.className = 'color-presets';
PRESET_COLORS.forEach(c => {
const dot = document.createElement('div');
dot.className = `color-dot ${currentVal === c ? 'active' : ''}`;
dot.style.backgroundColor = c;
dot.onclick = () => {
div.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.eyedropper-btn').forEach(d => d.classList.remove('active'));
dot.classList.add('active');
onSelect(c);
saveState();
};
div.appendChild(dot);
});
const customWrapper = document.createElement('label');
customWrapper.className = `eyedropper-btn ${!PRESET_COLORS.includes(currentVal) ? 'active' : ''}`;
customWrapper.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
customWrapper.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>`;
const inp = document.createElement('input');
inp.type = 'color';
inp.value = currentVal;
inp.addEventListener('input', (e) => {
div.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
customWrapper.classList.add('active');
onSelect(e.target.value);
saveState();
});
customWrapper.appendChild(inp);
div.appendChild(customWrapper);
return div;
}
function createTextPresets(currentVal, onSelect) {
const div = document.createElement('div');
div.className = 'color-presets';
const autoBadge = document.createElement('div');
autoBadge.className = `auto-badge ${currentVal === 'auto' ? 'active' : ''}`;
autoBadge.textContent = 'Auto';
autoBadge.onclick = () => {
div.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.auto-badge').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.eyedropper-btn').forEach(d => d.classList.remove('active'));
autoBadge.classList.add('active');
onSelect('auto');
};
div.appendChild(autoBadge);
PRESET_COLORS.forEach(c => {
const dot = document.createElement('div');
dot.className = `color-dot ${currentVal === c ? 'active' : ''}`;
dot.style.backgroundColor = c;
dot.onclick = () => {
div.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.auto-badge').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.eyedropper-btn').forEach(d => d.classList.remove('active'));
dot.classList.add('active');
onSelect(c);
saveState();
};
div.appendChild(dot);
});
const customWrapper = document.createElement('label');
customWrapper.className = `eyedropper-btn ${!PRESET_COLORS.includes(currentVal) && currentVal !== 'auto' ? 'active' : ''}`;
customWrapper.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>`;
const inp = document.createElement('input');
inp.type = 'color';
inp.value = currentVal === 'auto' ? '#ffffff' : currentVal;
inp.addEventListener('input', (e) => {
div.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
div.querySelectorAll('.auto-badge').forEach(d => d.classList.remove('active'));
customWrapper.classList.add('active');
onSelect(e.target.value);
saveState();
});
customWrapper.appendChild(inp);
div.appendChild(customWrapper);
return div;
}
function getContrastColor(hex) {
if (!hex) return '#ffffff';
const r = parseInt(hex.substr(1, 2), 16);
const g = parseInt(hex.substr(3, 2), 16);
const b = parseInt(hex.substr(5, 2), 16);
const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
return (yiq >= 128) ? '#000000' : '#ffffff';
}
async function generatePosts() {
const text = document.getElementById('textInput').value.trim();
if (!text) return alert("Please enter some text!");
const generateBtn = document.getElementById('generateBtn');
generateBtn.disabled = true;
generateBtn.textContent = 'Generating...';
try {
const displayName = document.getElementById('displayNameInput').value;
const handle = document.getElementById('handleInput').value;
const font = document.getElementById('fontInput').value;
const isVerified = document.getElementById('verifiedInput').checked;
const previewContainer = document.getElementById('previewContainer');
previewContainer.innerHTML = '';
const lines = text.split('\n').filter(l => l.trim().length > 0);
const progressBar = document.getElementById('progressBar');
document.getElementById('progressContainer').style.display = 'block';
const zip = new JSZip();
let carouselCount = 0;
for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
const line = lines[lineIndex];
const slides = line.split('||').map(s => s.trim()).filter(x => x);
const bgConfig = state.bgConfigs[lineIndex % state.bgConfigs.length];
let textColor = bgConfig.textColor;
if (!textColor || textColor === 'auto') {
textColor = bgConfig.type === 'color' ? getContrastColor(bgConfig.value) : '#ffffff';
}
const isCarousel = slides.length > 1;
let folder = null;
if (isCarousel) {
carouselCount++;
folder = zip.folder(`Carousel_${carouselCount}`);
}
for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
const slideText = slides[slideIndex];
const blob = await drawCanvas(slideText, bgConfig, font, textColor, displayName, handle, state.profilePicUrl, isVerified, state.visibility);
const filename = `Slide_${slideIndex + 1}.png`;
if (isCarousel) folder.file(filename, blob);
else zip.file(`Post_${lineIndex + 1}.png`, blob);
addPreview(blob, isCarousel ? `C${carouselCount}-S${slideIndex + 1}` : `Post ${lineIndex + 1}`);
}
progressBar.style.width = `${((lineIndex + 1) / lines.length) * 100}%`;
}
progressBar.style.width = '100%';
// setupDownload(zip);
} catch (error) {
console.error('Generation failed:', error);
alert('An error occurred during generation.');
} finally {
generateBtn.disabled = false;
generateBtn.textContent = 'Generate Posts';
}
}
function drawCanvas(text, bgConfig, font, textColor, displayName, handle, pfpUrl, isVerified, visibility) {
return new Promise(async (resolve) => {
const canvas = document.createElement('canvas');
canvas.width = 1080;
canvas.height = 1080;
const ctx = canvas.getContext('2d');
if (bgConfig.type === 'color') {
ctx.fillStyle = bgConfig.value || '#111';
ctx.fillRect(0, 0, 1080, 1080);
} else if (bgConfig.type === 'image' && bgConfig.value) {
try {
const img = await loadImage(bgConfig.value);
ctx.drawImage(img, 0, 0, 1080, 1080);
ctx.fillStyle = 'rgba(0,0,0,0.2)';
ctx.fillRect(0, 0, 1080, 1080);
} catch (e) {
ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1080);
}
} else {
ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1080);
}
const padding = 60;
let contentOffsetY = 0;
const showPfp = visibility && visibility.pfp && pfpUrl;
const showName = visibility && visibility.name && displayName;
const showHandle = visibility && visibility.handle && handle;
if (showPfp || showName || showHandle) {
contentOffsetY = 80;
const avatarSize = 100;
let currentX = padding;
if (showPfp) {
ctx.save();
try {
const img = await loadImage(pfpUrl);
ctx.beginPath();
ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
ctx.clip();
ctx.drawImage(img, padding, padding, avatarSize, avatarSize);
currentX += avatarSize + 25;
} catch (e) { }
ctx.restore();
}
if (showName || showHandle) {
ctx.textAlign = 'left';
const textCenterY = padding + avatarSize / 2;
if (showName && showHandle) {
ctx.fillStyle = textColor;
ctx.font = `bold 36px ${font}`;
ctx.fillText(displayName, currentX, textCenterY - 20);
ctx.font = `30px ${font}`;
ctx.globalAlpha = 0.8;
ctx.fillText(handle, currentX, textCenterY + 20);
ctx.globalAlpha = 1.0;
if (isVerified) {
const width = ctx.measureText(displayName).width;
drawVerifiedBadge(ctx, currentX + width + 10, textCenterY - 20, 24);
}
} else if (showName) {
ctx.fillStyle = textColor;
ctx.font = `bold 40px ${font}`;
ctx.textBaseline = 'middle';
ctx.fillText(displayName, currentX, textCenterY);
if (isVerified) {
const width = ctx.measureText(displayName).width;
drawVerifiedBadge(ctx, currentX + width + 10, textCenterY, 32);
}
} else {
ctx.fillStyle = textColor;
ctx.font = `bold 36px ${font}`;
ctx.textBaseline = 'middle';
ctx.fillText(handle, currentX, textCenterY);
if (isVerified) {
const width = ctx.measureText(handle).width;
drawVerifiedBadge(ctx, currentX + width + 10, textCenterY, 32);
}
}
}
}
ctx.fillStyle = textColor;
ctx.font = `bold 60px ${font}`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowColor = 'rgba(0,0,0,0.6)';
ctx.shadowBlur = 15;
const lines = text.split('..');
const lineHeight = 80;
const centerY = (canvas.height / 2) + contentOffsetY / 2;
const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
lines.forEach((l, i) => {
ctx.fillText(l.trim(), 1080 / 2, startY + (i * lineHeight));
});
canvas.toBlob(resolve, 'image/png');
});
}
function drawVerifiedBadge(ctx, x, y, size) {
ctx.fillStyle = '#1DA1F2';
ctx.beginPath();
const r = size / 2.5;
ctx.arc(x + r, y, r, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#fff';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(x + r - 5, y);
ctx.lineTo(x + r - 1, y + 4);
ctx.lineTo(x + r + 5, y - 5);
ctx.stroke();
}
function handleUpload(file, cb) {
if (!file) return;
const reader = new FileReader();
reader.onload = (e) => cb(e.target.result);
reader.readAsDataURL(file);
}
function loadImage(src) {
return new Promise((resolve, reject) => {
const img = new Image();
img.crossOrigin = 'Anonymous';
img.onload = () => resolve(img);
img.onerror = reject;
img.src = src;
});
}
function addPreview(blob, label) {
const div = document.createElement('div');
div.className = 'preview-item';
const img = document.createElement('img');
img.src = URL.createObjectURL(blob);
const actions = document.createElement('div');
actions.className = 'preview-actions';
actions.innerHTML = `
<span style="font-size:0.8rem; color:#aaa;">${label}</span>
<button class="preview-btn">Download</button>
`;
actions.querySelector('button').onclick = () => saveAs(blob, `${label}.png`);
div.appendChild(img);
div.appendChild(actions);
document.getElementById('previewContainer').appendChild(div);
}
function setupDownload(zip) {
zip.generateAsync({ type: "blob" }).then(content => {
const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
saveAs(content, `smpg-posts-${ts}.zip`);
}).catch(err => {
console.error('ZIP generation failed:', err);
});
}