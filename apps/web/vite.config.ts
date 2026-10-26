import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { SnapshotSchema } from '@ieum/contracts';
import { parseCampus } from '../../packages/catalog/src/campus.ts';
import { CoverageSchema,coverageReport } from '../../packages/catalog/src/coverage.ts';
function files(){
 const snapshotPath=resolve(process.env.IEUM_SNAPSHOT_PATH || '../../data/college-draft.json');
 const snapshot=SnapshotSchema.parse(JSON.parse(readFileSync(snapshotPath,'utf8'))),approved=snapshot.manifest.publication==='approved';
 return{snapshotPath,snapshot,approved,campusPath:resolve(process.env.IEUM_CAMPUS_PATH || (approved?resolve(dirname(snapshotPath),'public-campus.json'):'../../data/campus/campus-draft.json')),coveragePath:resolve(process.env.IEUM_COVERAGE_PATH || (approved?resolve(dirname(snapshotPath),'public-coverage.json'):'../../data/coverage/coverage-draft.json'))};
}
export default defineConfig({
 base:'/snu-ieum/',plugins:[react(),{
  name:'approved-snapshot',
  configureServer(server){for(const [url,key]of [['snapshot.json','snapshotPath'],['campus.json','campusPath'],['coverage.json','coveragePath']]as const)server.middlewares.use(`/snu-ieum/${url}`,(_req,res)=>{try{res.setHeader('Content-Type','application/json');res.end(readFileSync(files()[key]));}catch{res.statusCode=503;res.end(JSON.stringify({error:'배치 파일을 사용할 수 없습니다.'}));}});},
  generateBundle(){
   const f=files(),campus=JSON.parse(readFileSync(f.campusPath,'utf8')),coverage=CoverageSchema.parse(JSON.parse(readFileSync(f.coveragePath,'utf8')));
   if(f.approved){const spatial=parseCampus(campus,f.snapshot,true);const report=coverageReport(f.snapshot,spatial,coverage);if(!report.ready)throw new Error('Approved release requires complete spatial and research coverage evidence');}
   for(const [fileName,path]of [['snapshot.json',f.snapshotPath],['campus.json',f.campusPath],['coverage.json',f.coveragePath]])this.emitFile({type:'asset',fileName,source:readFileSync(path)});
  }
 }],server:{host:'127.0.0.1',fs:{allow:['../..']}},build:{chunkSizeWarningLimit:1500}
});
