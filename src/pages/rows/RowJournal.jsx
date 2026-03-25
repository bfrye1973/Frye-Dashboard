import React, { useEffect, useMemo, useState } from "react";
const API_BASE = "https://frye-market-backend-1.onrender.com";

const AZ_TZ = "America/Phoenix";
const POLL_MS = 15000;

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const BASE = normalizeApiBase(API_BASE);

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
    return iso;
  }
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(v, digits = 2) {
  const n = safeNum(v);
  return n == null ? "—" : n.toFixed(digits);
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "CLOSED") return { bg: "#06220f", fg: "#86efac", bd: "#166534" };
  if (s === "OPEN") return { bg: "#1b1409", fg: "#fbbf24", bd: "#92400e" };
  if (s === "CANCELLED") return { bg: "#2b0b0b", fg: "#fca5a5", bd: "#7f1d1d" };
  return { bg: "#0b0b0b", fg: "#94a3b8", bd: "#2b2b2b" };
}

function resultTone(result) {
  const r = String(result || "").toUpperCase();
  if (r === "WIN") return { bg: "#06220f", fg: "#86efac", bd: "#166534" };
  if (r === "LOSS") return { bg: "#2b0b0b", fg: "#fca5a5", bd: "#7f1d1d" };
  if (r === "BREAKEVEN") return { bg: "#111827", fg: "#cbd5e1", bd: "#334155" };
  return { bg: "#0b0b0b", fg: "#94a3b8", bd: "#2b2b2b" };
}

function eventTone(type) {
  const t = String(type || "").toUpperCase();
  if (t === "ENTRY_FILLED") return { bg: "#111827", fg: "#93c5fd", bd: "#334155" };
  if (t === "PARTIAL_CLOSE") return { bg: "#1b1409", fg: "#fbbf24", bd: "#92400e" };
  if (t === "FULL_CLOSE") return { bg: "#06220f", fg: "#86efac", bd: "#166534" };
  if (t === "STOP_HIT") return { bg: "#2b0b0b", fg: "#fca5a5", bd: "#7f1d1d" };
  return { bg: "#0b0b0b", fg: "#94a3b8", bd: "#2b2b2b" };
}

function Pill({ text, tone }) {
  const t = tone || { bg: "#0b0b0b", fg: "#94a3b8", bd: "#2b2b2b" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 1000,
        padding: "4px 8px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: 10,
        background: "#0b0b0b",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "118px 1fr",
        gap: 8,
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 1000,
          color: "#9ca3af",
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#e5e7eb",
          wordBreak: "break-word",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function TradeRow({ trade, selected, onClick }) {
  const st = statusTone(trade?.status);
  const rt = resultTone(trade?.result);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: selected ? "#111827" : "#0b0b0b",
        border: selected ? "1px solid #3b82f6" : "1px solid #1f2937",
        borderRadius: 12,
        padding: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      title={trade?.tradeId}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1.1fr .8fr .8fr",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 1000, color: "#e5e7eb" }}>
            {trade?.symbol || "—"} • {trade?.strategyId || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>
            {toAz(trade?.createdAt, true)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill text={trade?.direction || "—"} tone={{ bg: "#111827", fg: "#93c5fd", bd: "#334155" }} />
          <Pill text={trade?.accountMode || "—"} tone={{ bg: "#111827", fg: "#cbd5e1", bd: "#334155" }} />
          <Pill text={trade?.timeframe || "—"} tone={{ bg: "#111827", fg: "#cbd5e1", bd: "#334155" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Pill text={trade?.status || "UNKNOWN"} tone={st} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Pill text={trade?.result || "—"} tone={rt} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0,1fr))",
          gap: 8,
          fontSize: 12,
          color: "#cbd5e1",
        }}
      >
        <div>
          <span style={{ color: "#9ca3af", fontWeight: 1000 }}>Entry Qty:</span>{" "}
          <b>{trade?.entry?.qty ?? "—"}</b>
        </div>
        <div>
          <span style={{ color: "#9ca3af", fontWeight: 1000 }}>Remain:</span>{" "}
          <b>{trade?.qty?.remainingQty ?? "—"}</b>
        </div>
        <div>
          <span style={{ color: "#9ca3af", fontWeight: 1000 }}>Entry Price:</span>{" "}
          <b>{fmtNum(trade?.entry?.price)}</b>
        </div>
        <div>
          <span style={{ color: "#9ca3af", fontWeight: 1000 }}>Realized:</span>{" "}
          <b>{fmtNum(trade?.summary?.realizedPnL)}</b>
        </div>
        <div>
          <span style={{ color: "#9ca3af", fontWeight: 1000 }}>Duration:</span>{" "}
          <b>{trade?.summary?.durationMinutes ?? "—"}</b>
        </div>
      </div>
    </button>
  );
}

function EventList({ events }) {
  const rows = Array.isArray(events) ? events : [];
  if (!rows.length) {
    return <div style={{ color: "#94a3b8", fontSize: 12 }}>No events.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((ev, i) => {
        const tone = eventTone(ev?.eventType);
        return (
          <div
            key={`${ev?.ts || "na"}-${i}`}
            style={{
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: 8,
              background: "#111827",
              display: "grid",
              gridTemplateColumns: "180px 1fr 120px 120px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Pill text={ev?.eventType || "UNKNOWN"} tone={tone} />
            </div>

            <div style={{ fontSize: 12, fontWeight: 900, color: "#cbd5e1" }}>
              {toAz(ev?.ts, true)}
            </div>

            <div style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 900 }}>
              qtyClosed: {ev?.qtyClosed ?? "—"}
            </div>

            <div style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 900 }}>
              remain: {ev?.remainingQty ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RowJournal() {
  const url = useMemo(() => `${BASE}/api/v1/trade-journal`, []);
  const [data, setData] = useState({ ok: true, trades: [] });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function pull() {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            accept: "application/json",
            "Cache-Control": "no-store",
          },
        });

        const json = await res.json();
        if (!alive) return;

        setData(json || { ok: true, trades: [] });
        setErr("");
        setLastFetch(new Date().toISOString());

        const trades = Array.isArray(json?.trades) ? json.trades : [];
        if (trades.length) {
          setSelectedTradeId((prev) => prev || trades[0]?.tradeId || null);
        }
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
        timer = setTimeout(pull, POLL_MS);
      }
    }

    pull();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [url]);

  const allTrades = Array.isArray(data?.trades) ? data.trades : [];

  const filteredTrades = allTrades.filter((t) => {
    if (filter === "OPEN") return String(t?.status || "").toUpperCase() === "OPEN";
    if (filter === "CLOSED") return String(t?.status || "").toUpperCase() === "CLOSED";
    return true;
  });

  const selectedTrade =
    filteredTrades.find((t) => t?.tradeId === selectedTradeId) ||
    allTrades.find((t) => t?.tradeId === selectedTradeId) ||
    filteredTrades[0] ||
    allTrades[0] ||
    null;

  const openCount = allTrades.filter((t) => String(t?.status || "").toUpperCase() === "OPEN").length;
  const closedCount = allTrades.filter((t) => String(t?.status || "").toUpperCase() === "CLOSED").length;
  const wins = allTrades.filter((t) => String(t?.result || "").toUpperCase() === "WIN").length;
  const losses = allTrades.filter((t) => String(t?.result || "").toUpperCase() === "LOSS").length;
  const breakeven = allTrades.filter((t) => String(t?.result || "").toUpperCase() === "BREAKEVEN").length;

  return (
    <section id="row-6" className="panel" style={{ marginTop: 12, padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Trade Journal</div>
        <div className="spacer" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("ALL")}
            style={{
              background: filter === "ALL" ? "#1f2937" : "#0b0b0b",
              color: "#e5e7eb",
              border: filter === "ALL" ? "1px solid #3b82f6" : "1px solid #2b2b2b",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 1000,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            ALL
          </button>
          <button
            onClick={() => setFilter("OPEN")}
            style={{
              background: filter === "OPEN" ? "#1f2937" : "#0b0b0b",
              color: "#e5e7eb",
              border: filter === "OPEN" ? "1px solid #3b82f6" : "1px solid #2b2b2b",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 1000,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            OPEN
          </button>
          <button
            onClick={() => setFilter("CLOSED")}
            style={{
              background: filter === "CLOSED" ? "#1f2937" : "#0b0b0b",
              color: "#e5e7eb",
              border: filter === "CLOSED" ? "1px solid #3b82f6" : "1px solid #2b2b2b",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 1000,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            CLOSED
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0,1fr))",
          gap: 8,
        }}
      >
        <SectionCard title="SUMMARY">
          <KV k="Total Trades" v={allTrades.length} />
          <KV k="Open" v={openCount} />
          <KV k="Closed" v={closedCount} />
          <KV k="Last Fetch" v={lastFetch ? toAz(lastFetch, true) : "—"} />
        </SectionCard>

        <SectionCard title="RESULTS">
          <KV k="Wins" v={wins} />
          <KV k="Losses" v={losses} />
          <KV k="Breakeven" v={breakeven} />
          <KV k="Load State" v={loading ? "Loading..." : "Ready"} />
        </SectionCard>

        <SectionCard title="JOURNAL STATUS">
          <KV k="Backend" v={err ? "Error" : "Connected"} />
          <KV k="Filter" v={filter} />
          <KV k="Selected" v={selectedTrade?.symbol ? `${selectedTrade.symbol} • ${selectedTrade.strategyId}` : "—"} />
          <KV k="Trade ID" v={selectedTrade?.tradeId || "—"} />
        </SectionCard>

        <SectionCard title="POSITION">
          <KV k="Original Qty" v={selectedTrade?.qty?.originalQty ?? "—"} />
          <KV k="Remaining Qty" v={selectedTrade?.qty?.remainingQty ?? "—"} />
          <KV k="Entry Price" v={fmtNum(selectedTrade?.entry?.price)} />
          <KV k="Result" v={selectedTrade?.result || "—"} />
        </SectionCard>

        <SectionCard title="TIMING">
          <KV k="Opened" v={toAz(selectedTrade?.summary?.openTime || selectedTrade?.entry?.time, true)} />
          <KV k="Closed" v={toAz(selectedTrade?.summary?.closeTime, true)} />
          <KV k="Minutes" v={selectedTrade?.summary?.durationMinutes ?? "—"} />
          <KV k="Snapshot" v={toAz(selectedTrade?.setup?.snapshotTime, true)} />
        </SectionCard>
      </div>

      {err ? (
        <div style={{ marginTop: 10, color: "#fca5a5", fontWeight: 1000, fontSize: 13 }}>
          Journal error: {err}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "minmax(340px, 0.95fr) minmax(0, 1.45fr)",
          gap: 10,
          alignItems: "start",
        }}
      >
        {/* LEFT LIST */}
        <div
          style={{
            border: "1px solid #262626",
            borderRadius: 12,
            padding: 10,
            background: "#101010",
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: 12 }}>TRADE HISTORY</div>

          {filteredTrades.length === 0 ? (
            <div className="muted small" style={{ color: "#9ca3af" }}>
              No trades for this filter.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 760, overflowY: "auto" }}>
              {filteredTrades.map((trade) => (
                <TradeRow
                  key={trade.tradeId}
                  trade={trade}
                  selected={selectedTrade?.tradeId === trade.tradeId}
                  onClick={() => setSelectedTradeId(trade.tradeId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT DETAILS */}
        <div
          style={{
            border: "1px solid #262626",
            borderRadius: 12,
            padding: 10,
            background: "#101010",
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: 12 }}>
            TRADE DETAILS
          </div>

          {!selectedTrade ? (
            <div className="muted small" style={{ color: "#9ca3af" }}>
              Select a trade to view details.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gap: 10,
                }}
              >
                <SectionCard title="IDENTITY">
                  <KV k="Trade ID" v={selectedTrade.tradeId} />
                  <KV k="Symbol" v={selectedTrade.symbol} />
                  <KV k="Strategy" v={selectedTrade.strategyId} />
                  <KV k="Direction" v={selectedTrade.direction} />
                  <KV k="Mode" v={selectedTrade.accountMode} />
                  <KV k="Asset Type" v={selectedTrade.assetType} />
                </SectionCard>

                <SectionCard title="ENTRY">
                  <KV k="Entry Time" v={toAz(selectedTrade?.entry?.time, true)} />
                  <KV k="Entry Price" v={fmtNum(selectedTrade?.entry?.price)} />
                  <KV k="Entry Qty" v={selectedTrade?.entry?.qty ?? "—"} />
                  <KV k="Order Type" v={selectedTrade?.entry?.orderType || "—"} />
                  <KV k="Order ID" v={selectedTrade?.entry?.orderId || "—"} />
                  <KV k="Idempotency" v={selectedTrade?.entry?.idempotencyKey || "—"} />
                </SectionCard>
              </div>

              <SectionCard title="EXECUTION EVENTS">
                <EventList events={selectedTrade?.events} />
              </SectionCard>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gap: 10,
                }}
              >
                <SectionCard title="SUMMARY">
                  <KV k="Status" v={selectedTrade?.status || "—"} />
                  <KV k="Result" v={selectedTrade?.result || "—"} />
                  <KV k="Remaining Qty" v={selectedTrade?.qty?.remainingQty ?? "—"} />
                  <KV k="Realized PnL" v={fmtNum(selectedTrade?.summary?.realizedPnL)} />
                  <KV k="Realized Points" v={fmtNum(selectedTrade?.summary?.realizedPoints)} />
                  <KV k="Duration" v={selectedTrade?.summary?.durationMinutes ?? "—"} />
                </SectionCard>

                <SectionCard title="SETUP SNAPSHOT">
                  <KV k="Snapshot Time" v={toAz(selectedTrade?.setup?.snapshotTime, true)} />
                  <KV k="Strategy Type" v={selectedTrade?.setup?.strategyType || "—"} />
                  <KV k="Readiness" v={selectedTrade?.setup?.readinessLabel || "—"} />
                  <KV k="Action" v={selectedTrade?.setup?.action || "—"} />
                  <KV k="Exec Bias" v={selectedTrade?.setup?.executionBias || "—"} />
                  <KV k="Permission" v={selectedTrade?.setup?.permission || "—"} />
                  <KV k="Zone Type" v={selectedTrade?.setup?.zoneType || "—"} />
                </SectionCard>
              </div>

              <SectionCard title="REVIEW">
                <KV k="Grade" v={selectedTrade?.review?.grade || "—"} />
                <KV k="Notes" v={selectedTrade?.review?.notes || "—"} />
                <KV
                  k="Tags"
                  v={Array.isArray(selectedTrade?.review?.tags) && selectedTrade.review.tags.length
                    ? selectedTrade.review.tags.join(", ")
                    : "—"}
                />
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
