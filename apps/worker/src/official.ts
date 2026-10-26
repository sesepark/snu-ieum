import { load } from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { CollectionKind } from '@ieum/contracts';
import { Pipeline, assertAllowed, type Policy } from './pipeline.ts';
import { hash, sanitize } from './privacy.ts';
export async function readLimited(response: Response, maxBytes = 2_000_000) {
  const reader = response.body?.getReader(); if (!reader) return '';
  const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > maxBytes) throw new Error('Source response exceeds limit'); chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export async function fetchAllowed(url: string, policy: Policy, request: typeof fetch = fetch) {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    assertAllowed(current, policy);
    const response = await request(current, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'snu-ieum/0.1 (https://github.com/sesepark/snu-ieum)' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) { const next = response.headers.get('location'); if (!next) throw new Error('Redirect without location'); await response.body?.cancel(); current = new URL(next, current).href; continue; }
    if (!response.ok) throw new Error('Official source unavailable');
    return { response, url: current };
  }
  throw new Error('Too many redirects');
}
export function sanitizeOfficial(html: string) {
  const $ = load(html);
  $('script,style,noscript,[href^="mailto:"],[href^="tel:"],.contact,.contact-info').remove();
  return { html: (sanitize({ html: $.html() }).payload as { html: string }).html, exclusions: ['scripts, contact nodes and inline contact patterns removed'] };
}
export function parseOfficial(html: string, selectors: { name: string; summary: string }) {
  const safe = sanitizeOfficial(html); const clean = load(safe.html);
  return { ...safe, name: clean(selectors.name).first().text().replace(/\s+/g, ' ').trim(), summary: clean(selectors.summary).first().text().replace(/\s+/g, ' ').trim().slice(0, 2000) };
}

export async function collectOfficial(pipeline: Pipeline, runId: string, url: string, policy: Policy, config: { kind: z.infer<typeof CollectionKind>; name: string; summary: string; artifactRoot?: string }, request: typeof fetch = fetch) {
  try {
    const fetched = await fetchAllowed(url, policy, request);
    if (!fetched.response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected HTML');
    const original = await readLimited(fetched.response); const safe = sanitizeOfficial(original);
    const rawId = await pipeline.record(runId, fetched.url, fetched.url, { html: safe.html, contentSha256: hash(original), exclusions: safe.exclusions, parserVersion: policy.parserVersion });
    if (config.artifactRoot && policy.artifactsAllowed && policy.storage === 'sanitized-payload') {
      const sha256 = hash(safe.html), path = join(config.artifactRoot, sha256 + '.html');
      await mkdir(config.artifactRoot, { recursive: true }); await writeFile(path, safe.html, { mode: 0o600 }); await pipeline.artifact(rawId, path, sha256, policy);
    }
    const parsed = parseOfficial(safe.html, config);
    if (!parsed.name) throw new Error('Source-specific name selector did not match');
    const stagingId = await pipeline.stageCandidate(runId, rawId, { kind: config.kind, name: parsed.name, sourceUrl: fetched.url, externalId: fetched.url, parserVersion: policy.parserVersion, facts: { summary: parsed.summary } });
    return { rawId, stagingId };
  } catch (error) { await pipeline.sourceFailed(url); await pipeline.finish(runId, 'failed'); throw error; }
}
