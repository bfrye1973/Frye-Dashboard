// Engine 18 real-time panel v1 — PREVIEW page (hidden route, not in nav, not on the LIVE chart).
// Renders a synthetic fixture snapshot until the owner approves the panel and the live worker runs.
import React from "react";
import Engine18LivePanel from "../../components/engine18/Engine18LivePanel";
import fixture from "./engine18LiveFixture.json";

export default function Engine18LivePreviewPage() {
  return <Engine18LivePanel snapshot={fixture.snapshot} synthetic={!!fixture.synthetic} />;
}
