import { ownerAnchorsForDegree } from "../ownerWaveAnchors";
// Engine 2F: one ES Fibonacci canvas with independently controlled degrees.
const ORDER = ["primary", "intermediate", "minor", "minute", "subminute", "micro", "submicro"];
export default function Engine22FibLayersOverlay({chart, priceSeries, chartContainer, packet, toggles = {}, styles = {}}) {
  if (!chart || !priceSeries || !chartContainer) return {seed(){},update(){},destroy(){}};
  let canvas = null, frame = 0, disposed = false;
  const ts = chart.timeScale();
  const ensure = () => {
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.dataset.engine22FibLayers = "unified";
    Object.assign(canvas.style, {position:"absolute",inset:"0",width:"100%",height:"100%",pointerEvents:"none",zIndex:"80"});
    chartContainer.appendChild(canvas);
    return canvas;
  };
  const draw = () => {
    frame = 0;
    if (disposed) return;
    const visible = ORDER.flatMap(degree => {
      const d = packet?.degrees?.[degree];
      return toggles[degree] && d?.available ? d.levels.map(level => ({degree,level,style:styles[degree] || {}})) : [];
    });
    const waveEnabled = ORDER.some(degree => toggles[degree] && (styles[degree]?.showWaveLines || styles[degree]?.showWaveLabels));
    if (!visible.length && !waveEnabled) {canvas?.remove(); canvas = null; return;}
    const rect = chartContainer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const c = ensure(), dpr = window.devicePixelRatio || 1;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,rect.width,rect.height);
    for (const {degree,level,style} of visible) {
      const y = priceSeries.priceToCoordinate(level.price);
      if (!Number.isFinite(y) || y < 0 || y > rect.height) continue;
      const color = style.color || "#f472b6";
      if (style.showExtensions === false) continue;
      ctx.strokeStyle = color;
      ctx.lineWidth = Number.isFinite(style.lineWidth) ? style.lineWidth : 2;
      ctx.setLineDash([10,6]);
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();
      const font = Number.isFinite(style.fontPx) ? style.fontPx : 12;
      ctx.font = `600 ${font}px system-ui`;
      const label = `${degree.toUpperCase()} ${level.ratio}  ${level.price.toFixed(2)}`;
      const width = ctx.measureText(label).width + 16;
      const x = Math.max(4,rect.width - width - 90);
      ctx.fillStyle = "rgba(0,0,0,.8)";
      ctx.fillRect(x,y-12,width,24);
      ctx.fillStyle = color;ctx.fillText(label,x+8,y+5);
    }
    // The manual wave controls use only owner-approved time/price anchors.
    // No wave pivot is inferred and the permanent owner-anchor overlay is untouched.
    for (const degree of ORDER) {
      if (!toggles[degree]) continue;
      const style = styles[degree] || {};
      if (!style.showWaveLines && !style.showWaveLabels) continue;
      const anchors = ownerAnchorsForDegree(degree)
        .map(a=>({a,x:ts.timeToCoordinate(a.timeSec),y:priceSeries.priceToCoordinate(a.price)}))
        .filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))
        .sort((a,b)=>a.a.timeSec-b.a.timeSec);
      if (style.showWaveLines && anchors.length>1) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = style.waveLineColor || style.color || "#e2e8f0";
        ctx.lineWidth = Number.isFinite(style.waveLineWidth) ? style.waveLineWidth : 2;
        ctx.moveTo(anchors[0].x,anchors[0].y);
        for (const p of anchors.slice(1)) ctx.lineTo(p.x,p.y);
        ctx.stroke();
      }
      if (style.showWaveLabels) {
        ctx.font = "600 " + (style.waveLabelFontPx || style.fontPx || 12) + "px system-ui";
        ctx.fillStyle = style.waveLabelColor || style.color || "#e2e8f0";
        for (const p of anchors) {
          if (p.x>=0 && p.x<=rect.width && p.y>=0 && p.y<=rect.height)
            ctx.fillText(p.a.label + " " + p.a.price.toFixed(2),p.x+7,p.y-8);
        }
      }
    }
  };
  const schedule = () => {if (!disposed && !frame) frame = requestAnimationFrame(draw);};
  const ro = new ResizeObserver(schedule);
  ro.observe(chartContainer);
  ts.subscribeVisibleTimeRangeChange(schedule);
  ts.subscribeVisibleLogicalRangeChange(schedule);
  const onScale = () => schedule();
  chart.subscribeCrosshairMove(onScale);
  return {
    seed:schedule,update:schedule,
    destroy() {
      disposed = true;
      if(frame) cancelAnimationFrame(frame);
      ro.disconnect();
      ts.unsubscribeVisibleTimeRangeChange(schedule);
      ts.unsubscribeVisibleLogicalRangeChange(schedule);
      chart.unsubscribeCrosshairMove(onScale);
      canvas?.remove();canvas=null;
    }
  };
}
