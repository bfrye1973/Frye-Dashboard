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
const VIEWS={continuousRaw:['research-dataset:5224f595326ff44d424a9a3ada59fcf548ac5efa4c1e25eb7f4e141331b290f5','price-basis:d4ff32a184e2236d5bcb6551637253517ec694f7cbdcb8d34afd2f017a35f569'],continuousAdjustedClose:['research-dataset:9caaa3723b576f09bb4040a44c9da3f2a6e0fd5f0bc177f809802e4b80b9a0a4','price-basis:40baff5124d2cae5b6678813329ed7aab1f47a3ac947555390f8ac7cd212c655'],actualESZ2026:['research-dataset:ec592b47b697dc860a47b61dd713d45602d293c8797e1b52fc924a7459d68ac0','price-basis:98e08538fb38efedcb944e54232df4af396383ed6014c0bc1ef874f228dde05e']};
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
