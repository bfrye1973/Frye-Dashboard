// src/lib/dashboardApi.js
import { useEffect, useRef, useState } from "react";

const API = "https://frye-market-backend-1.onrender.com";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctTo1000 = (pct) => Math.round((clamp(pct ?? 50, 0, 100) - 50) * 20); // -> -1000..+1000

// map 0..100 to tone
export function getTone(x) {
  if (x == null || Number.isNaN(x)) return "info";
  if (x <= 39) return "danger";
  if (x <= 59) return "warn";
  return "ok";
}

function transformToUi(raw) {
  const g = raw?.gauges || {};
  const rpmPct    = g.rpm?.pct;
  const spdPct    = g.speed?.pct;

  // DAILY SQUEEZE (Compression %) — prefer explicit daily field, else generic
  const squeezeDailyPct =
    raw?.summary?.squeezePctDaily ??
    g.squeezeDaily?.pct ??
    g.squeeze?.pct ??
    g.fuel?.pct ??
    null;

  const compressionPct = Number.isFinite(squeezeDailyPct)
    ? clamp(squeezeDailyPct, 0, 100)
    : null;

  const expansionPotential = compressionPct == null ? null : (100 - compressionPct);

  const breadthIdx =
    raw?.summary?.breadthIdx ??
    raw?.breadthIdx ??
    (Number.isFinite(rpmPct) ? rpmPct : 50);

  const momentumIdx =
    raw?.summary?.momentumIdx ??
    raw?.momentumIdx ??
    (Number.isFinite(spdPct) ? spdPct : 50);

  // Market Meter (with major-squeeze gating)
  const base =
    0.40 * breadthIdx +
    0.40 * momentumIdx +
    0.20 * (expansionPotential ?? 50);

  let marketMeter = base;
  let meterNote = null;
  if (compressionPct != null && compressionPct >= 90) {
    marketMeter = 45 + (base - 50) * 0.30;  // pull toward neutral
    meterNote = `Major Squeeze (${compressionPct.toFixed(1)}%) — direction unknown`;
  }

  return {
    gauges: {
      rpm:   pctTo1000(rpmPct),
      speed: pctTo1000(spdPct),
      fuelPct: compressionPct,               // keep tile as "Squeeze (Compression)"
      waterTemp: g.water?.degF ?? null,
      oilPsi: g.oil?.psi ?? null,
    },
    odometers: {
      breadthOdometer: Math.round(clamp(breadthIdx, 0, 100)),
      momentumOdometer: Math.round(clamp(momentumIdx, 0, 100)),
      squeezeCompressionPct: compressionPct, // 0..100 (higher = tighter)
      expansionPotential: expansionPotential == null ? null : Math.round(expansionPotential),
      marketMeter: Math.round(clamp(marketMeter, 0, 100)),
      meterNote,
    },
    outlook: {
      dailyOutlook: Math.round(
        clamp((breadthIdx + momentumIdx) / 2, 0, 100)
      ),
      sectorCards: raw?.sectorCards ?? raw?.outlook?.sectorCards ?? [],
    },
    signals: raw?.signals ?? {},
    meta: { ts: raw?.ts ?? raw?.updated_at ?? new Date().toISOString() },
  };
}

export async function fetchDashboard() {
  try {
    const r = await fetch(`${API}/api/dashboard`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    return transformToUi(raw);
  } catch (e) {
    console.error("fetchDashboard failed:", e);
    return {
      gauges: { rpm: 0, speed: 0, fuelPct: null, waterTemp: null, oilPsi: null },
      odometers: {
        breadthOdometer: 50,
        momentumOdometer: 50,
        squeezeCompressionPct: null,
        expansionPotential: null,
        marketMeter: 50,
        meterNote: null,
      },
      outlook: { dailyOutlook: 50, sectorCards: [] },
      signals: {},
      meta: { ts: new Date().toISOString() },
    };
  }
}

// polling hook unchanged
export function useDashboardPoll(intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const timerRef = useRef(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchDashboard();
      setData(d); setLastFetchAt(Date.now());
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, intervalMs);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, loading, error, refresh: load, lastFetchAt };
}
