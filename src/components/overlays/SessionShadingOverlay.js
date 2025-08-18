// src/components/overlays/SessionBandsOverlay.jsx
import React, { useEffect, useRef } from 'react';

/**
 * SessionBandsOverlay
 * Draws vertical bands for US pre/after-hours on top of a Lightweight Charts chart.
 *
 * Props:
 * - chart: the Lightweight Charts "chart" instance you already created
 * - preColor: rgba() string for pre-market fill (default: blue-ish)
 * - postColor: rgba() string for after-hours fill (default: orange-ish)
 */
export default function SessionBandsOverlay({
  chart,
  preColor = 'rgba(60,130,255,0.10)',     // pre: soft blue
  postColor = 'rgba(230,150,40,0.10)',     // post: soft orange
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const cleanupRef = useRef(() => {});

  useEffect(() => {
    if (!chart) return;

    // Create an absolutely-positioned canvas on top of the chart container
    const container = chart._internal__container || chart._container || chart.chartElement || (chart.options && chart.options().container);
    // Fallback: get container by walking DOM (works with official API-created chart)
    const rootEl = container || chart?.chartElement?.parentElement || chart?.chartElement || document.querySelector('div[data-lightweight-charts]') || chart?.timeScale?.()._internal__chart?._internal__chartElement;

    // If we can't find the container, bail safely
    if (!rootEl) return;

    // Create wrapper to ensure it sits on top
    const wrap = document.createElement('div');
    wrap.style.position = 'absolute';
    wrap.style.left = '0';
    wrap.style.top = '0';
    wrap.style.right = '0';
    wrap.style.bottom = '0';
    wrap.style.pointerEvents = 'none';
    wrap.style.zIndex = '5'; // above grid/candles but below crosshair tooltip if needed
    rootEl.style.position = 'relative';
    rootEl.appendChild(wrap);
    wrapRef.current = wrap;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = wrap.clientWidth * devicePixelRatio;
    canvas.height = wrap.clientHeight * devicePixelRatio;
    wrap.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');

    // Helpers for New York time (exchange time)
    const toNYDate = (sec) => {
      const ms = sec * 1000;
      return new Date(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date(ms)).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6Z'));
    };

    const ymd = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

    // Build sessions (in NY time) for each day in a visible time range
    function daySessionRangesNYVisible() {
      const range = chart.timeScale().getVisibleRange();
      if (!range) return [];

      const startSec = range.from;
      const endSec   = range.to;

      const startNY = toNYDate(startSec);
      const endNY   = toNYDate(endSec);

      // Build a list of days between startNY..endNY
      const days = [];
      let d = new Date(Date.UTC(startNY.getUTCFullYear(), startNY.getUTCMonth(), startNY.getUTCDate()));
      const endD = new Date(Date.UTC(endNY.getUTCFullYear(), endNY.getUTCMonth(), endNY.getUTCDate()));
      while (d <= endD) {
        days.push(new Date(d));
        d.setUTCDate(d.getUTCDate() + 1);
      }

      // Create unix second helpers in NY local wall clock and then convert back to real unix seconds
      const toUnixSecNY = (dayUtcDate, hh, mm) => {
        // compose a NY wall-clock time string for that day
        const dateStr = `${ymd(dayUtcDate)}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
        // Interpret this string as America/New_York local time and convert to a real Date
        const nyParts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour12: false,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).formatToParts(new Date(Date.parse(dateStr)));

        const obj = Object.fromEntries(nyParts.map(p => [p.type, p.value]));
        // Build a Date that represents the *actual UTC instant* when NY clock shows dateStr
        const localStr = `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}Z`;
        return Math.floor(new Date(localStr).getTime() / 1000);
      };

      // Regular session is 09:30–16:00 ET.
      // We'll shade PRE (04:00–09:30) and POST (16:00–20:00).
      const sessions = [];
      for (const day of days) {
        const preStart  = toUnixSecNY(day, 4, 0);
        const preEnd    = toUnixSecNY(day, 9, 30);
        const postStart = toUnixSecNY(day, 16, 0);
        const postEnd   = toUnixSecNY(day, 20, 0);

        // Include only if intersects visible range
        if (preEnd > startSec && preStart < endSec) {
          sessions.push({ kind: 'pre', from: preStart, to: preEnd });
        }
        if (postEnd > startSec && postStart < endSec) {
          sessions.push({ kind: 'post', from: postStart, to: postEnd });
        }
      }
      return sessions;
    }

    function draw() {
      // Resize backing store for crispness
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = devicePixelRatio || 1;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Shade sessions
      const timeScale = chart.timeScale();
      const sessions = daySessionRangesNYVisible();

      for (const s of sessions) {
        const x1 = timeScale.timeToCoordinate(s.from);
        const x2 = timeScale.timeToCoordinate(s.to);
        if (x1 == null || x2 == null) continue;

        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);

        ctx.fillStyle = (s.kind === 'pre') ? preColor : postColor;
        ctx.fillRect(left, 0, right - left, h);
      }
    }

    // Redraw on important events
    const unsub1 = chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
    const unsub2 = chart.timeScale().subscribeVisibleTimeRangeChange(draw);

    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);

    cleanupRef.current = () => {
      try { unsub1 && chart.timeScale().unsubscribeVisibleLogicalRangeChange(draw); } catch {}
      try { unsub2 && chart.timeScale().unsubscribeVisibleTimeRangeChange(draw); } catch {}
      try { ro.disconnect(); } catch {}
      try { wrap.remove(); } catch {}
    };

    // Initial paint (after a tiny tick so coordinates exist)
    const t = setTimeout(draw, 30);
    return () => { clearTimeout(t); cleanupRef.current(); };
  }, [chart, preColor, postColor]);

  return null; // purely an overlay; no React DOM output
}
