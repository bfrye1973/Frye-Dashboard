// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL PARENTS ONLY (yellow)
// ✅ CLEAN MODE:
// - Always show MANUAL institutionals
// - Show AUTO institutionals only if they are "canonical":
//    A) they own an auto negotiated zone (AUTO|...|PARENT=<id>)
//    B) OR they are among top N strongest autos (small N)
// - Never draw negotiated zones here
// - Labels only for shown zones (prevents blob)

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZLevelsOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let sticky = [];
  let canvas = null;

  const ts = chart.timeScale();

  // --- tuning knobs ---
  const PAD = 0.06;

  // Fill limits (prevents blob)
  const MAX_FILLED_MANUAL = 2;
  const MAX_FILLED_AUTO = 1;

  // Auto display limits (prevents clutter)
  const MAX_AUTO_TOTAL = 2;     // only show up to 2 auto institutionals total
  const MAX_AUTO_LABEL = 2;     // label up to 2 autos
  const MIN_AUTO_STRENGTH = 85; // ignore weak autos unless they own a negotiated zone

  // Styles
  const FILL = "rgba(255,215,0,0.05)";
  const STROKE = "rgba(255,215,0,0.80)";
  const OUTLINE = "rgba(255,215,0,0.55)";
  const STROKE_W = 1;

  // Label style
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

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function zoneId(z) {
    return String(z?.details?.id ?? z?.structureKey ?? z?.id ?? "");
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
    return id.includes("|NEG|");
  }

  function isManualInstitutionalParent(z) {
    const id = zoneId(z);
    if (!id.startsWith("MANUAL|")) return false;
    if (isNegotiated(z)) return false;
    return true;
  }

  function getRange(z) {
    const range = z?.displayPriceRange ?? z?.priceRange;
    if (!Array.isArray(range) || range.length !== 2) return null;
    const a = safeNum(range[0]);
    const b = safeNum(range[1]);
    if (a == null || b == null) return null;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (!(hi > lo)) return null;
    return { hi, lo, mid: (hi + lo) / 2, width: hi - lo };
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
    } else {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
    }
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
    // AUTO|SPY|NEG|690.00-691.00|PARENT=<parentId>
    const s = String(id || "");
    const m = s.match(/\|PARENT=(.+)$/);
    return m ? m[1] : null;
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const currentPrice = getCurrentPrice();

    const allSticky = Array.isArray(sticky) ? sticky : [];

    // 1) Find AUTO negotiated zones and extract parent ids
    const autoNegParents = new Set(
      allSticky
        .filter((z) => z && z?.isNegotiated === true)
        .map((z) => parseAutoNegParentId(zoneId(z)))
        .filter(Boolean)
    );

    // 2) Manual institutionals (always show)
    const manualZones = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => isManualInstitutionalParent(z))
      .map((z) => {
        const r = getRange(z);
        if (!r) return null;
        const strength = getStrength(z);
        const dist = Number.isFinite(currentPrice) ? Math.abs(r.mid - currentPrice) : r.width;
        return { z, r, strength, dist, filled: false, label: true, kind: "manual" };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);

    // 3) Auto institutionals that own negotiated zones (canonical)
    const autoOwned = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => !isManualInstitutionalParent(z))
      .filter((z) => !isNegotiated(z))
      .map((z) => {
        const id = zoneId(z);
        const r = getRange(z);
        if (!r) return null;
        const strength = getStrength(z);
        const dist = Number.isFinite(currentPrice) ? Math.abs(r.mid - currentPrice) : r.width;
        return { z, id, r, strength, dist };
      })
      .filter(Boolean)
      .filter((x) => autoNegParents.has(x.id)) // only those owning a negotiated zone
      .sort((a, b) => a.dist - b.dist);

    // 4) Additional top autos (only if strong) — limited to MAX_AUTO_TOTAL
    const autoCandidates = allSticky
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => !isManualInstitutionalParent(z))
      .filter((z) => !isNegotiated(z))
      .map((z) => {
        const id = zoneId(z);
        const r = getRange(z);
        if (!r) return null;
        const strength = getStrength(z);
        const dist = Number.isFinite(currentPrice) ? Math.abs(r.mid - currentPrice) : r.width;
        return { z, id, r, strength, dist };
      })
      .filter(Boolean)
      .filter((x) => x.strength >= MIN_AUTO_STRENGTH) // strong only
      .sort((a, b) => {
        // prefer closer, then stronger, then tighter
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (b.strength !== a.strength) return b.strength - a.strength;
        return a.r.width - b.r.width;
      });

    // Build final auto list: negotiated-owners first, then top candidates not already included
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

    // Fill selections
    const fillManual = manualZones.slice(0, MAX_FILLED_MANUAL);
    const fillAuto = chosenAuto.slice(0, MAX_FILLED_AUTO);

    // Draw manual zones
    for (const item of manualZones) {
      const filled = fillManual.includes(item);
      drawBand(ctx, w, item.r.hi + PAD, item.r.lo - PAD, filled);

      const yMid = priceToY(item.r.mid);
      if (yMid != null) drawLabel(ctx, w, h, yMid, `Institutional ${Math.round(item.strength)}`, STROKE);
    }

    // Draw chosen autos only (no clutter)
    let autoLabelsLeft = MAX_AUTO_LABEL;
    for (const item of chosenAuto) {
      const filled = fillAuto.includes(item);
      drawBand(ctx, w, item.r.hi + PAD, item.r.lo - PAD, filled);

      if (autoLabelsLeft > 0) {
        const yMid = priceToY(item.r.mid);
        if (yMid != null) {
          const tag = autoNegParents.has(item.id) ? "" : ""; // keep clean; you can add "(AUTO)" later if you want
          drawLabel(ctx, w, h, yMid, `Institutional ${Math.round(item.strength)}${tag}`, STROKE);
          autoLabelsLeft--;
        }
      }
    }
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      sticky = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];
      draw();
    } catch {
      sticky = [];
      draw();
    }
  }

  loadLevels();

  const unsubVisible = ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function seed() { draw(); }
  function update() { draw(); }

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) chartContainer.removeChild(canvas);
    } catch {}
    canvas = null;
    sticky = [];
    try { unsubVisible(); } catch {}
  }

  return { seed, update, destroy };
}
