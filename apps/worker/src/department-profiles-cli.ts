import{readFile,writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';
import{Pool}from'pg';import{z}from'zod';import{load}from'cheerio';
import{Pipeline,PolicySchema,assertAllowed}from'./pipeline.ts';import{fetchAllowed,readLimited}from'./official.ts';
import{parseIEFaculty,parseNuclearFaculty,parseAerospaceFaculty,parseIELab}from'./department-profiles.ts';
// Source collection only: repeated runs never mutate canonical drafts or grant approval.
if(!process.env.DATABASE_URL||!process.argv[2])throw new Error('DATABASE_URL and reviewed source policy config path required');
const config=z.strictObject({policies:z.array(PolicySchema).min(1),outputDirectory:z.string().min(1)}).parse(JSON.parse(await readFile(process.argv[2],'utf8')));
const pool=new Pool({connectionString:process.env.DATABASE_URL}),pipeline=new Pipeline(pool),records:unknown[]=[];
const policyFor=(url:string)=>{const policy=config.policies.find(p=>p.allowedHosts.includes(new URL(url).hostname));if(!policy)throw new Error('No reviewed policy for source');assertAllowed(url,policy);return policy;};
const sourceHtml=async(url:string)=>{const fetched=await fetchAllowed(url,policyFor(url));if(!fetched.response.headers.get('content-type')?.includes('text/html'))throw new Error('Expected HTML');return readLimited(fetched.response,4_000_000);};
try{
 for(const[departmentId,url,parser]of[
  ['industrial','https://ie.snu.ac.kr/professor/',parseIEFaculty],
  ['nuclear','https://nucleng.snu.ac.kr/about/people/faculty',parseNuclearFaculty],
  ['aerospace','https://aerospace.snu.ac.kr/about/faculty',parseAerospaceFaculty]
 ]as const){
  const policy=policyFor(url),runId=await pipeline.start('official-faculty-field-candidates',policy);
  try{
   const html=await sourceHtml(url),facts=parser(html);if(facts.length<10)throw new Error('Faculty selector incomplete');
   const rawId=await pipeline.record(runId,departmentId,url,{facts,excluded:['contact details, original HTML, images, guest and emeritus sections omitted']});
   const stagingIds=[];
   for(const[i,fact]of facts.entries())stagingIds.push(await pipeline.stageCandidate(runId,rawId,{kind:'researcher',name:fact.name,sourceUrl:url,externalId:`${url}#official-card-${i+1}`,parserVersion:policy.parserVersion,facts:{departmentId,rank:fact.rank,researchFields:fact.researchFields??'',officialHomepage:fact.homepage??'',officeAddress:fact.officeAddress??'',labLabel:fact.labName??''}}));
   await pipeline.finish(runId,'complete');records.push({departmentId,url,runId,rawId,stagingIds,count:facts.length});
   if(departmentId==='industrial'){
    const $=load(html),links=[...new Set($('a[href]').toArray().filter(a=>/연구실/.test($(a).text())).map(a=>$(a).attr('href')!).filter(u=>/^https:\/\/ie.snu.ac.kr\/[a-z0-9_]+\/$/.test(u)))];
    if(links.length!==15)throw new Error('Official IE lab menu changed');
    for(const labUrl of links){
     const labPolicy=policyFor(labUrl),labRun=await pipeline.start('official-lab-field-candidates',labPolicy);
     try{
      const fact=parseIELab(await sourceHtml(labUrl));
      const labRaw=await pipeline.record(labRun,labUrl,labUrl,{fact});
      const stagingId=await pipeline.stageCandidate(labRun,labRaw,{kind:'lab',name:fact.title,sourceUrl:labUrl,externalId:labUrl,parserVersion:labPolicy.parserVersion,facts:{departmentId:'industrial',advisor:fact.advisor??'',researchFields:fact.researchFields??'',officialHomepage:fact.homepage??'',labAddress:fact.address??''}});
      await pipeline.finish(labRun,'complete');records.push({departmentId:'industrial',url:labUrl,runId:labRun,rawId:labRaw,stagingId});
     }catch(e){await pipeline.finish(labRun,'failed');throw e;}
    }
   }
  }catch(e){await pipeline.finish(runId,'failed');throw e;}
 }
 await mkdir(config.outputDirectory,{recursive:true});
 const path=join(config.outputDirectory,`department-collection-${Date.now()}.json`);
 await writeFile(path,JSON.stringify({checkedAt:new Date().toISOString(),status:'pending-identity-location-and-human-review',records},null,2)+'\n',{flag:'wx'});
 console.log({output:path,sources:records.length,status:'pending-human-review'});
}finally{await pool.end();}
