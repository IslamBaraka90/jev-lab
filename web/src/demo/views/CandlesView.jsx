import { Suspense, lazy, useMemo } from 'react';

const CandleChart = lazy(() => import('../../charts/CandleChart.jsx').then((module) => ({ default: module.CandleChart })));

// A compact OHLC stage for mixed market-data demos. The outcome window is withheld until the item
// has an answer, matching the state contract while still making the later move inspectable.

const money = (value, currency) => Number(value).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 });
const readable = (value) => String(value).toLowerCase().replaceAll('_', ' ');

function InsiderCandlesView({ item, result }) {
  const before = item.market.preTradeBars;
  const after = result ? item.market.outcomeBars : [];
  const bars = [...before, ...after];
  const width = 780;
  const height = 285;
  const pad = { top: 42, right: 54, bottom: 38, left: 18 };
  const low = Math.min(...bars.map((bar) => bar.low));
  const high = Math.max(...bars.map((bar) => bar.high));
  const range = Math.max(high - low, 0.01);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const step = plotWidth / Math.max(bars.length, 1);
  const x = (index) => pad.left + step * (index + 0.5);
  const y = (price) => pad.top + ((high - price) / range) * plotHeight;
  const tradeIndex = before.length - 1;
  const eventIndex = bars.findIndex((bar) => bar.date === item.market.announcementDate);
  const outcomeStart = before.length;
  const plan = item.trade.preClearedPlan;

  return (
    <div className="stack candles-view" style={{ gap: 14 }}>
      <dl className="facts candle-facts">
        <div><dt>Employee</dt><dd>{item.employee.id} · {item.employee.role}</dd></div>
        <div><dt>Trade</dt><dd>{item.trade.side} {item.trade.quantity.toLocaleString('en-US')} {item.trade.symbol} · {money(item.trade.notional, item.market.currency)}</dd></div>
        <div><dt>Access</dt><dd>{readable(item.employee.accessLevel)} · {item.employee.materialAccessSymbols.join(', ') || 'no issuer access listed'}</dd></div>
        <div><dt>Plan</dt><dd>{plan ? `${plan.cadence.toLowerCase()} · pre-cleared ${plan.approvedAt}` : 'No scheduled-plan exemption'}</dd></div>
      </dl>

      <div className="candle-chart-wrap">
        <svg className="candle-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${item.trade.symbol} daily candlesticks through ${item.trade.tradeDate}${result ? ` with the ten-session outcome window through ${after.at(-1)?.date}` : '; post-trade bars are hidden until this item is answered'}. Trade date ${item.trade.tradeDate}; fictional announcement ${item.market.announcementDate}.`}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const price = high - range * fraction;
            return <g key={fraction}><line className="candle-grid" x1={pad.left} x2={width - pad.right} y1={y(price)} y2={y(price)} /><text className="candle-axis" x={width - pad.right + 6} y={y(price) + 4}>{price.toFixed(2)}</text></g>;
          })}

          {result && <rect className="outcome-window" x={pad.left + outcomeStart * step} y={pad.top} width={Math.max(0, after.length * step)} height={plotHeight} />}

          {bars.map((bar, index) => {
            const up = bar.close >= bar.open;
            const top = y(Math.max(bar.open, bar.close));
            const bottom = y(Math.min(bar.open, bar.close));
            return (
              <g key={bar.date} className={`candle ${up ? 'up' : 'down'}${index >= outcomeStart ? ' outcome' : ''}`}>
                <line x1={x(index)} x2={x(index)} y1={y(bar.high)} y2={y(bar.low)} />
                <rect x={x(index) - Math.max(1.5, step * 0.28)} y={top} width={Math.max(3, step * 0.56)} height={Math.max(1.5, bottom - top)}>
                  <title>{`${bar.date}: open ${bar.open}, high ${bar.high}, low ${bar.low}, close ${bar.close}`}</title>
                </rect>
              </g>
            );
          })}

          <line className="trade-marker" x1={x(tradeIndex)} x2={x(tradeIndex)} y1={pad.top} y2={height - pad.bottom} />
          <text className="marker-label trade-label" x={x(tradeIndex) - 4} y={16} textAnchor="end">trade</text>
          {eventIndex >= 0 && <><line className="event-marker" x1={x(eventIndex)} x2={x(eventIndex)} y1={pad.top} y2={height - pad.bottom} /><text className="marker-label event-label" x={x(eventIndex) - 4} y={34} textAnchor="end">fictional event</text></>}
          <text className="candle-axis" x={pad.left} y={height - 12}>{bars[0]?.date}</text>
          <text className="candle-axis" x={width - pad.right} y={height - 12} textAnchor="end">{bars.at(-1)?.date}</text>
          {!result && <text className="outcome-hidden" x={width - pad.right - 8} y={height - pad.bottom - 8} textAnchor="end">Outcome hidden until scored</text>}
        </svg>
      </div>

      <div className="candle-legend" aria-label="Chart legend">
        <span><i className="legend-line trade-key" />Trade date</span>
        <span><i className="legend-line event-key" />Fictional announcement</span>
        <span><i className="legend-box outcome-key" />Outcome window {result ? 'revealed' : 'hidden'}</span>
      </div>

      <p className="meta">Cached-real Yahoo Finance daily prices. Employee, trade, access and event details are fictional.</p>
      <details>
        <summary>Price table</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead><tr><th>Date</th><th>Window</th><th className="num">Open</th><th className="num">High</th><th className="num">Low</th><th className="num">Close</th></tr></thead>
            <tbody>{bars.map((bar, index) => <tr key={bar.date}><th scope="row">{bar.date}</th><td>{index < outcomeStart ? (index === tradeIndex ? 'trade date' : 'pre-trade') : 'outcome'}</td><td className="num">{bar.open}</td><td className="num">{bar.high}</td><td className="num">{bar.low}</td><td className="num">{bar.close}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
// A trade or a fill drawn on the real chart, using the same candle chart the lab uses. A demo hands it
// `item.chart = { candles, markIndex, trade }` and nothing else: the chart marks the plan and the exit
// when the trade carries them, and the bars after the marked one are the ones the demo chose to show.

/** Bars travel as one line each — "date open high low close volume" — so the dataset stays small. */
const parseBar = (line) => {
  const [date, open, high, low, close, volume] = String(line).split(' ');
  return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) };
};

function LabCandlesView({ item, demo }) {
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

/** Supports both the outcome-gated surveillance chart and the lab's compact encoded-bar chart. */
export function CandlesView(props) {
  return props.item.chart ? <LabCandlesView {...props} /> : <InsiderCandlesView {...props} />;
}
