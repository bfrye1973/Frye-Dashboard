// src/components/LiveLWChart/LiveLWChart.jsx
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

/**
 * Multi-pane chart manager:
 * - Main price pane stays as before (EMAs, MFP, SR, Swing).
 * - SEPARATE indicators (squeeze, smi, volume) render in their own fixed-height subcharts below.
 * - Time scale is synchronized across panes.
 */

const SEPARATE_PANE_HEIGHT = 140; // default bottom pane height (px)
const MIN_PANES_CONTAINER_HEIGHT = 10;

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = 620,
  enabledIndicators = [],
  indicatorSettings = {},
}) {
  // main refs
  const hostRef = useRef(null);
  const mainRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const seriesMapRef = useRef(new Map());
  const [candles, setCandles] = useState([]);

  // panes (separate indicators) refs
  const panesWrapRef = useRef(null);
  const panesMapRef = useRef(
    new Map() // id -> { rootEl, chart, seriesMap }
  );

  // --- create base DOM scaffolding
  useEffect(() => {
    if (!hostRef.current) return;

    // Clear any old content on remount
    hostRef.current.innerHTML = "";

    // Outer container uses column layout: [ mainPane, panesWrap ]
    const root = hostRef.current;
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.width = "100%";
    root.style.height = `${height}px`;

    // Main pane
    const mainEl = document.createElement("div");
    mainEl.style.flex = "1 1 auto";
    mainEl.style.position = "relative";
    mainEl.style.minHeight = "160px";
    root.appendChild(mainEl);

    // Panes container
    const panesWrap = document.createElement("div");
    panesWrap.style.flex = "0 0 auto";
    panesWrap.style.display = "flex";
    panesWrap.style.flexDirection = "column";
    panesWrap.style.width = "100%";
    panesWrap.style.minHeight = `${MIN_PANES_CONTAINER_HEIGHT}px`;
    root.appendChild(panesWrap);

    panesWrapRef.current = panesWrap;

    // Main chart
    const chart = createChart(mainEl, { ...baseChartOptions, height: undefined });
    mainRef.current = chart;

    // Main price series
    const price = chart.addCandlestickSeries();
    mainSeriesRef.current = price;

    // Expose for overlays
    chart._container = mainEl;
    chart._priceSeries = price;

    return () => {
      // Cleanup sub-panes first
      try {
        for (const [, rec] of panesMapRef.current) {
          try { rec.chart?.remove(); } catch {}
        }
      } catch {}
      panesMapRef.current.clear();
      // Cleanup main chart
      try { chart.remove(); } catch {}
      mainRef.current = null;
      mainSeriesRef.current = null;
      seriesMapRef.current.clear();
      panesWrapRef.current = null;
      hostRef.current && (hostRef.current.innerHTML = "");
    };
  }, [height]);

  // --- load data + subscribe
  useEffect(() => {
    const chart = mainRef.current;
    const price = mainSeriesRef.current;
    if (!chart || !price) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      const seed = await feed.history();
      if (disposed) return;
      setCandles(seed);
      price.setData(seed);
      chart._candles = seed; // for overlays
    })();

    const unsub = feed.subscribe((bar) => {
      if (disposed) return;
      setCandles((prev) => {
        const next = mergeBar(prev, bar);
        price.update(bar);
        chart._candles = next;
        return next;
      });
    });

    return () => {
      disposed = true;
      unsub?.();
      feed.close?.();
    };
  }, [symbol, timeframe]);

  // --- Attach indicators (main overlays + separate panes)
  useEffect(() => {
    const chart = mainRef.current;
    const priceSeries = mainSeriesRef.current;
    const panesWrap = panesWrapRef.current;
    if (!chart || !priceSeries || !panesWrap || candles.length === 0) return;

    // Cleanup all main-series artifacts
    for (const [key, obj] of seriesMapRef.current) {
      if (key.endsWith("__cleanup") && typeof obj === "function") {
        try { obj(); } catch {}
      } else {
        try { chart.removeSeries(obj); } catch {}
      }
    }
    seriesMapRef.current.clear();

    // Determine which indicators are enabled
    const items = resolveIndicators(enabledIndicators, indicatorSettings);

    // Partition: overlays -> main, separates -> panes
    const overlayItems = [];
    const separateItems = [];
    for (const it of items) {
      const k = (it.def.kind || "").toUpperCase();
      if (k === "SEPARATE") separateItems.push(it);
      else overlayItems.push(it);
    }

    // 1) Attach overlays to main chart
    overlayItems.forEach(({ def, inputs }) => {
      const result = def.compute(candles, inputs);
      const cleanup = def.attach(chart, seriesMapRef.current, result, inputs);
      seriesMapRef.current.set(`${def.id}__cleanup`, cleanup);
    });

    // 2) Build sub-panes for separates
    // Sync time-scales (pan/zoom any pane -> apply to all)
    setupSyncTimeScales(mainRef.current, panesMapRef, panesWrap);

    // Mark which panes we need this render
    const needed = new Set(separateItems.map(x => x.def.id));

    // Create or reuse panes
    separateItems.forEach(({ def, inputs }) => {
      let rec = panesMapRef.current.get(def.id);
      if (!rec) {
        // Make root div for pane
        const rootEl = document.createElement("div");
        rootEl.style.height = `${paneHeightFor(def.id)}px`;
        rootEl.style.position = "relative";
        rootEl.style.borderTop = "1px solid rgba(60, 72, 92, 0.6)";
        panesWrap.appendChild(rootEl);

        const paneChart = createChart(rootEl, {
          ...baseChartOptions,
          height: undefined,
          rightPriceScale: {
            ...baseChartOptions.rightPriceScale,
            borderVisible: false,
          },
          leftPriceScale: { visible: false },
          timeScale: {
            ...baseChartOptions.timeScale,
            borderVisible: false,
          },
          grid: {
            ...baseChartOptions.grid,
            vertLines: { ...baseChartOptions.grid.vertLines, visible: false },
          },
        });

        // record
        rec = { rootEl, chart: paneChart, seriesMap: new Map() };
        panesMapRef.current.set(def.id, rec);
      }

      // Fill data + attach series for this pane
      const fakeApi = paneApi(rec.chart, candles);
      const result = def.compute(candles, inputs);
      const cleanup = def.attach(fakeApi, rec.seriesMap, result, inputs);
      rec.seriesMap.set(`${def.id}__cleanup`, cleanup);
    });

    // Remove panes that are no longer needed
    for (const [id, rec] of panesMapRef.current) {
      if (!needed.has(id)) {
        // Cleanup series in that pane
        for (const [k, v] of rec.seriesMap) {
          if (k.endsWith("__cleanup") && typeof v === "function") {
            try { v(); } catch {}
          } else {
            try { rec.chart.removeSeries(v); } catch {}
          }
        }
        rec.seriesMap.clear();
        try { rec.chart.remove(); } catch {}
        try { panesWrap.removeChild(rec.rootEl); } catch {}
        panesMapRef.current.delete(id);
      }
    }

    return () => {
      // Cleanup overlays on main
      for (const [key, fn] of seriesMapRef.current) {
        if (key.endsWith("__cleanup") && typeof fn === "function") {
          try { fn(); } catch {}
        }
      }
      seriesMapRef.current.clear();
      // (leave panes to be cleaned on next render or unmount)
    };
  }, [candles, enabledIndicators, indicatorSettings]);

  return <div ref={hostRef} style={{ width: "100%", height }} />;
}

/* ----------------- helpers ----------------- */

function mergeBar(prev, bar) {
  if (!prev?.length) return [bar];
  const last = prev[prev.length - 1];
  if (last.time === bar.time) {
    const next = prev.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}

function paneHeightFor(id) {
  // You can customize per-indicator if desired
  // e.g., if (id === "vol") return 120;
  return SEPARATE_PANE_HEIGHT;
}

function paneApi(chart, candles) {
  // Expose a lightweight API compatible with our indicators
  chart._container = chart._container || chart._hostElement || chart._paneElement;
  chart._candles = candles;
  // ensure addXXXSeries exist from lightweight-charts chart
  return chart;
}

function setupSyncTimeScales(mainChart, panesMapRef, panesWrap) {
  if (!mainChart || !panesWrap) return;

  // Avoid installing duplicate listeners
  if (mainChart.__syncInstalled) return;
  mainChart.__syncInstalled = true;

  let syncing = false;
  const onMain = () => {
    if (syncing) return;
    syncing = true;
    try {
      const lr = mainChart.timeScale().getVisibleLogicalRange?.();
      if (!lr) return;
      for (const [, rec] of panesMapRef.current) {
        try { rec.chart.timeScale().setVisibleLogicalRange(lr); } catch {}
      }
    } finally { syncing = false; }
  };

  const onPane = (srcChart) => () => {
    if (syncing) return;
    syncing = true;
    try {
      const lr = srcChart.timeScale().getVisibleLogicalRange?.();
      if (!lr) return;
      // apply to main
      try { mainChart.timeScale().setVisibleLogicalRange(lr); } catch {}
      // apply to other panes
      for (const [, rec] of panesMapRef.current) {
        if (rec.chart === srcChart) continue;
        try { rec.chart.timeScale().setVisibleLogicalRange(lr); } catch {}
      }
    } finally { syncing = false; }
  };

  // Subscribe once: main -> panes
  mainChart.timeScale().subscribeVisibleLogicalRangeChange(onMain);

  // Each time panes set changes, (re)subscribe their handlers
  const refreshPaneSubs = () => {
    for (const [, rec] of panesMapRef.current) {
      if (rec.__subscribed) continue;
      const ts = rec.chart.timeScale();
      const handler = onPane(rec.chart);
      ts.subscribeVisibleLogicalRangeChange(handler);
      rec.__subscribed = true;
      rec.__handler = handler;
    }
  };

  // little observer to subscribe when panes get added
  const obs = new MutationObserver(() => refreshPaneSubs());
  obs.observe(panesWrap, { childList: true });

  // initial
  refreshPaneSubs();

  // Save so it can be found on unmount if needed
  mainChart.__paneSyncObserver = obs;
}
