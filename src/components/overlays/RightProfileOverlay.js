// src/components/overlays/RightProfileOverlay.js
// Simple right-side overlay scaffold (factory):
// - draws a placeholder label on its own canvas
// - returns { update(candles), destroy() }

export default function RightProfileOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute overlays
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Create canvas
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    left: 0, top: 0, right: 0, bottom: 0,
    pointerEvents: "none",
    zIndex: 9996,
  });
  chartContainer.appendChild(cnv);

  const syncSize = () => {
    const w = chartContainer.clientWidth || 300;
    const h = chartContainer.clientHeight || 200;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cnv.width  = Math.max(1, Math.floor(w * dpr));
    cnv.height = Math.max(1, Math.floor(h * dpr));
    cnv.style.width  = `${w}px`;
    cnv.style.height = `${h}px`;
    const ctx = cnv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(syncSize);
  ro.observe(chartContainer);
  syncSize();

  function drawPlaceholder() {
    const ctx = cnv.getContext("2d");
    const w = cnv.clientWidth;
    const h = cnv.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(255, 0, 0, 0.75)";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Right Profile Overlay", 16, 24);
    ctx.restore();
  }

  return {
    update() {
      syncSize();
      drawPlaceholder();
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { cnv.remove(); } catch {}
    }
  };
}
