/* Engine 2C V2: read-only authenticated history page adapter.
 * Not enabled until Engine2B approves an authenticated serving origin and display rights.
 * Never sends credentials in query params and never accesses trading APIs.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Engine2CHistoryV2=factory();
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const FRAMES=['5m','10m','1h','4h','1d','1w','1mo'];
  const PINS=Object.freeze({
    UNADJUSTED:{dataset:'research-dataset:5224f595326ff44d424a9a3ada59fcf548ac5efa4c1e25eb7f4e141331b290f5',basis:'price-basis:d4ff32a184e2236d5bcb6551637253517ec694f7cbdcb8d34afd2f017a35f569',contract:null},
    ADJUSTED_RESEARCH:{dataset:'research-dataset:9caaa3723b576f09bb4040a44c9da3f2a6e0fd5f0bc177f809802e4b80b9a0a4',basis:'price-basis:40baff5124d2cae5b6678813329ed7aab1f47a3ac947555390f8ac7cd212c655',contract:null},
    ACTUAL_CONTRACT:{dataset:'research-dataset:ec592b47b697dc860a47b61dd713d45602d293c8797e1b52fc924a7459d68ac0',basis:'price-basis:98e08538fb38efedcb944e54232df4af396383ed6014c0bc1ef874f228dde05e',contract:'ESZ2026'}
  });
  function checkSelection(view,frame){if(!PINS[view]||!FRAMES.includes(frame))throw Error('INVALID_HISTORY_SELECTION');}
  function validatePage(page,view,frame,cursor){
    checkSelection(view,frame);const p=PINS[view];
    if(!page||page.datasetVersion!==p.dataset||page.priceBasisVersion!==p.basis||page.frame!==frame||page.direction!=='DESC'||page.researchOnly!==true||page.structuralEligible!==false||page.executionPriceAuthority!==false||!Array.isArray(page.rows)||page.rows.length>1000)throw Error('HISTORY_PAGE_CONTEXT_MISMATCH');
    if(page.requestCursor!==undefined&&page.requestCursor!==cursor)throw Error('HISTORY_CURSOR_MISMATCH');
    const ids=new Set();let previous=Infinity;
    for(const row of page.rows){
      if(!row||typeof row.researchCandleId!=='string'||ids.has(row.researchCandleId)||row.frame!==frame||row.priceBasisVersion!==p.basis||row.structuralEligible!==false||row.executionPriceAuthority!==false||!row.prices||!['open','high','low','close'].every(k=>Number.isFinite(row.prices[k]))||!Number.isFinite(Date.parse(row.timestampUtc))||(p.contract&&(row.sourceContract!==p.contract||row.adjustment!==0))||(view==='UNADJUSTED'&&row.adjustment!==0)||(view==='ADJUSTED_RESEARCH'&&typeof row.adjustmentVersion!=='string'))throw Error('HISTORY_ROW_INVALID');
      const current=Date.parse(row.timestampUtc);
      if(current>previous)throw Error('HISTORY_PAGE_ORDER_INVALID');
      previous=current;
      ids.add(row.researchCandleId);
    }
    return page;
  }
  function createLoader(fetchPage){
    if(typeof fetchPage!=='function')throw Error('HISTORY_FETCHER_REQUIRED');
    let generation=0,seq=0;
    function configure(view,frame){checkSelection(view,frame);generation++;seq++;let cursor=null,finished=false;const token=generation;return {
      async next(){
        if(finished)return null;
        const issued=++seq,requestCursor=cursor;
        const response=await fetchPage({view,frame,cursor:requestCursor,limit:1000,datasetVersion:PINS[view].dataset,priceBasisVersion:PINS[view].basis,direction:'DESC'});
        if(token!==generation||issued!==seq)return null;
        const page=validatePage(response,view,frame,requestCursor);
        if(requestCursor!==null&&!page.rows.length&&page.nextCursor===requestCursor)throw Error('HISTORY_CURSOR_NOT_ADVANCING');
        if(page.nextCursor!==null&&page.nextCursor===requestCursor)throw Error('HISTORY_CURSOR_NOT_ADVANCING');
        cursor=page.nextCursor;
        if(cursor===null)finished=true;
        return page;
      },
      get finished(){return finished;},get generation(){return token;}
    };}
    return {configure,invalidate:()=>{generation++;seq++;},pins:PINS};
  }
  return {PINS,FRAMES,validatePage,createLoader};
});
