// src/context/ModeContext.jsx
import React from "react";

// ---- Dashboard View Modes (kept exactly as you had) ----
export const ViewModes = {
  METER_TILES: "meterTiles",
  TRAFFIC: "traffic",
  ARROWS: "arrows",
};

// ---- Context shape ----
const ModeContext = React.createContext({
  mode: ViewModes.METER_TILES,
  setMode: () => {},
  // NEW: global selection for Strategy → Chart wiring
  selection: { symbol: "SPY", strategy: "alignment", timeframe: "10m" },
  setSelection: () => {},
});

// ---- Provider ----
export function ModeProvider({ initial = ViewModes.METER_TILES, children }) {
  // View mode (with localStorage like before)
  const [mode, setMode] = React.useState(() => {
    const saved =
      typeof window !== "undefined" && window.localStorage.getItem("viewMode");
    return saved && Object.values(ViewModes).includes(saved) ? saved : initial;
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem("viewMode", mode);
    } catch {}
  }, [mode]);

  // NEW: global selection (single source of truth for Row 5 → Row 6)
  const [selection, setSelection] = React.useState({
    symbol: "SPY",
    strategy: "alignment",
    timeframe: "10m",
  });

  const value = React.useMemo(
    () => ({ mode, setMode, selection, setSelection }),
    [mode, selection]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

// ---- Hooks ----
export function useViewMode() {
  return React.useContext(ModeContext);
}
export function useSelection() {
  return React.useContext(ModeContext);
}

export default ModeContext;
