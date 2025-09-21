import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSignals } from "../../../../api/signals"; // <- 4-dot path from /hooks to /src/api/signals.js

const POLL_MS = 30000; // 30s

export default function useStrategies() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ alignment: null, wave3: null, flag: null });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, w, f] = await Promise.all([
        fetchSignals("alignment"),
        fetchSignals("wave3"),
        fetchSignals("flag"),
      ]);
      setData({ alignment: a, wave3: w, flag: f });
      setError(null);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const counts = useMemo(() => {
    const c = {};
    ["alignment", "wave3", "flag"].forEach((k) => {
      const items = data[k]?.items || [];
      c[k] = {
        total: items.length,
        triggered: items.filter((x) => x.status === "Triggered").length,
        ondeck: items.filter((x) => x.status === "OnDeck").length,
      };
    });
    return c;
  }, [data]);

  return { loading, error, data, counts, reload: load };
}
