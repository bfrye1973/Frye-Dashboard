import { useEffect } from "react";

export default function SMZLevelsOverlay({
  chart,
  symbol = "SPY",
  // ✅ Original plan: hide MICRO by default
  showMicro = false,
  // ✅ Original plan: hide STRUCTURE if you ever want "pocket-only" mode later
  showStructure = true,
  // ✅ Remove tiny black gaps between adjacent structure zones (visual only)
  structurePadPts = 0.15,
}) {
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
        return line;
      } catch {
        return null;
      }
    };

    const addBox = (opts) => {
      try {
        const box = chart.addBox(opts);
        boxes.push(box);
        return box;
      } catch {
        return null;
      }
    };

    async function loadLevels() {
      try {
        const url = `/api/v1/smz-levels?symbol=${encodeURIComponent(symbol)}&_=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const levels = Array.isArray(json?.levels) ? json.levels : [];

        // Draw order matters: STRUCTURE → POCKET → MIDLINES → (optional MICRO)
        const structures = levels.filter((l) => (l?.tier ?? "micro") === "structure");
        const pockets = levels.filter((l) => (l?.tier ?? "micro") === "pocket");
        const micros = levels.filter((l) => (l?.tier ?? "micro") === "micro");

        const drawBand = (level, tier) => {
          const strength = safeNum(level?.strength) ?? 0;

          // backend: priceRange = [high, low]
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          let high = pr ? safeNum(pr[0]) : null;
          let low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) return;

          // Colors/opacity
          let fillColor = "rgba(255, 210, 0, 1)";     // structure yellow
          let borderColor = "rgba(255, 210, 0, 1)";
          let opacity = 0.10;

          if (tier === "structure") {
            if (!showStructure) return;

            // Slightly boost “true institutional” structures
            opacity = strength >= 90 ? 0.12 : 0.08;

            // ✅ Visual padding to remove hairline gaps (structure only)
            const pad = safeNum(structurePadPts) ?? 0;
            if (pad > 0) {
              high = high + pad;
              low = low - pad;
            }
          }

          if (tier === "pocket") {
            fillColor = "rgba(80, 170, 255, 1)";      // pocket blue
            borderColor = "rgba(80, 170, 255, 1)";
            opacity = 0.55;
          }

          addBox({
            top: high,
            bottom: low,
            fillColor,
            color: fillColor, // compatibility
            opacity,
            borderColor,
            borderWidth: tier === "pocket" ? 2 : 1,
          });
        };

        const drawMidlineIfAny = (level, tier) => {
          const facts = level?.details?.facts ?? {};
          const negotiationMid = safeNum(facts?.negotiationMid);
          if (negotiationMid == null) return;

          addLine({
            price: negotiationMid,
            color: "rgba(255, 55, 200, 1)", // pink
            lineWidth: tier === "pocket" ? 4 : 2,
            lineStyle: 2, // dashed
          });
        };

        const drawMicroIfEnabled = (level) => {
          if (!showMicro) return;

          // MICRO: dashed orange line at midpoint
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          const high = pr ? safeNum(pr[0]) : null;
          const low = pr ? safeNum(pr[1]) : null;

          let y = safeNum(level?.price);
          if (y == null && high != null && low != null) y = (high + low) / 2;
          if (y == null) return;

          addLine({
            price: y,
            color: "rgba(255, 165, 0, 1)",
            lineWidth: 2,
            lineStyle: 2,
          });
        };

        // 1) STRUCTURE bands
        for (const z of structures) drawBand(z, "structure");

        // 2) POCKET bands
        for (const z of pockets) drawBand(z, "pocket");

        // 3) Midlines (pockets first, then structures if any ever carry a midline)
        for (const z of pockets) drawMidlineIfAny(z, "pocket");
        for (const z of structures) drawMidlineIfAny(z, "structure");

        // 4) MICRO lines (optional)
        for (const z of micros) drawMicroIfEnabled(z);
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
  }, [chart, symbol, showMicro, showStructure, structurePadPts]);

  return null;
}
