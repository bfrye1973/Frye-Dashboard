// Engine 2E — read-only Engine 11 historical ES adapter.
// Never changes source OHLCV, rollovers, adjustments, or execution authority.

export const ENGINE11_HISTORY_ENDPOINT =
  "https://frye-market-backend-1.onrender.com/engine2c-private-history/page";

export const ENGINE11_CONTINUOUS_UNADJUSTED_LEGACY = Object.freeze({
  view: "UNADJUSTED",
  datasetVersion:
    "research-dataset:a0c81ce398869440b1b9cd42b94ced0101923356c4c860a9c13232a1f98f3c91",
  priceBasisVersion:
    "price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908",
});

export const ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS = Object.freeze({
  view: "UNADJUSTED",
  datasetVersion:
    "research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2",
  priceBasisVersion:
    "price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15",
  artifactId: 13158459519,
  artifactDigest:
    "sha256:23970f762925894907d790292d47dd5f1d537f9f3bf47aa4a7e541709fc926fb",
  expectedRows: Object.freeze({
    "5m": 471044,
    "10m": 235733,
    "1h": 39364,
    "4h": 9319,
    "1d": 1645,
    "1w": 321,
    "1mo": 53,
  }),
});

export const ENGINE11_CONTINUOUS_UNADJUSTED =
  ENGINE11_CONTINUOUS_UNADJUSTED_LEGACY;

const SUPPORTED_FRAMES = new Set(["5m", "10m", "1h", "4h", "1d", "1w", "1mo"]);

function exactSecond(row) {
  const raw = String(row?.timestampNs || "");
  if (/^\d{15,}$/.test(raw)) return Number(raw.slice(0, -9));
  const ms = Date.parse(row?.timestampUtc);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
}

export function engine11RowToLiveBar(row) {
  const time = exactSecond(row);
  const p = row?.prices || {};
  const bar = {
    time,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: row?.volume,
  };
  if (
    !Number.isFinite(bar.time) ||
    !["open", "high", "low", "close"].every((key) => Number.isFinite(bar[key]))
  ) {
    throw new Error("ENGINE11_INVALID_CANDLE");
  }
  return bar;
}

export function preserveEngine11Row(row) {
  return {
    ...row,
    prices: row?.prices ? { ...row.prices } : row?.prices,
    sourceObservationIds: Array.isArray(row?.sourceObservationIds)
      ? [...row.sourceObservationIds]
      : row?.sourceObservationIds,
  };
}

function assertDataset(dataset) {
  if (
    !dataset ||
    dataset.view !== "UNADJUSTED" ||
    typeof dataset.datasetVersion !== "string" ||
    typeof dataset.priceBasisVersion !== "string"
  ) {
    throw new Error("ENGINE11_INVALID_DATASET_CONFIG");
  }
}

export function validateEngine11Page(page, frame, dataset = ENGINE11_CONTINUOUS_UNADJUSTED) {
  assertDataset(dataset);
  if (!SUPPORTED_FRAMES.has(frame)) throw new Error("ENGINE11_UNSUPPORTED_FRAME");
  if (
    page?.datasetVersion !== dataset.datasetVersion ||
    page?.priceBasisVersion !== dataset.priceBasisVersion ||
    page?.frame !== frame ||
    page?.direction !== "DESC" ||
    page?.researchOnly !== true ||
    page?.structuralEligible !== false ||
    page?.executionPriceAuthority !== false ||
    !Array.isArray(page?.rows) ||
    page.rows.length > 1000
  ) {
    throw new Error("ENGINE11_PAGE_CONTRACT_MISMATCH");
  }
  return page;
}

export async function fetchEngine11Page({
  frame,
  cursor = null,
  accessKey,
  signal,
  dataset = ENGINE11_CONTINUOUS_UNADJUSTED,
} = {}) {
  assertDataset(dataset);
  if (!SUPPORTED_FRAMES.has(frame)) throw new Error("ENGINE11_UNSUPPORTED_FRAME");
  if (typeof accessKey !== "string" || !accessKey) {
    throw new Error("ENGINE11_RESEARCH_ACCESS_REQUIRED");
  }

  const q = new URLSearchParams({
    view: dataset.view,
    frame,
    limit: "1000",
    direction: "DESC",
    datasetVersion: dataset.datasetVersion,
    priceBasisVersion: dataset.priceBasisVersion,
  });
  if (cursor !== null) q.set("cursor", cursor);

  const response = await fetch(`${ENGINE11_HISTORY_ENDPOINT}?${q}`, {
    cache: "no-store",
    credentials: "omit",
    signal,
    headers: {
      Accept: "application/json",
      "X-Engine2C-Access": accessKey,
    },
  });

  if (response.status === 401) throw new Error("ENGINE11_RESEARCH_ACCESS_REJECTED");
  if (!response.ok) throw new Error(`ENGINE11_HISTORY_HTTP_${response.status}`);

  const page = validateEngine11Page(await response.json(), frame, dataset);
  return {
    page,
    bars: page.rows.map(engine11RowToLiveBar).sort((a, b) => a.time - b.time),
    provenanceRows: page.rows.map(preserveEngine11Row),
  };
}

export async function fetchEngine11ContinuousUnadjustedPage(args = {}) {
  return fetchEngine11Page({
    ...args,
    dataset: ENGINE11_CONTINUOUS_UNADJUSTED_LEGACY,
  });
}

export async function fetchEngine11ContinuousUnadjusted2020PlusPage(args = {}) {
  return fetchEngine11Page({
    ...args,
    dataset: ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS,
  });
}

export async function fetchEngine11AllPages({
  frame,
  accessKey,
  signal,
  dataset = ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS,
  maxPages = 1000,
  onPage,
  includeProvenance = true,
} = {}) {
  assertDataset(dataset);
  if (!SUPPORTED_FRAMES.has(frame)) throw new Error("ENGINE11_UNSUPPORTED_FRAME");

  const seenCursors = new Set();
  const rowsById = new Map();
  const rowsByTime = new Map();
  let cursor = null;
  let pages = 0;

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const cursorKey = cursor === null ? "__FIRST__" : cursor;
    if (seenCursors.has(cursorKey)) throw new Error("ENGINE11_CURSOR_CYCLE");
    seenCursors.add(cursorKey);

    const result = await fetchEngine11Page({
      frame,
      cursor,
      accessKey,
      signal,
      dataset,
    });

    pages += 1;
    if (pages > maxPages) throw new Error("ENGINE11_PAGE_LIMIT_EXCEEDED");

    for (const row of result.page.rows) {
      const id = String(row?.researchCandleId || "");
      const time = exactSecond(row);
      if (!id || !Number.isFinite(time)) throw new Error("ENGINE11_INVALID_ROW_IDENTITY");
      if (rowsById.has(id)) throw new Error("ENGINE11_DUPLICATE_CANDLE_ID");
      if (rowsByTime.has(time)) throw new Error("ENGINE11_DUPLICATE_TIMESTAMP");
      rowsById.set(id, preserveEngine11Row(row));
      rowsByTime.set(time, row);
    }

    onPage?.({
      pageNumber: pages,
      rowsLoaded: rowsById.size,
      nextCursor: result.page.nextCursor ?? null,
      frame,
    });

    cursor = result.page.nextCursor ?? null;
    if (cursor === null) break;
  }

  const provenanceRows = includeProvenance
    ? Array.from(rowsById.values()).sort((a, b) => exactSecond(a) - exactSecond(b))
    : [];
  const sourceRows = includeProvenance
    ? provenanceRows
    : Array.from(rowsByTime.values()).sort((a, b) => exactSecond(a) - exactSecond(b));
  const bars = sourceRows.map(engine11RowToLiveBar);

  const expected = dataset.expectedRows?.[frame];
  if (Number.isInteger(expected) && bars.length !== expected) {
    throw new Error(
      `ENGINE11_FRAME_COUNT_MISMATCH_${frame}_${bars.length}_EXPECTED_${expected}`
    );
  }

  return {
    dataset,
    frame,
    pages,
    rows: bars.length,
    bars,
    provenanceRows,
    firstTime: bars[0]?.time ?? null,
    lastTime: bars[bars.length - 1]?.time ?? null,
  };
}

export async function fetchEngine11ContinuousUnadjusted2020PlusAll(args = {}) {
  return fetchEngine11AllPages({
    ...args,
    dataset: ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS,
  });
}
