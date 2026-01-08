import { useEffect } from "react";

export default function SMZLevelsOverlay({ chart }) {
  useEffect(() => {
    if (!chart) return;

    let lines = [];
    let boxes = [];

    async function loadLevels() {
      try {
        const res = await fetch("/data/smz-levels.json", { cache: "no-store" });
        const json = await res.json();

        const levels = Array.isArray(json?.levels) ? json.levels : [];

        for (const level of levels) {
          const tier = level?.tier ?? "micro";

          // Backend contract: priceRange is [high, low]
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          const high = pr ? Number(pr[0]) : null;
          const low = pr ? Number(pr[1]) : null;

          const strength = Number(level?.strength ?? 0);
          const facts = level?.details?.facts ?? {};
          const negotiationMid = Number.isFinite(facts?.negotiationMid) ? Number(facts.negotiationMid) : null;

          // ---------- STYLE BY TIER ----------
          // You can tweak these visually later without touching backend logic.
          let bandColor = "rgba(255, 210, 0, 1)"; // default yellow
          let bandOpacity = 0.14;
          let borderColor = "rgba(255, 210, 0, 1)";

          let midlineColor = "rgba(255, 55, 200, 1)"; // pink
          let midlineStyle = 2; // dashed

          // POCKET: blue box + pink midline
          if (tier === "pocket") {
            bandColor = "rgba(80, 170, 255, 1)";
            borderColor = "rgba(80, 170, 255, 1)";
            bandOpacity = 0.22;
          }

          // STRUCTURE: yellow band (slightly stronger if >=90)
          if (tier === "structure") {
            bandColor = "rgba(255, 210, 0, 1)";
            borderColor = "rgba(255, 210, 0, 1)";
            bandOpacity = strength >= 90 ? 0.18 : 0.14;
          }

          // MICRO: no band, just a dashed orange line at zone midpoint
          const isMicro = tier === "micro";

          // ---------- DRAW ----------
          // Draw band for structure/pocket
          if (!isMicro && Number.isFinite(high) && Number.isFinite(low) && high > low) {
            const box = chart.addBox({
              top: high,
              bottom: low,
              color: bandColor,
              opacity: bandOpacity,
              borderColor,
            });
            boxes.push(box);
          }

          // Draw micro line (midpoint of range or price)
          if (isMicro) {
            let y = null;
            if (Number.isFinite(level?.price)) y = Number(level.price);
            else if (Number.isFinite(high) && Number.isFinite(low)) y = (high + low) / 2;

            if (Number.isFinite(y)) {
              const line = chart.addHorizontalLine({
                price: y,
                color: "rgba(255, 165, 0, 1)", // orange
                lineWidth: 2,
                lineStyle: 2, // dashed
              });
              lines.push(line);
            }
          }

          // Draw negotiation midline when available (main goal)
          if (Number.isFinite(negotiationMid)) {
            const midLine = chart.addHorizontalLine({
              price: negotiationMid,
              color: midlineColor,
              lineWidth: tier === "pocket" ? 3 : 2,
              lineStyle: midlineStyle,
            });
            lines.push(midLine);
          }
        }
      } catch (err) {
        // Fail silently (overlay should never crash chart)
        console.error("[SMZLevelsOverlay] Failed to load SMZ levels:", err);
      }
    }

    loadLevels();

    return () => {
      lines.forEach((l) => chart.removeHorizontalLine(l));
      boxes.forEach((b) => chart.removeBox(b));
    };
  }, [chart]);

  return null;
}
