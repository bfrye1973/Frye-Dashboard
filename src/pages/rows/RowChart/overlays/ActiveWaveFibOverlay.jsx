// src/pages/rows/RowChart/overlays/ActiveWaveFibOverlay.jsx
// Engine 2B — ES Active Wave Fib Overlay
//
// Proven architecture copied from the working legacy FibLevelsOverlay.jsx:
// - canvas overlay appended to chartContainer
// - seed(barsAsc)
// - update(latestBar)
// - destroy()
// - requestAnimationFrame redraw
// - window resize handling
// - visible-range redraw
// - priceSeries.priceToCoordinate(price)
//
// ES source of truth:
//   GET /api/v1/waves/active?symbol=ES
//
// Draw contract:
//   activeStructures[degree].targetModel.displayLevels
//
// Fallback:
//   activeStructures[degree].targetModel.levels
//
// Important:
// - This file does not calculate Elliott waves or fib targets.
// - Micro maps internally to subminute.
// - Visible labels remain MICRO.
// - SPY continues using the legacy FibLevelsOverlay.jsx.

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

function mapDegree(value) {
  const degree = String(value || "minute").trim().toLowerCase();
  return degree === "micro" ? "subminute" : degree;
}

function visibleDegreeLabel(value) {
  const degree = String(value || "minute").trim().toLowerCase();
  return degree === "micro" || degree === "subminute"
    ? "MICRO"
    : degree.toUpperCase();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLevels(targetModel) {
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
  tf = "10m",
  style = {},
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  const requestedSymbol = String(symbol || "ES").trim().toUpperCase();
  const mappedDegree = mapDegree(degree);
  const visibleDegree = visibleDegreeLabel(degree);

  const s = {
    color: style.color || "#ffd54a",
    fontPx: Number.isFinite(style.fontPx) ? style.fontPx : 18,
    lineWidth: Number.isFinite(style.lineWidth) ? style.lineWidth : 3,
    debug: style.debug === true,
  };

  let canvas = null;
  let raf = null;
  let disposed = false;

  let activeWaveState = null;
  let levels = [];

  let lastFetchMs = 0;
  let fetchInFlight = false;
  let seeded = false;
  let pollTimer = null;

  const ts = chart.timeScale();

  console.debug("[ActiveWaveFibOverlay] init", {
    enabled,
    requestedSymbol,
    fetchSymbol: "ES",
    degree,
    mappedDegree,
    tf,
  });

  function buildUrl() {
    const u = new URL(
      `${String(API_BASE).replace(/\/+$/, "")}/api/v1/waves/active`
    );

    // Engine 2B Phase 1 is ES-only.
    u.searchParams.set("symbol", "ES");
    u.searchParams.set("t", String(Date.now()));

    return u.toString();
  }

  async function fetchActiveWaveState() {
    if (disposed || !enabled || fetchInFlight) return;

    fetchInFlight = true;

    try {
      const response = await fetch(buildUrl(), {
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || `ACTIVE_WAVE_STATE_HTTP_${response.status}`
        );
      }

      activeWaveState = data;

      const structure =
        activeWaveState?.activeStructures?.[mappedDegree] || null;

      levels = normalizeLevels(structure?.targetModel);

      console.debug("[ActiveWaveFibOverlay] fetched", {
        ok: response.ok,
        requestedSymbol,
        returnedSymbol: data?.symbol,
        schema: data?.schema,
        degree,
        mappedDegree,
        hasStructures: !!data?.activeStructures,
        hasTargetModel: !!structure?.targetModel,
        levelCount: levels.length,
        levels,
      });
    } catch (error) {
      activeWaveState = null;
      levels = [];

      console.debug("[ActiveWaveFibOverlay] fetch failed", {
        requestedSymbol,
        fetchSymbol: "ES",
        degree,
        mappedDegree,
        error,
      });
    } finally {
      fetchInFlight = false;
    }
  }

  function maybeFetch(force = false) {
    const now = Date.now();
    const minGapMs = force ? 0 : POLL_MS;

    if (!force && now - lastFetchMs < minGapMs) {
      return Promise.resolve();
    }

    lastFetchMs = now;
    return fetchActiveWaveState();
  }

  function ensureCanvas() {
    if (canvas) return canvas;

    canvas = document.createElement("canvas");
    canvas.setAttribute("data-active-wave-fib-overlay", mappedDegree);
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
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function draw() {
    if (disposed) return;

    if (!enabled) {
      removeCanvas();
      return;
    }

    if (!activeWaveState || levels.length === 0) {
      removeCanvas();

      console.debug("[ActiveWaveFibOverlay] draw skipped", {
        enabled,
        requestedSymbol,
        degree,
        mappedDegree,
        hasState: !!activeWaveState,
        levelCount: levels.length,
      });

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

    const fontPx = Math.max(10, Math.min(64, s.fontPx));
    const headerPx = Math.max(10, Math.min(72, s.fontPx + 2));

    const FONT =
      `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const HEADER =
      `${headerPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const labelX = Math.round(rect.width * 0.52);

    ctx.font = HEADER;
    ctx.fillStyle = "rgba(255,255,255,0.90)";

    const title = `ACTIVE FIB ${visibleDegree} • ES • ${tf}`;
    const titleWidth = ctx.measureText(title).width;

    ctx.fillText(
      title,
      Math.max(12, (rect.width - titleWidth) / 2),
      Math.max(26, s.fontPx + 10)
    );

    let drawnCount = 0;
    const skipped = [];

    for (const level of levels) {
      const price = finiteNumber(level.price);

      if (price === null) {
        skipped.push({
          label: level?.label,
          price: level?.price,
          reason: "INVALID_PRICE",
        });
        continue;
      }

      const y = priceSeries.priceToCoordinate(price);

      if (y == null || !Number.isFinite(y)) {
        skipped.push({
          label: level.label,
          price,
          reason: "NO_PRICE_COORDINATE",
        });
        continue;
      }

      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, s.lineWidth) * 1.2;
      ctx.setLineDash([22, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = FONT;

      const text =
        `${visibleDegree} ${level.label}  ${formatPrice(price)}`;

      const textWidth = ctx.measureText(text).width;
      const boxWidth = Math.max(190, textWidth + 24);
      const boxHeight = Math.max(22, Math.floor(fontPx * 1.35));

      const boxX = Math.min(
        Math.max(12, labelX - boxWidth / 2),
        rect.width - boxWidth - 12
      );

      const boxY = y - boxHeight / 2;

      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;

      roundRect(
        ctx,
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        10
      );

      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = s.color;
      ctx.fillText(
        text,
        boxX + 12,
        boxY + Math.floor(boxHeight * 0.72)
      );

      ctx.restore();
      drawnCount += 1;
    }

    console.debug("[ActiveWaveFibOverlay] draw", {
      enabled,
      requestedSymbol,
      fetchSymbol: "ES",
      degree,
      mappedDegree,
      levelCount: levels.length,
      drawnCount,
      skipped,
      canvasAttached: !!canvas,
      cssWidth: rect.width,
      cssHeight: rect.height,
      pixelWidth: canvas?.width,
      pixelHeight: canvas?.height,
      hostPosition: window.getComputedStyle(chartContainer).position,
    });
  }

  function scheduleDraw() {
    if (disposed) return;

    if (raf) {
      cancelAnimationFrame(raf);
    }

    raf = requestAnimationFrame(draw);
  }

  function onResize() {
    resizeCanvas();
    scheduleDraw();
  }

  function startPolling() {
    if (pollTimer || disposed || !enabled) return;

    pollTimer = setInterval(() => {
      maybeFetch(true).then(scheduleDraw);
    }, POLL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;

    clearInterval(pollTimer);
    pollTimer = null;
  }

  function seed(_barsAsc) {
    if (!enabled) return;

    seeded = true;

    maybeFetch(true).then(() => {
      scheduleDraw();
      startPolling();
    });
  }

  function update(_latestBar) {
    if (!enabled) {
      removeCanvas();
      return;
    }

    if (!seeded) {
      seeded = true;

      maybeFetch(true).then(() => {
        scheduleDraw();
        startPolling();
      });

      return;
    }

    scheduleDraw();
  }

  function destroy() {
    disposed = true;
    stopPolling();

    if (raf) {
      cancelAnimationFrame(raf);
    }

    raf = null;

    window.removeEventListener("resize", onResize);
    removeCanvas();

    activeWaveState = null;
    levels = [];
  }

  window.addEventListener("resize", onResize);

  const visibleRangeCallback = () => scheduleDraw();
  ts.subscribeVisibleTimeRangeChange(visibleRangeCallback);

  return {
    seed,
    update,
    destroy: () => {
      try {
        ts.unsubscribeVisibleTimeRangeChange(visibleRangeCallback);
      } catch {}

      destroy();
    },
  };
}

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
