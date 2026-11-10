// Read-only audit of privately exported Engine11 research pages.
// No historical prices printed, uploaded, or committed.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [root]=process.argv.slice(2);
if(!root)throw Error('PRIVATE_ROOT_REQUIRED');
const expected={continuousRaw:[144999,72505,12094,2868,503,99,16],continuousAdjustedClose:[144999,72505,12094,2868,503,99,16],actualESZ2026:[11798,5975,1006,241,45,8,2]};
const pins={
 continuousRaw:['research-dataset:a0c81ce398869440b1b9cd42b94ced0101923356c4c860a9c13232a1f98f3c91','price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908'],
 continuousAdjustedClose:['research-dataset:5d880a0fddf98e0db3d90c2262ab4f5febcf37d3deed83fc3d45426158863b14','price-basis:94b25a5e2dc04574a59966c369243300d205a50527800b63876641a6023e9f63'],
 actualESZ2026:['research-dataset:2dd028c39df6fe16e2adfec59b4c1bba312b21f1b2a2f9b783751a25b32dc808','price-basis:757ed82449f97edfea282111a163ffa04681ba188242fd17034ff9cb91410623']
};
const frames=['5m','10m','1h','4h','1d','1w','1mo'];
let total=0,pages=0;
for(const [view,counts] of Object.entries(expected)){
 const dir=resolve(root,view);
 const catalog=JSON.parse(await readFile(join(dir,view+'-catalog.json'),'utf8'));
 if(catalog.view!==view||catalog.researchOnly!==true||catalog.structuralEligible!==false||catalog.executionPriceAuthority!==false)throw Error('INVALID_PRIVATE_CATALOG');
 if(catalog.datasetVersion!==pins[view][0]||catalog.priceBasisVersion!==pins[view][1])throw Error('EXACT_OCT30_DATASET_OR_PRICE_BASIS_PIN_MISMATCH_'+view);
 for(let f=0;f<frames.length;f++){
  const frame=frames[f],group=catalog.frames[frame];
  if(group.rows!==counts[f])throw Error('FRAME_TOTAL_MISMATCH');
  let counted=0,previous=Infinity,expectedCursor=null;
  const ids=new Set();
  for(const desc of group.pages){
   const payload=JSON.parse(await readFile(join(dir,desc.name),'utf8'));
   if(createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==desc.sha256)throw Error('PAGE_HASH_MISMATCH');
   if(payload.requestCursor!==expectedCursor||payload.datasetVersion!==catalog.datasetVersion||payload.priceBasisVersion!==catalog.priceBasisVersion||payload.frame!==frame||payload.direction!=='DESC'||payload.researchOnly!==true||payload.structuralEligible!==false||payload.executionPriceAuthority!==false)throw Error('PAGE_CONTEXT_MISMATCH');
   for(const row of payload.rows){
    const t=Date.parse(row.timestampUtc);
    if(!Number.isFinite(t)||t>previous||ids.has(row.researchCandleId)||row.frame!==frame||row.priceBasisVersion!==catalog.priceBasisVersion||row.structuralEligible!==false||row.executionPriceAuthority!==false)throw Error('PAGE_ROW_INVALID');
    if(view==='actualESZ2026'&&(row.sourceContract!=='ESZ2026'||row.adjustment!==0))throw Error('ACTUAL_PRICE_CONTAMINATION');
    if(view==='continuousRaw'&&row.adjustment!==0)throw Error('RAW_PRICE_CONTAMINATION');
    ids.add(row.researchCandleId);previous=t;counted++;
   }
   expectedCursor=payload.nextCursor;pages++;
  }
  if(expectedCursor!==null||counted!==counts[f])throw Error('TERMINAL_PAGE_MISMATCH');
  total+=counted;
 }
}
if(total!==485243)throw Error('TOTAL_AUTHENTIC_ROWS_MISMATCH');
process.stdout.write('Verified 21 authentic collections; '+total+' rows, '+pages+' private pages, zero duplicates; no historical price data published.\n');
