// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx
// Overlay for Accumulation / Distribution shelves (blue/red)
// Reads /api/v1/smz-shelves -> { ok:true, meta:{...}, levels:[...] }
//
// ✅ NEW:
// - Click detection: click a shelf band -> emits window event "smz:shelfSelected"
// - Payload includes the shelf object + quick Q3/Q5 explanation

const SMZ_SHELVES_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-shelves";

function clipText(s, max = 28) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

// Build a tiny “AI smart” explanation from diagnostic (deterministic, no API)
function buildShelfExplain(lvl) {
  const d = lvl?.diagnostic?.relevance;
  const w3 = d?.window3d;
  const w7 = d?.window7d;

  if (!w3 || !w7) {
    return {
      headline: `${lvl?.type ?? "Shelf"}`,
      why: ["No diagnostic data found."],
      verdict: "",
    };
  }

  // Q3 signals (wick frequency + failed pushes)
  const wickLine3d = `Q3 (3d): upperTouches=${w3.upperWickTouches}, lowerTouches=${w3.lowerWickTouches}, wickBias=${w3.wickBias}`;
  const wickLine7d = `Q3 (7d): upperTouches=${w7.upperWickTouches}, lowerTouches=${w7.lowerWickTouches}, wickBias=${w7.wickBias}`;

  // Q5 signals (sustained closes + net progress)
  const q5Line3d = `Q5 (3d): sustainedAbove=${w3.sustainedClosesAbove}, sustainedBelow=${w3.sustainedClosesBelow}, netProgress=${w3.netProgressSignedPts}`;
  const q5Line7d = `Q5 (7d): sustainedAbove=${w7.sustainedClosesAbove}, sustainedBelow=${w7.sustainedClosesBelow}, netProgress=${w7.netProgressSignedPts}`;

  const type = String(d.typeByRelevance || lvl.type || "").toUpperCase();
  const why = [];

  // Simple “human sentence” reasons
  if (type === "DISTRIBUTION") {
    if (w7.failedPushUp > 0) why.push(`Repeated failed pushes above zone (7d failedPushUp=${w7.failedPushUp}).`);
    if (w3.sustainedClosesAbove === false) why.push("No sustained closes above zone in last 3 days.");
    if ((w3.netProgressSignedPts ?? 0) < 0) why.push("Net progress negative over last 3 days.");
  } else {
    if (w7.failedPushDown > 0) why.push(`Repeated failed pushes below zone (7d failedPushDown=${w7.failedPushDown}).`);
    if (w3.sustainedClosesBelow === false) why.push("No sustained closes below zone in last 3 days.");
    if ((w3.netProgressSignedPts ?? 0) > 0) why.push("Net progress positive over last 3 days.");
  }

  if (!why.length) why.push("Behavior metrics are mixed; classification is lower confidence.");

  return {
    headline: `${type} shelf`,
    why: [wickLine3d, wickLine7d, q5Line3d, q5Line7d, ...why],
    verdict: `Type by relevance: ${d.typeByRelevance} (confidence ${d.confidence}, distWeighted ${d.distWeighted}, accWeighted ${d.accWeighted})`,
  };
}

export default function SMZShelvesOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
  // Optional: parent can pass onSelect; if not, we dispatch a window event
  onSelect,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZShelvesOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let canvas = null;
  let destroyed = false;

  // For click hit-testing
  let hitBoxes = []; // { y0, y1, lvl }

  const ts = chart.timeScale();

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
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;
    return { w, h };
  }

  function drawMidline(ctx, x0, x1, y, stroke) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y + 0.5);
    ctx.lineTo(x1, y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawCenteredLabel(ctx, xMid, yMid, text, stroke, boundsW, boundsH) {
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const padX = 8;
    const padY = 5;
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

  function draw() {
    if (destroyed) return;

    const cnv = ensureCanvas();
    const { w, h } = resizeCanvas(cnv);

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    hitBoxes = [];

    if (!Array.isArray(levels) || levels.length === 0) return;

    for (const lvl of levels) {
      if (!lvl) continue;

      const t = String(lvl.type || "").toLowerCase();
      const isAccum = t === "accumulation";
      const isDist = t === "distribution";
      if (!isAccum && !isDist) continue;

      const fill = isAccum
        ? "rgba(0, 128, 255, 0.30)"
        : "rgba(255, 0, 0, 0.28)";

      const stroke = isAccum
        ? "rgba(0, 128, 255, 0.95)"
        : "rgba(255, 0, 0, 0.95)";

      const pr = lvl.priceRange;
      if (!Array.isArray(pr) || pr.length !== 2) continue;

      const hi = Number(pr[0]);
      const lo = Number(pr[1]);
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;

      const yTop = priceToY(hi);
      const yBot = priceToY(lo);
      if (yTop == null || yBot == null) continue;

      const y = Math.min(yTop, yBot);
      const bandH = Math.max(2, Math.abs(yBot - yTop));

      // Save hitbox for click (y range)
      hitBoxes.push({ y0: y, y1: y + bandH, lvl });

      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, bandH);

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, bandH - 1));
      ctx.stroke();

      const mid = (hi + lo) / 2;
      const yMid = priceToY(mid);
      if (yMid != null && yMid >= 0 && yMid <= h) {
        drawMidline(ctx, 0, w, yMid, stroke);
      }

      const labelBase = isAccum ? "Accumulation" : "Distribution";
      const score = Number(lvl.scoreOverride ?? lvl.strength ?? NaN);
      const scoreText = Number.isFinite(score) ? ` ${Math.round(score)}` : "";
      const comment = clipText(lvl.comment, 26);
      const commentText = comment ? ` — ${comment}` : "";
      const label = `${labelBase}${scoreText}${commentText}`;

      drawCenteredLabel(ctx, w / 2, y + bandH / 2, label, stroke, w, h);
    }
  }

  function handleClick(evt) {
    if (destroyed) return;
    if (!hitBoxes.length) return;

    const rect = chartContainer.getBoundingClientRect();
    const y = evt.clientY - rect.top;

    // Find all shelves whose y-range contains the click y
    const hits = hitBoxes.filter((hb) => y >= hb.y0 && y <= hb.y1);
    if (!hits.length) return;

    // If multiple, choose the one with highest strength
    hits.sort((a, b) => Number(b?.lvl?.strength ?? 0) - Number(a?.lvl?.strength ?? 0));
    const selected = hits[0].lvl;

    const explain = buildShelfExplain(selected);

    const payload = {
      kind: "shelf",
      selected,
      explain,
    };

    if (typeof onSelect === "function") {
      onSelect(payload);
    } else {
      window.dispatchEvent(new CustomEvent("smz:shelfSelected", { detail: payload }));
    }
  }

  async function loadShelves() {
    try {
      const res = await fetch(SMZ_SHELVES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      levels = Array.isArray(json.levels) ? json.levels : [];
      draw();
    } catch (e) {
      console.warn("[SMZShelvesOverlay] failed to load smz shelves:", e);
      levels = [];
      draw();
    }
  }

  loadShelves();

  // Click listener on the container (works even though canvas has pointerEvents:none)
  chartContainer.addEventListener("click", handleClick);

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
      chartContainer.removeEventListener("click", handleClick);
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
