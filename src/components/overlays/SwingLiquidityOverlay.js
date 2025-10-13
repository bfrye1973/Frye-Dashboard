// src/components/overlays/SwingLiquidityOverlay.js
// 1h Consolidation Liquidity (with guaranteed fallback)
// - Primary: find 1h consolidation shelves (tight range, wick clusters, dwell, volume)
// - Fallback: if 0 shelves, draw latest 2 swing highs + 2 swing lows (safe mode)
// - Bands span the consolidation window (left→right). Volume tag sits at RIGHT edge.
// - DPR-aware, redraws on pan/zoom/resize, incremental live updates, bounded lookback.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ================= Tunables ================= */
  // ---- 1h detector (targets shelves like 662–663) ----
  const LOOKBACK_HOURS   = 24 * 30;   // ~30 days (cap)
  const BOX_MIN_HRS      = 16;        // min consolidation span (hours)
  const BOX_MAX_HRS      = 24;        // max consolidation span (hours)
  const BOX_BPS          = 25;        // box total range threshold in bps (0.25%)
  const BUCKET_BPS       = 5;         // wick bucket width (0.05%)
  const MERGE_BPS        = 10;        // merge buckets within 10 bps
  const MIN_TOUCHES      = 5;         // bottom/top-wick touches at an edge
  const MIN_RETESTS      = 2;         // distinct wick clusters (gap ≥ 2 bars)
  const MIN_DWELL_HRS    = 8;         // hours the body sat near the edge
  const TOP_K_PER_SIDE   = 1;         // top 1 demand + top 1 supply (clean)
  const W_VOL = 0.45, W_TCH = 0.30, W_RTS = 0.15, W_REC = 0.10;

  // ---- Safe-mode fallback (latest pivots) ----
  const SAFE_LR          = { L: 10, R: 10 };
  const SAFE_LOOKBACK    = 600;       // last N bars (any TF) for pivots
  const SAFE_MAX_PER_SIDE= 2;         // 2 highs + 2 lows
  const SAFE_BAND_BPS    = 8;         // half band width in bps (total ~16 bps)

  // ---- Drawing ----
  const FILL_ALPHA       = 0.22;
  const STROKE_W         = 2;
  const TAG_W            = 12;
  const TAG_MIN_H        = 4;
  const FONT             = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP          = "#ff4d4f";  // supply
  const COL_DEM          = "#22c55e";  // demand
  const COL_EDGE         = "#0b0f17";

  /* ================ Canvas ================ */
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, { position:"absolute", inset:0, pointerEvents:"none", zIndex:10 });
  cnv.className = "overlay-canvas swing-liquidity";
  chartContainer.appendChild(cnv);
  const ctx = cnv.getContext("2d");

  const resizeCanvas = () => {
    const r = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width = Math.max(1, Math.floor(r.width * dpr));
    cnv.height= Math.max(1, Math.floor(r.height* dpr));
    cnv.style.width = r.width + "px";
    cnv.style.height= r.height+ "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr,dpr);
  };
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(chartContainer);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const ts = chart.timeScale();
  const onRange = () => draw();
  ts.subscribeVisibleLogicalRangeChange?.(onRange);
  ts.subscribeVisibleTimeRangeChange?.(onRange);

  /* ================ State ================ */
  let bars1h = [];     // resampled 1h bars [{time, open, high, low, close, volume}]
  let zones  = [];     // consolidation shelves to draw
  let safeBands = [];  // fallback bands
  let volMaxForScale = 1;

  /* ================ Helpers ================ */
  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };
  const yFor  = (p)   => { const y = priceSeries.priceToCoordinate(Number(p)); return Number.isFinite(y) ? y : null; };

  function resampleTo1h(barsAscAnyTf) {
    if (!barsAscAnyTf?.length) return [];
    const out = []; let cur=null;
    for (const b of barsAscAnyTf) {
      const t=toSec(b.time), bucket=Math.floor(t/3600)*3600;
      if (!cur || bucket!==cur.time) {
        if (cur) out.push(cur);
        cur = { time:bucket, open:b.open, high:b.high, low:b.low, close:b.close, volume:Number(b.volume||0) };
      } else {
        cur.high=Math.max(cur.high,b.high);
        cur.low =Math.min(cur.low ,b.low);
        cur.close=b.close;
        cur.volume=Number(cur.volume||0)+Number(b.volume||0);
      }
    }
    if (cur) out.push(cur);
    return out.slice(-LOOKBACK_HOURS);
  }

  function detectBoxes(b1h) {
    const boxes=[]; if (b1h.length<BOX_MIN_HRS) return boxes;
    let iStart=0, pLo=b1h[0].low, pHi=b1h[0].high;
    const within=(lo,hi,mid)=>((hi-lo)/Math.max(1e-6,mid))*10000 <= BOX_BPS;
    for (let i=1;i<b1h.length;i++){
      pLo=Math.min(pLo,b1h[i].low); pHi=Math.max(pHi,b1h[i].high);
      const span=i-iStart+1, mid=(pLo+pHi)/2;
      if (!within(pLo,pHi,mid) || span>BOX_MAX_HRS){
        if (span-1>=BOX_MIN_HRS){
          const jEnd=i-1;
          const lo=Math.min(...b1h.slice(iStart,jEnd+1).map(x=>x.low));
          const hi=Math.max(...b1h.slice(iStart,jEnd+1).map(x=>x.high));
          boxes.push({ iStart, iEnd:jEnd, pLo:lo, pHi:hi });
        }
        iStart=i; pLo=b1h[i].low; pHi=b1h[i].high;
      }
    }
    const tail=b1h.length-iStart;
    if (tail>=BOX_MIN_HRS){
      const lo=Math.min(...b1h.slice(iStart).map(x=>x.low));
      const hi=Math.max(...b1h.slice(iStart).map(x=>x.high));
      boxes.push({ iStart, iEnd:b1h.length-1, pLo:lo, pHi:hi });
    }
    return boxes;
  }

  function quant(val, step){ return Math.floor(val/step)*step; }

  function measureBoxCandidates(b1h, box){
    const {iStart,iEnd,pLo,pHi}=box; const seg=b1h.slice(iStart,iEnd+1); if(!seg.length) return [];
    const lastClose=b1h.at(-1).close||seg.at(-1).close;
    const step=(BUCKET_BPS/10000)*lastClose, mergeStep=(MERGE_BPS/10000)*lastClose;
    const dem=new Map(), sup=new Map();
    const add=(map,key,fn)=>{ const o=map.get(key)||{touches:0,dwell:0,vol:0,hits:[]}; fn(o); map.set(key,o); };

    for(let k=0;k<seg.length;k++){
      const b=seg[k], lowKey=quant(b.low,step), highKey=quant(b.high,step);
      if (b.low<=Math.min(b.open,b.close)) add(dem,lowKey ,o=>{o.touches++;o.hits.push(k);});
      if (b.high>=Math.max(b.open,b.close)) add(sup,highKey,o=>{o.touches++;o.hits.push(k);});

      const bodyLo=Math.min(b.open,b.close), bodyHi=Math.max(b.open,b.close);
      if (bodyLo<=pLo+2*step){ const kLo=quant(Math.min(bodyLo,pLo+2*step),step); add(dem,kLo,o=>{o.dwell++; o.vol+=Number(b.volume||0);}); }
      if (bodyHi>=pHi-2*step){ const kHi=quant(Math.max(bodyHi,pHi-2*step),step); add(sup,kHi,o=>{o.dwell++; o.vol+=Number(b.volume||0);}); }
    }

    const mergeMap=(map,side)=>{
      const keys=Array.from(map.keys()).sort((a,b)=>a-b); const out=[]; let cur=null;
      for(const k of keys){
        const bk=map.get(k);
        if(!cur){ cur={side,keyLo:k,keyHi:k+step,touches:bk.touches,dwell:bk.dwell,vol:bk.vol,hits:bk.hits.slice()}; continue; }
        if(k-cur.keyHi<=mergeStep){ cur.keyHi+=step; cur.touches+=bk.touches; cur.dwell+=bk.dwell; cur.vol+=bk.vol; cur.hits.push(...bk.hits); }
        else { out.push(cur); cur={side,keyLo:k,keyHi:k+step,touches:bk.touches,dwell:bk.dwell,vol:bk.vol,hits:bk.hits.slice()}; }
      }
      if(cur) out.push(cur); return out;
    };

    let demand=mergeMap(dem,"DEM"), supply=mergeMap(sup,"SUP");

    const countRetests=(arr)=>{ if(!arr?.length) return 0; arr.sort((a,b)=>a-b); let c=1,last=arr[0]; for(let i=1;i<arr.length;i++) if(arr[i]-last>=2){c++; last=arr[i];} return c; };
    for(const z of demand) z.retests=countRetests(z.hits);
    for(const z of supply) z.retests=countRetests(z.hits);

    const keep=(z)=> z.touches>=MIN_TOUCHES && z.retests>=MIN_RETESTS && z.dwell>=MIN_DWELL_HRS;
    demand=demand.filter(keep); supply=supply.filter(keep);

    const scoreList=(list)=>{ if(!list.length) return; const maxVol=Math.max(...list.map(z=>z.vol),1); const maxT=Math.max(...list.map(z=>z.touches),1); const maxR=Math.max(...list.map(z=>z.retests),1);
      for(const z of list){ const volN=z.vol/maxVol, tchN=z.touches/maxT, rtsN=z.retests/maxR, recN=1; z.score=W_VOL*volN+W_TCH*tchN+W_RTS*rtsN+W_REC*recN; }
      list.sort((a,b)=>b.score-a.score); return list[0];
    };

    const picks=[]; const demTop=scoreList(demand); const supTop=scoreList(supply);
    if(demTop) picks.push({side:"DEM", pLo:demTop.keyLo, pHi:demTop.keyHi, tStart:b1h[iStart].time, tEnd:b1h[iEnd].time, touches:demTop.touches, retests:demTop.retests, vol:demTop.vol, score:demTop.score});
    if(supTop) picks.push({side:"SUP", pLo:supTop.keyLo, pHi:supTop.keyHi, tStart:b1h[iStart].time, tEnd:b1h[iEnd].time, touches:supTop.touches, retests:supTop.retests, vol:supTop.vol, score:supTop.score});
    return picks;
  }

  function buildZones1h(){
    zones=[]; if(!bars1h.length) return;
    const boxes=detectBoxes(bars1h); if(!boxes.length) return;
    const allDem=[], allSup=[];
    for(const box of boxes){
      const span=box.iEnd-box.iStart+1; if(span<BOX_MIN_HRS || span>BOX_MAX_HRS) continue;
      const picks=measureBoxCandidates(bars1h, box) || [];
      for(const z of picks){ if(z.side==="DEM") allDem.push(z); else allSup.push(z); }
    }
    allDem.sort((a,b)=>b.score-a.score); allSup.sort((a,b)=>b.score-a.score);
    zones=[...allDem.slice(0,TOP_K_PER_SIDE), ...allSup.slice(0,TOP_K_PER_SIDE)];
    volMaxForScale = Math.max(1, ...zones.map(z=>z.vol));
  }

  /* ================ Safe-mode fallback ================ */
  function buildSafeBandsFrom(barsAsc) {
    // never returns empty: latest 2 highs + 2 lows, left→right tag at RIGHT edge
    const out = []; if (!barsAsc?.length) return out;
    const L=SAFE_LR.L, R=SAFE_LR.R; const start=Math.max(0,barsAsc.length-SAFE_LOOKBACK);
    const scan=barsAsc.slice(start);
    const lastP=scan.at(-1).close||0, half=((SAFE_BAND_BPS/10000)*(lastP||1));
    const isHigh=(arr,i)=>{const v=arr[i].high; for(let j=i-L;j<=i+R;j++){ if(j===i||j<0||j>=arr.length) continue; if(arr[j].high>v) return false;} return true;};
    const isLow =(arr,i)=>{const v=arr[i].low ; for(let j=i-L;j<=i+R;j++){ if(j===i||j<0||j>=arr.length) continue; if(arr[j].low <v) return false;} return true;};
    const highs=[], lows=[];
    for(let i=L;i<scan.length-R;i++){ const g=start+i, b=scan[i]; if(isHigh(scan,i)) highs.push({price:b.high,i0:g,t0:toSec(b.time)}); if(isLow(scan,i)) lows.push({price:b.low,i0:g,t0:toSec(b.time)}); }
    highs.sort((a,b)=>b.i0-a.i0); lows.sort((a,b)=>b.i0-a.i0);

    const pick=(arr,side)=>{ const res=[], used=[]; for(const z of arr){ if(res.length>=SAFE_MAX_PER_SIDE) break; if(used.some(u=>Math.abs(u-z.price)<=half*0.75)) continue; used.push(z.price); res.push({side, pLo:z.price-half, pHi:z.price+half, tStart:barsAsc[Math.max(0,z.i0-40)]?.time||barsAsc[0].time, tEnd:barsAsc[z.i0]?.time, vol:1}); } return res; };
    return [...pick(highs,"SUP"), ...pick(lows,"DEM")];
  }

  /* ================ Draw ================ */
  function draw() {
    const r = chartContainer.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);

    const hasZones = zones.length>0;
    const items = hasZones ? zones : safeBands;
    if (!items.length) return;

    ctx.font = FONT;
    for (const z of items) {
      const yTop=yFor(z.pHi), yBot=yFor(z.pLo);
      if (yTop==null || yBot==null) continue;

      const xStart=xFor(z.tStart), xEnd=xFor(z.tEnd);
      if (xStart==null || xEnd==null) continue;

      const color = z.side==="SUP" ? COL_SUP : COL_DEM;
      const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
      const h=Math.max(2,yMax-yMin);

      ctx.globalAlpha=FILL_ALPHA;
      ctx.fillStyle=color;
      ctx.fillRect(xStart,yMin,Math.max(1,xEnd-xStart),h);

      ctx.globalAlpha=1;
      ctx.lineWidth=STROKE_W;
      ctx.strokeStyle=color;
      ctx.strokeRect(xStart+0.5,yMin+0.5,Math.max(1,xEnd-xStart)-1,h-1);

      // RIGHT-edge volume tag
      const frac = hasZones ? Math.max(0,z.vol/Math.max(1,volMaxForScale)) : 0.3;
      const tagH = Math.max(TAG_MIN_H, Math.floor(r.height*0.15*frac));
      const tagX = Math.max(0, xEnd - TAG_W);
      const tagY = Math.max(2, Math.min(r.height-tagH-2, (yMin+yMax)/2 - tagH/2));
      ctx.fillStyle=color; ctx.fillRect(tagX,tagY,TAG_W,tagH);
      ctx.strokeStyle=COL_EDGE; ctx.lineWidth=1; ctx.strokeRect(tagX+0.5,tagY+0.5,TAG_W-1,tagH-1);

      // right-edge label
      const lbl = `${fmt(z.pLo)}–${fmt(z.pHi)}`;
      ctx.fillStyle=color; ctx.fillText(lbl, xEnd+6, yMin-4);
    }
  }

  const fmt=(p)=> (p>=100? p.toFixed(2) : p>=10? p.toFixed(3) : p.toFixed(4));

  /* ================ API ================ */
  return {
    seed(barsAnyTf) {
      const asc=(barsAnyTf||[]).map(b=>({...b,time:toSec(b.time)})).sort((a,b)=>a.time-b.time);
      bars1h = resampleTo1h(asc);
      zones = []; safeBands = [];
      buildZones1h();
      if (zones.length===0) safeBands = buildSafeBandsFrom(asc);
      draw();
    },
    update(latest) {
      if (!latest) return;
      // resample incremental to 1h
      const t=toSec(latest.time), bucket=Math.floor(t/3600)*3600;
      const last=bars1h.at(-1);
      if (!last || bucket>last.time) {
        bars1h.push({ time:bucket, open:latest.open, high:latest.high, low:latest.low, close:latest.close, volume:Number(latest.volume||0) });
        if (bars1h.length>LOOKBACK_HOURS) bars1h = bars1h.slice(-LOOKBACK_HOURS);
        if (bars1h.length%4===0) { zones=[]; buildZones1h(); }
      } else if (bucket===last.time) {
        last.high=Math.max(last.high,latest.high);
        last.low =Math.min(last.low ,latest.low );
        last.close=latest.close;
        last.volume=Number(last.volume||0)+Number(latest.volume||0);
      }
      // If zones empty, keep safe-bands refreshed lightly using last 600 bars (only when needed)
      if (zones.length===0 && safeBands.length===0) safeBands = buildSafeBandsFrom([...(bars1h)]);
      draw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onRange); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onRange); } catch {}
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", resizeCanvas);
      try { cnv.remove(); } catch {}
    },
  };
}
