import { spawn } from 'child_process';

const server = spawn('node', ['src/api/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '3000' }
});

const viteCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const vite = spawn(viteCmd, ['vite'], {
  stdio: 'inherit',
  env: process.env
});

const cleanup = (code = 0) => {
  if (server && !server.killed) server.kill();
  if (vite && !vite.killed) vite.kill();
  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
process.on('exit', () => cleanup(0));

server.on('exit', (code) => {
  if (code && code !== 0) {
    cleanup(code);
  }
});

vite.on('exit', (code) => {
  if (code && code !== 0) {
    cleanup(code);
  }
});
