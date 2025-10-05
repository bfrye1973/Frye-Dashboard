// /src/components/LiveLWChart/LiveLWChart.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getFeed /* removed: subscribeStream */ } from "../../services/feed";

/* ------------------------------------------------------------
   Streamer wiring (uses dedicated Streamer service)
   - Set REACT_APP_STREAM_BASE in your .env (.env.local)
   - Example: https://frye-market-backend-2.onrender.com
------------------------------------------------------------- */
const STREAM_BASE = (process.env.REACT_APP_STREAM_BASE || "").replace(/\/+$/,"");

function subscribeLive(symbol, timeframe, onBar) {
  // Build SSE URL to the Streamer
  const url =
    `${STREAM_BASE}/stream/agg?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(timeframe)}`;
 console.log("[LiveLWChart] subscribing to", url);
  const es = new EventSource(url);

  es.onmessage = (ev) => {
    // Streamer emits only JSON "bar" messages (plus server :ping heartbeats we can ignore)
    try {
      const msg = JSON.parse(ev.data);
      if (msg && msg.ok && msg.type === "bar" && msg.bar && Number.isFinite(msg.bar.time)) {
        onBar(msg.bar);
      }
    } catch {
      // Ignore non-JSON (e.g., heartbeats or accidental noise)
    }
  };

  es.onerror = () => {
    // Let the browser auto-reconnect. Optional: add console.warn if you want visibility.
    // console.warn("[LiveLWChart] SSE error; browser will reconnect");
  };

  // Return an unsubscribe
  return () => es.close();
}

/* ------------------------------------------------------------
   Phoenix time formatter
------------------------------------------------------------- */
function phoenix(ts){
  const seconds =
    typeof ts === "number" ? ts :
    (ts && typeof ts.timestamp === "number" ? ts.timestamp : 0);
  return new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Phoenix", hour12:true, hour:"numeric", minute:"2-digit"
  }).format(new Date(seconds*1000));
}
export default function LiveLWChart({ symbol="SPY", timeframe="10m", height=520 }) {
  console.log("[LiveLWChart.jsx] mounted", { symbol, timeframe, STREAM_BASE });

/* ------------------------------------------------------------
   Component
------------------------------------------------------------- */
export default function LiveLWChart({ symbol="SPY", timeframe="10m", height=520 }) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);
  const roRef = useRef(null), dprCleanupRef = useRef(null);
  const [candles, setCandles] = useState([]);

  const safeResize = ()=> {
    const el = rootRef.current, chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  // init chart
  useEffect(()=>{
    const holder = rootRef.current;
    if (!holder) return;

    const chart = createChart(holder,{
      ...baseChartOptions, width:holder.clientWidth, height,
      localization:{ ...(baseChartOptions.localization||{}), timezone:"America/Phoenix", dateFormat:"yyyy-MM-dd", timeFormatter:phoenix }
    });
    chartRef.current = chart;

    const s = chart.addCandlestickSeries({
      upColor: baseChartOptions?.upColor ?? "#26a69a",
      downColor: baseChartOptions?.downColor ?? "#ef5350",
      borderUpColor: baseChartOptions?.borderUpColor ?? "#26a69a",
      borderDownColor: baseChartOptions?.borderDownColor ?? "#ef5350",
      wickUpColor: baseChartOptions?.wickUpColor ?? "#26a69a",
      wickDownColor: baseChartOptions?.wickDownColor ?? "#ef5350",
    });
    seriesRef.current = s;

    const v = chart.addHistogramSeries({ priceScaleId:"", priceFormat:{ type:"volume" }});
    v.priceScale().applyOptions({ scaleMargins:{ top:0.8, bottom:0 }});
    volRef.current = v;

    chart.timeScale().applyOptions({
      visible:true, timeVisible:true, borderVisible:true, minimumHeight:20,
      tickMarkFormatter:(time)=> phoenix(time)
    });

    const ro = new ResizeObserver(safeResize);
    ro.observe(holder); roRef.current = ro;

    const mq = window.matchMedia(`(resolution:${window.devicePixelRatio}dppx)`);
    const onDpr = ()=> safeResize();
    if (mq.addEventListener){ mq.addEventListener("change", onDpr); dprCleanupRef.current = ()=> mq.removeEventListener("change", onDpr); }
    else if (mq.addListener){ mq.addListener(onDpr); dprCleanupRef.current = ()=> mq.removeListener(onDpr); }

    safeResize();
    return ()=>{
      try{ roRef.current?.disconnect(); }catch{}
      try{ dprCleanupRef.current?.(); }catch{}
      try{ chart.remove(); }catch{}
      chartRef.current=null; seriesRef.current=null; volRef.current=null;
    };
  },[height]);

  // load history + start live stream
  useEffect(()=>{
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return;

    let disposed = false;
    let unsubscribe = null;

    // 1) History seed (from your existing feed service)
    (async ()=>{
      try{
        const feed = getFeed(symbol, timeframe);
        const seed = await feed.history();
        if (disposed) return;
        series.setData(seed);
        if (volRef.current){
          volRef.current.setData(
            seed.map(b=>({
              time:b.time, value:Number(b.volume||0),
              color: b.close>=b.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)"
            }))
          );
        }
        setCandles(seed);
        chart.timeScale().fitContent();
      }catch(e){
        console.error("[LiveLWChart] history failed:", e);
        series.setData([]); setCandles([]);
      }
    })();

    // 2) Live stream (SSE from dedicated Streamer)
    if (timeframe !== "1d") {
      unsubscribe = subscribeLive(symbol, timeframe, (bar)=>{
        if (disposed || !bar || bar.time == null) return;
        series.update(bar);
        if (volRef.current){
          volRef.current.update({
            time: bar.time,
            value: Number(bar.volume||0),
            color: bar.close>=bar.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)"
          });
        }
        setCandles(prev => mergeBar(prev, bar));
      });
    }

    return ()=>{
      disposed = true;
      try{ unsubscribe?.(); }catch{}
    };
  },[symbol, timeframe]);

  return (
    <section
      className="panel chart-card"
      style={{
        position:"relative", zIndex:1, width:"100%", minHeight:height,
        border:"1px solid #1f2a44", borderRadius:8, background:"#0b0b14",
        overflow:"hidden", marginTop:12
      }}
    >
      <div ref={rootRef} className="chart-root" style={{ position:"relative", width:"100%", height }} />
    </section>
  );
}

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
function mergeBar(prev, bar){
  if (!Array.isArray(prev) || prev.length===0) return [bar];
  const last = prev[prev.length-1];
  if (last && last.time===bar.time){
    const next = prev.slice(0,-1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}
