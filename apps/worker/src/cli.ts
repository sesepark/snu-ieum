import { Pool } from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { CollectionKind } from '@ieum/contracts';
import { Pipeline, PolicySchema } from './pipeline.ts';
import { collectOfficial } from './official.ts';
import { collectOpenAlex } from './openalex.ts';
import { importThesis, ThesisMetadata } from './sspace.ts';
import { embedApprovedResources } from './embeddings.ts';
import { verifiedAI } from '../../api/src/config.ts';
import { PostgresBudget } from '../../api/src/ai.ts';
import { operationalStatus } from './health.ts';
import { exportReviewRows, importReviewRows } from './review-io.ts';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }); const pipeline = new Pipeline(pool);
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const Config = z.object({ runId: z.string().optional(), policy: PolicySchema });
try {
  const [command, path, actor, reason] = process.argv.slice(2);
  if (command === 'export' && path) console.log(await pipeline.export(path));
  else if (command === 'resume' && path && actor && reason) { await pipeline.resume(path, actor, reason); console.log({ resumed: path }); }
  else if (command === 'import' && path) {
    const bundle = z.strictObject({ source: z.string().min(1), externalId: z.string().min(1), sourceUrl: z.url(), policy: PolicySchema, draft: z.unknown() }).parse(await json(path));
    const runId = await pipeline.start(bundle.source, bundle.policy);
    try {
      const rawId = await pipeline.record(runId, bundle.externalId, bundle.sourceUrl, bundle.draft);
      const stagingId = await pipeline.stage(runId, rawId, bundle.draft);
      await pipeline.finish(runId, 'complete'); console.log({ runId, rawId, stagingId, status: 'pending-human-review' });
    } catch (error) { await pipeline.finish(runId, 'failed'); throw error; }
  } else if (command === 'official' && path) {
    const config = Config.extend({ url: z.url(), kind: CollectionKind, name: z.string().min(1), summary: z.string().min(1), artifactRoot: z.string().optional() }).parse(await json(path));
    const runId = config.runId || await pipeline.start('official-page', config.policy);
    console.log({ runId, ...await collectOfficial(pipeline, runId, config.url, config.policy, config) }); await pipeline.finish(runId, 'complete');
  } else if (command === 'openalex' && path) {
    const config = Config.extend({ institutionId: z.string().regex(/^I\d+$/), maxPages: z.number().int().min(1), quotaVerifiedAt: z.iso.date(), rpm: z.number().int().positive(), dailyRequests: z.number().int().positive() }).parse(await json(path));
    if (!process.env.OPENALEX_API_KEY) throw new Error('Server-side OPENALEX_API_KEY required');
    const runId = config.runId || await pipeline.start('openalex', config.policy);
    const budget = new PostgresBudget(pool, { openalex: { rpm: config.rpm, rpd: config.dailyRequests, tpm: Number.MAX_SAFE_INTEGER } });
    console.log({ runId, ...await collectOpenAlex(pipeline, runId, config.policy, { ...config, apiKey: process.env.OPENALEX_API_KEY }, budget) });
  } else if (command === 'sspace' && path) {
    const config = Config.extend({ metadata: ThesisMetadata }).parse(await json(path)); const runId = config.runId || await pipeline.start('s-space-manual', config.policy);
    console.log({ runId, ...await importThesis(pipeline, runId, config.metadata) }); await pipeline.finish(runId, 'complete');
  } else if (command === 'embed') {
    if (process.env.DATA_EMBEDDING_APPROVED !== 'true') throw new Error('Public resource data processing approval required');
    const ai = verifiedAI(pool, process.env, 'ingest'); if (!ai) throw new Error('Verify the free account before embedding');
    console.log(await embedApprovedResources(pool, ai, Number(path || 20)));
  } else if (command === 'export-review' && path) {
    const { rows } = await pool.query('SELECT id,run_id,raw_id,draft,status,reviewed_by,reviewed_at,reason FROM staging_records ORDER BY id');
    const text = exportReviewRows(rows, path.endsWith('.csv') ? 'csv' : 'jsonl');
    await writeFile(path, text + '\n', { mode: 0o600 }); console.log({ exported: rows.length });
  } else if (command === 'import-review' && path) console.log(await importReviewRows(pipeline, await readFile(path, 'utf8'), path.endsWith('.csv') ? 'csv' : 'jsonl'));
  else if (command === 'health') console.log(await operationalStatus(pool, path || '/var/lib/ieum/raw', process.env.BACKUP_STATUS_FILE));
  else throw new Error('Commands: import|official|openalex|sspace <reviewed-config.json>, resume <runId> <operator> <reason>, embed [limit], export <snapshot.json>, export-review|import-review <csv|jsonl>, health [artifact-directory]');
} finally { await pool.end(); }
