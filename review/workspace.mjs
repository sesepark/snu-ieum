// Assemble proposed shared files in an empty directory, never in this checkout.
import { cp, mkdir, readdir, realpath, lstat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] || '');
if (!process.argv[2] || target.startsWith(root + '/') || target === root) throw new Error('Choose an empty directory outside the checkout');
await mkdir(target, { recursive: true });
if ((await readdir(target)).length) throw new Error('Review workspace must be empty');
if ((await realpath(target)).startsWith(await realpath(root))) throw new Error('Symlink target must be outside checkout');
const exclude = new Set(['node_modules', 'dist', '.env', '.git', 'test-results', 'playwright-report']);
const filter = async path => !exclude.has(path.split('/').at(-1)) && !(await lstat(path)).isSymbolicLink();
for (const name of ['apps', 'packages', 'infra', 'data']) {
  try { await cp(join(root, name), join(target, name), { recursive: true, filter }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await cp(join(root, 'review/shared'), target, { recursive: true, filter });
console.log(`Review workspace: ${target}\nUse Node.js 24, then npm install, npm run check, npm test, npm run build.\nShared files in the checkout were not changed.`);
