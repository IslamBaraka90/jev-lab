import { useMemo, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { formatCompact, formatDate, formatPercent, formatPrice } from '../lib/format.js';
import { extent, linear, niceTicks } from './scale.js';

const TOP = 36;
const PRICE_GUTTER = 96;
const DATE_AXIS = 30;
const VOLUME = 56;
const GAP = 14;

/**
 * Daily candles around one decision: the bars Jev saw, the decision point, and the bars after it that
 * were hidden from Jev, of which `revealed` are drawn. With `showPlan`, a trade's entry, stop and target
 * are marked; with `showExit`, its exit and result. Candles stay muted so the decision and trade stand out.
 */
export function CandleChart({ candles, decisionIndex, revealed, trade, showPlan = false, showExit = false, height: fullHeight = 400, label }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  // Narrow screens get a shorter chart so the decision stays in view.
  const height = width && width < 640 ? Math.min(fullHeight, 380) : fullHeight;

  const layout = useMemo(() => {
    if (!width || candles.length === 0) return null;
    const plotWidth = Math.max(160, width - PRICE_GUTTER);
    const priceBottom = height - DATE_AXIS - VOLUME - GAP;
    const levels = trade ? [trade.stopPrice, trade.targetPrice, trade.entryPrice, trade.exitPrice] : [];
    const [low, high] = extent([...candles.flatMap((candle) => [candle.low, candle.high]), ...levels]);
    const padding = (high - low) * 0.06 || 1;
    const y = linear([low - padding, high + padding], [priceBottom, TOP]);
    const volumeTop = priceBottom + GAP;
    const volume = linear([0, Math.max(...candles.map((candle) => candle.volume), 1)], [volumeTop + VOLUME, volumeTop + 4]);
    const band = plotWidth / candles.length;
    return {
      plotWidth,
      priceBottom,
      volumeTop,
      band,
      y,
      volume,
      x: (index) => index * band + band / 2,
      body: Math.max(1, Math.min(11, band * 0.62)),
      ticks: niceTicks(low - padding, high + padding, 5),
      dateEvery: Math.max(1, Math.ceil(candles.length / Math.max(2, Math.floor(plotWidth / 110)))),
    };
  }, [width, height, candles, trade]);

  const visible = (index) => index <= decisionIndex + revealed;

  return (
    <div className="candle-chart" ref={ref} style={{ height }}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <g className="axis">
            {layout.ticks.map((tick) => (
              <g key={tick}>
                <line className="grid" x1={0} x2={layout.plotWidth} y1={layout.y(tick)} y2={layout.y(tick)} />
                <text x={layout.plotWidth + 10} y={layout.y(tick) + 5}>
                  {formatPrice(tick)}
                </text>
              </g>
            ))}
            {candles.map((candle, index) =>
              index % layout.dateEvery === 0 ? (
                <text key={candle.date} x={layout.x(index)} y={height - 8} textAnchor="middle">
                  {formatDate(candle.date, { year: false })}
                </text>
              ) : null,
            )}
          </g>

          <rect
            className="future-zone"
            x={layout.x(decisionIndex) + layout.band / 2}
            y={TOP - 12}
            width={Math.max(0, layout.plotWidth - layout.x(decisionIndex) - layout.band / 2)}
            height={layout.volumeTop + VOLUME - TOP + 12}
          />

          <g className="volume">
            {candles.map((candle, index) => {
              if (!visible(index)) return null;
              const barWidth = Math.max(1, Math.min(layout.body, layout.band - 2));
              return (
                <rect
                  key={candle.date}
                  className={index > decisionIndex ? 'future' : undefined}
                  x={layout.x(index) - barWidth / 2}
                  y={layout.volume(candle.volume)}
                  width={barWidth}
                  height={Math.max(0, layout.volumeTop + VOLUME - layout.volume(candle.volume))}
                />
              );
            })}
          </g>

          <g>
            {candles.map((candle, index) => {
              if (!visible(index)) return null;
              const up = candle.close >= candle.open;
              const top = layout.y(Math.max(candle.open, candle.close));
              const bottom = layout.y(Math.min(candle.open, candle.close));
              const x = layout.x(index);
              return (
                <g key={candle.date} className={`candle ${up ? 'up' : 'down'}${index > decisionIndex ? ' future' : ''}`}>
                  <line x1={x} x2={x} y1={layout.y(candle.high)} y2={layout.y(candle.low)} />
                  <rect x={x - layout.body / 2} y={top} width={layout.body} height={Math.max(1, bottom - top)} />
                </g>
              );
            })}
          </g>

          <DecisionMarker x={layout.x(decisionIndex) + layout.band / 2} bottom={layout.volumeTop + VOLUME} />

          {trade && showPlan && revealed > 0 && <TradeOverlay trade={trade} layout={layout} decisionIndex={decisionIndex} showExit={showExit} />}

          {hover !== null && visible(hover) && (
            <line className="crosshair" x1={layout.x(hover)} x2={layout.x(hover)} y1={TOP - 12} y2={layout.volumeTop + VOLUME} />
          )}
          <rect
            className="hit-area"
            x={0}
            y={TOP - 12}
            width={layout.plotWidth}
            height={layout.volumeTop + VOLUME - TOP + 12}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(candles.length - 1, Math.floor((event.clientX - bounds.left) / layout.band))));
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {layout && hover !== null && visible(hover) && <CandleTooltip candle={candles[hover]} left={layout.x(hover)} width={width} future={hover > decisionIndex} />}
    </div>
  );
}

function DecisionMarker({ x, bottom }) {
  return (
    <g className="decision-marker">
      <line x1={x} x2={x} y1={TOP - 12} y2={bottom} />
      <rect x={x - 76} y={4} width={76} height={24} rx={6} />
      <text x={x - 38} y={21} textAnchor="middle">
        Decision
      </text>
    </g>
  );
}

function TradeOverlay({ trade, layout, decisionIndex, showExit }) {
  const { x, y, band, plotWidth } = layout;
  const entryX = x(decisionIndex + 1);
  const exitX = x(decisionIndex + trade.barsHeld);
  const won = trade.netReturnPct > 0;
  const tag = (price, text, tone) => (
    <g className={`price-tag ${tone}`} transform={`translate(${plotWidth + 4}, ${y(price)})`}>
      <rect x={0} y={-12} width={PRICE_GUTTER - 6} height={24} rx={6} />
      <text x={(PRICE_GUTTER - 6) / 2} y={5} textAnchor="middle">
        {text}
      </text>
    </g>
  );

  return (
    <g className="trade-overlay">
      {trade.stopPrice !== null && <line className="level stop" x1={entryX - band / 2} x2={plotWidth} y1={y(trade.stopPrice)} y2={y(trade.stopPrice)} />}
      {trade.targetPrice !== null && <line className="level target" x1={entryX - band / 2} x2={plotWidth} y1={y(trade.targetPrice)} y2={y(trade.targetPrice)} />}
      {showExit && <line className="trade-path" x1={entryX} y1={y(trade.entryPrice)} x2={exitX} y2={y(trade.exitPrice)} />}
      <circle className="entry-dot" cx={entryX} cy={y(trade.entryPrice)} r={5.5} />
      {showExit && <circle className={`exit-dot ${won ? 'gain' : 'loss'}`} cx={exitX} cy={y(trade.exitPrice)} r={5.5} />}
      {trade.stopPrice !== null && tag(trade.stopPrice, formatPrice(trade.stopPrice), 'stop')}
      {trade.targetPrice !== null && tag(trade.targetPrice, formatPrice(trade.targetPrice), 'target')}
      {showExit && (
        <g className={`exit-label ${won ? 'gain' : 'loss'}`} transform={`translate(${Math.min(exitX + 10, plotWidth - 70)}, ${y(trade.exitPrice) + (won ? -30 : 10)})`}>
          <rect x={0} y={0} width={66} height={22} rx={6} />
          <text x={33} y={16} textAnchor="middle">
            {formatPercent(trade.netReturnPct)}
          </text>
        </g>
      )}
    </g>
  );
}

function CandleTooltip({ candle, left, width, future }) {
  const flip = left > width - 220;
  const rows = [
    ['Open', formatPrice(candle.open)],
    ['High', formatPrice(candle.high)],
    ['Low', formatPrice(candle.low)],
    ['Close', formatPrice(candle.close)],
    ['Volume', formatCompact(candle.volume)],
  ];
  return (
    <div className="chart-tooltip" style={flip ? { right: width - left + 16 } : { left: left + 16 }} role="presentation">
      <strong>{formatDate(candle.date)}</strong>
      {future && <span className="meta">After the decision</span>}
      <dl>
        {rows.map(([name, value]) => (
          <div key={name}>
            <dd>{value}</dd>
            <dt>{name}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
