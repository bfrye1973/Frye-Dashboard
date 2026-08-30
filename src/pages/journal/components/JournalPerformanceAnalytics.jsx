// src/pages/journal/components/JournalPerformanceAnalytics.jsx
//
// Frye Dashboard — Journal Performance Analytics
//
// PRESENTATION ONLY.
// - Campaign metrics use CLOSED campaigns only.
// - Live execution metrics use realized exit events.
// - No Engine 8/10 writes.
// - No broker calls.
// - No P&L recomputation beyond values already produced by journalAnalytics.js.
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
        border: `1px solid ${COLORS.line}`,
        borderRadius: 7,
        background: COLORS.panelAlt,
        padding: "12px 10px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
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
          fontSize: 23,
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
            fontSize: 10,
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

function SectionTitle({
  children,
  color,
  note,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 16,
          color,
          fontWeight: 1000,
        }}
      >
        {children}
      </div>

      {note ? (
        <div
          style={{
            fontSize: 10,
            color: COLORS.muted,
            fontWeight: 800,
            textAlign: "right",
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

export default function JournalPerformanceAnalytics({
  analytics,
  modeFilter = "REAL",
}) {
  const tone =
    modeFilter === "PAPER"
      ? COLORS.blue
      : COLORS.green;

  const campaignReady =
    (analytics?.closedCount || 0) > 0;

  const exitReady =
    (analytics?.totalExits || 0) > 0;

  const exitProfitFactor =
    analytics?.exitProfitFactor === Infinity
      ? "∞"
      : fmtNum(
          analytics?.exitProfitFactor
        );

  return (
    <section
      style={{
        margin: 12,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 8,
        padding: 10,
        background: COLORS.panel,
      }}
    >
      <SectionTitle
        color={tone}
        note="Campaign statistics finalize only after the entire campaign is CLOSED."
      >
        CAMPAIGN PERFORMANCE — {modeFilter} TRADING
      </SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(10, minmax(0, 1fr))",
          gap: 7,
        }}
      >
        <Metric
          label="WIN RATE"
          value={
            campaignReady
              ? fmtPct(
                  analytics?.winRate
                )
              : "—"
          }
          sub="Closed campaigns"
        />

        <Metric
          label="PROFIT FACTOR"
          value={
            campaignReady
              ? analytics?.profitFactor === Infinity
                ? "∞"
                : fmtNum(
                    analytics?.profitFactor
                  )
              : "—"
          }
          sub="Closed campaigns"
        />

        <Metric
          label="AVG WIN"
          value={
            campaignReady
              ? fmtMoney(
                  analytics?.averageWin
                )
              : "—"
          }
          sub="Per campaign"
        />

        <Metric
          label="AVG LOSS"
          value={
            campaignReady &&
            analytics?.averageLoss != null
              ? fmtNegativeMoney(
                  analytics?.averageLoss
                )
              : "—"
          }
          sub="Per campaign"
        />

        <Metric
          label="WIN/LOSS RATIO"
          value={
            campaignReady
              ? fmtNum(
                  analytics?.winLossRatio
                )
              : "—"
          }
          sub="Closed campaigns"
        />

        <Metric
          label="EXPECTANCY"
          value={
            campaignReady
              ? fmtMoney(
                  analytics?.expectancy
                )
              : "—"
          }
          sub="Per campaign"
        />

        <Metric
          label="MAX DRAWDOWN"
          value={
            campaignReady
              ? fmtNegativeMoney(
                  analytics?.maxDrawdown
                )
              : "—"
          }
          sub="Closed campaigns"
        />

        <Metric
          label="WINNING CAMPAIGN %"
          value={
            campaignReady
              ? fmtPct(
                  analytics?.winningCampaignPct
                )
              : "—"
          }
          sub="Closed campaigns"
        />

        <Metric
          label="WINNING STREAK"
          value={
            campaignReady
              ? String(
                  analytics?.currentWinStreak ?? 0
                )
              : "—"
          }
          sub="Campaigns"
        />

        <Metric
          label="LOSING STREAK"
          value={
            campaignReady
              ? String(
                  analytics?.currentLossStreak ?? 0
                )
              : "—"
          }
          sub="Campaigns"
        />
      </div>

      <div
        style={{
          borderTop: `1px solid ${COLORS.line}`,
          marginTop: 12,
          paddingTop: 12,
        }}
      >
        <SectionTitle
          color={COLORS.gold}
          note="Updates from realized partial/final exits even while the campaign remains OPEN."
        >
          LIVE EXECUTION PERFORMANCE
        </SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(8, minmax(0, 1fr))",
            gap: 7,
          }}
        >
          <Metric
            label="WINNING EXIT %"
            value={
              exitReady
                ? fmtPct(
                    analytics?.winningExitPct
                  )
                : "—"
            }
            sub={
              exitReady
                ? `${analytics?.profitableExits || 0} of ${analytics?.totalExits || 0}`
                : "No realized exits"
            }
            color={
              exitReady
                ? pnlColor(
                    analytics?.winningExitPct
                  )
                : COLORS.text
            }
          />

          <Metric
            label="PROFITABLE EXITS"
            value={
              exitReady
                ? String(
                    analytics?.profitableExits || 0
                  )
                : "—"
            }
            sub="Realized exits"
            color={
              exitReady
                ? COLORS.green
                : COLORS.text
            }
          />

          <Metric
            label="LOSING EXITS"
            value={
              exitReady
                ? String(
                    analytics?.losingExits || 0
                  )
                : "—"
            }
            sub="Realized exits"
            color={
              (analytics?.losingExits || 0) > 0
                ? COLORS.red
                : COLORS.text
            }
          />

          <Metric
            label="TOTAL EXITS"
            value={
              exitReady
                ? String(
                    analytics?.totalExits || 0
                  )
                : "—"
            }
            sub="Realized exit events"
          />

          <Metric
            label="TOTAL EXIT P&L"
            value={
              exitReady
                ? fmtMoney(
                    analytics?.totalExitPnL
                  )
                : "—"
            }
            sub="Realized exit P&L"
            color={
              exitReady
                ? pnlColor(
                    analytics?.totalExitPnL
                  )
                : COLORS.text
            }
          />

          <Metric
            label="AVG WINNING EXIT"
            value={
              exitReady
                ? fmtMoney(
                    analytics?.averageWinningExit
                  )
                : "—"
            }
            sub="Winning exits"
            color={
              analytics?.averageWinningExit != null
                ? COLORS.green
                : COLORS.text
            }
          />

          <Metric
            label="AVG LOSING EXIT"
            value={
              analytics?.averageLosingExit != null
                ? fmtNegativeMoney(
                    analytics?.averageLosingExit
                  )
                : "—"
            }
            sub="Losing exits"
            color={
              analytics?.averageLosingExit != null
                ? COLORS.red
                : COLORS.text
            }
          />

          <Metric
            label="EXIT PROFIT FACTOR"
            value={
              exitReady
                ? exitProfitFactor
                : "—"
            }
            sub="Realized exits"
          />
        </div>
      </div>
    </section>
  );
}
