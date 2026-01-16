// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Fib Overlay (Multi-degree, W1+W4 smart)
// - Fetches W1 and W4 for (symbol=SPY, tf, degree)
// - If W4 exists: show W4 LOW/HIGH + W5 targets computed from W1 span
// - If no W4: show W1 retrace levels + invalidation
// - Styling driven by per-degree settings from toolbar

const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  "https://frye-market-backend-1.onrender.com";

export default function FibLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  enabled = false,

  // Multi-degree controls
  degree = "intermediate", // intermediate | minor | minute
  tf = "1h",               // "1h" or "10m" etc.

  // Style controls from toolbar (per degree)
  style = {},
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[FibLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  const s = {
    color: style.color || "#ffd54a",
    fontPx: Number.isFinite(style.fontPx) ? style.fontPx : 18,
    lineWidth: Number.isFinite(style.lineWidth) ? style.lineWidth : 3,
    showExtensions: style.showExtensions !== false,
    showRetrace: style.showRetrace !== false,
    showAnchors: style.showAnchors !== false,
  };

  let canvas = null;
  let raf = null;
  let disposed = false;

  let w1 = null; // W1 payload
  let w4 = null; // W4 payload

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
    canvas.style.zIndex = "50";
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

  // Compute W5 targets using W1 span and W4 low
  function computeW5Targets(w1Anchors, w4Anchors) {
    const w1Low = Number(w1Anchors?.low);
    const w1High = Number(w1Anchors?.high);
    const w4Low = Number(w4Anchors?.low);

    if (!Number.isFinite(w1Low) || !Number.isFinite(w1High) || !Number.isFinite(w4Low)) return null;

    const span = w1High - w1Low;
    if (!(span > 0)) return null;

    return {
      span,
      t1000: w4Low + 1.0 * span,
      t1168: w4Low + 1.168 * span,
      t1618: w4Low + 1.618 * span,
      t2000: w4Low + 2.0 * span,
      t2618: w4Low + 2.618 * span,
    };
  }

  function draw() {
    if (disposed) return;
    if (!enabled) {
      removeCanvas();
      return;
    }

    // If nothing loaded yet, don’t draw
    if (!w1 && !w4) {
      removeCanvas();
      return;
    }

    const c = ensureCanvas();
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // fonts
    const FONT = `${Math.max(10, Math.min(64, s.fontPx))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const HEADER = `${Math.max(10, Math.min(72, s.fontPx + 2))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const labelX = Math.round(rect.width * 0.52);

    // Colors
    const cMain = s.color;
    const cGate = "rgba(255,60,60,0.98)";
    const cAnchor = "rgba(255,255,255,0.92)";
    const cRetrace = "rgba(120,220,255,0.92)";
    const cExt = cMain; // use degree color for projections

    // Select mode:
    const mode = w4 ? "W4" : "W1";

    // header
    ctx.font = HEADER;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    const title = `FIB ${degree.toUpperCase()} • ${tf} • ${mode}`;
    const tw = ctx.measureText(title).width;
    ctx.fillText(title, (rect.width - tw) / 2, Math.max(26, s.fontPx + 10));

    const levels = [];

    if (mode === "W4") {
      // W4 projection view
      if (s.showAnchors) {
        levels.push(
          { kind: "anchor", price: Number(w4.anchors.low), label: `W4 LOW  ${fmt(w4.anchors.low)}`, color: cAnchor, dash: [10, 10] },
          { kind: "anchor", price: Number(w4.anchors.high), label: `W3 HIGH ${fmt(w4.anchors.high)}`, color: cAnchor, dash: [10, 10] }
        );
      }

      if (s.showExtensions) {
        const targets = computeW5Targets(w1?.anchors, w4?.anchors);
        if (targets) {
          levels.push(
            { kind: "ext", price: targets.t1000, label: `W5 1.000  ${fmt(targets.t1000)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: targets.t1168, label: `W5 1.168  ${fmt(targets.t1168)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: targets.t1618, label: `W5 1.618  ${fmt(targets.t1618)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: targets.t2000, label: `W5 2.000  ${fmt(targets.t2000)}`, color: cExt, dash: [22, 14] },
            { kind: "ext", price: targets.t2618, label: `W5 2.618  ${fmt(targets.t2618)}`, color: cExt, dash: [22, 14] }
          );
        }
      }
    } else {
      // W1 retrace view
      if (s.showAnchors) {
        levels.push(
          { kind: "anchor", price: Number(w1.anchors.low), label: `W1 LOW  ${fmt(w1.anchors.low)}`, color: cAnchor, dash: [10, 10] },
          { kind: "anchor", price: Number(w1.anchors.high), label: `W1 HIGH ${fmt(w1.anchors.high)}`, color: cAnchor, dash: [10, 10] }
        );
      }

      if (s.showRetrace) {
        levels.push(
          { kind: "retrace", price: Number(w1.fib.r382), label: `0.382  ${fmt(w1.fib.r382)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r500), label: `0.500  ${fmt(w1.fib.r500)}`, color: cRetrace, dash: [] },
          { kind: "retrace", price: Number(w1.fib.r618), label: `0.618  ${fmt(w1.fib.r618)}`, color: cRetrace, dash: [] }
        );
      }

      // invalidation always visible in W1 mode
      levels.push({
        kind: "gate",
        price: Number(w1.fib.invalidation),
        label: `INV 74%  ${fmt(w1.fib.invalidation)}`,
        color: cGate,
        dash: [14, 10],
      });

      if (s.showExtensions) {
        // Extension projections above W1 high (use W1 anchors)
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

    // Draw lines + centered labels
    for (const lv of levels) {
      if (!Number.isFinite(lv.price)) continue;

      const y = priceSeries.priceToCoordinate(lv.price);
      if (y == null || !Number.isFinite(y)) continue;

      // line
      ctx.save();
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = Math.max(1, s.lineWidth) * (lv.kind === "gate" ? 1.4 : lv.kind === "ext" ? 1.2 : 1.0);
      ctx.setLineDash(lv.dash || []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      // label box
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
