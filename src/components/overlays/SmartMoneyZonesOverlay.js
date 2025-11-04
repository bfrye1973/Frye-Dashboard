// Canvas overlay for Smart-Money Zones (dashed bands + thrust tag + gap magnet)
export default function createSmartMoneyZonesOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZOverlay] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  let zones = [];
  let gaps = [];
  let rafId = null;

  const ts = chart.timeScale();

  const yFor = (p) => {
    const y = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(y) ? y : null;
  };

  function ensureCanvas() {
    let cnv = chartContainer.querySelector("canvas.overlay-canvas.smz");
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas smz";
      Object.assign(cnv.style, {
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 12
      });
      chartContainer.appendChild(cnv);
    }
    return cnv;
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w; cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // dashed helper
    function dashedBand(yMin, yMax, col, faded=false) {
      const stroke = faded ? "rgba(200,200,200,0.25)" : col;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = stroke;
      ctx.beginPath(); ctx.moveTo(0, yMin); ctx.lineTo(w, yMin); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, yMax); ctx.lineTo(w, yMax); ctx.stroke();
      ctx.setLineDash([]);
    }

    // draw latest 20 zones
    const latest = zones.slice(-20);
    latest.forEach(z => {
      const yTop = yFor(z.top), yBot = yFor(z.bottom);
      if (yTop == null || yBot == null) return;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const col = z.side === "bull" ? "rgba(77,170,255,0.8)" : "rgba(255,99,99,0.8)";
      const faded = z.status === "exhausted";
      dashedBand(yMin, yMax, col, faded);

      // tag
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = faded ? "rgba(220,220,220,0.6)" : "rgba(255,255,255,0.9)";
      const tag = z.side === "bull" ? "ACCUM — PA" : "DIST — PA";
      ctx.fillText(tag, 8, yMin + 12);
      // score
      ctx.fillText(`${(z.score * 100 | 0)}%`, 8, yMin + 26);
      // thrust badge
      if (z.checks.thrust) {
        ctx.fillStyle = "rgba(255,180,0,0.9)";
        ctx.fillText("THRUST", w - 70, yMin + 12);
      }
    });

    // gap magnets
    gaps.forEach(g => {
      if (g.resolved) return;
      const yTop = yFor(g.top), yBot = yFor(g.bottom);
      if (yTop == null || yBot == null) return;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      ctx.fillStyle = "rgba(180,180,180,0.15)";
      ctx.fillRect(0, yMin, w, Math.max(2, yMax - yMin));
      ctx.strokeStyle = "rgba(200,200,200,0.5)";
      ctx.strokeRect(0.5, yMin + 0.5, w - 1, (yMax - yMin) - 1);
      ctx.fillStyle = "rgba(220,220,220,0.9)";
      ctx.fillText("GAP MAGNET", w - 100, yMax - 6);
    });
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => { rafId = null; draw(); });
  }

  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleTimeRangeChange?.(onVisible);

  return {
    seed(payload) { zones = payload.zones || []; gaps = payload.gaps || []; draw(); },
    update() { scheduleDraw(); },
    destroy() {
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      const cnv = chartContainer.querySelector("canvas.overlay-canvas.smz");
      if (cnv?.parentNode === chartContainer) chartContainer.removeChild(cnv);
    }
  };
}
