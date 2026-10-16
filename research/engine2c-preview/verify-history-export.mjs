// Read-only audit of privately exported Engine11 research pages.
// No historical prices printed, uploaded, or committed.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [root]=process.argv.slice(2);
if(!root)throw Error('PRIVATE_ROOT_REQUIRED');
const expected={continuousRaw:[141181,70596,11776,2794,490,97,16],continuousAdjustedClose:[141181,70596,11776,2794,490,97,16],actualESZ2026:[7980,4066,688,167,32,6,2]};
const frames=['5m','10m','1h','4h','1d','1w','1mo'];
let total=0,pages=0;
for(const [view,counts] of Object.entries(expected)){
 const dir=resolve(root,view);
 const catalog=JSON.parse(await readFile(join(dir,view+'-catalog.json'),'utf8'));
 if(catalog.view!==view||catalog.researchOnly!==true||catalog.structuralEligible!==false||catalog.executionPriceAuthority!==false)throw Error('INVALID_PRIVATE_CATALOG');
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
if(total!==466841)throw Error('TOTAL_AUTHENTIC_ROWS_MISMATCH');
process.stdout.write('Verified 21 authentic collections; '+total+' rows, '+pages+' private pages, zero duplicates; no historical price data published.\n');
