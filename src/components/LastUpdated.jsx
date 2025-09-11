import React from "react";

export function LastUpdated({ ts, tz = "UTC" }) {
  if (!ts) return <span className="small muted">—</span>;
  const t = new Date(ts);
  const diffMin = Math.floor((Date.now() - t.getTime()) / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const remMin  = diffMin % 60;

  let label = "";
  if (diffMin < 1) label = "just now";
  else if (diffMin < 60) label = `${diffMin}m ago`;
  else if (diffMin < 1440) label = remMin === 0 ? `${diffHr}h ago` : `${diffHr}h ${remMin}m ago`;
  else {
    const opts = { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false, timeZone: tz };
    label = new Intl.DateTimeFormat("en-CA", opts).format(t).replace(",", "");
  }
  return <span className="small muted">{label}</span>;
}
