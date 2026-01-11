import { useEffect } from "react";

export default function SMZLevelsOverlay({ chart, symbol = "SPY" }) {
  useEffect(() => {
    if (!chart) return;

    let lines = [];
    let boxes = [];
    let cancelled = false;

    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const addLine = (opts) => {
      try {
        const line = chart.addHorizontalLine(opts);
        lines.push(line);
      } catch {}
    };

    const addBox = (opts) => {
      try {
        const box = chart.addBox(opts);
        boxes.push(box);
      } catch {}
    };

    async function loadLevels() {
      try {
        const url = `/api/v1/smz-levels?symbol=${encodeURIComponent(symbol)}&_=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const levels = Array.isArray(json?.levels) ? json.levels : [];

        // ✅ TradingView-style draw order
        const structures = levels.filter((l) => (l?.tier ?? "micro") === "structure");
        const pockets = levels.filter((l) => (l?.tier ?? "micro") === "pocket");

        // ---- STRUCTURE (yellow faint) ----
        for (const level of structures) {
          const strength = safeNum(level?.strength) ?? 0;

          // backend: priceRange = [high, low]
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          let high = pr ? safeNum(pr[0]) : null;
          let low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) continue;

          // Slight visual pad to remove hairline gaps (visual only)
          const pad = 0.15;
          high = high + pad;
          low = low - pad;

          // Very faint — structure is background context
          const opacity = strength >= 90 ? 0.12 : 0.08;

          addBox({
            top: high,
            bottom: low,
            fillColor: "rgba(255, 210, 0, 1)",
            color: "rgba(255, 210, 0, 1)",
            opacity,
            borderColor: "rgba(255, 210, 0, 1)",
            borderWidth: 1,
          });
        }

        // ---- POCKET (blue bold) + MIDLINE (pink dashed) ----
        for (const level of pockets) {
          // backend: priceRange = [high, low]
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          const high = pr ? safeNum(pr[0]) : null;
          const low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) continue;

          addBox({
            top: high,
            bottom: low,
            fillColor: "rgba(80, 170, 255, 1)",
            color: "rgba(80, 170, 255, 1)",
            opacity: 0.55,
            borderColor: "rgba(80, 170, 255, 1)",
            borderWidth: 2,
          });

          const facts = level?.details?.facts ?? {};
          const negotiationMid = safeNum(facts?.negotiationMid);
          if (negotiationMid != null) {
            addLine({
              price: negotiationMid,
              color: "rgba(255, 55, 200, 1)",
              lineWidth: 4,
              lineStyle: 2, // dashed
            });
          }
        }

        // ❌ MICRO: DO NOTHING (no lines, no boxes) — locked
      } catch (err) {
        console.error("[SMZLevelsOverlay] Failed to load SMZ levels:", err);
      }
    }

    loadLevels();

    return () => {
      cancelled = true;
      try {
        lines.forEach((l) => chart.removeHorizontalLine(l));
      } catch {}
      try {
        boxes.forEach((b) => chart.removeBox(b));
      } catch {}
      lines = [];
      boxes = [];
    };
  }, [chart, symbol]);

  return null;
}
