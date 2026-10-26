import{readFile,writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';import{randomUUID}from'node:crypto';import{Pool}from'pg';import{z}from'zod';
import{Pipeline,PolicySchema}from'./pipeline.ts';import{fetchAllowed,readLimited}from'./official.ts';import{selectOpenAlexMetadata,reconcileWorks,WorkMetadataSchema,AuthorIdentitySchema}from'./research-evidence.ts';import{SnapshotSchema}from'@ieum/contracts';
const [command,path]=process.argv.slice(2),json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
if(!path)throw new Error('research-evidence-cli collect|reconcile <config.json>');
if(command==='collect'){
 const config=z.strictObject({policy:PolicySchema,outputDirectory:z.string(),pages:z.number().int().min(1).max(10),startPage:z.number().int().min(1).max(100).default(1),maxCredits:z.number().positive().max(100).default(5)}).parse(await json(path));
 if(!process.env.DATABASE_URL)throw new Error('Dedicated curation DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),pipeline=new Pipeline(pool),runId=await pipeline.start('openalex-bounded-basic-metadata',config.policy),now=new Date().toISOString(),all=[],pages=[];let credits=0;
 try{
  for(let page=config.startPage;page<config.startPage+config.pages&&page<=100;page++){
   const url=new URL('https://api.openalex.org/works');const year=new Date(now).getUTCFullYear();url.searchParams.set('filter',`institutions.id:I139264467,from_publication_date:${year-4}-01-01,to_publication_date:${year}-12-31`);url.searchParams.set('per-page','100');url.searchParams.set('page',String(page));url.searchParams.set('select','id,title,doi,publication_year,is_retracted,type,authorships,topics');
   const fetched=await fetchAllowed(url.href,config.policy),payload=JSON.parse(await readLimited(fetched.response,15_000_000));
   if(!Array.isArray(payload.results))throw new Error('Unexpected OpenAlex payload');
   const used=Number(fetched.response.headers.get('x-ratelimit-credits-used')??0),remaining=fetched.response.headers.get('x-ratelimit-remaining');if(Number.isFinite(used))credits+=used;
   const sourceId=`openalex-metadata-page-${page}`,facts=payload.results.map((w:any)=>selectOpenAlexMetadata(w,sourceId));
   const rawId=await pipeline.record(runId,`basic-page-${page}`,url.href,{page,meta:{count:payload.meta?.count,cost:payload.meta?.cost??null},facts,excluded:['abstract, full text and contacts omitted before Raw']},{page});
   const stagingId=randomUUID();await pool.query('INSERT INTO staging_records(id,run_id,raw_id,draft) VALUES($1,$2,$3,$4)',[stagingId,runId,rawId,{paperMetadataCandidates:facts,status:'pending-author-and-paper-review'}]);
   pages.push({page,url:url.href,sourceId,rawId,stagingId,count:facts.length,remainingCredits:remaining,creditsUsed:used});all.push(...facts);console.log({page,records:facts.length});
   if(facts.length<100||credits>=config.maxCredits||(remaining!==null&&Number(remaining)<=config.maxCredits))break;
  }
  await pipeline.finish(runId,'complete');await mkdir(config.outputDirectory,{recursive:true});
  await writeFile(join(config.outputDirectory,'openalex-candidates.json'),JSON.stringify({runId,checkedAt:now,institutionId:'I139264467',status:'pending-official-author-and-paper-review',pages,records:all},null,2)+'\n');console.log({runId,candidates:all.length,credits});
 }catch(e){await pipeline.finish(runId,'failed');throw e;}finally{await pool.end();}
}else if(command==='reconcile'){
 const config=z.strictObject({snapshot:z.string(),candidates:z.string(),identities:z.string(),output:z.string()}).parse(await json(path));
 const s=SnapshotSchema.parse(await json(config.snapshot)),candidate=await json(config.candidates),identities=z.array(AuthorIdentitySchema).parse(await json(config.identities));const report=reconcileWorks(s,z.array(WorkMetadataSchema).parse(candidate.records),identities);
 await writeFile(config.output,JSON.stringify({resourceVersion:s.manifest.version,generatedAt:new Date().toISOString(),...report},null,2)+'\n');console.log({uniqueWorks:report.uniqueWorks,pending:report.pending.length,linkedPending:report.works.length});
}else throw new Error('Unknown research evidence command');
