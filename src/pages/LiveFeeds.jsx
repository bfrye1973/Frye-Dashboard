// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveFeedsChart from "../components/LiveFeedsChart";

/** ---------- Config (backend URLs) ---------- */
const API_BASE =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

const WS_BASE =
  (typeof window !== "undefined" && window.__WS_BASE__) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.WS_BASE_URL ||
      process.env.REACT_APP_WS_BASE ||
      process.env.VITE_WS_BASE_URL)) ||
  API_BASE.replace(/^http/i, "ws"); // derive wss:// from https://

/** ---------- Small UI helpers ---------- */
function fmtTsSec(ts) {
  try { return new Date(ts * 1000).toLocaleString(); } catch { return "—"; }
}

function Tile({ title, ts, newHighs, newLows, adrAvg }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileHead}>
        <span style={{ fontWeight: 800 }}>{title}</span>
        <span style={styles.tileTs}>{fmtTsSec(ts)}</span>
      </div>
      <div style={styles.tileRow}><b>New Highs:</b>&nbsp;{newHighs ?? "—"}</div>
      <div style={styles.tileRow}><b>New Lows:</b>&nbsp;{newLows ?? "—"}</div>
      <div style={styles.tileRow}><b>ADR Avg:</b>&nbsp;{adrAvg ?? "—"}</div>
    </div>
  );
}

/** ---------- Page ---------- */
export default function LiveFeeds() {
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // minute | hour | day

  // market tiles
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);

  // chart candles (this is what we pass down)
  const [candles, setCandles] = useState([]);

  // WS closer
  const wsStopRef = useRef(null);
  const lastTimeRef = useRef(null);

  // 7d range default
  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    return {
      fromISO: from.toISOString().slice(0, 10),
      toISO: to.toISOString().slice(0, 10),
    };
  }, []);

  // Load history + open WS when ticker/tf change
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
        ticker
      )}&tf=${encodeURIComponent(tf)}&from=${fromISO}&to=${toISO}`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`history ${r.status}`);
        const data = await r.json(); // [{time,open,high,low,close,volume}]
        if (cancelled) return;
        setCandles(Array.isArray(data) ? data : []);
        lastTimeRef.current = data?.length ? data[data.length - 1].time : null;
      } catch (e) {
        console.error("loadHistory error:", e);
        if (!cancelled) setCandles([]);
      }
    }

    function openWS() {
      // close existing
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      let ws;
      try {
        ws = new WebSocket(WS_BASE);
      } catch (e) {
        console.error("WS open failed:", e);
        return () => {};
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg || !msg.type) return;

          if (msg.type === "bar" && msg.payload) {
            const b = msg.payload; // {ticker,time,open,high,low,close,volume}
            if (b.ticker && b.ticker !== ticker) return;
            // append/update last candle locally
            setCandles((prev) => {
              if (!prev?.length) return [b];
              const last = prev[prev.length - 1];
              if (last && last.time === b.time) {
                const copy = prev.slice();
                copy[copy.length - 1] = b;
                return copy;
              }
              return [...prev, b];
            });
            lastTimeRef.current = b.time;
          } else if (msg.type === "metrics" && msg.payload) {
            setMetrics(msg.payload.sectors || []);
            setMetricsTs(msg.payload.timestamp || Math.floor(Date.now() / 1000));
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};

      return () => { try { ws.close(); } catch {} };
    }

    loadHistory();
    wsStopRef.current = openWS();

    return () => {
      cancelled = true;
      try { wsStopRef.current && wsStopRef.current(); } catch {}
    };
  }, [ticker, tf, fromISO, toISO]);

  // one-time metrics boot
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/market-metrics`, { cache: "no-store" });
        if (!r.ok) return;
        const m = await r.json();
        setMetrics(m.sectors || []);
        setMetricsTs(m.timestamp || Math.floor(Date.now() / 1000));
      } catch {}
    })();
  }, []);

  return (
    <section>
      {/* Controls */}
      <div style={styles.controls}>
        <label style={styles.label}>Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="AAPL"
          style={styles.input}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["minute", "hour", "day"].map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{
                ...styles.btn,
                background: tf === k ? "#21304b" : "#10141f",
              }}
              title={`Timeframe: ${k}`}
            >
              {k === "minute" ? "1m" : k === "hour" ? "1h" : "1d"}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy strips (placeholders) */}
      <div style={styles.strips}>
        <div style={styles.strip}><b>Wave 3</b> • signals feed</div>
        <div style={styles.strip}><b>Flagpole</b> • breakouts</div>
        <div style={styles.strip}><b>EMA Run</b> • daily/weekly</div>
      </div>

      {/* Tiles */}
      <div style={styles.tiles}>
        {metrics?.length ? (
          metrics.map((s, i) => (
            <Tile
              key={i}
              title={s.sector}
              ts={metricsTs}
              newHighs={s.newHighs}
              newLows={s.newLows}
              adrAvg={s.adrAvg}
            />
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>Loading market metrics…</div>
        )}
      </div>

      {/* Chart + overlays (candles passed down) */}
      <LiveFeedsChart ticker={ticker} tf={tf} height={420} candles={candles} />
    </section>
  );
}

/** ---------- Styles ---------- */
const styles = {
  controls: {
    display: "flex", gap: 12, alignItems: "center", margin: "8px 0 14px", flexWrap: "wrap",
  },
  label: { fontSize: 14, opacity: 0.8 },
  input: {
    background: "#10141f", color: "#e6edf7", border: "1px solid #1b2130",
    borderRadius: 8, padding: "8px 10px", width: 120, outline: "none",
  },
  btn: {
    padding: "8px 10px", borderRadius: 8, border: "1px solid #1b2130",
    color: "#e6edf7", cursor: "pointer",
  },
  strips: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
    gap: 8, marginBottom: 10,
  },
  strip: {
    background: "#11151f", border: "1px solid #1b2130", borderRadius: 10,
    padding: "8px 10px", fontSize: 13, color: "#cfd8ec",
  },
  tiles: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
    gap: 12, marginBottom: 14,
  },
  tile: {
    background: "#11151f", border: "1px solid #1b2130", borderRadius: 10,
    padding: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  tileHead: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  tileTs: { fontSize: 12, opacity: 0.6 },
  tileRow: { fontSize: 13, lineHeight: "18px" },
};
