// src/components/overlays/SessionShadingOverlay.js
// Session shading overlay — draws alternating session bands (e.g., day/night)
// Accepts: { chartContainer }
// API: { update(candles, { timeframe }), destroy() }

export default function SessionShadingOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute overlays
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    left: 0, top: 0, right: 0, bottom: 0,
    pointerEvents: "none",
    zIndex: 9998,
  });
  chartContainer.appendChild(cnv);

  const syncSize = () => {
    const w = chartContainer.clientWidth || 300;
    const h = chartContainer.clientHeight || 200;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cnv.width = Math.max(1, Math.floor(w * dpr));
    cnv.height = Math.max(1, Math.floor(h * dpr));
    cnv.style.width = `${w}px`;
    cnv.style.height = `${h}px`;
    const ctx = cnv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(syncSize);
  ro.observe(chartContainer);
  syncSize();

  // very simple day stripes: alternate every N bars by timeframe
  function draw(candles, opts = {}) {
    const ctx = cnv.getContext("2d");
    const w = cnv.clientWidth;
    const h = cnv.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (!candles?.length) return;

    // choose session width by timeframe (approximate, tweak as needed)
    const tf = String(opts.timeframe || "10m");
    const barsPerSession =
      tf === "1m" ? 390 :
      tf === "5m" ? 78  :
      tf === "10m" ? 39 :
      tf === "15m" ? 26 :
      tf === "30m" ? 13 :
      tf === "1h" ? 7  :
      tf === "4h" ? 2  : 1;

    // columns are drawn in screen coords; we don’t have px/px map from bars.
    // simplest approach: draw vertical shaded bands by splitting canvas in slices.
    // NOTE: This is approximate (screen-space bands). For bar-accurate bands,
    // expose the timeScale’s logical range to px mapping from RowChart.

    const sessions = Math.ceil(candles.length / barsPerSession);
    const bandW = Math.max(2, Math.floor(w / Math.max(1, sessions)));

    ctx.save();
    for (let i = 0; i < sessions; i += 2) {
      const x = i * bandW;
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#88a8c3";
      ctx.fillRect(x, 0, bandW, h);
    }
    ctx.restore();
  }

  return {
    update(candles, opts) {
      syncSize();
      draw(candles, opts);
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { cnv.remove(); } catch {}
    }
  };
}
