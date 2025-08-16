import { useEffect, useRef } from 'react';
import { createChart, ISeriesApi } from 'lightweight-charts';
import type { Candle } from '../types/market';
import { fetchHistory } from '../lib/api';
import { openMarketSocket } from '../lib/ws';

type Props = {
  ticker: string;
  tf?: 'minute'|'hour'|'day';
  from: string;
  to: string;
  height?: number;
};

export default function LiveFeedsChart({ ticker, tf='minute', from, to, height=480 }: Props) {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'>|null>(null);
  const lastRef = useRef<number|null>(null);
  const stopRef = useRef<null | (()=>void)>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height,
      layout: { background: { type: 'Solid', color: '#0f0f0f' }, textColor: '#d8d8d8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.06)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      timeScale: { timeVisible: tf !== 'day', secondsVisible: tf === 'minute' },
      rightPriceScale: { borderVisible: false },
    });

    const candles = chart.addCandlestickSeries();
    seriesRef.current = candles;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    (async () => {
      const hist: Candle[] = await fetchHistory(ticker, tf, from, to);
      if (hist.length) {
        candles.setData(hist);
        lastRef.current = hist[hist.length - 1].time;
      }

      stopRef.current = openMarketSocket({
        onBar: (b) => {
          if (b.ticker !== ticker) return;
          const t = b.time;
          if (lastRef.current && t === lastRef.current) {
            candles.update(b);
          } else {
            candles.update(b);
            lastRef.current = t;
          }
        }
      });
    })().catch(console.error);

    return () => {
      ro.disconnect();
      try { stopRef.current?.(); } catch {}
      try { chart.remove(); } catch {}
    };
  }, [ticker, tf, from, to, height]);

  return <div ref={containerRef} style={{ width:'100%', minHeight:height, position:'relative' }} />;
}
