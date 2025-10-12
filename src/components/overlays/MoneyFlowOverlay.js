// src/components/overlays/MoneyFlowOverlay.js
// DEBUG OVERLAY — draws a big semi-transparent box + text so we can verify
// the overlay mounts, sizes, and sits ABOVE the chart.
// Once we confirm it shows, we’ll switch back to the real money flow drawing.

export default function MoneyFlowOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute children
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Create canvas
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 10, // must be above candles
  });
  chartContainer.appendChild(cnv);

  // Size sync
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

  // Very visible draw
  const drawDebug = () => {
    const ctx = cnv.getContext("2d");
    const w = cnv.clientWidth;
    const h = cnv.clientHeight;

    // clear
    ctx.clearRect(0, 0, w, h);

    // a translucent pane across the whole chart
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // a bright banner in the top-left
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(10, 10, 220, 28);
    ctx.fillStyle = "#0b0f14";
    ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("DEBUG: MoneyFlowOverlay visible", 16, 30);
    ctx.restore();
  };

  return {
    update() {
      syncSize();
      drawDebug();
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { cnv.remove(); } catch {}
    },
  };
}
