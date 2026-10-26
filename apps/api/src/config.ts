import { z } from 'zod';
import type { Pool } from 'pg';
import { Gemini, PostgresBudget, type Limits } from './ai.ts';
export function verifiedAI(pool: Pool | undefined, env: NodeJS.ProcessEnv = process.env, priority: 'user' | 'ingest' = 'user') {
  if (env.AI_FREE_TIER_VERIFIED !== 'true') return undefined;
  if (!pool || !env.GEMINI_API_KEY) throw new Error('Verified AI requires PostgreSQL budget and a server API key');
  z.iso.date().parse(env.AI_QUOTA_VERIFIED_AT);
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite', embedding = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  const limits = (prefix: string): Limits => {
    const value = (key: string) => z.coerce.number().int().positive().parse(env[`${prefix}_${key}`]);
    return { rpm: value('RPM'), tpm: value('TPM'), rpd: value('RPD'), dayTimeZone: 'America/Los_Angeles' };
  };
  const budget = new PostgresBudget(pool, { [model]: limits('AI_TEXT'), [embedding]: limits('AI_EMBED') });
  return new Gemini(env.GEMINI_API_KEY, { reserve: requests => budget.reserve(requests, priority) }, embedding, model);
}
