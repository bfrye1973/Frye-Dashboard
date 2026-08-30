// src/pages/journal/journalAnalytics.js
//
// Frye Dashboard — Contract Performance Analytics
//
// CANONICAL PERFORMANCE RULE:
// - INTRADAY and SWING remain separate performance books.
// - One CLOSED contract = one win/loss statistical observation.
// - OPEN contracts never count as wins or losses.
// - Contract results come ONLY from Engine 10 event.closedContracts[].
// - Legacy exit events without closedContracts[] are NOT guessed or divided.
// - Contract win/loss calculations currently use exact GROSS realized contract P&L.
//   Per-contract fee allocation is intentionally not invented here.
//

import {
  safeNum,
  upper,
} from "./journalFormatters.js";

import {
  getAccountLabel,
} from "./journalTradeModel.js";

function blankStrategy(account) {
  return {
    account,

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

    legacyClosingEventsExcluded: 0,
    legacyClosedQuantityExcluded: 0,
    legacyRealizedPnLExcluded: 0,
  };
}

function classifyContractPnl(value) {
  if (value > 0) return "WIN";
  if (value < 0) return "LOSS";
  return "BREAKEVEN";
}

function finalizeStrategy(book, contractPnLs) {
  const wins =
    contractPnLs.filter(
      (value) => value > 0
    );

  const losses =
    contractPnLs.filter(
      (value) => value < 0
    );

  const breakevens =
    contractPnLs.filter(
      (value) => value === 0
    );

  const grossProfit =
    wins.reduce(
      (sum, value) => sum + value,
      0
    );

  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, value) => sum + value,
        0
      )
    );

  const averageWinningContract =
    wins.length
      ? grossProfit / wins.length
      : null;

  const averageLosingContract =
    losses.length
      ? grossLoss / losses.length
      : null;

  const resolvedContracts =
    wins.length +
    losses.length +
    breakevens.length;

  const winPct =
    resolvedContracts
      ? (
          wins.length /
          resolvedContracts
        ) * 100
      : null;

  const winLossRatio =
    averageWinningContract != null &&
    averageLosingContract != null &&
    averageLosingContract > 0
      ? averageWinningContract /
        averageLosingContract
      : null;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : null;

  const expectancyPerContract =
    resolvedContracts
      ? (
          contractPnLs.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          resolvedContracts
        )
      : null;

  book.closedContracts =
    resolvedContracts;

  book.winningContracts =
    wins.length;

  book.losingContracts =
    losses.length;

  book.breakevenContracts =
    breakevens.length;

  book.winPct =
    winPct;

  book.averageWinningContract =
    averageWinningContract;

  book.averageLosingContract =
    averageLosingContract;

  book.winLossRatio =
    winLossRatio;

  book.profitFactor =
    profitFactor;

  book.expectancyPerContract =
    expectancyPerContract;

  book.bestContract =
    contractPnLs.length
      ? Math.max(
          ...contractPnLs
        )
      : null;

  book.worstContract =
    contractPnLs.length
      ? Math.min(
          ...contractPnLs
        )
      : null;

  book.grossRealizedContractPnL =
    contractPnLs.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  book.exactContractRecords =
    contractPnLs.length;

  return book;
}

export function calculateAnalytics(
  trades = []
) {
  const strategies = {
    INTRADAY:
      blankStrategy(
        "INTRADAY"
      ),

    SWING:
      blankStrategy(
        "SWING"
      ),
  };

  const pnlByStrategy = {
    INTRADAY: [],
    SWING: [],
  };

  for (const trade of trades) {
    const account =
      getAccountLabel(
        trade
      );

    if (
      account !== "INTRADAY" &&
      account !== "SWING"
    ) {
      continue;
    }

    const book =
      strategies[
        account
      ];

    if (
      upper(
        trade?.status
      ) === "OPEN"
    ) {
      book.openContracts +=
        safeNum(
          trade?.qty
            ?.remainingQty
        ) || 0;
    }

    const events =
      Array.isArray(
        trade?.events
      )
        ? trade.events
        : [];

    for (const event of events) {
      const qtyClosed =
        safeNum(
          event?.qtyClosed
        ) || 0;

      if (qtyClosed <= 0) {
        continue;
      }

      const closedContracts =
        Array.isArray(
          event?.closedContracts
        )
          ? event.closedContracts
          : [];

      if (!closedContracts.length) {
        /*
         * Legacy Journal event.
         *
         * We know an aggregate closing event occurred, but we do not have
         * exact per-contract FIFO results. Do NOT manufacture individual
         * contract wins/losses by dividing event P&L.
         */
        book.legacyClosingEventsExcluded +=
          1;

        book.legacyClosedQuantityExcluded +=
          qtyClosed;

        const legacyPnl =
          safeNum(
            event
              ?.grossEventRealizedPnL
          ) ??
          safeNum(
            event
              ?.eventRealizedPnL
          );

        if (legacyPnl != null) {
          book.legacyRealizedPnLExcluded +=
            legacyPnl;
        }

        continue;
      }

      for (
        const contract
        of closedContracts
      ) {
        if (
          safeNum(
            contract?.quantity
          ) !== 1
        ) {
          continue;
        }

        const pnl =
          safeNum(
            contract
              ?.grossRealizedPnL
          );

        if (pnl == null) {
          continue;
        }

        /*
         * Merely evaluating the classification here makes the canonical
         * intent explicit and prevents accidental event-level counting.
         */
        classifyContractPnl(
          pnl
        );

        pnlByStrategy[
          account
        ].push(
          pnl
        );
      }
    }
  }

  finalizeStrategy(
    strategies.INTRADAY,
    pnlByStrategy.INTRADAY
  );

  finalizeStrategy(
    strategies.SWING,
    pnlByStrategy.SWING
  );

  const allContractPnLs = [
    ...pnlByStrategy.INTRADAY,
    ...pnlByStrategy.SWING,
  ];

  const all =
    finalizeStrategy(
      blankStrategy(
        "ALL REAL"
      ),
      allContractPnLs
    );

  all.openContracts =
    strategies.INTRADAY
      .openContracts +
    strategies.SWING
      .openContracts;

  all.legacyClosingEventsExcluded =
    strategies.INTRADAY
      .legacyClosingEventsExcluded +
    strategies.SWING
      .legacyClosingEventsExcluded;

  all.legacyClosedQuantityExcluded =
    strategies.INTRADAY
      .legacyClosedQuantityExcluded +
    strategies.SWING
      .legacyClosedQuantityExcluded;

  all.legacyRealizedPnLExcluded =
    strategies.INTRADAY
      .legacyRealizedPnLExcluded +
    strategies.SWING
      .legacyRealizedPnLExcluded;

  return {
    model:
      "ENGINE10_CLOSED_CONTRACT_PERFORMANCE_V1",

    performanceUnit:
      "CLOSED_CONTRACT",

    pnlBasis:
      "EXACT_FIFO_GROSS_REALIZED_CONTRACT_PNL",

    strategies,

    all,
  };
}
