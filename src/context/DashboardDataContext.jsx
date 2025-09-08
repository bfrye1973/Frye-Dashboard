// src/context/DashboardDataContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDashboardPoll } from "../lib/dashboardApi"; // your adapter (reads squeezeDaily, meter, etc.)

const DashboardDataContext = createContext(null);

export function DashboardDataProvider({ children }) {
  const { data, loading, error, refresh, lastFetchAt } = useDashboardPoll(5000);

  // last-good fallback so UI doesn't disappear on temporary 500s
  const [lastGood, setLastGood] = useState(null);
  useEffect(() => { if (data) setLastGood(data); }, [data]);

  const working = data || lastGood || null;

  const derived = useMemo(() => {
    if (!working) return null;

    const summary   = working.summary   || {};
    const odometers = working.odometers || {};
    const gauges    = working.gauges    || {};
    const signals   = working.signals   || {};
    const sectorCards = working.outlook?.sectorCards || working.sectorCards || [];

    const breadthOdometer  = Number.isFinite(odometers.breadthOdometer)  ? odometers.breadthOdometer  : null;
    const momentumOdometer = Number.isFinite(odometers.momentumOdometer) ? odometers.momentumOdometer : null;

    const breadthIdx  = Number.isFinite(summary.breadthIdx)  ? summary.breadthIdx  : breadthOdometer  ?? 50;
    const momentumIdx = Number.isFinite(summary.momentumIdx) ? summary.momentumIdx : momentumOdometer ?? 50;

    const squeezeCompressionPct =
      Number.isFinite(gauges?.squeezeDaily?.pct) ? gauges.squeezeDaily.pct :
      Number.isFinite(gauges?.squeeze?.pct)      ? gauges.squeeze.pct :
      Number.isFinite(gauges?.fuelPct)           ? gauges.fuelPct :
      null;

    const expansionPotential = squeezeCompressionPct == null ? null : (100 - squeezeCompressionPct);

    let marketMeter;
    let meterNote = null;

    if (Number.isFinite(odometers.marketMeter)) {
      marketMeter = odometers.marketMeter;
    } else {
      const base = (0.40 * breadthIdx) + (0.40 * momentumIdx) + (0.20 * (Number.isFinite(expansionPotential) ? expansionPotential : 50));
      marketMeter = base;
      if (Number.isFinite(squeezeCompressionPct) && squeezeCompressionPct >= 90) {
        marketMeter = 45 + (base - 50) * 0.30; // bias toward neutral
        meterNote = `Major Squeeze (${squeezeCompressionPct.toFixed(1)}%) — direction unknown`;
      }
    }
    marketMeter = Math.max(0, Math.min(100, Math.round(marketMeter)));

    return {
      breadthIdx: Math.round(Math.max(0, Math.min(100, breadthIdx))),
      momentumIdx: Math.round(Math.max(0, Math.min(100, momentumIdx))),
      squeezeCompressionPct: Number.isFinite(squeezeCompressionPct) ? Math.round(squeezeCompressionPct) : null,
      expansionPotential: Number.isFinite(expansionPotential) ? Math.round(expansionPotential) : null,
      marketMeter,
      meterNote,
      summary,
      odometers,
      gauges,
      signals,
      sectorCards,
      metaTs: working.meta?.ts || new Date().toISOString(),
    };
  }, [working]);

  return (
    <DashboardDataContext.Provider value={{ working, derived, loading, error, refresh, lastFetchAt }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
