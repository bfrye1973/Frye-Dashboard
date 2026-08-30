// src/pages/journal/components/JournalPerformanceAnalytics.jsx
//
// Frye Dashboard — Contract Performance
//
// Primary performance unit:
// ONE CLOSED CONTRACT = ONE STATISTICAL OBSERVATION.
//
// INTRADAY and SWING remain separate.
//
// Legacy closing events that predate Engine 10 closedContracts[] are
// explicitly excluded from contract win/loss math rather than guessed.
//

import React from "react";

import {
  COLORS,
} from "../journalConstants.js";

import {
  fmtMoney,
  fmtNegativeMoney,
  fmtNum,
  fmtPct,
  pnlColor,
} from "../journalFormatters.js";

function Metric({
  label,
  value,
  sub = "",
  color = COLORS.text,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        border:
          `1px solid ${COLORS.line}`,
        borderRadius: 7,
        background:
          COLORS.panelAlt,
        padding:
          "12px 9px",
        textAlign:
          "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color:
            COLORS.muted,
          fontWeight: 950,
          textTransform:
            "uppercase",
          lineHeight: 1.15,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 22,
          color,
          fontWeight: 1000,
          marginTop: 8,
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {sub ? (
        <div
          style={{
            fontSize: 9,
            color:
              COLORS.muted,
            marginTop: 7,
            fontWeight: 800,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function StrategyPerformance({
  title,
  book,
  accent,
}) {
  const hasClosed =
    (
      book
        ?.closedContracts ||
      0
    ) > 0;

  const legacyExcluded =
    (
      book
        ?.legacyClosedQuantityExcluded ||
      0
    ) > 0;

  const profitFactor =
    book?.profitFactor ===
    Infinity
      ? "∞"
      : fmtNum(
          book?.profitFactor
        );

  return (
    <div
      style={{
        border:
          `1px solid ${
            accent
          }`,
        borderRadius: 8,
        background:
          COLORS.panel,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 18,
            color:
              accent,
            fontWeight: 1000,
          }}
        >
          {title} CONTRACT PERFORMANCE
        </div>

        <div
          style={{
            fontSize: 10,
            color:
              COLORS.muted,
            fontWeight: 850,
            textAlign:
              "right",
          }}
        >
          One closed contract = one result
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(7, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        <Metric
          label="OPEN CONTRACTS"
          value={String(
            book
              ?.openContracts ||
            0
          )}
          sub="Not scored yet"
        />

        <Metric
          label="CLOSED CONTRACTS"
          value={String(
            book
              ?.closedContracts ||
            0
          )}
          sub="Exact Engine 10 records"
        />

        <Metric
          label="WINNING CONTRACTS"
          value={String(
            book
              ?.winningContracts ||
            0
          )}
          sub="Gross realized > 0"
          color={
            hasClosed
              ? COLORS.green
              : COLORS.text
          }
        />

        <Metric
          label="LOSING CONTRACTS"
          value={String(
            book
              ?.losingContracts ||
            0
          )}
          sub="Gross realized < 0"
          color={
            (
              book
                ?.losingContracts ||
              0
            ) > 0
              ? COLORS.red
              : COLORS.text
          }
        />

        <Metric
          label="BREAKEVEN"
          value={String(
            book
              ?.breakevenContracts ||
            0
          )}
          sub="Gross realized = 0"
        />

        <Metric
          label="CONTRACT WIN %"
          value={
            hasClosed
              ? fmtPct(
                  book?.winPct
                )
              : "—"
          }
          sub="Closed contracts"
          color={
            hasClosed
              ? COLORS.green
              : COLORS.text
          }
        />

        <Metric
          label="REALIZED CONTRACT P&L"
          value={
            hasClosed
              ? fmtMoney(
                  book
                    ?.grossRealizedContractPnL
                )
              : "—"
          }
          sub="Gross exact FIFO P&L"
          color={
            hasClosed
              ? pnlColor(
                  book
                    ?.grossRealizedContractPnL
                )
              : COLORS.text
          }
        />

        <Metric
          label="AVG DAILY P&L / CLOSED CONTRACT"
          value={
            book
              ?.averageDailyPnLPerClosedContract !=
            null
              ? fmtMoney(
                  book
                    ?.averageDailyPnLPerClosedContract
                )
              : "—"
          }
          sub="Daily Account P&L ÷ closed contracts"
          color={
            book
              ?.averageDailyPnLPerClosedContract !=
            null
              ? pnlColor(
                  book
                    ?.averageDailyPnLPerClosedContract
                )
              : COLORS.text
          }
        />

        <Metric
          label="AVG LOSING CONTRACT"
          value={
            book
              ?.averageLosingContract !=
            null
              ? fmtNegativeMoney(
                  book
                    ?.averageLosingContract
                )
              : "—"
          }
          sub="Gross P&L"
          color={
            book
              ?.averageLosingContract !=
            null
              ? COLORS.red
              : COLORS.text
          }
        />

        <Metric
          label="WIN/LOSS RATIO"
          value={
            hasClosed
              ? fmtNum(
                  book
                    ?.winLossRatio
                )
              : "—"
          }
          sub="Avg winner / avg loser"
        />

        <Metric
          label="PROFIT FACTOR"
          value={
            hasClosed
              ? profitFactor
              : "—"
          }
          sub="Gross profit / gross loss"
        />

        <Metric
          label="TOTAL CONTRACTS"
          value={String(
            book
              ?.totalContractIds ||
            (
              (book?.openContracts || 0) +
              (book?.closedContracts || 0)
            )
          )}
          sub="Open + closed contractIds"
        />

        <Metric
          label="BEST CONTRACT"
          value={
            book?.bestContract !=
            null
              ? fmtMoney(
                  book
                    ?.bestContract
                )
              : "—"
          }
          sub="Gross P&L"
          color={
            book?.bestContract !=
            null
              ? pnlColor(
                  book
                    ?.bestContract
                )
              : COLORS.text
          }
        />

        <Metric
          label="WORST CONTRACT"
          value={
            book?.worstContract !=
            null
              ? fmtMoney(
                  book
                    ?.worstContract
                )
              : "—"
          }
          sub="Gross P&L"
          color={
            book?.worstContract !=
            null
              ? pnlColor(
                  book
                    ?.worstContract
                )
              : COLORS.text
          }
        />
      </div>

      {legacyExcluded ? (
        <div
          style={{
            marginTop: 10,
            border:
              `1px solid ${COLORS.goldLine}`,
            borderRadius: 6,
            padding:
              "8px 10px",
            background:
              COLORS.goldSoft,
            color:
              COLORS.gold,
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          Historical coverage notice:{" "}
          {
            book
              ?.legacyClosedQuantityExcluded
          } older closed contract
          {
            book
              ?.legacyClosedQuantityExcluded ===
            1
              ? ""
              : "s"
          } are excluded from contract win/loss statistics because those legacy Journal events predate exact Engine 10 closedContracts[] records. No P&L was divided or guessed.
        </div>
      ) : null}
    </div>
  );
}

export default function JournalPerformanceAnalytics({
  analytics,
  modeFilter = "REAL",
}) {
  if (
    modeFilter ===
    "PAPER"
  ) {
    return (
      <section
        style={{
          margin: 12,
          border:
            `1px solid ${COLORS.blueLine}`,
          borderRadius: 8,
          padding: 12,
          background:
            COLORS.blueSoft,
          color:
            COLORS.blue,
          fontWeight: 900,
        }}
      >
        PAPER contract analytics remain separate from the REAL Schwab contract-performance model.
      </section>
    );
  }

  const intraday =
    analytics
      ?.strategies
      ?.INTRADAY ||
    {};

  const swing =
    analytics
      ?.strategies
      ?.SWING ||
    {};

  return (
    <section
      style={{
        margin: 12,
      }}
    >
      <div
        style={{
          fontSize: 19,
          color:
            COLORS.green,
          fontWeight: 1000,
          marginBottom: 10,
        }}
      >
        REAL CONTRACT PERFORMANCE
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: 12,
        }}
      >
        <StrategyPerformance
          title="INTRADAY"
          book={
            intraday
          }
          accent={
            COLORS.greenLine
          }
        />

        <StrategyPerformance
          title="SWING"
          book={
            swing
          }
          accent={
            COLORS.goldLine
          }
        />
      </div>

      <div
        style={{
          fontSize: 10,
          color:
            COLORS.muted,
          marginTop: 8,
          fontWeight: 800,
        }}
      >
        Canonical denominator: closed contracts only. Open contracts are excluded from realized win/loss statistics until they close. Profit Factor, win/loss classification, best/worst contract, and exact realized contract P&L use Engine 10 contractId records. AVG DAILY P&L / CLOSED CONTRACT uses the strategy Daily Account P&L divided only by that strategy's closed-contract count.
      </div>
    </section>
  );
}
