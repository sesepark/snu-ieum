import { CampusSchema, type Campus, SnapshotSchema, RecommendationSchema, GoalProfileSchema, type Snapshot, type SearchRequest, type SearchResponse, type GoalProfile } from '@ieum/contracts';
import { recommend } from '@ieum/catalog';
export type LoadedCatalog = { snapshot: Snapshot; source: 'api' | 'snapshot'; aiAvailable: boolean };
const defaultApi = import.meta.env.VITE_API_URL || '';
export async function loadCatalog(api = defaultApi, request: typeof fetch = fetch): Promise<LoadedCatalog> {
  if (api) try {
    const response = await request(`${api}/v1/catalog`, { signal: AbortSignal.timeout(2500), cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const body = await response.json();
    return { snapshot: SnapshotSchema.parse(body.snapshot), source: 'api', aiAvailable: body.aiAvailable === true };
  } catch { /* Approved snapshot supports all ordinary exploration. */ }
  const response = await request(`${import.meta.env.BASE_URL}snapshot.json`, { signal: AbortSignal.timeout(6000), cache: 'no-cache' });
  if (!response.ok) throw new Error('스냅샷을 열 수 없습니다. 새로고침하거나 잠시 후 다시 시도해주세요.');
  return { snapshot: SnapshotSchema.parse(await response.json()), source: 'snapshot', aiAvailable: false };
}
export async function search(input: SearchRequest, s: Snapshot, api = defaultApi, request: typeof fetch = fetch): Promise<SearchResponse> {
  if (api) try {
    const response = await request(`${api}/v1/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const body = await response.json();
    if (!['ordinary', 'ai', 'fallback'].includes(body.mode) || !Array.isArray(body.results)) throw new Error('Invalid search response');
    const results = body.results.flatMap((item: unknown) => {
      const parsed = RecommendationSchema.safeParse(item);
      if (!parsed.success) return [];
      const r = parsed.data;
      const resource = s.resources.find(resource => resource.id === r.resource.id);
      if (!resource || JSON.stringify(resource) !== JSON.stringify(r.resource) || r.lastVerifiedAt !== resource.lastVerifiedAt || (resource.verificationRequired && !r.verificationRequired) || r.source.some(source => !s.sources.some(known => JSON.stringify(known) === JSON.stringify(source))) || r.relationIds.some(id => !s.relations.some(e => e.id === id))) return [];
      return [r];
    });
    return { results, mode: body.mode, message: typeof body.message === 'string' ? body.message : undefined };
  } catch { /* Do not cache or log user goals. */ }
  return { results: input.aiConsent ? recommend(s, input).slice(0, 12) : recommend(s, input), mode: input.aiConsent ? 'fallback' : 'ordinary', message: input.aiConsent ? 'AI를 사용할 수 없어 스냅샷 일반 검색으로 전환했습니다.' : undefined };
}
export async function interpret(goal: string, consent: boolean, api = defaultApi, request: typeof fetch = fetch): Promise<GoalProfile> {
  if (!consent || !api) throw new Error('AI 동의와 연결된 API가 필요합니다.');
  const response = await request(`${api}/v1/goals/interpret`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal, aiConsent: true }), signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('AI 해석을 사용할 수 없습니다. 일반 검색을 이용해주세요.');
  return GoalProfileSchema.parse((await response.json()).profile);
}

export async function loadCampus(snapshot:Snapshot, api=defaultApi,request:typeof fetch=fetch):Promise<Campus>{
  const urls=[...(api?[`${api}/v1/campus`]:[]),`${import.meta.env.BASE_URL}campus.json`];
  for(const url of urls)try{const response=await request(url,{signal:AbortSignal.timeout(6000),cache:'no-cache'});if(!response.ok)continue;const c=CampusSchema.parse(await response.json());if(snapshot.manifest.publication==='approved'&&(c.manifest.publication!=='approved'||c.resourceVersion!==snapshot.manifest.version))continue;return c;}catch{/* Keep ordinary resource exploration available. */}
  throw new Error('공간 배치를 사용할 수 없습니다.');
}
export async function loadCoverage(snapshot:Snapshot,campus:Campus,api=defaultApi,request:typeof fetch=fetch){
 const {CoverageSchema,coverageReport}=await import('../../../packages/catalog/src/coverage');
 for(const url of [...(api?[`${api}/v1/coverage`]:[]),`${import.meta.env.BASE_URL}coverage.json`])try{
  const response=await request(url,{signal:AbortSignal.timeout(6000),cache:'no-cache'});if(!response.ok)continue;
  const body=await response.json(),coverage=CoverageSchema.parse(body.coverage??body),report=coverageReport(snapshot,campus,coverage);
  return{coverage,report};
 }catch{/* Use the compatible exported snapshot or retain ordinary resource details. */}
 throw new Error('수록률·필드 검수 배치를 사용할 수 없습니다.');
}
