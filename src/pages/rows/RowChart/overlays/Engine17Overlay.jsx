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

  function drawTextBox(ctx, text, x, y, color = "#f8fafc") {
    ctx.save();
    ctx.font = "17px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const tw = ctx.measureText(text).width;
    const bw = tw + 18;
    const bh = 28;

    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.25;
    roundRect(ctx, x, y, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, x + 9, y + 19);
    ctx.restore();
  }

  function drawTriggerLine(ctx, w) {
    const fib = overlayData?.fib || {};
    const locked = fib?.lockedSignal || null;
    const fallback = fib?.trigger || null;
    const signal = locked || fallback;

    if (!showTriggerLine || !signal) return;

    const price = locked?.signalPrice ?? fallback?.level ?? null;
    if (!Number.isFinite(price)) return;

    const y = priceToY(price);
    if (y == null) return;

    const direction = locked?.direction || fallback?.side;
    const color = direction === "SHORT" ? "#ef4444" : "#22c55e";

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();

    const lineLabel = locked
      ? `${locked.signalType} ${locked.direction}`
      : fallback?.lineLabel || `${fallback?.side} TRIGGER`;

    const detailLabel = locked
      ? `${locked.signalSource || "LOCKED"}`
      : fallback?.label || lineLabel;

    ctx.save();
    ctx.font = "22px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const text = `${lineLabel}  ${Number(price).toFixed(2)}`;
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

    drawTextBox(ctx, detailLabel, Math.max(24, Math.floor(w * 0.52) + 36), y + 10);
  }

  function drawStructureLine(ctx, w) {
    const fib = overlayData?.fib || {};

    const shortActive =
      fib?.prepBias === "SHORT_PREP" || fib?.continuationTriggerShort;
    const longActive =
      fib?.prepBias === "LONG_PREP" || fib?.continuationTriggerLong;

    let level = null;
    let color = "#f3f4f6";

    if (shortActive) {
      level = fib?.breakdownRef ?? fib?.lastHigherLow ?? null;
      color = "#ef4444";
    } else if (longActive) {
      level = fib?.lastLowerHigh ?? null;
      color = "#22c55e";
    }

    if (!Number.isFinite(level)) return;

    const y = priceToY(level);
    if (y == null) return;

    const confirmed =
      fib?.continuationTriggerShort || fib?.continuationTriggerLong;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = confirmed ? 2.5 : 1.75;
    ctx.setLineDash(confirmed ? [] : [8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = "16px system-ui";
    ctx.fillStyle = color;
    ctx.fillText(`STRUCTURE ${Number(level).toFixed(2)}`, Math.floor(w * 0.6), y - 10);
    ctx.restore();
  }

  function drawExecutionEntryLine(ctx, w) {
    const exec = overlayData?.executionState;

    if (!exec || exec.status !== "ENTERED") return;

    const entryPrice = exec?.levels?.entry;
    if (!Number.isFinite(entryPrice)) return;

    const y = priceToY(entryPrice);
    if (y == null) return;

    ctx.save();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();

    drawTextBox(ctx, `ENTRY ${entryPrice.toFixed(2)}`, Math.floor(w * 0.55), y - 40, "#22c55e");
  }

  function drawWaveRetraceOverlay(ctx, w) {
    const fib = overlayData?.fib || {};
    const engine22 = fib?.engine22Scalp || null;
    const e22State = String(engine22?.state || "").toUpperCase();

    const shouldShow =
      e22State === "W2_ACTIVE_WAIT" ||
      e22State === "W4_ACTIVE_WAIT" ||
      e22State === "W3_READY" ||
      e22State === "W5_READY";

    if (!shouldShow) return;

    const retrace =
      fib?.wave3Retrace ||
      fib?.waveContext?.wave3Retrace ||
      fib?.engine2State?.minute?.wave3Retrace ||
      overlayData?.engine2State?.minute?.wave3Retrace ||
      null;

    const levels = retrace?.levels || null;
    if (!levels) return;

    const prefix =
      e22State === "W2_ACTIVE_WAIT" || e22State === "W3_READY"
        ? "W2"
        : "W4";

    const items = [
      { key: "r382", label: `${prefix} 0.382`, price: levels.r382, color: "#fbbf24" },
      { key: "r500", label: `${prefix} 0.500`, price: levels.r500, color: "#f97316" },
      { key: "r618", label: `${prefix} 0.618`, price: levels.r618, color: "#22c55e" },
      { key: "r786", label: `${prefix} 0.786`, price: levels.r786, color: "#ef4444" },
    ];

    const y382 = priceToY(levels.r382);
    const y618 = priceToY(levels.r618);

    if (y382 != null && y618 != null) {
      const top = Math.min(y382, y618);
      const height = Math.abs(y618 - y382);

      ctx.save();
      ctx.fillStyle = "rgba(251,191,36,0.10)";
      ctx.fillRect(0, top, w, height);
      ctx.restore();

      drawTextBox(
        ctx,
        "Wave A Watch Zone",
        Math.floor(w * 0.62),
        top + Math.max(4, height / 2 - 14),
        "#fbbf24"
      );
    }

    items.forEach((item, index) => {
      if (!Number.isFinite(item.price)) return;

      const y = priceToY(item.price);
      if (y == null) return;

      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.key === "r500" || item.key === "r618" ? 2 : 1.5;
      ctx.setLineDash(item.key === "r786" ? [4, 8] : [10, 8]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.restore();

      const text = `${item.label} ${Number(item.price).toFixed(2)}`;
      drawTextBox(ctx, text, Math.floor(w * 0.72), y - 14 + index * 2, item.color);
    });
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

    drawWaveRetraceOverlay(ctx, w);
    drawTriggerLine(ctx, w);
    drawStructureLine(ctx, w);
    drawExecutionEntryLine(ctx, w);

    if (showSignals) {
      const signals = Array.isArray(overlayData?.signals) ? overlayData.signals : [];
      signals.forEach((s) => {
        if (!Number.isFinite(s?.price)) return;
        drawSignalMarker(
          ctx,
          w,
          s.price,
          s.kind,
          showSignalProvenance ? `E16 • ${s.label || s.kind}` : s.label || s.kind
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
