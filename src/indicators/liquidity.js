// src/indicators/liquidity.js
// Liquidity / Swing S/R (pivot highs/lows) with optional volume threshold.
// Draws R/S lines on the price pane and "B" markers when the last R/S is broken.
//
// Export shape matches your indicator contract:
//   { id, inputs, compute(candles, inputs), attach(chartApi, seriesMap, result, inputs) }
//
// Candle shape expected: { time, open, high, low, close, volume }

import { LineStyle } from "lightweight-charts";

export const liquidity = {
  id: "liquidity",
  label: "Liquidity (Swings + Breaks)",
  kind: "overlay",

  inputs: {
    left:  15,       // pivot left bars  (Pine swingSizeL)
    right: 10,       // pivot right bars (Pine swingSizeR)
    minSeparationPct: 0.25, // dedupe tolerance between levels
    maxLevels: 10,          // max retained R and S
    lookbackBars: 800,      // pivot scan window
    markersLookback: 300,   // recent bars to scan for breaks
    volumeMin: 0,           // volume threshold; 0 = ignore
    showLines: true,
    showMarkers: true,
    extendUntilFill: true,  // keep line until price "fills" level
    hideFilled: false       // remove filled lines immediately
  },

  /* ------------------------------ COMPUTE ------------------------------ */
  compute(candles, inputs = {}) {
    const cfg = { ...this.inputs, ...inputs };
    const L  = Math.max(1, Math.floor(cfg.left));
    const R  = Math.max(1, Math.floor(cfg.right));
    const sepPct = Math.max(0, Number(cfg.minSeparationPct));
    const maxLv  = Math.max(1, Math.floor(cfg.maxLevels));
    const scan   = Math.max(50, Math.floor(cfg.lookbackBars));
    const mBack  = Math.max(50, Math.floor(cfg.markersLookback));
    const volMin = Math.max(0, Number(cfg.volumeMin));

    const n = Array.isArray(candles) ? candles.length : 0;
    if (!n) return emptyResult();

    // helpers
    const isCandle = (b) =>
      b && b.time != null &&
      Number.isFinite(b.high) && Number.isFinite(b.low) &&
      Number.isFinite(b.close);

    const start = Math.max(0, n - scan);
    const highs = []; // resistance levels
    const lows  = []; // support levels

    // dedupe/push with % tolerance; keep sorted and bound list size
    function pushLevel(arr, level, favor) {
      const tol = Math.abs(level) * (sepPct / 100);
      const near = arr.find((v) => Math.abs(v - level) <= tol);
      if (!near) arr.push(level);
      arr.sort((a, b) => a - b);
      while (arr.length > maxLv) {
        if (favor === "res") arr.shift(); else arr.pop();
      }
    }

    // pivot detection like Pine's ta.pivothigh/low
    function isPivotHigh(i) {
      if (i < L || i + R >= n) return false;
      const x = candles[i].high;
      for (let k = i - L; k <= i + R; k++) if (k !== i && candles[k].high >= x) return false;
      return true;
    }
    function isPivotLow(i) {
      if (i < L || i + R >= n) return false;
      const x = candles[i].low;
      for (let k = i - L; k <= i + R; k++) if (k !== i && candles[k].low <= x) return false;
      return true;
    }

    // build levels
    for (let i = start; i < n; i++) {
      const b = candles[i];
      if (!isCandle(b)) continue;
      if (isPivotHigh(i)) {
        if (volMin === 0 || (Number(candles[i]?.volume) >= volMin)) {
          pushLevel(highs, candles[i].high, "res");
        }
      }
      if (isPivotLow(i)) {
        if (volMin === 0 || (Number(candles[i]?.volume) >= volMin)) {
          pushLevel(lows, candles[i].low, "sup");
        }
      }
    }

    // "break" markers: check last R/S against recent candles
    const recent  = candles.slice(-mBack);
    const lastRes = highs.length ? highs[highs.length - 1] : null;
    const lastSup = lows.length  ? lows[0] : null;
    const markers = [];

    if (cfg.showMarkers) {
      for (let i = 0; i < recent.length; i++) {
        const b = recent[i];
        if (!isCandle(b)) continue;
        const t = b.time;
        // valid shapes for lightweight-charts: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
        if (lastRes != null && b.close > lastRes) {
          markers.push({ time: t, position: "aboveBar", color: "#ef4444", shape: "arrowUp", text: "B" });
        }
        if (lastSup != null && b.close < lastSup) {
          markers.push({ time: t, position: "belowBar", color: "#22c55e", shape: "arrowDown", text: "B" });
        }
      }
    }

    return {
      levels: { res: highs, sup: lows },
      markers,
      cfg: {
        showLines: !!cfg.showLines,
        extendUntilFill: !!cfg.extendUntilFill,
        hideFilled: !!cfg.hideFilled
      }
    };
  },

  /* ------------------------------ ATTACH ------------------------------- */
  attach(chartApi, seriesMap, result /*, inputs */) {
    const priceSeries = chartApi?._priceSeries;
    if (!priceSeries || !result || !result.levels) return () => {};

    const resHandles = [];
    const supHandles = [];

    // draw lines
    if (result.cfg.showLines) {
      try {
        (result.levels.res || []).forEach((level) => {
          if (!Number.isFinite(level)) return;
          const h = priceSeries.createPriceLine({
            price: level,
            color: "#ef4444", lineWidth: 2, lineStyle: LineStyle.Solid,
            axisLabelVisible: true, title: "R"
          });
          resHandles.push(h);
        });

        (result.levels.sup || []).forEach((level) => {
          if (!Number.isFinite(level)) return;
          const h = priceSeries.createPriceLine({
            price: level,
            color: "#22c55e", lineWidth: 2, lineStyle: LineStyle.Solid,
            axisLabelVisible: true, title: "S"
          });
          supHandles.push(h);
        });
      } catch (e) {
        console.error("[liquidity] failed creating price lines:", e);
      }
    }

    // set markers (if any)
    try {
      if (Array.isArray(result.markers) && result.markers.length) {
        priceSeries.setMarkers(result.markers);
      }
    } catch (e) {
      console.error("[liquidity] setMarkers failed:", e);
    }

    // expose handle key (optional)
    seriesMap.set("liquidity", priceSeries);

    // cleanup: remove lines & clear markers
    return () => {
      try { resHandles.forEach((h) => priceSeries.removePriceLine(h)); } catch {}
      try { supHandles.forEach((h) => priceSeries.removePriceLine(h)); } catch {}
      try { priceSeries.setMarkers([]); } catch {}
    };
  },
};

/* --------------------------- helpers (local) --------------------------- */
function emptyResult() {
  return {
    levels: { res: [], sup: [] },
    markers: [],
    cfg: { showLines: true, extendUntilFill: true, hideFilled: false }
  };
}
