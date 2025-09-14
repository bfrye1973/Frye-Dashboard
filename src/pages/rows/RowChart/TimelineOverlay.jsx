// src/pages/rows/RowChart/TimelineOverlay.jsx
import React, { useEffect, useRef } from "react";

/**
 * TimelineOverlay
 * Two rows at the bottom of the chart:
 *  - hours (HH:mm ticks)
 *  - dates (MM-DD separators)
 *
 * Props:
 *  - chart: lightweight-charts instance (stateful)
 *  - container: DOM node hosting the chart (containerRef.current)
 *  - bars: optional; used to re-render when bar count changes
 */
export default function TimelineOverlay({ chart, container, bars }) {
  const wrap = useRef(null);
  const hours = useRef(null);
  const dates = useRef(null);

  // Create the overlay DOM once
  useEffect(() => {
    if (!container) return;

    const tl = document.createElement("div");
    tl.style.position = "absolute";
    tl.style.left = "0";
    tl.style.right = "0";
    tl.style.bottom = "0";
    tl.style.height = "42px";
    tl.style.pointerEvents = "none";
    tl.style.zIndex = "3"; // sit above the canvas

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

    tl.appendChild(hr);
    tl.appendChild(dr);
    container.appendChild(tl);

    wrap.current = tl;
    hours.current = hr;
    dates.current = dr;

    return () => {
      try { container.removeChild(tl); } catch {}
      wrap.current = null;
      hours.current = null;
      dates.current = null;
    };
  }, [container]);

  // Subscribe + render on pan/zoom, resize, and when new bars arrive
  useEffect(() => {
    if (!chart || !wrap.current) return;

    const ts = chart.timeScale();

    const render = () => {
      const hr = hours.current;
      const dr = dates.current;
      if (!hr || !dr) return;

      // Skip until container has laid out
      const w = container?.clientWidth || 0;
      if (w < 40) return;

      hr.innerHTML = "";
      dr.innerHTML = "";

      const vr = ts.getVisibleRange();
      if (!vr || !Number.isFinite(vr.from) || !Number.isFinite(vr.to)) return;

      const place = (el, t, xOffset = 0) => {
        const x = ts.timeToCoordinate(t);
        if (x == null) return;
        el.style.position = "absolute";
        el.style.left = `${Math.round(x + xOffset)}px`;
        el.style.whiteSpace = "nowrap";
      };

      const spanSec = Math.max(1, vr.to - vr.from);
      const showHours = spanSec <= 10 * 86400;

      // Pick an hour step
      let stepHrs = 1;
      if (spanSec > 86400) stepHrs = 2;
      if (spanSec > 3 * 86400) stepHrs = 6;
      if (spanSec > 7 * 86400) stepHrs = 12;
      if (!showHours) stepHrs = 24;

      // Hours row
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

      // Day separators + labels (always)
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
        place(lab, t + 3600, -16); // Nudge into the day
        dr.appendChild(lab);
      }
    };

    // Initial + slight delay to catch first layout
    render();
    const t = setTimeout(render, 60);

    const subA = ts.subscribeVisibleTimeRangeChange(render);
    const subB = ts.subscribeVisibleLogicalRangeChange(render);
    const onResize = () => render();
    window.addEventListener("resize", onResize);

    return () => {
      try { ts.unsubscribeVisibleTimeRangeChange(subA); } catch {}
      try { ts.unsubscribeVisibleLogicalRangeChange(subB); } catch {}
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [chart, container, bars?.length]);

  return null;
}
