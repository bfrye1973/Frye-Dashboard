import { useEffect, useRef } from "react";

export default function TimelineOverlay({ chart, container }) {
  const wrap = useRef(null), hours = useRef(null), dates = useRef(null);

  useEffect(() => {
    if (!container) return;
    const tl = document.createElement('div');
    tl.style.position='absolute'; tl.style.left=0; tl.style.right=0; tl.style.bottom=0; tl.style.height='42px'; tl.style.pointerEvents='none';
    const h = document.createElement('div'), d = document.createElement('div');
    Object.assign(h.style, { height:'20px', borderTop:'1px solid #2b2b2b', position:'relative', color:'#9ca3af', fontSize:'11px' });
    Object.assign(d.style, { height:'22px', borderTop:'1px solid #2b2b2b', position:'relative', color:'#9ca3af', fontSize:'11px' });
    tl.appendChild(h); tl.appendChild(d); container.appendChild(tl);
    wrap.current = tl; hours.current = h; dates.current = d;
    return () => tl.remove();
  }, [container]);

  useEffect(() => {
    if (!chart || !wrap.current) return;
    const ts = chart.timeScale();
    const re = () => {
      if (!hours.current || !dates.current) return;
      hours.current.innerHTML = ""; dates.current.innerHTML = "";
      const vr = ts.getVisibleRange(); if (!vr) return;
      const place = (el, t) => { const x = ts.timeToCoordinate(t); if (x==null) return; el.style.position='absolute'; el.style.left=`${Math.round(x)-20}px`; el.style.whiteSpace='nowrap'; };
      const span = vr.to - vr.from; let stepH = 1; if (span>86400*3) stepH=6; else if (span>86400) stepH=2;
      const startH = Math.floor(vr.from/3600)*3600;
      for(let t=startH; t<=vr.to; t+=stepH*3600){ const d=new Date(t*1000); const lab=document.createElement('div'); lab.textContent=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; place(lab,t); hours.current.appendChild(lab); const tick=document.createElement('div'); Object.assign(tick.style,{position:'absolute',width:'1px',background:'#2b2b2b',top:'-6px',bottom:'0'}); place(tick,t); hours.current.appendChild(tick); }
      const startD = Math.floor(vr.from/86400)*86400;
      for(let t=startD; t<=vr.to; t+=86400){ const d=new Date(t*1000); const lab=document.createElement('div'); lab.textContent=`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; lab.style.fontWeight=600; place(lab, t+3600); dates.current.appendChild(lab); const line=document.createElement('div'); Object.assign(line.style,{position:'absolute',width:'1px',background:'#3a3a3a',top:'0',bottom:'0'}); place(line,t); dates.current.appendChild(line); }
    };
    const a = ts.subscribeVisibleTimeRangeChange(re);
    const b = ts.subscribeVisibleLogicalRangeChange(re);
    re();
    return () => { try{ ts.unsubscribeVisibleTimeRangeChange(a); ts.unsubscribeVisibleLogicalRangeChange(b);}catch{} };
  }, [chart]);

  return null;
}
