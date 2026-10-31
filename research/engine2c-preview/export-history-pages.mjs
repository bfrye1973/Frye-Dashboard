// Engine2C V2 offline export: run ONLY in an authorized private Engine11 artifact
// replay environment. This script does not fetch the provider or publish its output.
// Example (private CI): node export-history-pages.mjs <absolute-series-module.mjs>
//    <absolute-accepted-dataset.json.gz> <private-outside-webroot-dir> <view-name>
// Never commit generated JSON or put it under public/ or build/.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,datasetPath,targetPath,view]=process.argv.slice(2);
const VIEWS={continuousRaw:['research-dataset:a0c81ce398869440b1b9cd42b94ced0101923356c4c860a9c13232a1f98f3c91','price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908'],continuousAdjustedClose:['research-dataset:5d880a0fddf98e0db3d90c2262ab4f5febcf37d3deed83fc3d45426158863b14','price-basis:94b25a5e2dc04574a59966c369243300d205a50527800b63876641a6023e9f63'],actualESZ2026:['research-dataset:2dd028c39df6fe16e2adfec59b4c1bba312b21f1b2a2f9b783751a25b32dc808','price-basis:757ed82449f97edfea282111a163ffa04681ba188242fd17034ff9cb91410623']};
const FRAMES=['5m','10m','1h','4h','1d','1w','1mo'];
if(!modulePath||!datasetPath||!targetPath||!VIEWS[view])throw Error('REQUIRED_PRIVATE_INPUTS_MISSING');
const repo=resolve(process.cwd())+sep,out=resolve(targetPath)+sep;
if(out.startsWith(repo)||repo.startsWith(out))throw Error('EXPORT_MUST_BE_OUTSIDE_REPOSITORY');
if(!resolve(datasetPath).endsWith(view+'.json.gz'))throw Error('DATASET_NAME_MISMATCH');
const {pageDataset}=await import(pathToFileURL(resolve(modulePath)));
if(typeof pageDataset!=='function')throw Error('ACCEPTED_ENGINE11_PAGER_MISSING');
const dataset=JSON.parse(gunzipSync(await readFile(datasetPath)));
const [datasetPin,basisPin]=VIEWS[view];
if(dataset.datasetVersion!==datasetPin||dataset.manifest?.priceBasisVersion!==basisPin||dataset.manifest?.structuralEligible!==false||dataset.manifest?.executionPriceAuthority!==false)throw Error('ACCEPTED_DATASET_IDENTITY_MISMATCH');
await mkdir(targetPath,{recursive:true,mode:0o700});
const canonical=await realpath(targetPath);
if((canonical+sep).startsWith(repo)||repo.startsWith(canonical+sep))throw Error('UNSAFE_EXPORT_DESTINATION');
const sha=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const catalog={schema:'engine2c.private-history-chunks.v2',view,datasetVersion:datasetPin,priceBasisVersion:basisPin,sourceRowVectorSha256:dataset.manifest.rowVectorSha256,frames:{},researchOnly:true,structuralEligible:false,executionPriceAuthority:false};
for(const frame of FRAMES){
 let cursor=null,pageNumber=0,count=0;const seen=new Set(),files=[];
 while(true){
  const requestedCursor=cursor;
  const page=pageDataset(dataset,{datasetVersion:datasetPin,priceBasisVersion:basisPin,frame,limit:1000,cursor,direction:'DESC'});
  if(page.rows.length>1000||page.frame!==frame||page.datasetVersion!==datasetPin||page.priceBasisVersion!==basisPin||page.researchOnly!==true||page.structuralEligible!==false||page.executionPriceAuthority!==false)throw Error('UNSAFE_PAGE_CONTEXT');
  for(const row of page.rows){
   if(seen.has(row.researchCandleId))throw Error('DUPLICATED_PAGE_ROW');
   seen.add(row.researchCandleId);
   if(row.frame!==frame||row.priceBasisVersion!==basisPin||row.structuralEligible!==false||row.executionPriceAuthority!==false)throw Error('UNSAFE_ROW');
  }
  const envelope={...page,requestCursor:requestedCursor};
  const name=`${view}-${frame}-${String(pageNumber).padStart(4,'0')}.json`;
  await writeFile(resolve(canonical,name),JSON.stringify(envelope),{mode:0o600,flag:'wx'});
  files.push({name,sha256:sha(envelope),rows:page.rows.length,requestCursor:requestedCursor,nextCursor:page.nextCursor});
  count+=page.rows.length;pageNumber++;
  if(page.nextCursor===null)break;
  if(page.nextCursor===cursor||pageNumber>1000)throw Error('INVALID_PAGE_PROGRESS');
  cursor=page.nextCursor;
 }
 const expected=dataset.coverage?.[frame]?.count;
 if(expected!==undefined&&count!==expected)throw Error('MISMATCHED_FRAME_CANDLE_TOTAL');
 catalog.frames[frame]={rows:count,coverage:dataset.coverage[frame],pages:files};
}
await writeFile(resolve(canonical,`${view}-catalog.json`),JSON.stringify(catalog),{mode:0o600,flag:'wx'});
process.stdout.write(JSON.stringify({view,frames:Object.fromEntries(FRAMES.map(f=>[f,catalog.frames[f].rows])),catalogSha256:sha(catalog)})+'\n');
