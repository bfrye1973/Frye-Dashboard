// src/pages/journal/journalTradeModel.js
// Pure Journal trade/account/P&L selectors.
// No React. No API calls. No Engine 8/10 writes.

import { safeNum, upper, dayKey } from "./journalFormatters.js";

const FUTURES_TIME_ZONE = "America/New_York";
const REAL_EXECUTION_EVENT_TYPES = new Set([
  "REAL_ENTRY_FILL",
  "REAL_SCALE_IN_FILL",
  "REAL_PARTIAL_EXIT",
  "REAL_FINAL_EXIT",
]);

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function getEtParts(value) {
  const date = parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUTURES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);

  if (![year, month, day, hour].every(Number.isFinite)) return null;
  return { year, month, day, hour };
}

function formatDateKey({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addOneCalendarDay(parts) {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function getTradeMode(t) {
  const source = upper(t?.source);
  const mode = upper(t?.accountMode);

  if (
    source === "SCHWAB_BROKER_FILL" ||
    source === "THINKORSWIM_IMPORT" ||
    mode === "REAL" ||
    mode === "LIVE"
  ) {
    return "REAL";
  }

  if (mode === "PAPER") return "PAPER";
  return "OTHER";
}

export function getAccountLabel(t) {
  const direct = upper(t?.journalAccount);
  if (direct === "INTRADAY" || direct === "SWING") return direct;

  const alias = upper(t?.brokerImport?.accountAlias);
  if (alias === "INTRADAY" || alias === "TOS_ACCOUNT_A") return "INTRADAY";
  if (alias === "SWING" || alias === "TOS_ACCOUNT_B") return "SWING";

  if (getTradeMode(t) === "PAPER") return "FRYE PAPER";
  return direct || alias || "REAL";
}

export function normalizeMarketSymbol(t) {
  const explicitRoot = upper(
    t?.normalizedInstrumentRoot || t?.realBroker?.normalizedInstrumentRoot
  );
  if (explicitRoot) return explicitRoot;

  const raw = upper(
    t?.brokerSymbol ||
      t?.realBroker?.brokerSymbol ||
      t?.brokerImport?.brokerSymbol ||
      t?.symbol
  )
    .replace(/:.*$/, "")
    .replace(/^\//, "");

  const match = raw.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/);
  return match?.[1] || raw || null;
}

export function getDollarsPerPoint(t) {
  const candidates = [
    t?.realBroker?.dollarsPerPoint,
    t?.brokerImport?.dollarsPerPoint,
    t?.riskBasis?.dollarsPerPoint,
  ];

  for (const value of candidates) {
    const n = safeNum(value);
    if (n != null && n > 0) return n;
  }

  const map = {
    MES: 5,
    ES: 50,
    MNQ: 2,
    NQ: 20,
    MYM: 0.5,
    YM: 5,
    M2K: 5,
    RTY: 50,
  };

  return map[normalizeMarketSymbol(t)] ?? null;
}

export function getRemainingLots(t) {
  const lots = t?.realBroker?.remainingLots || t?.brokerImport?.remainingLots || [];
  return Array.isArray(lots) ? lots : [];
}

export function getRemainingAverageEntry(t) {
  const explicit =
    safeNum(t?.brokerImport?.remainingAverageEntry) ??
    safeNum(t?.realBroker?.remainingAverageEntry);

  if (explicit != null) return explicit;

  const lots = getRemainingLots(t);
  let qty = 0;
  let weighted = 0;

  for (const lot of lots) {
    const lotQty = safeNum(lot?.qty);
    const price = safeNum(lot?.price);
    if (lotQty > 0 && price != null) {
      qty += lotQty;
      weighted += lotQty * price;
    }
  }

  if (qty > 0) return weighted / qty;
  return safeNum(t?.entry?.price);
}

export function getGrossRealized(t) {
  return (
    safeNum(t?.summary?.grossRealizedPnL) ??
    safeNum(t?.brokerImport?.grossRealizedTradePnL) ??
    safeNum(t?.summary?.realizedPnL)
  );
}

export function getActualFees(t) {
  const direct =
    safeNum(t?.summary?.actualFees) ??
    safeNum(t?.brokerImport?.actualFees);
  if (direct != null) return direct;

  const commission = safeNum(t?.summary?.actualCommission);
  const exchange = safeNum(t?.summary?.futuresExchangeFees);
  if (commission == null && exchange == null) return null;
  return (commission || 0) + (exchange || 0);
}

export function getNetRealized(t) {
  const direct =
    safeNum(t?.summary?.netRealizedPnL) ??
    safeNum(t?.brokerImport?.netRealizedTradePnL);
  if (direct != null) return direct;

  const gross = getGrossRealized(t);
  if (gross == null) return null;
  return gross - (getActualFees(t) || 0);
}

// Legacy/manual field only. New daily analytics should not use this as authority.
export function getDailyAccountPnL(t) {
  return (
    safeNum(t?.summary?.dailyAccountPnL) ??
    safeNum(t?.brokerImport?.dailyAccountPnL)
  );
}

export function getTradeDate(t) {
  return t?.brokerImport?.tradingDate || dayKey(t?.entry?.time || t?.createdAt);
}

// 18:00 ET and later belongs to the next futures trading date.
export function getFuturesTradingDayKey(value) {
  const parts = getEtParts(value);
  if (!parts) return null;
  const dateParts = parts.hour >= 18 ? addOneCalendarDay(parts) : parts;
  return formatDateKey(dateParts);
}

export function getCurrentFuturesTradingDayKey(now = new Date()) {
  return getFuturesTradingDayKey(now);
}

export function isRealBrokerExecutionEvent(event) {
  return (
    REAL_EXECUTION_EVENT_TYPES.has(upper(event?.eventType)) &&
    String(event?.brokerTransactionId || "").trim() !== ""
  );
}

export function getBrokerExecutionTime(event) {
  return event?.ts || event?.fillTime || event?.brokerFillTime || null;
}

export function getBrokerExecutionFee(event) {
  if (!isRealBrokerExecutionEvent(event)) return null;

  const total = safeNum(event?.totalFees);
  if (total != null) return total;

  return (
    (safeNum(event?.commission) || 0) +
    (safeNum(event?.futuresExchangeFee) || 0) +
    (safeNum(event?.otherFees) || 0)
  );
}

export function calculateLivePosition(t, mark) {
  const remainingQty = safeNum(t?.qty?.remainingQty) || 0;
  const currentMark = safeNum(mark);
  const dollarsPerPoint = getDollarsPerPoint(t);
  const direction = upper(t?.direction);
  const averageEntry = getRemainingAverageEntry(t);

  if (upper(t?.status) !== "OPEN" || remainingQty <= 0) {
    return {
      available: false,
      remainingQty,
      averageEntry,
      mark: currentMark,
      unrealizedPoints: 0,
      unrealizedPnL: 0,
      totalPnL: getNetRealized(t) ?? getGrossRealized(t),
    };
  }

  if (currentMark == null || dollarsPerPoint == null || averageEntry == null) {
    return {
      available: false,
      remainingQty,
      averageEntry,
      mark: currentMark,
      unrealizedPoints: null,
      unrealizedPnL: null,
      totalPnL: null,
    };
  }

  const lots = getRemainingLots(t);
  let unrealizedPoints = 0;

  if (lots.length) {
    for (const lot of lots) {
      const qty = safeNum(lot?.qty) || 0;
      const price = safeNum(lot?.price);
      if (qty <= 0 || price == null) continue;

      unrealizedPoints +=
        (direction === "SHORT" ? price - currentMark : currentMark - price) * qty;
    }
  } else {
    unrealizedPoints =
      (direction === "SHORT" ? averageEntry - currentMark : currentMark - averageEntry) *
      remainingQty;
  }

  const unrealizedPnL = unrealizedPoints * dollarsPerPoint;
  const realized = getNetRealized(t) ?? getGrossRealized(t) ?? 0;

  return {
    available: true,
    remainingQty,
    averageEntry,
    mark: currentMark,
    unrealizedPoints,
    unrealizedPnL,
    totalPnL: realized + unrealizedPnL,
  };
}

export function buildEventRows(trades = []) {
  const rows = [];

  for (const trade of trades) {
    const events = Array.isArray(trade?.events) ? trade.events : [];
    for (const event of events) rows.push({ trade, event });
  }

  return rows.sort(
    (a, b) =>
      (Date.parse(b?.event?.ts || 0) || 0) -
      (Date.parse(a?.event?.ts || 0) || 0)
  );
}
