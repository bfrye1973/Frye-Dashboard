import React from "react";

export const ViewModes = {
  METER_TILES: "meterTiles",
  TRAFFIC: "traffic",
  ARROWS: "arrows",
};

const ModeContext = React.createContext({
  mode: ViewModes.METER_TILES,
  setMode: () => {},
});

export function ModeProvider({ initial = ViewModes.METER_TILES, children }) {
  const [mode, setMode] = React.useState(() => {
    const saved = typeof window !== "undefined" && window.localStorage.getItem("viewMode");
    return saved && Object.values(ViewModes).includes(saved) ? saved : initial;
  });

  React.useEffect(() => {
    try { window.localStorage.setItem("viewMode", mode); } catch {}
  }, [mode]);

  const value = React.useMemo(() => ({ mode, setMode }), [mode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useViewMode() {
  return React.useContext(ModeContext);
}
