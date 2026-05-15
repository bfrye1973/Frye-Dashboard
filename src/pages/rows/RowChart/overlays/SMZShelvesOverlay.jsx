// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx
// Overlay for Accumulation / Distribution shelves
//
// SPY:
//   /api/v1/smz-shelves?symbol=SPY
//
// ES:
//   /api/v1/es-smz-shelves?symbol=ES
//
// LOCKED:
// - accumulation = blue
// - distribution = red
// - shelves are never yellow
//
// ES Engine 1B:
// - 30m detects shelves
// - 1h confirms shelves
// - levels[].active + levels[].confirmTimeframe indicate confirmed/active shelf

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

function getShelvesUrl(symbol) {
  const clean = String(symbol || "SPY").toUpperCase().trim();
  const base = API_BASE.replace(/\/+$/, "");

  if (clean === "ES") {
    return `${base}/api/v1/es-smz-shelves?symbol=ES`;
  }

  return `${base}/api/v1/smz-shelves?symbol=${encodeURIComponent(clean)}`;
}

function clipText(s, max = 28) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

// Prefer strength_raw for truth; fallback to strength
function getStrengthRaw(lvl) {
  const raw = Number(lvl?.strength_raw);
  if (Number.isFinite(raw)) return raw;

  const s = Number(lvl?.strength);
  return Number.isFinite(s) ? s : NaN;
}

function getConfidence(lvl) {
  const c = Number(lvl?.confidence);
  return Number.isFinite(c) ? c : null;
}

function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLevel(lvl, fallbackSymbol) {
  if (!lvl || typeof lvl !== "object") return null;

  const priceRange = Array.isArray(lvl.priceRange) ? lvl.priceRange : null;

  const rawHi =
    safeNum(lvl.hi) ??
    safeNum(lvl.high) ??
    safeNum(priceRange?.[0]);

  const rawLo =
    safeNum(lvl.lo) ??
    safeNum(lvl.low) ??
    safeNum(priceRange?.[1]);

  if (rawHi == null || rawLo == null) return null;

  const hi = Math.max(rawHi, rawLo);
  const lo = Math.min(rawHi, rawLo);
  const mid = safeNum(lvl.mid) ?? safeNum(lvl.price) ?? (hi + lo) / 2;

  const reason =
    lvl?.diagnostic?.reason ||
    lvl?.reason ||
    lvl?.comment ||
    "";

  return {
    ...lvl,
    id: lvl.id || `${lvl.symbol || fallbackSymbol}|${lvl.type || "shelf"}|${lo}|${hi}`,
    symbol: lvl.symbol || fallbackSymbol,
    type: lvl.type || "shelf",
    priceRange: [hi, lo],
    hi,
    lo,
    mid,
    active: lvl.active !== false,
    reason,
  };
}

export default function SMZShelvesOverlay({
  chart,
  priceSeries,
  chartContainer,
  symbol = "SPY",
  onSelect,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  const cleanSymbol = String(symbol || "SPY").toUpperCase().trim();

  let levels = [];
  let canvas = null;
  let destroyed = false;
  let hitBoxes = []; // { y0, y1, lvl }

  const ts = chart.timeScale();

  // Colors: shelves are never yellow
  const ACC_FILL = "rgba(0, 128, 255, 0.22)";
  const ACC_STROKE = "rgba(0, 128, 255, 0.95)";

  const DIST_FILL = "rgba(255, 0, 0, 0.20)";
  const DIST_STROKE = "rgba(255, 0, 0, 0.95)";

  // Keep shelves visually secondary to stronger SMZ overlays
  const STROKE_W = 2;

  function ensureCanvas() {
    if (canvas) return canvas;

    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-shelves";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 14,
    });

    chartContainer.appendChild(cnv);
    canvas = cnv;
    return canvas;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function resizeCanvas(cnv) {
    const dpr = window.devicePixelRatio || 1;
    const rect = chartContainer.getBoundingClientRect();

    const cssW = Math.max(1, Math.floor(rect.width || chartContainer.clientWidth || 1));
    const cssH = Math.max(1, Math.floor(rect.height || chartContainer.clientHeight || 1));

    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));

    if (cnv.width !== pxW) cnv.width = pxW;
    if (cnv.height !== pxH) cnv.height = pxH;

    cnv.style.width = `${cssW}px`;
    cnv.style.height = `${cssH}px`;

    return { w: cssW, h: cssH, dpr };
  }

  function drawCenteredLabel(ctx, xMid, yMid, text, stroke, boundsW, boundsH) {
    ctx.save();

    ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const padX = 16;
    const padY = 10;
    const metrics = ctx.measureText(text);
    const tw = Math.ceil(metrics.width);
    const th = 14;

    let x = Math.round(xMid);
    let y = Math.round(yMid);

    const boxW = tw + padX * 2;
    const boxH = th + padY * 2;

    const minX = Math.ceil(boxW / 2) + 2;
    const maxX = boundsW - Math.ceil(boxW / 2) - 2;
    const minY = Math.ceil(boxH / 2) + 2;
    const maxY = boundsH - Math.ceil(boxH / 2) - 2;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

    ctx.fillStyle = stroke;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  function getCurrentPrice() {
    try {
      const vr = ts?.getVisibleLogicalRange?.();
      const idx = vr?.to ?? null;
      if (idx == null) return null;

      const bar = priceSeries?.dataByIndex?.(idx, -1);
      const c = bar?.value ?? bar?.close ?? null;
      const n = Number(c);

      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  // Trader-safe type fallback:
  // - zone above current price => distribution
  // - zone below current price => accumulation
  function resolveType(lvl, hi, lo, currentPrice) {
    const t = String(lvl?.type || "").toLowerCase();
    const isAccum = t === "accumulation";
    const isDist = t === "distribution";

    if (Number.isFinite(currentPrice)) {
      if (lo > currentPrice) return "distribution"; // overhead supply
      if (hi < currentPrice) return "accumulation"; // support under price
    }

    if (isAccum) return "accumulation";
    if (isDist) return "distribution";

    if (Number.isFinite(currentPrice)) {
      return lo > currentPrice ? "distribution" : "accumulation";
    }

    return "accumulation";
  }

  function draw() {
    if (destroyed) return;

    const cnv = ensureCanvas();
    const { w, h, dpr } = resizeCanvas(cnv);

    const ctx = cnv.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    hitBoxes = [];

    if (!Array.isArray(levels) || levels.length === 0) return;

    const currentPrice = getCurrentPrice();

    for (const lvl of levels) {
      if (!lvl || lvl.active === false) continue;

      const hi = Number(lvl.hi);
      const lo = Number(lvl.lo);

      if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;

      const yTop = priceToY(hi);
      const yBot = priceToY(lo);

      if (yTop == null || yBot == null) continue;

      const y = Math.min(yTop, yBot);
      const bandH = Math.max(2, Math.abs(yBot - yTop));

      hitBoxes.push({ y0: y, y1: y + bandH, lvl });

      const type = resolveType(lvl, hi, lo, currentPrice);
      const isAccum = type === "accumulation";
      const fill = isAccum ? ACC_FILL : DIST_FILL;
      const stroke = isAccum ? ACC_STROKE : DIST_STROKE;

      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, bandH);

      ctx.strokeStyle = stroke;
      ctx.lineWidth = STROKE_W;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, bandH - 1));
      ctx.stroke();

      const strengthRaw = getStrengthRaw(lvl);
      const conf = getConfidence(lvl);

      const baseLabel = isAccum ? "Accumulation" : "Distribution";
      const sTxt = Number.isFinite(strengthRaw)
        ? ` ${Math.round(strengthRaw)}`
        : "";
      const cTxt = conf != null ? ` (${conf.toFixed(2)})` : "";

      const reason = cleanSymbol === "ES"
        ? clipText(lvl.reason || lvl?.diagnostic?.reason, 30)
        : clipText(lvl.comment || lvl.reason, 26);

      const reasonText = reason ? ` — ${reason}` : "";

      const tfText =
        cleanSymbol === "ES" && lvl.confirmTimeframe
          ? ` ${lvl.timeframe || ""}/${lvl.confirmTimeframe}`
          : "";

      const label = `${cleanSymbol} ${baseLabel}${sTxt}${cTxt}${tfText}${reasonText}`;

      drawCenteredLabel(ctx, w / 2, y + bandH / 2, label, stroke, w, h);
    }
  }

  function handleClick(evt) {
    if (destroyed) return;
    if (!hitBoxes.length) return;

    const rect = chartContainer.getBoundingClientRect();
    const y = evt.clientY - rect.top;

    const hits = hitBoxes.filter((hb) => y >= hb.y0 && y <= hb.y1);
    if (!hits.length) return;

    hits.sort(
      (a, b) =>
        Number(getStrengthRaw(b?.lvl) ?? 0) -
        Number(getStrengthRaw(a?.lvl) ?? 0)
    );

    const selected = hits[0].lvl;

    // Alt + Click → copy manual shelf line to clipboard
    if (evt.altKey) {
      const pr = selected?.priceRange;

      if (Array.isArray(pr) && pr.length === 2) {
        const hi = Math.max(pr[0], pr[1]).toFixed(2);
        const lo = Math.min(pr[0], pr[1]).toFixed(2);

        const type = (selected?.type || "").toUpperCase();
        const line = `${lo}-${hi}  # ${cleanSymbol} ${type} shelf`;

        try {
          navigator.clipboard.writeText(line);
          console.log("[SMZ] Copied shelf:", line);
        } catch {
          console.warn("[SMZ] Clipboard failed:", line);
        }
      }
    }

    const payload = { kind: "shelf", selected, symbol: cleanSymbol };

    if (typeof onSelect === "function") {
      onSelect(payload);
    } else {
      window.dispatchEvent(
        new CustomEvent("smz:shelfSelected", { detail: payload })
      );
    }
  }

  async function loadShelves() {
    try {
      const url = `${getShelvesUrl(cleanSymbol)}&_=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      const raw = Array.isArray(json?.levels)
        ? json.levels
        : Array.isArray(json?.shelves)
          ? json.shelves
          : [];

      levels = raw
        .map((lvl) => normalizeLevel(lvl, cleanSymbol))
        .filter(Boolean);

      draw();
    } catch (e) {
      console.error("[SMZShelvesOverlay] load failed:", e);
      levels = [];
      draw();
    }
  }

  loadShelves();

  document.addEventListener("click", handleClick, true);

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  const ro = new ResizeObserver(() => draw());

  try {
    ro.observe(chartContainer);
  } catch {}

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    destroyed = true;

    try {
      document.removeEventListener("click", handleClick, true);
    } catch {}

    try {
      unsubVisible();
    } catch {}

    try {
      ro.disconnect();
    } catch {}

    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}

    canvas = null;
    levels = [];
    hitBoxes = [];
  }

  return { seed, update, destroy };
}
