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

const STORAGE_KEY = "frye.uiScale.v2";
const STORAGE_MODE = "frye.uiMode.v2"; // "auto" | "manual"

// Context lets other components (like NoScale) know the current scale
const ScaleCtx = createContext({ scale: 1 });

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export default function UIScaler({
  children,
  minReadable = 0.45,
  maxScale = 1.6,
  defaultScale = 0.60,
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

  const innerRef = useRef(null);

  // Auto fit to window height (never below minReadable)
  const recalcAuto = () => {
    const el = innerRef.current;
    if (!el) return;
    const naturalH =
      el.scrollHeight ||
      el.getBoundingClientRect().height ||
      window.innerHeight;
    const target = window.innerHeight / naturalH;
    const fitted = clamp(target, minReadable, maxScale);
    setScale(+fitted.toFixed(3));
  };

  useLayoutEffect(() => {
    if (mode === "auto") recalcAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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

  // expose CSS var too (for any advanced styling)
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
  }, [scale]);

  // keyboard shortcuts (Ctrl/Cmd + = / - / 0)
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

  // Only scale the content inside this div.
  const scaledStyle = useMemo(
    () => ({
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      width: `${100 / scale}%`,
      minHeight: `${100 / scale}vh`,
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
        style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
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
      {/* Everything inside THIS div is scaled */}
      <div ref={innerRef} style={scaledStyle}>
        {children}
      </div>
      <Control />
    </ScaleCtx.Provider>
  );
}

/**
 * NoScale — wraps content that must render at true 1:1,
 * even when the app is globally scaled. It applies an inverse
 * transform so children render at their natural size.
 */
export function NoScale({ children, style }) {
  const { scale } = useContext(ScaleCtx);
  const inv = 1 / (scale || 1);
  const s = {
    transform: `scale(${inv})`,
    transformOrigin: "top left",
    width: `${100 * (scale || 1)}%`,
    minHeight: `${100 * (scale || 1)}vh`,
    ...style,
  };
  return <div style={s}>{children}</div>;
}
