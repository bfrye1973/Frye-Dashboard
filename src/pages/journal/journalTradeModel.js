// src/pages/journal/journalTradeModel.js
// Pure Journal trade/account/P&L selectors.
// No React. No API calls. No Engine 8/10 writes.

import { safeNum, upper, dayKey } from "./journalFormatters.js";

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

/*
 * IMPORTANT:
 * This preserves the CURRENT legacy fallback exactly.
 * We already proved the historical imported TOS_ACCOUNT_A/B records do not
 * contain journalAccount or brokerAccountLabel.
 *
 * Do NOT change A/B mapping here until we separately repair/prove historical
 * account identity.
 *
 * New Schwab REAL fills with journalAccount=INTRADAY|SWING take priority.
 */
export function getAccountLabel(t) {
  const direct = upper(t?.journalAccount);

  if (direct === "INTRADAY" || direct === "SWING") {
    return direct;
  }

  const alias = upper(t?.brokerImport?.accountAlias);

  if (alias === "INTRADAY" || alias === "TOS_ACCOUNT_A") {
    return "INTRADAY";
  }

  if (alias === "SWING" || alias === "TOS_ACCOUNT_B") {
    return "SWING";
  }

  if (getTradeMode(t) === "PAPER") {
    return "FRYE PAPER";
  }

  return direct || alias || "REAL";
}

export function normalizeMarketSymbol(t) {
  const explicitRoot = upper(
    t?.normalizedInstrumentRoot ||
    t?.realBroker?.normalizedInstrumentRoot
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

  const match = raw.match(
    /^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/
  );

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

    if (n != null && n > 0) {
      return n;
    }
  }

  const symbol = normalizeMarketSymbol(t);

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

  return map[symbol] ?? null;
}

export function getRemainingLots(t) {
  const lots =
    t?.realBroker?.remainingLots ||
    t?.brokerImport?.remainingLots ||
    [];

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

  const commission =
    safeNum(t?.summary?.actualCommission);

  const exchange =
    safeNum(t?.summary?.futuresExchangeFees);

  if (commission == null && exchange == null) {
    return null;
  }

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

export function getDailyAccountPnL(t) {
  return (
    safeNum(t?.summary?.dailyAccountPnL) ??
    safeNum(t?.brokerImport?.dailyAccountPnL)
  );
}

export function getTradeDate(t) {
  return (
    t?.brokerImport?.tradingDate ||
    dayKey(t?.entry?.time || t?.createdAt)
  );
}

export function calculateLivePosition(t, mark) {
  const remainingQty =
    safeNum(t?.qty?.remainingQty) || 0;

  const currentMark = safeNum(mark);
  const dollarsPerPoint = getDollarsPerPoint(t);
  const direction = upper(t?.direction);
  const averageEntry = getRemainingAverageEntry(t);

  if (
    upper(t?.status) !== "OPEN" ||
    remainingQty <= 0
  ) {
    return {
      available: false,
      remainingQty,
      averageEntry,
      mark: currentMark,
      unrealizedPoints: 0,
      unrealizedPnL: 0,
      totalPnL:
        getNetRealized(t) ??
        getGrossRealized(t),
    };
  }

  if (
    currentMark == null ||
    dollarsPerPoint == null ||
    averageEntry == null
  ) {
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
        (
          direction === "SHORT"
            ? price - currentMark
            : currentMark - price
        ) * qty;
    }
  } else {
    unrealizedPoints =
      (
        direction === "SHORT"
          ? averageEntry - currentMark
          : currentMark - averageEntry
      ) * remainingQty;
  }

  const unrealizedPnL =
    unrealizedPoints * dollarsPerPoint;

  const realized =
    getNetRealized(t) ??
    getGrossRealized(t) ??
    0;

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
    const events =
      Array.isArray(trade?.events)
        ? trade.events
        : [];

    for (const event of events) {
      rows.push({
        trade,
        event,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      (Date.parse(b?.event?.ts || 0) || 0) -
      (Date.parse(a?.event?.ts || 0) || 0)
  );
}
