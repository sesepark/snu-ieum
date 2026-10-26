import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({
  base: '/snu-ieum/', plugins: [react(), {
    name: 'approved-snapshot',
    configureServer(server) { server.middlewares.use('/snu-ieum/campus.json', (_req,res)=>{res.setHeader('Content-Type','application/json');res.end(readFileSync(resolve(process.env.IEUM_CAMPUS_PATH || '../../data/campus/campus-draft.json')));}); server.middlewares.use('/snu-ieum/coverage.json', (_req,res)=>{res.setHeader('Content-Type','application/json');res.end(readFileSync(resolve(process.env.IEUM_COVERAGE_PATH || '../../data/coverage/coverage-draft.json')));}); server.middlewares.use('/snu-ieum/snapshot.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(readFileSync(resolve(process.env.IEUM_SNAPSHOT_PATH || '../../data/college-draft.json'))); }); },
    generateBundle() { this.emitFile({type:'asset',fileName:'campus.json',source:readFileSync(resolve(process.env.IEUM_CAMPUS_PATH || '../../data/campus/campus-draft.json'))});this.emitFile({type:'asset',fileName:'coverage.json',source:readFileSync(resolve(process.env.IEUM_COVERAGE_PATH || '../../data/coverage/coverage-draft.json'))}); this.emitFile({ type: 'asset', fileName: 'snapshot.json', source: readFileSync(resolve(process.env.IEUM_SNAPSHOT_PATH || '../../data/college-draft.json')) }); }
  }],
  server: { host: '127.0.0.1', fs: { allow: ['../..'] } },
  build: { chunkSizeWarningLimit: 1500 }
});
