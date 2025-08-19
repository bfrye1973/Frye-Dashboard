// src/components/LiveLWChart.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/* ---------------------- small helpers ---------------------- */
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact" });
const apiBase =
  (typeof window !== "undefined" && window.__API_BASE__) || "";

/* backend fetch */
const TF = { "1m": "1m", "1h": "1h", "1d": "1d" };

async function fetchOHLC(symbol, timeframe) {
  const u = `${apiBase}/api/v1/ohlc?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=${encodeURIComponent(TF[timeframe] || "1d")}`;
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);
  const j = await r.json();

  const rows = Array.isArray(j)
    ? j
    : Array.isArray(j?.bars)
    ? j.bars.map((b) => ({
        time: Math.round((b.t ?? Date.now()) / 1000),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      }))
    : [];

  return rows.map((r) => ({
    time:
      typeof r.time === "string"
        ? Math.floor(new Date(r.time).getTime() / 1000)
        : r.time,
    open: +r.open,
    high: +r.high,
    low: +r.low,
    close: +r.close,
    volume: +r.volume || 0,
  }));
}

/* EMA */
function ema(values, period) {
  const out = [];
  const k = 2 / (period + 1);
  let e;
  for (let i = 0; i < values.length; i++) {
    const v = values[i].close;
    e = i === 0 ? v : v * k + e * (1 - k);
    out.push({ time: values[i].time, value: e });
  }
  return out;
}

/* ---------------- Money-Flow Profile core ------------------ */
/* Build bins across ALL rows (safe & stable). We can scope to visible range later. */
function buildMfBins({ rows, binCount = 32, mode = "cmf" }) {
  if (!rows?.length) {
    return { bins: [], maxAbs: 0, totalAbs: 0, poc: null, minP: 0, maxP: 0 };
  }

  // typical prices + min/max
  let minP = Infinity,
    maxP = -Infinity;
  const tp = rows.map((r) => {
    const t = (r.high + r.low + r.close) / 3;
    if (t < minP) minP = t;
    if (t > maxP) maxP = t;
    return t;
  });

  if (!isFinite(minP) || !isFinite(maxP) || minP === maxP) {
    return { bins: [], maxAbs: 0, totalAbs: 0, poc: null, minP, maxP };
  }

  const bins = new Array(binCount).fill(0).map(() => ({
    pos: 0,
    neg: 0,
    abs: 0,
    mid: 0,
  }));
  const binSize = (maxP - minP) / binCount;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let flow = 0;

    if (mode === "mfi") {
      const prev = i > 0 ? tp[i - 1] : tp[i];
      const sign = tp[i] > prev ? 1 : tp[i] < prev ? -1 : 0;
      flow = sign * (r.volume || 0);
    } else {
      // CMF-style signed flow
      const denom = Math.max(1e-8, r.high - r.low);
      const mm = ((r.close - r.low) - (r.high - r.close)) / denom; // [-1,1]
      flow = mm * (r.volume || 0);
    }

    let idx = Math.floor((tp[i] - minP) / binSize);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;

    const b = bins[idx];
    if (flow >= 0) b.pos += flow;
    else b.neg += -flow;
  }

  let maxAbs = 0,
    totalAbs = 0,
    pocIdx = 0;
  for (let i = 0; i < binCount; i++) {
    const b = bins[i];
    b.abs = b.pos + b.neg;
    b.mid = minP + (i + 0.5) * binSize;
    totalAbs += b.abs;
    if (b.abs > maxAbs) {
      maxAbs = b.abs;
      pocIdx = i;
    }
  }
  const poc = bins[pocIdx] ? { ...bins[pocIdx] } : null;

  return { bins, maxAbs, totalAbs, poc, minP, maxP };
}

/* Paint overlay on a canvas attached to the WRAPPER DIV (fix for appendChild error) */
function useMfOverlay({
  hostEl,            // wrapper div
  chart,
  candleSeries,
  rows,
  enabled,
  binCount,
  mode,
  showLabels,
  showPOC,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // attach canvas to wrapper div
  useEffect(() => {
    if (!hostEl) return;
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2";
    hostEl.appendChild(canvas);
    canvasRef.current = canvas;

    const ro = new ResizeObserver(() => requestDraw());
    ro.observe(hostEl);

    const unsub = chart?.timeScale()?.subscribeVisibleLogicalRangeChange?.(() => {
      requestDraw();
    });

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart?.timeScale()?.unsubscribeVisibleLogicalRangeChange?.(unsub); } catch {}
      try { hostEl.removeChild(canvas); } catch {}
      canvasRef.current = null;
    };
  }, [hostEl, chart]);

  function requestDraw() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !candleSeries || !enabled || !rows?.length) return;

    // size
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const { bins, maxAbs, totalAbs, poc } = buildMfBins({
      rows, binCount, mode,
    });
    if (!bins.length || maxAbs <= 0) return;

    // layout
    const gapRight = 85;          // keep clear for price scale
    const barMaxWidth = 150;
    const xRight = w - gapRight;
    const scale = barMaxWidth / maxAbs;

    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    const colorPos = "rgba(62, 201, 150, 0.9)";
    const colorNeg = "rgba(239, 83, 80, 0.9)";
    const colorText = "#aeb4c0";
    const pocColor = "rgba(255,234,0,0.9)";

    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const y = candleSeries.priceToCoordinate(b.mid);
      if (y == null) continue;

      const bw = Math.max(1, b.abs * scale);
      const bwPos = (b.pos / Math.max(1e-9, b.abs)) * bw;
      const bwNeg = bw - bwPos;

      const top = Math.round(y - 6);
      const height = 12;

      // red (left)
      ctx.fillStyle = colorNeg;
      ctx.fillRect(xRight - bw, top, bwNeg, height);

      // green (right)
      ctx.fillStyle = colorPos;
      ctx.fillRect(xRight - bwNeg, top, bwPos, height);

      if (showLabels && b.abs > 0) {
        const frac = `${((b.abs / totalAbs) * 100).toFixed(1)}%`;
        const label = `${b.mid.toFixed(2)}  ${frac}  ${compactFmt.format(b.abs)}`;
        ctx.fillStyle = colorText;
        ctx.fillText(label, xRight + 6, y);
      }
    }

    if (showPOC && poc?.mid != null) {
      const y = candleSeries.priceToCoordinate(poc.mid);
      if (y != null) {
        ctx.save();
        ctx.strokeStyle = pocColor;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(xRight + 2, y + 0.5);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // redraw on any control/data change
  useEffect(() => {
    requestDraw();
  }, [enabled, binCount, mode, showLabels, showPOC, rows, chart, candleSeries]);
}

/* ----------------------- main component -------------------- */
export default function LiveLWChart({
  symbol: initialSymbol = "SPY",
  timeframe: initialTf = "1d",
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [tf, setTf] = useState(initialTf);
  const [rows, setRows] = useState([]);
  const [showVol, setShowVol] = useState(true);

  // MF controls
  const [mfEnabled, setMfEnabled] = useState(true);
  const [mfMode, setMfMode] = useState("cmf"); // 'cmf' | 'mfi'
  const [mfBins, setMfBins] = useState(32);
  const [mfLabels, setMfLabels] = useState(true);
  const [mfPOC, setMfPOC] = useState(true);

  // build chart
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
      height,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: tf !== "1d",
        secondsVisible: tf === "1m",
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p) => (p ?? 0).toFixed(2) },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      base: 0,
      color: "rgba(128, 160, 200, 0.4)",
    });
    const ema10 = chart.addLineSeries({
      color: "#0ec6d2",
      lineWidth: 2,
      priceLineVisible: false,
    });
    const ema20 = chart.addLineSeries({
      color: "#f5a524",
      lineWidth: 2,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;
    ema10Ref.current = ema10;
    ema20Ref.current = ema20;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      ema10Ref.current = null;
      ema20Ref.current = null;
    };
  }, [height, tf]);

  // data loader
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchOHLC(symbol, tf);
        if (!alive) return;
        setRows(data);

        const c = candleRef.current;
        const v = volRef.current;
        const e10 = ema10Ref.current;
        const e20 = ema20Ref.current;
        const ch = chartRef.current;
        if (!c || !v || !e10 || !e20 || !ch) return;

        c.setData(
          data.map((d) => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );
        v.setData(
          data.map((d) => ({
            time: d.time,
            value: d.volume || 0,
            color:
              d.close >= d.open
                ? "rgba(62, 201, 150, 0.45)"
                : "rgba(239, 83, 80, 0.45)",
          }))
        );
        e10.setData(ema(data, 10));
        e20.setData(ema(data, 20));
        ch.timeScale().fitContent();
      } catch (e) {
        console.error("fetchHistory error:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol, tf]);

  // volume toggle
  useEffect(() => {
    if (volRef.current) {
      volRef.current.applyOptions({ visible: showVol });
    }
  }, [showVol]);

  // mount MF overlay (uses wrapper div to append canvas)
  useMfOverlay({
    hostEl: wrapRef.current,
    chart: chartRef.current,
    candleSeries: candleRef.current,
    rows,
    enabled: mfEnabled,
    binCount: mfBins,
    mode: mfMode,
    showLabels: mfLabels,
    showPOC: mfPOC,
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f1117",
      }}
    >
      {/* Controls */}
      <div
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 5,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          background: "rgba(15,17,23,0.6)",
          padding: "6px 8px",
          borderRadius: 8,
          border: "1px solid #1b2130",
          backdropFilter: "blur(3px)",
          fontSize: 13,
        }}
      >
        <label style={{ color: "#aeb4c0" }}>Symbol</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            background: "#0f1117",
            color: "#e6e8eb",
            border: "1px solid #2a3242",
            borderRadius: 6,
            padding: "4px 6px",
          }}
        >
          {["SPY", "QQQ", "MDY", "IWM", "NVDA", "AAPL", "MSFT"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label style={{ color: "#aeb4c0", marginLeft: 6 }}>Timeframe</label>
        {["1m", "1h", "1d"].map((k) => (
          <button
            key={k}
            onClick={() => setTf(k)}
            style={{
              background: tf === k ? "#1f2637" : "#0f1117",
              color: "#e6e8eb",
              border: "1px solid #2a3242",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}

        <label style={{ color: "#aeb4c0", marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={showVol}
            onChange={(e) => setShowVol(e.target.checked)}
          />
          &nbsp;Volume
        </label>

        <span
          style={{
            width: 1,
            height: 18,
            background: "#2a3242",
            margin: "0 6px",
          }}
        />

        {/* MF Profile controls */}
        <label style={{ color: "#aeb4c0" }}>
          <input
            type="checkbox"
            checked={mfEnabled}
            onChange={(e) => setMfEnabled(e.target.checked)}
          />
          &nbsp;MF Profile
        </label>

        <select
          value={mfMode}
          onChange={(e) => setMfMode(e.target.value)}
          title="Flow mode"
          style={{
            background: "#0f1117",
            color: "#e6e8eb",
            border: "1px solid #2a3242",
            borderRadius: 6,
            padding: "4px 6px",
          }}
        >
          <option value="cmf">CMF‑style</option>
          <option value="mfi">MFI‑style</option>
        </select>

        <select
          value={mfBins}
          onChange={(e) => setMfBins(+e.target.value)}
          title="Price bins"
          style={{
            background: "#0f1117",
            color: "#e6e8eb",
            border: "1px solid #2a3242",
            borderRadius: 6,
            padding: "4px 6px",
          }}
        >
          {[16, 24, 32, 40, 48, 60].map((n) => (
            <option key={n} value={n}>
              {n} bins
            </option>
          ))}
        </select>

        <label style={{ color: "#aeb4c0" }}>
          <input
            type="checkbox"
            checked={mfLabels}
            onChange={(e) => setMfLabels(e.target.checked)}
          />
          &nbsp;Labels
        </label>

        <label style={{ color: "#aeb4c0" }}>
          <input
            type="checkbox"
            checked={mfPOC}
            onChange={(e) => setMfPOC(e.target.checked)}
          />
          &nbsp;POC
        </label>
      </div>

      <div ref={wrapRef} style={{ width: "100%", height }} />
    </div>
  );
}
