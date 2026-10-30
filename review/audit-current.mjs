// Rebuild with: node review/audit-current.mjs (no network, no approval changes).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const snapshot = read('data/college-draft.json');
const campus = read('data/campus/campus-draft.json');
const coverage = read('data/coverage/coverage-draft.json');
const knownSources = new Set([...snapshot.sources, ...campus.sources].map(s => s.id));
const profiles = new Map(coverage.profiles.map(p => [p.resourceId, p.fields]));
const required = {researcher:['researchFields','officialHomepage','affiliation'],lab:['researchFields','officialHomepage','affiliation'],equipment:['model','purpose','operator','usageUrl'],space:['purpose','usageUrl']};
const issues = snapshot.resources.map(r => {
 const fields = profiles.get(r.id) ?? {};
 const missingFields = required[r.kind].filter(k => !fields[k] || /^(?:-|—|n\/?a|unknown|확인 필요|미확인)$/i.test(fields[k].value.trim()));
 return {id:r.id,kind:r.kind,departmentId:r.departmentId,name:r.name,missingFields,unknownSourceIds:r.sourceIds.filter(id=>!knownSources.has(id)),locationCandidates:campus.locations.filter(l=>l.resourceId===r.id).length};
}).filter(r=>r.missingFields.length||r.unknownSourceIds.length||!r.locationCandidates);
const names = new Map();
for (const r of snapshot.resources) {const key = `${r.kind}:${r.departmentId}:${r.name.normalize('NFKC').replace(/\s/g,'').toLowerCase()}`;names.set(key,[...(names.get(key)??[]),r.id]);}
const result = {generatedAt:new Date().toISOString(),researchVersion:snapshot.manifest.version,spatialVersion:campus.manifest.version,publication:snapshot.manifest.publication,inputs:Object.fromEntries(['data/college-draft.json','data/campus/campus-draft.json','data/coverage/coverage-draft.json'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),counts:snapshot.resources.reduce((a,r)=>(a[r.kind]=(a[r.kind]??0)+1,a),{}),relations:snapshot.relations.length,displayEvidence:snapshot.evidence.length,verifiedPapers:coverage.works.filter(w=>w.kind==='paper'&&w.status==='verified').length,duplicateNameCandidates:[...names.values()].filter(ids=>ids.length>1),issues,notes:['Missing field checks are structural, not human factual approval.','Location candidates include unknown and expired records; not a mapped-resource count.','Duplicate names are review candidates and must never be merged automatically.']};
writeFileSync('review/current-quality-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,reviewItems:issues.length,duplicateNameGroups:result.duplicateNameCandidates.length}));
