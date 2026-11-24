// Trader View v1 — plain-English screen at /trader-view.
// DISPLAY ONLY. Renders the traderView.v1 contract from GET /api/v1/trader-view.
// It never creates permission, never executes, never recomputes engine logic.
// The verdict comes only from Engine 6 (contract.verdict). Paper trading only.

import React, { useState } from "react";
import "./traderView.css";
import useTraderView from "../../hooks/useTraderView";
import {
  DetailsRows,
  ShadowTag,
  TraderCard,
  TraderFreshnessBadge,
  TraderSection,
  TraderStatusChip,
  fmtAzTime,
  fmtPrice,
  humanize,
  normStatus,
} from "./TraderComponents";

/* Card copy (titles + questions) is design text, not engine output. */
const CARDS = [
  { key: "location", title: "Engine 26 · Location", question: "Where is the trade?" },
  { key: "reaction", title: "Engine 3 · Price reaction", question: "Are buyers or sellers in control at the zone?" },
  { key: "participation", title: "Engine 4 · Volume", question: "Is real money behind the move?" },
  { key: "permission", title: "Engine 6 · Permission", question: "Can the paper trade go?" },
  { key: "structure", title: "Engine 22 · Wave structure", question: "Where are we in the wave count?" },
  { key: "marketContext", title: "Market context · Engines 25 / 29 + ES Master", question: "Is the bigger picture helping?" },
];

const PIPE_NAMES = {
  location: "Location",
  reaction: "Reaction",
  participation: "Volume",
  permission: "Permission",
};

const TF_ORDER = [
  ["10m", "10m"],
  ["30m", "30m"],
  ["1h", "1H"],
  ["4h", "4H"],
  ["1d", "Daily"],
  ["eod", "EOD"],
];

function factValue(section, label) {
  const f = (section?.facts || []).find((x) => String(x.label).toLowerCase() === label.toLowerCase());
  return f ? f.value : null;
}

function verdictClass(state) {
  if (state === "PAPER_ALLOWED") return "tv-verdict--allowed";
  if (state === "NO_TRADE") return "tv-verdict--no";
  return "tv-verdict--unknown";
}

/* ---------- per-card extras (all values straight from the contract) ---------- */

function ReactionEvidence({ section }) {
  const tf = section?.details?.timeframes;
  if (!tf) return null;
  const rows = [
    ["1-min (forming)", tf.oneMinute?.state],
    ["5-min (last completed)", tf.fiveMinute?.completedState ?? tf.fiveMinute?.state],
    ["10-min (last completed)", tf.tenMinute?.completedState ?? tf.tenMinute?.state],
  ];
  return (
    <>
      <div className="tv-subhead">Timeframe evidence only · Engine 3's official direction above decides</div>
      <div className="tv-facts">
        {rows.map(([label, v]) => (
          <div className="tv-kv" key={label}>
            <div className="tv-kv-label">{label}</div>
            <div className="tv-kv-value">{humanize(v)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReactionDetails({ section }) {
  const tf = section?.details?.timeframes || {};
  return ["oneMinute", "fiveMinute", "tenMinute"].map((k) =>
    tf[k] ? (
      <div className="tv-details-row" key={k}>
        <span className="tv-details-key">{k}</span>
        <span className="tv-details-val">
          now {humanize(tf[k].state)} / {humanize(tf[k].direction)} / {humanize(tf[k].quality)} · last
          completed {humanize(tf[k].completedState)} / {humanize(tf[k].completedDirection)}
        </span>
      </div>
    ) : null
  );
}

function ParticipationDetails({ section }) {
  const d = section?.details || {};
  return (
    <>
      {d.shadow ? (
        <>
          <div className="tv-subhead">
            Engine 4 v2 <ShadowTag />
          </div>
          <DetailsRows obj={d.shadow} />
        </>
      ) : null}
      {d.canonicalLegacyRatio ? (
        <>
          <div className="tv-subhead">Legacy bar-to-bar ratio (details only)</div>
          <DetailsRows obj={d.canonicalLegacyRatio} />
        </>
      ) : null}
      <DetailsRows obj={d} skip={["shadow", "canonicalLegacyRatio"]} />
    </>
  );
}

function DisplayWarnings({ section }) {
  const w = section?.details?.displayWarnings;
  if (!Array.isArray(w) || !w.length) return null;
  return w.map((x, i) => (
    <div className="tv-warning" key={x.code || i}>
      ⚠ {x.meaning || x.code}
      {Array.isArray(x.levels) && x.levels.length ? ` (${x.levels.map(fmtPrice).join(", ")})` : ""}
    </div>
  ));
}

function TimeframeTable({ title, source, data }) {
  if (!data || typeof data !== "object") return null;
  const cols = TF_ORDER.filter(([k]) => data[k]);
  if (!cols.length) return null;
  return (
    <div>
      <div className="tv-subhead" title={source || undefined}>
        {title}
      </div>
      <table className="tv-table">
        <thead>
          <tr>
            {cols.map(([k, lbl]) => (
              <th key={k}>{lbl}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cols.map(([k]) => (
              <td key={k}>
                {typeof data[k].score === "number" ? Math.round(data[k].score) : "—"}{" "}
                <span className="tv-faint">{data[k].state || ""}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MarketExtras({ section }) {
  const d = section?.details || {};
  return (
    <>
      <TimeframeTable title="ES price trend (ES Master lights)" source={d.esTrendSource} data={d.esTrendByTimeframe} />
      <TimeframeTable
        title="Market breadth (whole-market internals)"
        source={d.marketBreadthSource}
        data={d.marketBreadthByTimeframe}
      />
    </>
  );
}

function MarketDetails({ section }) {
  const d = section?.details || {};
  return (
    <>
      {d.engine25 ? (
        <>
          <div className="tv-subhead">Engine 25 · market health</div>
          <DetailsRows obj={d.engine25} />
        </>
      ) : null}
      {d.engine29 ? (
        <>
          <div className="tv-subhead">Engine 29</div>
          <DetailsRows obj={d.engine29} />
        </>
      ) : null}
      {d.ema10m ? (
        <>
          <div className="tv-subhead">10-minute EMA (display heuristic)</div>
          <DetailsRows obj={d.ema10m} />
        </>
      ) : null}
    </>
  );
}

function CardExtras({ cardKey, section }) {
  if (!section) return null;
  if (cardKey === "reaction") return <ReactionEvidence section={section} />;
  if (cardKey === "marketContext") return <MarketExtras section={section} />;
  return <DisplayWarnings section={section} />;
}

function CardDetails({ cardKey, section }) {
  if (!section) return null;
  if (cardKey === "reaction") return <ReactionDetails section={section} />;
  if (cardKey === "participation") return <ParticipationDetails section={section} />;
  if (cardKey === "marketContext") return <MarketDetails section={section} />;
  return <DetailsRows obj={section.details} skip={["displayWarnings"]} />;
}

/* ---------- pure view (used by the page and by tests) ---------- */

export function TraderViewView({ data, err = null, loading = false, refreshing = false, mock = false }) {
  const [allOpen, setAllOpen] = useState(false);

  if (!data) {
    return (
      <div className="tv" data-testid="trader-view">
        <div className={`tv-banner ${loading ? "tv-banner--info" : ""}`}>
          {loading ? "Loading Trader View…" : `Trader View unavailable${err ? `: ${err}` : "."}`}
        </div>
      </div>
    );
  }

  const sections = data.sections || {};
  const verdict = data.verdict || {};
  const md = data.marketDirection || {};
  const freshness = data.freshness || {};
  const zone = factValue(sections.location, "Zone");
  const mdState = String(md.state || "UNAVAILABLE").toLowerCase();
  const mdText =
    md.state && md.state !== "UNAVAILABLE"
      ? `${md.gearLabel || humanize(md.state)}${typeof md.masterScore === "number" ? ` · ${md.masterScore}` : ""}`
      : "Unavailable";

  return (
    <div className="tv" data-testid="trader-view" data-verdict={verdict.state || "UNKNOWN"}>
      {String(freshness.status).toUpperCase() === "STALE" ? (
        <div className="tv-banner" role="alert">
          STALE — the engine snapshot is old{freshness.snapshotAsOf ? ` (as of ${fmtAzTime(freshness.snapshotAsOf)})` : ""}.
          Don't act on this screen until it shows LIVE.
        </div>
      ) : null}
      {err ? (
        <div className="tv-banner tv-banner--info">Last refresh failed ({err}). Showing the last good reading.</div>
      ) : null}
      {mock ? (
        <div className="tv-banner tv-banner--info">Mock mode: showing the saved live sample from {fmtAzTime(data.generatedAt)}, not live data.</div>
      ) : null}

      {/* ---------- top bar ---------- */}
      <section className="tv-box tv-top" aria-label="Summary">
        <div className="tv-top-item">
          <div className="tv-eyebrow">
            {data.symbol || "ES"} futures · Strategy 1 · 10m
          </div>
          <div className="tv-price tv-mono">{fmtPrice(data.price)}</div>
        </div>

        <div className={`tv-verdict ${verdictClass(verdict.state)}`} data-testid="verdict">
          <span aria-hidden="true">{verdict.state === "PAPER_ALLOWED" ? "✓" : "⊗"}</span>
          <div>
            <div className="tv-verdict-label">{verdict.label || "VERDICT UNAVAILABLE"}</div>
            <div className="tv-verdict-sub">{verdict.plainEnglish || `Source: ${verdict.source || "Engine 6"}`}</div>
          </div>
        </div>

        <div className="tv-top-item">
          <div className="tv-eyebrow">Market direction</div>
          <div className={`tv-value tv-dir--${mdState}`} data-testid="market-direction">
            {md.gear && md.state !== "UNAVAILABLE" ? `${md.gear} · ` : ""}
            {mdText}
          </div>
        </div>

        <div className="tv-top-item tv-top-item--zone">
          <div className="tv-eyebrow">Active zone</div>
          <div className="tv-value tv-mono">{zone ? humanize(zone) : "—"}</div>
        </div>

        <div className="tv-top-spacer" />

        <div className="tv-updated">
          <span>Updated {fmtAzTime(data.generatedAt)}</span>
          <TraderFreshnessBadge freshness={freshness} err={err} refreshing={refreshing} />
          <button type="button" className="tv-btn" onClick={() => setAllOpen((v) => !v)}>
            {allOpen ? "Hide all details" : "Show all details"}
          </button>
        </div>
      </section>

      {/* ---------- right now + checklist ---------- */}
      <div className="tv-row2">
        <TraderSection eyebrow="Right now">
          <div className="tv-rightnow-text">{data.rightNow?.plainEnglish || "No summary available."}</div>
        </TraderSection>

        <TraderSection eyebrow="What turns this into a trade">
          <ol className="tv-checklist">
            {(data.checklist || []).map((c) => (
              <li key={c.step} className={`tv-check ${c.done ? "tv-check--done" : ""}`} data-done={c.done ? "1" : "0"}>
                <span className="tv-check-num" aria-label={c.done ? "done" : "not yet"}>
                  {c.done ? "✓" : c.step}
                </span>
                <span>{c.label}</span>
                {c.source ? <span className="tv-check-source">{c.source}</span> : null}
              </li>
            ))}
          </ol>
        </TraderSection>
      </div>

      {/* ---------- pipeline ---------- */}
      <ol className="tv-pipeline" aria-label="Pipeline">
        {(data.pipeline || []).map((p, i) => (
          <li key={p.key} className="tv-box tv-pipe" data-pipe={p.key}>
            <span className="tv-pipe-num">{i + 1}</span>
            <div>
              <div className="tv-eyebrow">{p.sourceEngine}</div>
              <div className="tv-pipe-name">{PIPE_NAMES[p.key] || humanize(p.key)}</div>
            </div>
            <TraderStatusChip status={normStatus(p.status)} />
          </li>
        ))}
      </ol>

      {/* ---------- engine cards ---------- */}
      <div className="tv-cards">
        {CARDS.map((c) => (
          <TraderCard
            key={c.key}
            title={c.title}
            question={c.question}
            section={sections[c.key]}
            forceOpen={allOpen}
            details={<CardDetails cardKey={c.key} section={sections[c.key]} />}
          >
            <CardExtras cardKey={c.key} section={sections[c.key]} />
          </TraderCard>
        ))}
      </div>

      {/* ---------- footer ---------- */}
      <footer className="tv-footer">
        <div className="tv-legend">
          <span>
            <TraderStatusChip status="READY" /> condition met
          </span>
          <span>
            <TraderStatusChip status="WAITING" /> not yet, nothing wrong
          </span>
          <span>
            <TraderStatusChip status="BLOCKED" /> a rule says no
          </span>
          <span>
            <TraderStatusChip status="INFO" /> context only
          </span>
          <span>
            <ShadowTag /> experimental value, evidence only
          </span>
        </div>
        <div className="tv-top-spacer" />
        <div>Paper trading only · no orders sent from this screen · final permission: {data.authority?.finalPermission || "Engine 6"}</div>
      </footer>
    </div>
  );
}

export default function TraderViewPage() {
  const tv = useTraderView("ES");
  return (
    <TraderViewView
      data={tv.data}
      err={tv.err}
      loading={tv.loading}
      refreshing={tv.refreshing}
      mock={tv.mock}
    />
  );
}
