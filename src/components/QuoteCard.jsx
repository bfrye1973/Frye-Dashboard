// src/components/QuoteCard.jsx
import React, { useState } from "react";
import { getQuote } from "../services/api";

export default function QuoteCard() {
  const [symbol, setSymbol] = useState("SPY");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchQuote() {
    try {
      setLoading(true);
      const data = await getQuote(symbol);
      setText(JSON.stringify(data, null, 2));
    } catch (err) {
      setText(`Error: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") fetchQuote();
  }

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 12,
        maxWidth: 520,
        marginTop: 16,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Quote</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Symbol (e.g., SPY)"
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={fetchQuote}
          disabled={loading}
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {loading ? "Loading…" : "Fetch"}
        </button>
      </div>

      <pre
        style={{
          background: "#0b1320",
          color: "#d9e1f2",
          padding: 12,
          borderRadius: 8,
          minHeight: 60,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {text || "Click Fetch to get data"}
      </pre>
    </div>
  );
}
