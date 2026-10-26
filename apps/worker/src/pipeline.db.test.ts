import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import seed from '../../../data/prototype.json';
import { Pipeline } from './pipeline.ts';
import { PostgresRepository } from '../../api/src/repository.ts';
import { PostgresBudget } from '../../api/src/ai.ts';
import { createAdmin } from './admin.ts';
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required; run against a disposable PostgreSQL database');
const schema = 'ieum_test_' + randomUUID().replaceAll('-', '');
const admin = new Pool({ connectionString: url });
const pool = new Pool({ connectionString: url, options: `-c search_path=${schema},public` });
const pipeline = new Pipeline(pool);
let runId: string, rawId: string, stagingId: string;
beforeAll(async () => {
  await admin.query('CREATE EXTENSION IF NOT EXISTS vector'); await admin.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await admin.query(`CREATE SCHEMA ${schema}`);
  await pool.query(await readFile(new URL('../../../infra/migrations/20261026T0900_catalog.sql', import.meta.url), 'utf8'));
});
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
describe.sequential('real PostgreSQL approval and batch boundary', () => {
  it('checkpoints idempotent sanitized raw records and prevents mutation', async () => {
    runId = await pipeline.start('manual-test', { reviewedBy: 'integration-test', termsCheckedAt: '2026-10-26T00:00:00Z', robotsCheckedAt: '2026-10-26T00:00:00Z', allowedHosts: ['cse.snu.ac.kr'], allowedPathPrefixes: ['/'], storage: 'sanitized-payload', parserVersion: 'test-1' });
    const input = { title: 'fixture', email: 'private@example.org', text: '010-1234-5678', date: '20261026' };
    rawId = await pipeline.record(runId, 'one', 'https://cse.snu.ac.kr/en/research/labs/4', input, { cursor: 'next' });
    expect(await pipeline.record(runId, 'one', 'https://cse.snu.ac.kr/en/research/labs/4', input, { cursor: 'next' })).toBe(rawId);
    const raw = await pool.query('SELECT * FROM raw_records'); expect(raw.rowCount).toBe(1);
    expect(JSON.stringify(raw.rows[0].payload)).not.toContain('private@example');
    expect(raw.rows[0].exclusions.fields.length).toBeGreaterThan(0);
    expect((await pool.query('SELECT checkpoint FROM ingestion_runs WHERE id=$1', [runId])).rows[0].checkpoint.cursor).toBe('next');
    await expect(pool.query('UPDATE raw_records SET payload=$1 WHERE id=$2', [{}, rawId])).rejects.toThrow('immutable');
  });
  it('refuses unreviewed publication and broken references', async () => {
    await expect(pipeline.stage(runId, rawId, { ...seed, sources: [] })).rejects.toThrow();
    stagingId = await pipeline.stage(runId, rawId, seed);
    await expect(pipeline.publish(stagingId, 'not-approved', 'test', 'test')).rejects.toThrow('Human-approved');
    expect((await pool.query('SELECT * FROM active_batch')).rowCount).toBe(0);
  });
  it('atomically publishes reviewed versions and rolls back including revalidation queue', async () => {
    await pipeline.review(stagingId, 'approved', 'integration-test', 'Fixture metadata reviewed in disposable schema');
    await pipeline.publish(stagingId, 'test-v1', 'integration-test', 'First fixture batch');
    const repository = new PostgresRepository(pool);
    expect((await repository.snapshot()).manifest.version).toBe('test-v1');
    expect((await repository.similar('Biointelligence')).has('lab-bi')).toBe(true);
    await pipeline.publish(stagingId, 'test-v2', 'integration-test', 'Second fixture batch');
    await expect(pipeline.publish(stagingId, 'test-v2', 'integration-test', 'Duplicate version')).rejects.toThrow();
    expect((await repository.snapshot()).manifest.version).toBe('test-v2');
    await pipeline.rollback('test-v1', 'integration-test', 'Rollback exercise');
    expect((await repository.snapshot()).manifest.version).toBe('test-v1');
    expect((await pool.query('SELECT DISTINCT version FROM revalidation_queue')).rows).toEqual([{ version: 'test-v1' }]);
    await expect(pool.query("DELETE FROM approved_batches WHERE version='test-v2'")).rejects.toThrow('immutable');
    const directory = await mkdtemp(join(tmpdir(), 'ieum-export-'));
    await pipeline.export(join(directory, 'snapshot.json'));
    expect(JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8')).manifest.version).toBe('test-v1');
  });
  it('serializes shared AI reservations and reserves capacity for users', async () => {
    const budget = new PostgresBudget(pool, { test: { rpm: 10, rpd: 100, tpm: 1000 } });
    const ingest = await Promise.all(Array.from({ length: 6 }, () => budget.reserve([{ model: 'test', tokens: 10 }], 'ingest')));
    expect(ingest.filter(Boolean)).toHaveLength(4);
    const user = await Promise.all(Array.from({ length: 6 }, () => budget.reserve([{ model: 'test', tokens: 10 }], 'user')));
    expect(user.filter(Boolean)).toHaveLength(4);
  });
  it('protects all data operations on a separate admin server', async () => {
    const app = await createAdmin(pipeline, 'test-only-token-1234567890123456789012345');
    expect((await app.inject('/ops/status')).statusCode).toBe(401);
    const status = await app.inject({ url: '/ops/status', headers: { authorization: 'Bearer test-only-token-1234567890123456789012345' } });
    expect(status.json().active).toBe('test-v1');
    await app.close();
  });
});
