// Engine 11B: the active historical chart and bounded UI working set are
// separate authorities. LIVE gap repair must never rebuild the chart from
// barsRef.current when an Engine 11 archive (full or paged) is present.
export function mustPreserveEngine11HistoricalSeries({fullEngine11Loaded = false, activeEngine11Pager = false} = {}) {
  return Boolean(fullEngine11Loaded || activeEngine11Pager);
}
