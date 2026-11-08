// Engine 2 / Engine 22: read-only revisioned node history; no wave calculations.
// A server-side, same-origin authenticated proxy must supply the Engine 22 feed.
// Do not place any Engine 22 bearer token in browser code.
export const WAVE_DEGREES = Object.freeze([
  "primary", "intermediate", "minor", "minute",
  "subminute", "micro", "submicro",
]);
const SCHEMA = "engine22.chartNodeHistoryPage.v1";
const isUtc = (v) => typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v) &&
  Number.isFinite(Date.parse(v));

export function approvedNodeForChart(node, {
  chartPriceBasisId, historicalAsOfSupported = false,
} = {}) {
  if (!historicalAsOfSupported || !node || node.plotAllowed !== true ||
      node.approvalStatus !== "OWNER_APPROVED" ||
      node.priceBasisId !== chartPriceBasisId ||
      !WAVE_DEGREES.includes(node.degree) ||
      !node.nodeId || !node.waveId || !node.countId ||
      !node.contractSymbol || !isUtc(node.marketAtUtc) ||
      !Number.isFinite(node.esPrice)) return null;
  return {
    id: node.nodeId, waveId: node.waveId, countId: node.countId,
    degree: node.degree, label: node.label || node.nodeId,
    price: node.esPrice, timeSec: Math.floor(Date.parse(node.marketAtUtc) / 1000),
    approvalStatus: node.approvalStatus, lifecycle: node.lifecycle,
    modelVersion: node.modelVersion || null, sourceRevision: node.sourceRevision,
    publicationRevision: node.publicationRevision,
    supersedesNodeId: node.supersedesNodeId || null,
  };
}

export function classifyNodeRecord(node) {
  if (node?.approvalStatus === "SUPERSEDED" || node?.lifecycle === "SUPERSEDED")
    return "superseded";
  if (node?.approvalStatus === "OWNER_APPROVED") return "approved";
  return "research";
}

export function createWaveNodeHistoryReader({ getPage, onUpdate } = {}) {
  if (typeof getPage !== "function") throw Error("ENGINE22_HISTORY_READER_REQUIRES_PAGE_FETCH");
  const state = { cursor: 0, events: [], seen: new Set(), historicalAsOfSupported: false };
  let closed = false;
  let inflight = null;
  const snapshot = () => ({
    cursor: state.cursor,
    events: state.events.slice(),
    historicalAsOfSupported: state.historicalAsOfSupported,
  });
  const refresh = () => {
    if (closed) return Promise.resolve(snapshot());
    if (inflight) return inflight;
    inflight = (async () => {
      let changed = false;
      // Pagination may contain revisions that have no node changes.
      for (let batch = 0; batch < 200 && !closed; batch++) {
        const page = await getPage({ afterRevision: state.cursor, limit: 50 });
        if (closed) break;
        if (page?.schema !== SCHEMA || page?.readOnly !== true ||
            !Number.isSafeInteger(page.nextRevision) ||
            page.nextRevision < state.cursor ||
            typeof page.hasMore !== "boolean" || !Array.isArray(page.records)) {
          throw Error("ENGINE22_NODE_HISTORY_CONTRACT_MISMATCH");
        }
        if (page.hasMore && page.nextRevision === state.cursor)
          throw Error("ENGINE22_NODE_HISTORY_CURSOR_STALLED");
        // All pages share the same historical-as-of gate; a later false disables plotting.
        const nextAsOf = page.historicalAsOfSupported === true;
        if (state.historicalAsOfSupported !== nextAsOf) changed = true;
        state.historicalAsOfSupported = nextAsOf;
        for (const record of page.records) {
          if (!record?.nodeId || !Number.isSafeInteger(record.sourceRevision) ||
              !Number.isSafeInteger(record.publicationRevision) ||
              record.publicationRevision > page.nextRevision ||
              record.publicationRevision <= state.cursor)
            throw Error("ENGINE22_NODE_HISTORY_INVALID_RECORD");
          const id = record.publicationRevision + ":" + record.nodeId + ":" + record.sourceRevision;
          if (!state.seen.has(id)) {
            state.seen.add(id);
            state.events.push({ ...record });
            changed = true;
          }
        }
        if (page.nextRevision !== state.cursor) changed = true;
        state.cursor = page.nextRevision;
        if (!page.hasMore) break;
        if (batch === 199) throw Error("ENGINE22_NODE_HISTORY_PAGE_LIMIT");
      }
      if (changed && !closed) onUpdate?.(snapshot());
      return snapshot();
    })().finally(() => { inflight = null; });
    return inflight;
  };
  return { refresh, snapshot, close: () => { closed = true; } };
}

// The browser must never call the private backend with an Engine 22 secret.
// A same-origin authenticated owner proxy may be enabled after backend release.
export function sameOriginWaveNodeProxy(raw, origin) {
  if (!raw || !origin) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== new URL(origin).origin || url.search || url.hash ||
        !url.pathname.endsWith("/wave-history/nodes")) return null;
    return url.toString();
  } catch { return null; }
}

export async function fetchWaveNodePageFromProxy(endpoint, {
  afterRevision = 0, limit = 50, fetcher = fetch, signal,
} = {}) {
  const url = new URL(endpoint);
  url.searchParams.set("afterRevision", String(afterRevision));
  url.searchParams.set("limit", String(limit));
  const response = await fetcher(url.toString(), {
    method: "GET", credentials: "same-origin", cache: "no-store",
    headers: { Accept: "application/json" }, signal,
  });
  if (!response.ok) throw Error("ENGINE22_NODE_HISTORY_HTTP_" + response.status);
  return response.json();
}
