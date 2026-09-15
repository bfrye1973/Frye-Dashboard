// src/pages/journal/components/JournalPerformanceAnalytics.jsx
// Frye Dashboard — REAL Performance Scoreboard + Daily + Contract Performance

import React from "react";
import { COLORS } from "../journalConstants.js";
import {
  fmtMoney,
  fmtNegativeMoney,
  fmtNum,
  fmtPct,
  pnlColor,
} from "../journalFormatters.js";

function Metric({ label, value, sub = "", color = COLORS.text }) {
  return (
    <div
      style={{
        minWidth: 0,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 7,
        background: COLORS.panelAlt,
        padding: "12px 9px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: COLORS.muted,
          fontWeight: 950,
          textTransform: "uppercase",
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
            color: COLORS.muted,
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


function ScoreboardBook({ title, book, accent }) {
  const excluded = book?.performanceExcludedContracts || 0;
  const sample = book?.closedContracts || 0;
  const isAllReal = title === "ALL REAL";
  const profitFactor =
    book?.profitFactor === Infinity
      ? "∞"
      : fmtNum(book?.profitFactor);

  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 8,
        background: COLORS.panel,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 18, color: accent, fontWeight: 1000 }}>
          {title}
        </div>

        <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: 850 }}>
          {book?.tradingDays || 0} trading days
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        <Metric
          label="STARTING CAPITAL"
          value={book?.startingCapital != null ? fmtMoney(book.startingCapital) : "—"}
          sub="Locked performance capital"
        />

        <Metric
          label="CURRENT REALIZED EQUITY"
          value={book?.currentEquity != null ? fmtMoney(book.currentEquity) : "—"}
          sub="Starting capital + net realized"
          color={book?.currentEquity != null ? pnlColor(book.currentEquity - (book?.startingCapital || 0)) : COLORS.text}
        />

        <Metric
          label="ACTUAL RETURN"
          value={book?.actualReturnSinceStartPct != null ? fmtPct(book.actualReturnSinceStartPct) : "—"}
          sub="Since performance start"
          color={book?.actualReturnSinceStartPct != null ? pnlColor(book.actualReturnSinceStartPct) : COLORS.text}
        />

        <Metric
          label="AVG DAILY GAIN"
          value={book?.averageDailyGain != null ? fmtMoney(book.averageDailyGain) : "—"}
          sub={`${book?.tradingDays || 0} realized trading days`}
          color={book?.averageDailyGain != null ? pnlColor(book.averageDailyGain) : COLORS.text}
        />

        <Metric
          label="WIN RATE"
          value={sample ? fmtPct(book?.winPct) : "—"}
          sub={`${book?.winningContracts || 0}W / ${book?.losingContracts || 0}L • ${sample} eligible`}
          color={sample ? COLORS.green : COLORS.text}
        />

        <Metric
          label="THIS MONTH RETURN"
          value={book?.currentMonth?.returnPct != null ? fmtPct(book.currentMonth.returnPct) : "—"}
          sub={`${book?.currentMonth?.tradingDays || 0} trading days`}
          color={book?.currentMonth?.returnPct != null ? pnlColor(book.currentMonth.returnPct) : COLORS.text}
        />

        <Metric
          label="MAX DRAWDOWN"
          value={book?.maxDrawdownDollars != null ? fmtNegativeMoney(book.maxDrawdownDollars) : "—"}
          sub={book?.maxDrawdownPct != null ? `${fmtPct(book.maxDrawdownPct)} realized-equity drawdown` : "Realized equity"}
          color={(book?.maxDrawdownDollars || 0) > 0 ? COLORS.red : COLORS.text}
        />

        <Metric
          label="CURRENT DRAWDOWN"
          value={book?.currentDrawdownDollars != null ? fmtNegativeMoney(book.currentDrawdownDollars) : "—"}
          sub={book?.currentDrawdownPct != null ? fmtPct(book.currentDrawdownPct) : "Realized equity"}
          color={(book?.currentDrawdownDollars || 0) > 0 ? COLORS.red : COLORS.text}
        />

        <Metric
          label="LIVE DRAWDOWN"
          value={book?.liveDrawdownDollars != null ? fmtNegativeMoney(book.liveDrawdownDollars) : "—"}
          sub={book?.liveDrawdownPct != null ? `${fmtPct(book.liveDrawdownPct)} incl. open P&L` : "Live mark required"}
          color={(book?.liveDrawdownDollars || 0) > 0 ? COLORS.red : COLORS.text}
        />

        <Metric
          label="ANNUALIZED SIMPLE"
          value={book?.annualizedSimpleReturnPct != null ? fmtPct(book.annualizedSimpleReturnPct) : "—"}
          sub="Projected from observed pace"
          color={book?.annualizedSimpleReturnPct != null ? pnlColor(book.annualizedSimpleReturnPct) : COLORS.text}
        />

        <Metric
          label="ANNUALIZED COMPOUNDED"
          value={book?.annualizedCompoundedReturnPct != null ? fmtPct(book.annualizedCompoundedReturnPct) : "—"}
          sub="Projection • not realized annual return"
          color={book?.annualizedCompoundedReturnPct != null ? pnlColor(book.annualizedCompoundedReturnPct) : COLORS.text}
        />

        <Metric
          label="PERFORMANCE SAMPLE"
          value={String(sample)}
          sub={`${book?.tradingDays || 0} days • ${excluded} excluded`}
        />

        {isAllReal ? (
          <Metric
            label="PROFIT FACTOR"
            value={sample ? profitFactor : "—"}
            sub="Gross profit / gross loss"
            color={
              book?.profitFactor != null
                ? pnlColor(
                    book.profitFactor === Infinity
                      ? 1
                      : book.profitFactor - 1
                  )
                : COLORS.text
            }
          />
        ) : null}
      </div>

      {excluded > 0 ? (
        <div
          style={{
            marginTop: 8,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: "7px 9px",
            color: COLORS.muted,
            fontSize: 9,
            fontWeight: 850,
          }}
        >
          PERFORMANCE EXCLUSIONS: {excluded} ultra-short contract{excluded === 1 ? "" : "s"} excluded from strategy statistics. {fmtMoney(book?.performanceExcludedGrossPnL || 0)} remains in actual broker/account P&L, equity and drawdown.
        </div>
      ) : null}
    </div>
  );
}

function DailyAccountPerformance({ title, daily, accent }) {
  const totalAvailable = daily?.totalPnL != null;

  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 8,
        background: COLORS.panel,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 17, color: accent, fontWeight: 1000 }}>
          {title} DAILY PERFORMANCE
        </div>
        <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 850 }}>
          Trading date {daily?.tradingDate || "—"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        <Metric
          label="TODAY GROSS REALIZED"
          value={fmtMoney(daily?.realizedGross || 0)}
          sub={`${daily?.closedContracts || 0} closed contractIds`}
          color={pnlColor(daily?.realizedGross || 0)}
        />

        <Metric
          label="TODAY FEES"
          value={fmtNegativeMoney(daily?.fees || 0)}
          sub="Actual broker execution fees"
          color={(daily?.fees || 0) > 0 ? COLORS.red : COLORS.text}
        />

        <Metric
          label="TODAY NET REALIZED"
          value={fmtMoney(daily?.realizedNet || 0)}
          sub="Gross realized - fees"
          color={pnlColor(daily?.realizedNet || 0)}
        />

        <Metric
          label="LIVE UNREALIZED"
          value={daily?.unrealized != null ? fmtMoney(daily.unrealized) : "—"}
          sub={
            daily?.unrealized != null
              ? `${daily?.openContracts || 0} open contractIds`
              : "Current mark required"
          }
          color={daily?.unrealized != null ? pnlColor(daily.unrealized) : COLORS.text}
        />

        <Metric
          label="DAILY ACCOUNT P&L"
          value={
            totalAvailable
              ? fmtMoney(daily.totalPnL)
              : fmtMoney(daily?.realizedNet || 0)
          }
          sub={
            totalAvailable
              ? "Net realized + live unrealized"
              : "Net realized; live mark unavailable"
          }
          color={pnlColor(totalAvailable ? daily.totalPnL : daily?.realizedNet || 0)}
        />

        <Metric
          label="TODAY CLOSED"
          value={String(daily?.closedContracts || 0)}
          sub={`${daily?.winningContracts || 0}W / ${daily?.losingContracts || 0}L`}
        />
      </div>
    </div>
  );
}

function StrategyPerformance({ title, book, accent }) {
  const hasClosed = (book?.closedContracts || 0) > 0;
  const profitFactor = book?.profitFactor === Infinity ? "∞" : fmtNum(book?.profitFactor);

  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 8,
        background: COLORS.panel,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 18, color: accent, fontWeight: 1000 }}>
          {title} CONTRACT PERFORMANCE
        </div>
        <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 850, textAlign: "right" }}>
          Eligible closed contractId = one performance result
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        <Metric label="OPEN CONTRACTS" value={String(book?.openContracts || 0)} sub="Not scored yet" />
        <Metric label="ELIGIBLE CLOSED" value={String(book?.closedContracts || 0)} sub={`${book?.performanceExcludedContracts || 0} ultra-short excluded`} />
        <Metric label="WINNING CONTRACTS" value={String(book?.winningContracts || 0)} sub="Gross realized > 0" color={hasClosed ? COLORS.green : COLORS.text} />
        <Metric label="LOSING CONTRACTS" value={String(book?.losingContracts || 0)} sub="Gross realized < 0" color={(book?.losingContracts || 0) > 0 ? COLORS.red : COLORS.text} />
        <Metric label="BREAKEVEN" value={String(book?.breakevenContracts || 0)} sub="Gross realized = 0" />
        <Metric label="CONTRACT WIN %" value={hasClosed ? fmtPct(book?.winPct) : "—"} sub="Eligible closed contractIds only" color={hasClosed ? COLORS.green : COLORS.text} />
        <Metric label="REALIZED CONTRACT P&L" value={hasClosed ? fmtMoney(book?.grossRealizedContractPnL) : "—"} sub="Eligible performance gross P&L" color={hasClosed ? pnlColor(book?.grossRealizedContractPnL) : COLORS.text} />
        <Metric label="AVG TODAY P&L / CLOSED" value={book?.averageDailyPnLPerClosedContract != null ? fmtMoney(book.averageDailyPnLPerClosedContract) : "—"} sub="Today's account P&L ÷ today's closed contractIds" color={book?.averageDailyPnLPerClosedContract != null ? pnlColor(book.averageDailyPnLPerClosedContract) : COLORS.text} />
        <Metric label="AVG LOSING CONTRACT" value={book?.averageLosingContract != null ? fmtNegativeMoney(book.averageLosingContract) : "—"} sub="All-time gross P&L" color={book?.averageLosingContract != null ? COLORS.red : COLORS.text} />
        <Metric label="WIN/LOSS RATIO" value={hasClosed ? fmtNum(book?.winLossRatio) : "—"} sub="Avg winner / avg loser" />
        <Metric label="PROFIT FACTOR" value={hasClosed ? profitFactor : "—"} sub="Gross profit / gross loss" />
        <Metric label="TOTAL CONTRACTS" value={String(book?.totalContractIds || ((book?.openContracts || 0) + (book?.closedContracts || 0)))} sub="Open + closed contractIds" />
        <Metric label="BEST CONTRACT" value={book?.bestContract != null ? fmtMoney(book.bestContract) : "—"} sub="All-time gross P&L" color={book?.bestContract != null ? pnlColor(book.bestContract) : COLORS.text} />
        <Metric label="WORST CONTRACT" value={book?.worstContract != null ? fmtMoney(book.worstContract) : "—"} sub="All-time gross P&L" color={book?.worstContract != null ? pnlColor(book.worstContract) : COLORS.text} />
      </div>
    </div>
  );
}

export default function JournalPerformanceAnalytics({ analytics, modeFilter = "REAL" }) {
  if (modeFilter === "PAPER") {
    return (
      <section
        style={{
          margin: 12,
          border: `1px solid ${COLORS.blueLine}`,
          borderRadius: 8,
          padding: 12,
          background: COLORS.blueSoft,
          color: COLORS.blue,
          fontWeight: 900,
        }}
      >
        PAPER contract analytics remain separate from the REAL Schwab contract-performance model.
      </section>
    );
  }

  const intraday = analytics?.strategies?.INTRADAY || {};
  const swing = analytics?.strategies?.SWING || {};
  const all = analytics?.all || {};

  return (
    <section style={{ margin: 12 }}>
      <div style={{ fontSize: 19, color: COLORS.green, fontWeight: 1000, marginBottom: 10 }}>
        PERFORMANCE SCOREBOARD
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <ScoreboardBook
          title="INTRADAY"
          book={intraday}
          accent={COLORS.greenLine}
        />

        <ScoreboardBook
          title="SWING"
          book={swing}
          accent={COLORS.goldLine}
        />

        <ScoreboardBook
          title="ALL REAL"
          book={all}
          accent={COLORS.blueLine}
        />
      </div>

      <div style={{ fontSize: 19, color: COLORS.green, fontWeight: 1000, marginBottom: 10 }}>
        REAL DAILY ACCOUNT PERFORMANCE
      </div>

      <div
        style={{
          marginBottom: 12,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 8,
          background: COLORS.panel,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 7,
          }}
        >
          <Metric label="ALL REAL DAILY P&L" value={all?.dailyAccountPnL != null ? fmtMoney(all.dailyAccountPnL) : "—"} sub={all?.daily?.totalPnL != null ? "Net realized + live unrealized" : "Today net realized"} color={all?.dailyAccountPnL != null ? pnlColor(all.dailyAccountPnL) : COLORS.text} />
          <Metric label="TODAY GROSS REALIZED" value={fmtMoney(all?.daily?.realizedGross || 0)} sub="Both accounts" color={pnlColor(all?.daily?.realizedGross || 0)} />
          <Metric label="TODAY FEES" value={fmtNegativeMoney(all?.daily?.fees || 0)} sub="Both accounts" color={(all?.daily?.fees || 0) > 0 ? COLORS.red : COLORS.text} />
          <Metric label="TODAY NET REALIZED" value={fmtMoney(all?.daily?.realizedNet || 0)} sub="Both accounts" color={pnlColor(all?.daily?.realizedNet || 0)} />
          <Metric label="LIVE UNREALIZED" value={all?.daily?.unrealized != null ? fmtMoney(all.daily.unrealized) : "—"} sub={all?.daily?.unrealized != null ? `${all?.openContracts || 0} open contractIds` : "Current mark required"} color={all?.daily?.unrealized != null ? pnlColor(all.daily.unrealized) : COLORS.text} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <DailyAccountPerformance title="INTRADAY" daily={intraday?.daily || {}} accent={COLORS.greenLine} />
        <DailyAccountPerformance title="SWING" daily={swing?.daily || {}} accent={COLORS.goldLine} />
      </div>

      <div style={{ fontSize: 19, color: COLORS.green, fontWeight: 1000, marginBottom: 10 }}>
        REAL CONTRACT PERFORMANCE
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StrategyPerformance title="INTRADAY" book={intraday} accent={COLORS.greenLine} />
        <StrategyPerformance title="SWING" book={swing} accent={COLORS.goldLine} />
      </div>

      <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 8, fontWeight: 800 }}>
        Capital performance uses actual REAL broker/account truth: every valid CLOSED contract plus actual execution fees. Trading-performance statistics exclude CLOSED contracts held under 60 seconds; those contracts remain in actual P&L, equity and drawdown. Historical drawdown uses realized net equity by ES futures trading day (18:00 ET boundary). Annualized simple and compounded returns are projections from the observed sample, not realized annual returns. INTRADAY, SWING and ALL REAL use locked starting capital of $10,000 / $20,000 / $30,000.
      </div>
    </section>
  );
}
