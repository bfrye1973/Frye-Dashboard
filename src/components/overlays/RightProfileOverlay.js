// src/components/overlays/RightProfileOverlay.js
export default function RightProfileOverlay({ chartContainer }) {
  if (!chartContainer) {
    console.warn("[RightProfile] no chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  // Ensure container can host absolute overlays
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Canvas
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,                 // above LWC canvases
    // NOTE: no debug background tint in production
  });
  cnv.className = "overlay-canvas right-profile";
  chartContainer.appendChild(cnv);

  const ctx = cnv.getContext("2d");

  // DPR-aware resize
  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    // debug
    console.log("[RightProfile] resize", { w: rect.width, h: rect.height, dpr });
  };

  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);
  resize();

  // Helpers
  const clear = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  function drawPlaceholder(tag = "seed") {
    const rect = chartContainer.getBoundingClientRect();
    clear();

    // Right-side placeholder “profile gutter”
    const gutterW = Math.max(80, Math.min(160, Math.floor(rect.width * 0.12)));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#334155";
    ctx.fillRect(rect.width - gutterW - 12, 16, gutterW, Math.max(1, rect.height - 32));

    // Label
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Right Profile: ${tag}`, 16, 24);
  }

  console.log("[RightProfile] ATTACH", { node: cnv });

  return {
    seed(bars) {
      console.log("[RightProfile] SEED", { count: bars?.length });
      resize();
      drawPlaceholder("seed");
    },
    update(latest) {
      console.log("[RightProfile] UPDATE", { t: latest?.time, c: latest?.close });
      resize();
      drawPlaceholder("update");
    },
    destroy() {
      console.log("[RightProfile] DESTROY");
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
    },
  };
}
