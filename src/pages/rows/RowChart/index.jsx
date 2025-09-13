import React, { useMemo, useState } from "react";
import Controls from "./Controls";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import TimelineOverlay from "./TimelineOverlay";
import { SYMBOLS, TIMEFRAMES } from "./constants";

export default function RowChart({ apiBase, defaultSymbol="SPY", defaultTimeframe="1h", height=520, onStatus }) {
  const [state, setState] = useState({ symbol: defaultSymbol, timeframe: defaultTimeframe, range: null });
  const theme = useMemo(()=>({
    layout:{ background:{type:'solid', color:'#0a0a0a'}, textColor:'#e5e7eb' },
    grid:{ vertLines:{ color:'#1e1e1e' }, horzLines:{ color:'#1e1e1e' } },
    rightPriceScale:{ borderColor:'#2b2b2b' }, timeScale:{ borderColor:'#2b2b2b', rightOffset:6, barSpacing:8, fixLeftEdge:true },
    crosshair:{ mode:0 }, upColor:'#16a34a', downColor:'#ef4444', wickUpColor:'#16a34a', wickDownColor:'#ef4444', borderUpColor:'#16a34a', borderDownColor:'#ef4444',
  }),[]);
  const { containerRef, chart, setData } = useLwcChart({ height, theme });
  const { bars, loading, error, refetch } = useOhlc({ apiBase, symbol: state.symbol, timeframe: state.timeframe });

  React.useEffect(()=>{ onStatus && onStatus(loading? 'loading' : error? 'error' : bars.length? 'ready':'idle'); }, [loading,error,bars,onStatus]);
  React.useEffect(()=>{ const data = state.range && bars.length>state.range ? bars.slice(-state.range) : bars; setData(data); }, [bars, state.range, setData]);

  return (
    <div style={{ height, overflow:'hidden', background:'#0a0a0a', border:'1px solid #2b2b2b', borderRadius:12, display:'flex', flexDirection:'column' }}>
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={{ symbol:state.symbol, timeframe:state.timeframe, range:state.range, disabled:loading }}
        onChange={(patch)=>setState(s=>({...s, ...patch}))}
        onTest={async()=>{ const r=await refetch(true); alert(r.ok? `Fetched ${r.count||0} bars` : `Error: ${r.error||'unknown'}`); }}
      />
      <div ref={containerRef} style={{ position:'relative', flex:1 }}>
        {loading && <Overlay>Loading bars…</Overlay>}
        {!loading && !error && bars.length===0 && <Overlay>No data returned</Overlay>}
        {error && <Overlay>Error: {error}</Overlay>}
        {/* timeline overlay tied to chart */}
        <TimelineOverlay chart={chart} container={containerRef.current} />
      </div>
    </div>
  );
}

function Overlay({ children }) {
  return <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>{children}</div>;
}
