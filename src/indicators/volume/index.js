// src/indicators/volume/index.js
// Volume histogram pane (SEPARATE) with proper autoscale

const DEF = {
  upColor:   "#22c55e",  // green
  downColor: "#ef4444",  // red
  neutral:   "#94a3b8",
  opacity:   1.0,        // 0.0–1.0 if you want transparency
};

function volCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const bars = [];
  let vmax = 0;

  for (const c of candles || []) {
    const v = Number(c.volume ?? 0);
    const up = (c.close ?? 0) >= (c.open ?? 0);
    bars.push({
      time: c.time,
      value: v,
      color: up ? o.upColor : o.downColor,
    });
    if (v > vmax) vmax = v;
  }

  // keep a little headroom so bars are clearly visible
  const ymax = vmax > 0 ? vmax * 1.1 : 1;

  return { bars, ymax, opts: o };
}

function volAttach(chartApi, seriesMap, result, inputs) {
  const o = { ...DEF, ...(inputs || {}) };

  const hist = chartApi.addHistogramSeries({
    priceLineVisible: false,
    priceFormat: { type: "volume" },     // correct axis formatting
    // margins so bars sit comfortably inside the pane
    scaleMargins: { top: 0.1, bottom: 0.1 },
    // fallback bar color (per-bar color overrides this)
    color: o.neutral,
  });
  seriesMap.set("vol", hist);

  // lock autoscale 0..ymax computed from data
  const ymax = result.ymax || 1;
  hist.autoscaleInfoProvider = () => ({
    priceRange: { minValue: 0, maxValue: ymax },
  });

  // apply opacity by blending per-bar colors (if desired)
  if (o.opacity < 1) {
    const withOpacity = (hex) => {
      // expand 6-digit hex to rgba with given opacity
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return hex;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      return `rgba(${r},${g},${b},${o.opacity})`;
    };
    hist.setData(result.bars.map(b => ({ ...b, color: withOpacity(b.color) })));
  } else {
    hist.setData(result.bars);
  }

  return () => {
    try { chartApi.removeSeries(hist); } catch {}
    seriesMap.delete("vol");
  };
}

const VOL = {
  id: "vol",
  label: "Volume (Pane)",
  kind: "SEPARATE",
  defaults: DEF,
  compute: volCompute,
  attach: volAttach,
};

export default VOL;
