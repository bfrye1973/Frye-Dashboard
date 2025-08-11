import { useEffect, useState } from 'react';
import { listStrategies, getLiveSignal } from '../services/feeds';

export default function LiveFeedsPanel() {
  const [strategies, setStrategies] = useState([]);
  const [signal, setSignal] = useState(null);
  const [symbol, setSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStrategies(listStrategies());
  }, []);

  async function fetchSignal() {
    setLoading(true);
    const s = await getLiveSignal(symbol.trim() || 'SPY');
    setSignal(s);
    setLoading(false);
  }

  const card = {
    background: 'rgba(20,20,20,0.92)',
    border: '1px solid rgba(255,0,0,0.3)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 0 15px rgba(255,0,0,0.15)',
    borderRadius: 12,
    padding: 20,
    color: '#e8e8e8',
    fontFamily: 'Segoe UI, sans-serif'
  };
  const title = {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 14,
    color: '#ff2d2d',
    textShadow: '0 0 8px rgba(255,20,20,0.4)'
  };
  const box = {
    background: 'rgba(10,10,10,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16
  };
  const input = {
    background: '#0e0e0e',
    color: '#e8e8e8',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '8px 10px',
    outline: 'none',
    width: 120,
    marginRight: 8
  };
  const button = {
    background: 'linear-gradient(180deg,#ff3b3b,#b20c0c)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.15s ease'
  };
  const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13 };

  return (
    <div style={card}>
      <div style={title}>Live Feeds / Strategy Test</div>

      <div style={box}>
        <div style={{ opacity: 0.85, marginBottom: 6 }}>Strategies</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
          {strategies.map(s => (
            <li key={s.id}>
              {s.name} <span style={{ opacity: 0.6 }}>({s.version})</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <input
          style={input}
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol"
        />
        <button
          style={button}
          onClick={fetchSignal}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Get Live Signal'}
        </button>
      </div>

      {signal && (
        <div style={box}>
          <div style={{ opacity: 0.85, marginBottom: 6 }}>Latest Signal</div>
          <pre style={{ ...mono, margin: 0 }}>
            {JSON.stringify(signal, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
