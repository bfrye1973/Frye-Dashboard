// src/pages/JournalFull.jsx
//
// Frye Dashboard — Full Trade Journal
//
// READ-ONLY FRONTEND
// - REAL and PAPER trading remain separate.
// - Automatic Schwab REAL fills are supported.
// - Legacy Thinkorswim imports remain supported.
// - Live futures marks are display-only.
// - Unrealized P&L is never written back to Engine 10.
//

import React, { useEffect, useMemo, useState } from "react";
import JournalPerformanceAnalytics
  from "./journal/components/JournalPerformanceAnalytics.jsx";

import {
  API_BASE,
  JOURNAL_POLL_MS,
  MARK_POLL_MS,
  COLORS,
} from "./journal/journalConstants.js";

import {
  upper,
  safeNum,
  fmtNum,
  fmtMoney,
  fmtNegativeMoney,
  fmtPct,
  pnlColor,
  toAz,
  toAzTime,
  todayKey,
} from "./journal/journalFormatters.js";

import {
  getTradeMode,
  getAccountLabel,
  normalizeMarketSymbol,
  getGrossRealized,
  getActualFees,
  getNetRealized,
  getDailyAccountPnL,
  getTradeDate,
  calculateLivePosition,
  buildEventRows,
} from "./journal/journalTradeModel.js";

import {
  calculateAnalytics,
} from "./journal/journalAnalytics.js";

/* =========================================================
   SMALL UI
========================================================= */

function FilterButton({
  active,
  tone = "neutral",
  children,
  onClick,
}) {
  const theme =
    tone === "real"
      ? {
          bg:
            COLORS.greenSoft,

          fg:
            COLORS.green,

          border:
            COLORS.greenLine,
        }
      : tone === "paper"
      ? {
          bg:
            COLORS.blueSoft,

          fg:
            COLORS.blue,

          border:
            COLORS.blueLine,
        }
      : tone === "open"
      ? {
          bg:
            COLORS.goldSoft,

          fg:
            COLORS.gold,

          border:
            COLORS.goldLine,
        }
      : {
          bg:
            COLORS.panelAlt,

          fg:
            COLORS.text,

          border:
            COLORS.line,
        };

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        minHeight: 42,
        padding:
          "0 20px",
        borderRadius: 7,
        border:
          `1px solid ${
            active
              ? theme.border
              : COLORS.line
          }`,
        background:
          active
            ? theme.bg
            : COLORS.panelAlt,
        color:
          active
            ? theme.fg
            : COLORS.text,
        fontWeight: 950,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  color =
    COLORS.text,
  sub = "",
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding:
          "11px 16px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 950,
          color:
            COLORS.muted,
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 1000,
          color,
          marginTop: 5,
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {sub ? (
        <div
          style={{
            fontSize: 11,
            color:
              COLORS.muted,
            marginTop: 6,
            fontWeight: 800,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsMetric({
  label,
  value,
  sub = "Campaigns",
}) {
  return (
    <div
      style={{
        border:
          `1px solid ${COLORS.line}`,
        borderRadius: 7,
        background:
          COLORS.panelAlt,
        padding:
          "11px 8px",
        textAlign:
          "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color:
            COLORS.text,
          fontWeight: 950,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 22,
          color:
            COLORS.text,
          fontWeight: 1000,
          marginTop: 8,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 10,
          color:
            COLORS.muted,
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

/* =========================================================
   ACCOUNT CARD
========================================================= */

function AccountCard({
  trade,
  mark,
  selected,
  onClick,
}) {
  const account =
    getAccountLabel(
      trade
    );

  const live =
    calculateLivePosition(
      trade,
      mark
    );

  const isSwing =
    account === "SWING";

  const accent =
    isSwing
      ? COLORS.gold
      : COLORS.green;

  const line =
    isSwing
      ? COLORS.goldLine
      : COLORS.greenLine;

  const background =
    isSwing
      ? "#100e08"
      : "#06140f";

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        width: "100%",
        textAlign:
          "left",
        background,
        border:
          `${selected ? 2 : 1}px solid ${
            selected
              ? COLORS.blue
              : line
          }`,
        borderRadius: 8,
        padding: 14,
        color:
          COLORS.text,
        cursor:
          "pointer",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "150px 1.2fr .8fr .8fr",
          gap: 18,
          alignItems:
            "start",
        }}
      >
        <div>
          <div
            style={{
              display:
                "inline-block",
              border:
                `1px solid ${line}`,
              color:
                accent,
              borderRadius: 6,
              padding:
                "8px 14px",
              fontSize: 18,
              fontWeight: 1000,
            }}
          >
            {account}
          </div>

          <div
            style={{
              fontSize: 32,
              fontWeight: 1000,
              marginTop: 20,
            }}
          >
            {
              live.remainingQty
            }{" "}
            <span
              style={{
                fontSize: 16,
              }}
            >
              OPEN CONTRACT
              {
                live.remainingQty ===
                1
                  ? ""
                  : "S"
              }
            </span>
          </div>

          <div
            style={{
              fontSize: 12,
              color:
                COLORS.muted,
              fontWeight: 900,
              marginTop: 16,
            }}
          >
            Remaining Avg Entry
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 1000,
            }}
          >
            {fmtNum(
              live.averageEntry
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 1000,
            }}
          >
            {account} — REAL{" "}
            <span
              style={{
                fontSize: 12,
                color:
                  COLORS.green,
                border:
                  `1px solid ${COLORS.greenLine}`,
                borderRadius: 5,
                padding:
                  "4px 8px",
              }}
            >
              OPEN
            </span>
          </div>

          <div
            style={{
              fontSize: 16,
              color:
                accent,
              fontWeight: 1000,
              marginTop: 4,
            }}
          >
            {
              normalizeMarketSymbol(
                trade
              )
            }{" "}
            {
              upper(
                trade?.direction
              )
            }
          </div>

          <div
            style={{
              border:
                `1px solid ${COLORS.line}`,
              borderRadius: 6,
              padding: 12,
              marginTop: 20,
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color:
                  COLORS.muted,
                fontWeight: 900,
              }}
            >
              CURRENT{" "}
              {
                normalizeMarketSymbol(
                  trade
                )
              }{" "}
              PRICE
            </div>

            <div
              style={{
                fontSize: 26,
                color:
                  pnlColor(
                    live.unrealizedPnL
                  ),
                fontWeight: 1000,
                marginTop: 5,
              }}
            >
              {fmtNum(
                live.mark
              )}
            </div>

            <div
              style={{
                borderTop:
                  `1px solid ${COLORS.line}`,
                marginTop: 10,
                paddingTop: 8,
                fontSize: 11,
                color:
                  COLORS.muted,
                fontWeight: 900,
              }}
            >
              UNREALIZED P&L
            </div>

            <div
              style={{
                fontSize: 22,
                color:
                  pnlColor(
                    live.unrealizedPnL
                  ),
                fontWeight: 1000,
              }}
            >
              {
                live.available
                  ? fmtMoney(
                      live
                        .unrealizedPnL
                    )
                  : "WAITING"
              }
            </div>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              color:
                COLORS.muted,
              fontWeight: 950,
            }}
          >
            GROSS REALIZED
          </div>

          <div
            style={{
              fontSize: 25,
              color:
                pnlColor(
                  getGrossRealized(
                    trade
                  )
                ),
              fontWeight: 1000,
            }}
          >
            {fmtMoney(
              getGrossRealized(
                trade
              )
            )}
          </div>

          <div
            style={{
              fontSize: 11,
              color:
                COLORS.muted,
              fontWeight: 950,
              marginTop: 16,
            }}
          >
            ACTUAL FEES
          </div>

          <div
            style={{
              fontSize: 21,
              color:
                COLORS.gold,
              fontWeight: 1000,
            }}
          >
            {fmtNegativeMoney(
              getActualFees(
                trade
              )
            )}
          </div>

          <div
            style={{
              fontSize: 11,
              color:
                COLORS.muted,
              fontWeight: 950,
              marginTop: 16,
            }}
          >
            NET REALIZED
          </div>

          <div
            style={{
              fontSize: 23,
              color:
                pnlColor(
                  getNetRealized(
                    trade
                  )
                ),
              fontWeight: 1000,
            }}
          >
            {fmtMoney(
              getNetRealized(
                trade
              )
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              color:
                COLORS.muted,
              fontWeight: 950,
            }}
          >
            DAILY ACCOUNT P&L
          </div>

          <div
            style={{
              fontSize: 25,
              color:
                pnlColor(
                  getDailyAccountPnL(
                    trade
                  )
                ),
              fontWeight: 1000,
            }}
          >
            {fmtMoney(
              getDailyAccountPnL(
                trade
              )
            )}
          </div>

          <div
            style={{
              fontSize: 11,
              color:
                COLORS.muted,
              fontWeight: 950,
              marginTop: 16,
            }}
          >
            TOTAL TRADE P&L
          </div>

          <div
            style={{
              fontSize: 25,
              color:
                pnlColor(
                  live.totalPnL
                ),
              fontWeight: 1000,
            }}
          >
            {
              live.totalPnL ==
              null
                ? "—"
                : fmtMoney(
                    live
                      .totalPnL
                  )
            }
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(6, 1fr)",
          border:
            `1px solid ${COLORS.line}`,
          borderRadius: 6,
          marginTop: 14,
        }}
      >
        {[
          [
            "ENTRY TIME",
            toAzTime(
              trade?.entry
                ?.time
            ),
          ],

          [
            "ENTRY PRICE",
            fmtNum(
              trade?.entry
                ?.price
            ),
          ],

          [
            "ORIGINAL QTY",
            trade?.qty
              ?.originalQty ??
              trade?.entry
                ?.qty ??
              "—",
          ],

          [
            "FILLED QTY",
            trade?.qty
              ?.cumulativeOpeningQuantity ??
              trade?.qty
                ?.cumulativeFilledQuantity ??
              trade?.entry
                ?.qty ??
              "—",
          ],

          [
            "REMAINING QTY",
            trade?.qty
              ?.remainingQty ??
              "—",
          ],

          [
            "DIRECTION",
            upper(
              trade?.direction
            ) || "—",
          ],
        ].map(
          ([label, value]) => (
            <div
              key={
                label
              }
              style={{
                padding:
                  "8px 10px",
                borderRight:
                  `1px solid ${COLORS.line}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color:
                    COLORS.muted,
                  fontWeight: 900,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 1000,
                  color:
                    label ===
                    "DIRECTION"
                      ? COLORS.red
                      : COLORS.text,
                  marginTop: 3,
                }}
              >
                {value}
              </div>
            </div>
          )
        )}
      </div>
    </button>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function JournalFull() {
  const [
    data,
    setData,
  ] = useState({
    ok: true,
    trades: [],
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastFetch,
    setLastFetch,
  ] = useState(null);

  const [
    modeFilter,
    setModeFilter,
  ] = useState("REAL");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    timeFilter,
    setTimeFilter,
  ] = useState("ALL");

  const [
    selectedTradeId,
    setSelectedTradeId,
  ] = useState(null);

  const [
    marks,
    setMarks,
  ] = useState({});

  /* ---------------------------------------------------------
     JOURNAL POLLING
  --------------------------------------------------------- */

  useEffect(() => {
    document.title =
      "Frye Dashboard — Full Trade Journal";

    let alive = true;
    let timer = null;

    async function pullJournal() {
      try {
        const response =
          await fetch(
            `${API_BASE}/api/v1/trade-journal`,
            {
              cache:
                "no-store",
              headers: {
                accept:
                  "application/json",
              },
            }
          );

        const json =
          await response.json();

        if (!alive) {
          return;
        }

        setData(
          json || {
            ok: true,
            trades: [],
          }
        );

        setError("");
        setLastFetch(
          new Date().toISOString()
        );
      } catch (err) {
        if (!alive) {
          return;
        }

        setError(
          String(
            err?.message ||
            err
          )
        );
      } finally {
        if (alive) {
          timer =
            setTimeout(
              pullJournal,
              JOURNAL_POLL_MS
            );
        }
      }
    }

    pullJournal();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(
          timer
        );
      }
    };
  }, []);

  const allTrades =
    Array.isArray(
      data?.trades
    )
      ? data.trades
      : [];

  const openSymbols =
    useMemo(() => {
      const symbols =
        new Set();

      for (
        const trade
        of allTrades
      ) {
        if (
          upper(
            trade?.status
          ) !== "OPEN"
        ) {
          continue;
        }

        if (
          upper(
            trade?.assetType
          ) !== "FUTURES"
        ) {
          continue;
        }

        const symbol =
          normalizeMarketSymbol(
            trade
          );

        if (symbol) {
          symbols.add(
            symbol
          );
        }
      }

      return [
        ...symbols,
      ];
    }, [allTrades]);

  /* ---------------------------------------------------------
     LIVE FUTURES MARKS
  --------------------------------------------------------- */

  useEffect(() => {
    if (
      !openSymbols.length
    ) {
      return;
    }

    let alive = true;
    let timer = null;

    async function pullMarks() {
      const next = {};

      await Promise.all(
        openSymbols.map(
          async (
            symbol
          ) => {
            try {
              const response =
                await fetch(
                  `${API_BASE}/api/v1/futures/ohlc?symbol=${encodeURIComponent(
                    symbol
                  )}&tf=1m`,
                  {
                    cache:
                      "no-store",
                  }
                );

              const json =
                await response.json();

              const rows =
                Array.isArray(
                  json
                )
                  ? json
                  : Array.isArray(
                      json?.bars
                    )
                  ? json.bars
                  : Array.isArray(
                      json?.data
                    )
                  ? json.data
                  : [];

              const last =
                rows.length
                  ? rows[
                      rows.length -
                        1
                    ]
                  : null;

              const close =
                safeNum(
                  last?.close
                ) ??
                safeNum(
                  last?.c
                );

              if (
                close != null
              ) {
                next[
                  symbol
                ] = close;
              }
            } catch {
              // Keep previous mark.
            }
          }
        )
      );

      if (!alive) {
        return;
      }

      if (
        Object.keys(
          next
        ).length
      ) {
        setMarks(
          (previous) => ({
            ...previous,
            ...next,
          })
        );
      }

      timer =
        setTimeout(
          pullMarks,
          MARK_POLL_MS
        );
    }

    pullMarks();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(
          timer
        );
      }
    };
  }, [
    openSymbols.join(
      "|"
    ),
  ]);

  /* ---------------------------------------------------------
     FILTERS
  --------------------------------------------------------- */

  const modeTrades =
    allTrades.filter(
      (trade) =>
        modeFilter ===
          "ALL" ||
        getTradeMode(
          trade
        ) === modeFilter
    );

  const timeTrades =
    modeTrades.filter(
      (trade) =>
        timeFilter ===
          "ALL" ||
        getTradeDate(
          trade
        ) === todayKey()
    );

  const filteredTrades =
    timeTrades.filter(
      (trade) =>
        statusFilter ===
          "ALL" ||
        upper(
          trade?.status
        ) === statusFilter
    );

  const openTrades =
    timeTrades.filter(
      (trade) =>
        upper(
          trade?.status
        ) === "OPEN"
    );

  const analytics =
    calculateAnalytics(
      timeTrades
    );

  /* ---------------------------------------------------------
     TOTALS
  --------------------------------------------------------- */

  const grossTotal =
    timeTrades.reduce(
      (sum, trade) =>
        sum +
        (
          getGrossRealized(
            trade
          ) || 0
        ),
      0
    );

  const feeTotal =
    timeTrades.reduce(
      (sum, trade) =>
        sum +
        (
          getActualFees(
            trade
          ) || 0
        ),
      0
    );

  const netTotal =
    timeTrades.reduce(
      (sum, trade) =>
        sum +
        (
          getNetRealized(
            trade
          ) || 0
        ),
      0
    );

  const unrealizedTotal =
    openTrades.reduce(
      (sum, trade) => {
        const symbol =
          normalizeMarketSymbol(
            trade
          );

        const live =
          calculateLivePosition(
            trade,
            marks[symbol]
          );

        return (
          sum +
          (
            live.unrealizedPnL ||
            0
          )
        );
      },
      0
    );

  const openContracts =
    openTrades.reduce(
      (sum, trade) =>
        sum +
        (
          safeNum(
            trade?.qty
              ?.remainingQty
          ) || 0
        ),
      0
    );

  const dailyAccountTotal =
    (() => {
      const seen =
        new Set();

      let total = 0;

      for (
        const trade
        of timeTrades
      ) {
        if (
          getTradeMode(
            trade
          ) !== "REAL"
        ) {
          continue;
        }

        const account =
          getAccountLabel(
            trade
          );

        const date =
          getTradeDate(
            trade
          );

        const pnl =
          getDailyAccountPnL(
            trade
          );

        if (
          !account ||
          !date ||
          pnl == null
        ) {
          continue;
        }

        const key =
          `${account}|${date}`;

        if (
          seen.has(
            key
          )
        ) {
          continue;
        }

        seen.add(
          key
        );

        total += pnl;
      }

      return total;
    })();

  /* ---------------------------------------------------------
     ACCOUNT CARDS
  --------------------------------------------------------- */

  const accountOpenTrades =
    [
      "INTRADAY",
      "SWING",
    ]
      .map(
        (account) =>
          openTrades.find(
            (trade) =>
              getAccountLabel(
                trade
              ) === account
          )
      )
      .filter(Boolean);

  /* ---------------------------------------------------------
     SELECTED TRADE
  --------------------------------------------------------- */

  const selectedTrade =
    filteredTrades.find(
      (trade) =>
        trade?.tradeId ===
        selectedTradeId
    ) ||
    filteredTrades[0] ||
    null;

  const recentRows =
    buildEventRows(
      filteredTrades
    ).slice(
      0,
      12
    );

  const headlineSymbol =
    openSymbols[0] ||
    "FUTURES";

  const headlineMark =
    marks[
      headlineSymbol
    ];

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: COLORS.page,
        color: COLORS.text,
        padding: 10,
        boxSizing: "border-box",
        overflowX: "auto",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "none",
          margin: 0,
          boxSizing: "border-box",
          border: `1px solid ${COLORS.line}`,
          background: "#040b14",
          boxShadow: "0 18px 50px rgba(0,0,0,.55)",
        }}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <header
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 180px 300px 220px",
            borderBottom:
              `1px solid ${COLORS.line}`,
            minHeight: 78,
          }}
        >
          <div
            style={{
              padding:
                "14px 20px",
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 1000,
                letterSpacing:
                  ".02em",
              }}
            >
              ▣ FULL TRADE JOURNAL
            </div>

            <div
              style={{
                fontSize: 13,
                color:
                  COLORS.muted,
                fontWeight: 800,
              }}
            >
              All your trades. All accounts. Complete performance.
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderLeft:
                `1px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 1000,
              }}
            >
              {headlineSymbol}
            </div>

            <div
              style={{
                fontSize: 11,
                color:
                  COLORS.muted,
              }}
            >
              LIVE MARKET
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderLeft:
                `1px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color:
                  COLORS.muted,
                fontWeight: 900,
              }}
            >
              CURRENT PRICE
            </div>

            <div
              style={{
                fontSize: 27,
                fontWeight: 1000,
                color:
                  COLORS.green,
              }}
            >
              {fmtNum(
                headlineMark
              )}
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderLeft:
                `1px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color:
                  COLORS.muted,
                fontWeight: 900,
              }}
            >
              LAST UPDATED
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 1000,
              }}
            >
              {lastFetch
                ? toAzTime(
                    lastFetch
                  )
                : "—"}
            </div>

            <div
              style={{
                fontSize: 11,
                color:
                  error
                    ? COLORS.red
                    : COLORS.green,
                fontWeight: 900,
              }}
            >
              {error
                ? "ERROR"
                : "LIVE"}
            </div>
          </div>
        </header>

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 12,
            padding: 12,
            borderBottom:
              `1px solid ${COLORS.line}`,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            <FilterButton
              active={
                modeFilter ===
                "REAL"
              }
              tone="real"
              onClick={() =>
                setModeFilter(
                  "REAL"
                )
              }
            >
              ▥ REAL TRADING
            </FilterButton>

            <FilterButton
              active={
                modeFilter ===
                "PAPER"
              }
              tone="paper"
              onClick={() =>
                setModeFilter(
                  "PAPER"
                )
              }
            >
              ▣ PAPER TRADING
            </FilterButton>

            <FilterButton
              active={
                modeFilter ===
                "ALL"
              }
              onClick={() =>
                setModeFilter(
                  "ALL"
                )
              }
            >
              ◉ ALL TRADES
            </FilterButton>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            <FilterButton
              active={
                timeFilter ===
                "ALL"
              }
              onClick={() =>
                setTimeFilter(
                  "ALL"
                )
              }
            >
              ▣ ALL TIME
            </FilterButton>

            <FilterButton
              active={
                timeFilter ===
                "TODAY"
              }
              onClick={() =>
                setTimeFilter(
                  "TODAY"
                )
              }
            >
              ▣ TODAY
            </FilterButton>

            <FilterButton
              active={
                statusFilter ===
                "OPEN"
              }
              tone="open"
              onClick={() =>
                setStatusFilter(
                  statusFilter ===
                    "OPEN"
                    ? "ALL"
                    : "OPEN"
                )
              }
            >
              ⊙ OPEN
            </FilterButton>

            <FilterButton
              active={
                statusFilter ===
                "CLOSED"
              }
              onClick={() =>
                setStatusFilter(
                  statusFilter ===
                    "CLOSED"
                    ? "ALL"
                    : "CLOSED"
                )
              }
            >
              ◉ CLOSED
            </FilterButton>
          </div>
        </div>

        {/* =================================================
            SUMMARY STRIP
        ================================================= */}

        <section
          style={{
            margin: 12,
            border:
              `1px solid ${
                modeFilter ===
                "PAPER"
                  ? COLORS.blueLine
                  : COLORS.greenLine
              }`,
            borderRadius: 8,
            background:
              modeFilter ===
              "PAPER"
                ? COLORS.blueSoft
                : COLORS.greenSoft,
          }}
        >
          <div
            style={{
              padding:
                "10px 14px",
              fontSize: 18,
              color:
                modeFilter ===
                "PAPER"
                  ? COLORS.blue
                  : COLORS.green,
              fontWeight: 1000,
            }}
          >
            {modeFilter ===
            "PAPER"
              ? "▣ PAPER TRADING"
              : "▥ REAL TRADING"}

            {timeFilter ===
            "TODAY"
              ? " — TODAY"
              : ""}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.25fr repeat(7, 1fr)",
              borderTop:
                `1px solid ${COLORS.line}`,
            }}
          >
            <SummaryMetric
              label={
                modeFilter ===
                "REAL"
                  ? "DAILY ACCOUNT P&L"
                  : "PAPER NET P&L"
              }
              value={
                modeFilter ===
                "REAL"
                  ? fmtMoney(
                      dailyAccountTotal
                    )
                  : fmtMoney(
                      netTotal
                    )
              }
              color={
                pnlColor(
                  modeFilter ===
                    "REAL"
                    ? dailyAccountTotal
                    : netTotal
                )
              }
            />

            <SummaryMetric
              label="GROSS REALIZED"
              value={fmtMoney(
                grossTotal
              )}
              color={pnlColor(
                grossTotal
              )}
            />

            <SummaryMetric
              label="ACTUAL FEES"
              value={
                feeTotal
                  ? fmtNegativeMoney(
                      feeTotal
                    )
                  : "—"
              }
              color={
                COLORS.gold
              }
            />

            <SummaryMetric
              label="NET REALIZED"
              value={fmtMoney(
                netTotal
              )}
              color={pnlColor(
                netTotal
              )}
            />

            <SummaryMetric
              label="LIVE UNREALIZED"
              value={fmtMoney(
                unrealizedTotal
              )}
              color={pnlColor(
                unrealizedTotal
              )}
            />

            <SummaryMetric
              label="TOTAL TRADE P&L"
              value={fmtMoney(
                netTotal +
                unrealizedTotal
              )}
              color={pnlColor(
                netTotal +
                unrealizedTotal
              )}
            />

            <SummaryMetric
              label="OPEN CAMPAIGNS"
              value={
                openTrades.length
              }
            />

            <SummaryMetric
              label="OPEN CONTRACTS"
              value={
                openContracts
              }
            />
          </div>
        </section>

        {/* =================================================
            REAL ACCOUNT CARDS
        ================================================= */}

        {modeFilter !==
          "PAPER" &&
        accountOpenTrades.length ? (
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                accountOpenTrades.length >
                1
                  ? "1fr 1fr"
                  : "1fr",
              gap: 12,
              margin: 12,
            }}
          >
            {accountOpenTrades.map(
              (trade) => {
                const symbol =
                  normalizeMarketSymbol(
                    trade
                  );

                return (
                  <AccountCard
                    key={
                      trade.tradeId
                    }
                    trade={
                      trade
                    }
                    mark={
                      marks[
                        symbol
                      ]
                    }
                    selected={
                      selectedTrade
                        ?.tradeId ===
                      trade.tradeId
                    }
                    onClick={() =>
                      setSelectedTradeId(
                        trade.tradeId
                      )
                    }
                  />
                );
              }
            )}
          </section>
        ) : null}

        <JournalPerformanceAnalytics
          analytics={analytics}
          modeFilter={modeFilter}
        />

        {/* =================================================
            RECENT EXECUTIONS
        ================================================= */}

        <section
          style={{
            margin: 12,
            border:
              `1px solid ${COLORS.line}`,
            borderRadius: 8,
            overflow:
              "hidden",
            background:
              COLORS.panel,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              padding:
                "10px 12px",
              fontWeight: 1000,
            }}
          >
            <span>
              RECENT TRADES / EXECUTIONS
            </span>

            <span
              style={{
                fontSize: 11,
                color:
                  COLORS.muted,
              }}
            >
              Showing {
                recentRows.length
              } recent events
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "130px 120px 1.7fr 100px 100px 150px 120px 90px 140px 120px",
              background:
                COLORS.panelAlt,
              borderTop:
                `1px solid ${COLORS.line}`,
              borderBottom:
                `1px solid ${COLORS.line}`,
              fontSize: 10,
              color:
                COLORS.muted,
              fontWeight: 950,
              padding:
                "7px 10px",
            }}
          >
            {[
              "TIME",
              "ACCOUNT",
              "TRADE ID",
              "SYMBOL",
              "DIRECTION",
              "EVENT",
              "PRICE",
              "QTY",
              "REALIZED P&L",
              "STATUS",
            ].map(
              (label) => (
                <div
                  key={
                    label
                  }
                >
                  {label}
                </div>
              )
            )}
          </div>

          {recentRows.length ? (
            recentRows.map(
              (
                {
                  trade,
                  event,
                },
                index
              ) => {
                const eventPnl =
                  safeNum(
                    event
                      ?.netEventRealizedPnL
                  ) ??
                  safeNum(
                    event
                      ?.grossEventRealizedPnL
                  ) ??
                  safeNum(
                    event
                      ?.eventRealizedPnL
                  );

                return (
                  <button
                    key={`${event?.ts}-${index}`}
                    type="button"
                    onClick={() =>
                      setSelectedTradeId(
                        trade.tradeId
                      )
                    }
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns:
                        "130px 120px 1.7fr 100px 100px 150px 120px 90px 140px 120px",
                      padding:
                        "8px 10px",
                      border: 0,
                      borderBottom:
                        `1px solid ${COLORS.lineSoft}`,
                      background:
                        selectedTrade
                          ?.tradeId ===
                        trade.tradeId
                          ? COLORS.panelSelected
                          : COLORS.panel,
                      color:
                        COLORS.text,
                      textAlign:
                        "left",
                      fontSize: 12,
                      fontWeight: 850,
                      cursor:
                        "pointer",
                    }}
                  >
                    <div>
                      {toAzTime(
                        event?.ts
                      )}
                    </div>

                    <div
                      style={{
                        color:
                          getAccountLabel(
                            trade
                          ) ===
                          "SWING"
                            ? COLORS.gold
                            : COLORS.green,
                      }}
                    >
                      {getAccountLabel(
                        trade
                      )}
                    </div>

                    <div>
                      {trade.tradeId}
                    </div>

                    <div>
                      {normalizeMarketSymbol(
                        trade
                      )}
                    </div>

                    <div
                      style={{
                        color:
                          COLORS.red,
                      }}
                    >
                      {upper(
                        trade?.direction
                      )}
                    </div>

                    <div>
                      {event?.eventType ||
                        "—"}
                    </div>

                    <div>
                      {fmtNum(
                        event?.price
                      )}
                    </div>

                    <div>
                      {event
                        ?.fillQuantity ??
                        event?.qtyClosed ??
                        "—"}
                    </div>

                    <div
                      style={{
                        color:
                          pnlColor(
                            eventPnl
                          ),
                      }}
                    >
                      {fmtMoney(
                        eventPnl
                      )}
                    </div>

                    <div
                      style={{
                        color:
                          upper(
                            trade?.status
                          ) ===
                          "OPEN"
                            ? COLORS.green
                            : COLORS.blue,
                      }}
                    >
                      {upper(
                        trade?.status
                      )}
                    </div>
                  </button>
                );
              }
            )
          ) : (
            <div
              style={{
                padding: 20,
                color:
                  COLORS.muted,
              }}
            >
              No trades for these filters.
            </div>
          )}
        </section>

        {/* =================================================
            SELECTED TRADE
        ================================================= */}

        {selectedTrade ? (
          <section
            style={{
              margin: 12,
              border:
                `1px solid ${COLORS.line}`,
              borderRadius: 8,
              padding: 14,
              background:
                COLORS.panel,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 1000,
                  }}
                >
                  SELECTED TRADE — {
                    getAccountLabel(
                      selectedTrade
                    )
                  } / {
                    normalizeMarketSymbol(
                      selectedTrade
                    )
                  } {
                    upper(
                      selectedTrade
                        ?.direction
                    )
                  }
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color:
                      COLORS.muted,
                    marginTop: 3,
                  }}
                >
                  {
                    selectedTrade
                      .tradeId
                  }
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 1000,
                  color:
                    upper(
                      selectedTrade
                        ?.status
                    ) ===
                    "OPEN"
                      ? COLORS.green
                      : COLORS.blue,
                }}
              >
                {upper(
                  selectedTrade
                    ?.status
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(6, 1fr)",
                gap: 8,
                marginTop: 12,
              }}
            >
              <AnalyticsMetric
                label="ENTRY"
                value={fmtNum(
                  selectedTrade
                    ?.entry?.price
                )}
                sub={toAz(
                  selectedTrade
                    ?.entry?.time,
                  true
                )}
              />

              <AnalyticsMetric
                label="REMAINING"
                value={String(
                  selectedTrade
                    ?.qty
                    ?.remainingQty ??
                    "—"
                )}
                sub="Contracts"
              />

              <AnalyticsMetric
                label="GROSS REALIZED"
                value={fmtMoney(
                  getGrossRealized(
                    selectedTrade
                  )
                )}
                sub="Trade P&L"
              />

              <AnalyticsMetric
                label="ACTUAL FEES"
                value={fmtNegativeMoney(
                  getActualFees(
                    selectedTrade
                  )
                )}
                sub="Broker fees"
              />

              <AnalyticsMetric
                label="NET REALIZED"
                value={fmtMoney(
                  getNetRealized(
                    selectedTrade
                  )
                )}
                sub="After fees"
              />

              <AnalyticsMetric
                label="DAILY ACCOUNT P&L"
                value={fmtMoney(
                  getDailyAccountPnL(
                    selectedTrade
                  )
                )}
                sub={getAccountLabel(
                  selectedTrade
                )}
              />
            </div>
          </section>
        ) : null}

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            padding:
              "10px 14px",
            borderTop:
              `1px solid ${COLORS.line}`,
            fontSize: 11,
            color:
              COLORS.muted,
          }}
        >
          <span>
            ◈ All times are Arizona (America/Phoenix) • Journal polls every 15s • Futures marks every 5s
          </span>

          <i>
            This is your complete trading history. Review, learn, improve.
          </i>
        </footer>
      </div>
    </div>
  );
}
