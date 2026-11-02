// Engine 2F: one ES Fibonacci canvas with independently controlled degrees.
const ORDER = ["primary", "intermediate", "minor", "minute", "micro"];
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
    if (!visible.length) {canvas?.remove(); canvas = null; return;}
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
