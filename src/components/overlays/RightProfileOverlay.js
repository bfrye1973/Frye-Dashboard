// src/components/overlays/RightProfileOverlay.js
import React, { useEffect, useRef } from "react";

/**
 * VERY SIMPLE OVERLAY SCAFFOLD
 * - Draws on a transparent canvas positioned on top of the chart
 * - For now it just writes a label so we can verify the overlay mounts
 * - Next step: we’ll replace the demo draw with Money Flow Profile rendering
 */
export default function RightProfileOverlay({ chartContainer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!chartContainer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function syncSize() {
      const rect = chartContainer.getBoundingClientRect();
      // Handle high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawDemo() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
      ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Money Flow Overlay Placeholder", 16, 24);
    }

    syncSize();
    drawDemo();

    const ro = new ResizeObserver(() => {
      syncSize();
      drawDemo();
    });
    ro.observe(chartContainer);

    return () => {
      try { ro.disconnect(); } catch {}
    };
  }, [chartContainer]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}
