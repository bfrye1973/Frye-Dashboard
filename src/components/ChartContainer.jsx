import { useLayoutEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function ChartContainer({ className, style, onReady }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const init = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w === 0 || h === 0) return false;
      const chart = createChart(el, {
        width: w,
        height: h,
        layout: { background: { color: "#0b0b14" }, textColor: "#e5e7eb" },
        grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
        crosshair: { mode: 0 },
      });
      chartRef.current = chart;
      onReady?.(chart);
      return true;
    };

    let created = init();
    const ro = new ResizeObserver(() => {
      if (!chartRef.current) { created ||= init(); return; }
      const w = el.clientWidth, h = el.clientHeight;
      chartRef.current.applyOptions({ width: w, height: h });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [onReady]);

  return <div ref={hostRef} className={className} style={style} />;
}
