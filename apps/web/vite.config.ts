import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({
  base: '/snu-ieum/', plugins: [react(), {
    name: 'approved-snapshot',
    configureServer(server) { server.middlewares.use('/snu-ieum/snapshot.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(readFileSync(resolve(process.env.IEUM_SNAPSHOT_PATH || '../../data/prototype.json'))); }); },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'snapshot.json', source: readFileSync(resolve(process.env.IEUM_SNAPSHOT_PATH || '../../data/prototype.json')) }); }
  }],
  server: { host: '127.0.0.1', fs: { allow: ['../..'] } },
  build: { chunkSizeWarningLimit: 1500 }
});
