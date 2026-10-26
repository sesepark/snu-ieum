import{z}from'zod';import{CampusSchema,Id,SnapshotSchema,type Snapshot}from'@ieum/contracts';
import{parseCampus}from'../../../packages/catalog/src/campus.ts';import{CoverageSchema,coverageReport}from'../../../packages/catalog/src/coverage.ts';import{sanitize}from'./privacy.ts';
const Review=z.strictObject({status:z.literal('approved'),reviewedBy:Id,reviewedAt:z.iso.datetime({offset:true}),reason:z.string().trim().min(1)});
export function prepareApprovedSpatial(input:unknown,reviewInput:unknown,snapshotInput:Snapshot,version:string,now=new Date().toISOString()){
 const snapshot=SnapshotSchema.parse(snapshotInput),review=Review.parse(reviewInput);Id.parse(version);
 if(snapshot.manifest.publication!=='approved')throw new Error('Approved research batch required');
 const candidate=z.strictObject({campusCandidate:z.unknown(),coverageCandidate:z.unknown()}).parse(input);
 const draft=parseCampus(candidate.campusCandidate,snapshot),coverage=CoverageSchema.parse(candidate.coverageCandidate);
 if(draft.manifest.publication!=='prototype')throw new Error('Export the reviewed spatial draft only');
 if(sanitize({campus:draft,coverage}).exclusions.length)throw new Error('Remove contact data from spatial review');
 const campus=CampusSchema.parse({...draft,manifest:{...draft.manifest,version,publication:'approved',generatedAt:now,reviewedBy:review.reviewedBy,reviewedAt:review.reviewedAt}});
 const report=coverageReport(snapshot,campus,coverage);
 return{campus,coverage,report,review:{...review,exportedAt:now,resourceVersion:snapshot.manifest.version,spatialVersion:version}};
}
