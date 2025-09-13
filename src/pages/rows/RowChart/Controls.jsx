export default function Controls({ symbols, timeframes, value, onChange, onTest }) {
  const { symbol, timeframe, range, disabled } = value;
  return (
    <div style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 12px', borderBottom:'1px solid #2b2b2b', background:'#111' }}>
      <div style={{ fontWeight:600, color:'#e5e7eb' }}>Chart</div>
      <label style={{ color:'#9ca3af' }}>Symbol</label>
      <select value={symbol} disabled={disabled} onChange={(e)=>onChange({ symbol:e.target.value })} style={sel}/>
      <label style={{ color:'#9ca3af' }}>Timeframe</label>
      <select value={timeframe} disabled={disabled} onChange={(e)=>onChange({ timeframe:e.target.value })} style={sel}/>
      <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
        {[50,100,200].map(n=>(
          <button key={n} disabled={disabled} onClick={()=>onChange({ range: range===n? null:n })} style={btn(range===n)}>{n}</button>
        ))}
        {onTest && <button onClick={onTest} style={testBtn}>Test Fetch</button>}
      </div>
      <style>{`.controls select{}`}</style>
    </div>
  );
}
const sel = { background:'#0b0b0b', color:'#e5e7eb', border:'1px solid #2b2b2b', borderRadius:8, padding:'6px 8px' };
const btn = (active)=>({ background: active?'#eab308':'#0b0b0b', color: active?'#111':'#e5e7eb', border:'1px solid #2b2b2b', borderRadius:8, padding:'6px 10px', fontWeight:600, cursor:'pointer' });
const testBtn = { background:'#eab308', color:'#111', border:'none', borderRadius:8, padding:'6px 10px', fontWeight:700, cursor:'pointer' };
