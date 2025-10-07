import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "frye.uiScale.v2";
const STORAGE_MODE = "frye.uiMode.v2"; // "auto" | "manual"

// clamp helper
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export default function UIScaler({ children, minReadable = 0.38, maxScale = 1.2 }) {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_MODE) || "auto");
  const [scale, setScale] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved > 0 ? saved : 1;
  });

  const innerRef = useRef(null);

  // ---- AUTO FIT: measure natural height then fit to viewport height
  const recalcAuto = () => {
    const el = innerRef.current;
    if (!el) return;
    // el.scrollHeight is the natural (unscaled) content height
    const naturalH = el.scrollHeight || el.getBoundingClientRect().height || window.innerHeight;
    const target = window.innerHeight / naturalH;       // scale to fit height
    const fitted = clamp(target, minReadable, maxScale); // keep it readable
    setScale(+fitted.toFixed(3));
  };

  // initial calc
  useLayoutEffect(() => {
    if (mode === "auto") recalcAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // recalc on window resize in auto mode
  useEffect(() => {
    if (mode !== "auto") return;
    const onResize = () => recalcAuto();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // persist
  useEffect(() => localStorage.setItem(STORAGE_KEY, String(scale)), [scale]);
  useEffect(() => localStorage.setItem(STORAGE_MODE, mode), [mode]);

  // keyboard shortcuts (manual fine-tune)
  useEffect(() => {
    const onKey = (e) => {
      const accel = e.ctrlKey || e.metaKey;
      if (!accel) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); setMode("manual"); setScale(s => clamp(+(s + 0.05).toFixed(2), minReadable, maxScale)); }
      if (e.key === "-")                   { e.preventDefault(); setMode("manual"); setScale(s => clamp(+(s - 0.05).toFixed(2), minReadable, maxScale)); }
      if (e.key === "0")                   { e.preventDefault(); setMode("auto");  recalcAuto(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minReadable, maxScale]);

  // transform wrapper: scale + width correction so layout doesn’t clip
  const style = useMemo(() => ({
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `${100 / scale}%`,
    minHeight: `${100 / scale}vh`,
  }), [scale]);

  const Control = () => (
    <div style={{
      position: "fixed", right: 12, bottom: 12, zIndex: 9999,
      background: "rgba(16,16,20,0.75)", border: "1px solid #2b2b2b",
      borderRadius: 10, padding: "8px 10px", color: "#cbd5e1", fontSize: 12, display: "flex", alignItems: "center", gap: 8
    }}>
      <span style={{ opacity: 0.8 }}>UI Scale</span>
      <button onClick={() => { setMode("manual"); setScale(s => clamp(+(s - 0.05).toFixed(2), minReadable, maxScale)); }}>−</button>
      <span style={{ minWidth: 44, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
      <button onClick={() => { setMode("manual"); setScale(s => clamp(+(s + 0.05).toFixed(2), minReadable, maxScale)); }}>+</button>
      <span style={{ opacity: 0.4 }}>|</span>
      <button onClick={() => { setMode("auto"); recalcAuto(); }}>Fit</button>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={mode === "auto"}
          onChange={(e) => { const next = e.target.checked ? "auto" : "manual"; setMode(next); if (next === "auto") recalcAuto(); }}
        />
        Auto
      </label>
    </div>
  );

  return (
    <>
      {/* innerRef measures natural (unscaled) height */}
      <div ref={innerRef} style={style}>{children}</div>
      <Control />
    </>
  );
}
