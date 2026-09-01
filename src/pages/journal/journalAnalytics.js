// src/pages/journal/journalAnalytics.js
//
// Frye Dashboard — Canonical Contract + Daily Performance Analytics
//
// ALL-TIME SOURCE:
//   trade.realBroker.contracts[]
//
// DAILY SOURCE:
//   CLOSED contractIds by closingFillTime
//   + REAL broker execution fees by event.ts
//   + OPEN contractIds marked to current price when a mark is supplied.
//
// LOCKED RULES:
// - INTRADAY and SWING stay separate.
// - One durable Engine 10 contractId = one futures contract.
// - CLOSED contractIds only for realized win/loss statistics.
// - OPEN contractIds excluded from realized denominators until closed.
// - Synthetic TRADE_CLOSED.actualFees are never double-counted.

import { safeNum, upper } from "./journalFormatters.js";

import {
  getAccountLabel,
  getCurrentFuturesTradingDayKey,
  getFuturesTradingDayKey,
  isRealBrokerExecutionEvent,
  getBrokerExecutionTime,
  getBrokerExecutionFee,
  getDollarsPerPoint,
} from "./journalTradeModel.js";

function blankStrategy(account) {
  return {
    account,
    totalContractIds: 0,
    uniqueContractIds: 0,
    openContracts: 0,
    closedContracts: 0,
    winningContracts: 0,
    losingContracts: 0,
    breakevenContracts: 0,
    winPct: null,
    averageWinningContract: null,
    averageLosingContract: null,
    winLossRatio: null,
    profitFactor: null,
    expectancyPerContract: null,
    bestContract: null,
    worstContract: null,
    grossRealizedContractPnL: 0,
    exactContractRecords: 0,
    missingContractRegistryTrades: 0,
    duplicateContractIdsExcluded: 0,
    invalidClosedContractRecordsExcluded: 0,
    daily: {
      tradingDate: null,
      closedContracts: 0,
      winningContracts: 0,
      losingContracts: 0,
      breakevenContracts: 0,
      realizedGross: 0,
      fees: 0,
      realizedNet: 0,
      unrealized: null,
      totalPnL: null,
      openContracts: 0,
      mark: null,
    },
    dailyAccountPnL: null,
    averageDailyPnLPerClosedContract: null,
  };
}

function finalizeStrategy(book, contractPnLs) {
  const wins = contractPnLs.filter((v) => v > 0);
  const losses = contractPnLs.filter((v) => v < 0);
  const breakevens = contractPnLs.filter((v) => v === 0);

  const grossProfit = wins.reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(losses.reduce((s, v) => s + v, 0));

  const averageWinningContract = wins.length ? grossProfit / wins.length : null;
  const averageLosingContract = losses.length ? grossLoss / losses.length : null;
  const resolvedContracts = wins.length + losses.length + breakevens.length;

  book.closedContracts = resolvedContracts;
  book.winningContracts = wins.length;
  book.losingContracts = losses.length;
  book.breakevenContracts = breakevens.length;
  book.winPct = resolvedContracts ? (wins.length / resolvedContracts) * 100 : null;
  book.averageWinningContract = averageWinningContract;
  book.averageLosingContract = averageLosingContract;
  book.winLossRatio =
    averageWinningContract != null && averageLosingContract > 0
      ? averageWinningContract / averageLosingContract
      : null;
  book.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;
  book.expectancyPerContract = resolvedContracts
    ? contractPnLs.reduce((s, v) => s + v, 0) / resolvedContracts
    : null;
  book.bestContract = contractPnLs.length ? Math.max(...contractPnLs) : null;
  book.worstContract = contractPnLs.length ? Math.min(...contractPnLs) : null;
  book.grossRealizedContractPnL = contractPnLs.reduce((s, v) => s + v, 0);
  book.exactContractRecords = resolvedContracts;

  return book;
}

function finalizeDaily(book, { tradingDate, dailyContractPnLs, dailyFees, dailyUnrealized, mark }) {
  const wins = dailyContractPnLs.filter((v) => v > 0);
  const losses = dailyContractPnLs.filter((v) => v < 0);
  const breakevens = dailyContractPnLs.filter((v) => v === 0);
  const realizedGross = dailyContractPnLs.reduce((s, v) => s + v, 0);
  const realizedNet = realizedGross - dailyFees;
  const totalPnL = dailyUnrealized != null ? realizedNet + dailyUnrealized : null;

  book.daily = {
    tradingDate,
    closedContracts: dailyContractPnLs.length,
    winningContracts: wins.length,
    losingContracts: losses.length,
    breakevenContracts: breakevens.length,
    realizedGross,
    fees: dailyFees,
    realizedNet,
    unrealized: dailyUnrealized,
    totalPnL,
    openContracts: book.openContracts,
    mark: mark != null ? mark : null,
  };

  // Backward-compatible alias used by current Journal cards.
  book.dailyAccountPnL = totalPnL != null ? totalPnL : realizedNet;
  book.averageDailyPnLPerClosedContract = dailyContractPnLs.length
    ? book.dailyAccountPnL / dailyContractPnLs.length
    : null;

  return book;
}

function getContracts(trade) {
  return Array.isArray(trade?.realBroker?.contracts) ? trade.realBroker.contracts : [];
}

function calculateContractUnrealized({ contract, trade, mark }) {
  const currentMark = safeNum(mark);
  if (currentMark == null || upper(contract?.status) !== "OPEN") return null;

  const entryPrice = safeNum(contract?.entryPrice);
  const dollarsPerPoint = getDollarsPerPoint(trade);
  const direction = upper(contract?.direction || trade?.direction);

  if (
    entryPrice == null ||
    dollarsPerPoint == null ||
    (direction !== "SHORT" && direction !== "LONG")
  ) {
    return null;
  }

  const points = direction === "SHORT" ? entryPrice - currentMark : currentMark - entryPrice;
  return points * dollarsPerPoint;
}

export function calculateAnalytics(trades = [], options = {}) {
  const mark = safeNum(options?.mark);
  const tradingDate =
    options?.tradingDate ||
    getCurrentFuturesTradingDayKey(options?.now || new Date());

  const strategies = {
    INTRADAY: blankStrategy("INTRADAY"),
    SWING: blankStrategy("SWING"),
  };

  const pnlByStrategy = { INTRADAY: [], SWING: [] };
  const dailyPnlByStrategy = { INTRADAY: [], SWING: [] };
  const dailyFeesByStrategy = { INTRADAY: 0, SWING: 0 };
  const dailyUnrealizedByStrategy = { INTRADAY: 0, SWING: 0 };
  const dailyUnrealizedAvailable = { INTRADAY: true, SWING: true };
  const seenIdsByStrategy = { INTRADAY: new Set(), SWING: new Set() };
  const seenFeeTransactionIds = { INTRADAY: new Set(), SWING: new Set() };

  for (const trade of trades) {
    const account = getAccountLabel(trade);
    if (account !== "INTRADAY" && account !== "SWING") continue;

    const book = strategies[account];
    const contracts = getContracts(trade);

    if (!contracts.length) book.missingContractRegistryTrades += 1;

    for (const contract of contracts) {
      const contractId = String(contract?.contractId || "").trim();
      if (!contractId) {
        book.invalidClosedContractRecordsExcluded += 1;
        continue;
      }

      if (seenIdsByStrategy[account].has(contractId)) {
        book.duplicateContractIdsExcluded += 1;
        continue;
      }

      seenIdsByStrategy[account].add(contractId);
      book.totalContractIds += 1;

      const status = upper(contract?.status);

      if (status === "OPEN") {
        book.openContracts += 1;

        if (mark != null) {
          const unrealized = calculateContractUnrealized({ contract, trade, mark });
          if (unrealized == null) dailyUnrealizedAvailable[account] = false;
          else dailyUnrealizedByStrategy[account] += unrealized;
        } else {
          dailyUnrealizedAvailable[account] = false;
        }

        continue;
      }

      if (status !== "CLOSED") {
        book.invalidClosedContractRecordsExcluded += 1;
        continue;
      }

      const pnl = safeNum(contract?.grossRealizedPnL);
      if (pnl == null) {
        book.invalidClosedContractRecordsExcluded += 1;
        continue;
      }

      pnlByStrategy[account].push(pnl);

      if (getFuturesTradingDayKey(contract?.closingFillTime) === tradingDate) {
        dailyPnlByStrategy[account].push(pnl);
      }
    }

    book.uniqueContractIds = seenIdsByStrategy[account].size;

    const events = Array.isArray(trade?.events) ? trade.events : [];

    for (const event of events) {
      if (!isRealBrokerExecutionEvent(event)) continue;

      const transactionId = String(event?.brokerTransactionId || "").trim();
      if (!transactionId || seenFeeTransactionIds[account].has(transactionId)) continue;

      if (getFuturesTradingDayKey(getBrokerExecutionTime(event)) !== tradingDate) continue;

      const fee = getBrokerExecutionFee(event);
      if (fee == null) continue;

      seenFeeTransactionIds[account].add(transactionId);
      dailyFeesByStrategy[account] += fee;
    }
  }

  finalizeStrategy(strategies.INTRADAY, pnlByStrategy.INTRADAY);
  finalizeStrategy(strategies.SWING, pnlByStrategy.SWING);

  finalizeDaily(strategies.INTRADAY, {
    tradingDate,
    dailyContractPnLs: dailyPnlByStrategy.INTRADAY,
    dailyFees: dailyFeesByStrategy.INTRADAY,
    dailyUnrealized: dailyUnrealizedAvailable.INTRADAY
      ? dailyUnrealizedByStrategy.INTRADAY
      : null,
    mark,
  });

  finalizeDaily(strategies.SWING, {
    tradingDate,
    dailyContractPnLs: dailyPnlByStrategy.SWING,
    dailyFees: dailyFeesByStrategy.SWING,
    dailyUnrealized: dailyUnrealizedAvailable.SWING
      ? dailyUnrealizedByStrategy.SWING
      : null,
    mark,
  });

  const all = finalizeStrategy(
    blankStrategy("ALL REAL"),
    [...pnlByStrategy.INTRADAY, ...pnlByStrategy.SWING]
  );

  all.totalContractIds = strategies.INTRADAY.totalContractIds + strategies.SWING.totalContractIds;
  all.uniqueContractIds = strategies.INTRADAY.uniqueContractIds + strategies.SWING.uniqueContractIds;
  all.openContracts = strategies.INTRADAY.openContracts + strategies.SWING.openContracts;
  all.missingContractRegistryTrades =
    strategies.INTRADAY.missingContractRegistryTrades + strategies.SWING.missingContractRegistryTrades;
  all.duplicateContractIdsExcluded =
    strategies.INTRADAY.duplicateContractIdsExcluded + strategies.SWING.duplicateContractIdsExcluded;
  all.invalidClosedContractRecordsExcluded =
    strategies.INTRADAY.invalidClosedContractRecordsExcluded +
    strategies.SWING.invalidClosedContractRecordsExcluded;

  finalizeDaily(all, {
    tradingDate,
    dailyContractPnLs: [...dailyPnlByStrategy.INTRADAY, ...dailyPnlByStrategy.SWING],
    dailyFees: dailyFeesByStrategy.INTRADAY + dailyFeesByStrategy.SWING,
    dailyUnrealized:
      dailyUnrealizedAvailable.INTRADAY && dailyUnrealizedAvailable.SWING
        ? dailyUnrealizedByStrategy.INTRADAY + dailyUnrealizedByStrategy.SWING
        : null,
    mark,
  });

  return {
    model: "ENGINE10_CANONICAL_CONTRACT_ID_PERFORMANCE_V3",
    performanceUnit: "CLOSED_CONTRACT_ID",
    canonicalSource: "trade.realBroker.contracts[]",
    pnlBasis: "ENGINE10_CONTRACT_ID_GROSS_REALIZED_PNL",
    dailyBasis: "FUTURES_TRADING_DAY_18ET",
    tradingDate,
    strategies,
    all,
  };
}
