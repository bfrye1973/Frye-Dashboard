// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";
import { useViewMode, ViewModes } from "../../context/ModeContext";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

/* ---------- baselines (per day) ---------- */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

/* ---------- stoplight ---------- */
function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = Number.isFinite(v) ? toneFor(v) : "info";
  const colors = {
    ok:    { bg:"#22c55e", glow:"rgba(34,197,94,.45)"  },
    warn:  { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" },
    danger:{ bg:"#ef4444", glow:"rgba(239,68,68,.45)"  },
    info:  { bg:"#334155", glow:"rgba(51,65,85,.35)"   }
  }[tone];

  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";

  const arrowClass =
    !Number.isFinite(delta) || Math.abs(delta) < 0.5
      ? "delta delta-flat"
      : delta > 0
      ? "delta delta-up"
      : "delta delta-down";

  return (
    <div className="light" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:size+36 }}>
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size, height: size, borderRadius:"50%",
          background: colors.bg, boxShadow:`0 0 14px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "5px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize:size > 100 ? 20 : 17, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>
      <div className="small" style={{ fontWeight:700, fontSize: 17, lineHeight:1.1, color:"#e5e7eb" }}>{label}</div>
      <div className={arrowClass} style={{ marginTop:2 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
      </div>
    </div>
  );
}

/* =======================
   Row 2 — Market Overview
   ======================= */
export default function RowMarketOverview() {
  // ✅ dynamic cadence (RTH=15s, pre/post=30s, overnight/weekend=120s)
  const { data } = useDashboardPoll?.("dynamic") ?? { data:null };
  const { mode } = useViewMode(); // view mode from Row 1

  const [legendOpen, setLegendOpen] = React.useState(false);

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.meta?.ts || null;

  // normalized (from dashboardApi)
  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);

  // intraday squeeze (compression), expansion = 100 - compression
  const squeezeIntra = Number(od?.squeezeCompressionPct ?? 50);

  // daily squeeze (compression) — MUST be under gauges.squeezeDaily.pct
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct) ? gg.squeezeDaily.pct : null;

  // liquidity & volatility; accept both canonical and water.pct
  const liquidity  = Number.isFinite(gg?.oil?.psi) ? gg.oil.psi : (Number.isFinite(gg?.oilPsi) ? gg.oilPsi : NaN);
  const volatility = Number.isFinite(gg?.volatilityPct) ? gg.volatilityPct : (Number.isFinite(gg?.water?.pct) ? gg.water.pct : NaN);

  // baselines
  const bBreadth   = useDailyBaseline("breadth", breadth);
  const bMomentum  = useDailyBaseline("momentum", momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily", squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity", liquidity);
  const bVol       = useDailyBaseline("volatility", volatility);

  // ----- Market Meter formula -----
  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;

  // blend toward neutral by daily squeeze
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const blended = (1 - Sdy) * baseMeter + Sdy * 50; // 0..100
  const meterValue = Math.round(blended);

  /* ---------- render ---------- */
  return (
    <section id="row-2" className="panel" style={{ padding:12 }}>
      {/* Legend modal */}
      {legendOpen && (
        <LegendModal onClose={() => setLegendOpen(false)}>
          <LegendContent />
        </LegendModal>
      )}

      {/* Header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>
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
            marginLeft: 8
          }}
          title="Show legend"
        >
          Legend
        </button>
        <div className="spacer" />
        <LastUpdated ts={ts} />
      </div>

      {/* Layouts by view mode */}
      {mode === ViewModes.METER_TILES && (
        <MeterTilesLayout
          breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
          squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
          meterValue={meterValue}
          bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
          bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
        />
      )}

      {mode === ViewModes.TRAFFIC && (
        <TrafficLightsLayout
          breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
          squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
          bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
          bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
        />
      )}

      {mode === ViewModes.ARROWS && (
        <ArrowScorecardsLayout
          breadth={{ value: breadth, base: bBreadth }}
          momentum={{ value: momentum, base: bMomentum }}
          squeezeIntra={{ value: squeezeIntra, base: bSqueezeIn }}
          squeezeDaily={{ value: squeezeDaily, base: bSqueezeDy }}
          liquidity={{ value: liquidity, base: bLiquidity }}
          volatility={{ value: volatility, base: bVol }}
          meterValue={meterValue}
        />
      )}
    </section>
  );
}

/* =========================
   Layout variants (Row 2)
   ========================= */

function MeterTilesLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility,
  meterValue,
  bBreadth, bMomentum, bSqueezeIn, bSqueezeDy, bLiquidity, bVol
}) {
  return (
    <div
      style={{
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        gap:10,
        marginTop:6
      }}
    >
      {/* LEFT: Breadth, Momentum, Intraday Squeeze (capped width) */}
      <div style={{
        display: 'flex', gap: 12, maxWidth: 420, width: '100%',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Stoplight label="Breadth"          value={breadth}      baseline={bBreadth} />
        <Stoplight label="Momentum"         value={momentum}     baseline={bMomentum} />
        <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
      </div>

      {/* CENTER: big meter + daily squeeze small */}
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} size={110} />
        <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
      </div>

      {/* RIGHT: Liquidity, Volatility */}
      <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
        <Stoplight label="Liquidity"  value={liquidity}  baseline={bLiquidity} unit="" />
        <Stoplight label="Volatility" value={volatility} baseline={bVol} />
      </div>
    </div>
  );
}

function TrafficLightsLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility
}) {
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
      <Stoplight label="Breadth"          value={breadth}      baseline={null} />
      <Stoplight label="Momentum"         value={momentum}     baseline={null} />
      <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={null} />
      <Stoplight label="Daily Squeeze"    value={squeezeDaily} baseline={null} />
      <Stoplight label="Liquidity"        value={liquidity}    baseline={null} unit="" />
      <Stoplight label="Volatility"       value={volatility}   baseline={null} />
    </div>
  );
}

function ArrowScorecardsLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue
}) {
  const Card = ({ title, value, base }) => {
    const v = Number.isFinite(value) ? value : NaN;
    const d = Number.isFinite(value) && Number.isFinite(base) ? value - base : NaN;
    const arrow = !Number.isFinite(d) ? "→" : d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const tone = Number.isFinite(v) ? toneFor(v) : "info";
    const border = { ok:"#22c55e", warn:"#fbbf24", danger:"#ef4444", info:"#475569" }[tone];

    return (
      <div style={{
        border:`1px solid ${border}`, borderRadius:12, padding:"10px 12px",
        minWidth:160, background:"#0f1113"
      }}>
        <div style={{ color:"#9ca3af", fontSize:12 }}>{title}</div>
        <div style={{ color:"#e5e7eb", fontWeight:800, fontSize:18 }}>{pct(v)}%</div>
        <div style={{ color:"#cbd5e1", fontSize:12, marginTop:2 }}>
          {arrow} {Number.isFinite(d) ? d.toFixed(1) : "0.0"}%
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
      <Card title="Market Meter" value={meterValue} base={50} />
      <Card title="Breadth" value={breadth.value} base={breadth.base} />
      <Card title="Momentum" value={momentum.value} base={momentum.base} />
      <Card title="Intraday Squeeze" value={squeezeIntra.value} base={squeezeIntra.base} />
      <Card title="Daily Squeeze" value={squeezeDaily.value} base={squeezeDaily.base} />
      <Card title="Liquidity" value={liquidity.value} base={liquidity.base} />
      <Card title="Volatility" value={volatility.value} base={volatility.base} />
    </div>
  );
}

/* =========================
   Legend Modal + Content
   ========================= */

function LegendModal({ onClose, children }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 92vw)",
          background: "#0b0b0c",
          border: "1px solid #2b2b2b",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            onClick={onClose}
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
  );
}

function LegendContent() {
  const h2 = { color: "#e5e7eb", margin: "6px 0 8px", fontSize: 16, fontWeight: 700 };
  const h3 = { color: "#e5e7eb", margin: "10px 0 6px", fontSize: 14, fontWeight: 700 };
  const p  = { color: "#cbd5e1", margin: "4px 0", fontSize: 14, lineHeight: 1.5 };
  const ul = { color: "#cbd5e1", fontSize: 14, lineHeight: 1.5, paddingLeft: 18, margin: "4px 0 10px" };
  const code = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#e5e7eb" };

  const Tag = ({ bg, children }) => (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 6,
      fontSize: 12, marginLeft: 6, background: bg, color: "#0f1115", fontWeight: 700
    }}>{children}</span>
  );

  return (
    <div>
      <div style={h2}>Market Meter — Gauge Legend (with Examples)</div>

      {/* Breadth */}
      <div style={h3}>Breadth</div>
      <p>Shows what % of stocks are rising vs falling.</p>
      <p><strong>Example:</strong> 95% → Almost all stocks are going up together. Very strong market participation.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Weak</Tag> → Most stocks are falling.</li>
        <li>35–64% <Tag bg="#f59e0b">🟡 Neutral</Tag> → Mixed, no clear trend.</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Strong</Tag> → Broad rally.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → Overheated, risk of pullback.</li>
      </ul>

      {/* Momentum */}
      <div style={h3}>Momentum</div>
      <p>Measures the balance of new highs vs new lows.</p>
      <p><strong>Example:</strong> 95% → Huge buying momentum; many stocks are breaking out to new highs.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Bearish</Tag> → More new lows than highs.</li>
        <li>35–64% <Tag bg="#f59e0b">🟡 Neutral</Tag> → Balanced.</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Bullish</Tag> → More new highs than lows.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → Momentum may be unsustainable.</li>
      </ul>

      {/* Intraday Squeeze */}
      <div style={h3}>Intraday Squeeze</div>
      <p>Shows how “compressed” today’s trading ranges are. Think spring tension.</p>
      <p><strong>Example:</strong> 95% → Market is very coiled; big move could fire soon.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–34% <Tag bg="#22c55e">🟢 Expanded</Tag> → Market already moving freely.</li>
        <li>35–64% <Tag bg="#f59e0b">🟡 Normal</Tag> → Average compression.</li>
        <li>65–84% <Tag bg="#fb923c">🟠 Tight</Tag> → Building pressure.</li>
        <li>85–100% <Tag bg="#f97316">🔥 Critical</Tag> → Very tight coil, watch for breakout.</li>
      </ul>

      {/* Daily Squeeze */}
      <div style={h3}>Daily Squeeze</div>
      <p>Same as Intraday Squeeze, but over multiple days (bigger picture).</p>
      <p><strong>Example:</strong> 95% → Market is extremely compressed on the daily chart → expect a big move soon.</p>
      <div style={p}><strong>Zones:</strong> Same as Intraday.</div>

      {/* Volatility */}
      <div style={h3}>Volatility</div>
      <p>How big the swings are.</p>
      <p><strong>Example:</strong> 95% → Very high volatility; market is turbulent and risky.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–29% <Tag bg="#22c55e">🟢 Calm</Tag> → Easy to hold positions.</li>
        <li>30–59% <Tag bg="#f59e0b">🟡 Normal</Tag> → Manageable swings.</li>
        <li>60–74% <Tag bg="#fb923c">🟠 Elevated</Tag> → Riskier conditions.</li>
        <li>75–100% <Tag bg="#ef4444">🔴 High</Tag> → Expect sharp, unpredictable moves.</li>
      </ul>

      {/* Liquidity */}
      <div style={h3}>Liquidity</div>
      <p>How much buying/selling volume is available.</p>
      <p><strong>Example:</strong> 95% → Very liquid market; trades fill easily, low slippage.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–29% <Tag bg="#ef4444">🔴 Thin</Tag> → Hard to get in/out without moving price.</li>
        <li>30–49% <Tag bg="#fb923c">🟠 Light</Tag> → Caution needed.</li>
        <li>50–69% <Tag bg="#f59e0b">🟡 Normal</Tag> → Adequate.</li>
        <li>70–84% <Tag bg="#22c55e">🟢 Good</Tag> → Healthy trading.</li>
        <li>85–100% <Tag bg="#16a34a">🟢🟢 Excellent</Tag> → Very easy to trade.</li>
      </ul>

      {/* Formula */}
      <div style={{ ...h3, marginTop: 12 }}>Market Meter</div>
      <div style={{ ...p, ...code }}>
        base = 0.4×Breadth + 0.4×Momentum + 0.2×(100 − Intraday&nbsp;Squeeze)
        <br />
        blend = (1 − w)×base + w×50, where w = Daily&nbsp;Squeeze/100
      </div>
      <div style={{ ...p, opacity: 0.8, marginTop: 6 }}>
        When daily squeeze is high, the meter is blended toward 50 (neutral).
      </div>

      {/* Overall Market Indicator explanation */}
      <div style={h3}>Overall Market Indicator</div>
      <p>Overall average of the gauges — like a “dashboard score.”</p>
      <p><strong>Example:</strong> 95% → Market is firing on all cylinders, very strong environment.</p>
      <div style={p}><strong>Zones:</strong></div>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Weak</Tag> → Market conditions unfavorable.</li>
        <li>35–64% <Tag bg="#f59e0b">🟡 Mixed</Tag> → Sideways/choppy.</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Favorable</Tag> → Trend-friendly.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> → May be overheated.</li>
      </ul>
    </div>
  );
}
