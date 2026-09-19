// A trade or a fill drawn on the real chart, using the same candle chart the lab uses. A demo hands it
// `item.chart = { candles, markIndex, trade }` and nothing else: the chart marks the plan and the exit
// when the trade carries them, and the bars after the marked one are the ones the demo chose to show.

import { Suspense, lazy, useMemo } from 'react';

const CandleChart = lazy(() => import('../../charts/CandleChart.jsx').then((module) => ({ default: module.CandleChart })));

/** Bars travel as one line each — "date open high low close volume" — so the dataset stays small. */
const parseBar = (line) => {
  const [date, open, high, low, close, volume] = String(line).split(' ');
  return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) };
};

export function CandlesView({ item, demo }) {
  const chart = item.chart;
  const candles = useMemo(() => (chart?.bars ?? []).map(parseBar), [chart]);
  if (!candles.length) return <p className="meta">This item has no chart to draw.</p>;

  return (
    <div className="stack candles-view" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{item.id}</span>
        <h3>{demo?.itemLabel?.(item) ?? item.id}</h3>
      </div>
      <Suspense fallback={<p className="meta">Drawing the chart…</p>}>
        <CandleChart
          candles={candles}
          decisionIndex={chart.markIndex ?? 0}
          revealed={candles.length - (chart.markIndex ?? 0)}
          trade={chart.trade}
          showPlan={Boolean(chart.trade)}
          showExit={Boolean(chart.trade?.exitPrice)}
          height={360}
          label={chart.label}
        />
      </Suspense>
    </div>
  );
}
