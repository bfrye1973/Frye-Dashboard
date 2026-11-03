// Engine 2 / Engine 11: isolated 5m infinite-history proof.
// This module is deliberately NOT mounted by LIVE RowChart.
// No historical source, rollover or approved anchor is changed.
const KEEP_UI_BARS = 25000;

function validateBars(bars, label) {
  if (!Array.isArray(bars) || bars.length === 0) throw Error(label + "_EMPTY");
  const ordered = [...bars].sort((a, b) => a.time - b.time);
  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i];
    if (!Number.isFinite(b.time) ||
        !["open", "high", "low", "close"].every(k => Number.isFinite(b[k])) ||
        (i && ordered[i - 1].time === b.time)) {
      throw Error(label + "_INVALID_OR_DUPLICATE");
    }
  }
  return ordered;
}
const candle = b => ({
  time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
});
const volume = b => ({
  time:b.time, value:Number(b.volume || 0),
  color:b.close >= b.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
});

export function createEngine115mInfiniteHistoryProof({
  chart,
  priceSeries,
  volumeSeries,
  frame = "5m",
  fetchPage,
  onWorkingBars,
  onError,
  onHistoryStatus,
  thresholdBars = 100,
  ownerKey,
} = {}) {
  if (!new Set(["5m", "10m"]).has(frame)) throw Error("ENGINE11_PAGER_FRAME_UNSUPPORTED");
  if (!chart?.timeScale || !priceSeries?.setData ||
      !priceSeries?.update || typeof fetchPage !== "function") {
    throw Error("ENGINE11_PROOF_DEPENDENCIES_REQUIRED");
  }
  let loaded = [];
  let nextCursor = null;
  let started = false;
  let destroyed = false;
  let loading = false;
  let olderPromise = null;
  let archiveLastTime = null;
  let lastTime = null;
  let pages = 0;
  let activeContract = null;
  let subscription = null;
  const controllers = new Set();
  const report = () => onHistoryStatus?.({
    pages, loadedBars: loaded.length, nextPageAvailable: nextCursor !== null,
    loading, ready: started, terminalContract: activeContract,
  });
  const publishCache = () => onWorkingBars?.(loaded.slice(-KEEP_UI_BARS));
  const pageRequest = async cursor => {
    const ctrl = new AbortController();
    controllers.add(ctrl);
    try {
      return await fetchPage({frame,cursor,signal:ctrl.signal,accessKey:ownerKey});
    } finally {
      controllers.delete(ctrl);
    }
  };
  const validatePage = result => {
    const p = result?.page;
    if (p?.frame !== frame || p?.researchOnly !== true ||
        p?.structuralEligible !== false || p?.executionPriceAuthority !== false ||
        !Array.isArray(result?.bars)) {
      throw Error("ENGINE11_PAGER_PAGE_CONTEXT");
    }
    return validateBars(result.bars, "ENGINE11_PROOF_PAGE");
  };
  function commit(full, extra = 0, preserveViewport = false) {
    const clock = chart.timeScale();
    // In LWC 4.2, historical prepend requires deliberate setData(),
    // not update(). Preserve visible time independently of logical index.
    const visible = preserveViewport ? clock.getVisibleRange?.() : null;
    priceSeries.setData(full.map(candle));
    volumeSeries?.setData(full.map(volume));
    loaded = full;
    lastTime = loaded[loaded.length - 1].time;
    if (preserveViewport && visible?.from != null && visible?.to != null) {
      clock.setVisibleRange?.(visible);
    }
    publishCache();
    report();
  }
  async function loadOlder() {
    if (!started || destroyed || loading || nextCursor === null) return false;
    loading = true;
    report();
    const cursor = nextCursor;
    olderPromise = (async () => {
      try {
        const result = await pageRequest(cursor);
        if (destroyed) return false;
        const older = validatePage(result);
        if (older[older.length - 1].time >= loaded[0].time) {
          throw Error("ENGINE11_PROOF_OVERLAPPING_OLDER_PAGE");
        }
        // loaded includes all previously appended LIVE candles and all
        // previously verified historical pages. Never reconstruct from barsRef.
        commit([...older, ...loaded], older.length, true);
        nextCursor = result.page.nextCursor ?? null;
        pages++;
        report();
        return true;
      } catch (e) {
        if (!destroyed) onError?.(e);
        return false;
      } finally {
        loading = false;
        olderPromise = null;
        if (!destroyed) report();
      }
    })();
    return olderPromise;
  }
  const onRange = range => {
    if (!started || destroyed || loading || nextCursor === null || !range) return;
    const info = priceSeries.barsInLogicalRange?.(range);
    if (info && info.barsBefore < thresholdBars) {
      // The event API requires no network call during every scroll tick.
      // loadOlder deduplicates concurrent requests.
      void loadOlder();
    }
  };
  async function start() {
    if (started || destroyed) throw Error("ENGINE11_PROOF_ALREADY_STARTED");
    loading = true;
    report();
    try {
      const result = await pageRequest(null);
      if (destroyed) return false;
      const first = validatePage(result);
      const desc = result.page.rows;
      if (!desc?.length || typeof desc[0].sourceContract !== "string") {
        throw Error("ENGINE11_PROOF_TERMINAL_CONTRACT_MISSING");
      }
      activeContract = desc[0].sourceContract;
      archiveLastTime = first[first.length - 1].time;
      nextCursor = result.page.nextCursor ?? null;
      pages = 1;
      commit(first);
      started = true;
      subscription = onRange;
      chart.timeScale().subscribeVisibleLogicalRangeChange(subscription);
      report();
      return true;
    } catch (e) {
      if (!destroyed) onError?.(e);
      return false;
    } finally {
      loading = false;
      if (!destroyed) report();
    }
  }
  function updateLive(bar, { contractVerified = false } = {}) {
    if (!started || destroyed || !contractVerified ||
        !Number.isFinite(bar?.time) ||
        !["open","high","low","close"].every(k => Number.isFinite(bar[k]))) {
      return false;
    }
    // The most recent verified archive candle is immutable, including
    // an overlapping forming candle. Never accept an older LIVE correction.
    if (bar.time <= archiveLastTime || bar.time < lastTime) return false;
    // Delegate only the current/new bucket to the incremental API.
    priceSeries.update(candle(bar));
    volumeSeries?.update(volume(bar));
    if (bar.time === lastTime) loaded[loaded.length - 1] = {...bar};
    else loaded.push({...bar});
    lastTime = bar.time;
    publishCache();
    return true;
  }
  function destroy() {
    destroyed = true;
    controllers.forEach(c => c.abort());
    controllers.clear();
    if (subscription) {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(subscription);
      subscription = null;
    }
  }
  return {
    start, loadOlder, updateLive, destroy,
    snapshot: () => ({
      started, loading, pages, nextCursor, loadedBars:loaded.length,
      earliestTime:loaded[0]?.time ?? null,
      latestTime:loaded.at(-1)?.time ?? null,
      archiveLastTime, terminalContract:activeContract,
    }),
  };
}
