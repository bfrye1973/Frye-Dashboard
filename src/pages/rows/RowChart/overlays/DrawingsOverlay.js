// src/pages/rows/RowChart/overlays/DrawingsOverlay.js
// Drawings overlay: renders + manages persistence (backend truth + localStorage cache)
// Interaction events are handled by a separate div (RowChart), but forwarded into this overlay.

import {
  getDrawings,
  createDrawing,
  updateDrawing,
  deleteDrawing,
} from "../../../../lib/drawingsClient";

const HIT_PX = 8;

const DEFAULT_STYLE = {
  trendline: { color: "#ffffff", width: 2 },
  abcd: { color: "#22d3ee", width: 2 },
  elliott_triangle: { color: "#a855f7", width: 2 },
};

function rafThrottle(fn) {
  let raf = null;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      fn(...(lastArgs || []));
    });
  };
}

function uuid() {
  // Good-enough UUID v4 (frontend only). Backend accepts client IDs.
  // (No external deps.)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointToSegDistPx(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;

  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.sqrt(dist2(px, py, x1, y1));

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.sqrt(dist2(px, py, x2, y2));

  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  return Math.sqrt(dist2(px, py, projx, projy));
}

function keyFor(symbol, tf) {
  return `drawings_cache_v1:${symbol}:${tf}`;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toSecMaybe(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

function pickTfFromArgs(args) {
  // RowChart passes "timeframe" (selected tf)
  return args?.timeframe || args?.tf || "10m";
}

export default class DrawingsOverlay {
  constructor(args) {
    this.chart = args.chart;
    this.priceSeries = args.priceSeries;
    this.container = args.chartContainer;
    this.symbol = String(args.symbol || "SPY").toUpperCase();
    this.tf = pickTfFromArgs(args);

    this.barsAsc = [];
    this.items = [];
    this.selectedId = null;

    this.mode = "select"; // select | trendline | abcd | elliott_triangle
    this.draft = null; // in-progress drawing object (not yet saved) OR existing being edited
    this.drag = null; // drag state

    this.onStatus = args.onStatus; // optional callback for UI (counts, mode, etc.)

    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.className = "overlay-canvas drawings";
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: 0,
      zIndex: 30,
      pointerEvents: "none", // IMPORTANT: interaction is separate
    });
    this.ctx = this.canvas.getContext("2d");

    // attach
    if (this.container) this.container.appendChild(this.canvas);

    // redraw throttle
    this.draw = rafThrottle(() => this._drawNow());

    // subscribe to pan/zoom
    this._onRange = () => this.draw();
    try {
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(this._onRange);
    } catch {}

    // resize observer (overlay stays in sync)
    this._ro = new ResizeObserver(() => this._syncSizeAndRedraw());
    try {
      this._ro.observe(this.container);
    } catch {}

    // initial size
    this._syncSizeAndRedraw();

    // load cache immediately, then refresh from backend
    this._loadFromCache();
    this.refreshFromBackend().catch(() => {});

    this._emitStatus();
  }

  destroy() {
    try {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this._onRange);
    } catch {}
    try {
      this._ro?.disconnect?.();
    } catch {}
    try {
      this.canvas?.remove?.();
    } catch {}
  }

  seed(barsAsc) {
    this.barsAsc = Array.isArray(barsAsc) ? barsAsc : [];
    this._syncSizeAndRedraw();
  }

  update(_bar) {
    // redraw on new bar (time scale may shift)
    this.draw();
  }

  // --------- Public controls from RowChart ---------

  setContext({ symbol, tf }) {
    const nextSym = String(symbol || "SPY").toUpperCase();
    const nextTf = String(tf || "10m");
    const changed = nextSym !== this.symbol || nextTf !== this.tf;
    this.symbol = nextSym;
    this.tf = nextTf;

    if (changed) {
      this.selectedId = null;
      this.draft = null;
      this.drag = null;
      this.items = [];
      this._loadFromCache();
      this.refreshFromBackend().catch(() => {});
      this._emitStatus();
      this.draw();
    }
  }

  setMode(mode) {
    const m = String(mode || "select");
    this.mode = m;
    // cancel draft when leaving drawing modes
    if (m === "select") {
      this.draft = null;
    }
    this._emitStatus();
    this.draw();
  }

  getMode() {
    return this.mode;
  }

  getSelected() {
    return this.items.find((x) => x.id === this.selectedId) || null;
  }

  getDraft() {
    return this.draft;
  }

  async deleteSelected() {
    if (!this.selectedId) return;
    const id = this.selectedId;
    await deleteDrawing(id);
    this.items = this.items.filter((x) => x.id !== id);
    this.selectedId = null;
    this._saveToCache();
    this._emitStatus();
    this.draw();
  }

  cancelDraft() {
    this.draft = null;
    this.drag = null;
    this._emitStatus();
    this.draw();
  }

  async saveDraft() {
    // For in-progress triangle support: allow saving draft if it has an id+type+points
    if (!this.draft) return;
    if (this.draft._persisted) {
      // update
      const id = this.draft.id;
      const res = await updateDrawing(id, this._stripInternal(this.draft));
      this._upsertItem(res.item);
      this._saveToCache();
      this.draw();
      return;
    }

    const res = await createDrawing(this._stripInternal(this.draft));
    this._upsertItem(res.item);
    this.selectedId = res.item.id;
    this.draft = null;
    this._saveToCache();
    this._emitStatus();
    this.draw();
  }

  // Pointer events forwarded from RowChart interaction layer
  onPointerDown(evt) {
    const p = this._evtToLocal(evt);
    if (!p) return;
    const { x, y } = p;

    // Drawing modes: clicks add points
    if (this.mode !== "select") {
      this._handleDrawingClick(p);
      return;
    }

    // Select mode: hit-test existing items
    const hit = this._hitTest(x, y);
    if (!hit) {
      this.selectedId = null;
      this.drag = null;
      this._emitStatus();
      this.draw();
      return;
    }

    this.selectedId = hit.id;
    this._emitStatus();
    this.draw();

    // Setup dragging
    this.drag = {
      id: hit.id,
      kind: hit.kind, // "handle" | "line"
      handleKey: hit.handleKey || null,
      startX: x,
      startY: y,
      startTime: hit.timeSec ?? null,
      startPrice: hit.price ?? null,
      base: this._cloneItem(this.items.find((it) => it.id === hit.id)),
    };
  }

  onPointerMove(evt) {
    if (!this.drag) return;
    const p = this._evtToLocal(evt);
    if (!p) return;

    const cur = this._xyToTimePrice(p.x, p.y);
    if (!cur) return;

    const item = this.items.find((it) => it.id === this.drag.id);
    if (!item) return;

    // Dragging a handle => set that point
    if (this.drag.kind === "handle") {
      const next = this._cloneItem(item);
      this._setHandle(next, this.drag.handleKey, cur.timeSec, cur.price);
      this._replaceItem(next);
      this.draw();
      return;
    }

    // Dragging whole line => translate all points by delta
    if (this.drag.kind === "line") {
      const start = this._xyToTimePrice(this.drag.startX, this.drag.startY);
      if (!start) return;

      const dt = cur.timeSec - start.timeSec;
      const dp = cur.price - start.price;

      const base = this.drag.base;
      const next = this._cloneItem(base);

      this._translateItem(next, dt, dp);
      this._replaceItem(next);
      this.draw();
    }
  }

  async onPointerUp(_evt) {
    if (!this.drag) return;
    const id = this.drag.id;
    this.drag = null;

    // Persist edit (PUT) on mouseup in select mode
    const item = this.items.find((it) => it.id === id);
    if (!item) return;

    try {
      const res = await updateDrawing(id, this._stripInternal(item));
      this._upsertItem(res.item);
      this._saveToCache();
      this.draw();
    } catch {
      // If PUT fails, just keep local; user can retry by moving again
    }
  }

  // keyboard forwarded
  async onKeyDown(e) {
    if (!e) return;
    if (e.key === "Escape") {
      this.cancelDraft();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.mode === "select") {
        await this.deleteSelected().catch(() => {});
      } else {
        this.cancelDraft();
      }
    }
  }

  // --------- Backend / cache ---------

  _loadFromCache() {
    try {
      const raw = localStorage.getItem(keyFor(this.symbol, this.tf));
      const parsed = safeJsonParse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      this.items = items;
      this.draw();
    } catch {}
  }

  _saveToCache() {
    try {
      const payload = {
        ok: true,
        updatedAtUtc: new Date().toISOString(),
        items: this.items,
      };
      localStorage.setItem(keyFor(this.symbol, this.tf), JSON.stringify(payload));
    } catch {}
  }

  async refreshFromBackend() {
    const data = await getDrawings(this.symbol, this.tf);
    this.items = Array.isArray(data?.items) ? data.items : [];
    this._saveToCache();
    this._emitStatus();
    this.draw();
  }

  // --------- Drawing creation ---------

  _handleDrawingClick(p) {
    const tp = this._xyToTimePrice(p.x, p.y);
    if (!tp) return;

    if (this.mode === "trendline") {
      if (!this.draft) {
        this.draft = {
          id: uuid(),
          type: "trendline",
          symbol: this.symbol,
          tf: this.tf,
          p1: { time: tp.timeSec, price: tp.price },
          p2: { time: tp.timeSec, price: tp.price },
          style: {
            width: 2,
            dash: "solid",
            color: "#ffffff",
            extendLeft: false,
            extendRight: false,
          },
          meta: { locked: false, label: "" },
          _persisted: false,
        };
        this.draw();
        this._emitStatus();
        return;
      }

      // second click finalizes
      this.draft.p2 = { time: tp.timeSec, price: tp.price };
      this.saveDraft().catch(() => {});
      this.setMode("select");
      return;
    }

    if (this.mode === "abcd") {
      if (!this.draft) {
        this.draft = {
          id: uuid(),
          type: "abcd",
          symbol: this.symbol,
          tf: this.tf,
          A: null,
          B: null,
          C: null,
          D: null,
          meta: { locked: false, label: "" },
          _persisted: false,
        };
      }
      const keys = ["A", "B", "C", "D"];
      for (const k of keys) {
        if (!this.draft[k]) {
          this.draft[k] = { time: tp.timeSec, price: tp.price };
          break;
        }
      }
      this.draw();
      this._emitStatus();

      // If complete, save
      if (this.draft.A && this.draft.B && this.draft.C && this.draft.D) {
        this.saveDraft().catch(() => {});
        this.setMode("select");
      }
      return;
    }

    if (this.mode === "elliott_triangle") {
      if (!this.draft) {
        this.draft = {
          id: uuid(),
          type: "elliott_triangle",
          symbol: this.symbol,
          tf: this.tf,
          points: { A: null, B: null, C: null, D: null, E: null },
          meta: { locked: false, label: "" },
          _persisted: false,
        };
      }
      const order = ["A", "B", "C", "D", "E"];
      for (const k of order) {
        if (!this.draft.points[k]) {
          this.draft.points[k] = { time: tp.timeSec, price: tp.price };
          break;
        }
      }
      this.draw();
      this._emitStatus();

      // If complete, auto-save
      if (this._triangleComplete(this.draft)) {
        this.saveDraft().catch(() => {});
        this.setMode("select");
      }
      return;
    }
  }

  _triangleComplete(d) {
    const p = d?.points || {};
    return !!(p.A && p.B && p.C && p.D && p.E);
  }

  // --------- Hit testing / editing ---------

  _hitTest(x, y) {
    // Return best hit within HIT_PX
    let best = null;

    const consider = (cand) => {
      if (!cand) return;
      if (!best || cand.dist < best.dist) best = cand;
    };

    for (const it of this.items) {
      const hits = this._hitItem(it, x, y);
      for (const h of hits) consider(h);
    }

    // Also allow selecting draft (visual feedback) but not needed in v1
    return best && best.dist <= HIT_PX ? best : null;
  }

  _hitItem(it, x, y) {
    const out = [];
    const coords = this._itemToCoords(it);
    if (!coords) return out;

    // handles first
    for (const h of coords.handles) {
      const d = Math.sqrt(dist2(x, y, h.x, h.y));
      out.push({
        id: it.id,
        kind: "handle",
        handleKey: h.key,
        dist: d,
      });
    }

    // lines
    for (const seg of coords.segs) {
      const d = pointToSegDistPx(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      out.push({
        id: it.id,
        kind: "line",
        dist: d,
      });
    }

    return out;
  }

  _setHandle(item, handleKey, timeSec, price) {
    if (!item || !handleKey) return;
    const tp = { time: timeSec, price };

    if (item.type === "trendline") {
      if (handleKey === "p1") item.p1 = tp;
      if (handleKey === "p2") item.p2 = tp;
      return;
    }

    if (item.type === "abcd") {
      if (["A", "B", "C", "D"].includes(handleKey)) item[handleKey] = tp;
      return;
    }

    if (item.type === "elliott_triangle") {
      if (item.points && handleKey in item.points) item.points[handleKey] = tp;
    }
  }

  _translateItem(item, dtSec, dp) {
    const snapTime = (t) => this._snapTimeToNearestBar(t);

    const apply = (pt) => {
      if (!pt) return pt;
      const t2 = snapTime((pt.time || 0) + dtSec);
      return { time: t2, price: (pt.price || 0) + dp };
    };

    if (item.type === "trendline") {
      item.p1 = apply(item.p1);
      item.p2 = apply(item.p2);
    } else if (item.type === "abcd") {
      item.A = apply(item.A);
      item.B = apply(item.B);
      item.C = apply(item.C);
      item.D = apply(item.D);
    } else if (item.type === "elliott_triangle") {
      const p = item.points || {};
      item.points = {
        A: apply(p.A),
        B: apply(p.B),
        C: apply(p.C),
        D: apply(p.D),
        E: apply(p.E),
      };
    }
  }

  _snapTimeToNearestBar(tSec) {
    if (!this.barsAsc || this.barsAsc.length === 0) return Math.round(tSec);
    const t = Number(tSec);
    if (!Number.isFinite(t)) return this.barsAsc[this.barsAsc.length - 1].time;

    // binary search nearest
    let lo = 0;
    let hi = this.barsAsc.length - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.barsAsc[mid].time < t) lo = mid + 1;
      else hi = mid;
    }

    const i = clamp(lo, 0, this.barsAsc.length - 1);
    const a = this.barsAsc[i];
    const b = this.barsAsc[Math.max(0, i - 1)];
    if (!b) return a.time;

    return Math.abs(a.time - t) < Math.abs(b.time - t) ? a.time : b.time;
  }

  _stripInternal(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = { ...obj };
    delete out._persisted;
    return out;
  }

  _cloneItem(it) {
    return it ? JSON.parse(JSON.stringify(it)) : null;
  }

  _replaceItem(next) {
    const idx = this.items.findIndex((x) => x.id === next.id);
    if (idx === -1) return;
    const copy = [...this.items];
    copy[idx] = next;
    this.items = copy;
    this._emitStatus();
  }

  _upsertItem(it) {
    const idx = this.items.findIndex((x) => x.id === it.id);
    if (idx === -1) this.items = [...this.items, it];
    else {
      const copy = [...this.items];
      copy[idx] = it;
      this.items = copy;
    }
    this._emitStatus();
  }

  // --------- Coordinate conversion ---------

  _timeToX(timeSec) {
    const ts = this.chart.timeScale();

    // Preferred
    try {
      const x = ts.timeToCoordinate?.(timeSec);
      if (Number.isFinite(x)) return x;
    } catch {}

    // Fallback: map to logical index nearest bar time
    if (!this.barsAsc || this.barsAsc.length === 0) return null;

    const t = toSecMaybe(timeSec);
    if (!Number.isFinite(t)) return null;

    // nearest index
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < this.barsAsc.length; i++) {
      const d = Math.abs(this.barsAsc[i].time - t);
      if (d < best) {
        best = d;
        idx = i;
      }
    }

    try {
      const x = ts.logicalToCoordinate?.(idx);
      if (Number.isFinite(x)) return x;
    } catch {}

    return null;
  }

  _xToTime(x) {
    const ts = this.chart.timeScale();

    // Preferred (if available)
    try {
      const t = ts.coordinateToTime?.(x);
      // could be object or number depending on lib version
      const sec = toSecMaybe(t?.timestamp ?? t?.time ?? t);
      if (Number.isFinite(sec)) return sec;
    } catch {}

    // Fallback: coordinate -> logical -> nearest bar
    try {
      const logical = ts.coordinateToLogical?.(x);
      if (!Number.isFinite(logical)) return null;
      const idx = clamp(Math.round(logical), 0, (this.barsAsc?.length || 1) - 1);
      return this.barsAsc?.[idx]?.time ?? null;
    } catch {}

    return null;
  }

  _priceToY(price) {
    try {
      const y = this.priceSeries.priceToCoordinate(price);
      if (Number.isFinite(y)) return y;
    } catch {}
    return null;
  }

  _yToPrice(y) {
    try {
      const p = this.priceSeries.coordinateToPrice(y);
      if (Number.isFinite(p)) return p;
    } catch {}
    return null;
  }

  _xyToTimePrice(x, y) {
    const timeSec = this._xToTime(x);
    const price = this._yToPrice(y);
    if (!Number.isFinite(timeSec) || !Number.isFinite(price)) return null;
    return { timeSec, price };
  }

  _evtToLocal(evt) {
    const rect = this.container?.getBoundingClientRect?.();
    if (!rect) return null;
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  // --------- Rendering ---------

  _syncSizeAndRedraw() {
    const rect = this.container?.getBoundingClientRect?.();
    if (!rect) return;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.draw();
  }

  _itemToCoords(it) {
    if (!it) return null;

    const handles = [];
    const segs = [];

    const addHandle = (key, pt) => {
      if (!pt) return;
      const x = this._timeToX(pt.time);
      const y = this._priceToY(pt.price);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      handles.push({ key, x, y });
    };

    const addSeg = (a, b) => {
      if (!a || !b) return;
      const x1 = this._timeToX(a.time);
      const y1 = this._priceToY(a.price);
      const x2 = this._timeToX(b.time);
      const y2 = this._priceToY(b.price);
      if (![x1, y1, x2, y2].every(Number.isFinite)) return;
      segs.push({ x1, y1, x2, y2 });
    };

    if (it.type === "trendline") {
      addHandle("p1", it.p1);
      addHandle("p2", it.p2);
      addSeg(it.p1, it.p2);
    } else if (it.type === "abcd") {
      addHandle("A", it.A);
      addHandle("B", it.B);
      addHandle("C", it.C);
      addHandle("D", it.D);
      addSeg(it.A, it.B);
      addSeg(it.B, it.C);
      addSeg(it.C, it.D);
    } else if (it.type === "elliott_triangle") {
      const p = it.points || {};
      addHandle("A", p.A);
      addHandle("B", p.B);
      addHandle("C", p.C);
      addHandle("D", p.D);
      addHandle("E", p.E);
      // boundaries: A–C–E and B–D
      addSeg(p.A, p.C);
      addSeg(p.C, p.E);
      addSeg(p.B, p.D);
    }

    return { handles, segs };
  }

  _drawNow() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Items + draft
    const all = [...this.items];
    if (this.draft) all.push(this.draft);

    for (const it of all) {
      this._drawItem(ctx, it);
    }
  }

  _drawItem(ctx, it) {
    const coords = this._itemToCoords(it);
    if (!coords) return;

    const selected = it.id && it.id === this.selectedId;

    const style =
      it.style ||
      (DEFAULT_STYLE[it.type] ? { ...DEFAULT_STYLE[it.type] } : { color: "#fff", width: 2 });

    const color =
      (it.type === "trendline" && it.style?.color) ? it.style.color : (style.color || "#fff");
    const width = Number(it.style?.width ?? style.width ?? 2);

    // lines
    ctx.save();
    ctx.lineWidth = selected ? Math.max(3, width + 1) : width;
    ctx.strokeStyle = color;
    ctx.setLineDash([]); // v1 only solid
    ctx.beginPath();
    for (const s of coords.segs) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
    ctx.restore();

    // labels (ABCD + triangle)
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = color;
    for (const h of coords.handles) {
      if (it.type === "abcd" || it.type === "elliott_triangle") {
        ctx.fillText(h.key, h.x + 6, h.y - 6);
      }
    }
    ctx.restore();

    // handles only when selected
    if (selected) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0b0b14";
      ctx.lineWidth = 2;
      for (const h of coords.handles) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _emitStatus() {
    if (typeof this.onStatus !== "function") return;
    try {
      const draftInfo = this._draftInfo();
      this.onStatus({
        symbol: this.symbol,
        tf: this.tf,
        mode: this.mode,
        count: this.items.length,
        selectedId: this.selectedId,
        draft: draftInfo,
      });
    } catch {}
  }

  _draftInfo() {
    if (!this.draft) return null;
    if (this.draft.type === "trendline") {
      return { type: "trendline", step: this.draft.p1 && this.draft.p2 ? "p2" : "p1" };
    }
    if (this.draft.type === "abcd") {
      const n = ["A", "B", "C", "D"].filter((k) => !!this.draft[k]).length;
      return { type: "abcd", pointsSet: n };
    }
    if (this.draft.type === "elliott_triangle") {
      const p = this.draft.points || {};
      const n = ["A", "B", "C", "D", "E"].filter((k) => !!p[k]).length;
      return { type: "elliott_triangle", pointsSet: n };
    }
    return { type: this.draft.type };
  }
}
