import { expect, it, vi } from 'vitest';
import { sanitize } from './privacy.ts';
import { assertAllowed, Pipeline } from './pipeline.ts';
it('excludes contact fields and inline contact data before raw persistence', () => {
  const result = sanitize({ title: '공식 표본', email: 'person@example.org', nested: [{ phone: '010-1234-5678', description: 'Reach person@example.org or 02-880-1234' }], version: 'prototype-20261026', index: { 'private@example.org': [1, 2] } });
  expect(JSON.stringify(result)).not.toContain('person@example.org');
  expect(JSON.stringify(result)).not.toContain('private@example.org');
  expect(JSON.stringify(result.payload)).not.toContain('880-1234');
  expect(JSON.stringify(result.payload)).toContain('prototype-20261026');
  expect(result.exclusions.length).toBeGreaterThan(2);
});
it('does not follow a reviewed source policy to another host or scheme', () => {
  const policy = { reviewedBy: 'test', termsCheckedAt: '2026-10-26T00:00:00Z', robotsCheckedAt: '2026-10-26T00:00:00Z', allowedHosts: ['cse.snu.ac.kr'], allowedPathPrefixes: ['/en/'], storage: 'sanitized-payload' as const, parserVersion: 'test' };
  expect(() => assertAllowed('https://cse.snu.ac.kr/en/research/labs/4', policy)).not.toThrow();
  for (const url of ['http://cse.snu.ac.kr/en/', 'https://cse.snu.ac.kr.evil.test/en/', 'https://127.0.0.1/en/', 'https://cse.snu.ac.kr/other']) expect(() => assertAllowed(url, policy)).toThrow();
});

it('rejects contact information as a reviewer before writing any database record', async () => {
  const connect=vi.fn(); const pipeline=new Pipeline({connect} as never);
  await expect(pipeline.review('draft','approved','private@example.org','Reviewed')).rejects.toThrow();
  await expect(pipeline.publish('draft','v1','010-1234-5678','Reviewed')).rejects.toThrow();
  expect(connect).not.toHaveBeenCalled();
});
