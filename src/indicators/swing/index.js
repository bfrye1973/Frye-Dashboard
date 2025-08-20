// src/indicators/swing/index.js
// Swing Points & Liquidity (Leviathan-style, simplified for LWC)
// - Detects swing highs/lows with left/right bars
// - Draws lines & boxes that extend forward
// - Can extend until fill (price touches), or stop on activation
// - Can hide filled levels
// - Optional labels at the swing point
// - Volume filter (no OI in this version)
// - Overlay canvas draws ABOVE chart (z-index)
// - Tiny tag "SWING v1" for visual confirmation

import { INDICATOR_KIND } from "../shared/indicatorTypes";

// ---------- defaults (adjustable through indicatorSettings.swing) ----------
const DEF = {
  leftBars: 15,       // swingSizeL
  rightBars: 10,      // swingSizeR
  showBoxes: true,
  showLines: true,
  showLabels: true,
  extendUntilFill: true,  // extend till price fills the level
  hideFilled: false,      // remove once filled
  volumeThresh: 0,        // 0 = off; else require bar volume > threshold on swing bar
  // Appearance
  resColor: "#aa2430",    // lows in original leviathan were sellcol for lows; here: res=red, sup=green
  supColor: "#66bb6a",
  resBoxColor: "rgba(170,36,48,0.19)",
  supBoxColor: "rgba(102,187,106,0.19)",
  lineStyle: "dotted",    // "solid" | "dashed" | "dotted"
  lineWidth: 2,
  boxWidthPct: 0.7,       // TYPE 2 idea (box thickness % around price)
  boxType: "TYPE 1",      // "TYPE 1" | "TYPE 2"
};

// ---------- helpers ----------
function isPivotHigh(c, i, L, R) {
  const hi = c[i].high;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= c.length) return false;
    if (c[k].high > hi) return false;
  }
  return true;
}
function isPivotLow(c, i, L, R) {
  const lo = c[i].low;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= c.length) return false;
    if (c[k].low < lo) return false;
  }
  return true;
}
function toDash(style) {
  return style === "solid" ? [] : style === "dashed" ? [8, 6] : [3, 4];
}

// ---------- compute ----------
function swingCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const L = o.leftBars, R = o.rightBars;
  const n = candles?.length ?? 0;
  if (!n) return { levels: [], labels: [], opts: o };

  // Find swings; activate at i+R (like negative offset in Pine)
  const levels = []; // {type:'res'|'sup', price, fromIdx, filled:false}
  const labels = []; // {time, price, type}

  for (let i = L; i < n - R; i++) {
    // Optional volume gate (applied at the swing bar)
    const volOK = o.volumeThresh > 0 ? (candles[i].volume ?? 0) > o.volumeThresh : true;

    if (isPivotHigh(candles, i, L, R) && volOK) {
      const act = i + R;
      if (act < n) {
        levels.push({ type: "res", price: candles[i].high, fromIdx: act, filled: false });
        if (o.showLabels) labels.push({ time: candles[i].time, price: candles[i].high, type: "res" });
      }
    }
    if (isPivotLow(candles, i, L, R) && volOK) {
      const act = i + R;
      if (act < n) {
        levels.push({ type: "sup", price: candles[i].low, fromIdx: act, filled: false });
        if (o.showLabels) labels.push({ time: candles[i].time, price: candles[i].low, type: "sup" });
      }
    }
  }

  // Extend forward; mark filled when bar crosses the level
  // We do this historically for the full dataset.
  for (const Lvl of levels) {
    for (let i = Lvl.fromIdx; i < n; i++) {
      const c = candles[i];
      const filledNow =
        Lvl.type === "res" ? (c.high >= Lvl.price && c.low <= Lvl.price)
                           : (c.high >= Lvl.price && c.low <= Lvl.price);
      if (filledNow) {
        Lvl.filled = true;
        if (!o.extendUntilFill) {
          // stop shortly after activation
          Lvl.toIdx = Math.min(i + 4, n - 1);
          break;
        } else {
          // extend to fill bar inclusive
          Lvl.toIdx = i;
          if (o.hideFilled) break;
        }
      } else {
        Lvl.toIdx = i;
      }
    }
  }

  // Optionally hide filled levels
  const filtered = o.hideFilled ? levels.filter(l => !l.filled) : levels;

  // For fast drawing we also compute the time bounds now
  const res = filtered.map(l => ({
    ...l,
    fromTime: candles[l.fromIdx].time,
    toTime: candles[l.toIdx ?? (n - 1)].time,
  }));

  return { levels: res, labels, opts: o };
}

// ---------- overlay (z-index + rAF + DPR cap) ----------
function swingAttach(chartApi, seriesMap, result, inputs) {
  const o = { ...DEF, ...(inputs || {}) };

  const container = chartApi?._container;
  const priceSeries = chartApi?._priceSeries;
  if (!container || !priceSeries) return () => {};

  if (!container.style.position) container.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const xOf = (t) => chartApi.timeScale().timeToCoordinate(t);
  const yOf = (p) => priceSeries.priceToCoordinate(p);

  let raf = 0;
  function scheduleDraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }
  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = container.clientWidth, h = container.clientHeight;
    const need = canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR);
    if (need) {
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  function draw() {
    resize();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Tag
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.fillText("SWING v1", 10, 16);

    // Draw lines/boxes
    if (Array.isArray(result?.levels)) {
      for (const L of result.levels) {
        const x1 = xOf(L.fromTime), x2 = xOf(L.toTime), y = yOf(L.price);
        if (x1 == null || x2 == null || y == null) continue;

        // Optional boxes
        if (o.showBoxes) {
          const half = o.boxType === "TYPE 2" ? (o.boxWidthPct * 0.001 * L.price) : 0;
          const yTop = yOf(L.type === "res" ? (L.price + half) : (L.price - half));
          const yBot = yOf(L.type === "res" ? (L.price - half) : (L.price + half));
          if (yTop != null && yBot != null) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = (L.type === "res") ? o.resBoxColor : o.supBoxColor;
            const yy = Math.min(yTop, yBot);
            const hh = Math.max(1, Math.abs(yTop - yBot));
            ctx.fillRect(Math.min(x1, x2), yy, Math.abs(x2 - x1), hh);
          }
        }

        if (o.showLines) {
          ctx.strokeStyle = (L.type === "res") ? o.resColor : o.supColor;
          ctx.lineWidth = o.lineWidth;
          ctx.setLineDash(toDash(o.lineStyle.toLowerCase()));
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Labels: use native LWC markers for precise alignment
    // (We only set markers once in attach; drawing canvas doesn't handle labels)
  }

  // Labels (markers) on the price series, once
  if (Array.isArray(result?.labels) && o.showLabels) {
    const markers = result.labels.map((lb) => ({
      time: lb.time,
      position: lb.type === "res" ? "belowBar" : "aboveBar",
      color: lb.type === "res" ? "#aa2430" : "#66bb6a",
      shape: "circle",
      text: "",
      size: 0,
    }));
    try { priceSeries.setMarkers([...(priceSeries._markers || []), ...markers]); } catch {}
  }

  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(scheduleDraw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(scheduleDraw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(scheduleDraw) || (() => {});
  scheduleDraw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(scheduleDraw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(scheduleDraw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(scheduleDraw); } catch {}
    try { container.removeChild(canvas); } catch {}
    // note: we don't clear markers here to avoid wiping others; can be added if needed
  };
  seriesMap.set("swing_canvas_cleanup", cleanup);
  return cleanup;
}

// ---------- indicator ----------
const SWING = {
  id: "swing",
  label: "Swing Points & Liquidity",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: DEF,
  compute: swingCompute,
  attach: swingAttach,
};

export default SWING;
