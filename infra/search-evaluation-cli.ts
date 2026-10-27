import{readFile,writeFile}from'node:fs/promises';import{z}from'zod';import{SnapshotSchema}from'@ieum/contracts';import{createSearchPack,scoreSearchPack}from'./search-evaluation.ts';
const[mode,snapshotPath,campusPath,coveragePath,tasksPath,outputPath,reviewsPath]=process.argv.slice(2);
if(!['export','score'].includes(mode)||![snapshotPath,campusPath,coveragePath,tasksPath,outputPath].every(Boolean)||(mode==='score'&&!reviewsPath))throw new Error('Usage: export|score snapshot campus coverage fixed-tasks output [reviews]');
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const snapshot=SnapshotSchema.parse(await read(snapshotPath)),campus=await read(campusPath),coverage=await read(coveragePath),tasks=await read(tasksPath);
if(mode==='export'){
 const pack=createSearchPack(snapshot,campus,coverage,tasks);await writeFile(outputPath,JSON.stringify(pack,null,2)+'\n',{flag:'wx'});console.log({outputPath,cases:pack.cases.length,status:'pending-two-independent-reviews'});
}else{
 const envelope=z.object({exportedAt:z.iso.datetime(),reviews:z.unknown()}).parse(await read(reviewsPath)),pack=createSearchPack(snapshot,campus,coverage,tasks,envelope.exportedAt);
 const result=scoreSearchPack(pack,envelope.reviews);await writeFile(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log({outputPath,evaluationConducted:result.evaluationConducted,targetMet:result.targetMet});
}
