import { createDrawing, updateDrawing, deleteDrawing, getDrawings } from "./api";

// v1 constants
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

function distPointToSeg(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const ix = x1 + t * vx, iy = y1 + t * vy;
  return Math.hypot(px - ix, py - iy);
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createDrawingsEngine({ chart, priceSeries, hostEl, symbol, tf, onState }) {
  // ------- state -------
  const state = {
    mode: "select", // select | trendline | hline
    symbol,
    tf,
    items: [],
    selectedId: null,
    hoverId: null,
    draft: null,
    dragging: null, // { kind:'create-trendline'|'move-handle'|'move-line', ... }
  };

  // ------- canvas -------
  const canvas = document.createElement("canvas");
  canvas.className = "overlay-canvas drawings-v2";
  Object.assign(canvas.style, {
    position: "absolute",
    inset: 0,
    zIndex: 35,
    pointerEvents: "none",
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

    const drawItem = (it, isHover, isSelected) => {
      const style = it.style || {};
      const color = style.color || "#ffffff";
      const width = style.width || 2;

      const lineW = isSelected ? 3 : isHover ? 2.6 : width;
      ctx.lineWidth = lineW;
      ctx.strokeStyle = color;
      ctx.setLineDash([]);
      ctx.beginPath();

      if (it.type === "trendline") {
        const a = toXY(it.p1), b = toXY(it.p2);
        if (!a || !b) return;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }

      if (it.type === "hline") {
        const y = priceSeries.priceToCoordinate(it.price);
        if (!Number.isFinite(y)) return;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }

      ctx.stroke();

      // handles when selected
      if (isSelected && it.type === "trendline") {
        const a = toXY(it.p1), b = toXY(it.p2);
        if (a) drawHandle(a.x, a.y);
        if (b) drawHandle(b.x, b.y);
      }
    };

    const drawHandle = (x, y) => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0b0b14";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    const toXY = (pt) => {
      if (!pt) return null;
      const x = chart.timeScale().timeToCoordinate?.(pt.time);
      const y = priceSeries.priceToCoordinate(pt.price);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    };

    // draw existing
    for (const it of state.items) {
      const isHover = it.id === state.hoverId;
      const isSelected = it.id === state.selectedId;
      drawItem(it, isHover, isSelected);
    }

    // draw draft on top
    if (state.draft) drawItem(state.draft, false, false);
  };

  const draw = rafThrottle(drawNow);

  // ------- backend load -------
  async function refresh() {
    try {
      const res = await getDrawings(state.symbol, state.tf);
      state.items = Array.isArray(res?.items) ? res.items : [];
      emit();
      draw();
    } catch {
      // ignore
    }
  }

  // ------- helpers -------
  function emit() {
    onState?.({
      mode: state.mode,
      selectedId: state.selectedId,
      count: state.items.length,
    });
  }

  function localXYFromEvent(e) {
    const r = hostEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function xyToTimePrice(x, y) {
    const timeObj = chart.timeScale().coordinateToTime?.(x);
    const time = typeof timeObj === "number" ? timeObj : timeObj?.timestamp ?? timeObj?.time;
    const timeSec = Number(time);
    const price = priceSeries.coordinateToPrice(y);
    if (!Number.isFinite(timeSec) || !Number.isFinite(price)) return null;
    return { timeSec, price };
  }

  function hitTest(x, y) {
    let best = null;

    for (const it of state.items) {
      if (it.type === "trendline") {
        const a = chart.timeScale().timeToCoordinate?.(it.p1?.time);
        const b = chart.timeScale().timeToCoordinate?.(it.p2?.time);
        const ay = priceSeries.priceToCoordinate(it.p1?.price);
        const by = priceSeries.priceToCoordinate(it.p2?.price);
        if (![a, b, ay, by].every(Number.isFinite)) continue;

        // handle hits
        const d1 = Math.hypot(x - a, y - ay);
        const d2 = Math.hypot(x - b, y - by);
        if (d1 <= HIT_PX) return { id: it.id, kind: "handle", which: "p1" };
        if (d2 <= HIT_PX) return { id: it.id, kind: "handle", which: "p2" };

        const d = distPointToSeg(x, y, a, ay, b, by);
        if (d <= HIT_PX && (!best || d < best.d)) best = { id: it.id, kind: "line", d };
      }

      if (it.type === "hline") {
        const yy = priceSeries.priceToCoordinate(it.price);
        if (!Number.isFinite(yy)) continue;
        const d = Math.abs(y - yy);
        if (d <= HIT_PX && (!best || d < best.d)) best = { id: it.id, kind: "hline", d };
      }
    }
    return best ? { id: best.id, kind: best.kind } : null;
  }

  // ------- mouse + keyboard listeners (THIS FIXES DELETE/SELECT) -------
  function onMouseMove(e) {
    const { x, y } = localXYFromEvent(e);

    // hover highlight only in select mode and not dragging
    if (state.mode === "select" && !state.dragging) {
      const hit = hitTest(x, y);
      const nextHover = hit?.id || null;
      if (nextHover !== state.hoverId) {
        state.hoverId = nextHover;
        draw();
      }
    }

    // dragging create trendline
    if (state.dragging?.kind === "create-trendline" && state.draft?.type === "trendline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;
      state.draft.p2 = { time: tp.timeSec, price: tp.price };
      draw();
    }

    // dragging hline
    if (state.dragging?.kind === "drag-hline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;
      const it = state.items.find((z) => z.id === state.dragging.id);
      if (!it) return;
      it.price = tp.price;
      draw();
    }
  }

  async function onMouseDown(e) {
    const { x, y } = localXYFromEvent(e);

    // Trendline tool: click-drag-release
    if (state.mode === "trendline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;
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
      
    state.dragging = { kind: "create-trendline" };
    e.preventDefault();       // ✅ stop chart pan
    e.stopPropagation();      // ✅ stop bubbling
    draw();
    return;

    // HLine tool: one click creates + select it (then user can drag)
    if (state.mode === "hline") {
      const tp = xyToTimePrice(x, y);
      if (!tp) return;
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

    // Select mode
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

    if (hit.kind === "hline") {
      state.dragging = { kind: "drag-hline", id: hit.id };
    }
  }

  async function onMouseUp(_e) {
    e.preventDefault();
    e.stopPropagation();
    // finalize trendline
    if (state.dragging?.kind === "create-trendline" && state.draft?.type === "trendline") {
      e.preventDefault();
      e.stopPropagation();
      const draft = state.draft;
      state.dragging = null;
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

    // stop dragging
    if (state.dragging?.kind === "drag-hline") {
      const it = state.items.find((z) => z.id === state.dragging.id);
      state.dragging = null;
      if (it) {
        try {
          await updateDrawing(it.id, it);
        } catch {}
      }
      draw();
    }
  }

  async function onKeyDown(e) {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!state.selectedId) return;
      const id = state.selectedId;
      state.items = state.items.filter((x) => x.id !== id);
      state.selectedId = null;
      emit();
      draw();
      try {
        await deleteDrawing(id);
      } catch {}
    }

    if (e.key === "Escape") {
      state.mode = "select";
      state.draft = null;
      state.dragging = null;
      emit();
      draw();
    }
  }

  // listeners (capture true, but we do not preventDefault)
  hostEl.addEventListener("mousemove", onMouseMove, true);
  hostEl.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("keydown", onKeyDown, true);

  // redraw on pan/zoom
  const onRange = () => draw();
  chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

  // resize
  const ro = new ResizeObserver(() => draw());
  ro.observe(hostEl);

  // initial load
  refresh();
  emit();
  draw();

  return {
    setMode(mode) {
      state.mode = mode;
      state.draft = null;
      state.dragging = null;
      emit();
      draw();
    },
    getMode() {
      return state.mode;
    },
    async deleteSelected() {
      if (!state.selectedId) return;
      const id = state.selectedId;
      state.items = state.items.filter((x) => x.id !== id);
      state.selectedId = null;
      emit();
      draw();
      try {
        await deleteDrawing(id);
      } catch {}
    },
    setContext({ symbol: sym, tf: timeframe }) {
      state.symbol = String(sym || "SPY").toUpperCase();
      state.tf = String(timeframe || "10m");
      state.items = [];
      state.selectedId = null;
      state.hoverId = null;
      state.draft = null;
      state.dragging = null;
      emit();
      draw();
      refresh();
    },
    destroy() {
      hostEl.removeEventListener("mousemove", onMouseMove, true);
      hostEl.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("keydown", onKeyDown, true);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      try { ro.disconnect(); } catch {}
      try { canvas.remove(); } catch {}
    },
  };
}
