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
      const drop=state.rows.splice(0,state.rows.length-CAP);
      drop.forEach(r=>state.identities.delete(r.researchCandleId));
    }
    if(oldAnchor){const nextAnchor=state.rows.findIndex(r=>r.researchCandleId===oldAnchor);if(nextAnchor>=0)state.offset=nextAnchor;}
    state.cursor=p.nextCursor??null;
    draw();details();return true;
  }
  function clearContext(){
    state.generation++;state.request++;state.rows=[];state.identities.clear();state.pageSet.clear();state.cursor=null;state.zoom=1;state.offset=0;
  }
  async function loadSelection(){
    const gen=state.generation,seq=++state.request;
    await Promise.resolve(); // predictable newest-intent guard even for async adapters
    if(gen!==state.generation||seq!==state.request)return;
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
  function older(){
    const f=currentFixture();if(!f||!state.handoff)return;
    if(state.pageSet.has('second')||!f.firstPage.nextCursor||!f.secondPage){$('status').textContent='No further pinned older sample page. Unqueried history is unavailable.';return;}
    if(f.secondRequest?.cursor!==f.firstPage.nextCursor){showError(Error('Pinned cursor mismatch'));return;}
    try{appendPage(f.secondPage,'second');}catch(e){showError(e);}
  }
  function roll(){
    const f=currentFixture();if(!f?.rollPage){$('status').textContent='Rollover sample unavailable for selected native frame.';return;}
    try{appendPage(f.rollPage,'roll');}catch(e){showError(e);}
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
    $('status').textContent=LABELS[state.view]+' · '+state.frame+' · '+state.degree+' · '+count+' sample candles loaded / max '+CAP+' · '+(state.cursor?'more pinned sample may exist':'no further pinned cursor')+' · UNVERIFIED SOURCE MARKS';
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
  async function importFile(file){
    if(!file)return;
    try{const h=checkHandoff(JSON.parse(await file.text()));state.handoff=h;clearContext();
      $('fixtureInfo').textContent='Loaded pinned research source: '+h.handoffVersion+' · Registry '+(h.nodeLayers.registrySha||'UNKNOWN')+' · 40 nodes / 34 withheld Fib refs.';
      await loadSelection();
    }catch(e){state.handoff=null;clearContext();showError(e);}
  }
  $('view').addEventListener('change',choose);$('frame').addEventListener('change',choose);$('degree').addEventListener('change',choose);
  $('fixture').addEventListener('change',e=>importFile(e.target.files?.[0]));
  $('older').addEventListener('click',older);$('roll').addEventListener('click',roll);
  $('zoomIn').addEventListener('click',()=>{state.zoom=Math.min(16,state.zoom*1.5);draw();});
  $('zoomOut').addEventListener('click',()=>{state.zoom=Math.max(1,state.zoom/1.5);draw();});
  $('reset').addEventListener('click',()=>{state.zoom=1;state.offset=0;draw();});
  $('chart').addEventListener('wheel',e=>{if(!state.rows.length)return;e.preventDefault();if(e.ctrlKey){state.zoom=Math.min(16,Math.max(1,state.zoom*(e.deltaY>0?.85:1.15)));}else{state.offset=Math.max(0,Math.min(Math.max(0,state.rows.length-1),state.offset+Math.sign(e.deltaY)*2));}draw();},{passive:false});
  let drag=null;$('chart').addEventListener('pointerdown',e=>{drag=e.clientX;$('chart').setPointerCapture?.(e.pointerId);});
  $('chart').addEventListener('pointermove',e=>{if(drag==null||!state.rows.length)return;const dx=e.clientX-drag;drag=e.clientX;state.offset=Math.max(0,Math.min(Math.max(0,state.rows.length-1),state.offset-dx/Math.max(12,$('chart').clientWidth/state.rows.length)));draw();});
  $('chart').addEventListener('pointerup',()=>{drag=null;});$('chart').addEventListener('pointercancel',()=>{drag=null;});
  if(window.ResizeObserver)new ResizeObserver(draw).observe($('chart'));else window.addEventListener('resize',draw);
  details();draw();
  window.__ENGINE2C_TEST__={state,checkHandoff,validatePage,appendPage,clearContext,selection,choose,loadSelection,older,roll,draw,CAP};
})();
