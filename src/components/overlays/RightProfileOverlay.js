// src/components/overlays/RightProfileOverlay.js
export default function RightProfileOverlay({ chartContainer }) {
  if (!chartContainer) {
    console.warn("[RightProfile] no chartContainer");
    return { update() {}, destroy() {} };
  }

  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9999, // crank it up for debug
    background: "rgba(255,0,0,0.12)", // <-- TEMP: make it obvious
  });
  cnv.className = "overlay-canvas right-profile";
  chartContainer.appendChild(cnv);

  const ctx = cnv.getContext("2d");

  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    console.log("[RightProfile] resize", { w: rect.width, h: rect.height, dpr });
  };

  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);
  resize();

  function clear() {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  function drawPlaceholder(tag = "seed") {
    const rect = chartContainer.getBoundingClientRect();
    clear();
    // Right gutter block (visible)
    const gutterW = Math.max(80, Math.min(160, Math.floor(rect.width * 0.12)));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#334155";
    ctx.fillRect(rect.width - gutterW - 12, 16, gutterW, Math.max(1, rect.height - 32));

    // Loud label
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`RIGHT PROFILE: ${tag}`, 16, 28);
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
