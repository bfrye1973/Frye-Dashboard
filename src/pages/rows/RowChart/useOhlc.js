import { useCallback, useEffect, useState } from "react";
import { fetchOHLCResilient } from "lib/ohlcClient"; // or "../../lib/ohlcClient" if you don't use aliases

let printedOnce = false; // dev-only breadcrumb

export default function useOhlc({ apiBase, symbol, timeframe, limit = 500 }) {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const { source, bars } = await fetchOHLCResilient({ symbol, timeframe, limit });
      setBars(bars);
      if (!printedOnce) {
        printedOnce = true;
        // eslint-disable-next-line no-console
        console.debug("[OHLC] src:", source, "bars:", bars.length, "first:", bars[0], "last:", bars.at?.(-1));
      }
      if (!bars.length) setError("empty");
      return { ok: true, count: bars.length, source };
    } catch (e) {
      const msg = e?.message || "fetch failed";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => { void refetch(true); }, [refetch]);

  return { bars, loading, error, refetch };
}
