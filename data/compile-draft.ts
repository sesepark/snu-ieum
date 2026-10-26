import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { SnapshotSchema, type Snapshot } from '@ieum/contracts';
import departments from './departments.json' with { type: 'json' };

function merge<T extends { id: string }>(groups: T[][], allowIdentical = false): T[] {
  const records = new Map<string, T>();
  for (const record of groups.flat()) {
    const prior = records.get(record.id);
    if (prior && (!allowIdentical || !isDeepStrictEqual(prior, record))) throw new Error(`Conflicting draft ID: ${record.id}`);
    records.set(record.id, record);
  }
  return [...records.values()];
}

export async function compileDraft(): Promise<Snapshot> {
  const files = [...departments.departments.map(d => d.id), 'shared', 'faculty-inventory', 'nuclear-inventory', 'aerospace-inventory', 'irf-inventory', 'isrc-inventory', 'cbe-equipment', 'gece-spaces'];
  const drafts = await Promise.all(files.map(async id => SnapshotSchema.parse(JSON.parse(await readFile(new URL(`./drafts/${id}.json`, import.meta.url), 'utf8')))));
  if (drafts.some(d => d.manifest.publication !== 'prototype')) throw new Error('Compile pending drafts only; approved batches must be exported by the worker');
  const generatedAt = drafts.map(d => d.manifest.generatedAt).sort().at(-1)!;
  return SnapshotSchema.parse({
    manifest: {
      version: `college-draft-${generatedAt.slice(0, 10).replaceAll('-', '')}`, generatedAt, publication: 'prototype', schemaVersion: 1,
      selectionReason: '12개 학과와 공용 시설의 공식 출처를 확인한 검수 초안을 통합했다. 학과별 선정 이유는 data/drafts에 기록했다. 건축학과 교수의 분야 대표성과 지도 연구실은 추가 검수가 필요하며 확인되지 않은 관계는 만들지 않았다. 모든 자원은 사람 승인 전이며 전수 조사·이용 가능 보장이 아니다.'
    },
    departments: merge(drafts.map(d => d.departments), true), sources: merge(drafts.map(d => d.sources), true),
    resources: merge(drafts.map(d => d.resources), true), relations: merge(drafts.map(d => d.relations), true), evidence: merge(drafts.map(d => d.evidence))
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const draft = await compileDraft();
  await writeFile(new URL('./college-draft.json', import.meta.url), JSON.stringify(draft, null, 2) + '\n');
  console.log({ resources: draft.resources.length, relations: draft.relations.length, evidence: draft.evidence.length, publication: draft.manifest.publication });
}
