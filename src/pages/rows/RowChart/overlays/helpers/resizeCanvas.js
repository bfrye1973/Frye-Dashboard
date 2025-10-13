// resizeCanvas.js — imperative (no React) DPI-aware resizer with cleanup
export function bindCanvasToContainer(canvas, container) {
  if (!canvas || !container) return () => {};
  const style = canvas.style;
  style.position = "absolute";
  style.inset = "0";
  style.pointerEvents = "none";
  style.zIndex = "10"; // above LWC canvases

  const ctx = canvas.getContext("2d");

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    style.width  = rect.width + "px";
    style.height = rect.height + "px";
    if (ctx) {
      ctx.setTransform(1,0,0,1,0,0); // reset
      ctx.scale(dpr, dpr);
      // caller will draw on next paint
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // also react to DPR changes (browser zoom / monitor move)
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);

  // initial measure
  resize();

  // cleanup
  return () => {
    try { ro.disconnect(); } catch {}
    window.removeEventListener("resize", onWinResize);
  };
}
