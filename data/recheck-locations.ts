// Re-confirms verified campus locations against their official source pages.
// Only the minimum facts are compared (resource name, room, building number); no HTML is stored.
// Usage: node --import tsx data/recheck-locations.ts [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Location = { id: string; resourceId: string; buildingId: string | null; room: string | null; status: string; sourceIds: string[]; addressText: string | null; lastVerifiedAt: string | null };
type Source = { id: string; url: string; lastVerifiedAt: string };
type Building = { id: string; number: string | null };

const root = resolve(import.meta.dirname, '..');
const campusPath = resolve(root, 'data/campus/campus-draft.json');
const snapshotPath = resolve(root, 'data/college-draft.json');
const raw = readFileSync(campusPath, 'utf8');
const campus = JSON.parse(raw) as { locations: Location[]; sources: Source[]; buildings: Building[] };
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { resources: { id: string; name: string }[] };
if (JSON.stringify(campus, null, 2) + (raw.endsWith('\n') ? '\n' : '') !== raw) throw new Error('campus-draft.json is not in canonical 2-space JSON form; refusing to rewrite');

const write = process.argv.includes('--write');
const agent = 'snu-ieum-location-recheck/1.0 (student research-resource prototype)';
const robots = new Map<string, string[]>();
const pages = new Map<string, { ok: boolean; text: string; reason?: string }>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function disallowed(url: URL) {
  if (!robots.has(url.host)) {
    let rules: string[] = [];
    try {
      const res = await fetch(`https://${url.host}/robots.txt`, { headers: { 'user-agent': agent }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        let applies = false;
        for (const line of (await res.text()).split(/\r?\n/)) {
          const [key, ...rest] = line.split(':'); const value = rest.join(':').trim();
          if (/^user-agent$/i.test(key.trim())) applies = value === '*';
          else if (applies && /^disallow$/i.test(key.trim()) && value) rules.push(value);
        }
      }
    } catch { rules = []; }
    robots.set(url.host, rules);
  }
  const path = decodeURI(url.pathname) + url.search;
  return robots.get(url.host)!.some(rule => path.startsWith(rule) || url.pathname.startsWith(rule));
}

const normalize = (text: string) => text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function page(url: string) {
  if (pages.has(url)) return pages.get(url)!;
  const parsed = new URL(url);
  let result: { ok: boolean; text: string; reason?: string };
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') result = { ok: false, text: '', reason: 'unsupported protocol' };
  else if (await disallowed(parsed)) result = { ok: false, text: '', reason: 'robots exclusion' };
  else {
    try {
      await sleep(900);
      const res = await fetch(url, { headers: { 'user-agent': agent }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      result = res.ok ? { ok: true, text: normalize(await res.text()) } : { ok: false, text: '', reason: `HTTP ${res.status}` };
    } catch (error) { result = { ok: false, text: '', reason: error instanceof Error ? error.name : 'fetch failed' }; }
  }
  pages.set(url, result);
  return result;
}

const roomToken = (room: string) => room.trim().replace(/호$/, '').replace(/\s+/g, '');
function confirms(text: string, location: Location, name: string, buildingNumber: string | null) {
  const compact = text.replace(/\s+/g, '');
  if (!location.room) {
    const address = (location.addressText ?? '').replace(/\s+/g, '');
    return Boolean(address) && compact.includes(address);
  }
  const room = roomToken(location.room.split('/')[0]);
  // An exact "<building>동<room>" address on the official page is direct evidence.
  if (buildingNumber && compact.includes(`${buildingNumber}동${location.room.split('/')[0].replace(/\s+/g, '')}`)) return true;
  // Some departments write rooms as "<building>-<room>" (e.g. 31-205).
  if (buildingNumber && compact.includes(`${buildingNumber}-${room}`)) return true;
  const nameKey = name.split('·')[0].replace(/\s+/g, '').slice(0, 12);
  const hits: number[] = [];
  for (let i = compact.indexOf(nameKey); i >= 0; i = compact.indexOf(nameKey, i + 1)) hits.push(i);
  // Single-resource pages (equipment detail): room must appear on the page.
  if (!hits.length) return compact.includes(room) && (!buildingNumber || compact.includes(buildingNumber));
  // Directory pages: the room must appear near the resource name.
  return hits.some(i => compact.slice(Math.max(0, i - 400), i + 600).includes(room));
}

const now = new Date().toISOString();
const report: { locationId: string; resourceId: string; status: 'confirmed' | 'unconfirmed'; reason?: string }[] = [];
const confirmedSources = new Set<string>();
for (const location of campus.locations.filter(l => l.status === 'verified')) {
  const resource = snapshot.resources.find(r => r.id === location.resourceId);
  const building = campus.buildings.find(b => b.id === location.buildingId);
  let reason = 'no source page confirmed the room';
  let ok = false;
  for (const id of location.sourceIds) {
    const source = campus.sources.find(s => s.id === id);
    if (!source || !resource) continue;
    const fetched = await page(source.url);
    if (!fetched.ok) { reason = fetched.reason ?? 'fetch failed'; continue; }
    if (confirms(fetched.text, location, resource.name, building?.number ?? null)) { ok = true; confirmedSources.add(id); break; }
  }
  report.push(ok ? { locationId: location.id, resourceId: location.resourceId, status: 'confirmed' } : { locationId: location.id, resourceId: location.resourceId, status: 'unconfirmed', reason });
  if (ok && write) location.lastVerifiedAt = now;
}
if (write) for (const source of campus.sources) if (confirmedSources.has(source.id)) source.lastVerifiedAt = now;

const summary = { checkedAt: now, retention: 'minimum factual comparison only; no HTML or contacts stored', pages: pages.size, confirmed: report.filter(r => r.status === 'confirmed').length, unconfirmed: report.filter(r => r.status === 'unconfirmed').length, failures: Object.fromEntries([...pages].filter(([, p]) => !p.ok).map(([url, p]) => [url, p.reason])), entries: report };
console.log(JSON.stringify({ ...summary, entries: undefined, unconfirmedEntries: report.filter(r => r.status === 'unconfirmed').slice(0, 40) }, null, 2));
if (write) {
  writeFileSync(campusPath, JSON.stringify(campus, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  writeFileSync(resolve(root, `data/campus/location-recheck-${now.slice(0, 10).replace(/-/g, '')}.json`), JSON.stringify(summary, null, 2) + '\n');
}
