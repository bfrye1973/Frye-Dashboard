// src/components/LiveLWChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

// ---------- API base resolver ----------
const API_BASE =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.NEXT_PUBLIC_API_BASE)) ||
  "";

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

// ---------- small utils ----------
const toSec = (t) =>
  typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : Math.floor(Number(t) / 1000);

function ema(values, length) {
  if (!Array.isArray(values) || !length) return [];
  const k = 2 / (length + 1);
  const out = [];
  let prev;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) {
      out.push(undefined);
      continue;
    }
    if (prev == null) {
      // seed with SMA over first length
      const start = Math.max(0, i - length + 1);
      const slice = values.slice(start, i + 1).filter((x) => typeof x === "number");
      if (slice.length < length) {
        out.push(undefined);
        continue;
      }
      const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
      prev = sma;
      out.push(prev);
    } else {
      prev = v * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

/**
 * Money Flow Index (0..100)
 * Uses typical price ((H+L+C)/3) and volume over a given period.
 * Returns array aligned to bars.
 */
function mfi(bars, period = 14) {
  if (!Array.isArray(bars) || bars.length === 0) return [];
  const tp = bars.map((b) => (b.h + b.l + b.c) / 3);
  const rawMF = tp.map((p, i) => p * (bars[i]?.v ?? 0));

  const out = new Array(bars.length).fill(undefined);
  for (let i = 1; i < bars.length; i++) {
    // positive if typical price increased vs previous bar
    const pos = tp[i] > tp[i - 1] ? rawMF[i] : 0;
    const neg = tp[i] < tp[i - 1] ? rawMF[i] : 0;

    // rolling sums over window "period"
    let posSum = 0,
      negSum = 0;
    for (let j = Math.max(1, i - period + 1); j <= i; j++) {
      const isPos = tp[j] > tp[j - 1];
      const mf = rawMF[j];
      if (isPos) posSum += mf;
      else if (tp[j] < tp[j - 1]) negSum += mf;
      // equal tp -> both add 0
    }
    if (posSum === 0 && negSum === 0) {
      out[i] = 50;
      continue;
    }
    if (negSum === 0) {
      out[i] = 100;
      continue;
    }
    const mr = posSum / negSum;
    out[i] = 100 - 100 / (1 + mr);
  }
  return out;
}

// ---------- component ----------
export default function LiveLWChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "1d",
  height = 560,
}) {
  // persisted UI state
  const persisted = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("lwc_ui") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [symbol, setSymbol] = useState(persisted.symbol || defaultSymbol);
  const [tf, setTf] = useState(persisted.tf || defaultTimeframe);
  const [showVol, setShowVol] = useState(
    typeof persisted.showVol === "boolean" ? persisted.showVol : true
  );
  const [showMfi, setShowMfi] = useState(
    typeof persisted.showMfi === "boolean" ? persisted.showMfi : true
  );
  const [mfiPeriod, setMfiPeriod] = useState(persisted.mfiPeriod || 14);

  // refs for chart + series
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const mfiRef = useRef(null); // left scale line

  const [error, setError] = useState("");

  // persist ui
  useEffect(() => {
    localStorage.setItem(
      "lwc_ui",
      JSON.stringify({ symbol, tf, showVol, showMfi, mfiPeriod })
    );
  }, [symbol, tf, showVol, showMfi, mfiPeriod]);

  // build chart once
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
      height,
      layout: {
        background: { type: "Solid", color: "#0f1117" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.05, bottom: 0.25 }, // leave room for volume overlay
      },
      leftPriceScale: {
        visible: true, // we will use left scale for MFI (0..100)
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
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
      priceScaleId: "", // overlay on main
      base: 0,
      visible: showVol,
    });

    const ema10 = chart.addLineSeries({
      color: "#19c2ff",
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: true,
      title: "EMA 10",
    });

    const ema20 = chart.addLineSeries({
      color: "#ffa726",
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: true,
      title: "EMA 20",
    });

    const mfiLine = chart.addLineSeries({
      color: "#7bd88f",
      lineWidth: 1,
      priceScaleId: "left", // 0..100 scale
      priceFormat: { type: "price", precision: 0, minMove: 1 },
      lastValueVisible: true,
      visible: showMfi,
      title: `MFI ${mfiPeriod}`,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;
    ema10Ref.current = ema10;
    ema20Ref.current = ema20;
    mfiRef.current = mfiLine;

    // resize observer
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current?.clientWidth || 1200, height });
    });
    ro.observe(wrapRef.current);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      ema10Ref.current = null;
      ema20Ref.current = null;
      mfiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflect visibility toggles on existing series
  useEffect(() => {
    if (volRef.current) volRef.current.applyOptions({ visible: showVol });
  }, [showVol]);
  useEffect(() => {
    if (mfiRef.current) mfiRef.current.applyOptions({ visible: showMfi, title: `MFI ${mfiPeriod}` });
  }, [showMfi, mfiPeriod]);

  // ---- data fetcher ----
  async function fetchHistory(sym, timeframe) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = apiUrl(
        `/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`OHLC ${r.status}: ${txt || "Not Found"}`);
      }
      const j = await r.json();
      // backend returns { ok, symbol, timeframe, source, bars: [{t,o,h,l,c,v}] }
      const rows = Array.isArray(j?.bars) ? j.bars : [];
      return rows.map((b) => ({
        time: toSec(b.t),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v ?? 0,
      }));
    } finally {
      clearTimeout(id);
    }
  }

  // main data effect
  useEffect(() => {
    let alive = true;
    setError("");

    (async () => {
      try {
        if (!chartRef.current || !candleRef.current) return;

        // adjust time axis mode
        chartRef.current.applyOptions({
          timeScale: {
            timeVisible: tf !== "1d",
            secondsVisible: tf === "1m",
          },
        });

        const rows = await fetchHistory(symbol, tf);
        if (!alive) return;

        // set candles
        candleRef.current.setData(
          rows.map((r) => ({
            time: r.time,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
          }))
        );

        // volume histogram (color based on up/down)
        if (volRef.current) {
          const vData = rows.map((r) => ({
            time: r.time,
            value: r.volume,
            color: (r.close ?? 0) >= (r.open ?? 0)
              ? "rgba(38,166,154,0.45)"
              : "rgba(239,83,80,0.45)",
          }));
          volRef.current.setData(vData);
        }

        // EMAs
        const closes = rows.map((r) => r.close);
        const e10 = ema(closes, 10);
        const e20 = ema(closes, 20);

        ema10Ref.current?.setData(
          rows.map((r, i) =>
            e10[i] != null ? { time: r.time, value: Number(e10[i].toFixed(2)) } : { time: r.time, value: undefined }
          )
        );

        ema20Ref.current?.setData(
          rows.map((r, i) =>
            e20[i] != null ? { time: r.time, value: Number(e20[i].toFixed(2)) } : { time: r.time, value: undefined }
          )
        );

        // MFI (left scale 0..100)
        if (mfiRef.current) {
          const mf = mfi(
            rows.map((r) => ({ h: r.high, l: r.low, c: r.close, v: r.volume })),
            Number(mfiPeriod) || 14
          );
          mfiRef.current.setData(
            rows.map((r, i) =>
              mf[i] != null ? { time: r.time, value: Math.max(0, Math.min(100, Math.round(mf[i]))) } : { time: r.time, value: undefined }
            )
          );
        }

        chartRef.current.timeScale().fitContent();
      } catch (err) {
        setError(err?.message || String(err));
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, tf, mfiPeriod]);

  // ------- UI controls -------
  const onSymChange = (e) => setSymbol(e.target.value.toUpperCase());
  const onMfiPeriodChange = (e) => {
    const v = Math.max(2, Math.min(200, Number(e.target.value) || 14));
    setMfiPeriod(v);
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#c9d1d9",
          padding: "6px 8px",
          fontSize: 13,
        }}
      >
        <span style={{ opacity: 0.8 }}>Symbol</span>
        <select
          value={symbol}
          onChange={onSymChange}
          style={{ background: "#0f1117", color: "#c9d1d9", border: "1px solid #1f2633", borderRadius: 6, padding: "4px 6px" }}
        >
          {["SPY", "QQQ", "IWM", "MDY", "AAPL", "MSFT", "NVDA"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span style={{ opacity: 0.8 }}>Timeframe</span>
        {["1m", "1h", "1d"].map((k) => (
          <button
            key={k}
            onClick={() => setTf(k)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #1f2633",
              background: tf === k ? "#1f2633" : "transparent",
              color: "#c9d1d9",
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
          <input type="checkbox" checked={showVol} onChange={(e) => setShowVol(e.target.checked)} />
          Volume
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
          <input type="checkbox" checked={showMfi} onChange={(e) => setShowMfi(e.target.checked)} />
          MFI
        </label>

        <span style={{ opacity: 0.8 }}>MFI Period</span>
        <input
          type="number"
          min={2}
          max={200}
          value={mfiPeriod}
          onChange={onMfiPeriodChange}
          style={{
            width: 60,
            background: "#0f1117",
            color: "#c9d1d9",
            border: "1px solid #1f2633",
            borderRadius: 6,
            padding: "4px 6px",
          }}
        />

        <div style={{ marginLeft: "auto", opacity: 0.6, fontSize: 12 }}>
          API: {API_BASE ? API_BASE : "(relative /api)"}
        </div>
      </div>

      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          minHeight: height,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #1b2130",
          background: "#0f1117",
        }}
        aria-label="Lightweight Charts price chart"
      />

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            fontSize: 13,
            background: "#2a1f1f",
            color: "#ffb3b3",
            border: "1px solid #4b2b2b",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
