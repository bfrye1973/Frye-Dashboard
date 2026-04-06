// src/pages/rows/RowChart/overlays/Engine17Overlay.jsx
// Engine 17 visual overlay layer for Lightweight Charts
//
// Snapshot-composed truth only for visible chart state.
// Raw morning-fib belongs in diagnostics only.

export default function Engine17Overlay({
  chart,
  priceSeries,
  chartContainer,
  overlayData,

  showLiquidityZones = false,
  showMarketStructure = false,
  showSignals = true,
  showSignalProvenance = false,
  showForwardRiskMap = false,
  showRegimeBackground = false,
  showTriggerLine = true,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let canvas = null;
  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;

    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas engine17-overlay";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 81,
    });

    chartContainer.appendChild(cnv);
    canvas = cnv;
    return canvas;
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

  function lineColor(kind) {
    if (kind === "CONTINUATION_WATCH_SHORT") return "#60a5fa";
    if (kind === "CONTINUATION_TRIGGER_SHORT") return "#22c55e";
    if (kind === "EXHAUSTION_EARLY_SHORT") return "#f59e0b";
    if (kind === "EXHAUSTION_TRIGGER_SHORT") return "#ef4444";

    if (kind === "CONTINUATION_WATCH_LONG") return "#60a5fa";
    if (kind === "CONTINUATION_TRIGGER_LONG") return "#22c55e";
    if (kind === "EXHAUSTION_EARLY_LONG") return "#facc15";
    if (kind === "EXHAUSTION_TRIGGER_LONG") return "#22c55e";

    return "#f3f4f6";
  }

  function markerText(kind, label) {
    if (label) return label;
    return String(kind || "").replaceAll("_", " ");
  }

  function drawTriggerLine(ctx, w) {
    const trigger = overlayData?.fib?.trigger;
    if (!showTriggerLine || !trigger || !Number.isFinite(trigger?.level)) return;

    const y = priceToY(trigger.level);
    if (y == null) return;

    const color = trigger.side === "SHORT" ? "#ef4444" : "#22c55e";

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();

    const lineLabel = trigger.lineLabel || `${trigger.side} TRIGGER`;
    const detailLabel = trigger.label || lineLabel;

    ctx.save();
    ctx.font = "22px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const text = `${lineLabel}  ${Number(trigger.level).toFixed(2)}`;
    const tw = ctx.measureText(text).width;
    const bw = tw + 24;
    const bh = 34;
    const bx = Math.max(24, Math.floor(w * 0.52));
    const by = y - 38;

    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, bx + 12, by + 23);
    ctx.restore();

    ctx.save();
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const tw2 = ctx.measureText(detailLabel).width;
    const bw2 = tw2 + 22;
    const bh2 = 30;
    const bx2 = Math.max(24, Math.floor(w * 0.52) + 36);
    const by2 = y + 10;

    ctx.fillStyle = "rgba(0,0,0,0.76)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, bx2, by2, bw2, bh2, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.fillText(detailLabel, bx2 + 11, by2 + 20);
    ctx.restore();
  }

  function drawSignalMarker(ctx, w, price, kind, label) {
    const y = priceToY(price);
    if (y == null) return;

    const color = lineColor(kind);
    const text = markerText(kind, label);

    let radius = 7;
    if (kind.includes("TRIGGER")) radius = 9;
    if (kind.includes("EARLY")) radius = 8;

    const x = Math.floor(w * 0.82);

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const tw = ctx.measureText(text).width;
    const bw = tw + 20;
    const bh = 28;
    const bx = Math.max(24, x + 16);
    const by = y - bh / 2;

    ctx.fillStyle = "rgba(0,0,0,0.80)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, bx + 10, by + 19);
    ctx.restore();
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

    if (!overlayData?.ok) return;

    const w = rect.width;

    drawTriggerLine(ctx, w);

    if (showSignals) {
      const signals = Array.isArray(overlayData?.signals) ? overlayData.signals : [];
      signals.forEach((s) => {
        if (!Number.isFinite(s?.price)) return;
        drawSignalMarker(
          ctx,
          w,
          s.price,
          s.kind,
          showSignalProvenance ? `E16 • ${s.label || s.kind}` : (s.label || s.kind)
        );
      });
    }
  }

  const visibleCb = () => draw();
  ts.subscribeVisibleTimeRangeChange?.(visibleCb);

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    try {
      ts.unsubscribeVisibleTimeRangeChange?.(visibleCb);
    } catch {}
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
  }

  return { seed, update, destroy };
}
