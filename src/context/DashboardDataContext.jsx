// src/context/DashboardDataContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDashboardPoll } from "../lib/dashboardApiSafe"; // live adapter
import { useReplay } from "../replay/ReplayContext"; // ✅ Replay Mode context

const DashboardDataContext = createContext(null);

export function DashboardDataProvider({ children }) {
  // ✅ Replay state
  const replay = useReplay();

  // ✅ Live polling (we keep it running for now; later we can pause it when replay is ON)
  const { data, loading, error, refresh, lastFetchAt } = useDashboardPoll(5000);

  // last-good fallback so UI doesn't disappear on temporary 500s
  const [lastGood, setLastGood] = useState(null);
  useEffect(() => {
    if (data) setLastGood(data);
  }, [data]);

  // ✅ Live baseline
  const liveWorking = data || lastGood || null;

  /**
   * ✅ Working dataset selection:
   * - If Replay is ON and snapshot exists -> use snapshot for Market Meter truth
   * - Otherwise -> use live
   *
   * IMPORTANT:
   * Your replay snapshot shape is different than the live dashboard shape.
   * So MVP: we ONLY override the "outlook/sectorCards/engineLights/meta" parts
   * used by Market Meter + sector cards, while leaving everything else live.
   */
  const working =
    replay?.enabled && replay?.snapshot
      ? {
          ...(liveWorking || {}),
          // Replay truth for Market Meter + sector cards lives inside snapshot.market.raw
          outlook: replay.snapshot.market?.raw || liveWorking?.outlook,
          sectorCards: replay.snapshot.market?.raw?.sectorCards || liveWorking?.sectorCards,
          engineLights: replay.snapshot.market?.raw?.engineLights || liveWorking?.engineLights,
          meta: { ...(liveWorking?.meta || {}), ts: replay.snapshot.tsUtc },
          __replay: { enabled: true, date: replay.date, time: replay.time },
        }
      : liveWorking;

  const derived = useMemo(() => {
    if (!working) return null;

    const summary = working.summary || {};
    const odometers = working.odometers || {};
    const gauges = working.gauges || {};
    const signals = working.signals || {};

    // ✅ Sector cards fallback paths
    const sectorCards = working.outlook?.sectorCards || working.sectorCards || [];

    const breadthOdometer = Number.isFinite(odometers.breadthOdometer)
      ? odometers.breadthOdometer
      : null;
    const momentumOdometer = Number.isFinite(odometers.momentumOdometer)
      ? odometers.momentumOdometer
      : null;

    const breadthIdx = Number.isFinite(summary.breadthIdx)
      ? summary.breadthIdx
      : breadthOdometer ?? 50;
    const momentumIdx = Number.isFinite(summary.momentumIdx)
      ? summary.momentumIdx
      : momentumOdometer ?? 50;

    const squeezeCompressionPct =
      Number.isFinite(gauges?.squeezeDaily?.pct)
        ? gauges.squeezeDaily.pct
        : Number.isFinite(gauges?.squeeze?.pct)
        ? gauges.squeeze.pct
        : Number.isFinite(gauges?.fuelPct)
        ? gauges.fuelPct
        : null;

    const expansionPotential =
      squeezeCompressionPct == null ? null : 100 - squeezeCompressionPct;

    let marketMeter;
    let meterNote = null;

    if (Number.isFinite(odometers.marketMeter)) {
      marketMeter = odometers.marketMeter;
    } else {
      const base =
        0.40 * breadthIdx +
        0.40 * momentumIdx +
        0.20 * (Number.isFinite(expansionPotential) ? expansionPotential : 50);

      marketMeter = base;

      if (Number.isFinite(squeezeCompressionPct) && squeezeCompressionPct >= 90) {
        marketMeter = 45 + (base - 50) * 0.30; // bias toward neutral
        meterNote = `Major Squeeze (${squeezeCompressionPct.toFixed(
          1
        )}%) — direction unknown`;
      }
    }

    marketMeter = Math.max(0, Math.min(100, Math.round(marketMeter)));

    return {
      breadthIdx: Math.round(Math.max(0, Math.min(100, breadthIdx))),
      momentumIdx: Math.round(Math.max(0, Math.min(100, momentumIdx))),
      squeezeCompressionPct: Number.isFinite(squeezeCompressionPct)
        ? Math.round(squeezeCompressionPct)
        : null,
      expansionPotential: Number.isFinite(expansionPotential)
        ? Math.round(expansionPotential)
        : null,
      marketMeter,
      meterNote,
      summary,
      odometers,
      gauges,
      signals,
      sectorCards,
      metaTs: working.meta?.ts || new Date().toISOString(),
      replay: working.__replay || { enabled: false },
    };
  }, [working]);

  return (
    <DashboardDataContext.Provider
      value={{ working, derived, loading, error, refresh, lastFetchAt }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx)
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
