// RowChart.jsx — v2.0 (Timeline rows: hour + date)
// - Keeps v1.9 diagnostics + Test Fetch
// - Adds a bottom timeline with hour ticks and a date row like TradingView
// - Auto-updates on pan/zoom/resize and symbol/TF changes

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

  // timeline refs
  const timelineWrapRef = useRef(null);
  const hoursRowRef = useRef(null);
  const datesRowRef = useRef(null);

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

    // timeline container (absolute at bottom)
    const tl = document.createElement('div');
    tl.style.position = 'absolute';
    tl.style.left = '0';
    tl.style.right = '0';
    tl.style.bottom = '0';
    tl.style.height = '42px';
    tl.style.pointerEvents = 'none';
    tl.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0))';

    const hours = document.createElement('div');
    const dates = document.createElement('div');
    Object.assign(hours.style, { height: '20px', borderTop: '1px solid #2b2b2b', display:'block', position:'relative', color:'#9ca3af', fontSize:'11px' });
    Object.assign(dates.style, { height: '22px', borderTop: '1px solid #2b2b2b', display:'block', position:'relative', color:'#9ca3af', fontSize:'11px' });
    tl.appendChild(hours); tl.appendChild(dates);

    containerRef.current.appendChild(tl);
    timelineWrapRef.current = tl;
    hoursRowRef.current = hours;
    datesRowRef.current = dates;

    // Resize observer keeps the chart responsive within the fixed-height cell
    resizeObs.current = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      renderTimeline();
    });
    resizeObs.current.observe(containerRef.current);

    // Re-render timeline on scroll/zoom/time-range change
    const sub1 = chart.timeScale().subscribeVisibleTimeRangeChange(() => renderTimeline());
    const sub2 = chart.timeScale().subscribeVisibleLogicalRangeChange(() => renderTimeline());

    function cleanup(){
      try { resizeObs.current && resizeObs.current.disconnect(); } catch {}
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(sub1); } catch {}
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(sub2); } catch {}
      tl.remove();
      chart.remove();
      chartRef.current = null; seriesRef.current = null;
    }

    return cleanup;
  }, [height, theme]);

  function resolveBase() {
    const env = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");
    const prop = (apiBase || "").replace(/\/$/, "");
    return prop || env || window.location.origin;
  }

  const doFetch = React.useCallback(async (force=false) => {
    const key = `${symbol}|${tf}`;
    lastKeyRef.current = key;

    const base = resolveBase();
    const url = `${base}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}&_=${Date.now()}`;
    console.debug('[RowChart v2.0] fetch', url);

    onStatus?.('loading');
    setLoading(true); setError(null);

    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    abortRef.current = controller;

    try { seriesRef.current?.setData([]); } catch {}

    if (!force && cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      setBars(cached); setLoading(false); onStatus?.(cached.length ? 'ready' : 'idle');
      renderTimeline();
      return { ok:true, cached:true, count: cached.length };
    }

    try {
      const r = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) {
        const txt = await r.text().catch(()=>'');
        throw new Error(`HTTP ${r.status} — ${txt.slice(0,160)}`);
      }
      const j = await r.json();
      const rows = Array.isArray(j?.bars) ? j.bars : [];
      cacheRef.current.set(key, rows);
      if (lastKeyRef.current !== key) return { ok:true, stale:true, count: rows.length };
      if (rows.length === 0) throw new Error('No bars returned');
      setBars(rows); onStatus?.('ready');
      renderTimeline();
      return { ok:true, count: rows.length };
    } catch (e) {
      if (e.name === 'AbortError') return { ok:false, aborted:true };
      setBars([]);
      setError(`${e.message} — URL: ${url}`);
      onStatus?.('error');
      return { ok:false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [symbol, tf, apiBase]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void doFetch(false); }, 250);
    return () => debounceTimer.current && clearTimeout(debounceTimer.current);
  }, [doFetch]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = (range && bars.length > range) ? bars.slice(-range) : bars;
    seriesRef.current.setData(data);
    if (chartRef.current && data.length > 0) chartRef.current.timeScale().fitContent();
    renderTimeline();
  }, [bars, range]);

  // ------- timeline renderer -------
  function renderTimeline(){
    const chart = chartRef.current; if (!chart) return;
    const hoursHost = hoursRowRef.current; const datesHost = datesRowRef.current; if(!hoursHost||!datesHost) return;
    // clear
    hoursHost.innerHTML = ''; datesHost.innerHTML = '';

    const ts = chart.timeScale();
    const width = containerRef.current?.clientWidth || 0;
    if (width <= 0) return;

    // visible time range
    const vr = ts.getVisibleRange();
    if (!vr) return;
    const t0 = vr.from; const t1 = vr.to; // seconds

    // helper to place a label at a given timestamp
    const place = (el, t) => {
      const x = ts.timeToCoordinate(t);
      if (x == null) return;
      el.style.position = 'absolute';
      el.style.left = `${Math.round(x)-20}px`;
      el.style.whiteSpace = 'nowrap';
      el.style.pointerEvents = 'none';
    };

    // choose hour step based on timeframe/zoom
    const spanSec = (t1 - t0);
    let hourStep = 1; // hours
    if (spanSec > 60*60*24*3) hourStep = 6;
    else if (spanSec > 60*60*24) hourStep = 2;

    // iterate through rounded hours
    const startHour = Math.floor(t0 / 3600) * 3600;
    for (let t = startHour; t <= t1; t += hourStep*3600){
      const d = new Date(t*1000);
      const hh = d.getHours().toString().padStart(2,'0');
      const mm = d.getMinutes().toString().padStart(2,'0');
      const lab = document.createElement('div');
      lab.textContent = `${hh}:${mm}`;
      lab.style.color = '#9ca3af';
      lab.style.fontSize = '11px';
      place(lab, t);
      hoursHost.appendChild(lab);

      // small tick
      const tick = document.createElement('div');
      tick.style.position='absolute';
      tick.style.width='1px';
      tick.style.background='#2b2b2b';
      tick.style.top='-6px';
      tick.style.bottom='0';
      place(tick, t);
      hoursHost.appendChild(tick);
    }

    // date separators at midnight boundaries
    const startDay = Math.floor(t0 / 86400) * 86400;
    for (let t = startDay; t <= t1; t += 86400){
      const d = new Date(t*1000);
      const mm = (d.getMonth()+1).toString().padStart(2,'0');
      const dd = d.getDate().toString().padStart(2,'0');
      const lab = document.createElement('div');
      lab.textContent = `${mm}-${dd}`;
      lab.style.color = '#9ca3af';
      lab.style.fontSize = '11px';
      lab.style.fontWeight = 600;
      place(lab, t + 3600); // nudge into the day
      datesHost.appendChild(lab);

      const line = document.createElement('div');
      line.style.position='absolute';
      line.style.width='1px';
      line.style.background='#3a3a3a';
      line.style.top='0';
      line.style.bottom='0';
      place(line, t);
      datesHost.appendChild(line);
    }
  }

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
      <div style={{ padding: '6px 12px', color: '#9ca3af', fontSize: 12, borderBottom: '1px solid #2b2b2b', display:'flex', gap:12, alignItems:'center' }}>
        <div>RowChart v2.0 • Base: {baseShown || 'MISSING'} • Symbol: {symbol} • TF: {tf} • Bars: {bars.length}</div>
        <button
          onClick={async () => {
            console.log('[RowChart v2.0] manual fetch start');
            const result = await doFetch(true);
            if (result?.ok) {
              alert(`Fetched ${result.count ?? 0} bars for ${symbol} ${tf}`);
            } else if (result?.aborted) {
              alert('Fetch aborted');
            } else {
              alert(`Fetch error: ${result?.error || 'unknown'}`);
            }
          }}
          style={{ marginLeft: 'auto', background:'#eab308', color:'#111', border:'none', borderRadius:8, padding:'6px 10px', fontWeight:700, cursor:'pointer' }}
        >
          Test Fetch
        </button>
      </div>

      {/* Chart host with timeline overlay injected in effect */}
      <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
        {loading && <div style={overlayStyle}><span style={{ color: '#eab308', fontWeight: 700 }}>Loading bars…</span></div>}
        {!loading && !error && bars.length === 0 && (
          <div style={overlayStyle}><span style={{ color: '#ef4444', fontWeight: 700 }}>No data returned</span></div>
        )}
        {error && (
          <div style={overlayStyle}>
            <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 700 }}>Error: {error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = { background: '#0b0b0b', color: '#e5e7eb', border: '1px solid #2b2b2b', borderRadius: 8, padding: '6px 8px' };
const rangeBtnStyle = (active) => ({ background: active ? '#eab308' : '#0b0b0b', color: active ? '#111111' : '#e5e7eb', border: '1px solid #2b2b2b', borderRadius: 8, padding: '6px 10px', fontWeight: 600, cursor: 'pointer' });
const overlayStyle = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', textAlign: 'center', padding: 12 };
