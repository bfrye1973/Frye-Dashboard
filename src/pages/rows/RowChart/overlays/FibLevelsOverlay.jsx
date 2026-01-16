// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Fib Overlay (Multi-degree, W1+W4 smart) + Manual Elliott marks (labels + connector lines)
//
// Fetches W1 and W4 for symbol=SPY, tf, degree.
// Uses backend-provided anchors.a/b and anchors.waveMarks with tSec to place labels on candles.
//
// IMPORTANT: No auto Elliott counting. Only draws marks you manually provide.

const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  "https://frye-market-backend-1.onrender.com";

export default function FibLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  enabled = false,

  degree = "intermediate",
  tf = "1h",

  style = {},
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  const s = {
    // fib styling
    color: style.color || "#ffd54a",
    fontPx: Number.isFinite(style.fontPx) ? style.fontPx : 18,
    lineWidth: Number.isFinite(style.lineWidth) ? style.lineWidth : 3,
    showExtensions: style.showExtensions !== false,
    showRetrace: style.showRetrace !== false,
    showAnchors: style.showAnchors !== false,

    // new: wave label + line styling
    showWaveLabels: style.showWaveLabels === true,
    showWaveLines: style.showWaveLines === true,
    waveLabelColor: style.waveLabelColor || (style.color || "#ffd54a"),
    waveLabelFontPx: Number.isFinite(style.waveLabelFontPx) ? style.waveLabelFontPx : Math.max(12, (style.fontPx || 18)),
    waveLineColor: style.waveLineColor || (style.color || "#ffd54a"),
    waveLineWidth: Number.isFinite(style.waveLineWidth) ? style.waveLineWidth : Math.max(2, (style.lineWidth || 3)),
  };

  let canvas = null;
  let raf = null;
  let disposed = false;

  let w1 = null;
  let w4 = null;

  const ts = chart.timeScale();

  function urlFor(wave) {
    const u = new URL(`${API_BASE}/api/v1/fib-levels`);
    u.searchParams.set("symbol", "SPY");
    u.searchParams.set("tf", tf);
    u.searchParams.set("degree", degree);
    u.searchParams.set("wave", wave);
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
    canvas.style.zIndex = "60";
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
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
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
    } catch {
      w1 = null;
      w4 = null;
    }
  }

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

  function timeToX(timeSec) {
    if (!Number.isFinite(timeSec)) return null;
    try {
      const x = ts.timeToCoordinate(timeSec);
      return Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  }

  function drawWaveMarks(ctx, rect) {
    if (!s.showWaveLabels && !s.showWaveLines) return;

    // We read waveMarks from W1 payload (recommended place to store it)
    const marks = w1?.anchors?.waveMarks || null;
    if (!marks || typeof marks !== "object") return;

    // Build ordered list W1..W5 using available marks + anchors a/b if present.
    // For W1, prefer anchors.a/b times if present.
    const ordered = [];

    // W1 low/high as two points (optional) — label them as W1L/W1H
    const A = w1?.anchors?.a;
    const B = w1?.anchors?.b;

    if (s.showWaveLabels && A?.tSec && Number.isFinite(A?.p)) {
      ordered.push({ k: "W1", label: "W1", tSec: A.tSec, p: A.p });
    }
    if (s.showWaveLabels && B?.tSec && Number.isFinite(B?.p)) {
      // you may not want two W1 labels; keep one if desired
      // We'll only label the first W1 point (A). B is handled by fib anchors already.
    }

    // W2..W5 marks
    const keys = ["W2", "W3", "W4", "W5"];
    for (const k of keys) {
      const m = marks[k];
      if (!m) continue;
      const p = Number(m.p);
      if (!Number.isFinite(p)) continue;

      ordered.push({
        k,
        label: k,
        tSec: Number.isFinite(m.tSec) ? m.tSec : null,
        p,
      });
    }

    // Draw labels (if enabled)
    if (s.showWaveLabels) {
      const FONT = `${Math.max(10, Math.min(72, s.waveLabelFontPx))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.font = FONT;
      ctx.fillStyle = s.waveLabelColor;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 3;

      for (const pt of ordered) {
        const y = priceSeries.priceToCoordinate(pt.p);
        if (y == null || !Number.isFinite(y)) continue;

        // if time missing, place near right-middle
        const x = timeToX(pt.tSec) ?? Math.round(rect.width * 0.85);

        // label with small background
        const text = pt.label;
        const tw = ctx.measureText(text).width;
        const pad = 10;
        const boxW = Math.max(44, tw + pad * 2);
        const boxH = Math.max(26, Math.floor(s.waveLabelFontPx * 1.2));
        const bx = Math.min(Math.max(8, x - boxW / 2), rect.width - boxW - 8);
        const by = y - boxH - 8;

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

    // Draw connector lines (if enabled)
    if (s.showWaveLines) {
      // Keep only points with time (otherwise line placement is nonsense)
      const pts = ordered
        .map((pt) => {
          const x = timeToX(pt.tSec);
          const y = priceSeries.priceToCoordinate(pt.p);
          if (x == null || y == null) return null;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return { x, y };
        })
        .filter(Boolean);

      if (pts.length >= 2) {
        ctx.save();
        ctx.strokeStyle = s.waveLineColor;
        ctx.lineWidth = Math.max(1, s.waveLineWidth);
        ctx.setLineDash([]); // solid
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
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
      if (s.showRetrace && w1?.fib) {
        levels.push(
          { kind: "retrace", price: Number(w1.fib.r382), label: `0.382  ${fmt(w1.fib.r382)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r500), label: `0.500  ${fmt(w1.fib.r500)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r618), label: `0.618  ${fmt(w1.fib.r618)}`, color: cRetrace, dash: [] }
        );
      }
      if (w1?.fib) {
        levels.push({ kind: "gate", price: Number(w1.fib.invalidation), label: `INV 74%  ${fmt(w1.fib.invalidation)}`, color: cGate, dash: [14, 10] });
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

    // Draw manual Elliott marks after fib so they sit on top
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

  function seed() {
    if (!enabled) return;
    fetchBoth().then(scheduleDraw);
  }

  function update() {
    if (!enabled) {
      removeCanvas();
      return;
    }
    fetchBoth().then(scheduleDraw);
  }

  function destroy() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener("resize", onResize);
    removeCanvas();
  }

  window.addEventListener("resize", onResize);

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
