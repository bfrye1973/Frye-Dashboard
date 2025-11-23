import { useEffect } from "react";

/**
 * Smart Money Accumulation / Distribution single-price levels overlay.
 *
 * Reads from /data/smz-levels.json and draws:
 *  - dashed horizontal lines for single "price" levels
 *  - soft filled bands for "priceRange" levels
 *
 * This assumes the RowChart `chart` object exposes helper methods
 * like addHorizontalLine / removeHorizontalLine / addBox / removeBox,
 * same pattern as your other overlays.
 */
export default function SMZLevelsOverlay({
  chart,
  lineColorAcc = "#00ff55",
  lineColorDist = "#ff3355"
}) {
  useEffect(() => {
    if (!chart) return;

    let lines = [];
    let boxes = [];

    async function loadLevels() {
      try {
        const res = await fetch("/data/smz-levels.json");
        if (!res.ok) return;
        const json = await res.json();

        if (!json.levels || !Array.isArray(json.levels)) return;

        json.levels.forEach((level) => {
          const color =
            level.type === "accumulation" ? lineColorAcc : lineColorDist;

          // 1) Single price level → horizontal line
          if (typeof level.price === "number") {
            if (typeof chart.addHorizontalLine === "function") {
              const line = chart.addHorizontalLine({
                price: level.price,
                color,
                lineWidth: 2,
                lineStyle: 2 // dashed
              });
              lines.push(line);
            }
          }

          // 2) Price band → filled box between [low, high]
          if (
            Array.isArray(level.priceRange) &&
            level.priceRange.length === 2
          ) {
            const [high, low] = level.priceRange;

            if (typeof chart.addBox === "function") {
              const box = chart.addBox({
                top: high,
                bottom: low,
                color,
                opacity: 0.18,
                borderColor: color
              });
              boxes.push(box);
            }
          }
        });
      } catch (err) {
        console.error("SMZLevelsOverlay: failed to load smz-levels.json", err);
      }
    }

    loadLevels();

    // Cleanup when overlay unmounts or chart changes
    return () => {
      if (typeof chart.removeHorizontalLine === "function") {
        lines.forEach((l) => chart.removeHorizontalLine(l));
      }
      if (typeof chart.removeBox === "function") {
        boxes.forEach((b) => chart.removeBox(b));
      }
    };
  }, [chart, lineColorAcc, lineColorDist]);

  return null;
}
