// RowChart.jsx — v1.8 (Test Fetch button + self-diagnosing)
// - Adds a "Test Fetch" button to trigger a manual request
// - apiBase optional (prop > env > same-origin)
// - Status badge + clear error copy

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,
  onStatus,
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [tf, setTf] = useState(defaultTimeframe);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(null);

  const debounceTimer = useRef(null);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const lastKeyRef = useRef("");

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObs = useRef(null);

  const theme = useMemo(() => ({
    layout: { background: { type: 'solid', color: '#0a0a0a' }, textColor: '#e5e7eb' },
    grid: { vertLines: { color: '#1e1e1e' }, horzLines: { color: '#1e1e1e' } },
    rightPriceScale: { borderColor: '#2b2b2b' },
    timeScale: { borderColor: '#2b2b2b', rightOffset: 6, barSpacing: 8, fixLeftEdge: true },
    crosshair: { mode: 0 },
    upColor: '#16a34a',
    downColor: '#ef4444',
    wickUpColor: '#16a34a',
    wickDownColor: '#ef4444',
    borderUpColor: '#16a34a',
    borderDownColor: '#ef4444',
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale,
      crosshair: theme.crosshair,
      localization: { dateFormat: 'yyyy-MM-dd' },
    });
    const series = chart.addCandlestickSeries({
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderUpColor: theme.borderUpColor,
      borderDownColor: theme.borderDownColor,
      wickUpColor: theme.wickUpColor,
      wickDownColor: theme.wickDownColor,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    resizeObs.current = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    resizeObs.current.observe(containerRef.current);

    return () => {
      try { resizeObs.current && resizeObs.current.disconnect(); } catch {}
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, theme]);

  function resolveBase() {
    const env = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");
    const prop = (apiBase || "").replace(/\/$/, "");
    return prop || env || window.location.origin;
  }

  const doFetch = React.useCallback((force=false) => {
    const key = `${symbol}|${tf}`;
    lastKeyRef.current = key;

    const base = resolveBase();
    const url = `${base}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}&_=${Date.now()}`;
    console.debug('[RowChart v1.8] fetch', url);

    onStatus?.('loading');
    setLoading(true); setError(null);

    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    abortRef.current = controller;

    try { seriesRef.current?.setData([]); } catch {}

    if (!force && cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      setBars(cached); setLoading(false); onStatus?.(cached.length ? 'ready' : 'idle');
      return;
    }

    fetch(url, { signal: controller.signal, cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(()=>'');
          throw new Error(`HTTP ${r.status} — ${txt.slice(0,160)}`);
        }
        const j = await r.json();
        const rows = Array.isArray(j?.bars) ? j.bars : [];
        cacheRef.current.set(key, rows);
        if (lastKeyRef.current !== key) return;
        if (rows.length === 0) throw new Error('No bars returned');
        setBars(rows); onStatus?.('ready');
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setBars([]);
        setError(`${e.message} — URL: ${url}`);
        onStatus?.('error');
      })
      .finally(() => setLoading(false));
  }, [symbol, tf, apiBase]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doFetch(false), 250);
    return () => debounceTimer.current && clearTimeout(debounceTimer.current);
  }, [doFetch]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = (range && bars.length > range) ? bars.slice(-range) : bars;
    seriesRef.current.setData(data);
    if (chartRef.current && data.length > 0) chartRef.current.timeScale().fitContent();
  }, [bars, range]);

  const symbols = ["SPY","QQQ","IWM","DIA","AAPL","MSFT","AMZN","GOOGL","META","TSLA","NVDA","NFLX","AMD","INTC","BA","XOM","CVX","JPM","GS","BAC","WMT","COST","HD","LOW","DIS"];
  const timeframes = ["1m","5m","15m","30m","1h","4h","1d"];
  const ranges = [50, 100, 200];
  const disableControls = loading;
  const baseShown = resolveBase();

  return (
    <div style={{ height: `${height}px`, overflow: 'hidden', background: '#0a0a0a', border: '1px solid #2b2b2b', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #2b2b2b', background: '#111111' }}>
        <div style={{ fontWeight: 600, color: '#e5e7eb' }}>Chart</div>

        <label style={{ color: '#9ca3af' }}>Symbol</label>
        <select value={symbol} disabled={disableControls} onChange={(e) => setSymbol(e.target.value.toUpperCase())} style={selectStyle}>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={{ color: '#9ca3af' }}>Timeframe</label>
        <select value={tf} disabled={disableControls} onChange={(e) => setTf(e.target.value)} style={selectStyle}>
          {timeframes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af' }}>Range</span>
          {ranges.map(n => (
            <button key={n} disabled={disableControls} onClick={() => setRange((r) => r === n ? null : n)} style={rangeBtnStyle(range === n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Status + Test Fetch */}
      <button
  onClick={async () => {
    console.log("[RowChart v1.9] manual fetch start");
    try {
      await doFetch(true);
      console.log("[RowChart v1.9] success", symbol, tf, "bars:", bars.length);
      alert(`Fetched ${bars.length} bars for ${symbol} ${tf}`);
    } catch (e) {
      console.error("[RowChart v1.9] error", e);
      alert(`Fetch error: ${e.message || e}`);
    }
  }}
  style={{
    marginLeft: 'auto',
    background:'#eab308',
    color:'#111',
    border:'none',
    borderRadius:8,
    padding:'6px 10px',
    fontWeight:700,
    cursor:'pointer'
  }}
>
  Test Fetch
</button>


const selectStyle = { background: '#0b0b0b', color: '#e5e7eb', border: '1px solid #2b2b2b', borderRadius: 8, padding: '6px 8px' };
const rangeBtnStyle = (active) => ({ background: active ? '#eab308' : '#0b0b0b', color: active ? '#111111' : '#e5e7eb', border: '1px solid #2b2b2b', borderRadius: 8, padding: '6px 10px', fontWeight: 600, cursor: 'pointer' });
const overlayStyle = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', textAlign: 'center', padding: 12 };
