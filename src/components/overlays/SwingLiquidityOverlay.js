// src/components/overlays/SwingLiquidityOverlay.js
// Dual 1h Consolidation Zones (Primary + Secondary) with adaptive TSLA-friendly logic
// Inert draw-only overlay; no fit/resize effects.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer)
    return { seed() {}, update() {}, destroy() {} };

  /*---------------- CONFIG ----------------*/
  const BOX_MIN_HRS = 16, BOX_MAX_HRS = 24;
  const BOX_BPS_LIMIT_STRICT = 35; // 0.35%
  const BOX_BPS_LIMIT_TSLA   = 55; // 0.55%
  const TEST_LOOKBACK_HOURS  = 24 * 30;

  const DWELL_MIN_HOURS = 8, MIN_TOUCHES_CLUSTER = 3;
  const RETEST_LOOKAHEAD_HRS = 30;
  const RELAX_TOUCHES = 2, RELAX_DWELL_H = 6, RELAX_RETEST_H = 48;

  const COL_PRIMARY = "#3b82f6";  // Blue
  const COL_SECOND  = "rgba(255,255,0,0.25)"; // Yellow translucent
  const BORDER_SECOND = "rgba(255,255,0,0.8)";
  const TEST_ALPHA = 0.15;

  /*---------------- STATE ----------------*/
  let bars = [], testBoxPrimary = null, testBoxSecondary = null;
  let wickPrimary = null, wickSecondary = null;
  let rafId = null;
  const ts = chart.timeScale();

  /*---------------- UTIL ----------------*/
  const toSec = (t)=>t>1e12?Math.floor(t/1000):t;
  const xFor  = (t)=>ts.timeToCoordinate(t);
  const yFor  = (p)=>priceSeries.priceToCoordinate(p);
  const isFiniteNum=(x)=>Number.isFinite(x)&&!isNaN(x);

  function resampleTo1h(barsAsc){
    if(!barsAsc?.length) return [];
    const out=[]; let cur=null;
    for(const b of barsAsc){
      const t=toSec(b.time), bucket=Math.floor(t/3600)*3600;
      if(!cur||bucket!==cur.time){
        if(cur) out.push(cur);
        cur={time:bucket,open:b.open,high:b.high,low:b.low,close:b.close,volume:+b.volume||0};
      }else{
        cur.high=Math.max(cur.high,b.high);
        cur.low =Math.min(cur.low ,b.low);
        cur.close=b.close;
        cur.volume+=+b.volume||0;
      }
    }
    if(cur) out.push(cur);
    return out.slice(-TEST_LOOKBACK_HOURS);
  }

  function pickBox(b1h,bpsLimit){
    let best=null; const n=b1h.length;
    for(let span=BOX_MIN_HRS;span<=BOX_MAX_HRS;span++){
      for(let i=0;i+span<=n;i++){
        const j=i+span-1;
        let lo=+Infinity,hi=-Infinity;
        for(let k=i;k<=j;k++){lo=Math.min(lo,b1h[k].low);hi=Math.max(hi,b1h[k].high);}
        const mid=(lo+hi)/2,bps=((hi-lo)/Math.max(1e-6,mid))*10000;
        if(bpsLimit!=null && bps>bpsLimit) continue;
        const dwell=span; // crude dwell metric
        if(!best||bps<best.bps||(bps===best.bps && dwell>best.dwell))
          best={iStart:i,iEnd:j,pLo:lo,pHi:hi,bps,dwell};
      }
    }
    return best;
  }

  /*---------------- BUILD TEST BOXES ----------------*/
  function rebuildDualBoxes(){
    testBoxPrimary=null; testBoxSecondary=null;
    wickPrimary=null; wickSecondary=null;

    const b1h=resampleTo1h(bars);
    if(b1h.length<BOX_MIN_HRS){window.__last1hBoxPrimary=null;return;}

    // Primary (strongest)
    let bestA=pickBox(b1h,BOX_BPS_LIMIT_TSLA);
    if(!bestA) bestA=pickBox(b1h,null);
    if(!bestA){window.__last1hBoxPrimary=null;return;}
    testBoxPrimary={tStart:b1h[bestA.iStart].time,tEnd:b1h[bestA.iEnd].time,pLo:bestA.pLo,pHi:bestA.pHi,bps:bestA.bps};

    // Secondary (most recent near end, non-overlapping)
    let bestB=null;
    const n=b1h.length;
    for(let span=BOX_MIN_HRS;span<=BOX_MAX_HRS;span++){
      for(let j=n-1;j>=span;j--){
        const i=j-span+1;
        if(i<=bestA.iEnd && j>=bestA.iStart) continue; // skip overlap
        let lo=+Infinity,hi=-Infinity;
        for(let k=i;k<=j;k++){lo=Math.min(lo,b1h[k].low);hi=Math.max(hi,b1h[k].high);}
        const mid=(lo+hi)/2,bps=((hi-lo)/Math.max(1e-6,mid))*10000;
        if(bps>BOX_BPS_LIMIT_TSLA) continue;
        const dwell=span;
        if(!bestB||j>bestB.iEnd||(bps<=bestB.bps && dwell>bestB.dwell))
          bestB={iStart:i,iEnd:j,pLo:lo,pHi:hi,bps,dwell};
      }
    }
    if(bestB) testBoxSecondary={tStart:b1h[bestB.iStart].time,tEnd:b1h[bestB.iEnd].time,pLo:bestB.pLo,pHi:bestB.pHi,bps:bestB.bps};

    // Debug export
    window.__last1hBoxPrimary=testBoxPrimary;
    window.__last1hBoxSecondary=testBoxSecondary;
  }

  /*---------------- DRAW ----------------*/
  function doDraw(){
    const w=chartContainer.clientWidth||1,h=chartContainer.clientHeight||1;
    let cnv=chartContainer.querySelector("canvas.overlay-canvas.swing-liquidity");
    if(!cnv){
      cnv=document.createElement("canvas");
      cnv.className="overlay-canvas swing-liquidity";
      Object.assign(cnv.style,{position:"absolute",inset:0,pointerEvents:"none",zIndex:10});
      chartContainer.appendChild(cnv);
    }
    cnv.width=w; cnv.height=h;
    const ctx=cnv.getContext("2d");
    ctx.clearRect(0,0,w,h);

    const drawBox=(box,col,alpha,dashed=false)=>{
      if(!box) return;
      const yTop=yFor(box.pHi),yBot=yFor(box.pLo);
      const xS=xFor(box.tStart),xE=xFor(box.tEnd);
      if(!isFiniteNum(yTop)||!isFiniteNum(yBot)||!isFiniteNum(xS)||!isFiniteNum(xE)) return;
      const yMin=Math.min(yTop,yBot),yMax=Math.max(yTop,yBot);
      const xLeft=Math.min(xS,xE),xRight=Math.max(xS,xE);
      const rectH=Math.max(2,yMax-yMin);

      ctx.save();
      ctx.globalAlpha=alpha;
      if(dashed){ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.strokeStyle=BORDER_SECOND;}
      else{ctx.setLineDash([]);ctx.lineWidth=3;ctx.strokeStyle=col;}
      ctx.fillStyle=col;
      ctx.fillRect(xLeft,yMin,Math.max(1,xRight-xLeft),rectH);
      ctx.globalAlpha=1;ctx.strokeRect(xLeft+0.5,yMin+0.5,Math.max(1,xRight-xLeft)-1,rectH-1);
      ctx.restore();
    };

    drawBox(testBoxPrimary,COL_PRIMARY,TEST_ALPHA,false);
    drawBox(testBoxSecondary,COL_SECOND,0.25,true);
  }

  /*---------------- DRAW LOOP ----------------*/
  function scheduleDraw(){ if(rafId) return; rafId=requestAnimationFrame(()=>{rafId=null;doDraw();}); }
  const onLogical=()=>scheduleDraw(); const onVisible=()=>scheduleDraw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize",scheduleDraw);

  /*---------------- API ----------------*/
  return {
    seed(raw){
      bars=(raw||[]).map(b=>({...b,time:toSec(b.time)})).sort((a,b)=>a.time-b.time);
      rebuildDualBoxes();
      doDraw();
    },
    update(latest){
      if(!latest)return;
      const t=toSec(latest.time),last=bars.at(-1);
      if(!last||t>last.time)bars.push({...latest,time:t});
      else if(t===last.time)bars[bars.length-1]={...latest,time:t};
      rebuildDualBoxes();
      doDraw();
    },
    destroy(){
      try{ts.unsubscribeVisibleLogicalRangeChange?.(onLogical);}catch{}
      try{ts.unsubscribeVisibleTimeRangeChange?.(onVisible);}catch{}
      window.removeEventListener("resize",scheduleDraw);
    }
  };
}
