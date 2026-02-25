// src/features/drawings/createDrawingsEngine.js
// ============================================================
// Professional Drawings Engine (v1)
// - TradingView-like foundation: hover, select, handles, delete
// - Tools: select, trendline (drag-to-draw), horizontal line
// - Persistence: backend via ./api
// - IMPORTANT: while drawing/dragging, we prevent chart panning
// ============================================================

import { createDrawing, updateDrawing, deleteDrawing, getDrawings } from "./api";

const HIT_PX = 8;

function rafThrottle(fn) {
  let raf = null;
  return () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      fn();
    });
  };
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pointToSegDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;

  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);

  const t = c1 / c2;
  const ix = x1 + t * vx;
  const iy = y1 + t * vy;
  return Math.hypot(px - ix, py - iy);
}

export function createDrawingsEngine({
  chart,
  priceSeries,
  hostEl,
  symbol,
  tf,
  onState,
}) {
  // -------------------- Guard --------------------
  if (!chart || !priceSeries || !hostEl) {
    return {
      setMode() {},
      getMode() {
        return "select";
      },
      deleteSelected() {},
      setContext() {},
      destroy() {},
    };
  }

  // -------------------- State --------------------
  const state = {
    mode: "select", // select | trendline | hline
    symbol: String(symbol || "SPY").toUpperCase(),
    tf: String(tf || "10m"),
    items: [],
    selectedId: null,
    hoverId: null,

    // draft while creating trendline
    draft: null,

    // dragging state
    drag: null,
    // drag = {
    //   kind: "create-trendline" | "move-line" | "move-handle" | "drag-hline",
    //   id,
    //   which, // "p1"/"p2"
    //   start: {x,y,time,price},
    //   baseItem: {...}
    // }
  };

  function emit() {
    if (typeof onState !== "function") return;
    onState({
      mode: state.mode,
      count: state.items.length,
      selectedId: state.selectedId,
    });
  }

  // -------------------- Canvas --------------------
  const canvas = document.createElement("canvas");
  canvas.className = "overlay-canvas drawings-v2";
  Object.assign(canvas.style, {
    position: "absolute",
    inset: 0,
    zIndex: 35,
    pointerEvents: "none", // IMPORTANT: we handle events via listeners, not canvas
  });
  hostEl.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const syncSize = () => {
    const r = hostEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };

  const drawNow = () => {
    syncSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // existing items
    for (const it of state.items) {
      drawItem(it, it.id === state.hoverId, it.id === state.selectedId);
    }

    // draft on top
    if (state.draft) drawItem(state.draft, false, false);
  };

  const draw = rafThrottle(drawNow);

  function toX(timeSec) {
    try {
      const x = chart.timeScale().timeToCoordinate?.(timeSec);
      return Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  }

  function toY(price) {
    try {
      const y = priceSeries.priceToCoordinate(price);
      return Number.isFinite(y) ? y : null;
    } catch {
      return null;
    }
  }

  function toPrice(y) {
    try {
      const p = priceSeries.coordinateToPrice(y);
      return Number.isFinite(p) ? p : null;
    } catch {
      return null;
    }
  }

  function toTime(x) {
    try {
      const t = chart.timeScale().coordinateToTime?.(x);
      const sec = typeof t === "number" ? t : t?.timestamp ?? t?.time;
      return Number.isFinite(Number(sec)) ? Number(sec) : null;
    } catch {
      return null;
    }
  }

  function localXY(e) {
    const r = hostEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function xyToTimePrice(x, y) {
    const timeSec = toTime(x);
    const price = toPrice(y);
    if (!Number.isFinite(timeSec) || !Number.isFinite(price)) return null;
    return { timeSec, price };
  }

  function drawHandle(x, y) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0b0b14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawItem(it, hover, selected) {
    const style = it.style || {};
    const color = style.color || "#ffffff";
    const baseWidth = Number(style.width || 2);

    const lineW = selected ? Math.max(3, baseWidth + 1) : hover ? baseWidth + 0.6 : baseWidth;

    ctx.save();
    ctx.lineWidth = lineW;
    ctx.strokeStyle = color;
    ctx.setLineDash([]); // v1 solid only
    ctx.beginPath();

    if (it.type === "trendline") {
      const a = it.p1;
      const b = it.p2;
      const x1 = toX(a?.time);
      const y1 = toY(a?.price);
      const x2 = toX(b?.time);
      const y2 = toY(b?.price);
      if ([x1, y1, x2, y2].every(Number.isFinite)) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
    } else if (it.type === "hline") {
      const y = toY(it.price);
      if (Number.isFinite(y)) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
    }

    ctx.stroke();
    ctx.restore();

    // Handles when selected
    if (selected && it.type === "trendline") {
      const a = it.p1;
      const b = it.p2;
      const x1 = toX(a?.time);
      const y1 = toY(a?.price);
      const x2 = toX(b?.time);
      const y2 = toY(b?.price);
      if ([x1, y1].every(Number.isFinite)) drawHandle(x1, y1);
      if ([x2, y2].every(Number.isFinite)) drawHandle(x2, y2);
    }
  }

  // -------------------- Hit testing --------------------
  function hitTest(x, y) {
    let best = null;

    for (const it of state.items) {
      if (it.type === "trendline") {
        const a = it.p1;
        const b = it.p2;
        const x1 = toX(a?.time);
        const y1 = toY(a?.price);
        const x2 = toX(b?.time);
        const y2 = toY(b?.price);
        if (![x1, y1, x2, y2].every(Number.isFinite)) continue;

        // handles
        const d1 = Math.hypot(x - x1, y - y1);
        if (d1 <= HIT_PX) return { id: it.id, kind: "handle", which: "p1" };

        const d2 = Math.hypot(x - x2, y - y2);
        if (d2 <= HIT_PX) return { id: it.id, kind: "handle", which: "p2" };

        // line
        const d = pointToSegDist(x, y, x1, y1, x2, y2);
        if (d <= HIT_PX && (!best || d < best.d)) best = { id: it.id, kind: "line", d };
      }

      if (it.type === "hline") {
        const yy = toY(it.price);
        if (!Number.isFinite(yy)) continue;
        const d = Math.abs(y - yy);
        if (d <= HIT_PX && (!best || d < best.d)) best = { id: it.id, kind: "hline", d };
      }
    }

    return best ? { id: best.id, kind: best.kind, which: best.which } : null;
  }

  // -------------------- Backend --------------------
  async function refresh() {
    try {
      const res = await getDrawings(state.symbol, state.tf);
      state.items = Array.isArray(res?.items) ? res.items : [];
      state.selectedId = null;
      state.hoverId = null;
      emit();
      draw();
    } catch {
      // ignore
    }
  }

  // -------------------- Mouse + Key handling --------------------
  // IMPORTANT:
  // - We only preventDefault / stopPropagation while actively drawing/dragging,
  //   so normal chart panning/zooming still works in Select mode.

  function stopChartPan(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    const { x, y } = localXY(e);

    // If dragging/creating, update draft/item and block pan
    if (state.drag?.kind) {
      stopChartPan(e);

      const tp = xyToTimePrice(x, y);
      if (!tp) return;

      if (state.drag.kind === "create-trendline" && state.draft?.type === "trendline") {
        state.draft.p2 = { time: tp.timeSec, price: tp.price };
        draw();
        return;
      }

      const idx = state.items.findIndex((z) => z.id === state.drag.id);
      if (idx === -1) return;

      const curItem = state.items[idx];

      if (state.drag.kind === "drag-hline" && curItem.type === "hline") {
        curItem.price = tp.price;
        draw();
        return;
      }

      if (curItem.type === "trendline") {
        if (state.drag.kind === "move-handle") {
          const which = state.drag.which;
          if (which === "p1") curItem.p1 = { time: tp.timeSec, price: tp.price };
          if (which === "p2") curItem.p2 = { time: tp.timeSec, price: tp.price };
          draw();
          return;
        }

        if (state.drag.kind === "move-line") {
          // translate both points by delta from drag start
          const start = state.drag.start;
          const base = state.drag.baseItem;
          if (!start || !base) return;

          const dt = tp.timeSec - start.time;
          const dp = tp.price - start.price;

          curItem.p1 = { time: base.p1.time + dt, price: base.p1.price + dp };
          curItem.p2 = { time: base.p2.time + dt, price: base.p2.price + dp };
          draw();
          return;
        }
      }

      return;
    }

    // Not dragging: hover highlight only in select mode
    if (state.mode === "select") {
      const hit = hitTest(x, y);
      const nextHover = hit?.id || null;
      if (nextHover !== state.hoverId) {
        state.hoverId = nextHover;
        draw();
      }
    }
  }

  async function onMouseDown(e) {
    const { x, y } = localXY(e);

    // Tool: trendline (drag-to-draw)
    if (state.mode === "trendline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;

      stopChartPan(e);

      state.draft = {
        id: uuid(),
        type: "trendline",
        symbol: state.symbol,
        tf: state.tf,
        p1: { time: tp.timeSec, price: tp.price },
        p2: { time: tp.timeSec, price: tp.price },
        style: { color: "#ffffff", width: 2, dash: "solid", extendLeft: false, extendRight: false },
        meta: { locked: false, label: "" },
      };

      state.drag = { kind: "create-trendline" };
      draw();
      return;
    }

    // Tool: horizontal line (click to place; then switch to select)
    if (state.mode === "hline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;

      stopChartPan(e);

      const item = {
        id: uuid(),
        type: "hline",
        symbol: state.symbol,
        tf: state.tf,
        price: tp.price,
        style: { color: "#ffffff", width: 2 },
        meta: { locked: false, label: "" },
      };

      try {
        const res = await createDrawing(item);
        state.items.push(res.item);
        state.selectedId = res.item.id;
      } catch {
        state.items.push(item);
        state.selectedId = item.id;
      }

      state.mode = "select";
      emit();
      draw();
      return;
    }

    // Select mode behavior
    const hit = hitTest(x, y);

    if (!hit) {
      state.selectedId = null;
      emit();
      draw();
      return;
    }

    state.selectedId = hit.id;
    emit();
    draw();

    // Start dragging selected
    const idx = state.items.findIndex((z) => z.id === hit.id);
    if (idx === -1) return;

    const it = state.items[idx];

    // Dragging should block chart pan
    stopChartPan(e);

    const tp = xyToTimePrice(x, y);
    if (!tp) return;

    if (hit.kind === "hline" && it.type === "hline") {
      state.drag = {
        kind: "drag-hline",
        id: it.id,
      };
      return;
    }

    if (it.type === "trendline") {
      if (hit.kind === "handle") {
        state.drag = {
          kind: "move-handle",
          id: it.id,
          which: hit.which,
        };
        return;
      }

      if (hit.kind === "line") {
        state.drag = {
          kind: "move-line",
          id: it.id,
          start: { time: tp.timeSec, price: tp.price },
          baseItem: JSON.parse(JSON.stringify(it)),
        };
      }
    }
  }

  async function onMouseUp(e) {
    // Only stop chart pan if we were dragging/creating
    if (state.drag?.kind) stopChartPan(e);

    // Finish trendline create
    if (state.drag?.kind === "create-trendline" && state.draft?.type === "trendline") {
      const draft = state.draft;

      state.drag = null;
      state.draft = null;

      try {
        const res = await createDrawing(draft);
        state.items.push(res.item);
        state.selectedId = res.item.id;
      } catch {
        state.items.push(draft);
        state.selectedId = draft.id;
      }

      state.mode = "select";
      emit();
      draw();
      return;
    }

    // Persist edits after drag
    if (state.drag) {
      // (should not happen because create-trendline returns above)
      state.drag = null;
    }

    // If we just finished moving something, PUT it
    // We detect by: selection exists AND mouseup happened (we don't have a "dirty" flag, keep it simple v1)
    const id = state.selectedId;
    if (id) {
      const it = state.items.find((z) => z.id === id);
      if (it) {
        try {
          await updateDrawing(id, it);
        } catch {
          // ignore
        }
      }
    }

    draw();
  }

  async function onKeyDown(e) {
    if (e.key === "Escape") {
      state.mode = "select";
      state.draft = null;
      state.drag = null;
      emit();
      draw();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      const id = state.selectedId;
      if (!id) return;

      state.items = state.items.filter((z) => z.id !== id);
      state.selectedId = null;
      state.hoverId = null;

      emit();
      draw();

      try {
        await deleteDrawing(id);
      } catch {
        // ignore
      }
    }
  }

  // -------------------- Wiring --------------------
  // Use capture phase so we can stop pan during drawing.
  hostEl.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("keydown", onKeyDown, true);

  const onRange = () => draw();
  try {
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
  } catch {
    // ignore
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(hostEl);

  // initial load
  refresh();
  emit();
  draw();

  // -------------------- Public API --------------------
  return {
    setMode(mode) {
      state.mode = String(mode || "select");
      state.draft = null;
      state.drag = null;
      emit();
      draw();
    },

    getMode() {
      return state.mode;
    },

    async deleteSelected() {
      const id = state.selectedId;
      if (!id) return;

      state.items = state.items.filter((z) => z.id !== id);
      state.selectedId = null;
      state.hoverId = null;
      emit();
      draw();

      try {
        await deleteDrawing(id);
      } catch {
        // ignore
      }
    },

    setContext({ symbol: sym, tf: timeframe }) {
      state.symbol = String(sym || "SPY").toUpperCase();
      state.tf = String(timeframe || "10m");
      state.items = [];
      state.selectedId = null;
      state.hoverId = null;
      state.draft = null;
      state.drag = null;
      emit();
      draw();
      refresh();
    },

    destroy() {
      try {
        hostEl.removeEventListener("mousedown", onMouseDown, true);
      } catch {}
      try {
        window.removeEventListener("mousemove", onMouseMove, true);
      } catch {}
      try {
        window.removeEventListener("mouseup", onMouseUp, true);
      } catch {}
      try {
        window.removeEventListener("keydown", onKeyDown, true);
      } catch {}

      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      } catch {}

      try {
        ro.disconnect();
      } catch {}

      try {
        canvas.remove();
      } catch {}
    },
  };
}
