import { memo } from 'react';
import { formatDate, formatPercent } from '../lib/format.js';
import { ACTIONS } from '../lib/labels.js';
import { extent, linear } from './scale.js';

/** A cumulative series as a small line with its end point. */
export function Sparkline({ values, width = 112, height = 32, label }) {
  if (values.length < 2) return <span className="sparkline-empty" aria-hidden="true" />;
  const [low, high] = extent([0, ...values]);
  const x = linear([0, values.length - 1], [3, width - 5]);
  const y = linear([low, high], [height - 4, 4]);
  const d = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join('');
  return (
    <svg className="sparkline" width={width} height={height} role="img" aria-label={label}>
      <line className="zero" x1={0} x2={width} y1={y(0)} y2={y(0)} />
      <path d={d} />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r={3} />
    </svg>
  );
}

/** Long, short and no-trade counts as one segmented bar with 2 px gaps. */
export function MixBar({ long, short, noTrade }) {
  const total = long + short + noTrade;
  return (
    <span className="mix-bar" role="img" aria-label={`${long} long, ${short} short, ${noTrade} no trade`}>
      {total === 0 && <span className="segment empty" style={{ flexGrow: 1 }} />}
      {long > 0 && <span className="segment long" style={{ flexGrow: long }} />}
      {short > 0 && <span className="segment short" style={{ flexGrow: short }} />}
      {noTrade > 0 && <span className="segment flat" style={{ flexGrow: noTrade }} />}
    </span>
  );
}

/**
 * Every planned decision per symbol as a dot: filled with the action's color, ringed when the trade
 * won or lost, hollow while pending. Clicking a dot replays that decision; the slider in the playback
 * bar is the keyboard route to the same place.
 */
export const DecisionTimeline = memo(function DecisionTimeline({ run, positions, current, onSeek }) {
  return (
    <div className="timeline">
      {run.symbols.map((symbol) => {
        const planned = symbol.cutoffs.length || run.settings?.cutoffs || symbol.decisions.length;
        return (
          <div className="timeline-row" key={symbol.symbol}>
            <span className="timeline-symbol">
              <strong>{symbol.symbol}</strong>
              <span className="meta">
                {symbol.decisions.length}/{planned}
              </span>
            </span>
            <div className="timeline-track" style={{ gridTemplateColumns: `repeat(${planned}, minmax(0, 1fr))` }}>
              {Array.from({ length: planned }, (_, index) => {
                const decision = symbol.decisions[index];
                if (!decision) return <span key={index} className="timeline-dot pending" />;
                const position = positions.get(`${symbol.symbol}:${decision.cutoff}`);
                const tone = decision.error ? 'failed' : ACTIONS[decision.action]?.tone;
                const outcome = decision.trade ? (decision.trade.netReturnPct > 0 ? 'won' : 'lost') : '';
                const result = decision.trade ? `, ${outcome} ${formatPercent(decision.trade.netReturnPct)}` : '';
                const text = `${symbol.symbol} ${formatDate(decision.date)}: ${decision.error ? 'failed' : ACTIONS[decision.action]?.label}${result}`;
                return (
                  <button
                    key={index}
                    type="button"
                    tabIndex={-1}
                    className={`timeline-dot ${tone} ${outcome}${position === current ? ' current' : ''}`}
                    title={text}
                    aria-label={text}
                    onClick={() => onSeek(position)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
