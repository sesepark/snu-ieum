import{readFile}from'node:fs/promises';
import type{Snapshot}from'@ieum/contracts';
import{parseCampus}from'../../../packages/catalog/src/campus';
import{CoverageSchema,coverageReport}from'../../../packages/catalog/src/coverage';
export async function loadSpatialFiles(snapshot:Snapshot,paths:{campus:string;coverage:string},approvedOnly=false){
 const [campusInput,coverageInput]=await Promise.all([readFile(paths.campus,'utf8'),readFile(paths.coverage,'utf8')]);
 const campus=parseCampus(JSON.parse(campusInput),snapshot,approvedOnly),coverage=CoverageSchema.parse(JSON.parse(coverageInput));
 const report=coverageReport(snapshot,campus,coverage);
 return{campus,coverage,report};
}
export type SpatialBundle=Awaited<ReturnType<typeof loadSpatialFiles>>;
