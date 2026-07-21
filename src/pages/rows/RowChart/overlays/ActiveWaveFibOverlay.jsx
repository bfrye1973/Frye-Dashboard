// src/pages/rows/RowChart/overlays/ActiveWaveFibOverlay.jsx
// Engine 2B — ES Active Wave Fib Overlay
//
// Source of truth:
//   GET /api/v1/waves/active?symbol=ES
//
// Draw contract:
//   activeStructures[degree].targetModel.displayLevels
//
// Fallback contract:
//   activeStructures[degree].targetModel.levels
//
// Important:
// - This overlay displays backend-built active extension targets.
// - It does not calculate Elliott waves or fib targets.
// - "micro" is mapped internally to activeStructures.subminute.
// - The visible label remains MICRO.
// - Data refreshes every 15 seconds while the overlay is attached.

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

const POLL_MS = 15_000;

const LEVEL_ORDER = [
  ["1.000", "e100"],
  ["1.272", "e1272"],
  ["1.618", "e1618"],
  ["2.000", "e200"],
  ["2.618", "e2618"],
];

function normalizeSymbol(value) {
  return String(value || "ES").trim().toUpperCase() || "ES";
}

function normalizeDegree(value) {
  const degree = String(value || "minute").trim().toLowerCase();
  return degree === "micro" ? "subminute" : degree;
}

function displayDegree(value) {
  const degree = String(value || "minute").trim().toLowerCase();
  return degree === "micro" || degree === "subminute"
    ? "MICRO"
    : degree.toUpperCase();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDisplayLevels(targetModel) {
  const displayLevels = Array.isArray(targetModel?.displayLevels)
    ? targetModel.displayLevels
        .map((level) => ({
          label: String(level?.label || "").trim(),
          price: finiteNumber(level?.price),
        }))
        .filter((level) => level.label && level.price !== null)
    : [];

  if (displayLevels.length > 0) {
    return displayLevels;
  }

  const levels = targetModel?.levels;

  if (!levels || typeof levels !== "object") {
    return [];
  }

  return LEVEL_ORDER.map(([label, key]) => ({
    label,
    price: finiteNumber(levels[key]),
  })).filter((level) => level.price !== null);
}

export default function ActiveWaveFibOverlay({
  chart,
  priceSeries,
  chartContainer,
  enabled = false,
  symbol = "ES",
  degree = "minute",
  style = {},
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return {
      seed() {},
      update() {},
      destroy() {},
    };
  }

  const normalizedSymbol = normalizeSymbol(symbol);
  const activeDegree = normalizeDegree(degree);
  const visibleDegree = displayDegree(degree);

  const overlayStyle = {
    color: style.color || "#ffd54a",
    fontPx: Number.isFinite(style.fontPx) ? style.fontPx : 16,
    lineWidth: Number.isFinite(style.lineWidth) ? style.lineWidth : 3,
    debug: style.debug === true,
  };

  let canvas = null;
  let raf = null;
  let resizeObserver = null;
  let pollTimer = null;
  let disposed = false;
  let activeWaveState = null;
  let levels = [];
  let fetchInFlight = false;

  const timeScale = chart.timeScale();

  function buildUrl() {
    const url = new URL(
      `${String(API_BASE).replace(/\/+$/, "")}/api/v1/waves/active`
    );

    url.searchParams.set("symbol", normalizedSymbol);
    url.searchParams.set("t", String(Date.now()));

    return url.toString();
  }

  async function fetchActiveWaveState() {
    if (disposed || !enabled || fetchInFlight) return;

    fetchInFlight = true;

    try {
      const response = await fetch(buildUrl(), {
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `ACTIVE_WAVE_STATE_HTTP_${response.status}`
        );
      }

      activeWaveState = payload;

      const structure =
        activeWaveState?.activeStructures?.[activeDegree] || null;

      levels = normalizeDisplayLevels(structure?.targetModel);

      if (overlayStyle.debug) {
        // eslint-disable-next-line no-console
        console.debug("[activeWaveFibOverlay] fetched", {
          symbol: normalizedSymbol,
          requestedDegree: degree,
          activeDegree,
          visibleDegree,
          schema: activeWaveState?.schema || null,
          levelCount: levels.length,
          levels,
        });
      }
    } catch (error) {
      activeWaveState = null;
      levels = [];

      if (overlayStyle.debug) {
        // eslint-disable-next-line no-console
        console.debug("[activeWaveFibOverlay] fetch failed", {
          symbol: normalizedSymbol,
          degree: activeDegree,
          error,
        });
      }
    } finally {
      fetchInFlight = false;
      scheduleDraw();
    }
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

    try {
      canvas.remove();
    } catch {}

    canvas = null;
  }

  function resizeCanvas() {
    if (!canvas) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function formatPrice(value) {
    return Number(value).toFixed(2);
  }

  function draw() {
    if (disposed) return;

    if (!enabled || levels.length === 0) {
      removeCanvas();
      return;
    }

    const currentCanvas = ensureCanvas();
    resizeCanvas();

    const context = currentCanvas.getContext("2d");

    if (!context) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      currentCanvas.width,
      currentCanvas.height
    );
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fontSize = Math.max(
      10,
      Math.min(64, overlayStyle.fontPx)
    );

    const font =
      `${fontSize}px system-ui, -apple-system, ` +
      "Segoe UI, Roboto, Arial";

    const labelX = Math.round(rect.width * 0.52);

    for (const level of levels) {
      const price = finiteNumber(level.price);

      if (price === null) continue;

      const y = priceSeries.priceToCoordinate(price);

      if (y == null || !Number.isFinite(y)) continue;

      context.save();
      context.strokeStyle = overlayStyle.color;
      context.lineWidth = Math.max(1, overlayStyle.lineWidth);
      context.setLineDash([22, 14]);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(rect.width, y);
      context.stroke();
      context.restore();

      const text =
        `${visibleDegree} ${level.label} ${formatPrice(price)}`;

      context.save();
      context.font = font;

      const textWidth = context.measureText(text).width;
      const boxWidth = Math.max(190, textWidth + 24);
      const boxHeight = Math.max(
        24,
        Math.floor(fontSize * 1.45)
      );

      const boxX = Math.min(
        Math.max(12, labelX - boxWidth / 2),
        Math.max(12, rect.width - boxWidth - 12)
      );

      const boxY = y - boxHeight / 2;

      context.fillStyle = "rgba(0,0,0,0.76)";
      context.strokeStyle = "rgba(255,255,255,0.22)";
      context.lineWidth = 2;

      drawRoundedRect(
        context,
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        10
      );

      context.fill();
      context.stroke();

      context.fillStyle = overlayStyle.color;
      context.fillText(
        text,
        boxX + 12,
        boxY + Math.floor(boxHeight * 0.72)
      );

      context.restore();
    }
  }

  function scheduleDraw() {
    if (disposed) return;

    if (raf) {
      cancelAnimationFrame(raf);
    }

    raf = requestAnimationFrame(() => {
      raf = null;
      draw();
    });
  }

  function startPolling() {
    if (pollTimer || disposed || !enabled) return;

    pollTimer = setInterval(() => {
      fetchActiveWaveState();
    }, POLL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;

    clearInterval(pollTimer);
    pollTimer = null;
  }

  function seed() {
    if (!enabled || disposed) {
      removeCanvas();
      return;
    }

    fetchActiveWaveState();
    startPolling();
    scheduleDraw();
  }

  function update() {
    if (!enabled || disposed) {
      removeCanvas();
      return;
    }

    // Network refresh is handled by the 15-second poll.
    // Live ticks only redraw the existing canonical levels.
    scheduleDraw();
  }

  function destroy() {
    if (disposed) return;

    disposed = true;
    stopPolling();

    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }

    try {
      timeScale.unsubscribeVisibleTimeRangeChange(onVisibleRangeChange);
    } catch {}

    try {
      resizeObserver?.disconnect?.();
    } catch {}

    resizeObserver = null;
    activeWaveState = null;
    levels = [];
    removeCanvas();
  }

  function onVisibleRangeChange() {
    scheduleDraw();
  }

  timeScale.subscribeVisibleTimeRangeChange(onVisibleRangeChange);

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      scheduleDraw();
    });

    resizeObserver.observe(chartContainer);
  }

  if (enabled) {
    startPolling();
  }

  return {
    seed,
    update,
    destroy,
  };
}
