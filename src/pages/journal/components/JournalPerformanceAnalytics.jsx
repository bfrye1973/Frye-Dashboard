// src/pages/journal/components/JournalPerformanceAnalytics.jsx
// Frye Dashboard — REAL Daily + Contract Performance

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
          One closed contractId = one result
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
        <Metric label="CLOSED CONTRACTS" value={String(book?.closedContracts || 0)} sub="Exact Engine 10 contractIds" />
        <Metric label="WINNING CONTRACTS" value={String(book?.winningContracts || 0)} sub="Gross realized > 0" color={hasClosed ? COLORS.green : COLORS.text} />
        <Metric label="LOSING CONTRACTS" value={String(book?.losingContracts || 0)} sub="Gross realized < 0" color={(book?.losingContracts || 0) > 0 ? COLORS.red : COLORS.text} />
        <Metric label="BREAKEVEN" value={String(book?.breakevenContracts || 0)} sub="Gross realized = 0" />
        <Metric label="CONTRACT WIN %" value={hasClosed ? fmtPct(book?.winPct) : "—"} sub="Closed contractIds only" color={hasClosed ? COLORS.green : COLORS.text} />
        <Metric label="REALIZED CONTRACT P&L" value={hasClosed ? fmtMoney(book?.grossRealizedContractPnL) : "—"} sub="All-time gross contract P&L" color={hasClosed ? pnlColor(book?.grossRealizedContractPnL) : COLORS.text} />
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
        Daily performance uses the ES futures trading day (18:00 ET boundary). Realized statistics use CLOSED Engine 10 contractIds only. Daily fees use actual REAL broker execution events deduped by brokerTransactionId; synthetic TRADE_CLOSED fee summaries are not counted again. INTRADAY and SWING never mix except in the explicit ALL REAL totals.
      </div>
    </section>
  );
}
