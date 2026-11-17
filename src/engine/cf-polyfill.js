// Cloudflare Workers environment polyfill for Emscripten / HarfBuzz / Satori
const fallbackLocation = new URL('http://localhost/');

if (typeof globalThis !== 'undefined' && !globalThis.location) {
    try {
        Object.defineProperty(globalThis, 'location', {
            value: fallbackLocation,
            configurable: true,
            writable: true
        });
    } catch {
        globalThis.location = fallbackLocation;
    }
}

if (typeof self !== 'undefined' && !self.location) {
    try {
        Object.defineProperty(self, 'location', {
            value: fallbackLocation,
            configurable: true,
            writable: true
        });
    } catch {
        self.location = fallbackLocation;
    }
}
