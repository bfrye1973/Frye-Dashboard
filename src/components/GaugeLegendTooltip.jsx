// GaugeLegendTooltip.jsx — defines LegendButton component for hover/focus popups
import React, { useId, useRef, useState, useEffect } from "react";

const LEGEND = {
  breadth: {
    title: "Breadth (RPM)",
    example: "95% = Almost all stocks are going up together. Very strong market participation.",
    zones: [
      { range: "0–34%", color: "bg-red-600", text: "Weak — Most stocks are falling." },
      { range: "35–64%", color: "bg-yellow-500", text: "Neutral — Mixed, no clear trend." },
      { range: "65–84%", color: "bg-green-500", text: "Strong — Broad rally." },
      { range: "85–100%", color: "bg-red-700", text: "Extreme — Overheated, risk of pullback." }
    ]
  },
  momentum: {
    title: "Momentum (Speed)",
    example: "95% = Huge buying momentum; many stocks are breaking out to new highs.",
    zones: [
      { range: "0–34%", color: "bg-red-600", text: "Bearish — More new lows than highs." },
      { range: "35–64%", color: "bg-yellow-500", text: "Neutral — Balanced." },
      { range: "65–84%", color: "bg-green-500", text: "Bullish — More new highs than lows." },
      { range: "85–100%", color: "bg-red-700", text: "Extreme — May be unsustainable." }
    ]
  },
  intraday: {
    title: "Intraday Squeeze (Fuel)",
    example: "95% = Market is very coiled; big move could fire soon.",
    zones: [
      { range: "0–34%", color: "bg-green-500", text: "Expanded — Market already moving freely." },
      { range: "35–64%", color: "bg-yellow-500", text: "Normal — Average compression." },
      { range: "65–84%", color: "bg-orange-500", text: "Tight — Building pressure." },
      { range: "85–100%", color: "bg-red-600", text: "Critical — Very tight coil, watch for breakout." }
    ]
  },
  market: {
    title: "Market Meter (Center Dial)",
    example: "95% = Market is firing on all cylinders, very strong environment.",
    zones: [
      { range: "0–34%", color: "bg-red-600", text: "Weak — Market conditions unfavorable." },
      { range: "35–64%", color: "bg-yellow-500", text: "Mixed — Sideways/choppy." },
      { range: "65–84%", color: "bg-green-500", text: "Favorable — Trend-friendly." },
      { range: "85–100%", color: "bg-red-700", text: "Extreme — May be overheated." }
    ]
  },
  daily: {
    title: "Daily Squeeze",
    example: "95% = Extremely compressed on the daily chart → expect a big move soon.",
    zones: [
      { range: "0–34%", color: "bg-green-500", text: "Expanded — Trend in play." },
      { range: "35–64%", color: "bg-yellow-500", text: "Normal — Average compression." },
      { range: "65–84%", color: "bg-orange-500", text: "Tight — Energy building." },
      { range: "85–100%", color: "bg-red-600", text: "Critical — Coiled for breakout." }
    ]
  },
  volatility: {
    title: "Volatility (Water)",
    example: "95% = Very high volatility; market is turbulent and risky.",
    zones: [
      { range: "0–29%", color: "bg-green-500", text: "Calm — Easier to hold positions." },
      { range: "30–59%", color: "bg-yellow-500", text: "Normal — Manageable swings." },
      { range: "60–74%", color: "bg-orange-500", text: "Elevated — Riskier conditions." },
      { range: "75–100%", color: "bg-red-600", text: "High — Sharp, unpredictable moves." }
    ]
  },
  liquidity: {
    title: "Liquidity (Oil)",
    example: "95% = Very liquid market; trades fill easily with low slippage.",
    zones: [
      { range: "0–29%", color: "bg-red-600", text: "Thin — Hard to enter/exit without moving price." },
      { range: "30–49%", color: "bg-orange-500", text: "Light — Caution needed." },
      { range: "50–69%", color: "bg-yellow-500", text: "Normal — Adequate liquidity." },
      { range: "70–84%", color: "bg-green-500", text: "Good — Healthy trading." },
      { range: "85–100%", color: "bg-green-600", text: "Excellent — Very easy to trade." }
    ]
  }
};

function useEscape(handler){
  useEffect(()=>{
    function onKey(e){ if(e.key === "Escape") handler(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

function Tooltip({ anchorId, open, onClose, children }){
  const ref = useRef(null);
  useEscape(()=> onClose?.());

  useEffect(()=>{
    function onClick(e){
      if(!ref.current) return;
      if(open && !ref.current.contains(e.target)) onClose?.();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  return (
    <div
      role="tooltip"
      id={`${anchorId}-tooltip`}
      ref={ref}
      className={`pointer-events-none fixed z-[60] max-w-[28rem] rounded-2xl border border-neutral-700 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur transition-opacity duration-150 ${open?"opacity-100":"opacity-0"}`}
      style={{ left: (window?._lastMouseX || 0) + 16, top: (window?._lastMouseY || 0) - 16 }}
    >
      {children}
    </div>
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("mousemove", (e)=>{
    window._lastMouseX = e.clientX; window._lastMouseY = e.clientY;
  });
}

function LegendCard({ title, example, zones }){
  return (
    <div className="text-sm text-neutral-200">
      <div className="mb-2 font-semibold text-neutral-50">{title}</div>
      <p className="mb-3 text-neutral-300">{example}</p>
      <ul className="space-y-1">
        {zones.map((z, i)=> (
          <li key={i} className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${z.color}`}></span>
            <span className="tabular-nums text-neutral-100 w-16">{z.range}</span>
            <span className="text-neutral-300">{z.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegendButton({ gauge = "breadth", label = "Legend" }){
  const id = useId();
  const [open, setOpen] = useState(false);
  const content = LEGEND[gauge] || LEGEND.breadth;

  return (
    <div className="relative inline-block">
      <button
        id={id}
        aria-describedby={open ? `${id}-tooltip` : undefined}
        onMouseEnter={()=> setOpen(true)}
        onMouseLeave={()=> setOpen(false)}
        onFocus={()=> setOpen(true)}
        onBlur={()=> setOpen(false)}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300 shadow hover:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-yellow-400/40"
      >
        ℹ️ {label}
      </button>
      <Tooltip anchorId={id} open={open} onClose={()=> setOpen(false)}>
        <LegendCard title={content.title} example={content.example} zones={content.zones} />
      </Tooltip>
    </div>
  );
}
