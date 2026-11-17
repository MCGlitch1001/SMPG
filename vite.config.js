import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function copyFontsPlugin() {
  return {
    name: 'copy-fonts-to-dist',
    closeBundle() {
      const srcDir = path.resolve('assets/fonts');
      const destDir = path.resolve('dist/assets/fonts');
      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        const files = fs.readdirSync(srcDir);
        let count = 0;
        for (const file of files) {
          if (file.endsWith('.ttf') || file.endsWith('.txt')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
            count++;
          }
        }
        console.log(`[vite] Copied ${count} font assets to dist/assets/fonts/`);
      }

      // Copy satori layout.wasm for Cloudflare Pages serverless runtime
      const satoriWasmSrc = path.resolve('node_modules/satori/layout.wasm');
      const satoriWasmDest = path.resolve('dist/assets/layout.wasm');
      if (fs.existsSync(satoriWasmSrc)) {
        fs.copyFileSync(satoriWasmSrc, satoriWasmDest);
        console.log('[vite] Copied satori layout.wasm to dist/assets/layout.wasm');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyFontsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/mcp': 'http://localhost:3000',
      '/output': 'http://localhost:3000',
    },
  },
});
