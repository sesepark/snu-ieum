import { statfs, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
export async function operationalStatus(pool: Pool, artifactRoot: string, backupStatusFile?: string) {
  const [runs, queue, apiBudget, disk] = await Promise.all([
    pool.query('SELECT source,status,count(*)::int AS count FROM ingestion_runs GROUP BY source,status'),
    pool.query("SELECT count(*)::int AS due FROM revalidation_queue WHERE status='pending' AND due_at<=now()"),
    pool.query('SELECT model,"window",requests,tokens FROM ai_usage ORDER BY "window" DESC LIMIT 12'),
    statfs(artifactRoot)
  ]);
  let backupLastSuccess: string | null = null;
  if (backupStatusFile) try { backupLastSuccess = (await readFile(backupStatusFile, 'utf8')).trim(); } catch { /* Report missing, never assume successful backup. */ }
  return { checkedAt: new Date().toISOString(), runs: runs.rows, revalidationDue: queue.rows[0].due, apiBudget: apiBudget.rows, diskFreeBytes: disk.bavail * disk.bsize, backupLastSuccess };
}
