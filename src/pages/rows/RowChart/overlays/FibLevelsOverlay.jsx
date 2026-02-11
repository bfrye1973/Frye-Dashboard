// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Fib Overlay (Multi-degree) — Turbo-safe
// - Fetches /api/v1/fib-levels for W1 and W4 (if present)
// - Draws fib levels per settings
// - Draws MANUAL Elliott waveMarks (W1–W5) as labels locked to candles using tSec
// - Draws optional connector lines between wave marks
//
// IMPORTANT:
// - No auto Elliott counting.
// - Labels/lines require waveMarks.*.tSec to lock to candle. Backend must provide tSec.
//
// TURBO NOTES:
// - Overlays attach after history seed.
// - bars live in barsRef.current; do NOT rely on React bar state.
// - Implement seed(barsAsc) and update(latestBar).

// Robust API base (Vite + CRA + fallback)
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

// If your toolbar sometimes fails to pass wave flags, this prevents “silent nothing”.
// Set to false if you want strict “must be explicitly enabled” behavior.
const DEFAULT_WAVES_ON_WHEN_MISSING = true;

export default function FibLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  enabled = false,

  symbol = "SPY",
  degree = "minor", // primary|intermediate|minor|minute
  tf = "1h",        // 1d|1h|10m etc

  style = {},
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  // Style defaults
  const s = {
    // fib visuals
    color: style.color || "#ffd54a",
    fontPx: Number.isFinite(style.fontPx) ? style.fontPx : 18,
    lineWidth: Number.isFinite(style.lineWidth) ? style.lineWidth : 3,
    showExtensions: style.showExtensions !== false,
    showRetrace: style.showRetrace !== false,
    showAnchors: style.showAnchors !== false,

    // elliott visuals
    // NOTE: If keys are missing entirely, Turbo wiring issues can cause “nothing shows”.
    // This default prevents silent failure.
    showWaveLabels:
      typeof style.showWaveLabels === "boolean"
        ? style.showWaveLabels
        : DEFAULT_WAVES_ON_WHEN_MISSING,
    showWaveLines:
      typeof style.showWaveLines === "boolean"
        ? style.showWaveLines
        : DEFAULT_WAVES_ON_WHEN_MISSING,

    waveLabelColor: style.waveLabelColor || (style.color || "#ffd54a"),
    waveLabelFontPx: Number.isFinite(style.waveLabelFontPx)
      ? style.waveLabelFontPx
      : (Number.isFinite(style.fontPx) ? style.fontPx : 18),

    waveLineColor: style.waveLineColor || (style.color || "#ffd54a"),
    waveLineWidth: Number.isFinite(style.waveLineWidth)
      ? style.waveLineWidth
      : Math.max(2, Number.isFinite(style.lineWidth) ? style.lineWidth : 3),

    debug: style.debug === true,
  };

  let canvas = null;
  let raf = null;
  let disposed = false;

  let w1 = null; // W1 payload
  let w4 = null; // W4 payload (optional)

  // Turbo state
  let lastFetchMs = 0;
  let seeded = false;

  const ts = chart.timeScale();

  function urlFor(wave) {
    const u = new URL(`${API_BASE}/api/v1/fib-levels`);
    u.searchParams.set("symbol", symbol);
    u.searchParams.set("tf", tf);
    u.searchParams.set("degree", degree);
    u.searchParams.set("wave", wave);
    // bust caches in Render/proxies
    u.searchParams.set("t", String(Date.now()));
    return u.toString();
  }

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "80";
    chartContainer.appendChild(canvas);
    resizeCanvas();
    return canvas;
  }

  function removeCanvas() {
    if (!canvas) return;
    try { canvas.remove(); } catch {}
    canvas = null;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  async function fetchBoth() {
    try {
      const [r1, r4] = await Promise.all([
        fetch(urlFor("W1"), { headers: { accept: "application/json" }, cache: "no-store" }),
        fetch(urlFor("W4"), { headers: { accept: "application/json" }, cache: "no-store" }),
      ]);
      const j1 = await r1.json();
      const j4 = await r4.json();
      w1 = j1 && j1.ok === true ? j1 : null;
      w4 = j4 && j4.ok === true ? j4 : null;

      if (s.debug) {
        const hasMarks = !!w1?.anchors?.waveMarks;
        const exampleT = w1?.anchors?.waveMarks?.W1?.tSec;
        // eslint-disable-next-line no-console
        console.debug("[fibOverlay] fetched", { symbol, tf, degree, hasW1: !!w1, hasW4: !!w4, hasMarks, exampleT });
      }
    } catch (e) {
      if (s.debug) {
        // eslint-disable-next-line no-console
        console.debug("[fibOverlay] fetchBoth failed", e);
      }
      w1 = null;
      w4 = null;
    }
  }

  function maybeFetch(force = false) {
    const now = Date.now();
    // Throttle live fetches — Turbo update() may be frequent.
    // You can tighten/loosen this. 1500ms is a good “live” compromise.
    const minGapMs = 1500;

    if (!force && now - lastFetchMs < minGapMs) {
      return Promise.resolve();
    }
    lastFetchMs = now;
    return fetchBoth();
  }

  function timeToX(timeSec) {
    if (!Number.isFinite(timeSec)) return null;
    try {
      const x = ts.timeToCoordinate(timeSec);
      return Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  }

  // W4 projection uses W1 span and W4 low as base.
  function computeW5Targets(w1Anchors, w4Anchors) {
    const w1Low = Number(w1Anchors?.low);
    const w1High = Number(w1Anchors?.high);
    const w4Low = Number(w4Anchors?.low);
    if (!Number.isFinite(w1Low) || !Number.isFinite(w1High) || !Number.isFinite(w4Low)) return null;
    const span = w1High - w1Low;
    if (!(span > 0)) return null;
    return {
      t1000: w4Low + 1.0 * span,
      t1168: w4Low + 1.168 * span,
      t1618: w4Low + 1.618 * span,
      t2000: w4Low + 2.0 * span,
      t2618: w4Low + 2.618 * span,
    };
  }

  function drawWaveMarks(ctx, rect) {
    if (!s.showWaveLabels && !s.showWaveLines) return;
    if (!w1 || !w1.anchors) return;

    // ✅ LOCKED PATH
    const observe = w1?.anchors?.waveMarks;
    if (!observe || typeof observe !== "object") return;

    const order = ["W1", "W2", "W3", "W4", "W5"];
    const pts = [];

    for (const k of order) {
      const m = observe[k];
      if (!m) continue;

      const p = Number(m.p);
      if (!Number.isFinite(p)) continue;

      const tSec = Number(m.tSec);
      if (!Number.isFinite(tSec)) continue;

      const x = timeToX(tSec);
      const y = priceSeries.priceToCoordinate(p);
      if (x == null || y == null) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      pts.push({ k, x, y, p });
    }

    if (!pts.length) return;

    // Connector lines (partial polyline, skipping missing)
    if (s.showWaveLines && pts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = s.waveLineColor;
      ctx.lineWidth = Math.max(1, s.waveLineWidth);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // Labels
    if (s.showWaveLabels) {
      const FONT = `${Math.max(10, Math.min(96, s.waveLabelFontPx))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.font = FONT;

      for (const pt of pts) {
        const text = pt.k;
        const pad = 10;

        const tw = ctx.measureText(text).width;
        const boxW = Math.max(44, tw + pad * 2);
        const boxH = Math.max(26, Math.floor(s.waveLabelFontPx * 1.2));
        const bx = Math.min(Math.max(8, pt.x - boxW / 2), rect.width - boxW - 8);
        const by = pt.y - boxH - 10;

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        roundRect(ctx, bx, by, boxW, boxH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = s.waveLabelColor;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineWidth = 3;
        ctx.strokeText(text, bx + pad, by + Math.floor(boxH * 0.78));
        ctx.fillText(text, bx + pad, by + Math.floor(boxH * 0.78));
        ctx.restore();
      }
    }
  }

  function draw() {
    if (disposed) return;

    if (!enabled) {
      removeCanvas();
      return;
    }

    if (!w1 && !w4) {
      // If seed happened but fetch failed, we still keep canvas removed (your previous behavior)
      removeCanvas();
      return;
    }

    const c = ensureCanvas();
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const FONT = `${Math.max(10, Math.min(64, s.fontPx))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const HEADER = `${Math.max(10, Math.min(72, s.fontPx + 2))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const labelX = Math.round(rect.width * 0.52);

    const cGate = "rgba(255,60,60,0.98)";
    const cAnchor = "rgba(255,255,255,0.92)";
    const cRetrace = "rgba(120,220,255,0.92)";
    const cExt = s.color;

    const mode = w4 ? "W4" : "W1";

    // Header
    ctx.font = HEADER;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    const title = `FIB ${degree.toUpperCase()} • ${tf} • ${mode}`;
    const tw = ctx.measureText(title).width;
    ctx.fillText(title, (rect.width - tw) / 2, Math.max(26, s.fontPx + 10));

    const levels = [];

    if (mode === "W4") {
      if (s.showAnchors && w4?.anchors) {
        levels.push(
          { kind: "anchor", price: Number(w4.anchors.low), label: `W4 LOW  ${fmt(w4.anchors.low)}`, color: cAnchor, dash: [10, 10] },
          { kind: "anchor", price: Number(w4.anchors.high), label: `W3 HIGH ${fmt(w4.anchors.high)}`, color: cAnchor, dash: [10, 10] }
        );
      }
      if (s.showExtensions && w1?.anchors && w4?.anchors) {
        const t = computeW5Targets(w1.anchors, w4.anchors);
        if (t) {
          levels.push(
            { kind: "ext", price: t.t1000, label: `W5 1.000  ${fmt(t.t1000)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: t.t1168, label: `W5 1.168  ${fmt(t.t1168)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: t.t1618, label: `W5 1.618  ${fmt(t.t1618)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: t.t2000, label: `W5 2.000  ${fmt(t.t2000)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: t.t2618, label: `W5 2.618  ${fmt(t.t2618)}`, color: cExt, dash: [22, 14] }
          );
        }
      }
    } else {
      if (s.showAnchors && w1?.anchors) {
        levels.push(
          { kind: "anchor", price: Number(w1.anchors.low), label: `W1 LOW  ${fmt(w1.anchors.low)}`, color: cAnchor, dash: [10, 10] },
          { kind: "anchor", price: Number(w1.anchors.high), label: `W1 HIGH ${fmt(w1.anchors.high)}`, color: cAnchor, dash: [10, 10] }
        );
      }

      // ✅ No levels[] exists — use fib.* fields
      if (s.showRetrace && w1?.fib) {
        levels.push(
          { kind: "retrace", price: Number(w1.fib.r382), label: `0.382  ${fmt(w1.fib.r382)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r500), label: `0.500  ${fmt(w1.fib.r500)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r618), label: `0.618  ${fmt(w1.fib.r618)}`, color: cRetrace, dash: [] }
        );
      }
      if (w1?.fib) {
        levels.push({
          kind: "gate",
          price: Number(w1.fib.invalidation),
          label: `INV 74%  ${fmt(w1.fib.invalidation)}`,
          color: cGate,
          dash: [14, 10],
        });
      }

      if (s.showExtensions && w1?.anchors) {
        const low = Number(w1.anchors.low);
        const high = Number(w1.anchors.high);
        if (Number.isFinite(low) && Number.isFinite(high) && high > low) {
          const span = high - low;
          const e1168 = high + 1.168 * span;
          const e1618 = high + 1.618 * span;
          const e2000 = high + 2.0 * span;
          const e2618 = high + 2.618 * span;
          levels.push(
            { kind: "ext", price: e1168, label: `1.168  ${fmt(e1168)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: e1618, label: `1.618  ${fmt(e1618)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: e2000, label: `2.000  ${fmt(e2000)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: e2618, label: `2.618  ${fmt(e2618)}`, color: cExt, dash: [22, 14] }
          );
        }
      }
    }

    // Draw fib lines + centered labels
    for (const lv of levels) {
      if (!Number.isFinite(lv.price)) continue;

      const y = priceSeries.priceToCoordinate(lv.price);
      if (y == null || !Number.isFinite(y)) continue;

      ctx.save();
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = Math.max(1, s.lineWidth) * (lv.kind === "gate" ? 1.4 : lv.kind === "ext" ? 1.2 : 1.0);
      ctx.setLineDash(lv.dash || []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = FONT;

      const text = lv.label;
      const textW = ctx.measureText(text).width;
      const boxW = Math.max(180, textW + 24);
      const boxH = Math.max(22, Math.floor(s.fontPx * 1.35));
      const bx = Math.min(Math.max(12, labelX - boxW / 2), rect.width - boxW - 12);
      const by = y - boxH / 2;

      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      roundRect(ctx, bx, by, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = lv.color;
      ctx.fillText(text, bx + 12, by + Math.floor(boxH * 0.72));
      ctx.restore();
    }

    // Elliott marks/lines on top
    drawWaveMarks(ctx, rect);
  }

  function scheduleDraw() {
    if (disposed) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  function onResize() {
    resizeCanvas();
    scheduleDraw();
  }

  // Turbo lifecycle
  function seed(/* barsAsc */) {
    if (!enabled) return;
    seeded = true;
    maybeFetch(true).then(scheduleDraw);
  }

  function update(/* latestBar */) {
    if (!enabled) {
      removeCanvas();
      return;
    }
    if (!seeded) {
      // If someone calls update before seed, recover safely.
      seeded = true;
      maybeFetch(true).then(scheduleDraw);
      return;
    }
    // live tick: throttle network; still redraw
    maybeFetch(false).then(scheduleDraw);
  }

  function destroy() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener("resize", onResize);
    removeCanvas();
  }

  window.addEventListener("resize", onResize);

  // When user pans/zooms, re-draw against new time->x transform
  const cb = () => scheduleDraw();
  ts.subscribeVisibleTimeRangeChange(cb);

  return {
    seed,
    update,
    destroy: () => {
      try { ts.unsubscribeVisibleTimeRangeChange(cb); } catch {}
      destroy();
    },
  };
}

function fmt(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return Number(x).toFixed(2);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
