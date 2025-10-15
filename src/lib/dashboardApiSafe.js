// src/lib/dashboardApiSafe.js
import { useEffect, useRef, useState } from "react";

const NEUTRAL = {
  gauges: { rpm: 0, speed: 0, fuelPct: null, waterTemp: null, oilPsi: null, volatilityPct: null, squeezeDaily: null },
  odometers: {
    breadthOdometer: 50, momentumOdometer: 50,
    squeezeCompressionPct: null, expansionPotential: null,
    marketMeter: 50, meterNote: null,
  },
  outlook: { dailyOutlook: 50, sectorCards: [] },
  signals: {}, meta: { ts: new Date().toISOString() },
};

export function useDashboardPoll(intervalMs = "dynamic") {
  const [data, setData] = useState(NEUTRAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(Date.now());
  const pollTimerRef = useRef(null);

  useEffect(() => {
    // no-op poller; keeps API disabled and UI stable
    pollTimerRef.current = setInterval(() => setLastFetchAt(Date.now()), 60000);
    return () => clearInterval(pollTimerRef.current);
  }, []);

  return { data, loading, error, refresh: () => {}, lastFetchAt };
}

export default useDashboardPoll;
