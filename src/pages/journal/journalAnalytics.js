// src/pages/journal/journalAnalytics.js
//
// Frye Dashboard — Canonical Contract + Daily + Capital Performance Analytics
//
// CANONICAL SOURCES:
//   trade.realBroker.contracts[]
//   trade.events[] REAL broker execution events
//
// CAPITAL BASES:
//   INTRADAY = $10,000
//   SWING    = $20,000
//   ALL REAL = $30,000
//
// PERFORMANCE ELIGIBILITY:
// - CLOSED REAL contract held < 60 seconds:
//     KEEP in Engine 10 broker/account truth
//     KEEP in actual realized P&L, equity, drawdown, Avg Daily Gain
//     EXCLUDE from trading-performance statistics
//     EXCLUDE from Engine 28 strategy-learning sample
// - Exactly 60 seconds remains eligible.
//
// PERFORMANCE BOOKS:
//   INTRADAY
//   SWING
//   ALL REAL
//
// SCOREBOARD METRICS:
// - Avg Daily Gain
// - Win Rate
// - Actual Return Since Start
// - Annualized Simple Return
// - Annualized Compounded Return
// - Trading Days
// - Eligible Closed Contracts
// - Current Realized Equity
// - Peak Realized Equity
// - Max Drawdown $ / %
// - Current Drawdown $ / %
// - Live Equity / Live Drawdown when mark available
// - Current Month realized return
//
// DRAWdown BASIS:
// - Historical drawdown is realized-net-equity only.
// - Live unrealized is reported separately and never rewrites historical max drawdown.
//
// IMPORTANT:
// - This file is read-only analytics.
// - It never mutates Engine 10.
// - Actual fees are deduped from genuine REAL broker execution events only.
// - Synthetic TRADE_CLOSED summary fees are never double-counted.
//

import {
  safeNum,
  upper,
} from "./journalFormatters.js";

import {
  getAccountLabel,
  getCurrentFuturesTradingDayKey,
  getFuturesTradingDayKey,
  isRealBrokerExecutionEvent,
  getBrokerExecutionTime,
  getBrokerExecutionFee,
  getDollarsPerPoint,
} from "./journalTradeModel.js";

export const PERFORMANCE_STARTING_CAPITAL =
  Object.freeze({
    INTRADAY: 10000,
    SWING: 20000,
    "ALL REAL": 30000,
  });

export const PERFORMANCE_MIN_HOLD_SECONDS =
  60;

export const PERFORMANCE_EXCLUSION_REASON =
  "ULTRA_SHORT_ACCIDENTAL_TRADE";

const TRADING_DAYS_PER_YEAR =
  252;

function blankStrategy(account) {
  return {
    account,

    startingCapital:
      PERFORMANCE_STARTING_CAPITAL[
        account
      ] ?? null,

    totalContractIds: 0,
    uniqueContractIds: 0,

    // Broker-truth OPEN inventory.
    openContracts: 0,

    // Performance-eligible CLOSED population.
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

    // Performance-only gross realized P&L.
    grossRealizedContractPnL: 0,
    exactContractRecords: 0,

    // Broker/account truth.
    actualGrossRealizedPnL: 0,
    actualFees: 0,
    actualNetRealizedPnL: 0,

    performanceExcludedContracts: 0,
    ultraShortExcludedContracts: 0,
    performanceExcludedGrossPnL: 0,

    missingContractRegistryTrades: 0,
    duplicateContractIdsExcluded: 0,
    invalidClosedContractRecordsExcluded: 0,

    tradingDays: 0,
    averageDailyGain: null,

    actualReturnSinceStartPct: null,
    annualizedSimpleReturnPct: null,
    annualizedCompoundedReturnPct: null,

    currentEquity: null,
    peakEquity: null,

    maxDrawdownDollars: null,
    maxDrawdownPct: null,

    currentDrawdownDollars: null,
    currentDrawdownPct: null,

    liveEquity: null,
    liveDrawdownDollars: null,
    liveDrawdownPct: null,

    currentMonth: {
      monthKey: null,
      tradingDays: 0,
      realizedGross: 0,
      fees: 0,
      realizedNet: 0,
      returnPct: null,
    },

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
    averageDailyPnLPerClosedContract:
      null,

    realizedDailyEquityCurve: [],
  };
}

function getContracts(trade) {
  return Array.isArray(
    trade?.realBroker?.contracts
  )
    ? trade.realBroker.contracts
    : [];
}

function getExactFuturesContractCode(
  contract,
  trade
) {
  const raw =
    upper(
      contract?.futuresContractCode ||
      contract?.brokerSymbol ||
      trade?.futuresContractCode ||
      trade?.realBroker?.futuresContractCode ||
      trade?.brokerSymbol ||
      trade?.realBroker?.brokerSymbol
    )
      .replace(/:.*$/, "")
      .replace(/^\//, "");

  const match =
    raw.match(
      /^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\d{1,2})$/
    );

  return match
    ? `${match[1]}${match[2]}${match[3]}`
    : null;
}

function resolveContractMark({
  contract,
  trade,
  marks,
  fallbackMark,
}) {
  const contractCode =
    getExactFuturesContractCode(
      contract,
      trade
    );

  if (
    contractCode &&
    marks &&
    typeof marks === "object"
  ) {
    const exactMark =
      safeNum(
        marks[
          contractCode
        ]
      );

    if (exactMark != null) {
      return exactMark;
    }
  }

  return safeNum(
    fallbackMark
  );
}

function parseMs(value) {
  const ms =
    Date.parse(
      value || ""
    );

  return Number.isFinite(ms)
    ? ms
    : null;
}

function getHoldingDurationSeconds(
  contract
) {
  const openMs =
    parseMs(
      contract?.openingFillTime
    );

  const closeMs =
    parseMs(
      contract?.closingFillTime
    );

  if (
    openMs == null ||
    closeMs == null ||
    closeMs < openMs
  ) {
    return null;
  }

  return (
    closeMs -
    openMs
  ) / 1000;
}

function getPerformanceEligibility(
  contract
) {
  const holdingDurationSeconds =
    getHoldingDurationSeconds(
      contract
    );

  if (
    holdingDurationSeconds != null &&
    holdingDurationSeconds <
      PERFORMANCE_MIN_HOLD_SECONDS
  ) {
    return {
      eligible: false,
      holdingDurationSeconds,
      exclusionReason:
        PERFORMANCE_EXCLUSION_REASON,
    };
  }

  return {
    eligible: true,
    holdingDurationSeconds,
    exclusionReason: null,
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

  return book;
}

function finalizeDaily(
  book,
  {
    tradingDate,
    dailyContractPnLs,
    dailyFees,
    dailyUnrealized,
    mark,
  }
) {
  const wins =
    dailyContractPnLs.filter(
      (value) => value > 0
    );

  const losses =
    dailyContractPnLs.filter(
      (value) => value < 0
    );

  const breakevens =
    dailyContractPnLs.filter(
      (value) => value === 0
    );

  const realizedGross =
    dailyContractPnLs.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  const realizedNet =
    realizedGross -
    dailyFees;

  const totalPnL =
    dailyUnrealized != null
      ? realizedNet +
        dailyUnrealized
      : null;

  book.daily = {
    tradingDate,

    closedContracts:
      dailyContractPnLs.length,

    winningContracts:
      wins.length,

    losingContracts:
      losses.length,

    breakevenContracts:
      breakevens.length,

    realizedGross,
    fees:
      dailyFees,
    realizedNet,

    unrealized:
      dailyUnrealized,

    totalPnL,

    openContracts:
      book.openContracts,

    mark:
      mark != null
        ? mark
        : null,
  };

  book.dailyAccountPnL =
    totalPnL != null
      ? totalPnL
      : realizedNet;

  book.averageDailyPnLPerClosedContract =
    dailyContractPnLs.length
      ? (
          book.dailyAccountPnL /
          dailyContractPnLs.length
        )
      : null;

  return book;
}

function calculateContractUnrealized({
  contract,
  trade,
  mark,
}) {
  const currentMark =
    safeNum(mark);

  if (
    currentMark == null ||
    upper(
      contract?.status
    ) !== "OPEN"
  ) {
    return null;
  }

  const entryPrice =
    safeNum(
      contract?.entryPrice
    );

  const dollarsPerPoint =
    getDollarsPerPoint(
      trade
    );

  const direction =
    upper(
      contract?.direction ||
      trade?.direction
    );

  if (
    entryPrice == null ||
    dollarsPerPoint == null ||
    (
      direction !== "SHORT" &&
      direction !== "LONG"
    )
  ) {
    return null;
  }

  const points =
    direction === "SHORT"
      ? entryPrice -
        currentMark
      : currentMark -
        entryPrice;

  return (
    points *
    dollarsPerPoint
  );
}

function ensureDay(
  dayMap,
  tradingDay
) {
  if (!tradingDay) {
    return null;
  }

  if (
    !dayMap.has(
      tradingDay
    )
  ) {
    dayMap.set(
      tradingDay,
      {
        realizedGross: 0,
        fees: 0,
      }
    );
  }

  return dayMap.get(
    tradingDay
  );
}

function monthKeyFromTradingDate(
  tradingDate
) {
  if (
    typeof tradingDate !==
      "string" ||
    tradingDate.length < 7
  ) {
    return null;
  }

  return tradingDate.slice(
    0,
    7
  );
}

function finalizeCapitalPerformance(
  book,
  dayMap,
  {
    tradingDate,
    liveUnrealized,
  }
) {
  const startingCapital =
    safeNum(
      book.startingCapital
    );

  const tradingDays =
    [...dayMap.keys()]
      .sort();

  const rows =
    tradingDays.map(
      (day) => {
        const source =
          dayMap.get(
            day
          );

        return {
          tradingDate:
            day,

          realizedGross:
            source
              ?.realizedGross ||
            0,

          fees:
            source?.fees ||
            0,

          realizedNet:
            (
              source
                ?.realizedGross ||
              0
            ) -
            (
              source?.fees ||
              0
            ),
        };
      }
    );

  const actualGross =
    rows.reduce(
      (sum, row) =>
        sum +
        row.realizedGross,
      0
    );

  const actualFees =
    rows.reduce(
      (sum, row) =>
        sum +
        row.fees,
      0
    );

  const actualNet =
    actualGross -
    actualFees;

  book.actualGrossRealizedPnL =
    actualGross;

  book.actualFees =
    actualFees;

  book.actualNetRealizedPnL =
    actualNet;

  book.tradingDays =
    rows.length;

  book.averageDailyGain =
    rows.length
      ? actualNet /
        rows.length
      : null;

  if (
    startingCapital == null ||
    startingCapital <= 0
  ) {
    return book;
  }

  book.actualReturnSinceStartPct =
    (
      actualNet /
      startingCapital
    ) * 100;

  book.currentEquity =
    startingCapital +
    actualNet;

  let equity =
    startingCapital;

  let peakEquity =
    startingCapital;

  let maxDrawdownDollars =
    0;

  let maxDrawdownPct =
    0;

  const curve = [];

  for (const row of rows) {
    equity +=
      row.realizedNet;

    if (
      equity >
      peakEquity
    ) {
      peakEquity =
        equity;
    }

    const drawdownDollars =
      Math.max(
        0,
        peakEquity -
          equity
      );

    const drawdownPct =
      peakEquity > 0
        ? (
            drawdownDollars /
            peakEquity
          ) * 100
        : 0;

    if (
      drawdownDollars >
      maxDrawdownDollars
    ) {
      maxDrawdownDollars =
        drawdownDollars;
    }

    if (
      drawdownPct >
      maxDrawdownPct
    ) {
      maxDrawdownPct =
        drawdownPct;
    }

    curve.push({
      tradingDate:
        row.tradingDate,

      realizedGross:
        row.realizedGross,

      fees:
        row.fees,

      realizedNet:
        row.realizedNet,

      equity,
      peakEquity,
      drawdownDollars,
      drawdownPct,
    });
  }

  book.realizedDailyEquityCurve =
    curve;

  book.peakEquity =
    peakEquity;

  book.maxDrawdownDollars =
    maxDrawdownDollars;

  book.maxDrawdownPct =
    maxDrawdownPct;

  book.currentDrawdownDollars =
    Math.max(
      0,
      peakEquity -
        book.currentEquity
    );

  book.currentDrawdownPct =
    peakEquity > 0
      ? (
          book.currentDrawdownDollars /
          peakEquity
        ) * 100
      : 0;

  if (
    liveUnrealized != null
  ) {
    book.liveEquity =
      book.currentEquity +
      liveUnrealized;

    book.liveDrawdownDollars =
      Math.max(
        0,
        peakEquity -
          book.liveEquity
      );

    book.liveDrawdownPct =
      peakEquity > 0
        ? (
            book.liveDrawdownDollars /
            peakEquity
          ) * 100
        : 0;
  }

  if (
    rows.length > 0
  ) {
    const actualReturnDecimal =
      actualNet /
      startingCapital;

    book.annualizedSimpleReturnPct =
      actualReturnDecimal *
      (
        TRADING_DAYS_PER_YEAR /
        rows.length
      ) *
      100;

    const equityRatio =
      book.currentEquity /
      startingCapital;

    if (
      equityRatio > 0
    ) {
      const compoundedAnnualized =
        Math.pow(
          equityRatio,
          TRADING_DAYS_PER_YEAR /
            rows.length
        ) - 1;

      book.annualizedCompoundedReturnPct =
        compoundedAnnualized *
        100;
    }
  }

  const currentMonthKey =
    monthKeyFromTradingDate(
      tradingDate
    );

  const currentMonthRows =
    rows.filter(
      (row) =>
        monthKeyFromTradingDate(
          row.tradingDate
        ) ===
        currentMonthKey
    );

  const currentMonthGross =
    currentMonthRows.reduce(
      (sum, row) =>
        sum +
        row.realizedGross,
      0
    );

  const currentMonthFees =
    currentMonthRows.reduce(
      (sum, row) =>
        sum +
        row.fees,
      0
    );

  const currentMonthNet =
    currentMonthGross -
    currentMonthFees;

  book.currentMonth = {
    monthKey:
      currentMonthKey,

    tradingDays:
      currentMonthRows.length,

    realizedGross:
      currentMonthGross,

    fees:
      currentMonthFees,

    realizedNet:
      currentMonthNet,

    returnPct:
      (
        currentMonthKey &&
        startingCapital > 0
      )
        ? (
            currentMonthNet /
            startingCapital
          ) * 100
        : null,
  };

  return book;
}

function buildCombinedDayMap(
  intradayMap,
  swingMap
) {
  const combined =
    new Map();

  const allDays =
    new Set([
      ...intradayMap.keys(),
      ...swingMap.keys(),
    ]);

  for (const day of allDays) {
    const intraday =
      intradayMap.get(
        day
      );

    const swing =
      swingMap.get(
        day
      );

    combined.set(
      day,
      {
        realizedGross:
          (
            intraday
              ?.realizedGross ||
            0
          ) +
          (
            swing
              ?.realizedGross ||
            0
          ),

        fees:
          (
            intraday?.fees ||
            0
          ) +
          (
            swing?.fees ||
            0
          ),
      }
    );
  }

  return combined;
}

export function calculateAnalytics(
  trades = [],
  options = {}
) {
  const mark =
    safeNum(
      options?.mark
    );

  const marks =
    options?.marks &&
    typeof options.marks ===
      "object"
      ? options.marks
      : {};

  const tradingDate =
    options?.tradingDate ||
    getCurrentFuturesTradingDayKey(
      options?.now ||
      new Date()
    );

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

  const performancePnL = {
    INTRADAY: [],
    SWING: [],
  };

  const actualDailyPnL = {
    INTRADAY: [],
    SWING: [],
  };

  const dailyFees = {
    INTRADAY: 0,
    SWING: 0,
  };

  const dailyUnrealized = {
    INTRADAY: 0,
    SWING: 0,
  };

  const dailyUnrealizedAvailable = {
    INTRADAY: true,
    SWING: true,
  };

  const seenIds = {
    INTRADAY:
      new Set(),

    SWING:
      new Set(),
  };

  const seenFeeTransactionIds = {
    INTRADAY:
      new Set(),

    SWING:
      new Set(),
  };

  const dailyCapitalMaps = {
    INTRADAY:
      new Map(),

    SWING:
      new Map(),
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

    const contracts =
      getContracts(
        trade
      );

    if (!contracts.length) {
      book.missingContractRegistryTrades +=
        1;
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
        seenIds[
          account
        ].has(
          contractId
        )
      ) {
        book.duplicateContractIdsExcluded +=
          1;

        continue;
      }

      seenIds[
        account
      ].add(
        contractId
      );

      book.totalContractIds +=
        1;

      const status =
        upper(
          contract
            ?.status
        );

      if (
        status ===
        "OPEN"
      ) {
        book.openContracts +=
          1;

        const contractMark =
          resolveContractMark({
            contract,
            trade,
            marks,
            fallbackMark:
              mark,
          });

        if (
          contractMark != null
        ) {
          const unrealized =
            calculateContractUnrealized({
              contract,
              trade,
              mark:
                contractMark,
            });

          if (
            unrealized == null
          ) {
            dailyUnrealizedAvailable[
              account
            ] = false;
          } else {
            dailyUnrealized[
              account
            ] +=
              unrealized;
          }
        } else {
          dailyUnrealizedAvailable[
            account
          ] = false;
        }

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

      /*
       * BROKER / CAPITAL TRUTH
       * Every valid CLOSED REAL contract counts here.
       */
      const closeTradingDay =
        getFuturesTradingDayKey(
          contract
            ?.closingFillTime
        );

      if (
        closeTradingDay
      ) {
        const day =
          ensureDay(
            dailyCapitalMaps[
              account
            ],
            closeTradingDay
          );

        day.realizedGross +=
          pnl;

        if (
          closeTradingDay ===
          tradingDate
        ) {
          actualDailyPnL[
            account
          ].push(
            pnl
          );
        }
      }

      /*
       * PERFORMANCE ELIGIBILITY
       * < 60 sec remains in broker/account truth but does not
       * participate in trading-performance statistics.
       */
      const eligibility =
        getPerformanceEligibility(
          contract
        );

      if (
        !eligibility.eligible
      ) {
        book.performanceExcludedContracts +=
          1;

        book.performanceExcludedGrossPnL +=
          pnl;

        if (
          eligibility.exclusionReason ===
          PERFORMANCE_EXCLUSION_REASON
        ) {
          book.ultraShortExcludedContracts +=
            1;
        }

        continue;
      }

      performancePnL[
        account
      ].push(
        pnl
      );
    }

    book.uniqueContractIds =
      seenIds[
        account
      ].size;

    const events =
      Array.isArray(
        trade?.events
      )
        ? trade.events
        : [];

    for (
      const event
      of events
    ) {
      if (
        !isRealBrokerExecutionEvent(
          event
        )
      ) {
        continue;
      }

      const transactionId =
        String(
          event
            ?.brokerTransactionId ||
          ""
        ).trim();

      if (
        !transactionId ||
        seenFeeTransactionIds[
          account
        ].has(
          transactionId
        )
      ) {
        continue;
      }

      const eventTradingDay =
        getFuturesTradingDayKey(
          getBrokerExecutionTime(
            event
          )
        );

      if (
        !eventTradingDay
      ) {
        continue;
      }

      const fee =
        getBrokerExecutionFee(
          event
        );

      if (
        fee == null
      ) {
        continue;
      }

      seenFeeTransactionIds[
        account
      ].add(
        transactionId
      );

      const day =
        ensureDay(
          dailyCapitalMaps[
            account
          ],
          eventTradingDay
        );

      day.fees +=
        fee;

      if (
        eventTradingDay ===
        tradingDate
      ) {
        dailyFees[
          account
        ] +=
          fee;
      }
    }
  }

  finalizeStrategy(
    strategies.INTRADAY,
    performancePnL.INTRADAY
  );

  finalizeStrategy(
    strategies.SWING,
    performancePnL.SWING
  );

  finalizeDaily(
    strategies.INTRADAY,
    {
      tradingDate,

      dailyContractPnLs:
        actualDailyPnL
          .INTRADAY,

      dailyFees:
        dailyFees
          .INTRADAY,

      dailyUnrealized:
        dailyUnrealizedAvailable
          .INTRADAY
          ? dailyUnrealized
              .INTRADAY
          : null,

      mark,
    }
  );

  finalizeDaily(
    strategies.SWING,
    {
      tradingDate,

      dailyContractPnLs:
        actualDailyPnL
          .SWING,

      dailyFees:
        dailyFees
          .SWING,

      dailyUnrealized:
        dailyUnrealizedAvailable
          .SWING
          ? dailyUnrealized
              .SWING
          : null,

      mark,
    }
  );

  finalizeCapitalPerformance(
    strategies.INTRADAY,
    dailyCapitalMaps.INTRADAY,
    {
      tradingDate,

      liveUnrealized:
        dailyUnrealizedAvailable
          .INTRADAY
          ? dailyUnrealized
              .INTRADAY
          : null,
    }
  );

  finalizeCapitalPerformance(
    strategies.SWING,
    dailyCapitalMaps.SWING,
    {
      tradingDate,

      liveUnrealized:
        dailyUnrealizedAvailable
          .SWING
          ? dailyUnrealized
              .SWING
          : null,
    }
  );

  const all =
    finalizeStrategy(
      blankStrategy(
        "ALL REAL"
      ),
      [
        ...performancePnL
          .INTRADAY,
        ...performancePnL
          .SWING,
      ]
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

  all.performanceExcludedContracts =
    strategies.INTRADAY
      .performanceExcludedContracts +
    strategies.SWING
      .performanceExcludedContracts;

  all.ultraShortExcludedContracts =
    strategies.INTRADAY
      .ultraShortExcludedContracts +
    strategies.SWING
      .ultraShortExcludedContracts;

  all.performanceExcludedGrossPnL =
    strategies.INTRADAY
      .performanceExcludedGrossPnL +
    strategies.SWING
      .performanceExcludedGrossPnL;

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

  const combinedDailyPnLs = [
    ...actualDailyPnL
      .INTRADAY,
    ...actualDailyPnL
      .SWING,
  ];

  const combinedDailyFees =
    dailyFees.INTRADAY +
    dailyFees.SWING;

  const combinedLiveUnrealized =
    dailyUnrealizedAvailable.INTRADAY &&
    dailyUnrealizedAvailable.SWING
      ? (
          dailyUnrealized.INTRADAY +
          dailyUnrealized.SWING
        )
      : null;

  finalizeDaily(
    all,
    {
      tradingDate,
      dailyContractPnLs:
        combinedDailyPnLs,
      dailyFees:
        combinedDailyFees,
      dailyUnrealized:
        combinedLiveUnrealized,
      mark,
    }
  );

  const combinedDayMap =
    buildCombinedDayMap(
      dailyCapitalMaps.INTRADAY,
      dailyCapitalMaps.SWING
    );

  finalizeCapitalPerformance(
    all,
    combinedDayMap,
    {
      tradingDate,
      liveUnrealized:
        combinedLiveUnrealized,
    }
  );

  return {
    model:
      "ENGINE10_CANONICAL_CAPITAL_PERFORMANCE_V4",

    performanceUnit:
      "ELIGIBLE_CLOSED_CONTRACT_ID",

    canonicalSource:
      "trade.realBroker.contracts[]",

    pnlBasis:
      "ENGINE10_CONTRACT_ID_GROSS_REALIZED_PNL",

    accountTruthBasis:
      "ALL_VALID_REAL_CLOSED_CONTRACTS_PLUS_ACTUAL_EXECUTION_FEES",

    performanceEligibility: {
      minimumHoldingSeconds:
        PERFORMANCE_MIN_HOLD_SECONDS,

      exactlyMinimumIsEligible:
        true,

      exclusionReason:
        PERFORMANCE_EXCLUSION_REASON,

      excludedFrom:
        [
          "WIN_RATE",
          "AVERAGE_WINNER",
          "AVERAGE_LOSER",
          "WIN_LOSS_RATIO",
          "PROFIT_FACTOR",
          "EXPECTANCY",
          "BEST_WORST_CONTRACT",
          "ENGINE28_STRATEGY_LEARNING",
        ],

      retainedIn:
        [
          "ACTUAL_REALIZED_PNL",
          "ACCOUNT_EQUITY",
          "AVERAGE_DAILY_GAIN",
          "RETURN_SINCE_START",
          "DRAWDOWN",
          "DAILY_ACCOUNT_PNL",
        ],
    },

    startingCapital:
      PERFORMANCE_STARTING_CAPITAL,

    annualization: {
      basis:
        "OBSERVED_REALIZED_RETURN_OVER_TRADING_DAYS",

      tradingDaysPerYear:
        TRADING_DAYS_PER_YEAR,

      simple:
        "actualReturn * (252 / observedTradingDays)",

      compounded:
        "(currentEquity / startingCapital)^(252 / observedTradingDays) - 1",

      projectionOnly:
        true,
    },

    drawdownBasis:
      "REALIZED_NET_EQUITY_BY_FUTURES_TRADING_DAY",

    dailyBasis:
      "FUTURES_TRADING_DAY_18ET",

    tradingDate,

    strategies,

    all,
  };
}
