// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL PARENTS ONLY (yellow)
//
// Purpose:
// - Draw manual/institutional parent zones only.
// - Never draw negotiated zones here.
// - Negotiated/value zones are handled by SMZNegotiatedOverlay.jsx.
// - Acc/Dist shelves are handled by SMZShelvesOverlay.jsx.
//
// Routes:
// SPY manual institutional:
//   /api/v1/smz-levels?symbol=SPY
//
// ES manual institutional:
//   /api/v1/es-smz-levels?symbol=ES
//
// Expected ES route shape:
// - structures_sticky: manual parent + manual NEG zones
// - levels_debug: same debug/render list
// - levels may be empty
//
// This overlay filters out negotiated zones and draws only institutional parents.

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

function normalizeSymbol(value) {
  return String(value || "SPY").trim().toUpperCase() || "SPY";
}

function getSmzLevelsUrl(symbol) {
  const clean = normalizeSymbol(symbol);
  const base = API_BASE.replace(/\/+$/, "");

  if (clean === "ES") {
    return `${base}/api/v1/es-smz-levels?symbol=ES`;
  }

  return `${base}/api/v1/smz-levels?symbol=${encodeURIComponent(clean)}`;
}

export default function SMZLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
  symbol = "SPY",
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  const cleanSymbol = normalizeSymbol(symbol);

  let sticky = [];
  let canvas = null;
  let destroyed = false;

  const ts = chart.timeScale();

  // --- tuning knobs ---
  const PAD = cleanSymbol === "ES" ? 0.25 : 0.06;

  // Fill limits prevent giant yellow blob.
  const MAX_FILLED_MANUAL = cleanSymbol === "ES" ? 1 : 2;
  const MAX_FILLED_AUTO = 1;

  // Auto display limits prevent clutter.
  const MAX_AUTO_TOTAL = 2;
  const MAX_AUTO_LABEL = 2;
  const MIN_AUTO_STRENGTH = 85;

  // Institutional parent style — yellow.
  const FILL = "rgba(255,215,0,0.05)";
  const STROKE = "rgba(255,215,0,0.80)";
  const OUTLINE = "rgba(255,215,0,0.55)";
  const STROKE_W = 1;

  const LABEL_FONT = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const LABEL_BG = "rgba(0,0,0,0.55)";
  const LABEL_PAD_X = 14;
  const LABEL_PAD_Y = 10;

  function ensureCanvas() {
    if (canvas) return canvas;

    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-institutional";

    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 12,
    });

    chartContainer.appendChild(cnv);
    canvas = cnv;
    return cnv;
  }

  function resizeCanvas(cnv) {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const cssW = Math.max(
      1,
      Math.floor(rect.width || chartContainer.clientWidth || 1)
    );

    const cssH = Math.max(
      1,
      Math.floor(rect.height || chartContainer.clientHeight || 1)
    );

    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));

    if (cnv.width !== pxW) cnv.width = pxW;
    if (cnv.height !== pxH) cnv.height = pxH;

    cnv.style.width = `${cssW}px`;
    cnv.style.height = `${cssH}px`;

    return { w: cssW, h: cssH, dpr };
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function zoneId(z) {
    return String(
      z?.details?.id ??
        z?.details?.facts?.sticky?.structureKey ??
        z?.structureKey ??
        z?.id ??
        ""
    );
  }

  function getStrength(z) {
    const raw = safeNum(z?.strength_raw);
    if (raw != null) return raw;

    const s = safeNum(z?.strength);
    return s != null ? s : 0;
  }

  function isNegotiated(z) {
    if (z?.isNegotiated === true) return true;

    const id = zoneId(z);
    if (id.includes("|NEG|")) return true;

    const stickyFacts = z?.details?.facts?.sticky || {};
    const note = String(stickyFacts?.notes ?? z?.notes ?? "").toUpperCase();

    return note.includes("NEGOTIATED");
  }

  function isManualInstitutionalParent(z) {
    const id = zoneId(z);

    if (!id.startsWith("MANUAL|")) return false;
    if (isNegotiated(z)) return false;

    return true;
  }

  function getRange(z) {
    const stickyFacts = z?.details?.facts?.sticky || {};

    const range =
      z?.displayPriceRange ??
      z?.priceRange ??
      z?.manualRange ??
      stickyFacts?.displayPriceRange ??
      stickyFacts?.priceRange ??
      stickyFacts?.manualRange;

    if (!Array.isArray(range) || range.length !== 2) return null;

    const a = safeNum(range[0]);
    const b = safeNum(range[1]);

    if (a == null || b == null) return null;

    const hi = Math.max(a, b);
    const lo = Math.min(a, b);

    if (!(hi > lo)) return null;

    return {
      hi,
      lo,
      mid: (hi + lo) / 2,
      width: hi - lo,
    };
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

  function drawBand(ctx, w, hi, lo, filled) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);

    if (yTop == null || yBot == null) return;

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    if (filled) {
      ctx.fillStyle = FILL;
      ctx.fillRect(0, y, w, hBand);

      ctx.strokeStyle = STROKE;
      ctx.lineWidth = STROKE_W;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
      return;
    }

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
    ctx.stroke();
  }

  function drawLabel(ctx, w, h, yCenter, text, color) {
    ctx.save();

    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const metrics = ctx.measureText(text);
    const tw = Math.ceil(metrics.width);
    const th = 22;

    const boxW = tw + LABEL_PAD_X * 2;
    const boxH = th + LABEL_PAD_Y * 2;

    let x = Math.round(w / 2);
    let y = Math.round(yCenter);

    const minX = Math.ceil(boxW / 2) + 2;
    const maxX = w - Math.ceil(boxW / 2) - 2;
    const minY = Math.ceil(boxH / 2) + 2;
    const maxY = h - Math.ceil(boxH / 2) - 2;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    ctx.fillStyle = LABEL_BG;
    ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  function parseAutoNegParentId(id) {
    const s = String(id || "");
    const m = s.match(/\|PARENT=(.+)$/);
    return m ? m[1] : null;
  }

  function normalizeSourceRows(json) {
    if (Array.isArray(json?.structures_sticky) && json.structures_sticky.length) {
      return json.structures_sticky;
    }

    if (Array.isArray(json?.levels_debug) && json.levels_debug.length) {
      return json.levels_debug;
    }

    if (Array.isArray(json?.levels) && json.levels.length) {
      return json.levels;
    }

    return [];
  }

  function draw() {
    if (destroyed) return;

    const cnv = ensureCanvas();
    const { w, h, dpr } = resizeCanvas(cnv);

    const ctx = cnv.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const currentPrice = getCurrentPrice();
    const allSticky = Array.isArray(sticky) ? sticky : [];

    // 1) Find AUTO negotiated zones and extract parent ids.
    const autoNegParents = new Set(
      allSticky
        .filter((z) => z && z?.isNegotiated === true)
        .map((z) => parseAutoNegParentId(zoneId(z)))
        .filter(Boolean)
    );

    // 2) Manual institutionals — always show.
    const manualZones = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => isManualInstitutionalParent(z))
      .map((z) => {
        const r = getRange(z);
        if (!r) return null;

        const strength = getStrength(z);

        const dist = Number.isFinite(currentPrice)
          ? Math.abs(r.mid - currentPrice)
          : r.width;

        return {
          z,
          r,
          strength,
          dist,
          filled: false,
          label: true,
          kind: "manual",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);

    // 3) Auto institutionals that own negotiated zones.
    const autoOwned = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => !isManualInstitutionalParent(z))
      .filter((z) => !isNegotiated(z))
      .map((z) => {
        const id = zoneId(z);
        const r = getRange(z);
        if (!r) return null;

        const strength = getStrength(z);

        const dist = Number.isFinite(currentPrice)
          ? Math.abs(r.mid - currentPrice)
          : r.width;

        return { z, id, r, strength, dist };
      })
      .filter(Boolean)
      .filter((x) => autoNegParents.has(x.id))
      .sort((a, b) => a.dist - b.dist);

    // 4) Additional top autos only if strong.
    const autoCandidates = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => !isManualInstitutionalParent(z))
      .filter((z) => !isNegotiated(z))
      .map((z) => {
        const id = zoneId(z);
        const r = getRange(z);
        if (!r) return null;

        const strength = getStrength(z);

        const dist = Number.isFinite(currentPrice)
          ? Math.abs(r.mid - currentPrice)
          : r.width;

        return { z, id, r, strength, dist };
      })
      .filter(Boolean)
      .filter((x) => x.strength >= MIN_AUTO_STRENGTH)
      .sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (b.strength !== a.strength) return b.strength - a.strength;
        return a.r.width - b.r.width;
      });

    const chosenAuto = [];
    const chosenIds = new Set();

    for (const a of autoOwned) {
      if (chosenAuto.length >= MAX_AUTO_TOTAL) break;
      chosenAuto.push(a);
      chosenIds.add(a.id);
    }

    for (const a of autoCandidates) {
      if (chosenAuto.length >= MAX_AUTO_TOTAL) break;
      if (chosenIds.has(a.id)) continue;

      chosenAuto.push(a);
      chosenIds.add(a.id);
    }

    const fillManual = manualZones.slice(0, MAX_FILLED_MANUAL);
    const fillAuto = chosenAuto.slice(0, MAX_FILLED_AUTO);

    // Draw manual institutional parent zones.
    for (const item of manualZones) {
      const filled = fillManual.includes(item);

      drawBand(ctx, w, item.r.hi + PAD, item.r.lo - PAD, filled);

      const yMid = priceToY(item.r.mid);

      if (yMid != null) {
        const labelPrefix =
          cleanSymbol === "ES" ? "ES Institutional" : "Institutional";

        drawLabel(
          ctx,
          w,
          h,
          yMid,
          `${labelPrefix} ${Math.round(item.strength)}`,
          STROKE
        );
      }
    }

    // Draw selected auto institutional zones.
    let autoLabelsLeft = MAX_AUTO_LABEL;

    for (const item of chosenAuto) {
      const filled = fillAuto.includes(item);

      drawBand(ctx, w, item.r.hi + PAD, item.r.lo - PAD, filled);

      if (autoLabelsLeft > 0) {
        const yMid = priceToY(item.r.mid);

        if (yMid != null) {
          const labelPrefix =
            cleanSymbol === "ES" ? "ES Institutional" : "Institutional";

          drawLabel(
            ctx,
            w,
            h,
            yMid,
            `${labelPrefix} ${Math.round(item.strength)}`,
            STROKE
          );

          autoLabelsLeft--;
        }
      }
    }
  }

  async function loadLevels() {
    try {
      const url = `${getSmzLevelsUrl(cleanSymbol)}&_=${Date.now()}`;

      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      sticky = normalizeSourceRows(json);

      draw();
    } catch (err) {
      console.error("[SMZLevelsOverlay] load failed:", err);
      sticky = [];
      draw();
    }
  }

  loadLevels();

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    destroyed = true;

    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}

    canvas = null;
    sticky = [];

    try {
      unsubVisible();
    } catch {}
  }

  return { seed, update, destroy };
}
