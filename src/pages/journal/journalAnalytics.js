// src/pages/journal/journalAnalytics.js
//
// Frye Dashboard — Canonical Contract Performance Analytics
//
// CANONICAL SOURCE:
//   trade.realBroker.contracts[]
//
// LOCKED RULES:
// - INTRADAY and SWING remain separate performance books.
// - One durable Engine 10 contractId = one futures contract.
// - CLOSED contractIds are the only observations used for realized
//   win/loss statistics.
// - OPEN contractIds are excluded until they close.
// - No event reconstruction.
// - No division of aggregate event P&L.
// - No invented contract identity.
// - Daily Account P&L remains a separate account-level metric.
//

import {
  safeNum,
} from "./journalFormatters.js";

import {
  getAccountLabel,
  getDailyAccountPnL,
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

    dailyAccountPnL: null,
    averageDailyPnLPerClosedContract: null,

    exactContractRecords: 0,

    missingContractRegistryTrades: 0,
    duplicateContractIdsExcluded: 0,
    invalidClosedContractRecordsExcluded: 0,
  };
}

function finalizeStrategy(
  book,
  contractPnLs
) {
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
      (sum, value) =>
        sum + value,
      0
    );

  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, value) =>
          sum + value,
        0
      )
    );

  const averageWinningContract =
    wins.length
      ? grossProfit /
        wins.length
      : null;

  const averageLosingContract =
    losses.length
      ? grossLoss /
        losses.length
      : null;

  const resolvedContracts =
    wins.length +
    losses.length +
    breakevens.length;

  book.closedContracts =
    resolvedContracts;

  book.winningContracts =
    wins.length;

  book.losingContracts =
    losses.length;

  book.breakevenContracts =
    breakevens.length;

  book.winPct =
    resolvedContracts
      ? (
          wins.length /
          resolvedContracts
        ) * 100
      : null;

  book.averageWinningContract =
    averageWinningContract;

  book.averageLosingContract =
    averageLosingContract;

  book.winLossRatio =
    averageWinningContract != null &&
    averageLosingContract != null &&
    averageLosingContract > 0
      ? averageWinningContract /
        averageLosingContract
      : null;

  book.profitFactor =
    grossLoss > 0
      ? grossProfit /
        grossLoss
      : grossProfit > 0
        ? Infinity
        : null;

  book.expectancyPerContract =
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
    resolvedContracts;

  book.averageDailyPnLPerClosedContract =
    resolvedContracts > 0 &&
    book.dailyAccountPnL != null
      ? (
          book.dailyAccountPnL /
          resolvedContracts
        )
      : null;

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

  const seenIdsByStrategy = {
    INTRADAY:
      new Set(),

    SWING:
      new Set(),
  };

  for (const trade of trades) {
    const account =
      getAccountLabel(
        trade
      );

    if (
      account !==
        "INTRADAY" &&
      account !==
        "SWING"
    ) {
      continue;
    }

    const book =
      strategies[
        account
      ];

    const dailyAccountPnL =
      getDailyAccountPnL(
        trade
      );

    if (
      dailyAccountPnL !=
      null
    ) {
      book.dailyAccountPnL =
        dailyAccountPnL;
    }

    const contracts =
      Array.isArray(
        trade
          ?.realBroker
          ?.contracts
      )
        ? trade
            .realBroker
            .contracts
        : [];

    if (!contracts.length) {
      book.missingContractRegistryTrades +=
        1;

      continue;
    }

    for (
      const contract
      of contracts
    ) {
      const contractId =
        String(
          contract
            ?.contractId ||
          ""
        ).trim();

      if (!contractId) {
        book.invalidClosedContractRecordsExcluded +=
          1;

        continue;
      }

      if (
        seenIdsByStrategy[
          account
        ].has(
          contractId
        )
      ) {
        book.duplicateContractIdsExcluded +=
          1;

        continue;
      }

      seenIdsByStrategy[
        account
      ].add(
        contractId
      );

      book.totalContractIds +=
        1;

      const status =
        String(
          contract
            ?.status ||
          ""
        )
          .trim()
          .toUpperCase();

      if (
        status ===
        "OPEN"
      ) {
        book.openContracts +=
          1;

        continue;
      }

      if (
        status !==
        "CLOSED"
      ) {
        book.invalidClosedContractRecordsExcluded +=
          1;

        continue;
      }

      const pnl =
        safeNum(
          contract
            ?.grossRealizedPnL
        );

      if (
        pnl == null
      ) {
        book.invalidClosedContractRecordsExcluded +=
          1;

        continue;
      }

      pnlByStrategy[
        account
      ].push(
        pnl
      );
    }

    book.uniqueContractIds =
      seenIdsByStrategy[
        account
      ].size;
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

  all.totalContractIds =
    strategies.INTRADAY
      .totalContractIds +
    strategies.SWING
      .totalContractIds;

  all.uniqueContractIds =
    strategies.INTRADAY
      .uniqueContractIds +
    strategies.SWING
      .uniqueContractIds;

  all.openContracts =
    strategies.INTRADAY
      .openContracts +
    strategies.SWING
      .openContracts;

  all.missingContractRegistryTrades =
    strategies.INTRADAY
      .missingContractRegistryTrades +
    strategies.SWING
      .missingContractRegistryTrades;

  all.duplicateContractIdsExcluded =
    strategies.INTRADAY
      .duplicateContractIdsExcluded +
    strategies.SWING
      .duplicateContractIdsExcluded;

  all.invalidClosedContractRecordsExcluded =
    strategies.INTRADAY
      .invalidClosedContractRecordsExcluded +
    strategies.SWING
      .invalidClosedContractRecordsExcluded;

  const intradayDaily =
    strategies.INTRADAY
      .dailyAccountPnL;

  const swingDaily =
    strategies.SWING
      .dailyAccountPnL;

  if (
    intradayDaily != null ||
    swingDaily != null
  ) {
    all.dailyAccountPnL =
      (intradayDaily || 0) +
      (swingDaily || 0);
  }

  all.averageDailyPnLPerClosedContract =
    all.closedContracts > 0 &&
    all.dailyAccountPnL != null
      ? (
          all.dailyAccountPnL /
          all.closedContracts
        )
      : null;

  return {
    model:
      "ENGINE10_CANONICAL_CONTRACT_ID_PERFORMANCE_V2",

    performanceUnit:
      "CLOSED_CONTRACT_ID",

    canonicalSource:
      "trade.realBroker.contracts[]",

    pnlBasis:
      "ENGINE10_CONTRACT_ID_GROSS_REALIZED_PNL",

    strategies,

    all,
  };
}
