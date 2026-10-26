import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'], exclude: ['**/*.db.test.ts'], testTimeout: 10000 } });
