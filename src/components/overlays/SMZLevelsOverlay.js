import { useEffect } from "react";

export default function SMZLevelsOverlay({ chart, lineColorAcc = "#00ff55", lineColorDist = "#ff3355" }) {
  useEffect(() => {
    if (!chart) return;

    let lines = [];
    let boxes = [];

    async function loadLevels() {
      const res = await fetch("/data/smz-levels.json");
      const json = await res.json();

      json.levels.forEach(level => {
        const color = level.type === "accumulation" ? lineColorAcc : lineColorDist;

        // Single price level → create line
        if (level.price) {
          const line = chart.addHorizontalLine({
            price: level.price,
            color,
            lineWidth: 2,
            lineStyle: 2, // dashed
          });
          lines.push(line);
        }

        // Price band → draw a filled box
        if (level.priceRange) {
          const [low, high] = level.priceRange;

          const box = chart.addBox({
            top: high,
            bottom: low,
            color,
            opacity: 0.18,
            borderColor: color
          });
          boxes.push(box);
        }
      });
    }

    loadLevels();

    return () => {
      lines.forEach(l => chart.removeHorizontalLine(l));
      boxes.forEach(b => chart.removeBox(b));
    };
  }, [chart]);

  return null;
}
