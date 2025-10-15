// src/lib/dashboardApi.js
import { useEffect, useRef, useState } from "react";

// FINAL CANONICAL BACKEND (the working one)
const API = "https://frye-market-backend-1.onrender.com";

/* ----------------------- utils ----------------------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctTo1000 = (pct) => Math.round((clamp(pct ?? 50, 0, 100) - 50) * 20); // -> -1000..+1000

export function getTone(x) {
  if (x == null || Number.isNaN(x)) return "info";
  if (x <= 39) return "danger";
  if (x <= 59) return "warn";
  return "ok";
}

/* --------------------- cadence ----------------------- */
export function getPollMs() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  const hh = parseInt(parts.hour, 10);
  const mm = parseInt(parts.minute, 10);
  const wd = parts.weekday; // Mon..Sun

  const inWeek = ["Mon","Tue","Wed","Thu","Fri"].includes(wd);
  const minutes = hh * 60 + mm;

  const preStart = 8*60;      // 08:00
  const open     = 9*60 + 30; // 09:30
  const close    = 16*60;     // 16:00
  const postEnd  = 18*60;     // 18:00

  if (!inWeek) return 120000;                        // weekends
  if (minutes >= open && minutes <= close) return 15000;   // RTH
  if (minutes >= preStart && minutes <= postEnd) return 30000; // pre/post
  return 120000; // overnight
}

/* -------------------- transform ---------------------- */
function transformToUi(raw) {
  const g = raw?.gauges || {};
  const rpmPct = g.rpm?.pct;
  const spdPct = g.speed?.pct;

  // prefer explicit daily squeeze; fallback to other fields
  const squeezeDailyPct =
    raw?.summary?.squeezePctDaily ??
    g.squeezeDaily?.pct ??
    g.squeeze?.pct ??
    g.fuel?.pct ??
    null;

  const compressionPct = Number.isFinite(squeezeDailyPct)
    ? clamp(squeezeDailyPct, 0, 100)
    : null;

  const expansionPotential = compressionPct == null ? null : 100 - compressionPct;

  const breadthIdx =
    raw?.summary?.breadthIdx ??
    raw?.breadthIdx ??
    (Number.isFinite(rpmPct) ? rpmPct : 50);

  const momentumIdx =
    raw?.summary?.momentumIdx ??
    raw?.momentumIdx ??
    (Number.isFinite(spdPct) ? spdPct : 50);

  // Market Meter (with daily squeeze blend)
  const base =
    0.40 * breadthIdx +
    0.40 * momentumIdx +
    0.20 * (expansionPotential ?? 50);

  const Sdy = Number.isFinite(squeezeDailyPct) ? (clamp(squeezeDailyPct, 0, 100) / 100) : 0;
  const overall = (1 - Sdy) * base + Sdy * 50;

  return {
    gauges: {
      rpm:   pctTo1000(rpmPct),
      speed: pctTo1000(spdPct),
      fuelPct: compressionPct,
      waterTemp: g.water?.degF ?? null,
      oilPsi: g.oil?.psi ?? null,
      volatilityPct: g.volatilityPct ?? g.water?.pct ?? null,
      squeezeDaily: g.squeezeDaily ?? null,
    },
    odometers: {
      breadthOdometer: Math.round(clamp(breadthIdx, 0, 100)),
      momentumOdometer: Math.round(clamp(momentumIdx, 0, 100)),
      squeezeCompressionPct: compressionPct,
      expansionPotential: expansionPotential == null ? null : Math.round(expansionPotential),
      marketMeter: Math.round(clamp(overall, 0, 100)),
      meterNote: null,
    },
    outlook: {
      dailyOutlook: Math.round(clamp((breadthIdx + momentumIdx) / 2, 0, 100)),
      sectorCards: raw?.sectorCards ?? raw?.outlook?.sectorCards ?? [],
    },
    signals: raw?.signals ?? {},
    meta: { ts: raw?.ts ?? raw?.updated_at ?? new Date().toISOString() },
  };
}

/* ------------------- fetch / poll -------------------- */
export async function fetchDashboard() {
  try {
    const r = await fetch(`${API}/api/dashboard`, { cache: "no-store" });
    if (!r.ok) return transformToUi({});
    const raw = await r.json();
    return transformToUi(raw);
  } catch (e) {
    console.error("fetchDashboard failed:", e);
    return {
      gauges: { rpm: 0, speed: 0, fuelPct: null, waterTemp: null, oilPsi: null, volatilityPct: null, squeezeDaily: null },
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

/**
 * useDashboardPoll(intervalMs = "dynamic")
 */
export function useDashboardPoll(intervalMs = "dynamic") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);

  const pollTimerRef = useRef(null);
  const cadenceTimerRef = useRef(null);
  const currentIntervalRef = useRef(
    intervalMs === "dynamic" ? getPollMs() : Number(intervalMs)
  );

  const clearTimers = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (cadenceTimerRef.current) clearInterval(cadenceTimerRef.current);
    pollTimerRef.current = null;
    cadenceTimerRef.current = null;
  };

  const startPolling = (ms) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(load, ms);
    currentIntervalRef.current = ms;
  };

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchDashboard();
      setData(d); setLastFetchAt(Date.now());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    if (intervalMs === "dynamic") {
      startPolling(currentIntervalRef.current);
      cadenceTimerRef.current = setInterval(() => {
        const next = getPollMs();
        if (next !== currentIntervalRef.current) startPolling(next);
      }, 60000);
    } else {
      startPolling(Number(intervalMs));
    }

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, loading, error, refresh: load, lastFetchAt };
}
