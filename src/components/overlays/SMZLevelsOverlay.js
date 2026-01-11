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

        // ---- TradingView-style draw order ----
        const structures = levels.filter((l) => (l?.tier ?? "") === "structure");
        const pockets = levels.filter((l) => (l?.tier ?? "") === "pocket");

        // -----------------------------
        // 1) STRUCTURE BANDS (yellow faint)
        // -----------------------------
        for (const level of structures) {
          const strength = safeNum(level?.strength) ?? 0;
          const pr = Array.isArray(level?.priceRange) ? level.priceRange : null;
          let high = pr ? safeNum(pr[0]) : null; // [high, low]
          let low = pr ? safeNum(pr[1]) : null;

          if (high == null || low == null || high <= low) continue;

          // visual pad to avoid hairline gaps
          const pad = 0.15;
          high += pad;
          low -= pad;

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

        // -----------------------------
        // 2) COMPLETED POCKETS (blue bold) + PINK MIDLINE
        // -----------------------------
        for (const level of pockets) {
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
              color: "rgba(255, 55, 200, 1)", // pink
              lineWidth: 4,
              lineStyle: 2, // dashed
            });
          }
        }

        // -----------------------------
        // 3) ACTIVE POCKETS (teal/cyan) + TEAL MIDLINE
        //    These are in json.pockets_active[]
        // -----------------------------
        // Sort by relevance first (closer to price), then strengthTotal
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
          if (tier !== "pocket_active") continue;

          const pr = Array.isArray(p?.priceRange) ? p.priceRange : null;
          const high = pr ? safeNum(pr[0]) : null;
          const low = pr ? safeNum(pr[1]) : null;
          if (high == null || low == null || high <= low) continue;

          const relevance = safeNum(p?.relevanceScore); // 0..100
          const strengthTotal = safeNum(p?.strengthTotal); // 0..100
          const mid = safeNum(p?.negotiationMid);

          // Opacity driven mostly by relevance (closer to price = more visible)
          const rel01 = relevance == null ? 0.5 : clamp01(relevance / 100);
          const str01 = strengthTotal == null ? 0.5 : clamp01(strengthTotal / 100);

          // keep it readable but not overwhelming
          const opacity = 0.12 + (rel01 * 0.20) + (str01 * 0.10); // ~0.12..0.42

          addBox({
            top: high,
            bottom: low,
            fillColor: "rgba(0, 220, 200, 1)",   // teal fill
            color: "rgba(0, 220, 200, 1)",
            opacity,
            borderColor: "rgba(0, 220, 200, 1)", // teal border
            borderWidth: 2,
          });

          if (mid != null) {
            addLine({
              price: mid,
              color: "rgba(0, 220, 200, 1)",
              lineWidth: 3,
              lineStyle: 2, // dashed
            });
          }
        }

        // ❌ MICRO: do nothing (and route already filters it out anyway)
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
