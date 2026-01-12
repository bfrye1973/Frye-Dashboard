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

    const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
        const pocketsActive = Array.isArray(json?.pockets_active) ? json.pockets_active : [];

        // ✅ DEBUG: confirm overlay sees active pockets
        try {
          console.log(
            "[SMZ OVERLAY]",
            "levels:", levels.length,
            "structures:", levels.filter((l) => l?.tier === "structure").length,
            "pockets:", levels.filter((l) => l?.tier === "pocket").length,
            "pockets_active:", pocketsActive.length
          );
        } catch {}

        const structures = levels.filter((l) => (l?.tier ?? "") === "structure");
        const completedPockets = levels.filter((l) => (l?.tier ?? "") === "pocket");

        // 1) STRUCTURE (yellow faint)
        for (const level of structures) {
          const strength = safeNum(level?.strength) ?? 0;

          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          let high = pr ? safeNum(pr[0]) : null;
          let low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) continue;

          // visual pad
          const pad = 0.15;
          high += pad;
          low -= pad;

          // keep structure in background
          const opacity = strength >= 90 ? 0.06 : 0.04;

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

        // 2) COMPLETED POCKETS (blue) + pink midline
        for (const level of completedPockets) {
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
              lineStyle: 2,
            });
          }
        }

        // 3) ACTIVE POCKETS (teal) + teal midline
        // IMPORTANT: active pockets are tier:"pocket" with status:"building"
        const activeSorted = pocketsActive
          .slice()
          .sort((a, b) => {
            const ra = safeNum(a?.relevanceScore) ?? 0;
            const rb = safeNum(b?.relevanceScore) ?? 0;
            if (rb !== ra) return rb - ra;
            const sa = safeNum(a?.strengthTotal) ?? 0;
            const sb = safeNum(b?.strengthTotal) ?? 0;
            return sb - sa;
          });

        for (const p of activeSorted) {
          const tier = p?.tier ?? "";
          const status = p?.status ?? "";

          // ✅ Correct filter for active pockets
          if (tier !== "pocket" || status !== "building") continue;

          const pr = Array.isArray(p?.priceRange) ? p.priceRange : null;
          const high = pr ? safeNum(pr[0]) : null;
          const low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) continue;

          const relevance = safeNum(p?.relevanceScore);
          const strengthTotal = safeNum(p?.strengthTotal);
          const mid = safeNum(p?.negotiationMid);

          const rel01 = relevance == null ? 0.5 : clamp01(relevance / 100);
          const str01 = strengthTotal == null ? 0.5 : clamp01(strengthTotal / 100);

          const opacity = 0.18 + rel01 * 0.25 + str01 * 0.12; // ~0.18..0.55

          addBox({
            top: high,
            bottom: low,
            fillColor: "rgba(0, 220, 200, 1)",
            color: "rgba(0, 220, 200, 1)",
            opacity,
            borderColor: "rgba(0, 220, 200, 1)",
            borderWidth: 2,
          });

          if (mid != null) {
            addLine({
              price: mid,
              color: "rgba(0, 220, 200, 1)",
              lineWidth: 3,
              lineStyle: 2,
            });
          }
        }

        // MICRO: do nothing
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
