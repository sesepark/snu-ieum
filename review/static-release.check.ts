import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {StaticEvidenceSchema,checkStatic} from './static-release';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const example=read('infra/launch-evidence.example.json');
const {freeAccountVerified,aiFailureFallbackPassed,...base}=example;
// Synthetic values test validation only; never export them as release evidence.
const input={...Object.fromEntries(Object.entries(base).map(([k,v])=>[k,typeof v==='boolean'?true:v])),reviewedBy:'synthetic-test',checkedAt:'2026-10-30T00:00:00Z',participants:8,success2d:8,success3d:8,foundAndOpenedInTwoMinutes:8,foundBuildingAndOpenedInTwoMinutes:8,relationshipMeaningCorrect:8,medianSeconds2d:60,medianSeconds3d:60,searchTargets:12,relevantTopTenPass:12,desktop3dFps:60,deploymentMode:'static',noExternalAIRequestsPassed:true,staticAssetsPassed:true};
assert.equal(StaticEvidenceSchema.safeParse(input).success,true);
assert.equal(StaticEvidenceSchema.safeParse({...input,participants:8,success2d:9}).success,false);
assert.equal(StaticEvidenceSchema.safeParse({...input,noExternalAIRequestsPassed:false}).success,false);
assert.throws(()=>checkStatic(read('data/college-draft.json'),read('data/campus/campus-draft.json'),read('data/coverage/coverage-draft.json'),input));
console.log('Static gate rejects invalid denominators, external transmission, and unapproved batches.');
