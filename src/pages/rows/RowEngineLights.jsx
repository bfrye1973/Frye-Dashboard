// src/pages/rows/EngineLights.jsx
import React, { useEffect, useMemo, useState } from "react";
import LuxTrendChip from "@/components/LuxTrendChip";
import LastUpdated from "@/components/LastUpdated";

// ---- Config ----
const INTRADAY_URL = "https://frye-market-backend-1.onrender.com/live/intraday";
const HOURLY_URL   = "https://frye-market-backend-1.onrender.com/live/hourly";
const EOD_URL      = "https://frye-market-backend-1.onrender.com/live/eod"; // or /live/daily if that’s your proxy

// 10m pill definition (render whatever your existing keys are; sample kept generic)
const R10_DEF = [
  { k:"sigEMA10BullCross", label:"EMA10 Bull", tone:"ok" },
  { k:"sigEMA10BearCross", label:"EMA10 Bear", tone:"danger" },
  { k:"sigAccelUp",        label:"Accel Up",   tone:"ok" },
  { k:"sigAccelDown",      label:"Accel Down", tone:"danger" },
  { k:"sigRiskOn",         label:"Risk On",    tone:"ok" },
  { k:"sigRiskOff",        label:"Risk Off",   tone:"danger" },
  // ...add your other 10m pills as needed
];

// 1h (Option A) — four pills only
const R11_1H_DEF = [
  { k:"sigEMA1hBullCross",  label:"EMA1h Bull Cross",  tone:"ok" },
  { k:"sigEMA1hBearCross",  label:"EMA1h Bear Cross",  tone:"danger" },
  { k:"sigSMI1hBullCross",  label:"SMI1h Bull Cross",  tone:"ok" },
  { k:"sigSMI1hBearCross",  label:"SMI1h Bear Cross",  tone:"danger" },
];

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

export default function EngineLights() {
  const [j10, setJ10] = useState(null);
  const [j1h, setJ1h] = useState(null);
  const [jd,  setJd]  = useState(null);

  // --- Fetchers (simple) ---
  useEffect(() => {
    let alive = true;

    async function pull10() {
      try {
        const r = await fetch(INTRADAY_URL, { cache: "no-store" });
        const j = await r.json();
        if (alive) setJ10(j);
      } catch {}
    }
    async function pull1h() {
      try {
        const r = await fetch(HOURLY_URL, { cache: "no-store" });
        const j = await r.json();
        if (alive) setJ1h(j);
      } catch {}
    }
    async function pullEOD() {
      try {
        const r = await fetch(EOD_URL, { cache: "no-store" });
        const j = await r.json();
        if (alive) setJd(j);
      } catch {}
    }

    pull10(); pull1h(); pullEOD();
    const t10 = setInterval(pull10, 60 * 1000);
    const t1h = setInterval(pull1h, 60 * 1000);
    const td  = setInterval(pullEOD, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(t10); clearInterval(t1h); clearInterval(td); };
  }, []);

  // --- Extractors ---
  const signals10 = useMemo(() => (j10?.engineLights?.signals) || {}, [j10]);
  const sig1h     = useMemo(() => (j1h?.hourly?.signals) || {}, [j1h]);

  const ts10 = j10?.updated_at || j10?.engineLights?.updatedAt || j10?.updated_at_utc;
  const ts1h = j1h?.updated_at || j1h?.updated_at_utc;
  const ts1d = jd?.updated_at  || jd?.updated_at_utc;

  const lux10 = useMemo(() => {
    // Live 10m state: prefer strategy.trend10m if you add it later, else derive from overall if available
    const st = j10?.strategy?.trend10m?.state
            || j10?.engineLights?.overall?.state
            || null;
    const reason = j10?.strategy?.trend10m?.reason || "";
    return { state: st, reason };
  }, [j10]);

  const lux1h = useMemo(() => {
    const t = j1h?.strategy?.trend1h;
    return { state: t?.state, reason: t?.reason };
  }, [j1h]);

  const luxEOD = useMemo(() => {
    const t = jd?.strategy?.trendEOD;
    const fallback = jd?.trendDaily?.trend; // if you’re still mirroring there
    return { state: (t?.state || fallback?.state), reason: (t?.reason || "") };
  }, [jd]);

  // --- Styles: all left-aligned, wrap-safe ---
  const rowWrap = { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" };
  const header  = { display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: "100%" };

  return (
    <section id="row-3" className="panel">
      {/* Header: left-aligned only */}
      <div style={header}>
        <h3 style={{ margin: 0 }}>Engine Lights</h3>
        <button className="btn btn-xs" title="Legend">Legend</button>
        {/* tiny timestamp chips inline on the left too */}
        {ts10 ? <LastUpdated label="10m" ts={ts10} tiny /> : null}
        {ts1h ? <LastUpdated label="1h" ts={ts1h} tiny /> : null}
        {ts1d ? <LastUpdated label="EOD" ts={ts1d} tiny /> : null}
      </div>

      {/* Row 1: 10m pills + Lux(10m) — left aligned */}
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

      {/* Row 2: 1h (four pills) + Lux(1h) + Lux(EOD) — left aligned */}
      <div style={{ ...rowWrap, marginTop: 8 }}>
        {R11_1H_DEF.map(def => (
          <Pill
            key={def.k}
            label={def.label}
            tone={def.tone}
            active={Boolean(sig1h?.[def.k]?.active)}
          />
        ))}
        <LuxTrendChip state={lux1h.state} reason={lux1h.reason} label="Lux 1h" />
        <LuxTrendChip state={luxEOD.state} reason={luxEOD.reason} label="Lux EOD" />
      </div>
    </section>
  );
}
