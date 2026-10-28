import { expect, it, vi } from 'vitest';
import seed from '../../../data/prototype.json';
import college from '../../../data/college-draft.json';
import { parseSnapshot, recommend } from '@ieum/catalog';
import { loadCatalog, search, interpret } from './client';
const snapshot = parseSnapshot(seed);
it('switches an invalid or unavailable API to a validated snapshot', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response('{"snapshot":{}}')).mockResolvedValueOnce(new Response(JSON.stringify(snapshot)));
  const result = await loadCatalog('https://api.example', request);
  expect(result.source).toBe('snapshot'); expect(result.snapshot.resources).toHaveLength(6);
});
it('does not transmit a goal without explicit consent', async () => {
  const request = vi.fn();
  await expect(interpret('private', false, 'https://api.example', request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it('rejects invented sources and missing card provenance from an API', async () => {
  const card = recommend(snapshot, { q: '', kinds: [], departmentIds: [] })[0];
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ mode: 'ordinary', results: [{ ...card, source: [{ ...card.source[0], url: 'https://invented.example' }] }, { ...card, reason: undefined }] })));
  const result = await search({ q: '', kinds: [], departmentIds: [], aiConsent: false }, snapshot, 'https://api.example', request);
  expect(result.results).toHaveLength(0);
});

it('keeps all matching local candidates when no server is configured', async () => {
  const request = vi.fn();
  const result = await search({ q: '로봇', kinds: [], departmentIds: [], aiConsent: false }, parseSnapshot(college), '', request);
  expect(result.results).toHaveLength(18);
  expect(request).not.toHaveBeenCalled();
  expect(new Set(result.results.map(card => card.resource.departmentId)).size).toBe(4);
});
