// src/components/overlays/SMI1hOverlay.js
// SMI (1-hour) overlay — inert paint layer (no fit/visibleRange).
// Params: K=12, D=7, EMA smoothing=5. Output range: [-100, +100].
// Draws in a bottom band (~22% height) so price pane remains undisturbed.

export default function createSMI1hOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMI1h] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* Tunables */
  const K_LEN = 12;
  const D_LEN = 7;
  const EMA_LEN = 5;

  const BAND_BOTTOM_FRAC = 0.22;   // bottom band height (22% of chart)
  const PAD_X = 8;
  const GRID_ALPHA = 0.25;
  const LINE_W = 2;

  const COL_BG_PLATE = "rgba(11, 15, 23, 0.85)";
  const COL_GRID     = "rgba(149, 158, 172, 0.35)";
  const COL_ZERO     = "rgba(149, 158, 172, 0.35)";
  const COL_K        = "#60a5fa";      // blue (solid)
  const COL_D        = "#f59e0b";      // amber (dashed)
  const COL_BORDER   = "#1f2a44";
  const FONT         = "bold 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  /* State */
  let bars = [];           // asc [{time, open, high, low, close, volume}]
  let series = [];         // asc [{time, k, d}]
  let rafId = null;

  const ts = chart.timeScale();

  /* Helpers */
  const toSec = t => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };

  function emaArr(arr, len) {
    if (!arr?.length || len <= 1) return arr?.slice() ?? [];
    const k = 2 / (len + 1);
    const out = new Array(arr.length);
    let prev = arr[0];
    out[0] = prev;
    for (let i = 1; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }

  function resampleTo1h(barsAsc) {
    if (!barsAsc?.length) return [];
    const out = []; let cur = null;
    for (const b of barsAsc) {
      const t = toSec(b.time);
      const bucket = Math.floor(t / 3600) * 3600;
      if (!cur || bucket !== cur.time) {
        if (cur) out.push(cur);
        cur = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: Number(b.volume || 0) };
      } else {
        cur.high = Math.max(cur.high, b.high);
        cur.low  = Math.min(cur.low , b.low );
        cur.close = b.close;
        cur.volume = Number(cur.volume || 0) + Number(b.volume || 0);
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  // SMI math (double-smoothed midpoint distance divided by half-range)
  function computeSMI1h(barsAsc) {
    const b1h = resampleTo1h(barsAsc);
    const n = b1h.length;
    if (n < Math.max(K_LEN, D_LEN) + 6) return [];

    const highs = b1h.map(b => b.high);
    const lows  = b1h.map(b => b.low );
    const close = b1h.map(b => b.close);

    const HH = new Array(n), LL = new Array(n);
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - (K_LEN - 1));
      let h = -Infinity, l = Infinity;
      for (let j = i0; j <= i; j++) { if (highs[j] > h) h = highs[j]; if (lows[j] < l) l = lows[j]; }
      HH[i] = h; LL[i] = l;
    }

    const mid   = HH.map((h, i) => (h + LL[i]) / 2);
    const range = HH.map((h, i) => (h - LL[i]));

    const m  = close.map((c, i) => c - mid[i]);
    const m1 = emaArr(m, K_LEN);
    const m2 = emaArr(m1, EMA_LEN);
    const r1 = emaArr(range, K_LEN);
    const r2 = emaArr(r1, EMA_LEN);

    const kRaw = m2.map((v, i) => {
      const denom = (r2[i] || 0) / 2;
      const val = denom === 0 ? 0 : 100 * (v / denom);
      return Math.max(-100, Math.min(100, val));
    });
    const dRaw = emaArr(kRaw, D_LEN).map(v => Math.max(-100, Math.min(100, v)));

    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ time: b1h[i].time, k: kRaw[i], d: dRaw[i] });
    }
    if (typeof window !== "undefined" && out.length) {
      const last = out[out.length - 1];
      window.__SMI1H = { k: last.k, d: last.d, ts: last.time };
    }
    return out;
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => { rafId = null; draw(); });
  }

  function draw() {
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.smi1h");
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas smi1h";
      Object.assign(cnv.style, { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 });
      chartContainer.appendChild(cnv);
    }
    if (!w || !h) return;
    cnv.width = w; cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;

    // Bottom band geometry
    const bandH = Math.max(64, Math.floor(h * BAND_BOTTOM_FRAC));
    const bandTop = h - bandH;
    const bandBot = h;

    // plate
    ctx.fillStyle = COL_BG_PLATE;
    ctx.fillRect(0, bandTop, w, bandH);
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL_BORDER;
    ctx.strokeRect(0.5, bandTop + 0.5, w - 1, bandH - 1);

    // grid lines: 0, ±40, ±60
    const yForVal = (v) => {
      // map [-100..+100] → [bandBot..bandTop]
      const t = (v + 100) / 200;              // 0..1
      return bandTop + (1 - t) * bandH;
    };

    ctx.globalAlpha = GRID_ALPHA;
    [0, 40, -40, 60, -60, 100, -100].forEach((v) => {
      const y = Math.round(yForVal(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? COL_ZERO : COL_GRID;
      ctx.beginPath(); ctx.moveTo(PAD_X, y); ctx.lineTo(w - PAD_X, y); ctx.stroke();
      if (Math.abs(v) !== 100) {
        // small label
        const lbl = (v > 0 ? "+" : "") + v;
        ctx.fillStyle = COL_GRID;
        ctx.fillText(lbl, PAD_X + 4, y - 2);
      }
    });
    ctx.globalAlpha = 1;

    if (!series?.length) return;

    // clamp visible x range and build paths
    const first = series[0].time;
    const last  = series[series.length - 1].time;
    const x0 = xFor(first);
    const xN = xFor(last);
    if (x0 == null || xN == null) return;

    // %K (solid)
    ctx.lineWidth = LINE_W;
    ctx.strokeStyle = COL_K;
    ctx.beginPath();
    let started = false;
    for (const p of series) {
      const x = xFor(p.time); if (x == null) continue;
      const y = yForVal(p.k);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // %D (dashed)
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = COL_D;
    ctx.beginPath();
    started = false;
    for (const p of series) {
      const x = xFor(p.time); if (x == null) continue;
      const y = yForVal(p.d);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.restore();
  }

  const onLogical = () => scheduleDraw();
  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize", scheduleDraw);

  return {
    seed(rawBarsAsc) {
      bars = (rawBarsAsc || []).map(b => ({ ...b, time: toSec(b.time) })).sort((a, b) => a.time - b.time);
      series = computeSMI1h(bars);
      draw();
    },
    update(latest) {
      if (!latest) return;
      const t = toSec(latest.time);
      const last = bars.at(-1);
      if (!last || t > last.time) bars.push({ ...latest, time: t });
      else if (t === last.time)   bars[bars.length - 1] = { ...latest, time: t };
      else return;

      // Recompute only when a new hour bucket closes
      const prevBucket = Math.floor((bars[bars.length - 2]?.time ?? t) / 3600);
      const currBucket = Math.floor(t / 3600);
      if (currBucket !== prevBucket) {
        series = computeSMI1h(bars);
      }
      draw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
      // canvas removal left to RowChart cleanup (consistent with other overlays)
    },
  };
}
