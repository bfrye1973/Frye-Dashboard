// src/lib/dashboardApi.js
import { useEffect, useRef, useState } from "react";

const API = "https://frye-market-backend-1.onrender.com"; // single source of truth

/* -------- helpers -------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctTo1000 = (pct) => {
  // backend sends 0..100; UI gauges expect -1000..+1000
  const p = Number.isFinite(pct) ? clamp(pct, 0, 100) : 50;
  return Math.round((p - 50) * 20); // 0->-1000, 50->0, 100->+1000
};

function transformToUi(d) {
  // Defensive reads with defaults
  const g = d?.gauges || {};
  const rpmPct    = g.rpm?.pct;
  const spdPct    = g.speed?.pct;
  const fuelPct   = g.fuel?.pct ?? g.squeeze?.pct ?? null;
  const waterDegF = g.water?.degF ?? g.waterTemp ?? null;
  const oilPsi    = g.oil?.psi ?? g.oilPsi ?? null;

  // Prefer the summarized 0..100 indices if present
  const breadthIdx  = d?.summary?.breadthIdx ?? d?.breadthIdx ?? null;
  const momentumIdx = d?.summary?.momentumIdx ?? d?.momentumIdx ?? null;

  // Odometer fallbacks if summary is missing
  const breadthFallback  =
    Number.isFinite(breadthIdx) ? breadthIdx :
    Number.isFinite(rpmPct)     ? rpmPct     : 50;

  const momentumFallback =
    Number.isFinite(momentumIdx) ? momentumIdx :
    Number.isFinite(spdPct)      ? spdPct      : 50;

  // Squeeze label: derive from fuel/squeeze psi if backend doesn't provide a string
  let squeeze = "none";
  const squeezePct = Number.isFinite(fuelPct) ? fuelPct : d?.odometers?.squeeze_pct;
  if (Number.isFinite(squeezePct)) {
    if (squeezePct >= 70) squeeze = "on";
    else if (squeezePct >= 45) squeeze = "building";
    else squeeze = "off";
  }
  // If backend gave a textual state, prefer it
  if (typeof g.fuel?.state === "string" && g.fuel.state) {
    squeeze = g.fuel.state.toLowerCase().replace(/\s+/g, "");
  }

  return {
    gauges: {
      rpm:   pctTo1000(rpmPct),
      speed: pctTo1000(spdPct),
      fuelPct: Number.isFinite(fuelPct) ? clamp(fuelPct, 0, 100) : null,
      waterTemp: Number.isFinite(waterDegF) ? waterDegF : null,
      oilPsi: Number.isFinite(oilPsi) ? oilPsi : null,
    },
    odometers: {
      breadthOdometer: Math.round(clamp(breadthFallback, 0, 100)),
      momentumOdometer: Math.round(clamp(momentumFallback, 0, 100)),
      squeeze,
    },
    // pass through signals (if present) and outlook sector cards
    signals: d?.signals ?? {},
    outlook: {
      dailyOutlook: Math.round(
        clamp(
          ( (Number.isFinite(breadthIdx) ? breadthIdx : breadthFallback) +
            (Number.isFinite(momentumIdx) ? momentumIdx : momentumFallback)
          ) / 2,
          0, 100
        )
      ),
      sectorCards: d?.sectorCards ?? d?.outlook?.sectorCards ?? [],
    },
    meta: {
      ts: d?.ts ?? d?.updated_at ?? new Date().toISOString(),
    },
  };
}

/* -------- API -------- */
export async function fetchDashboard() {
  try {
    const r = await fetch(`${API}/api/dashboard`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    return transformToUi(raw);
  } catch (e) {
    console.error("fetchDashboard failed:", e);
    // Safe empty so UI renders skeleton instead of crashing
    return {
      gauges: { rpm: 0, speed: 0, fuelPct: null, waterTemp: null, oilPsi: null },
      odometers: { breadthOdometer: 50, momentumOdometer: 50, squeeze: "none" },
      signals: {},
      outlook: { dailyOutlook: 50, sectorCards: [] },
      meta: { ts: new Date().toISOString() },
    };
  }
}

/* -------- polling hook -------- */
export function useDashboardPoll(intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const timerRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchDashboard();
      setData(d);
      setLastFetchAt(Date.now());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // initial
    timerRef.current = setInterval(load, intervalMs);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, loading, error, refresh: load, lastFetchAt };
}
