// Trader View v1 — small local components.
// Display only: everything rendered here comes from the traderView.v1 contract.
// Formatting helpers change how text looks (casing, number formatting); they
// never reinterpret engine output or apply thresholds.

import React, { useEffect, useState } from "react";

const STATUS_WORDS = ["READY", "WAITING", "BLOCKED", "INFO", "UNAVAILABLE"];

export function normStatus(s) {
  const up = String(s || "").toUpperCase();
  return STATUS_WORDS.includes(up) ? up : "UNAVAILABLE";
}

/** "PUSHING_HIGHER" -> "Pushing higher". Pure casing; no meaning changes. */
export function humanize(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v !== "string") return String(v);
  const toWords = (t) => {
    const s = t.replace(/_/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  if (/^[A-Z0-9_]+$/.test(v)) return v.includes("_") ? toWords(v) : v;
  // ENUM_TOKENS embedded in a longer value, e.g. "57 · MIXED_BULLISH"
  return v.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, toWords);
}

export function fmtAzTime(iso) {
  if (!iso) return "—";
  try {
    const d = typeof iso === "number" ? new Date(iso) : new Date(String(iso));
    if (Number.isNaN(d.getTime())) return "—";
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Phoenix",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(d) + " AZ"
    );
  } catch {
    return "—";
  }
}

export function fmtPrice(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------- status chip ---------------- */
export function TraderStatusChip({ status, children }) {
  const s = String(status || "").toUpperCase();
  return (
    <span className={`tv-chip tv-chip--${s || "UNAVAILABLE"}`} data-status={s}>
      {children || s || "UNAVAILABLE"}
    </span>
  );
}

export function ShadowTag() {
  return (
    <span className="tv-chip tv-chip--SHADOW" title="Engine 4 v2 shadow value — evidence only, not authority">
      Shadow
    </span>
  );
}

/* ---------------- freshness badge (the only one on the page) ---------------- */
export function TraderFreshnessBadge({ freshness, err, refreshing, mock = false }) {
  // Mock mode shows the saved sample: never label it LIVE.
  const status = mock ? "SAMPLE" : String(freshness?.status || "UNKNOWN").toUpperCase();
  const notes = Array.isArray(freshness?.notes) ? freshness.notes : [];
  const title = [
    freshness?.snapshotAsOf ? `Snapshot ${fmtAzTime(freshness.snapshotAsOf)}` : null,
    freshness?.meterAvailable === false ? "ES Master meter unavailable" : null,
    ...notes.map(String),
    err ? `Last refresh failed: ${err} (showing last good data)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="tv-freshness" title={title || undefined}>
      <TraderStatusChip status={status}>
        {status}
      </TraderStatusChip>
      {refreshing ? <span className="tv-faint"> refreshing…</span> : null}
    </span>
  );
}

/* ---------------- key/value tile ---------------- */
export function ResearchTag() {
  return (
    <span className="tv-chip tv-chip--RESEARCH" title="Owner working research — not confirmed, not the authorized count, never a trade signal">
      Research
    </span>
  );
}

export function TraderKeyValue({ label, value }) {
  const raw = String(label ?? "");
  const isShadow = /\(shadow\)/i.test(raw);
  const isResearch = /\(research\)/i.test(raw);
  const clean = raw.replace(/\s*\((shadow|research)\)\s*/i, " ").trim();
  return (
    <div className={`tv-kv ${isResearch ? "tv-kv--research" : ""}`}>
      <div className="tv-kv-label">
        {clean}
        {isShadow ? <ShadowTag /> : null}
        {isResearch ? <ResearchTag /> : null}
      </div>
      <div className="tv-kv-value">{humanize(value)}</div>
    </div>
  );
}

/* ---------------- disclosure ("Show details") ---------------- */
export function TraderDisclosure({ label = "Show details", forceOpen = false, children }) {
  const [open, setOpen] = useState(!!forceOpen);
  useEffect(() => setOpen(!!forceOpen), [forceOpen]);
  return (
    <details
      className="tv-details"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="tv-btn">{open ? "Hide details" : label}</summary>
      <div className="tv-details-body">{children}</div>
    </details>
  );
}

/* Generic details rows: key -> value, nested objects one level, then compact JSON. */
export function DetailsRows({ obj, skip = [] }) {
  if (!obj || typeof obj !== "object") return null;
  const rows = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (skip.includes(k)) return;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.entries(v).forEach(([k2, v2]) => rows.push([`${k} · ${k2}`, v2]));
    } else {
      rows.push([k, v]);
    }
  });
  return rows.map(([k, v]) => (
    <div className="tv-details-row" key={k}>
      <span className="tv-details-key">{k}</span>
      <span className="tv-details-val">
        {v === null || v === undefined
          ? "—"
          : Array.isArray(v)
          ? v.length
            ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")
            : "none"
          : typeof v === "object"
          ? JSON.stringify(v)
          : String(v)}
      </span>
    </div>
  ));
}

/* ---------------- section wrapper ---------------- */
export function TraderSection({ eyebrow, children, className = "" }) {
  return (
    <section className={`tv-box ${className}`}>
      {eyebrow ? <div className="tv-eyebrow">{eyebrow}</div> : null}
      {children}
    </section>
  );
}

/* ---------------- engine card ---------------- */
export function TraderCard({ title, question, section, forceOpen, children, details }) {
  // Backend marks a missing engine as status INFO + state UNAVAILABLE.
  const unavailable =
    !section ||
    String(section.state || "").toUpperCase() === "UNAVAILABLE" ||
    normStatus(section.status) === "UNAVAILABLE";
  const status = unavailable ? "UNAVAILABLE" : normStatus(section.status);
  const facts = Array.isArray(section?.facts) ? section.facts : [];

  return (
    <article className="tv-box tv-card" data-section={section?.key || title} data-status={status}>
      <header className="tv-card-head">
        <div>
          <div className="tv-eyebrow">{title}</div>
          <div className="tv-card-question">{question}</div>
        </div>
        <TraderStatusChip status={status} />
      </header>

      {unavailable ? (
        <div className="tv-card-answer">Unavailable — this engine's read is missing from the snapshot.</div>
      ) : (
        <>
          <div className="tv-card-answer">{section.label || humanize(section.state)}</div>
          {section.plainEnglish ? <div className="tv-card-sub">{section.plainEnglish}</div> : null}

          {facts.length ? (
            <div className="tv-facts">
              {facts.map((f, i) => (
                <TraderKeyValue key={`${f.label}-${i}`} label={f.label} value={f.value} />
              ))}
            </div>
          ) : null}

          {children}

          {section.waitingFor ? (
            <div className="tv-waiting">
              Waiting for: <strong>{section.waitingFor}</strong>
            </div>
          ) : null}

          <div className="tv-card-foot">
            <TraderDisclosure forceOpen={forceOpen}>
              {details}
              <div className="tv-details-row">
                <span className="tv-details-key">source</span>
                <span className="tv-details-val">
                  {section.sourceEngine} · {section.sourcePath || "—"}
                </span>
              </div>
              <div className="tv-details-row">
                <span className="tv-details-key">source time</span>
                <span className="tv-details-val">
                  {fmtAzTime(section.sourceTimestamp)}
                  {typeof section.sourceAgeMs === "number"
                    ? ` (${Math.round(section.sourceAgeMs / 1000)}s old)`
                    : ""}
                </span>
              </div>
              <div className="tv-details-note">Display only. This card explains {section.sourceEngine}; it decides nothing.</div>
            </TraderDisclosure>
          </div>
        </>
      )}
    </article>
  );
}
