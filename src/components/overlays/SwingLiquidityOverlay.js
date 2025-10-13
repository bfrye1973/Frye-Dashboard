// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity (Supply/Demand) — price-pane overlay
// • Pivots → horizontal lines that EXTEND until broken
// • Green for lows (demand), Red for highs (supply)
// • Right-edge "volume tag" is proportional to TRUE cumulative volume since level formed
// • Redraws on seed/update + pan/zoom + resize (DPR-aware)

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ---------- Tunables ----------
  const L = 10;                 // bars left to confirm pivot
  const R = 10;                 // bars right to confirm pivot
  const MAX_BARS   = 1200;      // only inspect last N bars for pivots
  const MAX_LEVELS = 120;       // cap number of active + broken lines drawn
  const TICK_THICK = 2;         // liquidity line thickness
  const VOL_TAG_W  = 10;        // width (px) of the right-edge volume tag
  const VOL_TAG_GAP = 6;        // gap from right edge
  const VOL_MIN_H  = 4;         // minimum tag height (px) when tiny volume
  const FADE_BROKEN_ALPHA = 0.35; // alpha for broken levels
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  const COL_SUP = "#ff4d4f"; // supply (pivot HIGH)
  const COL_DEM = "#22c55e"; // demand (pivot LOW);
  const COL_TAG_EDGE = "#0b0f17";

  // ---------- Canvas ----------
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,
  });
  cnv.className = "overlay-canvas swing-liquidity";
  chartContainer.appendChild(cnv);
  const ctx = cnv.getContext("2d");

  const resizeCanvas = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(chartContainer);
  const onWinResize = () => resizeCanvas();
  window.addEventListener("resize", onWinResize);
  resizeCanvas();

  // ---------- Data ----------
  let barsAsc = [];        // [{time, open, high, low, close, volume}] ascending by time
  let levels = [];         // [{type:"H"|"L", price, t0, i0, active, brokenT?, volSum}]
  let volMaxForScale = 1;  // used to scale volume tag height

  // ---------- Helpers ----------
  const toSec = (t) => (t > 1e12 ? Math.floor(t / 1000) : t);
  const xFor = (tSec) => {
    const x = chart.timeScale().timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (p) => {
    const y = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(y) ? y : null;
  };

  const isSwingHigh = (arr, i, L, R) => {
    const v = arr[i].high;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].high > v) return false;
    }
    return true;
  };

  const isSwingLow = (arr, i, L, R) => {
    const v = arr[i].low;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].low < v) return false;
    }
    return true;
  };

  // Build levels from existing bars (last MAX_BARS)
  const rebuildLevels = () => {
    const startIdx = Math.max(0, barsAsc.length - MAX_BARS);
    const scan = barsAsc.slice(startIdx);
    const out = [];

    for (let i = L; i < scan.length - R; i++) {
      const b = scan[i];
      const tSec = toSec(b.time);
      if (isSwingHigh(scan, i, L, R)) {
        out.push({ type: "H", price: b.high, t0: tSec, i0: startIdx + i, active: true, volSum: 0 });
      }
      if (isSwingLow(scan, i, L, R)) {
        out.push({ type: "L", price: b.low,  t0: tSec, i0: startIdx + i, active: true, volSum: 0 });
      }
    }

    // Accumulate volume from formation → now (until broken)
    // and mark broken status based on close crossing the level
    const n = barsAsc.length;
    for (const lv of out) {
      lv.volSum = 0;
      lv.active = true;
      lv.brokenT = undefined;

      for (let k = lv.i0 + 1; k < n; k++) {
        const br = barsAsc[k];
        lv.volSum += Number(br.volume || 0);
        if (lv.type === "H" && br.close > lv.price) { lv.active = false; lv.brokenT = toSec(br.time); break; }
        if (lv.type === "L" && br.close < lv.price) { lv.active = false; lv.brokenT = toSec(br.time); break; }
      }
    }

    // Bound + strongest recent first (by t0)
    out.sort((a, b) => b.t0 - a.t0);
    levels = out.slice(0, MAX_LEVELS);

    // scale for volume tags
    volMaxForScale = Math.max(1, Math.max(...levels.map(l => l.volSum || 0), 1));
  };

  // Update levels given a new/updated bar
  const refreshLevelsWithBar = (bar) => {
    // 1) Extend/close existing levels
    for (const lv of levels) {
      if (!lv.active) continue;
      lv.volSum += Number(bar.volume || 0);
      if (lv.type === "H" && bar.close > lv.price) { lv.active = false; lv.brokenT = toSec(bar.time); }
      if (lv.type === "L" && bar.close < lv.price) { lv.active = false; lv.brokenT = toSec(bar.time); }
    }

    // 2) Check if the last fully-formed pivot created a new level
    // We need R bars of confirmation; so only check once we have enough bars.
    const n = barsAsc.length;
    if (n < L + R + 1) return;

    const i = n - 1 - R; // pivot center index with R bars to the right
    const b = barsAsc[i];
    if (!b) return;
    const tSec = toSec(b.time);

    if (isSwingHigh(barsAsc, i, L, R)) {
      levels.unshift({ type: "H", price: b.high, t0: tSec, i0: i, active: true, volSum: 0 });
    }
    if (isSwingLow(barsAsc, i, L, R)) {
      levels.unshift({ type: "L", price: b.low,  t0: tSec, i0: i, active: true, volSum: 0 });
    }

    // keep memory bounds + recalc scaling
    if (levels.length > MAX_LEVELS) levels = levels.slice(0, MAX_LEVELS);
    volMaxForScale = Math.max(1, Math.max(...levels.map(l => l.volSum || 0), 1));
  };

  // ---------- Draw ----------
  const draw = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!levels.length) return;

    const xRight = rect.width - VOL_TAG_GAP; // end of projected line (until broken)
    ctx.font = FONT;
    ctx.textAlign = "left";

    for (const lv of levels) {
      const y = yFor(lv.price);
      if (y == null) continue;

      // line start X = formation time, end X = right edge or broken time
      const x0 = xFor(lv.t0);
      if (x0 == null) continue;

      const xEnd = lv.active
        ? xRight
        : (xFor(lv.brokenT) ?? xRight);

      const color = lv.type === "H" ? COL_SUP : COL_DEM;
      const alpha = lv.active ? 1 : FADE_BROKEN_ALPHA;

      // Liquidity line
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = TICK_THICK;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();

      // Right-edge volume tag (only for ACTIVE levels)
      if (lv.active) {
        const hFrac = Math.max(lv.volSum / volMaxForScale, 0);
        const tagH = Math.max(VOL_MIN_H, Math.floor(rect.height * 0.12 * hFrac));
        const tagX = rect.width - VOL_TAG_GAP - VOL_TAG_W;
        const tagY = Math.max(2, Math.min(rect.height - tagH - 2, y - tagH / 2));

        ctx.fillStyle = color;
        ctx.fillRect(tagX, tagY, VOL_TAG_W, tagH);

        // edge stroke for definition
        ctx.strokeStyle = COL_TAG_EDGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX + 0.5, tagY + 0.5, VOL_TAG_W - 1, tagH - 1);
      }
    }

    ctx.globalAlpha = 1;
  };

  // ---------- Pan/Zoom redraw ----------
  const ts = chart.timeScale();
  const onLogicalRange = () => draw();
  const onVisibleTimeRange = () => draw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogicalRange);
  ts.subscribeVisibleTimeRangeChange?.(onVisibleTimeRange);

  // ---------- API ----------
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({
        ...b, time: toSec(b.time),
      }));
      rebuildLevels();
      draw();
    },
    update(latest) {
      if (!latest) return;
      const t = toSec(latest.time);
      const last = barsAsc.at(-1);

      if (!last || t > last.time) {
        barsAsc.push({ ...latest, time: t });
      } else if (t === last.time) {
        barsAsc[barsAsc.length - 1] = { ...latest, time: t };
      } else {
        // out-of-order; ignore
        return;
      }

      refreshLevelsWithBar(latest);
      draw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogicalRange); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisibleTimeRange); } catch {}
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
    },
  };
}
