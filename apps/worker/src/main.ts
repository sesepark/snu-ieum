import { Pool } from 'pg';
import { createAdmin } from './admin.ts';
import { Pipeline } from './pipeline.ts';
if (!process.env.DATABASE_URL || !process.env.ADMIN_TOKEN) throw new Error('DATABASE_URL and ADMIN_TOKEN required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const app = await createAdmin(new Pipeline(pool), process.env.ADMIN_TOKEN);
// This invariant is deliberate. Never expose this listener through Funnel or a public proxy.
await app.listen({ host: '127.0.0.1', port: Number(process.env.ADMIN_PORT || 4101) });
console.log('서울대 이음 operator API ready on loopback');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); await pool.end(); process.exit(0); });
