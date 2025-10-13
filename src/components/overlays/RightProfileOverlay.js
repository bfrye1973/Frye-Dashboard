// src/components/overlays/RightProfileOverlay.js
// Right-side overlay (canvas) — DPR-aware + ResizeObserver + clean destroy
// - Sticks to chart container with absolute positioning + z-index
// - Resizes on container changes AND DPR changes
// - Draws a placeholder + a right gutter block (replace with real profile)

export default function RightProfileOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute overlays
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Create canvas
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,                 // left:0, top:0, right:0, bottom:0
    pointerEvents: "none",
    zIndex: 10,               // above LWC canvases
  });
  cnv.className = "overlay-canvas right-profile";
  chartContainer.appendChild(cnv);

  const ctx = cnv.getContext("2d");

  // --- DPI-aware resize binding ---
  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    // Set backing store size (px) and CSS size (layout)
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";

    // Reset and scale CTX to DPR
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);

  const onWindowResize = () => resize(); // catch DPR/zoom/monitor changes
  window.addEventListener("resize", onWindowResize);

  // Initial measure
  resize();

  // --- simple draw helpers ---
  function clear() {
    // IMPORTANT: use canvas *CSS* size here since ctx already scaled to DPR
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  function drawPlaceholder() {
    const rect = chartContainer.getBoundingClientRect();
    clear();

    // Right-side “profile gutter” (placeholder)
    const gutterW = Math.max(80, Math.min(160, Math.floor(rect.width * 0.12)));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#334155";
    ctx.fillRect(rect.width - gutterW - 12, 16, gutterW, Math.max(1, rect.height - 32));

    // Label
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Right Profile Overlay", 16, 24);
  }

  return {
    update(/* bars */) {
      // You can cache bars and compute a real profile here; for now just paint
      resize();          // ensure canvas is current size/DPR each update
      drawPlaceholder(); // placeholder render
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWindowResize);
      try { cnv.remove(); } catch {}
    },
  };
}
