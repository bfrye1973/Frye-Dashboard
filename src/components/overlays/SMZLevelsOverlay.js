import { useEffect } from "react";

export default function SMZLevelsOverlay({ chart, symbol = "SPY" }) {
  useEffect(() => {
    if (!chart) return;

    let lines = [];
    let boxes = [];
    let cancelled = false;

    const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

    const addLine = (opts) => {
      try {
        const line = chart.addHorizontalLine(opts);
        lines.push(line);
      } catch (e) {
        // ignore chart API failures
      }
    };

    const addBox = (opts) => {
      try {
        const box = chart.addBox(opts);
        boxes.push(box);
      } catch (e) {
        // ignore chart API failures
      }
    };

    async function loadLevels() {
      try {
        // cache buster ensures you see fresh output every refresh
        const url = `/api/v1/smz-levels?symbol=${encodeURIComponent(symbol)}&_=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (cancelled) return;

        const levels = Array.isArray(json?.levels) ? json.levels : [];

        for (const level of levels) {
          const tier = level?.tier ?? "micro";
          const strength = safeNum(level?.strength) ?? 0;

          // Backend contract: priceRange = [high, low]
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          const high = pr ? safeNum(pr[0]) : null;
          const low = pr ? safeNum(pr[1]) : null;

          const facts = level?.details?.facts ?? {};
          const negotiationMid = safeNum(facts?.negotiationMid);

          // ---------- STYLE BY TIER ----------
          // STRUCTURE: yellow band
          // POCKET: blue band
          // MICRO: orange dashed line at midpoint
          let bandColor = "rgba(255, 210, 0, 1)";
          let borderColor = "rgba(255, 210, 0, 1)";
          let bandOpacity = strength >= 90 ? 0.18 : 0.14;

          if (tier === "pocket") {
            bandColor = "rgba(80, 170, 255, 1)";
            borderColor = "rgba(80, 170, 255, 1)";
            bandOpacity = 0.28;
          }

          // ---------- DRAW BANDS (structure/pocket) ----------
          const isBand = tier === "structure" || tier === "pocket";
          if (isBand && high != null && low != null && high > low) {
            addBox({
              top: high,
              bottom: low,
              color: bandColor,
              opacity: bandOpacity,
              borderColor,
            });
          }

          // ---------- DRAW MICRO LINE ----------
          if (tier === "micro") {
            let y = safeNum(level?.price);
            if (y == null && high != null && low != null) y = (high + low) / 2;

            if (y != null) {
              addLine({
                price: y,
                color: "rgba(255, 165, 0, 1)", // orange
                lineWidth: 2,
                lineStyle: 2, // dashed
              });
            }
          }

          // ---------- DRAW NEGOTIATION MIDLINE (pink dashed) ----------
          // Primary goal: pocket zones have negotiationMid, draw it prominently.
          if (negotiationMid != null) {
            addLine({
              price: negotiationMid,
              color: "rgba(255, 55, 200, 1)", // pink
              lineWidth: tier === "pocket" ? 3 : 2,
              lineStyle: 2, // dashed
            });
          }
        }
      } catch (err) {
        // Overlay should never crash the chart
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
