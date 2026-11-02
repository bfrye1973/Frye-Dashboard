// Engine 2E — read-only Engine 11 historical ES adapter.
// Isolated integration helper. It never changes source OHLC, volume, rollovers,
// adjustments, completion state, structural eligibility, or execution authority.

export const ENGINE11_HISTORY_ENDPOINT =
  "https://frye-market-backend-1.onrender.com/engine2c-private-history/page";

export const ENGINE11_CONTINUOUS_UNADJUSTED = Object.freeze({
  view: "UNADJUSTED",
  datasetVersion:
    "research-dataset:a0c81ce398869440b1b9cd42b94ced0101923356c4c860a9c13232a1f98f3c91",
  priceBasisVersion:
    "price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908",
});

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

export function validateEngine11Page(page, frame) {
  if (!SUPPORTED_FRAMES.has(frame)) throw new Error("ENGINE11_UNSUPPORTED_FRAME");
  if (
    page?.datasetVersion !== ENGINE11_CONTINUOUS_UNADJUSTED.datasetVersion ||
    page?.priceBasisVersion !== ENGINE11_CONTINUOUS_UNADJUSTED.priceBasisVersion ||
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

export async function fetchEngine11ContinuousUnadjustedPage({
  frame,
  cursor = null,
  accessKey,
  signal,
} = {}) {
  if (!SUPPORTED_FRAMES.has(frame)) throw new Error("ENGINE11_UNSUPPORTED_FRAME");
  if (typeof accessKey !== "string" || !accessKey) {
    throw new Error("ENGINE11_RESEARCH_ACCESS_REQUIRED");
  }
  const q = new URLSearchParams({
    view: ENGINE11_CONTINUOUS_UNADJUSTED.view,
    frame,
    limit: "1000",
    direction: "DESC",
    datasetVersion: ENGINE11_CONTINUOUS_UNADJUSTED.datasetVersion,
    priceBasisVersion: ENGINE11_CONTINUOUS_UNADJUSTED.priceBasisVersion,
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
  const page = validateEngine11Page(await response.json(), frame);
  return {
    page,
    bars: page.rows.map(engine11RowToLiveBar).sort((a, b) => a.time - b.time),
    provenanceRows: page.rows.map(preserveEngine11Row),
  };
}
