// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;
const INTRADAY_SOURCE_URL = process.env.REACT_APP_INTRADAY_SOURCE_URL;

const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
function fmtIso(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

/* ---------------------------- Stoplight ---------------------------- */
function Stoplight({ label, value, baseline, size = 54, unit = "%" }) {
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

  const arrow =
    !Number.isFinite(delta) ? "→" : Math.abs(delta) < 0.5 ? "→" : delta > 0 ? "↑" : "↓";

  const deltaColor =
    !Number.isFinite(delta)
      ? "#94a3b8"
      : delta > 0
      ? "#22c55e"
      : delta < 0
      ? "#ef4444"
      : "#94a3b8";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: size + 36,
      }}
    >
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 12px ${colors.glow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "4px solid #0c1320",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: size >= 100 ? 20 : 16,
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
          fontSize: 15,
          lineHeight: 1.1,
          textAlign: "center",
        }}
      >
        {label}
      </div>
      <div style={{ color: deltaColor, fontSize: 13, fontWeight: 600 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}
        {unit === "%" ? "%" : ""}
      </div>
    </div>
  );
}

/* -------------------------- Daily baselines ------------------------- */
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

/* ----------------------------- Legend ------------------------------ */
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

/* ========================== Main Row component ========================== */
export default function RowMarketOverview() {
  const { data: live } = useDashboardPoll("dynamic");
  const [legendOpen, setLegendOpen] = React.useState(false);

  // NEW: live intraday states
  const [liveIntraday, setLiveIntraday] = React.useState(null);
  const [liveSource, setLiveSource] = React.useState(null);

  // replay
  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min");
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);

  const granParam =
    granularity === "10min"
      ? "10min"
      : granularity === "1h"
      ? "hourly"
      : "eod";

  // fetch live intraday
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r1 = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const j1 = await r1.json();
        const r2 = await fetch(`${INTRADAY_SOURCE_URL}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const j2 = await r2.json();
        if (!cancelled) {
          setLiveIntraday(j1);
          setLiveSource(j2);
        }
      } catch (e) {
        console.warn("live intraday fetch failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch replay index
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
        if (items.length && !tsSel) setTsSel(items[0].ts);
      } finally {
        setLoadingIdx(false);
      }
    })();
  }, [on, granParam]);

  // fetch snapshot
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

  // choose data
  const data = on && snap && snap.ok !== false ? snap : liveIntraday || live;

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts =
    data?.marketMeter?.updatedAt ??
    data?.meta?.ts ??
    data?.updated_at ??
    data?.ts ??
    null;

  const breadth = Number(
    od?.breadthOdometer ??
      data?.summary?.breadthIdx ??
      gg?.rpm?.pct ??
      50
  );
  const momentum = Number(
    od?.momentumOdometer ??
      data?.summary?.momentumIdx ??
      gg?.speed?.pct ??
      50
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

  const bBreadth = useDailyBaseline("breadth", breadth);
  const bMomentum = useDailyBaseline("momentum", momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily", squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity", liquidity);
  const bVol = useDailyBaseline("volatility", volatility);

  const expansion = 100 - clamp01(squeezeIntra);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const meterValue = Math.round((1 - Sdy) * baseMeter + Sdy * 50);

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
        }}
      >
        <Stoplight label="Breadth" value={breadth} baseline={bBreadth} />
        <Stoplight label="Momentum" value={momentum} baseline={bMomentum} />
        <Stoplight
          label="Intraday Squeeze"
          value={squeezeIntra}
          baseline={bSqueezeIn}
        />
        <Stoplight
          label="Overall Market Indicator"
          value={meterValue}
          baseline={meterValue}
          size={100}
        />
        <Stoplight
          label="Daily Squeeze"
          value={squeezeDaily}
          baseline={bSqueezeDy}
        />
        <Stoplight
          label="Liquidity"
          value={liquidity}
          baseline={bLiquidity}
          unit=""
        />
        <Stoplight
          label="Volatility"
          value={volatility}
          baseline={bVol}
        />
      </div>
    </section>
  );
}
