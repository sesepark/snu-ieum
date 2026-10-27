import{readFile,writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';import{Pool}from'pg';import{z}from'zod';
import{Pipeline,PolicySchema}from'./pipeline.ts';import{fetchAllowed,readLimited}from'./official.ts';import{parseIRFList,parseIRFEquipment,parseIRFApplications}from'./equipment.ts';
// Collect selected factual metadata only. No approval, canonical overwrite, schedules or reservations.
if(!process.env.DATABASE_URL||!process.argv[2])throw new Error('DATABASE_URL and reviewed policy config required');
const config=z.strictObject({policy:PolicySchema,outputDirectory:z.string().min(1)}).parse(JSON.parse(await readFile(process.argv[2],'utf8'))),pool=new Pool({connectionString:process.env.DATABASE_URL}),pipeline=new Pipeline(pool),records:unknown[]=[];
const html=async(url:string)=>{const fetched=await fetchAllowed(url,config.policy);if(!fetched.response.headers.get('content-type')?.includes('text/html'))throw new Error('Expected public HTML');return readLimited(fetched.response);};
try{
 const runId=await pipeline.start('irf-equipment-application-candidates',config.policy);
 try{
  const listUrl='https://irf.snu.ac.kr/possessed_device/possessed_device.php',list=parseIRFList(await html(listUrl));
  if(list.length<20||new Set(list.map(x=>x.externalId)).size!==list.length)throw new Error('IRF equipment inventory changed');
  await pipeline.record(runId,'irf-list',listUrl,{list});
  for(const entry of list){
   const url=`${listUrl}?idx=${entry.externalId}`,detailUrl=`https://irf.snu.ac.kr/possessed_device/pop_detail.php?idx=${entry.externalId}`,fact=parseIRFEquipment(await html(url)),applications=parseIRFApplications(await html(detailUrl));
   if(!fact.name)throw new Error('Equipment selector changed');
   const rawId=await pipeline.record(runId,entry.externalId,detailUrl,{externalId:entry.externalId,...fact,...applications,sourceUrl:url,detailUrl});
   const stagingId=await pipeline.stageCandidate(runId,rawId,{kind:'equipment',name:fact.name,sourceUrl:url,externalId:`irf-${entry.externalId}`,parserVersion:config.policy.parserVersion,facts:{model:fact.model??'',installationAddress:fact.address??'',purpose:applications.purpose??'',purposeSourceUrl:detailUrl,operator:'서울대학교 기초과학공동기기원'}});
   records.push({externalId:entry.externalId,...fact,...applications,sourceUrl:url,detailUrl,rawId,stagingId});
  }
  await pipeline.finish(runId,'complete');await mkdir(config.outputDirectory,{recursive:true});const path=join(config.outputDirectory,`irf-applications-${Date.now()}.json`);await writeFile(path,JSON.stringify({checkedAt:new Date().toISOString(),runId,status:'pending-human-review',records},null,2)+'\n',{flag:'wx'});console.log({path,count:records.length});
 }catch(e){await pipeline.finish(runId,'failed');throw e;}
}finally{await pool.end();}
