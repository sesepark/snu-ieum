import { execFileSync } from 'node:child_process';
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proposed = resolve(root, 'review/shared');
async function walk(path) {
  const files = [];
  for (const entry of await readdir(path, {withFileTypes:true})) {
    const next = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(next)); else if (entry.isFile()) files.push(next);
  }
  return files;
}
let patch = '';
for (const path of (await walk(proposed)).sort()) {
  let diff;
  try { diff = execFileSync('git', ['diff','--no-index','--','/dev/null',relative(root,path)], {cwd:root,encoding:'utf8'}); }
  catch (error) { if (error.status !== 1 || typeof error.stdout !== 'string') throw error; diff=error.stdout; }
  patch += diff.split('\n').map(line => /^(diff --git|\+\+\+|---)/.test(line) ? line.replaceAll('a/review/shared/','a/').replaceAll('b/review/shared/','b/') : line).join('\n');
}
await writeFile(resolve(root,'review/foundation.patch'),patch);
console.log('Wrote review/foundation.patch; no shared paths were modified.');
