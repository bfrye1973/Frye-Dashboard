// Engine 2 read-only chart-load profiler. No private keys, source prices, or URLs.
// Reports only when ?engine2LoadAudit=1 (or __ENGINE2_LOAD_AUDIT__ === true).
export const historyEndpoint = (source) => source === "engine11-2020plus" ||
  source === "engine11-legacy"
  ? "/engine2c-private-history/page"
  : source === "futures-ohlc" ? "/api/v1/futures/ohlc"
  : "/api/v1/ohlc";

export function createChartLoadProbe({
  symbol, timeframe, visit = 1, now = () => performance.now(), onReport,
} = {}) {
  const began = now();
  let reported = false;
  const metrics = {
    symbol,
    timeframe,
    visit,
    repeatedTimeframe: visit > 1,
    source: "not-selected",
    endpoint: null,
    requests: 0,
    rowsDownloaded: 0,
    rowsPlotted: 0,
    networkMs: 0,
    browserParseMs: 0,
    browserTransformMs: 0,
    browserMergeMs: 0,
    browserSortMs: 0,
    seedPrepareMs: null,
    candleSetDataMs: null,
    volumeSetDataMs: null,
    historyFetchCompleteMs: null,
    firstVerifiedPageMs: null,
    firstVerifiedPageRows: null,
    firstPaintOpportunityMs: null,
    visibleTimeRangePresent: false,
    totalMs: null,
    status: "STARTED",
  };
  const elapsed = () => Math.round((now() - began) * 10) / 10;
  const add = (field, value) => {
    if (Number.isFinite(value) && value >= 0) {
      metrics[field] = Math.round((metrics[field] + value) * 10) / 10;
    }
  };
  return {
    source(source) {
      metrics.source = source;
      metrics.endpoint = historyEndpoint(source);
    },
    page(detail = {}) {
      metrics.requests++;
      metrics.rowsDownloaded += detail.rows ?? 0;
      add("networkMs", detail.networkMs);
      add("browserParseMs", detail.parseMs);
      add("browserTransformMs", detail.transformMs);
      add("browserMergeMs", detail.mergeMs);
      if (metrics.firstVerifiedPageMs === null) {
        metrics.firstVerifiedPageMs = elapsed();
        metrics.firstVerifiedPageRows = detail.rows ?? 0;
      }
    },
    regular(detail = {}) {
      metrics.requests++;
      metrics.rowsDownloaded += detail.rawRows ?? detail.rows ?? 0;
      add("networkMs", detail.networkMs);
      add("browserParseMs", detail.parseMs);
      add("browserTransformMs", detail.normalizeMs);
      if (metrics.firstVerifiedPageMs === null) {
        metrics.firstVerifiedPageMs = elapsed();
        metrics.firstVerifiedPageRows = detail.rows ?? 0;
      }
    },
    fetched() { metrics.historyFetchCompleteMs = elapsed(); },
    sorted(ms) { add("browserSortMs", ms); },
    seedPrepared(ms) { metrics.seedPrepareMs = Math.round(ms * 10) / 10; },
    candleSetData(ms, count) {
      metrics.candleSetDataMs = Math.round(ms * 10) / 10;
      metrics.rowsPlotted = count;
    },
    volumeSetData(ms) { metrics.volumeSetDataMs = Math.round(ms * 10) / 10; },
    finish({ status = "OK", visibleTimeRangePresent = false, paintOpportunity = false } = {}) {
      if (reported) return;
      reported = true;
      metrics.status = status;
      metrics.visibleTimeRangePresent = Boolean(visibleTimeRangePresent);
      if (paintOpportunity) metrics.firstPaintOpportunityMs = elapsed();
      metrics.totalMs = elapsed();
      // This is a render opportunity proxy, not proof of visible pixels.
      onReport?.({ ...metrics });
      return { ...metrics };
    },
  };
}

export function recordChartLoadReport(report) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (q.get("engine2LoadAudit") !== "1" && window.__ENGINE2_LOAD_AUDIT__ !== true) return;
  const previous = Array.isArray(window.__engine2ChartLoadReports)
    ? window.__engine2ChartLoadReports : [];
  window.__engine2ChartLoadReports = [...previous, report].slice(-30);
  console.info("[Engine2 Chart Load Audit]", report);
}
