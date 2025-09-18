// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

// Replay (sandboxed)
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

function fmtIso(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

/* ============================================================================
   Replay Controls
============================================================================ */
function ReplayControls({
  on,
  setOn,
  granularity,
  setGranularity,
  ts,
  setTs,
  options,
  loading,
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOn(!on)}
        className={`px-3 py-1 rounded-full border text-sm shadow transition-colors ${
          on
            ? "border-yellow-400 text-yellow-300 bg-neutral-800"
            : "border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-neutral-500"
        }`}
        title="Toggle Replay Mode"
      >
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>

      <select
        value={granularity}
        onChange={(e) => setGranularity(e.target.value)}
        disabled={!on}
        className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm disabled:opacity-50"
        title="Replay granularity"
      >
        <option value="10min">10m</option>
        <option value="1h">1h</option>
        <option value="1d">1d</option>
      </select>

      <select
        value={ts || ""}
        onChange={(e) => setTs(e.target.value)}
        disabled={!on || loading || options.length === 0}
        className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm disabled:opacity-50"
        title="Replay timestamp"
      >
        {loading && <option value="">Loading…</option>}
        {!loading && options.length === 0 && <option value="">No snapshots</option>}
        {!loading && options.length > 0 && (
          <>
            <option value="">Select time…</option>
            {options.map((o) => (
              <option key={o.ts} value={o.ts}>
                {fmtIso(o.ts)}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}

/* ============================================================================
   Stoplight Tile
============================================================================ */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta =
    Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = Number.isFinite(v) ? toneFor(v) : "info";
  const colors = {
    ok: { bg: "#22c55e", glow: "rgba(34,197,94,.45)" },
    warn: { bg: "#fbbf24", glow: "rgba(251,191,36,.45)" },
    danger: { bg: "#ef4444", glow: "rgba(239,68,68,.45)" },
    info: { bg: "#334155", glow: "rgba(51,65,85,.35)" },
  }[tone];

  const arrow = !Number.isFinite(delta)
    ? "→"
    : Math.abs(delta) < 0.5
    ? "→"
    : delta > 0
    ? "↑"
    : "↓";

  const deltaColor = !Number.isFinite(delta)
    ? "#94a3b8"
    : delta > 0
    ? "#22c55e"
    : delta < 0
    ? "#ef4444"
    : "#94a3b8";

  return (
    <div
      className="light"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        minWidth: size + 44,
      }}
    >
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 14px ${colors.glow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "5px solid #0c1320",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: size >= 100 ? 20 : 17,
            color: "#0b1220",
          }}
        >
          {pct(v)}
          {unit === "%" ? "%" : ""}
        </div>
      </div>
      <div
        className="small"
        style={{
          color: "#e5e7eb",
          fontWeight: 700,
          fontSize: 16,
          lineHeight: 1.15,
          textAlign: "center",
        }}
      >
        {label}
      </div>
      <div style={{ color: deltaColor, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}
        {unit === "%" ? "%" : ""}
      </div>
    </div>
  );
}

/* ============================================================================
   Daily baselines
============================================================================ */
const dayKey = () => new Date().toISOString().slice(0, 10);
function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = React.useState(null);

  React.useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null && Number.isFinite(current)) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    } else if (saved !== null) {
      const n = Number(saved);
      setBaseline(Number.isFinite(n) ? n : null);
    }
    // eslint-disable-next-line
  }, [keyName]);

  React.useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);

  return baseline;
}

/* ============================================================================
   Legend (Market Meter) — compact, trader-friendly
============================================================================ */
function Tag({ bg, children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 6,
        fontSize: 12,
        marginLeft: 6,
        background: bg,
        color: "#0f1115",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
function LegendContent() {
  const h2 = { color: "#e5e7eb", margin: "6px 0 8px", fontSize: 16, fontWeight: 700 };
  const h3 = { color: "#e5e7eb", margin: "10px 0 6px", fontSize: 14, fontWeight: 700 };
  const p = { color: "#cbd5e1", margin: "4px 0", fontSize: 14, lineHeight: 1.5 };
  const ul = {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 18,
    margin: "4px 0 10px",
  };

  return (
    <div>
      {/* Breadth */}
      <div style={h2}>Breadth (RPM)</div>
      <p style={p}>
        Measures the balance of <b>new highs vs new lows</b> across the market.
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Almost all stocks are setting more new highs than new
        lows (broad participation).
      </p>
      <div style={p}>
        <b>Zones:</b>
      </div>
      <ul style={ul}>
        <li>
          0–34% <Tag bg="#ef4444">🔴 Weak</Tag> → More new lows than highs.
        </li>
        <li>
          35–64% <Tag bg="#f59e0b">🟡 Neutral</Tag> → Highs ≈ Lows (mixed).
        </li>
        <li>
          65–84% <Tag bg="#22c55e">🟢 Strong</Tag> → More new highs than lows.
        </li>
        <li>
          85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → Overheated; risk of pullback.
        </li>
      </ul>

      {/* Momentum */}
      <div style={h2}>Momentum (Speed)</div>
      <p style={p}>
        Measures <b>advancers vs decliners</b> (market thrust).
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Strong thrust; many more stocks are up than down.
      </p>
      <div style={p}>
        <b>Zones:</b>
      </div>
      <ul style={ul}>
        <li>
          0–34% <Tag bg="#ef4444">🔴 Bearish</Tag> → Decliners dominate.
        </li>
        <li>
          35–64% <Tag bg="#f59e0b">🟡 Neutral</Tag> → Balanced.
        </li>
        <li>
          65–84% <Tag bg="#22c55e">🟢 Bullish</Tag> → Advancers dominate.
        </li>
        <li>
          85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → Unsustainable momentum.
        </li>
      </ul>

      {/* Intraday Squeeze */}
      <div style={h2}>Intraday Squeeze</div>
      <p style={p}>
        Compression of today’s ranges (spring tension) — higher = tighter coil.
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Very coiled; a big move could fire soon.
      </p>
      <div style={p}>
        <b>Zones:</b>
      </div>
      <ul style={ul}>
        <li>
          0–34% <Tag bg="#22c55e">🟢 Expanded</Tag> → Market already moving freely.
        </li>
        <li>
          35–64% <Tag bg="#f59e0b">🟡 Normal</Tag> → Average compression.
        </li>
        <li>
          65–84% <Tag bg="#fb923c">🟠 Tight</Tag> → Pressure building.
        </li>
        <li>
          85–100% <Tag bg="#ef4444">🔴 Critical</Tag> → Very tight coil; breakout risk.
        </li>
      </ul>

      {/* Overall Market Indicator */}
      <div style={h2}>Overall Market Indicator</div>
      <p style={p}>
        Weighted blend of Breadth (40%), Momentum (40%), Expansion (20%), blended toward 50 when Daily Squeeze is high.
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Market is firing on all cylinders; very strong environment.
      </p>
      <div style={p}>
        <b>Zones:</b>
      </div>
      <ul style={ul}>
        <li>
          0–34% <Tag bg="#ef4444">🔴 Weak</Tag> → Market conditions unfavorable.
        </li>
        <li>
          35–64% <Tag bg="#f59e0b">🟡 Mixed</Tag> → Sideways/choppy.
        </li>
        <li>
          65–84% <Tag bg="#22c55e">🟢 Favorable</Tag> → Trend-friendly.
        </li>
        <li>
          85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → May be overheated.
        </li>
      </ul>

      {/* Daily Squeeze */}
      <div style={h2}>Daily Squeeze</div>
      <p style={p}>
        Same idea as Intraday Squeeze but on SPY daily bars (Lux indicator).
      </p>
      <p style={p}>
        <b>Example:</b> 54% → Moderate daily compression (constructive).
      </p>

      {/* Liquidity */}
      <div style={h2}>Liquidity</div>
      <p style={p}>
        Depth/ease of execution (PSI). Higher = easier fills, lower slippage.
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Very liquid; tight fills, low slippage.
      </p>

      {/* Volatility */}
      <div style={h2}>Volatility</div>
      <p style={p}>
        How big price swings are (ATR/stdev). Higher = more turbulent.
      </p>
      <p style={p}>
        <b>Example:</b> 95% → Very high volatility; turbulent and risky.
      </p>
    </div>
  );
}

/* ============================================================================
   Row — Market Overview
============================================================================ */
export default function RowMarketOverview() {
  // Live poll — unconditionally call hook
  const { data: live } = useDashboardPoll("dynamic");

  // View state (you already have ModeContext in your app; leaving out here)
  const [legendOpen, setLegendOpen] = React.useState(false);

  // Replay state
  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min"); // 10min | 1h | 1d
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);

  const granParam =
    granularity === "10min" ? "10min" : granularity === "1h" ? "hourly" : "eod";

  // Load available snapshot timestamps
  React.useEffect(() => {
    if (!on) {
      setIndexOptions([]);
      return;
    }
    (async () => {
      try {
        setLoadingIdx(true);
        const r = await fetch(
          `${API}/api/replay/index?granularity=${granParam}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        const items = Array.isArray(j?.items) ? j.items : [];
        setIndexOptions(items);
        if (items.length > 0 && !tsSel) setTsSel(items[0].ts);
      } catch {
      } finally {
        setLoadingIdx(false);
      }
    })();
  }, [on, granParam]); // eslint-disable-line

  // Load snapshot when tsSel changes
  React.useEffect(() => {
    if (!on || !tsSel) {
      setSnap(null);
      return;
    }
    (async () => {
      try {
        setLoadingSnap(true);
        const r = await fetch(
          `${API}/api/replay/at?granularity=${granParam}&ts=${encodeURIComponent(
            tsSel
          )}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        setSnap(j);
      } catch {
        setSnap(null);
      } finally {
        setLoadingSnap(false);
      }
    })();
  }, [on, tsSel, granParam]);

  // Broadcast replay state for other rows
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("replay:update", {
          detail: { on, ts: tsSel, granularity, data: on && snap ? snap : live },
        })
      );
    }
  }, [on, tsSel, granularity, live, snap]);

  // Choose data source
  const data = on && snap && snap.ok !== false ? snap : live;

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.meta?.ts ?? data?.updated_at ?? data?.ts ?? null;

  // Values
  const breadth = Number(
    od?.breadthOdometer ?? data?.summary?.breadthIdx ?? gg?.rpm?.pct ?? 50
  );
  const momentum = Number(
    od?.momentumOdometer ?? data?.summary?.momentumIdx ?? gg?.speed?.pct ?? 50
  );
  const squeezeIntra = Number(
    od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50
  );
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct)
    ? Number(gg.squeezeDaily.pct)
    : null;
  const liquidity = Number.isFinite(gg?.oil?.psi)
    ? Number(gg.oil.psi)
    : Number.isFinite(gg?.oilPsi)
    ? Number(gg.oilPsi)
    : NaN;
  const volatility = Number.isFinite(gg?.volatilityPct)
    ? Number(gg.volatilityPct)
    : Number.isFinite(gg?.water?.pct)
    ? Number(gg.water.pct)
    : NaN;

  // baselines (for arrows)
  const bBreadth = useDailyBaseline("breadth", breadth);
  const bMomentum = useDailyBaseline("momentum", momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily", squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity", liquidity);
  const bVol = useDailyBaseline("volatility", volatility);

  // Market Meter
  const expansion = 100 - clamp01(squeezeIntra);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const blended = (1 - Sdy) * baseMeter + Sdy * 50;
  const meterValue = Math.round(blended);

  /* ============================= Render ============================= */
  return (
    <section id="row-2" className="panel" style={{ padding: 12 }}>
      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <LegendContent />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background: "#eab308",
                  color: "#111827",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>

        {/* Legend button */}
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
          }}
          title="Legend"
        >
          Legend
        </button>

        {/* NEW: Download combined legends PDF */}
        <a
          href="/legends/all-legends-pack.pdf"
          download
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Download all legends as one PDF"
        >
          Download Legend PDF
        </a>

        <div className="spacer" />
        <div className="flex items-center gap-3">
          {on && tsSel && (
            <span className="text-xs text-neutral-400 hidden sm:inline-block">
              Replaying: {fmtIso(tsSel)} ({granularity})
            </span>
          )}
          <LastUpdated ts={ts} />
          <ReplayControls
            on={on}
            setOn={setOn}
            granularity={granularity}
            setGranularity={setGranularity}
            ts={tsSel}
            setTs={setTsSel}
            options={indexOptions}
            loading={loadingIdx}
          />
        </div>
      </div>

      {/* Gauges row */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        style={{ marginTop: 6 }}
      >
        <Stoplight label="Breadth" value={breadth} baseline={bBreadth} />
        <Stoplight label="Momentum" value={momentum} baseline={bMomentum} />
        <Stoplight
          label="Intraday Squeeze"
          value={squeezeIntra}
          baseline={bSqueezeIn}
        />
        <Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} />
        <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
        <Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit="" />
        <Stoplight label="Volatility" value={volatility} baseline={bVol} />
      </div>

      <div className="text-xs text-neutral-500" style={{ marginTop: 6 }}>
        {on
          ? loadingSnap
            ? "Loading snapshot…"
            : ts
            ? `Snapshot: ${fmtIso(ts)}`
            : "Replay ready"
          : ts
          ? `Updated ${fmtIso(ts)}`
          : ""}
      </div>
    </section>
  );
}
