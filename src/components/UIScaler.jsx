// src/components/UIScaler.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * SAFE UI Scaler (v2.2)
 * - No minHeight hacks (prevents the black-gap above the chart)
 * - Chart-safe: export <NoScale> to render charts at true 1:1
 * - Auto/Manual modes with localStorage + URL overrides (?scale=0.7&mode=manual)
 * - Bottom-right control: + / – / Fit / Auto
 */

const STORAGE_KEY = "frye.uiScale.v2";
const STORAGE_MODE = "frye.uiMode.v2"; // "auto" | "manual"
const ScaleCtx = createContext({ scale: 1 });

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export default function UIScaler({
  children,
  // never allow unreadable sizes
  minReadable = 0.45,
  // allow zoom-in beyond 100% if desired
  maxScale = 1.6,
  // good starting point for 34"
  defaultScale = 0.60,
  // start manual so it stays zoomed-in unless you toggle Auto
  defaultMode = "manual",
}) {
  const params = new URLSearchParams(window.location.search);
  const urlScale = params.get("scale");
  const urlMode = params.get("mode"); // "auto" | "manual"

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_MODE);
    return (urlMode === "auto" || urlMode === "manual")
      ? urlMode
      : (saved || defaultMode);
  });

  const [scale, setScale] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    const base = !isNaN(saved) && saved > 0 ? saved : defaultScale;
    const s = urlScale ? Number(urlScale) : base;
    return clamp(s || 1, minReadable, maxScale);
  });

  // Outer holds the scaled layer (scaled) purely for measurement/DOM access.
  const outerRef = useRef(null);
  const scaledRef = useRef(null);

  // --- Auto-fit (height) WITHOUT introducing extra blank space
  // We temporarily measure the natural height with transform removed.
  const recalcAuto = () => {
    const el = scaledRef.current;
    if (!el) return;

    // Temporarily disable transform for a clean measurement
    const prevTransform = el.style.transform;
    const prevWidth = el.style.width;

    el.style.transform = "none";
    el.style.width = "100%";

    // Measure natural content height
    const naturalH =
      el.scrollHeight ||
      el.offsetHeight ||
      el.getBoundingClientRect().height ||
      window.innerHeight;

    // Restore transform styles
    el.style.transform = prevTransform;
    el.style.width = prevWidth;

    // Compute target scale to fit viewport height
    const target = window.innerHeight / naturalH;
    const fitted = clamp(+target.toFixed(4), minReadable, maxScale);
    setScale(fitted);
  };

  // Initial pass (layout-first to avoid flicker)
  useLayoutEffect(() => {
    if (mode === "auto") recalcAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Recalc on resize in auto mode
  useEffect(() => {
    if (mode !== "auto") return;
    const onResize = () => recalcAuto();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Persist
  useEffect(() => localStorage.setItem(STORAGE_KEY, String(scale)), [scale]);
  useEffect(() => localStorage.setItem(STORAGE_MODE, mode), [mode]);

  // Expose CSS var (optional)
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
  }, [scale]);

  // Keyboard shortcuts (Ctrl/Cmd + = / - / 0)
  useEffect(() => {
    const onKey = (e) => {
      const accel = e.ctrlKey || e.metaKey;
      if (!accel) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setMode("manual");
        setScale((s) => clamp(+(s + 0.05).toFixed(2), minReadable, maxScale));
      }
      if (e.key === "-") {
        e.preventDefault();
        setMode("manual");
        setScale((s) => clamp(+(s - 0.05).toFixed(2), minReadable, maxScale));
      }
      if (e.key === "0") {
        e.preventDefault();
        setMode("auto");
        recalcAuto();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minReadable, maxScale]);

  // ✅ Scaled layer:
  // - No minHeight here (this removed the black band)
  // - Width correction keeps layout edges aligned while scaling
  const scaledStyle = useMemo(
    () => ({
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      width: `${100 / scale}%`,
      display: "block",
    }),
    [scale]
  );

  const Control = () => (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        background: "rgba(16,16,20,0.75)",
        border: "1px solid #2b2b2b",
        borderRadius: 10,
        padding: "8px 10px",
        color: "#cbd5e1",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
      }}
    >
      <span style={{ opacity: 0.8 }}>UI Scale</span>
      <button
        onClick={() => {
          setMode("manual");
          setScale((s) =>
            clamp(+(s - 0.05).toFixed(2), minReadable, maxScale)
          );
        }}
      >
        −
      </button>
      <span style={{ minWidth: 44, textAlign: "center" }}>
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={() => {
          setMode("manual");
          setScale((s) =>
            clamp(+(s + 0.05).toFixed(2), minReadable, maxScale)
          );
        }}
      >
        +
      </button>
      <span style={{ opacity: 0.4 }}>|</span>
      <button
        onClick={() => {
          setMode("auto");
          recalcAuto();
        }}
      >
        Fit
      </button>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
        title="Auto-fit to screen height"
      >
        <input
          type="checkbox"
          checked={mode === "auto"}
          onChange={(e) => {
            const next = e.target.checked ? "auto" : "manual";
            setMode(next);
            if (next === "auto") recalcAuto();
          }}
        />
        Auto
      </label>
    </div>
  );

  return (
    <ScaleCtx.Provider value={{ scale }}>
      <div ref={outerRef}>
        {/* Only this layer is scaled (no minHeight) */}
        <div ref={scaledRef} style={scaledStyle}>
          {children}
        </div>
      </div>
      <Control />
    </ScaleCtx.Provider>
  );
}

/**
 * NoScale — Wrap content that must render at true 1:1
 * (e.g., TradingView/Lightweight-Charts) to avoid the “black canvas” issue.
 */
export function NoScale({ children, style }) {
  const { scale } = useContext(ScaleCtx);
  const inv = 1 / (scale || 1);

  // Only inverse-scale; do NOT set minHeight here.
  const s = {
    transform: `scale(${inv})`,
    transformOrigin: "top left",
    width: `${100 * (scale || 1)}%`,
    display: "block",
    ...style,
  };

  return <div style={s}>{children}</div>;
}
