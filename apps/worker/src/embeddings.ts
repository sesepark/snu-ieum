import type { Pool } from 'pg';
import type { AI } from '../../api/src/ai.ts';
import { SnapshotSchema } from '@ieum/contracts';
import { PostgresRepository } from '../../api/src/repository.ts';
export async function embedApprovedResources(pool: Pool, ai: AI, limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Embedding batch limit must be 1..100');
  const snapshot = SnapshotSchema.parse(await new PostgresRepository(pool).snapshot()); let updated = 0;
  for (const resource of snapshot.resources) {
    if (updated >= limit) break;
    const existing = await pool.query('SELECT embedding_model FROM serving_resources WHERE version=$1 AND id=$2', [snapshot.manifest.version, resource.id]);
    if (existing.rows[0]?.embedding_model === ai.embeddingModel) continue;
    const text = [resource.name, resource.summary, ...resource.keywords].join('\n');
    const vector = await ai.embed(text);
    if (vector.length !== 768 || vector.some(v => !Number.isFinite(v))) throw new Error('Embedding must contain 768 finite values');
    const result = await pool.query('UPDATE serving_resources SET embedding=$3::vector,embedding_model=$4 WHERE version=$1 AND id=$2 AND EXISTS(SELECT 1 FROM active_batch WHERE version=$1)', [snapshot.manifest.version, resource.id, JSON.stringify(vector), ai.embeddingModel]);
    if (!result.rowCount) break; updated++;
  }
  return { version: snapshot.manifest.version, updated };
}
