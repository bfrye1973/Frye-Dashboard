// src/pages/rows/EngineLights.jsx
import React, { useEffect, useMemo, useState } from "react";
import LuxTrendChip from "../../components/LuxTrendChip";
import LastUpdated from "../../components/LastUpdated";

/* ---------------------------
   Data endpoints (proxies)
--------------------------- */
const INTRADAY_URL = "https://frye-market-backend-1.onrender.com/live/intraday";
const HOURLY_URL   = "https://frye-market-backend-1.onrender.com/live/hourly";
const EOD_URL      = "https://frye-market-backend-1.onrender.com/live/eod"; // change to /live/daily if needed

/* ---------------------------
   Pill definitions
--------------------------- */
// 10-minute (use whatever keys you already emit under engineLights.signals)
const R10_DEF = [
  { k: "sigOverallBull",  label: "Overall Bull",  tone: "ok"     },
  { k: "sigOverallBear",  label: "Overall Bear",  tone: "danger" },
  { k: "sigEMA10BullCross", label: "EMA10 Bull Cross", tone: "ok" },
  { k: "sigEMA10BearCross", label: "EMA10 Bear Cross", tone: "danger" },
  { k: "sigAccelUp",      label: "Accel Up",      tone: "ok"     },
  { k: "sigAccelDown",    label: "Accel Down",    tone: "danger" },
  { k: "sigRiskOn",       label: "Risk-On",       tone: "ok"     },
  { k: "sigRiskOff",      label: "Risk-Off",      tone: "danger" },
  { k: "sigSectorThrust", label: "Sector Thrust", tone: "ok"     },
  { k: "sigSectorWeak",   label: "Sector Weak",   tone: "danger" },
  { k: "sigCompression",  label: "Compression",   tone: "warn"   },
  { k: "sigExpansion",    label: "Expansion",     tone: "ok"     },
  { k: "sigOverheat",     label: "Overheat",      tone: "warn"   },
  { k: "sigTurbo",        label: "Turbo",         tone: "ok"     },
  { k: "sigDivergence",   label: "Divergence",    tone: "warn"   },
  { k: "sigLowLiquidity", label: "Low Liquidity", tone: "warn"   },
  { k: "sigVolatilityHigh", label: "Volatility High", tone: "warn" },
];

// 1-hour (Option A: four crossover pills only)
const R11_1H_DEF = [
  { k: "sigEMA1hBullCross",  label: "EMA1h Bull Cross",  tone: "ok"     },
  { k: "sigEMA1hBearCross",  label: "EMA1h Bear Cross",  tone: "danger" },
  { k: "sigSMI1hBullCross",  label: "SMI1h Bull Cross",  tone: "ok"     },
  { k: "sigSMI1hBearCross",  label: "SMI1h Bear Cross",  tone: "danger" },
];

/* ---------------------------
   Small pill component
--------------------------- */
function Pill({ active, label, tone }) {
  const map = {
    ok:     { bg: "var(--ok)",     fg: "#001b0a" },
    danger: { bg: "var(--danger)", fg: "#2b0000" },
    warn:   { bg: "var(--warn)",   fg: "#221a00" },
    info:   { bg: "var(--info)",   fg: "#001221" },
    off:    { bg: "rgba(148,163,184,0.25)", fg: "var(--text)", dim: true },
  };
  const t = active ? (map[tone] || map.ok) : map.off;
  const style = {
    background: t.bg,
    color: t.fg,
    opacity: t.dim ? 0.45 : 1,
    borderRadius: 999,
    fontSize: 12,
    padding: "4px 10px",
    lineHeight: "18px",
    whiteSpace: "nowrap",
  };
  return <span className="pill" style={style}>{label}</span>;
}

/* ---------------------------
   Engine Lights (2 rows, left-aligned)
--------------------------- */
export default function EngineLights() {
  const [j10, setJ10] = useState(null);
  const [j1h, setJ1h] = useState(null);
  const [jd,  setJd]  = useState(null);

  // Pull data
  useEffect(() => {
    let alive = true;

    const pull10 = async () => {
      try { const r = await fetch(INTRADAY_URL, { cache: "no-store" }); const j = await r.json(); if (alive) setJ10(j); } catch {}
    };
    const pull1h = async () => {
      try { const r = await fetch(HOURLY_URL,   { cache: "no-store" }); const j = await r.json(); if (alive) setJ1h(j); } catch {}
    };
    const pullD  = async () => {
      try { const r = await fetch(EOD_URL,      { cache: "no-store" }); const j = await r.json(); if (alive) setJd(j); } catch {}
    };

    pull10(); pull1h(); pullD();
    const t10 = setInterval(pull10, 60 * 1000);
    const t1h = setInterval(pull1h, 60 * 1000);
    const td  = setInterval(pullD,  10 * 60 * 1000);
    return () => { alive = false; clearInterval(t10); clearInterval(t1h); clearInterval(td); };
  }, []);

  // Extractors
  const signals10 = useMemo(() => (j10?.engineLights?.signals) || {}, [j10]);
  const signals1h = useMemo(() => (j1h?.hourly?.signals) || {}, [j1h]);

  const ts10 = j10?.updated_at_utc || j10?.engineLights?.updatedAt || j10?.updated_at || null;
  const ts1h = j1h?.updated_at_utc || j1h?.updated_at || null;
  const ts1d = jd?.updated_at_utc  || jd?.updated_at  || null;

  // Lux chips
  const lux10 = useMemo(() => {
    // If you later emit strategy.trend10m, prefer that; otherwise fall back to overall/EMA inference
    const st = j10?.strategy?.trend10m?.state || j10?.engineLights?.overall?.state || null;
    const reason = j10?.strategy?.trend10m?.reason || "";
    return { state: st, reason };
  }, [j10]);

  const lux1h = useMemo(() => {
    const t = j1h?.strategy?.trend1h;
    return { state: t?.state, reason: t?.reason };
  }, [j1h]);

  const luxEOD = useMemo(() => {
    const t = jd?.strategy?.trendEOD;
    const fallback = jd?.trendDaily?.trend; // mirror until trendEOD is standard
    return { state: (t?.state || fallback?.state), reason: (t?.reason || "") };
  }, [jd]);

  // Styles: everything left-aligned, wrap-safe, two rows only
  const header  = { display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: "100%" };
  const rowWrap = { display: "inline-flex", alignItems: "center", gap: 8,  flexWrap: "wrap", maxWidth: "100%" };

  return (
    <section id="row-3" className="panel">
      {/* Header: title, legend, then tiny timestamp chips — all LEFT aligned */}
      <div style={header}>
        <h3 className="panel-title" style={{ margin: 0 }}>Engine Lights</h3>
        <button className="btn btn-xs" title="Legend">Legend</button>
        {ts10 ? <LastUpdated label="10m" ts={ts10} tiny /> : null}
        {ts1h ? <LastUpdated label="1h" ts={ts1h} tiny /> : null}
        {ts1d ? <LastUpdated label="EOD" ts={ts1d} tiny /> : null}
      </div>

      {/* Row 1: 10m pills + Lux(10m) — LEFT aligned */}
      <div style={{ ...rowWrap, marginTop: 8 }}>
        {R10_DEF.map(def => (
          <Pill
            key={def.k}
            label={def.label}
            tone={def.tone}
            active={Boolean(signals10?.[def.k]?.active)}
          />
        ))}
        <LuxTrendChip state={lux10.state} reason={lux10.reason} label="Lux 10m" />
      </div>

      {/* Row 2: 1h (four pills) + Lux(1h) + Lux(EOD) — LEFT aligned */}
      <div style={{ ...rowWrap, marginTop: 8 }}>
        {R11_1H_DEF.map(def => (
          <Pill
            key={def.k}
            label={def.label}
            tone={def.tone}
            active={Boolean(signals1h?.[def.k]?.active)}
          />
        ))}
        <LuxTrendChip state={lux1h.state} reason={lux1h.reason} label="Lux 1h" />
        <LuxTrendChip state={luxEOD.state} reason={luxEOD.reason} label="Lux EOD" />
      </div>
    </section>
  );
}
