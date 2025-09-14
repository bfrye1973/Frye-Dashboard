// src/pages/rows/RowChart/TimeRail.jsx
import React, { useEffect, useRef } from "react";

/**
 * TimeRail — a fixed 42px rail rendered *below* the chart (not overlay).
 * It draws hour ticks (HH:mm) and date labels (MM-DD) based on chart.timeScale().
 *
 * Props:
 *  - chart: lightweight-charts instance (stateful)
 *  - bars: optional (re-render on new candle)
 */
export default function TimeRail({ chart, bars }) {
  const railRef = useRef(null);
  const hoursRef = useRef(null);
  const datesRef = useRef(null);

  // create static DOM once
  useEffect(() => {
    if (!railRef.current) return;
    const hr = document.createElement("div");
    const dr = document.createElement("div");

    Object.assign(hr.style, {
      height: "20px",
      borderTop: "1px solid #2b2b2b",
      position: "relative",
      color: "#9ca3af",
      fontSize: "11px",
    });
    Object.assign(dr.style, {
      height: "22px",
      borderTop: "1px solid #2b2b2b",
      position: "relative",
      color: "#9ca3af",
      fontSize: "11px",
    });

    railRef.current.innerHTML = "";
    railRef.current.appendChild(hr);
    railRef.current.appendChild(dr);

    hoursRef.current = hr;
    datesRef.current = dr;

    return () => {
      hoursRef.current = null;
      datesRef.current = null;
      if (railRef.current) railRef.current.innerHTML = "";
    };
  }, []);

  // subscribe + draw
  useEffect(() => {
    if (!chart || !hoursRef.current || !datesRef.current) return;
    const ts = chart.timeScale();

    const render = () => {
      const hr = hoursRef.current;
      const dr = datesRef.current;
      if (!hr || !dr) return;

      // clear
      hr.innerHTML = "";
      dr.innerHTML = "";

      const vr = ts.getVisibleRange?.();
      if (!vr || !Number.isFinite(vr.from) || !Number.isFinite(vr.to)) return;

      const place = (el, t, xOffset = 0) => {
        const x = ts.timeToCoordinate?.(t);
        if (x == null) return;
        el.style.position = "absolute";
        el.style.left = `${Math.round(x + xOffset)}px`;
        el.style.whiteSpace = "nowrap";
      };

      const spanSec = Math.max(1, vr.to - vr.from);
      const showHours = spanSec <= 10 * 86400;

      // choose an hour step
      let stepHrs = 1;
      if (spanSec > 86400) stepHrs = 2;
      if (spanSec > 3 * 86400) stepHrs = 6;
      if (spanSec > 7 * 86400) stepHrs = 12;
      if (!showHours) stepHrs = 24;

      // hours row
      if (showHours) {
        const startHour = Math.floor(vr.from / 3600) * 3600;
        for (let t = startHour; t <= vr.to + 1; t += stepHrs * 3600) {
          const d = new Date(t * 1000);
          const hh = d.getHours().toString().padStart(2, "0");
          const mm = d.getMinutes().toString().padStart(2, "0");

          const lab = document.createElement("div");
          lab.textContent = `${hh}:${mm}`;
          lab.style.color = "#9ca3af";
          lab.style.fontSize = "11px";
          place(lab, t, -18);
          hr.appendChild(lab);

          const tick = document.createElement("div");
          Object.assign(tick.style, {
            position: "absolute",
            width: "1px",
            background: "#2b2b2b",
            top: "-6px",
            bottom: "0",
          });
          place(tick, t, 0);
          hr.appendChild(tick);
        }
      }

      // day separators + labels (always)
      const startDay = Math.floor(vr.from / 86400) * 86400;
      for (let t = startDay; t <= vr.to + 1; t += 86400) {
        const d = new Date(t * 1000);
        const mm = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd = d.getDate().toString().padStart(2, "0");

        const line = document.createElement("div");
        Object.assign(line.style, {
          position: "absolute",
          width: "1px",
          background: "#3a3a3a",
          top: "0",
          bottom: "0",
        });
        place(line, t, 0);
        dr.appendChild(line);

        const lab = document.createElement("div");
        lab.textContent = `${mm}-${dd}`;
        lab.style.color = "#9ca3af";
        lab.style.fontSize = "11px";
        lab.style.fontWeight = "600";
        place(lab, t + 3600, -16);
        dr.appendChild(lab);
      }
    };

    // initial + small delay after layout
    render();
    const t = setTimeout(render, 50);

    const subA = ts.subscribeVisibleTimeRangeChange?.(render);
    const subB = ts.subscribeVisibleLogicalRangeChange?.(render);
    const onResize = () => render();
    window.addEventListener("resize", onResize);

    return () => {
      try { ts.unsubscribeVisibleTimeRangeChange?.(subA); } catch {}
      try { ts.unsubscribeVisibleLogicalRangeChange?.(subB); } catch {}
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [chart, bars?.length]);

  return (
    <div
      ref={railRef}
      style={{
        height: 42,
        background: "transparent",
        borderTop: "none",
        position: "relative",
      }}
    />
  );
}
