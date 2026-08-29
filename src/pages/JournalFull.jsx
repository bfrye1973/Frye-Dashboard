// src/pages/JournalFull.jsx
//
// Full Trade Journal
//
// ✅ Separates REAL TRADING from PAPER TRADING
// ✅ Keeps REAL and PAPER totals completely separate
// ✅ Polls Engine 10 Journal
// ✅ Polls live futures marks for OPEN futures trades
// ✅ Calculates live unrealized P&L without modifying Journal history
// ✅ Shows open contracts prominently
// ✅ Shows Thinkorswim account-level daily P&L
// ✅ Keeps trade history / execution events / setup details
//
// IMPORTANT:
// - This page is READ-ONLY.
// - It does NOT place orders.
// - It does NOT modify Engine 8.
// - It does NOT write unrealized P&L into trade-journal.json.
//

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "https://frye-market-backend-1.onrender.com";
const AZ_TZ = "America/Phoenix";

const JOURNAL_POLL_MS = 15000;
const MARK_POLL_MS = 5000;

/* =========================================================
   API
========================================================= */

function normalizeApiBase(x) {
  const raw = String(x || "").trim();

  if (!raw) {
    return "https://frye-market-backend-1.onrender.com";
  }

  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");

  return out;
}

const BASE = normalizeApiBase(API_BASE);

/* =========================================================
   FORMATTERS
========================================================= */

function toAz(iso, withSeconds = false) {
  if (!iso) return "—";

  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: AZ_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
    });
  } catch {
    return String(iso);
  }
}

function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(value, digits = 2) {
  const n = safeNum(value);
  return n == null ? "—" : n.toFixed(digits);
}

function fmtMoney(value) {
  const n = safeNum(value);

  if (n == null) return "—";

  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

function fmtSigned(value, digits = 2) {
  const n = safeNum(value);

  if (n == null) return "—";

  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

/* =========================================================
   TRADE MODE
========================================================= */

function getTradeMode(trade) {
  if (
    upper(trade?.source) === "THINKORSWIM_IMPORT" ||
    upper(trade?.accountMode) === "LIVE"
  ) {
    return "REAL";
  }

  if (upper(trade?.accountMode) === "PAPER") {
    return "PAPER";
  }

  return "OTHER";
}

/* =========================================================
   FUTURES
========================================================= */

function normalizeMarketSymbol(trade) {
  const direct = upper(trade?.symbol);

  if (direct) {
    return direct
      .replace(/^\//, "")
      .replace(/[A-Z]\d{1,2}$/, "");
  }

  const broker = upper(trade?.brokerSymbol);

  if (broker.startsWith("/MES")) return "MES";
  if (broker.startsWith("/ES")) return "ES";

  return direct || null;
}

function fallbackDollarsPerPoint(symbol) {
  switch (upper(symbol)) {
    case "MES":
      return 5;

    case "ES":
      return 50;

    case "MNQ":
      return 2;

    case "NQ":
      return 20;

    case "MYM":
      return 0.5;

    case "YM":
      return 5;

    case "M2K":
      return 5;

    case "RTY":
      return 50;

    default:
      return null;
  }
}

function getDollarsPerPoint(trade) {
  const values = [
    trade?.brokerImport?.dollarsPerPoint,
    trade?.riskBasis?.dollarsPerPoint,
    fallbackDollarsPerPoint(normalizeMarketSymbol(trade)),
  ];

  for (const value of values) {
    const n = safeNum(value);

    if (n != null && n > 0) {
      return n;
    }
  }

  return null;
}

/* =========================================================
   LIVE POSITION CALCULATION
========================================================= */

function calculateLivePosition(trade, mark) {
  const status = upper(trade?.status);
  const direction = upper(trade?.direction);

  const remainingQty =
    safeNum(trade?.qty?.remainingQty) ?? 0;

  const realizedPnL =
    safeNum(trade?.summary?.realizedPnL) ?? 0;

  if (
    status !== "OPEN" ||
    remainingQty <= 0
  ) {
    return {
      available: false,
      remainingQty,
      mark: safeNum(mark),
      averageEntry: null,
      unrealizedPoints: 0,
      unrealizedPnL: 0,
      realizedPnL,
      totalTradePnL: realizedPnL,
      dollarsPerPoint: getDollarsPerPoint(trade),
    };
  }

  const currentMark = safeNum(mark);
  const dollarsPerPoint = getDollarsPerPoint(trade);

  if (
    currentMark == null ||
    dollarsPerPoint == null
  ) {
    return {
      available: false,
      remainingQty,
      mark: currentMark,
      averageEntry:
        safeNum(
          trade?.brokerImport?.remainingAverageEntry
        ) ??
        safeNum(trade?.entry?.price),
      unrealizedPoints: null,
      unrealizedPnL: null,
      realizedPnL,
      totalTradePnL: null,
      dollarsPerPoint,
    };
  }

  const lots = Array.isArray(
    trade?.brokerImport?.remainingLots
  )
    ? trade.brokerImport.remainingLots
    : [];

  let unrealizedPoints = 0;
  let weightedEntrySum = 0;
  let weightedQty = 0;

  if (lots.length) {
    for (const lot of lots) {
      const qty = safeNum(lot?.qty) ?? 0;
      const entryPrice = safeNum(lot?.price);

      if (
        qty <= 0 ||
        entryPrice == null
      ) {
        continue;
      }

      const points =
        direction === "SHORT"
          ? entryPrice - currentMark
          : currentMark - entryPrice;

      unrealizedPoints += points * qty;
      weightedEntrySum += entryPrice * qty;
      weightedQty += qty;
    }
  } else {
    const entryPrice =
      safeNum(
        trade?.brokerImport?.remainingAverageEntry
      ) ??
      safeNum(trade?.entry?.price);

    if (entryPrice != null) {
      const points =
        direction === "SHORT"
          ? entryPrice - currentMark
          : currentMark - entryPrice;

      unrealizedPoints =
        points * remainingQty;

      weightedEntrySum =
        entryPrice * remainingQty;

      weightedQty =
        remainingQty;
    }
  }

  const averageEntry =
    weightedQty > 0
      ? weightedEntrySum / weightedQty
      : null;

  const unrealizedPnL =
    unrealizedPoints * dollarsPerPoint;

  return {
    available: true,
    remainingQty,
    mark: currentMark,
    averageEntry,
    unrealizedPoints,
    unrealizedPnL,
    realizedPnL,
    totalTradePnL:
      realizedPnL + unrealizedPnL,
    dollarsPerPoint,
  };
}

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  real: {
    bg: "#071b13",
    fg: "#86efac",
    bd: "#15803d",
  },

  paper: {
    bg: "#0b1730",
    fg: "#93c5fd",
    bd: "#2563eb",
  },

  neutral: {
    bg: "#0b0b0b",
    fg: "#94a3b8",
    bd: "#2b2b2b",
  },

  open: {
    bg: "#1b1409",
    fg: "#fbbf24",
    bd: "#92400e",
  },

  closed: {
    bg: "#06220f",
    fg: "#86efac",
    bd: "#166534",
  },

  loss: {
    bg: "#2b0b0b",
    fg: "#fca5a5",
    bd: "#7f1d1d",
  },
};

function statusTone(status) {
  const s = upper(status);

  if (s === "CLOSED") return COLORS.closed;
  if (s === "OPEN") return COLORS.open;
  if (s === "CANCELLED") return COLORS.loss;

  return COLORS.neutral;
}

function resultTone(result) {
  const r = upper(result);

  if (r === "WIN") return COLORS.closed;
  if (r === "LOSS") return COLORS.loss;

  if (r === "BREAKEVEN") {
    return {
      bg: "#111827",
      fg: "#cbd5e1",
      bd: "#334155",
    };
  }

  return COLORS.neutral;
}

function eventTone(type) {
  const t = upper(type);

  if (t === "ENTRY_FILLED") {
    return {
      bg: "#111827",
      fg: "#93c5fd",
      bd: "#334155",
    };
  }

  if (
    t === "PARTIAL_CLOSE" ||
    t === "BLOCK_1_EXIT" ||
    t === "BLOCK_2_EXIT" ||
    t === "TARGET_EXIT"
  ) {
    return COLORS.open;
  }

  if (
    t === "FULL_CLOSE" ||
    t === "FINAL_EXIT" ||
    t === "TRADE_CLOSED"
  ) {
    return COLORS.closed;
  }

  if (
    t === "STOP_HIT" ||
    t === "STOP_EXIT"
  ) {
    return COLORS.loss;
  }

  return COLORS.neutral;
}

function pnlColor(value) {
  const n = safeNum(value);

  if (n == null) return "#cbd5e1";
  if (n > 0) return "#86efac";
  if (n < 0) return "#fca5a5";

  return "#cbd5e1";
}

/* =========================================================
   SMALL UI
========================================================= */

function Pill({
  text,
  tone,
  fontSize = 16,
}) {
  const t = tone || COLORS.neutral;

  return (
    <span
      style={{
        fontSize,
        fontWeight: 1000,
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}
    >
      {text}
    </span>
  );
}

function SectionCard({
  title,
  children,
  style = {},
}) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 16,
        background: "#0b0b0b",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          fontWeight: 1000,
          color: "#93c5fd",
          fontSize: 17,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}

function KV({
  k,
  v,
  color = "#e5e7eb",
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "165px 1fr",
        gap: 10,
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 1000,
          color: "#9ca3af",
        }}
      >
        {k}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          color,
          wordBreak: "break-word",
          lineHeight: 1.25,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function BigMetric({
  label,
  value,
  sub = "",
  valueColor = "#e5e7eb",
}) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: 14,
        background: "#0b0b0b",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#9ca3af",
          fontSize: 14,
          fontWeight: 1000,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          color: valueColor,
          fontSize: 25,
          fontWeight: 1000,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      {sub ? (
        <div
          style={{
            marginTop: 5,
            color: "#64748b",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   MODE / STATUS BUTTON
========================================================= */

function FilterButton({
  active,
  children,
  onClick,
  tone = COLORS.neutral,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background:
          active
            ? tone.bg
            : "#0b0b0b",

        color:
          active
            ? tone.fg
            : "#cbd5e1",

        border:
          active
            ? `1px solid ${tone.bd}`
            : "1px solid #2b2b2b",

        borderRadius: 10,
        padding: "8px 14px",
        fontWeight: 1000,
        fontSize: 15,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* =========================================================
   OPEN POSITION CARD
========================================================= */

function OpenPositionCard({
  trade,
  mark,
  selected,
  onClick,
}) {
  const mode = getTradeMode(trade);
  const live = calculateLivePosition(
    trade,
    mark
  );

  const account =
    trade?.brokerImport?.accountAlias ||
    (mode === "PAPER"
      ? "FRYE PAPER"
      : trade?.accountMode || "—");

  const symbol =
    normalizeMarketSymbol(trade) ||
    trade?.symbol ||
    "—";

  const modeTone =
    mode === "REAL"
      ? COLORS.real
      : COLORS.paper;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        border:
          selected
            ? "2px solid #3b82f6"
            : `1px solid ${modeTone.bd}`,

        borderRadius: 14,
        padding: 16,
        background:
          selected
            ? "#111827"
            : modeTone.bg,

        cursor: "pointer",
        color: "#e5e7eb",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 1000,
            }}
          >
            {account}
          </div>

          <div
            style={{
              color: "#cbd5e1",
              fontSize: 16,
              fontWeight: 900,
              marginTop: 3,
            }}
          >
            {symbol} {trade?.direction || "—"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <Pill
            text={mode}
            tone={modeTone}
          />

          <Pill
            text="OPEN"
            tone={COLORS.open}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0,1fr))",
          gap: 10,
        }}
      >
        <BigMetric
          label="Open Contracts"
          value={live.remainingQty}
        />

        <BigMetric
          label="Remaining Avg"
          value={fmtNum(live.averageEntry)}
        />

        <BigMetric
          label={`Current ${symbol}`}
          value={fmtNum(live.mark)}
        />

        <BigMetric
          label="Open P&L"
          value={
            live.available
              ? fmtMoney(live.unrealizedPnL)
              : "WAITING"
          }
          valueColor={pnlColor(
            live.unrealizedPnL
          )}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0,1fr))",
          gap: 10,
        }}
      >
        <BigMetric
          label="Open Points"
          value={
            live.available
              ? fmtSigned(
                  live.unrealizedPoints
                )
              : "—"
          }
          valueColor={pnlColor(
            live.unrealizedPoints
          )}
        />

        <BigMetric
          label="Realized"
          value={fmtMoney(
            trade?.summary?.realizedPnL
          )}
          valueColor={pnlColor(
            trade?.summary?.realizedPnL
          )}
        />

        <BigMetric
          label="Total Trade P&L"
          value={
            live.totalTradePnL == null
              ? "—"
              : fmtMoney(
                  live.totalTradePnL
                )
          }
          valueColor={pnlColor(
            live.totalTradePnL
          )}
        />

        <BigMetric
          label={
            mode === "REAL"
              ? "Daily Account P&L"
              : "Net Realized"
          }
          value={
            mode === "REAL"
              ? fmtMoney(
                  trade?.summary
                    ?.dailyAccountPnL
                )
              : fmtMoney(
                  trade?.summary
                    ?.realizedPnL
                )
          }
          valueColor={pnlColor(
            mode === "REAL"
              ? trade?.summary
                  ?.dailyAccountPnL
              : trade?.summary
                  ?.realizedPnL
          )}
        />
      </div>
    </button>
  );
}

/* =========================================================
   TRADE HISTORY ROW
========================================================= */

function TradeRow({
  trade,
  selected,
  onClick,
  mark,
}) {
  const st = statusTone(trade?.status);
  const rt = resultTone(trade?.result);

  const mode = getTradeMode(trade);

  const modeTone =
    mode === "REAL"
      ? COLORS.real
      : mode === "PAPER"
      ? COLORS.paper
      : COLORS.neutral;

  const live = calculateLivePosition(
    trade,
    mark
  );

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background:
          selected
            ? "#111827"
            : "#0b0b0b",

        border:
          selected
            ? "1px solid #3b82f6"
            : "1px solid #1f2937",

        borderRadius: 14,
        padding: 14,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      title={trade?.tradeId}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 1000,
              color: "#e5e7eb",
            }}
          >
            {trade?.symbol || "—"} •{" "}
            {trade?.strategyId || "—"}
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#9ca3af",
              fontWeight: 800,
              marginTop: 3,
            }}
          >
            {toAz(
              trade?.createdAt,
              true
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <Pill
            text={mode}
            tone={modeTone}
            fontSize={14}
          />

          <Pill
            text={trade?.direction || "—"}
            tone={{
              bg: "#111827",
              fg: "#93c5fd",
              bd: "#334155",
            }}
            fontSize={14}
          />

          <Pill
            text={trade?.status || "UNKNOWN"}
            tone={st}
            fontSize={14}
          />

          {trade?.result ? (
            <Pill
              text={trade.result}
              tone={rt}
              fontSize={14}
            />
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(6, minmax(0,1fr))",
          gap: 8,
          fontSize: 14,
          color: "#cbd5e1",
        }}
      >
        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Qty:
          </span>{" "}
          <b>
            {trade?.entry?.qty ?? "—"}
          </b>
        </div>

        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Remain:
          </span>{" "}
          <b>
            {trade?.qty?.remainingQty ??
              "—"}
          </b>
        </div>

        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Entry:
          </span>{" "}
          <b>
            {fmtNum(
              trade?.entry?.price
            )}
          </b>
        </div>

        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Realized:
          </span>{" "}
          <b
            style={{
              color: pnlColor(
                trade?.summary
                  ?.realizedPnL
              ),
            }}
          >
            {fmtMoney(
              trade?.summary
                ?.realizedPnL
            )}
          </b>
        </div>

        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Open P&L:
          </span>{" "}
          <b
            style={{
              color: pnlColor(
                live.unrealizedPnL
              ),
            }}
          >
            {upper(trade?.status) ===
            "OPEN"
              ? live.available
                ? fmtMoney(
                    live.unrealizedPnL
                  )
                : "—"
              : "—"}
          </b>
        </div>

        <div>
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 1000,
            }}
          >
            Total:
          </span>{" "}
          <b
            style={{
              color: pnlColor(
                live.totalTradePnL
              ),
            }}
          >
            {fmtMoney(
              live.totalTradePnL
            )}
          </b>
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   EVENT LIST
========================================================= */

function EventList({
  events,
}) {
  const rows = Array.isArray(events)
    ? events
    : [];

  if (!rows.length) {
    return (
      <div
        style={{
          color: "#94a3b8",
          fontSize: 16,
        }}
      >
        No events.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {rows.map((ev, i) => {
        const tone =
          eventTone(ev?.eventType);

        return (
          <div
            key={`${ev?.ts || "na"}-${i}`}
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: 10,
              background: "#111827",
              display: "grid",
              gridTemplateColumns:
                "190px 1fr 135px 135px 135px 150px 150px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Pill
              text={
                ev?.eventType ||
                "UNKNOWN"
              }
              tone={tone}
              fontSize={14}
            />

            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: "#cbd5e1",
              }}
            >
              {toAz(ev?.ts, true)}
            </div>

            <div
              style={{
                fontSize: 15,
                color: "#e5e7eb",
                fontWeight: 900,
              }}
            >
              price:{" "}
              {fmtNum(ev?.price)}
            </div>

            <div
              style={{
                fontSize: 15,
                color: "#e5e7eb",
                fontWeight: 900,
              }}
            >
              qtyClosed:{" "}
              {ev?.qtyClosed ?? "—"}
            </div>

            <div
              style={{
                fontSize: 15,
                color: "#e5e7eb",
                fontWeight: 900,
              }}
            >
              remain:{" "}
              {ev?.remainingQty ??
                "—"}
            </div>

            <div
              style={{
                fontSize: 15,
                color: pnlColor(
                  ev?.eventRealizedPoints
                ),
                fontWeight: 900,
              }}
            >
              points:{" "}
              {fmtSigned(
                ev?.eventRealizedPoints
              )}
            </div>

            <div
              style={{
                fontSize: 15,
                color: pnlColor(
                  ev?.eventRealizedPnL
                ),
                fontWeight: 900,
              }}
            >
              pnl:{" "}
              {fmtMoney(
                ev?.eventRealizedPnL
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function JournalFull() {
  const journalUrl = useMemo(
    () =>
      `${BASE}/api/v1/trade-journal`,
    []
  );

  const [data, setData] = useState({
    ok: true,
    trades: [],
  });

  const [err, setErr] = useState("");
  const [loading, setLoading] =
    useState(true);

  const [lastFetch, setLastFetch] =
    useState(null);

  const [selectedTradeId, setSelectedTradeId] =
    useState(null);

  const [modeFilter, setModeFilter] =
    useState("REAL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [marks, setMarks] =
    useState({});

  const [markTimes, setMarkTimes] =
    useState({});

  /* ---------------------------------------------------------
     JOURNAL POLLING
  --------------------------------------------------------- */

  useEffect(() => {
    document.title =
      "Frye Dashboard — Full Journal";

    let alive = true;
    let timer = null;

    async function pull() {
      try {
        const res = await fetch(
          journalUrl,
          {
            cache: "no-store",
            headers: {
              accept:
                "application/json",
              "Cache-Control":
                "no-store",
            },
          }
        );

        const json =
          await res.json();

        if (!alive) return;

        setData(
          json || {
            ok: true,
            trades: [],
          }
        );

        setErr("");
        setLastFetch(
          new Date().toISOString()
        );

        const trades =
          Array.isArray(
            json?.trades
          )
            ? json.trades
            : [];

        if (trades.length) {
          setSelectedTradeId(
            (prev) =>
              prev ||
              trades[0]?.tradeId ||
              null
          );
        }
      } catch (e) {
        if (!alive) return;

        setErr(
          String(
            e?.message || e
          )
        );
      } finally {
        if (!alive) return;

        setLoading(false);

        timer = setTimeout(
          pull,
          JOURNAL_POLL_MS
        );
      }
    }

    pull();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [journalUrl]);

  /* ---------------------------------------------------------
     TRADES
  --------------------------------------------------------- */

  const allTrades =
    Array.isArray(data?.trades)
      ? data.trades
      : [];

  const openFuturesSymbols =
    useMemo(() => {
      const set = new Set();

      for (const trade of allTrades) {
        if (
          upper(trade?.status) !==
          "OPEN"
        ) {
          continue;
        }

        if (
          upper(trade?.assetType) !==
          "FUTURES"
        ) {
          continue;
        }

        const symbol =
          normalizeMarketSymbol(
            trade
          );

        if (symbol) {
          set.add(symbol);
        }
      }

      return [...set];
    }, [allTrades]);

  /* ---------------------------------------------------------
     LIVE FUTURES MARK POLLING
  --------------------------------------------------------- */

  useEffect(() => {
    if (!openFuturesSymbols.length) {
      return;
    }

    let alive = true;
    let timer = null;

    async function pullMarks() {
      const nextMarks = {};
      const nextTimes = {};

      await Promise.all(
        openFuturesSymbols.map(
          async (symbol) => {
            try {
              const url =
                `${BASE}/api/v1/futures/ohlc` +
                `?symbol=${encodeURIComponent(
                  symbol
                )}&tf=1m`;

              const res =
                await fetch(url, {
                  cache: "no-store",
                  headers: {
                    accept:
                      "application/json",
                    "Cache-Control":
                      "no-store",
                  },
                });

              const json =
                await res.json();

              const rows =
                Array.isArray(json)
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
                      rows.length - 1
                    ]
                  : null;

              const close =
                safeNum(
                  last?.close
                ) ??
                safeNum(last?.c);

              if (close != null) {
                nextMarks[
                  symbol
                ] = close;

                nextTimes[
                  symbol
                ] =
                  new Date().toISOString();
              }
            } catch {
              // Keep previous mark.
            }
          }
        )
      );

      if (!alive) return;

      if (
        Object.keys(nextMarks)
          .length
      ) {
        setMarks((prev) => ({
          ...prev,
          ...nextMarks,
        }));

        setMarkTimes(
          (prev) => ({
            ...prev,
            ...nextTimes,
          })
        );
      }

      timer = setTimeout(
        pullMarks,
        MARK_POLL_MS
      );
    }

    pullMarks();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    openFuturesSymbols.join("|"),
  ]);

  /* ---------------------------------------------------------
     MODE SPLITS
  --------------------------------------------------------- */

  const realTrades =
    allTrades.filter(
      (trade) =>
        getTradeMode(trade) ===
        "REAL"
    );

  const paperTrades =
    allTrades.filter(
      (trade) =>
        getTradeMode(trade) ===
        "PAPER"
    );

  const modeTrades =
    modeFilter === "REAL"
      ? realTrades
      : modeFilter === "PAPER"
      ? paperTrades
      : allTrades;

  const filteredTrades =
    modeTrades.filter((trade) => {
      if (
        statusFilter === "OPEN"
      ) {
        return (
          upper(trade?.status) ===
          "OPEN"
        );
      }

      if (
        statusFilter === "CLOSED"
      ) {
        return (
          upper(trade?.status) ===
          "CLOSED"
        );
      }

      return true;
    });

  const selectedTrade =
    filteredTrades.find(
      (trade) =>
        trade?.tradeId ===
        selectedTradeId
    ) ||
    modeTrades.find(
      (trade) =>
        trade?.tradeId ===
        selectedTradeId
    ) ||
    filteredTrades[0] ||
    modeTrades[0] ||
    null;

  /* ---------------------------------------------------------
     MODE SUMMARY
  --------------------------------------------------------- */

  const openTrades =
    modeTrades.filter(
      (trade) =>
        upper(trade?.status) ===
        "OPEN"
    );

  const closedTrades =
    modeTrades.filter(
      (trade) =>
        upper(trade?.status) ===
        "CLOSED"
    );

  const openContracts =
    openTrades.reduce(
      (sum, trade) =>
        sum +
        (safeNum(
          trade?.qty?.remainingQty
        ) ?? 0),
      0
    );

  const realizedPnL =
    modeTrades.reduce(
      (sum, trade) =>
        sum +
        (safeNum(
          trade?.summary?.realizedPnL
        ) ?? 0),
      0
    );

  const unrealizedPnL =
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
          (safeNum(
            live.unrealizedPnL
          ) ?? 0)
        );
      },
      0
    );

  const totalTradePnL =
    realizedPnL +
    unrealizedPnL;

  /* ---------------------------------------------------------
     DAILY REAL ACCOUNT PNL
     Prevent duplicate account/day sums.
  --------------------------------------------------------- */

  const dailyAccountPnL =
    (() => {
      const seen = new Set();

      let total = 0;

      for (const trade of realTrades) {
        const account =
          trade?.brokerImport
            ?.accountAlias;

        const date =
          trade?.brokerImport
            ?.tradingDate;

        const pnl =
          safeNum(
            trade?.summary
              ?.dailyAccountPnL
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

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        total += pnl;
      }

      return total;
    })();

  const wins =
    closedTrades.filter(
      (trade) =>
        upper(trade?.result) ===
        "WIN"
    ).length;

  const losses =
    closedTrades.filter(
      (trade) =>
        upper(trade?.result) ===
        "LOSS"
    ).length;

  const breakeven =
    closedTrades.filter(
      (trade) =>
        upper(trade?.result) ===
        "BREAKEVEN"
    ).length;

  /* ---------------------------------------------------------
     SELECTED LIVE
  --------------------------------------------------------- */

  const selectedSymbol =
    selectedTrade
      ? normalizeMarketSymbol(
          selectedTrade
        )
      : null;

  const selectedLive =
    selectedTrade
      ? calculateLivePosition(
          selectedTrade,
          marks[selectedSymbol]
        )
      : null;

  const selectedMode =
    selectedTrade
      ? getTradeMode(selectedTrade)
      : "OTHER";

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020817",
        color: "#e5e7eb",
        padding: 14,
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        style={{
          border: "1px solid #1f2937",
          borderRadius: 16,
          background: "#050b16",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 1000,
              }}
            >
              Full Trade Journal
            </div>

            <div
              style={{
                color: "#9ca3af",
                fontWeight: 800,
                fontSize: 15,
                marginTop: 4,
              }}
            >
              Real trading and
              automated paper trading
              tracked separately
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <FilterButton
              active={
                modeFilter === "REAL"
              }
              tone={COLORS.real}
              onClick={() =>
                setModeFilter("REAL")
              }
            >
              REAL TRADING
            </FilterButton>

            <FilterButton
              active={
                modeFilter ===
                "PAPER"
              }
              tone={COLORS.paper}
              onClick={() =>
                setModeFilter("PAPER")
              }
            >
              PAPER TRADING
            </FilterButton>

            <FilterButton
              active={
                modeFilter === "ALL"
              }
              onClick={() =>
                setModeFilter("ALL")
              }
            >
              ALL
            </FilterButton>

            <div
              style={{
                width: 1,
                background: "#334155",
                margin: "0 3px",
              }}
            />

            <FilterButton
              active={
                statusFilter ===
                "ALL"
              }
              onClick={() =>
                setStatusFilter("ALL")
              }
            >
              ALL
            </FilterButton>

            <FilterButton
              active={
                statusFilter ===
                "OPEN"
              }
              tone={COLORS.open}
              onClick={() =>
                setStatusFilter(
                  "OPEN"
                )
              }
            >
              OPEN
            </FilterButton>

            <FilterButton
              active={
                statusFilter ===
                "CLOSED"
              }
              tone={COLORS.closed}
              onClick={() =>
                setStatusFilter(
                  "CLOSED"
                )
              }
            >
              CLOSED
            </FilterButton>

            <button
              type="button"
              onClick={() =>
                window.close()
              }
              style={{
                background: "#0b0b0b",
                color: "#cbd5e1",
                border:
                  "1px solid #2b2b2b",
                borderRadius: 10,
                padding: "8px 14px",
                fontWeight: 1000,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Close Tab
            </button>
          </div>
        </div>

        {/* ===================================================
            CURRENT MODE BANNER
        =================================================== */}

        <div
          style={{
            marginTop: 14,
            border:
              modeFilter === "REAL"
                ? `1px solid ${COLORS.real.bd}`
                : modeFilter ===
                  "PAPER"
                ? `1px solid ${COLORS.paper.bd}`
                : "1px solid #334155",

            background:
              modeFilter === "REAL"
                ? COLORS.real.bg
                : modeFilter ===
                  "PAPER"
                ? COLORS.paper.bg
                : "#111827",

            borderRadius: 12,
            padding: "10px 14px",

            fontSize: 17,
            fontWeight: 1000,

            color:
              modeFilter === "REAL"
                ? COLORS.real.fg
                : modeFilter ===
                  "PAPER"
                ? COLORS.paper.fg
                : "#e5e7eb",
          }}
        >
          {modeFilter === "REAL"
            ? "REAL TRADING — Schwab / Thinkorswim imported execution history"
            : modeFilter ===
              "PAPER"
            ? "PAPER TRADING — Frye Dashboard automated paper execution"
            : "ALL JOURNAL RECORDS — REAL AND PAPER COMBINED"}
        </div>

        {/* ===================================================
            MAIN SUMMARY
        =================================================== */}

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0,1fr))",
            gap: 10,
          }}
        >
          <BigMetric
            label="Trades"
            value={modeTrades.length}
          />

          <BigMetric
            label="Open Positions"
            value={openTrades.length}
          />

          <BigMetric
            label="Open Contracts"
            value={openContracts}
          />

          <BigMetric
            label="Realized P&L"
            value={fmtMoney(
              realizedPnL
            )}
            valueColor={pnlColor(
              realizedPnL
            )}
          />

          <BigMetric
            label="Unrealized P&L"
            value={fmtMoney(
              unrealizedPnL
            )}
            valueColor={pnlColor(
              unrealizedPnL
            )}
            sub="Live futures marks"
          />

          <BigMetric
            label="Total Trade P&L"
            value={fmtMoney(
              totalTradePnL
            )}
            valueColor={pnlColor(
              totalTradePnL
            )}
          />

          <BigMetric
            label={
              modeFilter === "REAL"
                ? "Daily Account P&L"
                : "Closed W / L / BE"
            }
            value={
              modeFilter === "REAL"
                ? fmtMoney(
                    dailyAccountPnL
                  )
                : `${wins} / ${losses} / ${breakeven}`
            }
            valueColor={
              modeFilter === "REAL"
                ? pnlColor(
                    dailyAccountPnL
                  )
                : "#e5e7eb"
            }
          />
        </div>

        {/* ===================================================
            CONNECTION STATUS
        =================================================== */}

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            color: "#94a3b8",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <span>
            Journal:{" "}
            <b
              style={{
                color: err
                  ? "#fca5a5"
                  : "#86efac",
              }}
            >
              {err
                ? "ERROR"
                : "CONNECTED"}
            </b>
          </span>

          <span>
            Load:{" "}
            <b>
              {loading
                ? "Loading..."
                : "Ready"}
            </b>
          </span>

          <span>
            Journal fetch:{" "}
            <b>
              {lastFetch
                ? toAz(
                    lastFetch,
                    true
                  )
                : "—"}
            </b>
          </span>

          {openFuturesSymbols.map(
            (symbol) => (
              <span key={symbol}>
                {symbol}:{" "}
                <b
                  style={{
                    color:
                      "#93c5fd",
                  }}
                >
                  {fmtNum(
                    marks[symbol]
                  )}
                </b>{" "}
                <span>
                  (
                  {markTimes[symbol]
                    ? toAz(
                        markTimes[
                          symbol
                        ],
                        true
                      )
                    : "waiting"}
                  )
                </span>
              </span>
            )
          )}
        </div>

        {err ? (
          <div
            style={{
              marginTop: 10,
              color: "#fca5a5",
              fontWeight: 1000,
              fontSize: 16,
            }}
          >
            Journal error: {err}
          </div>
        ) : null}

        {/* ===================================================
            OPEN POSITIONS
        =================================================== */}

        <div
          style={{
            marginTop: 16,
            border:
              "1px solid #1f2937",
            borderRadius: 14,
            background: "#07101f",
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 19,
                fontWeight: 1000,
                color: "#93c5fd",
              }}
            >
              OPEN POSITIONS
            </div>

            <div
              style={{
                color: "#94a3b8",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              {openContracts} contracts
              currently open
            </div>
          </div>

          {!openTrades.length ? (
            <div
              style={{
                padding: 18,
                color: "#94a3b8",
                fontWeight: 900,
              }}
            >
              No open{" "}
              {modeFilter === "REAL"
                ? "real"
                : modeFilter ===
                  "PAPER"
                ? "paper"
                : ""}{" "}
              positions.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0,1fr))",
                gap: 12,
              }}
            >
              {openTrades.map(
                (trade) => {
                  const symbol =
                    normalizeMarketSymbol(
                      trade
                    );

                  return (
                    <OpenPositionCard
                      key={
                        trade.tradeId
                      }
                      trade={trade}
                      mark={
                        marks[symbol]
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
            </div>
          )}
        </div>

        {/* ===================================================
            HISTORY + DETAILS
        =================================================== */}

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns:
              "minmax(430px, .9fr) minmax(0, 1.55fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* HISTORY */}

          <div
            style={{
              border: "1px solid #262626",
              borderRadius: 14,
              padding: 14,
              background: "#101010",
              minHeight: 650,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontWeight: 1000,
                color: "#93c5fd",
                fontSize: 18,
              }}
            >
              TRADE HISTORY
            </div>

            {filteredTrades.length ===
            0 ? (
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: 16,
                }}
              >
                No trades for these
                filters.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: 9,
                  maxHeight: "72vh",
                  overflowY: "auto",
                }}
              >
                {filteredTrades.map(
                  (trade) => {
                    const symbol =
                      normalizeMarketSymbol(
                        trade
                      );

                    return (
                      <TradeRow
                        key={
                          trade.tradeId
                        }
                        trade={trade}
                        mark={
                          marks[symbol]
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
              </div>
            )}
          </div>

          {/* DETAILS */}

          <div
            style={{
              border: "1px solid #262626",
              borderRadius: 14,
              padding: 14,
              background: "#101010",
              minHeight: 650,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontWeight: 1000,
                  color: "#93c5fd",
                  fontSize: 18,
                }}
              >
                TRADE DETAILS
              </div>

              {selectedTrade ? (
                <Pill
                  text={
                    selectedMode
                  }
                  tone={
                    selectedMode ===
                    "REAL"
                      ? COLORS.real
                      : selectedMode ===
                        "PAPER"
                      ? COLORS.paper
                      : COLORS.neutral
                  }
                />
              ) : null}
            </div>

            {!selectedTrade ? (
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: 16,
                }}
              >
                Select a trade to view
                details.
              </div>
            ) : (
              <>
                {/* LIVE POSITION */}

                {upper(
                  selectedTrade?.status
                ) === "OPEN" ? (
                  <SectionCard title="LIVE POSITION">
                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(4, minmax(0,1fr))",
                        gap: 10,
                      }}
                    >
                      <BigMetric
                        label="Open Contracts"
                        value={
                          selectedLive
                            ?.remainingQty ??
                          "—"
                        }
                      />

                      <BigMetric
                        label="Remaining Avg"
                        value={fmtNum(
                          selectedLive
                            ?.averageEntry
                        )}
                      />

                      <BigMetric
                        label={`Current ${
                          selectedSymbol ||
                          "Mark"
                        }`}
                        value={fmtNum(
                          selectedLive
                            ?.mark
                        )}
                      />

                      <BigMetric
                        label="Unrealized P&L"
                        value={
                          selectedLive
                            ?.available
                            ? fmtMoney(
                                selectedLive
                                  .unrealizedPnL
                              )
                            : "WAITING"
                        }
                        valueColor={pnlColor(
                          selectedLive
                            ?.unrealizedPnL
                        )}
                      />
                    </div>
                  </SectionCard>
                ) : null}

                {/* IDENTITY / ENTRY */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0,1fr))",
                    gap: 12,
                  }}
                >
                  <SectionCard title="IDENTITY">
                    <KV
                      k="Trade ID"
                      v={
                        selectedTrade.tradeId
                      }
                    />

                    <KV
                      k="Symbol"
                      v={
                        selectedTrade.symbol
                      }
                    />

                    <KV
                      k="Strategy"
                      v={
                        selectedTrade.strategyId
                      }
                    />

                    <KV
                      k="Direction"
                      v={
                        selectedTrade.direction
                      }
                    />

                    <KV
                      k="Mode"
                      v={
                        selectedTrade.accountMode
                      }
                    />

                    <KV
                      k="Source"
                      v={
                        selectedTrade.source ||
                        "ENGINE10"
                      }
                    />

                    <KV
                      k="Asset Type"
                      v={
                        selectedTrade.assetType
                      }
                    />
                  </SectionCard>

                  <SectionCard title="ENTRY">
                    <KV
                      k="Entry Time"
                      v={toAz(
                        selectedTrade
                          ?.entry?.time,
                        true
                      )}
                    />

                    <KV
                      k="Entry Price"
                      v={fmtNum(
                        selectedTrade
                          ?.entry?.price
                      )}
                    />

                    <KV
                      k="Entry Qty"
                      v={
                        selectedTrade
                          ?.entry?.qty ??
                        "—"
                      }
                    />

                    <KV
                      k="Remaining"
                      v={
                        selectedTrade
                          ?.qty
                          ?.remainingQty ??
                        "—"
                      }
                    />

                    <KV
                      k="Order Type"
                      v={
                        selectedTrade
                          ?.entry
                          ?.orderType ||
                        "—"
                      }
                    />

                    <KV
                      k="Order ID"
                      v={
                        selectedTrade
                          ?.entry
                          ?.orderId ||
                        "—"
                      }
                    />
                  </SectionCard>
                </div>

                {/* BROKER IMPORT */}

                {selectedMode ===
                  "REAL" &&
                selectedTrade
                  ?.brokerImport ? (
                  <SectionCard title="SCHWAB / THINKORSWIM">
                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0,1fr))",
                        gap: 8,
                      }}
                    >
                      <KV
                        k="Account"
                        v={
                          selectedTrade
                            .brokerImport
                            .accountAlias ||
                          "—"
                        }
                      />

                      <KV
                        k="Broker Symbol"
                        v={
                          selectedTrade
                            .brokerImport
                            .brokerSymbol ||
                          selectedTrade
                            .brokerSymbol ||
                          "—"
                        }
                      />

                      <KV
                        k="Trading Date"
                        v={
                          selectedTrade
                            .brokerImport
                            .tradingDate ||
                          "—"
                        }
                      />

                      <KV
                        k="$/Point"
                        v={fmtNum(
                          selectedTrade
                            .brokerImport
                            .dollarsPerPoint
                        )}
                      />

                      <KV
                        k="Remaining Avg"
                        v={fmtNum(
                          selectedTrade
                            .brokerImport
                            .remainingAverageEntry
                        )}
                      />

                      <KV
                        k="Gross Realized"
                        v={fmtMoney(
                          selectedTrade
                            ?.summary
                            ?.realizedPnL
                        )}
                        color={pnlColor(
                          selectedTrade
                            ?.summary
                            ?.realizedPnL
                        )}
                      />

                      <KV
                        k="Net Realized"
                        v={fmtMoney(
                          selectedTrade
                            ?.summary
                            ?.netRealizedPnL
                        )}
                        color={pnlColor(
                          selectedTrade
                            ?.summary
                            ?.netRealizedPnL
                        )}
                      />

                      <KV
                        k="Daily Account P&L"
                        v={fmtMoney(
                          selectedTrade
                            ?.summary
                            ?.dailyAccountPnL
                        )}
                        color={pnlColor(
                          selectedTrade
                            ?.summary
                            ?.dailyAccountPnL
                        )}
                      />
                    </div>
                  </SectionCard>
                ) : null}

                {/* EVENTS */}

                <SectionCard title="EXECUTION EVENTS">
                  <EventList
                    events={
                      selectedTrade?.events
                    }
                  />
                </SectionCard>

                {/* SUMMARY / SETUP */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0,1fr))",
                    gap: 12,
                  }}
                >
                  <SectionCard title="SUMMARY">
                    <KV
                      k="Status"
                      v={
                        selectedTrade
                          ?.status ||
                        "—"
                      }
                    />

                    <KV
                      k="Result"
                      v={
                        selectedTrade
                          ?.result ||
                        "—"
                      }
                    />

                    <KV
                      k="Remaining Qty"
                      v={
                        selectedTrade
                          ?.qty
                          ?.remainingQty ??
                        "—"
                      }
                    />

                    <KV
                      k="Realized P&L"
                      v={fmtMoney(
                        selectedTrade
                          ?.summary
                          ?.realizedPnL
                      )}
                      color={pnlColor(
                        selectedTrade
                          ?.summary
                          ?.realizedPnL
                      )}
                    />

                    <KV
                      k="Unrealized P&L"
                      v={
                        selectedLive
                          ?.available
                          ? fmtMoney(
                              selectedLive
                                .unrealizedPnL
                            )
                          : "—"
                      }
                      color={pnlColor(
                        selectedLive
                          ?.unrealizedPnL
                      )}
                    />

                    <KV
                      k="Total Trade P&L"
                      v={fmtMoney(
                        selectedLive
                          ?.totalTradePnL ??
                          selectedTrade
                            ?.summary
                            ?.realizedPnL
                      )}
                      color={pnlColor(
                        selectedLive
                          ?.totalTradePnL ??
                          selectedTrade
                            ?.summary
                            ?.realizedPnL
                      )}
                    />

                    <KV
                      k="Realized Points"
                      v={fmtSigned(
                        selectedTrade
                          ?.summary
                          ?.realizedPoints
                      )}
                    />

                    <KV
                      k="Duration"
                      v={
                        selectedTrade
                          ?.summary
                          ?.durationMinutes ??
                        "—"
                      }
                    />
                  </SectionCard>

                  <SectionCard title="SETUP SNAPSHOT">
                    <KV
                      k="Snapshot Time"
                      v={toAz(
                        selectedTrade
                          ?.setup
                          ?.snapshotTime,
                        true
                      )}
                    />

                    <KV
                      k="Strategy Type"
                      v={
                        selectedTrade
                          ?.setup
                          ?.strategyType ||
                        "—"
                      }
                    />

                    <KV
                      k="Readiness"
                      v={
                        selectedTrade
                          ?.setup
                          ?.readinessLabel ||
                        "—"
                      }
                    />

                    <KV
                      k="Action"
                      v={
                        selectedTrade
                          ?.setup?.action ||
                        "—"
                      }
                    />

                    <KV
                      k="Exec Bias"
                      v={
                        selectedTrade
                          ?.setup
                          ?.executionBias ||
                        "—"
                      }
                    />

                    <KV
                      k="Permission"
                      v={
                        selectedTrade
                          ?.setup
                          ?.permission ||
                        "—"
                      }
                    />

                    <KV
                      k="Zone Type"
                      v={
                        selectedTrade
                          ?.setup
                          ?.zoneType ||
                        "—"
                      }
                    />
                  </SectionCard>
                </div>

                {/* REVIEW */}

                <SectionCard title="REVIEW">
                  <KV
                    k="Grade"
                    v={
                      selectedTrade
                        ?.review?.grade ||
                      "—"
                    }
                  />

                  <KV
                    k="Notes"
                    v={
                      selectedTrade
                        ?.review?.notes ||
                      "—"
                    }
                  />

                  <KV
                    k="Tags"
                    v={
                      Array.isArray(
                        selectedTrade
                          ?.review?.tags
                      ) &&
                      selectedTrade.review
                        .tags.length
                        ? selectedTrade.review.tags.join(
                            ", "
                          )
                        : "—"
                    }
                  />
                </SectionCard>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
