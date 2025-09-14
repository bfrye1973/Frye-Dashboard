// src/pages/rows/RowChart/TimelineOverlay.jsx
import React, { useEffect, useRef } from "react";

/**
 * TimelineOverlay
 * Renders two rows at the bottom of the chart container:
 *  - hours row (HH:mm ticks)
 *  - dates row (MM-DD separators)
 *
 * Props:
 *  - chart: lightweight-charts instance (stateful, not a ref)
 *  - container: the DOM node that hosts the chart (containerRef.current)
 *  - bars (optional): used only to trigger a re-render when new data arrives
 */
export default function TimelineOverlay({ chart, container, bars }) {
  const wrap = useRef(null);
  const hours = useRef(null);
  const dates = useRef(null);

  // create DOM once
  useEffect(() => {
    if (!container) return;

    const tl = document.createElement("div");
    tl.style.position = "absolute";
    tl.style.left = "0";
    tl.style.right = "0";
    tl.style.bottom = "0";
    tl.style.height = "42px";
    tl.style.pointerEvents = "none";
    // subtle bg fade (optional)
    // tl.style.background = "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0))";

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

  // subscribe to chart changes + update when data changes
  useEffect(() => {
    if (!chart || !wrap.current) return;
    const ts = chart.timeScale();

    const render = () => {
      const hr = hours.current;
      const dr = dates.current;
      if (!hr || !dr) return;

      // clear
      hr.innerHTML = "";
      dr.innerHTML = "";

      const vr = ts.getVisibleRange();
      if (!vr) return;

      const place = (el, t, xOffset = 0) => {
        const x = ts.timeToCoordinate(t);
        if (x == null) return;
        el.style.position = "absolute";
        el.style.left = `${Math.round(x) + xOffset}px`;
        el.style.whiteSpace = "nowrap";
      };

      const spanSec = Math.max(1, vr.to - vr.from);

      // If more than ~10 days visible, prioritize days only
      const showHours = spanSec <= 10 * 86400;

      // choose hour tick step
      let stepHrs = 1; // 1h default
      if (spanSec > 86400) stepHrs = 2;        // > 1 day → 2h
      if (spanSec > 3 * 86400) stepHrs = 6;    // > 3 days → 6h
      if (spanSec > 7 * 86400) stepHrs = 12;   // > 7 days → 12h
      if (!showHours) stepHrs = 24;

      // hour ticks/labels
      if (showHours) {
        const startHour = Math.floor(vr.from / 3600) * 3600;
        for (let t = startHour; t <= vr.to + 1; t += stepHrs * 3600) {
          const d = new Date(t * 1000);
          const hh = d.getHours().toString().padStart(2, "0");
          const mm = d.getMinutes().toString().padStart(2, "0");

          // label
          const lab = document.createElement("div");
          lab.textContent = `${hh}:${mm}`;
          lab.style.color = "#9ca3af";
          lab.style.fontSize = "11px";
          place(lab, t, -18);
          hr.appendChild(lab);

          // small tick up into chart area
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

      // date separators at midnight boundaries (always)
      const startDay = Math.floor(vr.from / 86400) * 86400;
      for (let t = startDay; t <= vr.to + 1; t += 86400) {
        const d = new Date(t * 1000);
        const mm = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd = d.getDate().toString().padStart(2, "0");

        // vertical line at midnight
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

        // date label nudged into the day
        const lab = document.createElement("div");
        lab.textContent = `${mm}-${dd}`;
        lab.style.color = "#9ca3af";
        lab.style.fontSize = "11px";
        lab.style.fontWeight = "600";
        place(lab, t + 3600, -16); // +1h so it doesn't overlap the line
        dr.appendChild(lab);
      }
    };

    // initial
    render();

    // subscribe to pan/zoom changes
    const subA = ts.subscribeVisibleTimeRangeChange(render);
    const subB = ts.subscribeVisibleLogicalRangeChange(render);

    // also re-render on window resize (in case container width snaps)
    const onResize = () => render();
    window.addEventListener("resize", onResize);

    return () => {
      try { ts.unsubscribeVisibleTimeRangeChange(subA); } catch {}
      try { ts.unsubscribeVisibleLogicalRangeChange(subB); } catch {}
      window.removeEventListener("resize", onResize);
    };
    // re-render when new bars arrive (length change is enough)
  }, [chart, container, bars?.length]);

  return null;
}
