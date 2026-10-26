import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Pipeline, PolicySchema } from './pipeline.ts';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const pipeline = new Pipeline(pool);
try {
  const [command, path] = process.argv.slice(2);
  if (command === 'export' && path) console.log(await pipeline.export(path));
  else if (command === 'import' && path) {
    const bundle = z.strictObject({ source: z.string().min(1), externalId: z.string().min(1), sourceUrl: z.url(), policy: PolicySchema, draft: z.unknown() }).parse(JSON.parse(await readFile(path, 'utf8')));
    const runId = await pipeline.start(bundle.source, bundle.policy);
    try {
      const rawId = await pipeline.record(runId, bundle.externalId, bundle.sourceUrl, bundle.draft);
      const stagingId = await pipeline.stage(runId, rawId, bundle.draft);
      await pipeline.finish(runId, 'complete'); console.log({ runId, rawId, stagingId, status: 'pending-human-review' });
    } catch (error) { await pipeline.finish(runId, 'failed'); throw error; }
  } else throw new Error('Usage: cli import <review-bundle.json> | export <snapshot.json>');
} finally { await pool.end(); }
