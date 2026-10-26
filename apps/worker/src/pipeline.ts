import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { SnapshotSchema, CollectionKind, type Snapshot } from '@ieum/contracts';
import { resourceText } from '@ieum/catalog';
import { hash, sanitize } from './privacy.ts';
export const PolicySchema = z.strictObject({
  reviewedBy: z.string().min(1), termsCheckedAt: z.iso.datetime(), robotsCheckedAt: z.iso.datetime(),
  allowedHosts: z.array(z.string().min(1)).min(1), allowedPathPrefixes: z.array(z.string().startsWith('/')).min(1),
  storage: z.enum(['sanitized-payload', 'metadata-only']), artifactsAllowed: z.boolean().default(false), parserVersion: z.string().min(1)
});
export type Policy = z.input<typeof PolicySchema>;
export function assertAllowed(url: string, policy: Policy) {
  const parsed = new URL(url);
  if ([...parsed.searchParams.keys()].some(key => /api.?key|token|secret|email|phone|goal/i.test(key)) || sanitize(url).exclusions.length) throw new Error('Sensitive data in source URL');
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !policy.allowedHosts.includes(parsed.hostname) || !policy.allowedPathPrefixes.some(prefix => parsed.pathname.startsWith(prefix))) throw new Error('Source URL not allowed by reviewed policy');
}
async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const audit = (c: PoolClient, actor: string, action: string, id: string, reason: string) => c.query('INSERT INTO change_log(actor,action,record_id,reason) VALUES($1,$2,$3,$4)', [actor, action, id, reason]);
export class Pipeline {
  constructor(readonly pool: Pool) {}
  async start(source: string, input: Policy) {
    const policy = PolicySchema.parse(input), id = randomUUID();
    await this.pool.query("INSERT INTO ingestion_runs(id,source,status,policy) VALUES($1,$2,'running',$3)", [id, source, policy]);
    return id;
  }
  async record(runId: string, externalId: string, sourceUrl: string, payload: unknown, checkpoint: unknown = {}) {
    return transaction(this.pool, async client => {
      const result = await client.query('SELECT policy,status FROM ingestion_runs WHERE id=$1 FOR UPDATE', [runId]);
      if (!result.rowCount || result.rows[0].status !== 'running') throw new Error('Run not active');
      const policy = PolicySchema.parse(result.rows[0].policy); assertAllowed(sourceUrl, policy);
      const cleaned = sanitize(payload);
      const originalSha256 = hash(JSON.stringify(payload));
      const stored = policy.storage === 'metadata-only' ? { sourceUrl, originalSha256, storageRestricted: true } : cleaned.payload;
      const prior = await client.query('SELECT sha256 FROM raw_records WHERE source_url=$1 ORDER BY retrieved_at DESC LIMIT 1', [sourceUrl]);
      const sha256 = hash(JSON.stringify(stored)); const id = hash(`${runId}:${externalId}:${sha256}`);
      await client.query('INSERT INTO raw_records(id,run_id,external_id,source_url,payload,sha256,exclusions) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', [id, runId, externalId, sourceUrl, stored, sha256, { fields: cleaned.exclusions, originalSha256 }]);
      if (prior.rowCount && prior.rows[0].sha256 !== sha256) {
        const active = await client.query('SELECT b.snapshot FROM approved_batches b JOIN active_batch a ON a.version=b.version');
        if (active.rowCount) {
          const snapshot = SnapshotSchema.parse(active.rows[0].snapshot);
          const sourceIds = new Set(snapshot.sources.filter(s => s.url === sourceUrl).map(s => s.id));
          for (const resource of snapshot.resources.filter(r => r.sourceIds.some(id => sourceIds.has(id)))) await client.query("INSERT INTO revalidation_queue(resource_id,version,reason,due_at) VALUES($1,$2,'원문 변경',now()) ON CONFLICT(resource_id) DO UPDATE SET reason='원문 변경',due_at=now(),status='pending',version=excluded.version", [resource.id, snapshot.manifest.version]);
        }
      }
      // Checkpoints are allowed transport cursors only, never unfiltered source payload or credentials.
      const safeCheckpoint = z.object({ cursor: z.string().max(4096).optional(), page: z.number().int().nonnegative().optional() }).strict().parse(checkpoint);
      await client.query('UPDATE ingestion_runs SET checkpoint=$2 WHERE id=$1', [runId, safeCheckpoint]);
      return id;
    });
  }
  async finish(runId: string, status: 'complete' | 'failed') { await this.pool.query('UPDATE ingestion_runs SET status=$2 WHERE id=$1', [runId, status]); }
  async artifact(rawId: string, path: string, sha256: string, policy: Policy) {
    if (!policy.artifactsAllowed || policy.storage !== 'sanitized-payload') throw new Error('Artifact retention not allowed');
    await this.pool.query('INSERT INTO raw_artifacts(id,raw_id,path,sha256,policy) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [hash(rawId + ':' + sha256), rawId, path, sha256, policy]);
  }
  async stageCandidate(runId: string, rawId: string, input: unknown) {
    const candidate = z.strictObject({ kind: CollectionKind, name: z.string().min(1).max(2000), sourceUrl: z.url(), externalId: z.string().min(1), parserVersion: z.string().min(1), facts: z.record(z.string(), z.string().max(10000)) }).parse(input);
    const clean = sanitize(candidate); if (clean.exclusions.length) throw new Error('Contact data in candidate');
    const raw = await this.pool.query('SELECT id FROM raw_records WHERE id=$1 AND run_id=$2', [rawId, runId]);
    if (!raw.rowCount) throw new Error('Raw record must belong to run');
    const id = randomUUID(); await this.pool.query('INSERT INTO staging_records(id,run_id,raw_id,draft) VALUES($1,$2,$3,$4)', [id, runId, rawId, { candidate }]); return id;
  }
  async stage(runId: string, rawId: string, input: unknown) {
    const cleaned = sanitize(input);
    if (cleaned.exclusions.length) throw new Error('Remove contact data before staging');
    const draft = SnapshotSchema.parse(input);
    if (draft.manifest.publication !== 'prototype') throw new Error('Stage drafts; human approval belongs to the review operation');
    const result = await this.pool.query('SELECT id FROM raw_records WHERE id=$1 AND run_id=$2', [rawId, runId]);
    if (!result.rowCount) throw new Error('Raw record must belong to run');
    const id = randomUUID();
    await this.pool.query('INSERT INTO staging_records(id,run_id,raw_id,draft) VALUES($1,$2,$3,$4)', [id, runId, rawId, draft]);
    return id;
  }
  async review(id: string, status: 'approved' | 'needs_revision' | 'rejected' | 'expired', actor: string, reason: string) {
    if (!actor.trim() || !reason.trim()) throw new Error('Reviewer and reason required');
    return transaction(this.pool, async client => {
      const result = await client.query('UPDATE staging_records SET status=$2,reviewed_by=$3,reviewed_at=now(),reason=$4 WHERE id=$1 RETURNING id', [id, status, actor, reason]);
      if (!result.rowCount) throw new Error('Unknown staged draft');
      await audit(client, actor, `review:${status}`, id, reason);
    });
  }
  async publish(id: string, version: string, actor: string, reason: string) {
    if (!actor.trim() || !reason.trim()) throw new Error('Actor and release reason required');
    return transaction(this.pool, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ieum-batch'))");
      const result = await client.query("SELECT * FROM staging_records WHERE id=$1 AND status='approved' FOR UPDATE", [id]);
      if (!result.rowCount) throw new Error('Human-approved staging required');
      const record = result.rows[0]; const now = new Date().toISOString();
      const snapshot = SnapshotSchema.parse({ ...record.draft, manifest: { ...record.draft.manifest, version, publication: 'approved', reviewedBy: record.reviewed_by, reviewedAt: new Date(record.reviewed_at).toISOString(), generatedAt: now } });
      await client.query('INSERT INTO approved_batches(version,snapshot,sha256,reviewer) VALUES($1,$2,$3,$4)', [version, snapshot, hash(JSON.stringify(snapshot)), record.reviewed_by]);
      for (const r of snapshot.resources) await client.query('INSERT INTO serving_resources(version,id,resource,search_text) VALUES($1,$2,$3,$4)', [version, r.id, r, resourceText(r, snapshot)]);
      await client.query('INSERT INTO active_batch(singleton,version) VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET version=$1,changed_at=now()', [version]);
      await this.revalidation(client, snapshot);
      await audit(client, actor, 'publish', version, reason); return snapshot;
    });
  }
  private async revalidation(client: PoolClient, snapshot: Snapshot) {
    await client.query('DELETE FROM revalidation_queue');
    for (const r of snapshot.resources) {
      const days = r.kind === 'equipment' || r.kind === 'space' ? 7 : 30;
      const due = new Date(Date.parse(r.lastVerifiedAt) + days * 86400000).toISOString();
      await client.query('INSERT INTO revalidation_queue(resource_id,version,reason,due_at) VALUES($1,$2,$3,$4)', [r.id, snapshot.manifest.version, r.verificationRequired ? '확인 필요' : '정기 재검증', due]);
    }
  }
  async rollback(version: string, actor: string, reason: string) {
    if (!actor.trim() || !reason.trim()) throw new Error('Rollback reason required');
    return transaction(this.pool, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ieum-batch'))");
      const result = await client.query('SELECT snapshot FROM approved_batches WHERE version=$1', [version]);
      if (!result.rowCount) throw new Error('Unknown approved batch');
      await client.query('UPDATE active_batch SET version=$1,changed_at=now() WHERE singleton=true', [version]);
      await this.revalidation(client, SnapshotSchema.parse(result.rows[0].snapshot));
      await audit(client, actor, 'rollback', version, reason);
    });
  }
  async export(path: string) {
    const result = await this.pool.query('SELECT snapshot FROM approved_batches b JOIN active_batch a ON a.version=b.version WHERE a.singleton=true');
    if (!result.rowCount) throw new Error('No active approved batch');
    const snapshot = SnapshotSchema.parse(result.rows[0].snapshot);
    await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 }); await rename(temporary, path); return snapshot.manifest;
  }
}
