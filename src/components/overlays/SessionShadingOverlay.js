// src/components/overlays/SessionShadingOverlay.js
import React, { useEffect, useRef } from "react";

/**
 * SessionShadingOverlay
 * Shades ETH (outside RTH 9:30–16:00 ET) with alternating bands.
 * Assumes candle timestamps are in UTC seconds. RTH (ET) becomes
 * 13:30–20:00 UTC during DST. You can tweak rthStartSec/rthEndSec below.
 *
 * Props:
 *  - chart: Lightweight Charts chart instance
 *  - container: the DOM node holding the chart
 *  - colors?: { ethA: string, ethB: string }
 *  - rthStartSec?: number (seconds since midnight UTC) default 13.5h (09:30 ET)
 *  - rthEndSec?: number (seconds since midnight UTC)   default 20h   (16:00 ET)
 */
export default function SessionShadingOverlay({
  chart,
  container,
  colors = { ethA: "rgba(100,160,255,0.20)", ethB: "rgba(255,180,90,0.20)" },
  rthStartSec = 13.5 * 3600, // 09:30 ET -> 13:30 UTC (DST)
  rthEndSec = 20 * 3600,     // 16:00 ET -> 20:00 UTC (DST)
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!chart || !container) return;

    // Build canvas
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "none";
    canvasRef.current = canvas;
    container.appendChild(canvas);

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 200;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    function secDay(t) { return t % 86400; }
    function dayBase(t) { return Math.floor(t / 86400) * 86400; }

    function draw() {
      if (!canvas.width || !canvas.height) return;
      const ctx = canvas.getContext("2d");
      const scale = chart.timeScale();
      const range = scale.getVisibleRange?.();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!range) return;

      const dpr = window.devicePixelRatio || 1;
      const H = canvas.height;

      const minT = Math.floor(range.from);
      const maxT = Math.ceil(range.to);

      // Walk day by day covering ETH blocks [00:00,09:30) and [16:00,24:00)
      // Alternate colors between blocks for visual rhythm.
      let colorToggle = false;

      // Start a couple days earlier to cover partial bands at edges
      const startDay = dayBase(minT - 86400);
      const endDay = dayBase(maxT + 2 * 86400);

      for (let d = startDay; d <= endDay; d += 86400) {
        const preStart = d + 0;
        const preEnd = d + rthStartSec;
        const postStart = d + rthEndSec;
        const postEnd = d + 86400;

        const blocks = [
          [preStart, preEnd],
          [postStart, postEnd],
        ];

        for (const [a, b] of blocks) {
          // Skip if block is completely out of range
          if (b < minT || a > maxT) continue;

          const x1 = scale.timeToCoordinate?.(a);
          const x2 = scale.timeToCoordinate?.(b);
          if (x1 == null || x2 == null) continue;

          const left = Math.min(x1, x2) * dpr;
          const right = Math.max(x1, x2) * dpr;
          const width = Math.max(0, right - left);

          ctx.fillStyle = colorToggle ? colors.ethA : colors.ethB;
          ctx.fillRect(left, 0, width, H);

          colorToggle = !colorToggle;
        }
      }
    }

    function redraw() {
      resize();
      draw();
    }

    // Subscriptions
    const scale = chart.timeScale();
    const sub1 = scale.subscribeVisibleTimeRangeChange?.(redraw);
    const ro = new ResizeObserver(redraw);
    ro.observe(container);

    // Initial draw (defer to after first layout)
    setTimeout(redraw, 0);

    return () => {
      try { sub1 && scale.unsubscribeVisibleTimeRangeChange(sub1); } catch {}
      try { ro.disconnect(); } catch {}
      try { canvas.remove(); } catch {}
    };
  }, [chart, container, colors.ethA, colors.ethB, rthStartSec, rthEndSec]);

  return null;
}
