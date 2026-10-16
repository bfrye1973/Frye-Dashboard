/* Engine 2C — offline only, no runtime dependency on production App/RowChart.
 * This module intentionally requires a user-supplied, decoded, pinned Engine 11 fixture.
 * No network, source-price transformation, automatic wave count or Fibonacci plotting.
 */
(() => {
  'use strict';
  const CAP = 25000;
  const FRAMES = ['5m','10m','1h','4h','1d','1w','1mo'];
  const VIEWS = ['UNADJUSTED','ADJUSTED_RESEARCH','ACTUAL_CONTRACT'];
  const DEGREES = ['ALL','SUBMICRO','MICRO','SUBMINUTE','MINUTE','MINOR','INTERMEDIATE','PRIMARY'];
  const LABELS = {UNADJUSTED:'Continuous ES — Unadjusted / RESEARCH ONLY', ADJUSTED_RESEARCH:'Continuous ES — Back-adjusted Research / NOT CERTIFIED ES1!',ACTUAL_CONTRACT:'Actual ESZ2026 — archived historical snapshot / NOT LIVE'};
  const $ = id => document.getElementById(id);
  const escape = s => String(s == null ? '—' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const state = {handoff:null,view:'UNADJUSTED',frame:'5m',degree:'ALL',generation:0,request:0,rows:[],identities:new Set(),pageSet:new Set(),cursor:null,zoom:1,offset:0,marks:true};
  const frameSeconds={ '5m':300,'10m':600,'1h':3600,'4h':14400,'1d':86400,'1w':604800,'1mo':2629746 };
  const date = ns => {if(typeof ns !== 'string' && typeof ns !== 'number')return NaN;const x=String(ns);if(/^\d{15,}$/.test(x))return Number(x.slice(0,-9));if(/^\d{10}$/.test(x))return Number(x);const d=Date.parse(x);return Number.isFinite(d)?Math.floor(d/1000):NaN;};
  const time = s => new Date(s*1000).toLocaleString('en-US',{timeZone:'America/Phoenix',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const rect=(canvas,x,y,w,h,c)=>{canvas.fillStyle=c;canvas.fillRect(x,y,w,h)};
  function selection(){return {view:state.view,frame:state.frame,degree:state.degree};}
  // V2 is dormant until an approved, same-origin authenticated research route exists.
  const historyEndpoint = window.__ENGINE2C_HISTORY_ENDPOINT__ === 'https://frye-market-backend-1.onrender.com/engine2c-private-history/page' ? window.__ENGINE2C_HISTORY_ENDPOINT__ : null;
  // Research only. The token is stored for this browser tab, not embedded in deployed assets.
  let historicalZip=null;
  if(historyEndpoint){
    const olderButton=$('older');if(olderButton)olderButton.textContent='Load older historical candles';
    const newerButton=document.createElement('button');newerButton.id='newer';newerButton.textContent='Load newer historical candles';olderButton?.insertAdjacentElement('afterend',newerButton);
    const header=document.querySelector('header p');if(header)header.textContent='UNVERIFIED / AUTHENTIC HISTORICAL RESEARCH / NOT LIVE / NOT EXECUTION ELIGIBLE';
  }
  let historySession=null,historyBusy=false;
  const historyPins={UNADJUSTED:['research-dataset:5224f595326ff44d424a9a3ada59fcf548ac5efa4c1e25eb7f4e141331b290f5','price-basis:d4ff32a184e2236d5bcb6551637253517ec694f7cbdcb8d34afd2f017a35f569'],ADJUSTED_RESEARCH:['research-dataset:9caaa3723b576f09bb4040a44c9da3f2a6e0fd5f0bc177f809802e4b80b9a0a4','price-basis:40baff5124d2cae5b6678813329ed7aab1f47a3ac947555390f8ac7cd212c655'],ACTUAL_CONTRACT:['research-dataset:ec592b47b697dc860a47b61dd713d45602d293c8797e1b52fc924a7459d68ac0','price-basis:98e08538fb38efedcb944e54232df4af396383ed6014c0bc1ef874f228dde05e']};
  async function requestHistory(view,frame,cursor,signal){
    if(!historyEndpoint)throw Error('PRIVATE_HISTORY_NOT_CONFIGURED');
    if(historyEndpoint==='zip-file')return historicalZip.page(view,frame,cursor,historyPins[view]);
    const args=new URLSearchParams({view,frame,limit:'1000',direction:'DESC',datasetVersion:historyPins[view][0],priceBasisVersion:historyPins[view][1]});
    if(cursor!==null)args.set('cursor',cursor);
    const fetchPrivate=async key=>fetch(historyEndpoint+'?'+args,{
      credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/json','X-Engine2C-Access':key}
    });
    // The verified owner link only needs to be opened once per browser.
    // Keep research authorization isolated from LIVE and expire it after 24h.
    const storageKey='engine2cResearchOwnerAccessV1';
    let key=sessionStorage.getItem('engine2cResearchOwnerKey')||'';
    const fragment=new URLSearchParams((window.top.location.hash||'').replace(/^#/, ''));
    const supplied=fragment.get('engine2cKey')||'';
    if(supplied){
      key=supplied;
      sessionStorage.setItem('engine2cResearchOwnerKey',key);
      localStorage.setItem(storageKey,JSON.stringify({key,expiresAt:Date.now()+86400000}));
      window.top.history.replaceState(window.top.history.state,'',window.top.location.pathname+window.top.location.search);
    }
    if(!key){
      try{
        const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
        if(saved?.expiresAt>Date.now()&&typeof saved.key==='string'){
          key=saved.key;
          sessionStorage.setItem('engine2cResearchOwnerKey',key);
        }else localStorage.removeItem(storageKey);
      }catch{localStorage.removeItem(storageKey);}
    }
    if(!key)throw Error('PRIVATE_RESEARCH_ACCESS_REQUIRED');
    let res=await fetchPrivate(key);
    if(res.status===401){
      sessionStorage.removeItem('engine2cResearchOwnerKey');
      localStorage.removeItem(storageKey);
      throw Error('RESEARCH_OWNER_ACCESS_REJECTED');
    }
    if(!res.ok)throw Error('PRIVATE_HISTORY_HTTP_'+res.status);
    if(!(res.headers.get('content-type')||'').includes('application/json'))throw Error('PRIVATE_HISTORY_INVALID_CONTENT_TYPE');
    const json=await res.json();
    if(json.datasetVersion!==historyPins[view][0]||json.priceBasisVersion!==historyPins[view][1]||json.direction!=='DESC'||json.frame!==frame||json.researchOnly!==true||json.structuralEligible!==false||json.executionPriceAuthority!==false||!Array.isArray(json.rows)||json.rows.length>1000)throw Error('PRIVATE_HISTORY_BASIS_MISMATCH');
    return json;
  }
  function currentFixture(){return state.handoff?.fixtures?.[state.view]?.[state.frame]??null;}
  function availableNodes(){const groups=state.handoff?.nodeLayers?.degrees||{};return state.degree==='ALL'?Object.values(groups).flat():groups[state.degree]||[];}
  function checkHandoff(h){
    if(!h||typeof h!=='object'||!h.fixtures||!h.views||!h.nodeLayers||!h.handoffVersion)throw Error('Missing Engine 11 handoff contract');
    if(h.nodeLayers.officialFibonacciLevels?.length || h.nodeLayers.officialStructuralLevels?.length)throw Error('Official layers forbidden in preview');
    if(h.nodeLayers.withheldFibonacciReferences?.length!==34)throw Error('Expected 34 withheld Fibonacci references');
    const all=Object.values(h.nodeLayers.degrees||{}).flat();
    if(all.length!==40||new Set(all.map(n=>n.registryNodeId)).size!==40)throw Error('Source node registry mismatch: expected 40 unique nodes');
    const minor=all.find(n=>n.registryNodeId==='WB-ALL-024');
    if(minor?.originalOwnerCoordinate?.price!==6496||minor?.originalRecordedLocalTime!=='2026-03-30T16:00:00')throw Error('Owner-corrected MINOR W1 source mismatch');
    for(const v of VIEWS){const entry=h.views[v];if(!entry?.datasetVersion||!entry?.priceBasisVersion||entry.archivedSnapshotOnly!==true||entry.officialOverlayEligible!==false)throw Error('Unpinned research basis: '+v);for(const f of FRAMES){const x=h.fixtures?.[v]?.[f];if(!x?.firstPage?.rows)throw Error('Missing native research frame '+v+'/'+f);}}
    return h;
  }
  function validatePage(p){
    const v=state.handoff?.views?.[state.view];
    if(!v||p?.datasetVersion!==v.datasetVersion||p?.priceBasisVersion!==v.priceBasisVersion||p?.frame!==state.frame||p?.researchOnly!==true||p?.structuralEligible!==false||p?.executionPriceAuthority!==false||!Array.isArray(p.rows))throw Error('Incompatible source page/context');
    for(const r of p.rows){
      const px=r.prices;
      if(r.frame!==state.frame||r.priceBasisVersion!==v.priceBasisVersion||r.structuralEligible!==false||r.executionPriceAuthority!==false||!px||!['open','high','low','close'].every(k=>finite(px[k]))||!r.researchCandleId||!Number.isFinite(date(r.timestampNs)))throw Error('Invalid or unverified source candle');
      if(state.view==='UNADJUSTED'&&r.adjustment!==0)throw Error('Adjusted row in unadjusted view');
      if(state.view==='ADJUSTED_RESEARCH'&&typeof r.adjustmentVersion!=='string')throw Error('Unpinned research adjustment');
      if(state.view==='ACTUAL_CONTRACT'&&(r.sourceContract!=='ESZ2026'||r.adjustment!==0))throw Error('Actual contract row mismatch');
    }
  }
  function appendPage(p,key){
    validatePage(p);
    if(state.pageSet.has(key))return false;
    state.pageSet.add(key);
    const oldAnchor=state.rows[Math.min(state.rows.length-1,Math.max(0,Math.floor(state.offset)))]?.researchCandleId;
    for(const r of p.rows)if(!state.identities.has(r.researchCandleId)){
      state.identities.add(r.researchCandleId);state.rows.push(r);
    }
    state.rows.sort((a,b)=>date(a.timestampNs)-date(b.timestampNs));
    // Preserve a visible candle's identity when older pages are prepended.
    if(state.rows.length>CAP){
      // When browsing older history, keep the newly requested older end of the window.
      // A future newer-direction fetch can recover evicted bars; do not silently
      // discard the just-loaded page by evicting from the older end.
      const drop=historyEndpoint&&(key.startsWith('history-')||key.startsWith('older-reload-'))
        ?state.rows.splice(CAP,state.rows.length-CAP)
        :state.rows.splice(0,state.rows.length-CAP);
      drop.forEach(r=>state.identities.delete(r.researchCandleId));
    }
    if(oldAnchor){const nextAnchor=state.rows.findIndex(r=>r.researchCandleId===oldAnchor);if(nextAnchor>=0)state.offset=nextAnchor;}
    if(key!=='roll')state.cursor=p.nextCursor??null;
    draw();details();return true;
  }
  function clearContext(){
    historySession?.abort?.();historySession=null;historyBusy=false;
    state.generation++;state.request++;state.rows=[];state.identities.clear();state.pageSet.clear();state.cursor=null;state.zoom=1;state.offset=0;
  }
  async function loadSelection(){
    const gen=state.generation,seq=++state.request;
    await Promise.resolve(); // predictable newest-intent guard even for async adapters
    if(gen!==state.generation||seq!==state.request)return;
    if(historyEndpoint){
      const session={abortController:new AbortController(),page:0,oldestLoaded:0,newestLoaded:0,cursors:[null],serial:0,abort(){this.abortController.abort();}};
      historySession=session;
      const p=await requestHistory(state.view,state.frame,null,session.abortController.signal);
      if(gen!==state.generation||seq!==state.request||historySession!==session)return;
      appendPage(p,'history-0');session.page=1;session.cursors[1]=p.nextCursor;return;
    }
    const fixture=currentFixture();
    if(!fixture)throw Error('No pinned page for selection');
    appendPage(fixture.firstPage,'first');
  }
  function choose(){
    const v=$('view').value,f=$('frame').value,d=$('degree').value;
    if(!VIEWS.includes(v)||!FRAMES.includes(f)||!DEGREES.includes(d))return;
    const sameCandles=state.view===v&&state.frame===f;
    state.view=v;state.frame=f;state.degree=d;
    if(sameCandles){state.generation++;state.request++;draw();details();return;}
    clearContext();
    if(state.handoff)loadSelection().catch(showError);else details();
  }
  function showError(e){$('status').textContent='RESEARCH LOAD BLOCKED: '+(e?.message||e);$('chartEmpty').hidden=false;}
  async function older(){
    if(historyEndpoint){
      const session=historySession;if(!session||historyBusy)return;
      const gen=state.generation,view=state.view,frame=state.frame;
      const reloading=session.oldestLoaded<session.page-1,requestedPage=reloading?session.oldestLoaded+1:session.page;
      // Reopen an evicted older page even when the complete archive's terminal
      // nextCursor is null. Terminal applies to NEW pagination, not cache reload.
      if(!reloading && state.cursor===null){$('status').textContent='End of approved historical data';return;}
      const cursor=reloading?session.cursors[requestedPage]:state.cursor;
      if(cursor===undefined||cursor===null){if(requestedPage>0){$('status').textContent='End of available history';return;}}
      historyBusy=true;
      try{
        const p=await requestHistory(view,frame,cursor,session.abortController.signal);
        if(gen!==state.generation||historySession!==session)return;
        if(p.requestCursor!==undefined&&p.requestCursor!==cursor)throw Error('PRIVATE_HISTORY_CURSOR_MISMATCH');
        if(p.nextCursor===cursor)throw Error('PRIVATE_HISTORY_CURSOR_LOOP');
        const willEvict=state.rows.length+p.rows.filter(r=>!state.identities.has(r.researchCandleId)).length>CAP;
        appendPage(p,(reloading?'older-reload-':'history-')+requestedPage+'-'+(++session.serial));
        session.oldestLoaded=requestedPage;
        if(willEvict)session.newestLoaded=Math.min(session.oldestLoaded,session.newestLoaded+1);
        if(!reloading){session.page=requestedPage+1;session.cursors[session.page]=p.nextCursor;}
        else state.cursor=session.cursors[session.page]??null;
      }catch(e){if(e.name!=='AbortError'&&historySession===session)showError(e);}finally{if(historySession===session)historyBusy=false;}
      return;
    }
    const f=currentFixture();if(!f||!state.handoff)return;
    if(state.pageSet.has('second')||!f.firstPage.nextCursor||!f.secondPage){$('status').textContent='No further pinned older sample page. Unqueried history is unavailable.';return;}
    if(f.secondRequest?.cursor!==f.firstPage.nextCursor){showError(Error('Pinned cursor mismatch'));return;}
    try{appendPage(f.secondPage,'second');}catch(e){showError(e);}
  }
  async function newer(){
    if(!historyEndpoint||!historySession||historyBusy)return;
    const session=historySession,requestedPage=session.newestLoaded-1;
    if(requestedPage<0){$('status').textContent='Already at newest archived page';return;}
    const cursor=session.cursors[requestedPage];
    if(cursor===undefined)return showError(Error('NEWER_PAGE_CURSOR_MISSING'));
    const gen=state.generation,view=state.view,frame=state.frame,olderFrontier=state.cursor;
    historyBusy=true;
    try{
      const p=await requestHistory(view,frame,cursor,session.abortController.signal);
      if(gen!==state.generation||historySession!==session)return;
      if(p.requestCursor!==undefined&&p.requestCursor!==cursor)throw Error('NEWER_CURSOR_MISMATCH');
      const willEvict=state.rows.length+p.rows.filter(r=>!state.identities.has(r.researchCandleId)).length>CAP;
      appendPage(p,'newer-reload-'+requestedPage+'-'+(++session.serial));
      state.cursor=olderFrontier;session.newestLoaded=requestedPage;
      if(willEvict)session.oldestLoaded=Math.max(session.newestLoaded,session.oldestLoaded-1);
    }catch(e){if(e.name!=='AbortError'&&historySession===session)showError(e);}finally{if(historySession===session)historyBusy=false;}
  }
  function roll(){
    const f=currentFixture();if(!f?.rollPage){$('status').textContent='Rollover sample unavailable for selected native frame.';return;}
    try{appendPage(f.rollPage,'roll');}catch(e){showError(e);}
  }
  function maybeLoadOlder(){
    if(historyEndpoint&&historySession&&!historyBusy&&state.cursor!==null&&state.offset<Math.max(20,Math.round(state.rows.length*.03)))older();
  }
  function zoom(factor){
    if(!state.rows.length)return;
    const oldShown=Math.max(1,Math.min(state.rows.length,Math.round(state.rows.length/state.zoom)));
    const center=Math.max(0,state.offset)+(oldShown-1)/2;
    state.zoom=Math.max(1,Math.min(16,Number((state.zoom*factor).toFixed(8))));
    const newShown=Math.max(1,Math.min(state.rows.length,Math.round(state.rows.length/state.zoom)));
    state.offset=Math.max(0,Math.min(state.rows.length-newShown,Math.round(center-(newShown-1)/2)));
    draw();maybeLoadOlder();
  }
  function yFor(price,lo,hi,top,height){return top+(hi-price)*height/Math.max(hi-lo,1);}
  function draw(){
    const root=$('chart'),w=Math.max(320,root.clientWidth),h=Math.max(250,root.clientHeight),dpr=window.devicePixelRatio||1;
    let canvas=root.querySelector('canvas');
    if(!canvas){canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');root.appendChild(canvas);}
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);rect(ctx,0,0,w,h,'#0c1522');
    const rows=state.rows,plot={left:60,right:w-62,top:20,bottom:h-40};
    if(!rows.length){$('chartEmpty').hidden=false;return;}$('chartEmpty').hidden=true;
    const count=rows.length;
    const show=Math.max(1,Math.min(count,Math.round(count/state.zoom)));
    const start=Math.max(0,Math.min(count-show,Math.round(state.offset)));
    const visible=rows.slice(start,start+show),prices=visible.flatMap(r=>[r.prices.low,r.prices.high]);
    let lo=Math.min(...prices),hi=Math.max(...prices),padding=Math.max((hi-lo)*.10,2);
    lo-=padding;hi+=padding;
    const width=plot.right-plot.left,height=plot.bottom-plot.top,step=width/visible.length;
    ctx.font='11px system-ui';ctx.textBaseline='middle';
    for(let i=0;i<=5;i++){
      const y=plot.top+i*height/5,val=hi-(hi-lo)*i/5;
      ctx.strokeStyle='#26364a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.right,y);ctx.stroke();
      ctx.fillStyle='#9fb4ce';ctx.textAlign='left';ctx.fillText(val.toFixed(2),plot.right+4,y);
    }
    for(let i=0;i<visible.length;i++){
      const r=visible[i],x=plot.left+(i+.5)*step,p=r.prices;
      const up=p.close>=p.open,color=up?'#51cbb4':'#ed747d';
      const oy=yFor(p.open,lo,hi,plot.top,height),cy=yFor(p.close,lo,hi,plot.top,height),hy=yFor(p.high,lo,hi,plot.top,height),ly=yFor(p.low,lo,hi,plot.top,height);
      ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x,ly);ctx.stroke();
      rect(ctx,x-Math.max(1,step*.33),Math.min(oy,cy),Math.max(2,step*.66),Math.max(1,Math.abs(oy-cy)),color);
      if(i>0){const prev=visible[i-1],gap=date(r.timestampNs)-date(prev.timestampNs);
        if(gap>frameSeconds[state.frame]*1.5){ctx.strokeStyle='#efba62';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x-step/2,plot.top);ctx.lineTo(x-step/2,plot.bottom);ctx.stroke();ctx.setLineDash([]);}
        if(state.view!=='ACTUAL_CONTRACT'&&r.sourceContract!==prev.sourceContract){ctx.strokeStyle='#dd9cfc';ctx.setLineDash([4,2]);ctx.beginPath();ctx.moveTo(x-step/2,plot.top);ctx.lineTo(x-step/2,plot.bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#dd9cfc';ctx.textAlign='left';ctx.fillText('ROLL?',x,plot.top+12);}
      }
    }
    if(state.marks){
      // Time placement is a hypothesis, NOT candle verification or bar snapping.
      for(const n of availableNodes()){
        if(n.ownerEvidenceVisibility!=='CONDITIONAL_NONOFFICIAL_EVIDENCE_MARK'||!finite(n.originalOwnerCoordinate?.price)||!n.timestampHypothesis)continue;
        const ts=Math.floor(Date.parse(n.timestampHypothesis)/1000),first=date(visible[0].timestampNs),last=date(visible[visible.length-1].timestampNs);
        if(!(ts>=first&&ts<=last))continue;
        let i=visible.findIndex(r=>date(r.timestampNs)>=ts);
        if(i<0)continue;
        const prev=Math.max(0,i-1),p0=date(visible[prev].timestampNs),p1=date(visible[i].timestampNs);
        // Unknown missing intervals cannot certify mark placement: no connecting across a gap.
        if(p1-p0>frameSeconds[state.frame]*1.5)continue;
        const fraction=p1===p0?i:prev+(ts-p0)/(p1-p0);
        const x=plot.left+(fraction+.5)*step,y=yFor(n.originalOwnerCoordinate.price,lo,hi,plot.top,height);
        if(y<plot.top||y>plot.bottom)continue;
        ctx.strokeStyle='#f9b64f';ctx.setLineDash([2,3]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#ffdba0';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText(n.degree+' '+n.node+' (?)',x+8,Math.max(plot.top+10,y-10));
      }
    }
    const stride=Math.max(1,Math.ceil(visible.length/6));ctx.fillStyle='#99aec7';ctx.textAlign='center';ctx.font='11px system-ui';
    for(let i=0;i<visible.length;i+=stride)ctx.fillText(time(date(visible[i].timestampNs)),plot.left+(i+.5)*step,h-18);
    $('status').textContent=LABELS[state.view]+' · '+state.frame+' · '+state.degree+' · '+count+(historyEndpoint?' authenticated research':' sample')+' candles loaded / max '+CAP+' · '+(state.cursor?'older page available':'end of available pages')+' · UNVERIFIED SOURCE MARKS';
  }
  function nodeDetails(){
    const nodes=availableNodes();
    const lines=nodes.map(n=>'<tr><td>'+escape(n.degree+' '+n.node)+'</td><td>'+escape(n.originalOwnerCoordinate?.rawDate)+' '+escape(n.originalOwnerCoordinate?.rawTime)+'</td><td>'+escape(n.originalOwnerCoordinate?.price)+'</td><td>'+escape(n.ownerEvidenceVisibility)+'</td><td>'+escape(n.registryNodeId)+'</td></tr>').join('');
    $('nodes').innerHTML='<p class="muted">'+nodes.length+' original evidence records in this selection. Never candle-verified.</p><table><thead><tr><th>Degree / node</th><th>Original date/time</th><th>Price</th><th>Plot eligibility</th><th>Registry ID</th></tr></thead><tbody>'+lines+'</tbody></table>';
  }
  function details(){
    nodeDetails();
    const v=state.handoff?.views?.[state.view],r=state.rows;
    const contracts=[...new Set(r.map(x=>x.sourceContract))];
    $('coverage').innerHTML='<p><b>Selected:</b> '+escape(LABELS[state.view])+'</p><p><b>Dataset:</b> '+escape(v?.datasetVersion)+'</p><p><b>Price basis:</b> '+escape(v?.priceBasisVersion)+'</p><p><b>Sample source contracts:</b> '+escape(contracts.join(', ')||'UNAVAILABLE')+'</p><p class="warn">Unknown calendars, gaps and source finality are not certified closures. Candidate roll rules do not prove TradingView ES1! equivalence.</p><p><b>Rows loaded:</b> '+r.length+' / '+CAP+'</p>';
    $('fib').textContent='34 ORIGINAL workbook references preserved; 0 official Fibonacci levels plotted. ENGINE 22 CERTIFICATE PENDING.';
  }
  async function decodePinnedFile(file){
    const raw=await file.text();
    if(file.name.endsWith('.json'))return JSON.parse(raw);
    if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decode zlib; use the documented Node decoder');
    const binary=Uint8Array.from(atob(raw.trim()),c=>c.charCodeAt(0));
    const stream=new Blob([binary]).stream().pipeThrough(new DecompressionStream('deflate'));
    return JSON.parse(await new Response(stream).text());
  }
  async function verifyDigest(h){
    if(!globalThis.crypto?.subtle)throw Error('Secure SHA-256 digest API is unavailable: reject unverified file');
    const {handoffVersion,...body}=h;
    const bytes=new TextEncoder().encode(JSON.stringify(body));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(handoffVersion!=='preview-handoff:'+digest)throw Error('Engine11 HANDOFF_DIGEST mismatch; source modified or corrupted');
  }
  async function importFile(file){
    if(!file)return;
    try{const h=checkHandoff(await decodePinnedFile(file));await verifyDigest(h);state.handoff=h;clearContext();
      $('fixtureInfo').textContent='Loaded pinned research source: '+h.handoffVersion+' · Registry '+(h.nodeLayers.registrySha||'UNKNOWN')+' · 40 nodes / 34 withheld Fib refs.';
      await loadSelection();
    }catch(e){state.handoff=null;clearContext();showError(e);}
  }
  $('view').addEventListener('change',choose);$('frame').addEventListener('change',choose);$('degree').addEventListener('change',choose);
  $('fixture').addEventListener('change',e=>importFile(e.target.files?.[0]));
  $('older').addEventListener('click',older);$('newer')?.addEventListener('click',newer);$('roll').addEventListener('click',roll);
  $('zoomIn').addEventListener('click',()=>zoom(1.5));
  $('zoomOut').addEventListener('click',()=>zoom(1/1.5));
  $('reset').addEventListener('click',()=>{state.zoom=1;state.offset=0;draw();});
  $('chart').addEventListener('wheel',e=>{if(!state.rows.length)return;e.preventDefault();if(e.ctrlKey){zoom(e.deltaY>0?.85:1.15);}else{state.offset=Math.max(0,Math.min(Math.max(0,state.rows.length-1),state.offset+Math.sign(e.deltaY)*2));}draw();maybeLoadOlder();},{passive:false});
  let drag=null;$('chart').addEventListener('pointerdown',e=>{drag=e.clientX;$('chart').setPointerCapture?.(e.pointerId);});
  $('chart').addEventListener('pointermove',e=>{if(drag==null||!state.rows.length)return;const dx=e.clientX-drag;drag=e.clientX;state.offset=Math.max(0,Math.min(Math.max(0,state.rows.length-1),state.offset-dx/Math.max(12,$('chart').clientWidth/state.rows.length)));draw();maybeLoadOlder();});
  $('chart').addEventListener('pointerup',()=>{drag=null;});$('chart').addEventListener('pointercancel',()=>{drag=null;});
  if(window.ResizeObserver)new ResizeObserver(draw).observe($('chart'));else window.addEventListener('resize',draw);
  details();draw();
  window.__ENGINE2C_TEST__={state,historyEndpoint,requestHistory,checkHandoff,validatePage,appendPage,clearContext,selection,choose,loadSelection,older,newer,roll,draw,zoom,CAP};
})();
