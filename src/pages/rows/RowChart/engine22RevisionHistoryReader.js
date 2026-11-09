// Engine2 read-only cursor/replay for the EXISTING Engine22 persistent journal.
// This is enabled only when Engine22's Strategy snapshot says durable history is
// available. It never calculates waves or sends a backend history Bearer token.
export const HISTORY_SCHEMA="engine22.chartNodeHistoryPage.v1";
const ENDPOINT="https://frye-market-backend-1.onrender.com/api/engine22/wave-history/nodes";
const positiveRevision=v=>Number.isSafeInteger(v)&&v>=0;

export async function fetchOwnerWaveHistoryPage({afterRevision=0,limit=50,ownerKey,
  fetcher=fetch,signal}={}){
  if(!ownerKey||typeof ownerKey!=="string")throw Error("ENGINE22_HISTORY_OWNER_ACCESS_REQUIRED");
  if(!positiveRevision(afterRevision)||!Number.isInteger(limit)||limit<1||limit>100)
    throw Error("ENGINE22_HISTORY_INVALID_CURSOR");
  const url=new URL(ENDPOINT);
  url.searchParams.set("afterRevision",String(afterRevision));
  url.searchParams.set("limit",String(limit));
  const response=await fetcher(url.toString(),{
    method:"GET",credentials:"omit",cache:"no-store",signal,
    headers:{Accept:"application/json","x-engine2c-access":ownerKey},
  });
  if(!response.ok)throw Error("ENGINE22_HISTORY_HTTP_"+response.status);
  return response.json();
}

export function createEngine22RevisionHistoryReader({getPage,onUpdate}={}){
  if(typeof getPage!=="function")throw Error("ENGINE22_HISTORY_PAGE_READER_REQUIRED");
  const state={cursor:0,records:[],seen:new Map()};
  let inflight=null,closed=false;
  const snapshot=()=>({cursor:state.cursor,records:state.records.slice()});
  async function catchUp(){
    if(closed)return snapshot();
    if(inflight)return inflight;
    inflight=(async()=>{
      let changed=false;
      for(let batch=0;batch<200&&!closed;batch++){
        const from=state.cursor;
        const page=await getPage({afterRevision:from,limit:50});
        if(closed)break;
        if(page?.schema!==HISTORY_SCHEMA||page.readOnly!==true||
           !Array.isArray(page.records)||!positiveRevision(page.nextRevision)||
           page.nextRevision<from||page.afterRevision!==from||
           typeof page.hasMore!=="boolean"||
           (page.hasMore&&page.nextRevision===from))
          throw Error("ENGINE22_HISTORY_INVALID_PAGE_OR_CURSOR");
        for(const record of page.records){
          if(typeof record?.nodeId!=="string"||!record.nodeId||
             !Number.isSafeInteger(record.sourceRevision)||record.sourceRevision<1||
             !Number.isSafeInteger(record.publicationRevision)||
             record.publicationRevision<=from||
             record.publicationRevision>page.nextRevision||
             record.plotAllowed!==false)
            throw Error("ENGINE22_HISTORY_INVALID_NODE_RECORD");
          const id=record.publicationRevision+":"+record.nodeId+":"+record.sourceRevision;
          const contents=JSON.stringify(record);
          const seen=state.seen.get(id);
          if(seen!==undefined && seen!==contents)
            throw Error("ENGINE22_HISTORY_REVISION_COLLISION");
          if(seen===undefined){
            state.seen.set(id,contents);
            state.records.push({...record});
            changed=true;
          }
        }
        if(state.cursor!==page.nextRevision)changed=true;
        state.cursor=page.nextRevision;
        if(!page.hasMore)break;
        if(batch===199)throw Error("ENGINE22_HISTORY_TOO_MANY_PAGES");
      }
      if(changed&&!closed)onUpdate?.(snapshot());
      return snapshot();
    })().finally(()=>{inflight=null;});
    return inflight;
  }
  return {catchUp,snapshot,close:()=>{closed=true}};
}
