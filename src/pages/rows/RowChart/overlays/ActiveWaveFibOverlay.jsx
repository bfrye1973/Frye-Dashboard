// ActiveWaveFibOverlay.jsx
// Engine 2B ES active wave fib overlay Phase 2

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

function normalizeExtensionLevels(targetModel) {
  const displayLevels = Array.isArray(targetModel?.displayLevels)
    ? targetModel.displayLevels
        .map((level) => ({
          label: String(level?.label || "").trim(),
          price: finiteNumber(level?.price),
        }))
        .filter((level) => level.label && level.price !== null)
    : [];

  if (displayLevels.length > 0) return displayLevels;

  const levels = targetModel?.levels;
  if (!levels || typeof levels !== "object") return [];

  return LEVEL_ORDER.map(([label, key]) => ({
    label,
    price: finiteNumber(levels[key]),
  })).filter((level) => level.price !== null);
}

function parseBackendTime(value) {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{10,13}$/.test(raw)) {
    const number = Number(raw);
    return number > 1e12 ? Math.floor(number / 1000) : Math.floor(number);
  }

  // Active-wave-state timestamps are stored in Arizona local time.
  // Arizona remains on UTC-07:00 year-round, so preserve that clock time
  // before snapping the point to the nearest loaded chart candle.
  const normalized = raw.includes("T")
    ? raw
    : raw.replace(" ", "T");

  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}-07:00`;

  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function normalizeMarks(marks) {
  if (!marks || typeof marks !== "object") return [];

  const output = [];

  for (const label of ["W1", "W2", "W3", "W4", "W5"]) {
    const mark = marks[label];
    if (!mark || typeof mark !== "object") continue;

    const status = String(mark.status || "").toUpperCase();
    const confirmed = status === "CONFIRMED";

    if (label === "W1") {
      const lowPrice = finiteNumber(mark?.low?.price);
      const lowTime = parseBackendTime(mark?.low?.time);
      const highPrice = finiteNumber(mark?.high?.price);
      const highTime = parseBackendTime(mark?.high?.time);

      if (lowPrice !== null && lowTime !== null) {
        output.push({
          label: "W1 LOW",
          shortLabel: "1L",
          price: lowPrice,
          timeSec: lowTime,
          confirmed,
          status,
        });
      }

      if (highPrice !== null && highTime !== null) {
        output.push({
          label: "W1 HIGH",
          shortLabel: "1",
          price: highPrice,
          timeSec: highTime,
          confirmed,
          status,
        });
      }

      continue;
    }

    const price = finiteNumber(mark.price);
    const timeSec = parseBackendTime(mark.time);

    if (price === null || timeSec === null) continue;

    output.push({
      label,
      shortLabel: label.replace("W", ""),
      price,
      timeSec,
      confirmed,
      status,
    });
  }

  return output;
}

function buildDecisionLines(structure, visibleDegree) {
  const watch = structure?.decisionWatch || {};
  const targetModel = structure?.targetModel || {};
  const lines = [];

  const add = (price, label, kind, color, dash = []) => {
    const value = finiteNumber(price);
    if (value === null) return;

    lines.push({
      price: value,
      label,
      kind,
      color,
      dash,
    });
  };

  add(
    watch.supportHoldLevel,
    `${visibleDegree} SUPPORT`,
    "support",
    "#22c55e",
    []
  );

  add(
    watch.warningLevel,
    `${visibleDegree} WARNING`,
    "warning",
    "#f59e0b",
    [10, 8]
  );

  add(
    watch.reclaimLevel,
    `${visibleDegree} RECLAIM`,
    "reclaim",
    "#22d3ee",
    [12, 8]
  );

  if (Array.isArray(watch.confirmationLevels)) {
    watch.confirmationLevels.forEach((price, index) => {
      add(
        price,
        `${visibleDegree} CONFIRM ${index + 1}`,
        "confirmation",
        "#38bdf8",
        [12, 8]
      );
    });
  }

  add(
    watch.subminuteInvalidation,
    `${visibleDegree} SUBMIN INV`,
    "invalidation",
    "#ef4444",
    [14, 10]
  );

  add(
    watch.minuteInvalidation,
    `${visibleDegree} MINUTE INV`,
    "invalidation",
    "#ef4444",
    [14, 10]
  );

  add(
    watch.minorInvalidation,
    `${visibleDegree} MINOR INV`,
    "invalidation",
    "#dc2626",
    [16, 10]
  );

  add(
    targetModel.projectionBase,
    `${visibleDegree} BASE`,
    "base",
    "#a78bfa",
    [8, 8]
  );

  // Consolidate labels that share the exact same price.
  const byPrice = new Map();

  for (const line of lines) {
    const key = line.price.toFixed(4);

    if (!byPrice.has(key)) {
      byPrice.set(key, { ...line, labels: [line.label] });
      continue;
    }

    const existing = byPrice.get(key);
    existing.labels.push(line.label);

    // Prefer invalidation styling at overlapping prices.
    if (line.kind === "invalidation") {
      existing.kind = line.kind;
      existing.color = line.color;
      existing.dash = line.dash;
    }
  }

  return Array.from(byPrice.values()).map((line) => ({
    ...line,
    label: line.labels.join(" • "),
  }));
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
    waveLabelColor: style.waveLabelColor || style.color || "#ffd54a",
    waveLineColor: style.waveLineColor || style.color || "#ffd54a",
    waveLineWidth: Number.isFinite(style.waveLineWidth)
      ? style.waveLineWidth
      : Math.max(2, Number.isFinite(style.lineWidth) ? style.lineWidth : 3),
    debug: style.debug === true,
  };

  let canvas = null;
  let raf = null;
  let disposed = false;

  let activeWaveState = null;
  let extensionLevels = [];
  let waveMarks = [];
  let decisionLines = [];

  let lastFetchMs = 0;
  let fetchInFlight = false;
  let seeded = false;
  let pollTimer = null;

  let bars = [];
  let barIntervalSec = 0;

  const ts = chart.timeScale();

  function buildUrl() {
    const url = new URL(
      `${String(API_BASE).replace(/\/+$/, "")}/api/v1/waves/active`
    );

    url.searchParams.set("symbol", "ES");
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || `ACTIVE_WAVE_STATE_HTTP_${response.status}`
        );
      }

      activeWaveState = data;

      const structure =
        activeWaveState?.activeStructures?.[mappedDegree] || null;

      extensionLevels = normalizeExtensionLevels(structure?.targetModel);
      waveMarks = normalizeMarks(structure?.marks);
      decisionLines = buildDecisionLines(structure, visibleDegree);

      if (s.debug) {
        console.debug("[ActiveWaveFibOverlay] fetched", {
          requestedSymbol,
          returnedSymbol: data?.symbol,
          schema: data?.schema,
          degree,
          mappedDegree,
          extensionCount: extensionLevels.length,
          markCount: waveMarks.length,
          decisionLineCount: decisionLines.length,
          waveMarks,
          decisionLines,
        });
      }
    } catch (error) {
      activeWaveState = null;
      extensionLevels = [];
      waveMarks = [];
      decisionLines = [];

      console.debug("[ActiveWaveFibOverlay] fetch failed", {
        requestedSymbol,
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

  function setBars(barsAsc) {
    bars = Array.isArray(barsAsc) ? barsAsc : [];

    if (bars.length >= 2) {
      const first = Number(bars[0]?.time);
      const second = Number(bars[1]?.time);
      const difference = Math.abs(second - first);

      barIntervalSec =
        Number.isFinite(difference) && difference > 0
          ? difference
          : 0;
    } else {
      barIntervalSec = 0;
    }
  }

  function snapToNearestBarTime(timeSec) {
    if (!Number.isFinite(timeSec) || !bars.length) return timeSec;

    let low = 0;
    let high = bars.length - 1;

    while (low < high) {
      const middle = (low + high) >> 1;
      const middleTime = Number(bars[middle]?.time);

      if (middleTime < timeSec) low = middle + 1;
      else high = middle;
    }

    const candidates = [];

    if (low >= 0 && low < bars.length) {
      candidates.push(Number(bars[low]?.time));
    }

    if (low - 1 >= 0) {
      candidates.push(Number(bars[low - 1]?.time));
    }

    let best = timeSec;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      if (!Number.isFinite(candidate)) continue;

      const distance = Math.abs(candidate - timeSec);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }

    // Backend timestamps may be hourly while the chart uses 10m bars.
    // Allow a broad but bounded snap window.
    const maxSnap = barIntervalSec
      ? Math.max(barIntervalSec * 18, 8 * 60 * 60)
      : 12 * 60 * 60;

    return bestDistance <= maxSnap ? best : timeSec;
  }

  function timeToX(timeSec) {
    if (!Number.isFinite(timeSec)) return null;

    try {
      const snapped = snapToNearestBarTime(timeSec);
      const x = ts.timeToCoordinate(snapped);
      return Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  }

  function drawHorizontalLevel(ctx, rect, line) {
    const y = priceSeries.priceToCoordinate(line.price);

    if (y == null || !Number.isFinite(y)) return false;

    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = Math.max(
      1,
      s.lineWidth * (line.kind === "invalidation" ? 1.35 : 1)
    );
    ctx.setLineDash(line.dash || []);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
    ctx.restore();

    const fontPx = Math.max(10, Math.min(58, s.fontPx - 1));
    const font =
      `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const text = `${line.label}  ${formatPrice(line.price)}`;

    ctx.save();
    ctx.font = font;

    const textWidth = ctx.measureText(text).width;
    const boxWidth = Math.max(185, textWidth + 22);
    const boxHeight = Math.max(22, Math.floor(fontPx * 1.35));
    const boxX = Math.min(
      Math.max(12, Math.round(rect.width * 0.16)),
      rect.width - boxWidth - 12
    );
    const boxY = y - boxHeight / 2;

    ctx.fillStyle = "rgba(0,0,0,0.74)";
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 2;

    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = line.color;
    ctx.fillText(
      text,
      boxX + 11,
      boxY + Math.floor(boxHeight * 0.72)
    );

    ctx.restore();
    return true;
  }

  function drawExtensionLevel(ctx, rect, level) {
    const y = priceSeries.priceToCoordinate(level.price);

    if (y == null || !Number.isFinite(y)) return false;

    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.lineWidth) * 1.2;
    ctx.setLineDash([22, 14]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
    ctx.restore();

    const fontPx = Math.max(10, Math.min(64, s.fontPx));
    const font =
      `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const text =
      `${visibleDegree} ${level.label}  ${formatPrice(level.price)}`;

    ctx.save();
    ctx.font = font;

    const textWidth = ctx.measureText(text).width;
    const boxWidth = Math.max(190, textWidth + 24);
    const boxHeight = Math.max(22, Math.floor(fontPx * 1.35));
    const boxX = Math.min(
      Math.max(12, Math.round(rect.width * 0.52) - boxWidth / 2),
      rect.width - boxWidth - 12
    );
    const boxY = y - boxHeight / 2;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;

    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = s.color;
    ctx.fillText(
      text,
      boxX + 12,
      boxY + Math.floor(boxHeight * 0.72)
    );

    ctx.restore();
    return true;
  }

  function drawWaveMarks(ctx, rect) {
    const points = [];

    for (const mark of waveMarks) {
      const x = timeToX(mark.timeSec);
      const y = priceSeries.priceToCoordinate(mark.price);

      if (
        x == null ||
        y == null ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        continue;
      }

      points.push({ ...mark, x, y });
    }

    if (!points.length) return 0;

    // Connect confirmed points in chronological order.
    const sorted = [...points].sort((a, b) => a.timeSec - b.timeSec);

    if (sorted.length >= 2) {
      ctx.save();
      ctx.strokeStyle = s.waveLineColor;
      ctx.lineWidth = Math.max(1, s.waveLineWidth);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sorted[0].x, sorted[0].y);

      for (let index = 1; index < sorted.length; index += 1) {
        ctx.lineTo(sorted[index].x, sorted[index].y);
      }

      ctx.stroke();
      ctx.restore();
    }

    const fontPx = Math.max(11, Math.min(72, s.fontPx + 1));
    const font =
      `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    for (const point of points) {
      const text = point.shortLabel;
      const radius = Math.max(13, Math.floor(fontPx * 0.72));

      ctx.save();

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = point.confirmed
        ? "rgba(0,0,0,0.82)"
        : "rgba(0,0,0,0.55)";
      ctx.fill();

      ctx.strokeStyle = s.waveLabelColor;
      ctx.lineWidth = point.confirmed ? 3 : 2;
      ctx.setLineDash(point.confirmed ? [] : [5, 4]);
      ctx.stroke();

      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = s.waveLabelColor;
      ctx.fillText(text, point.x, point.y + 1);

      ctx.restore();

      const caption =
        `${visibleDegree} ${point.label} ${formatPrice(point.price)}`;

      ctx.save();
      ctx.font =
        `12px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

      const captionWidth = ctx.measureText(caption).width;
      const boxWidth = captionWidth + 14;
      const boxHeight = 20;
      const boxX = Math.min(
        Math.max(6, point.x - boxWidth / 2),
        rect.width - boxWidth - 6
      );
      const boxY = Math.max(6, point.y - radius - boxHeight - 5);

      ctx.fillStyle = "rgba(0,0,0,0.76)";
      roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 7);
      ctx.fill();

      ctx.fillStyle = s.waveLabelColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(caption, boxX + 7, boxY + 14);

      ctx.restore();
    }

    return points.length;
  }

  function draw() {
    if (disposed) return;

    if (!enabled) {
      removeCanvas();
      return;
    }

    if (
      !activeWaveState ||
      (
        extensionLevels.length === 0 &&
        waveMarks.length === 0 &&
        decisionLines.length === 0
      )
    ) {
      removeCanvas();
      return;
    }

    const currentCanvas = ensureCanvas();
    const context = currentCanvas.getContext("2d");

    if (!context) return;

    resizeCanvas();

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      currentCanvas.width,
      currentCanvas.height
    );
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let extensionDrawn = 0;
    let decisionDrawn = 0;

    for (const line of decisionLines) {
      if (drawHorizontalLevel(context, rect, line)) {
        decisionDrawn += 1;
      }
    }

    for (const level of extensionLevels) {
      if (drawExtensionLevel(context, rect, level)) {
        extensionDrawn += 1;
      }
    }

    const marksDrawn = drawWaveMarks(context, rect);

    if (s.debug) {
      console.debug("[ActiveWaveFibOverlay] draw", {
        requestedSymbol,
        degree,
        mappedDegree,
        extensionDrawn,
        decisionDrawn,
        marksDrawn,
        canvasWidth: currentCanvas.width,
        canvasHeight: currentCanvas.height,
      });
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

  function seed(barsAsc) {
    if (!enabled) return;

    seeded = true;
    setBars(barsAsc);

    maybeFetch(true).then(() => {
      scheduleDraw();
      startPolling();
    });
  }

  function update(latestBar) {
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

    if (latestBar && Number.isFinite(Number(latestBar.time))) {
      const time = Number(latestBar.time);

      if (!bars.length || time > Number(bars[bars.length - 1]?.time)) {
        bars.push(latestBar);

        if (bars.length > 8000) {
          bars = bars.slice(-8000);
        }
      }
    }

    scheduleDraw();
  }

  function destroy() {
    disposed = true;
    stopPolling();

    if (raf) cancelAnimationFrame(raf);
    raf = null;

    window.removeEventListener("resize", onResize);
    removeCanvas();

    activeWaveState = null;
    extensionLevels = [];
    waveMarks = [];
    decisionLines = [];
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
