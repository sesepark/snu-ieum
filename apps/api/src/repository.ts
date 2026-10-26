import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { parseSnapshot, normalize } from '@ieum/catalog';
import type { Snapshot } from '@ieum/contracts';
export interface Repository {
  snapshot(): Promise<Snapshot>;
  similar?(query: string, version: string): Promise<Map<string, number>>;
  semantic?(vector: number[], model: string, version: string): Promise<Map<string, number>>;
}
export class FileRepository implements Repository {
  constructor(private path: string) {}
  async snapshot() { return parseSnapshot(JSON.parse(await readFile(this.path, 'utf8'))); }
}
export class PostgresRepository implements Repository {
  constructor(readonly pool: Pool) {}
  async snapshot() {
    const result = await this.pool.query('SELECT b.snapshot FROM approved_batches b JOIN active_batch a ON a.version=b.version WHERE a.singleton=true');
    if (!result.rowCount) throw new Error('No approved active batch');
    return parseSnapshot(result.rows[0].snapshot);
  }
  async similar(query: string, version: string) {
    const result = await this.pool.query(`SELECT r.id, similarity(r.search_text,$1) AS score FROM serving_resources r WHERE r.version=$2 AND (similarity(r.search_text,$1)>.12 OR r.search_text LIKE '%' || $1 || '%') ORDER BY score DESC LIMIT 100`, [normalize(query), version]);
    return new Map<string, number>(result.rows.map(r => [r.id, Number(r.score)]));
  }
  async semantic(vector: number[], model: string, version: string) {
    if (vector.length !== 768 || vector.some(v => !Number.isFinite(v))) throw new Error('Invalid vector');
    const result = await this.pool.query(`SELECT r.id, 1-(r.embedding <=> $1::vector) AS score FROM serving_resources r WHERE r.version=$3 AND r.embedding IS NOT NULL AND r.embedding_model=$2 ORDER BY r.embedding <=> $1::vector LIMIT 30`, [JSON.stringify(vector), model, version]);
    return new Map<string, number>(result.rows.filter(r => Number(r.score) > .25).map(r => [r.id, Number(r.score)]));
  }
}
