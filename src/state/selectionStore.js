import { create } from "zustand";


export const useSelectionStore = create((set, get) => ({
selection: {
symbol: "SPY",
strategy: "alignment", // "alignment" | "wave3" | "flag"
timeframe: "10m", // "10m" | "1h" | "4h" | "D" | "W"
overlays: {},
context: {},
},
setSelection: (partial) => set(({ selection }) => ({ selection: { ...selection, ...partial } })),
setSymbol: (symbol) => set(({ selection }) => ({ selection: { ...selection, symbol } })),
setStrategy: (strategy) => set(({ selection }) => ({ selection: { ...selection, strategy } })),
setTimeframe: (timeframe) => set(({ selection }) => ({ selection: { ...selection, timeframe } })),
}));
