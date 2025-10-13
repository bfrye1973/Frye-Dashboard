// src/components/overlays/RightProfileOverlay.js
// Canvas overlay that sits on the PRICE pane.
// - DPR-aware resize
// - Seed + Update lifecycle
// - Draws a single dot at the last close (proves price→y mapping works)

export default function RightProfileOverlay({ chartContainer, priceSeries }) {
  if (!chartContainer) {
    console.warn("[RightProfile] no chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  // --- allow absolute children ---
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // --- canvas node ---
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10, // above LWC canvases
  });
  cnv.className = "overlay-canvas right-profile";
  chartContainer.appendChild(cnv);

  const ctx = cnv.getContext("2d");
  const ps = priceSeries; // we need this to convert price → y

  // --- DPR-aware resize ---
  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);
  resize();

  // --- helpers ---
  const clear = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  const yFor = (price) => {
    if (!ps || typeof ps.priceToCoordinate !== "function") return null;
    const y = ps.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };

  const drawDotAtPrice = (price, tag = "") => {
    const rect = chartContainer.getBoundingClientRect();
    clear();
    const y = yFor(price);
    const x = rect.width - 20; // near right edge
    if (y != null) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#00e5ff";
      ctx.fill();
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(tag || "dot@", x - 28, y - 8);
    } else {
      // fallback label if mapping failed
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("no y", x - 24, 20);
    }
  };

  console.log("[RightProfile] ATTACH");

  return {
    seed(bars) {
      console.log("[RightProfile] SEED", { count: bars?.length });
      resize();
      if (Array.isArray(bars) && bars.length) {
        drawDotAtPrice(bars[bars.length - 1].close, "seed");
      } else {
        clear();
      }
    },
    update(latest) {
      // latest is the newest candle with { time, open, high, low, close, volume }
      console.log("[RightProfile] UPDATE", { t: latest?.time, c: latest?.close });
      resize();
      if (latest && typeof latest.close === "number") {
        drawDotAtPrice(latest.close, "upd");
      }
    },
    destroy() {
      console.log("[RightProfile] DESTROY");
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
    },
  };
}
