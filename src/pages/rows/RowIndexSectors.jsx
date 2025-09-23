// src/pages/rows/RowIndexSectors.jsx
// Compact Index Sectors row:
// - AZ timestamp LEFT of Legend
// - Tiny timeframe tabs (10m / 1h / EOD) on RIGHT
// - Tiny Δ Momentum / Δ Breadth pills
// - Cards: Momentum bar, Breadth Tilt bar, Net NH, Bullish/Bearish chip
// - No section size change

import React, { useEffect, useMemo, useRef, useState } from "react";

const URLS = {
  "10m":
    process.env.REACT_APP_INTRADAY_URL ||
    "https://frye-market-backend-1.onrender.com/live/intraday",
  "1h":
    process.env.REACT_APP_HOURLY_URL ||
    "https://frye-market-backend-1.onrender.com/live/hourly",
  eod:
    process.env.REACT_APP_EOD_URL ||
    "https://frye-market-backend-1.onrender.com/live/eod",
};

const TF_OPTIONS = [
  { key: "10m", label: "10m" },
  { key: "1h", label: "1h" },
  { key: "eod", label: "EOD" },
];

/* ---------- tiny UI elements (won't change row height) ---------- */
function TinyTab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded border text-[10px] leading-none
        ${
          active
            ? "bg-slate-700 border-slate-500 text-white"
            : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
        }`}
    >
      {label}
    </button>
  );
}

function Pill({ value, label }) {
  if (value == null) return null;
  const v = Number(value);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v).toFixed(1);
  const color =
    v > 0
      ? "text-emerald-400"
      : v < 0
      ? "text-rose-400"
      : "text-slate-300";
  return (
    <span
      className={`px-1.5 py-0.5 rounded-full bg-slate-800/60 border border-slate-700 ${color} text-[10px] leading-none`}
    >
      {label}: {sign}
      {abs}
    </span>
  );
}

function toneFor(outlook) {
  const s = String(outlook || "").toLowerCase();
  if (s.startsWith("bull")) return "bull";
  if (s.startsWith("bear")) return "bear";
  return "neu";
}

/* ---------- sector card (compact) ---------- */
function SectorCard({ c }) {
  const momentum = Number(c.momentum_pct ?? 50);
  const breadth = Number(c.breadth_pct ?? 50);
  const nh = Number(c.nh ?? 0);
  const nl = Number(c.nl ?? 0);
  const netNH = nh - nl;
  const tone = toneFor(c.outlook);

  const chip =
    tone === "bull"
      ? "bg-emerald-600/20 text-emerald-300"
      : tone === "bear"
      ? "bg-rose-600/20 text-rose-300"
      : "bg-slate-700/30 text-slate-300";

  const Bar = ({ pct, title }) => (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-slate-300/80 mb-0.5">
        <span>{title}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded">
        <div
          className={`h-full rounded ${
            title === "Momentum" ? "bg-emerald-500/80" : "bg-sky-400/80"
          }`}
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-w-[220px] max-w-[240px] rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-white/90">{c.sector}</div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${chip}`}>
          {c.outlook || "Neutral"}
        </span>
      </div>

      <div className="space-y-2">
        <Bar pct={momentum} title="Momentum" />
        <Bar pct={breadth} title="Breadth Tilt" />
        <div className="text-[11px] text-slate-300/80 mt-1">
          Net NH:{" "}
          <span
            className={
              netNH > 0
                ? "text-emerald-300"
                : netNH < 0
                ? "text-rose-300"
                : "text-slate-300"
            }
          >
            {netNH}
          </span>
        </div>
    </div>
    </div>
  );
}

/* ---------- main row ---------- */
export default function RowIndexSectors() {
  const [tf, setTf] = useState("10m");
  const [data, setData] = useState(null);
  const prevRef = useRef(null);

  const url = URLS[tf];

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!alive) return;
        prevRef.current = data;
        setData(json);
      } catch (e) {
        console.error("IndexSectors fetch error:", e);
      }
    }

    load();
    const t = tf === "eod" ? null : setInterval(load, 60_000);
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [url]);

  // AZ timestamp (backend now emits sectorsUpdatedAt or updated_at in AZ)
  const updatedAtAZ = useMemo(
    () => data?.sectorsUpdatedAt || data?.updated_at || "",
    [data]
  );

  // cards + summary
  const cards = data?.sectorCards || [];
  const summary = data?.summary || {};
  const prevSummary = prevRef.current?.summary || null;

  // tiny Δ pills from prior fetch
  const deltas = useMemo(() => {
    if (!prevSummary) return { momentum: null, breadth: null };
    return {
      momentum:
        (summary.momentum_pct ?? 0) - (prevSummary.momentum_pct ?? 0),
      breadth:
        (summary.breadth_pct ?? 0) - (prevSummary.breadth_pct ?? 0),
    };
  }, [summary, prevSummary]);

  return (
    <section className="px-4 py-3">
      {/* header — compact; no height change */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-white/90 font-medium text-sm">Index Sectors</div>
          <button
            className="text-slate-300/80 text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:border-slate-500"
            title="Legend"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("sectors:legend", { detail: { open: true } })
              )
            }
          >
            Legend
          </button>
          {/* Timestamp on LEFT next to Legend (AZ time) */}
          <div className="text-slate-300/80 text-[11px]">
            Updated {updatedAtAZ}
          </div>
        </div>

        {/* Right controls (tiny) */}
        <div className="flex items-center gap-1">
          <Pill value={deltas.momentum} label="Δ Momentum" />
          <Pill value={deltas.breadth} label="Δ Breadth" />
          <div className="flex gap-1">
            {TF_OPTIONS.map((opt) => (
              <TinyTab
                key={opt.key}
                active={tf === opt.key}
                onClick={() => setTf(opt.key)}
                label={opt.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* cards grid — same spacing as before */}
      <div className="flex flex-wrap gap-2">
        {cards.map((c, i) => (
          <SectorCard key={c.sector || i} c={c} {...c} />
        ))}
      </div>
    </section>
  );
}
