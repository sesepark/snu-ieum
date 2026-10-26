import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { CampusSchema, SnapshotSchema } from '@ieum/contracts';
import { osmMetadata, createCampus } from './campus';
import { Pipeline, PolicySchema } from './pipeline';
import { parseCampus } from '../../../packages/catalog/src/campus';
import { coverageReport } from '../../../packages/catalog/src/coverage';
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const [command,configPath]=process.argv.slice(2);
if(!configPath)throw new Error('campus-cli build|coverage <config.json>');
if(command==='coverage'){
 const config=z.strictObject({snapshot:z.string(),campus:z.string(),coverage:z.string(),output:z.string()}).parse(await json(configPath));
 const snapshot=SnapshotSchema.parse(await json(config.snapshot)),campus=parseCampus(await json(config.campus),snapshot);
 const report=coverageReport(snapshot,campus,await json(config.coverage));
 await writeFile(config.output,JSON.stringify(report,null,2)+'\n');console.log({ready:report.ready,gaps:report.gaps.length});
}else if(command==='build'){
 if(!process.env.DATABASE_URL)throw new Error('Dedicated curation DATABASE_URL required; no file-only raw collection');
 const config=z.strictObject({osmXml:z.string(),officialFacts:z.string(),snapshot:z.string(),output:z.string(),policy:PolicySchema,sourceUrl:z.url()}).parse(await json(configPath));
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),pipeline=new Pipeline(pool);
 const runId=await pipeline.start('campus-import',config.policy);
 try{
  const xml=await readFile(config.osmXml,'utf8');
  const facts=z.array(z.strictObject({bdNo:z.string(),bdNm:z.string(),lat:z.string(),lon:z.string()})).parse(await json(config.officialFacts));
  const selected=osmMetadata(xml);
  const rawId=await pipeline.record(runId,'campus-source-facts',config.sourceUrl,{osm:selected,officialBuildingFacts:facts});
  const snapshot=SnapshotSchema.parse(await json(config.snapshot));
  const campus=CampusSchema.parse(createCampus(selected,facts,snapshot,new Date().toISOString()));
  const id=randomUUID();
  await pool.query('INSERT INTO staging_records(id,run_id,raw_id,draft) VALUES($1,$2,$3,$4)',[id,runId,rawId,{campusCandidate:campus}]);
  await pipeline.finish(runId,'complete');await writeFile(config.output,JSON.stringify(campus,null,2)+'\n');
  console.log({runId,rawId,stagingId:id,publication:'prototype'});
 }catch(error){await pipeline.finish(runId,'failed');throw error;}finally{await pool.end();}
}else throw new Error('campus-cli build|coverage <config.json>');
