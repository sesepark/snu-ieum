import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createApp } from './app.ts';
import { FileRepository, PostgresRepository } from './repository.ts';
import { Gemini, PostgresBudget, type Limits } from './ai.ts';
const production = process.env.NODE_ENV === 'production';
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) : undefined;
if (production && !pool) throw new Error('Production requires PostgreSQL');
const repository = pool ? new PostgresRepository(pool) : new FileRepository(resolve('../../data/prototype.json'));
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const embedding = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
const limits = (prefix: string): Limits => {
  const values = ['RPM', 'TPM', 'RPD'].map(key => Number(process.env[`${prefix}_${key}`]));
  if (values.some(value => !Number.isInteger(value) || value <= 0)) throw new Error('Record verified account quotas before enabling AI');
  return { rpm: values[0], tpm: values[1], rpd: values[2] };
};
let ai: Gemini | undefined;
if (process.env.AI_FREE_TIER_VERIFIED === 'true') {
  if (!pool || !process.env.GEMINI_API_KEY || !process.env.AI_QUOTA_VERIFIED_AT) throw new Error('Verified free-tier AI requires key, verification date and PostgreSQL budget');
  ai = new Gemini(process.env.GEMINI_API_KEY, new PostgresBudget(pool, { [model]: limits('AI_TEXT'), [embedding]: limits('AI_EMBED') }), embedding, model);
}
const origin = process.env.CORS_ORIGIN || 'https://sesepark.github.io';
if (new URL(origin).origin !== origin || (production && !origin.startsWith('https://'))) throw new Error('CORS_ORIGIN must be an exact origin');
const app = await createApp(repository, { ai, origin, prototype: !production });
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 4100) });
console.log('서울대 이음 API ready');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); await pool?.end(); process.exit(0); });
