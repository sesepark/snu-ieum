import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/**/*.db.test.ts'], testTimeout: 20000, fileParallelism: false } });
