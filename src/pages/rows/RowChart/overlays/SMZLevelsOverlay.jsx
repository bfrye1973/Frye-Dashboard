// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

function getShelvesUrl(symbol) {
  const clean = String(symbol || "SPY").toUpperCase();

  if (clean === "ES") {
    return `${API_BASE.replace(/\/+$/, "")}/api/v1/es-smz-shelves?symbol=ES`;
  }

  return `${API_BASE.replace(/\/+$/, "")}/api/v1/smz-shelves?symbol=${encodeURIComponent(clean)}`;
}

export default function SMZShelvesOverlay({
  chart,
  priceSeries,
  chartContainer,
  symbol = "SPY",
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let canvas = null;
  let shelves = [];
  let destroyed = false;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;

    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-shelves-overlay";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 14,
    });

    chartContainer.appendChild(cnv);
    canvas = cnv;
    return cnv;
  }

  function resizeCanvas() {
    if (!canvas) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function safeNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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

  function zoneStyle(type) {
    const t = String(type || "").toLowerCase();

    if (t.includes("distribution")) {
      return {
        fill: "rgba(239,68,68,0.13)",
        stroke: "rgba(239,68,68,0.85)",
        text: "#fecaca",
        label: "DIST",
      };
    }

    if (t.includes("accumulation")) {
      return {
        fill: "rgba(34,197,94,0.12)",
        stroke: "rgba(34,197,94,0.85)",
        text: "#bbf7d0",
        label: "ACC",
      };
    }

    return {
      fill: "rgba(251,191,36,0.10)",
      stroke: "rgba(251,191,36,0.85)",
      text: "#fde68a",
      label: "SHELF",
    };
  }

  function drawLabel(ctx, text, x, y, color) {
    ctx.save();

    ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const tw = ctx.measureText(text).width;
    const bw = tw + 18;
    const bh = 26;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;

    roundRect(ctx, x, y, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, x + 9, y + 18);

    ctx.restore();
  }

  function normalizeShelves(json) {
    const raw = Array.isArray(json?.levels)
      ? json.levels
      : Array.isArray(json?.shelves)
      ? json.shelves
      : [];

    return raw
      .map((z) => {
        const lo = safeNum(z?.lo ?? z?.low ?? z?.priceRange?.[1]);
        const hi = safeNum(z?.hi ?? z?.high ?? z?.priceRange?.[0]);
        if (lo == null || hi == null) return null;

        const bottom = Math.min(lo, hi);
        const top = Math.max(lo, hi);

        return {
          id: z?.id || `${z?.symbol || symbol}|${z?.type}|${bottom}|${top}`,
          symbol: z?.symbol || symbol,
          type: z?.type || "shelf",
          lo: bottom,
          hi: top,
          mid: safeNum(z?.mid) ?? (bottom + top) / 2,
          strength: safeNum(z?.strength),
          confidence: safeNum(z?.confidence),
          reason: z?.diagnostic?.reason || z?.reason || "",
          active: z?.active !== false,
        };
      })
      .filter(Boolean);
  }

  function draw() {
    const cnv = ensureCanvas();
    resizeCanvas();

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const ctx = cnv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;

    shelves.forEach((z, idx) => {
      if (!z?.active) return;

      const yHi = priceToY(z.hi);
      const yLo = priceToY(z.lo);
      if (yHi == null || yLo == null) return;

      const y = Math.min(yHi, yLo);
      const h = Math.max(2, Math.abs(yLo - yHi));
      const style = zoneStyle(z.type);

      ctx.save();

      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1.5;

      ctx.fillRect(0, y, w, h);
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, h - 1));
      ctx.stroke();

      ctx.restore();

      const labelPrice = z.mid ?? (z.hi + z.lo) / 2;
      const yMid = priceToY(labelPrice);
      if (yMid == null) return;

      const strengthText =
        z.strength != null ? ` ${Math.round(z.strength)}` : "";

      const confidenceText =
        z.confidence != null ? ` (${Number(z.confidence).toFixed(2)})` : "";

      const rangeText = `${z.lo.toFixed(2)}–${z.hi.toFixed(2)}`;

      const label = `${style.label}${strengthText}${confidenceText} ${rangeText}`;

      const x = Math.max(12, Math.floor(w * 0.72));
      const yLabel = Math.max(8, yMid - 13 + idx * 2);

      drawLabel(ctx, label, x, yLabel, style.text);

      if (String(symbol).toUpperCase() === "ES" && z.reason) {
        drawLabel(
          ctx,
          z.reason,
          x,
          yLabel + 30,
          "#cbd5e1"
        );
      }
    });
  }

  async function loadShelves() {
    try {
      const url = `${getShelvesUrl(symbol)}&_=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      shelves = normalizeShelves(json);
      draw();
    } catch (err) {
      console.error("[SMZShelvesOverlay] load failed:", err);
      shelves = [];
      draw();
    }
  }

  loadShelves();

  const visibleCb = () => draw();
  ts.subscribeVisibleTimeRangeChange?.(visibleCb);

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    destroyed = true;

    try {
      ts.unsubscribeVisibleTimeRangeChange?.(visibleCb);
    } catch {}

    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}

    canvas = null;
    shelves = [];
  }

  return { seed, update, destroy };
}
