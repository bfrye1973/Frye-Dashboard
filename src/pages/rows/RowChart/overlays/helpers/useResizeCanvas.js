// useResizeCanvas.js
import { useEffect } from "react";

export function useResizeCanvas(canvasRef, containerRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "10";

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr, dpr);
      // caller will draw each frame
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const dprListener = () => resize();
    window.addEventListener("resize", dprListener);
    resize();

    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", dprListener);
    };
  }, [canvasRef, containerRef]);
}
