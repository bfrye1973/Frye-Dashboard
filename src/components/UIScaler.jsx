import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "frye.uiScale.v1";

function defaultScale() {
  const w = window.screen.width;
  if (w >= 3400) return 0.25;   // 34" ultrawide
  if (w >= 2550) return 0.50;   // 27" 1440p
  if (w >= 1900) return 0.75;   // 1080p
  return 1.0;
}

export default function UIScaler({ children }) {
  const [scale, setScale] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved || defaultScale();
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, scale), [scale]);

  const style = useMemo(() => ({
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `${100 / scale}%`,
    height: `${100 / scale}vh`,
  }), [scale]);

  const Control = () => (
    <div style={{
      position: "fixed", right: 12, bottom: 12, zIndex: 9999,
      background: "rgba(20,20,20,0.7)", border: "1px solid #2b2b2b",
      borderRadius: 8, padding: "6px 10px", color: "#ccc", fontSize: 12
    }}>
      <button onClick={() => setScale(s => Math.max(0.25, +(s - 0.05).toFixed(2)))}>−</button>
      <span style={{ padding: "0 8px" }}>{(scale * 100).toFixed(0)}%</span>
      <button onClick={() => setScale(s => Math.min(1.2, +(s + 0.05).toFixed(2)))}>+</button>
    </div>
  );

  return (
    <>
      <div style={style}>{children}</div>
      <Control />
    </>
  );
}
