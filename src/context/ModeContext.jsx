import React from "react";

export const ViewModes = {
  METER_TILES: "meterTiles",
  TRAFFIC: "traffic",
  ARROWS: "arrows",
};

const ModeContext = React.createContext({
  mode: ViewModes.METER_TILES,
  setMode: () => {},
  selection: { symbol: "SPY", strategy: "alignment", timeframe: "10m" },
  setSelection: () => {},
  setSelectionImmediate: () => {},
});

export function ModeProvider({ initial = ViewModes.METER_TILES, children }) {
  // --- view mode (persist) ---
  const [mode, setMode] = React.useState(() => {
    const saved =
      typeof window !== "undefined" && window.localStorage.getItem("viewMode");
    return saved && Object.values(ViewModes).includes(saved) ? saved : initial;
  });
  React.useEffect(() => {
    try { window.localStorage.setItem("viewMode", mode); } catch {}
  }, [mode]);

  // --- global selection (Row5 → Row6) ---
  const [selection, _setSelection] = React.useState({
    symbol: "SPY",
    strategy: "alignment",
    timeframe: "10m",
  });

  // Debounced setter (250ms)
  const selTimerRef = React.useRef(null);
  const setSelection = React.useCallback((next) => {
    if (selTimerRef.current) clearTimeout(selTimerRef.current);
    selTimerRef.current = setTimeout(() => {
      _setSelection((prev) => ({ ...prev, ...next }));
      selTimerRef.current = null;
    }, 250);
  }, []);

  // Immediate setter (escape hatch if needed later)
  const setSelectionImmediate = React.useCallback((next) => {
    if (selTimerRef.current) clearTimeout(selTimerRef.current);
    _setSelection((prev) => ({ ...prev, ...next }));
  }, []);

  const value = React.useMemo(
    () => ({ mode, setMode, selection, setSelection, setSelectionImmediate }),
    [mode, selection, setSelection, setSelectionImmediate]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useViewMode() { return React.useContext(ModeContext); }
export function useSelection() { return React.useContext(ModeContext); }

export default ModeContext;
