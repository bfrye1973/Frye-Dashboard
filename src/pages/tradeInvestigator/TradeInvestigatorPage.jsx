// Engine 12 Trade Investigator — /trade-investigator (hidden route).
// FORENSIC, READ-ONLY. Renders engine12.tradeInvestigator.investigation.v1
// exactly as the backend returns it. It never recomputes engine logic, never
// upgrades a status (INFERRED_PROGRESS is never shown as PASS), and has no
// order, engine-control, lock, broker, Replay, retention or compression action.

import React, { useEffect, useState } from "react";
import "./tradeInvestigator.css";
import {
  STRATEGIES,
  clearSession,
  fetchArchivedTimes,
  hasSession,
  investigate,
  redeemPairingCode,
  revokeSession,
  sessionExpiry,
} from "./investigatorClient";

/* Display labels are design text, not engine output. */
export const PIPELINE = [
  ["engine26A", "26A", "Location"],
  ["engine3", "3", "Price reaction"],
  ["engine4", "4", "Participation"],
  ["engine6", "6", "Permission"],
  ["engine26B", "26B", "Trade geometry"],
  ["engine7", "7", "Position sizing"],
  ["engine9", "9", "Management plan"],
  ["engine8", "8", "Execution"],
  ["engine10", "10", "Journal / lifecycle"],
];
const ENGINE_LABEL = Object.fromEntries(PIPELINE.map(([k, n, name]) => [k, "Engine " + n + " · " + name]));

const STATUS_LABEL = {
  PASS: "PASS",
  WAITING: "WAITING",
  BLOCKED: "BLOCKED",
  NOT_REACHED: "NOT REACHED",
  INFERRED_PROGRESS: "INFERRED PROGRESS",
  UNKNOWN: "UNKNOWN",
};
const STATUS_HELP = {
  PASS: "This engine's own stored fields prove it passed.",
  WAITING: "Recorded as waiting.",
  BLOCKED: "Recorded as blocked.",
  NOT_REACHED: "Not evaluated because an earlier engine stopped the pipeline.",
  INFERRED_PROGRESS: "The pipeline moved past this engine, but its own PASS is not proven. Not the same as PASS.",
  UNKNOWN: "Evidence is missing or not mapped. Nothing is assumed.",
};

const STATUS_SOURCE_LABEL = {
  ENGINE28A_RECORDED_FIRST_BLOCKER: "Engine 28A recorded first blocker",
  ENGINE_OWN_CANONICAL_GATE: "Own stored fields",
  ENGINE28A_RECORDED_PROGRESSION: "Engine 28A progression only",
  ENGINE_OWN_FIELDS: "Own stored fields",
  CANONICAL_FALLBACK: "Canonical fallback (no trusted 28A)",
  RECORD_ABSENT_UPSTREAM_STOPPED: "No record; upstream stopped",
  RECORD_ABSENT: "No record",
  DOWNSTREAM_PROGRESS_OBSERVED: "Downstream progress only",
};

const UNKNOWN = "UNKNOWN";
const has = (v) => v !== null && v !== undefined && v !== "";

export function fmtAz(iso) {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d) + " AZ";
}
const fmtHHMM = (t) => (t && /^\d{4}$/.test(t) ? t.slice(0, 2) + ":" + t.slice(2) : t || UNKNOWN);
const fmtNum = (v, digits = 2) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: digits }) : UNKNOWN);
const fmtMoney = (v) => (typeof v === "number" ? (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : UNKNOWN);
const known = (k) => (k && k.status === "KNOWN" ? k.value : null);

function StatusChip({ status }) {
  const s = STATUS_LABEL[status] ? status : "UNKNOWN";
  return (
    <span className={"ti-chip ti-chip--" + s} data-status={s} title={STATUS_HELP[s]}>
      {STATUS_LABEL[s]}
    </span>
  );
}

function Value({ v, money, digits }) {
  if (!has(v)) return <span className="ti-unknown">{UNKNOWN}</span>;
  if (money) return <>{fmtMoney(v)}</>;
  if (typeof v === "number") return <>{fmtNum(v, digits)}</>;
  if (typeof v === "boolean") return <>{v ? "true" : "false"}</>;
  return <>{String(v)}</>;
}

function Codes({ list, kind }) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return (
    <div className="ti-codes">
      {list.map((c, i) => (
        <code key={kind + i} className={"ti-code ti-code--" + kind}>{String(c)}</code>
      ))}
    </div>
  );
}

function DecisionFacts({ decision }) {
  if (!decision || typeof decision !== "object") return <span className="ti-unknown">No stored decision</span>;
  const rows = Object.entries(decision).filter(([, v]) => has(v) && !(Array.isArray(v) && v.length === 0));
  if (rows.length === 0) return <span className="ti-unknown">No stored values</span>;
  return (
    <dl className="ti-facts">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function ShadowBlock({ shadow }) {
  if (!Array.isArray(shadow) || shadow.length === 0) return null;
  return (
    <div className="ti-shadow" data-authority="SHADOW">
      {shadow.map((s, i) => (
        <div key={i} className="ti-shadow__item">
          <div className="ti-shadow__head">
            <span className="ti-badge ti-badge--shadow">SHADOW</span>
            <span>{s.version}</span>
            <span className="ti-muted">comparison only · never a gate, never the blocker</span>
          </div>
          <DecisionFacts decision={s.decision} />
        </div>
      ))}
    </div>
  );
}

function EngineRow({ row, isBlocker }) {
  const status = STATUS_LABEL[row.status] ? row.status : "UNKNOWN";
  return (
    <li className={"ti-engine" + (isBlocker ? " ti-engine--blocker" : "")} data-engine={row.engine} data-status={status}>
      <div className="ti-engine__head">
        <span className="ti-engine__name">{ENGINE_LABEL[row.engine] || row.engine}</span>
        <span className="ti-badge ti-badge--canonical">CANONICAL</span>
        <StatusChip status={status} />
        {isBlocker && <span className="ti-badge ti-badge--blocker">FIRST BLOCKER</span>}
        {row.downstreamOfFirstBlocker && <span className="ti-muted">after first blocker</span>}
      </div>
      <div className="ti-engine__meta">
        <span>raw: <code>{has(row.rawStatus) ? String(row.rawStatus) : UNKNOWN}</code></span>
        <span>source: {STATUS_SOURCE_LABEL[row.statusSource] || row.statusSource || UNKNOWN}</span>
        <span>evaluated: {row.evaluatedAt ? fmtAz(row.evaluatedAt) + (row.evaluatedAtField ? " (" + row.evaluatedAtField + ")" : "") : UNKNOWN}</span>
        {has(row.engine28aRecordedStage) && <span>28A stage: <code>{row.engine28aRecordedStage}</code></span>}
      </div>
      <Codes list={row.blockers} kind="blocker" />
      <details className="ti-details">
        <summary>Stored decision · reason codes</summary>
        <DecisionFacts decision={row.decision} />
        <Codes list={row.reasonCodes} kind="reason" />
        {row.sourcePath && <div className="ti-muted ti-path">Replay path: strategies.&lt;lane&gt;.{row.sourcePath}</div>}
      </details>
      <ShadowBlock shadow={row.shadow} />
    </li>
  );
}

function EventList({ title, events, evidenceMatched }) {
  return (
    <div className="ti-events" data-evidence={evidenceMatched ? "MATCHED" : "UNKNOWN"}>
      <h4>{title}</h4>
      {!events || events.length === 0 ? (
        <div className="ti-unknown">
          {evidenceMatched
            ? "None in the matched Engine 8 / Journal records"
            : "UNKNOWN: no matched Engine 8 / Journal evidence (absence is not proof that nothing happened)"}
        </div>
      ) : (
        <ol>
          {events.map((e, i) => (
            <li key={i}>
              <span className="ti-events__time">{fmtAz(e.eventTime)}</span>
              <code>{e.eventType}</code>
              {has(e.price) && <span>@ {fmtNum(e.price)}</span>}
              {has(e.avgPrice) && <span>@ {fmtNum(e.avgPrice)}</span>}
              {has(e.qty) && <span>qty {e.qty}</span>}
              {has(e.qtyClosed) && <span>closed {e.qtyClosed}</span>}
              {has(e.remainingQty) && <span>remaining {e.remainingQty}</span>}
              {has(e.exitReason) && <span>{e.exitReason}</span>}
              <span className="ti-muted">{e.source}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Pure display of one investigation response. */
export function TradeInvestigatorView({ data, roundTripMs }) {
  if (!data) return null;
  if (data.ok === false) {
    return (
      <div className="ti-card ti-error" data-error={data.error}>
        <strong>{data.error || "REQUEST_FAILED"}</strong>
        {data.nextArchivedTime && <div>Next archived snapshot: {fmtHHMM(data.nextArchivedTime)} (a later state; not used)</div>}
        {data.latestBefore && <div>Latest snapshot before: {fmtHHMM(data.latestBefore)} ({data.offsetMinutes} min earlier, outside window)</div>}
        {Array.isArray(data.errors) && <Codes list={data.errors.map((e) => e.field + ": " + e.error)} kind="blocker" />}
      </div>
    );
  }
  const k = data.knownAtDecision || {};
  const fb = k.firstBlocker || {};
  const geo = k.tradeGeometry || {};
  const ex = k.executionAtDecision || {};
  const exe = data.execution || {};
  const out = data.outcome || {};
  const trade = out.trade || null;
  const flags = (data.flags || []).map((f) => f.flag);

  return (
    <div className="ti-result" data-schema={data.schema}>
      <section className="ti-card ti-summary" aria-label="Summary">
        <div className="ti-summary__grid">
          <div><div className="ti-label">ES price</div><div className="ti-big"><Value v={known(k.price)} /></div></div>
          <div><div className="ti-label">Direction</div><div className="ti-big"><Value v={known(k.direction)} /></div></div>
          <div className="ti-summary__blocker" data-first-blocker={fb.engine || "NONE"}>
            <div className="ti-label">First blocker</div>
            <div className="ti-big">
              {fb.engine === null || fb.engine === undefined
                ? "None recorded"
                : fb.engine === "UNKNOWN" ? UNKNOWN : ENGINE_LABEL[fb.engine] || fb.engine}{" "}
              {fb.status && <StatusChip status={fb.status} />}
            </div>
            <div className="ti-reason"><code>{fb.rootCause || UNKNOWN}</code></div>
            <Codes list={fb.blockers} kind="blocker" />
            <div className="ti-muted">
              source: {fb.source === "ENGINE28A_RECORDED" ? "Engine 28A recorded diagnosis" : fb.source === "CANONICAL_FALLBACK" ? "canonical fallback" : "none (refused / unknown)"}
              {k.engine28a && <> · 28A trusted: {String(!!k.engine28a.trusted)}</>}
            </div>
          </div>
          <div>
            <div className="ti-label">Replay snapshot</div>
            <div>requested {fmtHHMM(data.selection?.requestedTime)} → used <strong>{fmtHHMM(data.selection?.selectedTime)}</strong> ({data.selection?.selection})</div>
            <div className="ti-muted">snapshot {fmtAz(k.snapshotTime)} · decision {fmtAz(k.decisionTime)}</div>
          </div>
        </div>
        <div className="ti-provenance" data-provenance>
          <span className="ti-badge ti-badge--evidence">EVIDENCE</span>
          <span>Replay {data.replay?.replayRelativePath || UNKNOWN}</span>
          <span title={data.replay?.sha256 || ""}>SHA256 {data.replay?.sha256 ? data.replay.sha256.slice(0, 16) + "…" : UNKNOWN}</span>
          <span>{fmtNum(data.replay?.byteLength, 0)} bytes</span>
          <span>registry {data.provenance?.registryEvidenceStatus || UNKNOWN}</span>
          <span>engines re-run: {String(!!data.provenance?.enginesRerun)}</span>
          {typeof roundTripMs === "number" && <span>{roundTripMs} ms</span>}
        </div>
        {flags.length > 0 && <Codes list={flags} kind="flag" />}
      </section>

      <section className="ti-card" aria-label="Pipeline">
        <h3>Pipeline · 26A → 3 → 4 → 6 → 26B → 7 → 9 → 8 → 10</h3>
        <ol className="ti-pipeline">
          {PIPELINE.map(([key]) => {
            const row = (k.pipeline || []).find((r) => r.engine === key) || { engine: key, status: "UNKNOWN", shadow: [] };
            return <EngineRow key={key} row={row} isBlocker={fb.engine === key} />;
          })}
        </ol>
      </section>

      <section className="ti-card" aria-label="Trade details">
        <h3>Trade details</h3>
        <div className="ti-trade">
          <div>
            <h4>Plan at decision (stored values)</h4>
            <dl className="ti-facts">
              <dt>Entry</dt><dd><Value v={known(geo.entry)} /></dd>
              <dt>Stop</dt><dd><Value v={known(geo.stop)} /></dd>
              <dt>Target 1</dt><dd><Value v={known(geo.target1)} /></dd>
              <dt>Target 2</dt><dd><Value v={known(geo.target2)} /></dd>
              <dt>Target 3</dt><dd><Value v={known(geo.target3)} /></dd>
              <dt>Contracts</dt><dd><Value v={known(geo.contracts)} /></dd>
              <dt>Dollar risk</dt><dd><Value v={known(geo.dollarRisk)} money /></dd>
            </dl>
          </div>
          <div>
            <h4>Execution at decision (Replay)</h4>
            <dl className="ti-facts">
              <dt>Engine 8 status</dt><dd><Value v={known(ex.status)} /></dd>
              <dt>Order created</dt><dd><Value v={known(ex.orderCreated)} /></dd>
              <dt>Order ID</dt><dd><Value v={known(ex.orderId)} /></dd>
              <dt>Trade ID</dt><dd><Value v={known(ex.tradeId)} /></dd>
            </dl>
            <div className="ti-muted">{ex.note}</div>
          </div>
          <div data-lifecycle={out.lifecycle || UNKNOWN}>
            <h4>After decision (Engine 8 store · Journal)</h4>
            <dl className="ti-facts">
              <dt>Engine 8 match</dt><dd>{exe.status || UNKNOWN} · {exe.lifecycle || UNKNOWN}</dd>
              <dt>Entry fill</dt><dd>{exe.entryFill?.status || UNKNOWN}{has(exe.entryFill?.avgPrice) ? " @ " + fmtNum(exe.entryFill.avgPrice) : ""}</dd>
              <dt>Journal</dt><dd>{out.status || UNKNOWN} · {out.lifecycle || UNKNOWN}</dd>
              <dt>Trade status</dt><dd><Value v={trade?.status} /></dd>
              <dt>Remaining qty</dt><dd><Value v={trade?.qty?.remainingQty} /></dd>
              <dt>Exit</dt><dd><Value v={trade?.outcome?.closeTime ? fmtAz(trade.outcome.closeTime) : null} /></dd>
              <dt>Realized P&amp;L</dt><dd><Value v={trade?.outcome?.realizedPnL} money />{trade?.outcome?.pnlBasis ? " (gross, as recorded)" : ""}</dd>
            </dl>
            <div className="ti-muted">
              Engine 8 and the Journal are changeable stores with no retention guarantee
              ({out.retentionGuarantee || exe.retentionGuarantee || "NONE_DEFINED"}). Missing evidence is UNKNOWN, not "no trade".
            </div>
          </div>
        </div>
        <EventList title="Same-identity events before the decision" events={data.priorEvents} evidenceMatched={exe.lifecycle === "MATCHED" || out.lifecycle === "MATCHED"} />
        <EventList title="Events after the decision (fills, reductions, exit)" events={data.subsequentEvents} evidenceMatched={exe.lifecycle === "MATCHED" || out.lifecycle === "MATCHED"} />
      </section>
    </div>
  );
}

function todayAz() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts;
}

export default function TradeInvestigatorPage() {
  const [paired, setPaired] = useState(hasSession());
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");
  const [form, setForm] = useState({ date: todayAz(), time: "", strategyId: STRATEGIES[0], candidateId: "", planId: "", tradeId: "" });
  const [times, setTimes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    fetchArchivedTimes(form.date).then((t) => live && setTimes(t));
    return () => { live = false; };
  }, [form.date]);

  useEffect(() => () => clearSession(), []);

  async function onPair(e) {
    e.preventDefault();
    setPairError("");
    try {
      await redeemPairingCode(pairingCode);
      setPairingCode("");
      setPaired(true);
    } catch (err) {
      setPairError(String(err.message || err));
    }
  }

  async function onInvestigate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await investigate(form);
      setResult(r);
      if (r.status === 401) setPaired(false);
    } catch (err) {
      setResult({ status: 0, body: { ok: false, error: String(err.message || err) } });
    } finally {
      setBusy(false);
    }
  }

  async function onEndSession() {
    await revokeSession();
    setPaired(false);
    setResult(null);
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="ti">
      <header className="ti-header">
        <h2>Trade Investigator</h2>
        <span className="ti-badge ti-badge--readonly">READ-ONLY · FORENSIC</span>
        {paired && <span className="ti-muted">session until {fmtAz(sessionExpiry())}</span>}
        {paired && <button type="button" className="ti-link" onClick={onEndSession}>End session</button>}
      </header>

      {!paired ? (
        <form className="ti-card ti-pair" onSubmit={onPair}>
          <label htmlFor="ti-pair">One-time pairing code</label>
          <input id="ti-pair" value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste the code issued from the Render Shell" />
          <button type="submit" disabled={!pairingCode.trim()}>Start read-only session</button>
          {pairError && <div className="ti-error">{pairError}</div>}
          <div className="ti-muted">The backend access key never enters this page. The session token is kept in memory only and is cleared on reload.</div>
        </form>
      ) : (
        <form className="ti-card ti-controls" onSubmit={onInvestigate}>
          <label>Date<input type="date" value={form.date} onChange={set("date")} required /></label>
          <label>
            Archived time
            {times.length > 0 ? (
              <select value={form.time} onChange={set("time")} required>
                <option value="">Select…</option>
                {times.map((t) => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
              </select>
            ) : (
              <input value={form.time} onChange={set("time")} placeholder="HHMM" pattern="\d{4}" required />
            )}
          </label>
          <label>Strategy<select value={form.strategyId} onChange={set("strategyId")}>{STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Candidate ID<input value={form.candidateId} onChange={set("candidateId")} placeholder="optional" /></label>
          <label>Plan ID<input value={form.planId} onChange={set("planId")} placeholder="optional" /></label>
          <label>Trade ID<input value={form.tradeId} onChange={set("tradeId")} placeholder="optional" /></label>
          <button type="submit" disabled={busy || !form.time}>{busy ? "Investigating…" : "Investigate"}</button>
        </form>
      )}

      {result && <TradeInvestigatorView data={result.body} roundTripMs={result.roundTripMs} />}
    </div>
  );
}
