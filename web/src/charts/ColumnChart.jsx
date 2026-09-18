import { useMemo, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { columnPath, extent, linear, niceTicks } from './scale.js';

const MARGIN = { top: 32, right: 8, bottom: 84, left: 64 };

/**
 * Signed columns from a zero baseline, at most 24 px wide with a rounded data end. Gains and losses
 * wear the positive and danger tokens, and every value is labelled with its sign. Items with a null
 * value show their label with no column. `notes` are short lines under each label.
 */
export function ColumnChart({ items, formatValue, height = 260, label }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const layout = useMemo(() => {
    if (!width) return null;
    const [low, high] = extent([0, ...items.map((item) => item.value)]);
    const padding = (high - low) * 0.15 || 1;
    // Extra room under a negative column keeps its value label clear of the category labels.
    const y = linear([Math.min(0, low - (low < 0 ? padding * 2 : 0)), high + padding], [height - MARGIN.bottom, MARGIN.top]);
    const band = (width - MARGIN.left - MARGIN.right) / items.length;
    return { y, band, column: Math.min(24, band * 0.45), ticks: niceTicks(Math.min(0, low), high + padding, 4) };
  }, [width, height, items]);

  return (
    <div className="column-chart" ref={ref} style={{ height }}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <g className="axis">
            {layout.ticks.map((tick) => (
              <g key={tick}>
                <line className={tick === 0 ? 'zero' : 'grid'} x1={MARGIN.left} x2={width - MARGIN.right} y1={layout.y(tick)} y2={layout.y(tick)} />
                <text x={MARGIN.left - 10} y={layout.y(tick) + 5} textAnchor="end">
                  {formatValue(tick)}
                </text>
              </g>
            ))}
          </g>
          {items.map((item, index) => {
            const center = MARGIN.left + layout.band * index + layout.band / 2;
            const zero = layout.y(0);
            const hasValue = Number.isFinite(item.value);
            const top = hasValue ? layout.y(item.value) : zero;
            const positive = hasValue && item.value >= 0;
            return (
              <g key={item.label} className={`column ${hover === index ? 'hovered' : ''}`}>
                {hasValue && item.value !== 0 && (
                  <path
                    className={positive ? 'gain' : 'loss'}
                    d={positive ? columnPath(center - layout.column / 2, top, layout.column, zero) : flipped(center - layout.column / 2, zero, layout.column, top)}
                  />
                )}
                {hasValue && (
                  <text className="value-label" x={center} y={positive ? top - 8 : top + 20} textAnchor="middle">
                    {formatValue(item.value)}
                  </text>
                )}
                <text className="category-label" x={center} y={height - MARGIN.bottom + 24} textAnchor="middle">
                  {item.label}
                </text>
                {item.notes?.map((note, line) => (
                  <text key={note} className="category-note" x={center} y={height - MARGIN.bottom + 44 + line * 20} textAnchor="middle">
                    {note}
                  </text>
                ))}
                <rect
                  className="hit-area"
                  x={center - layout.band / 2}
                  y={MARGIN.top}
                  width={layout.band}
                  height={height - MARGIN.top - MARGIN.bottom}
                  onPointerEnter={() => setHover(index)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {layout && hover !== null && items[hover].tooltip && (
        <div className="chart-tooltip" style={{ left: Math.min(MARGIN.left + layout.band * hover + layout.band / 2 + 16, width - 220), top: MARGIN.top }}>
          <strong>{items[hover].label}</strong>
          <dl>
            {items[hover].tooltip.map(([name, value]) => (
              <div key={name}>
                <dd>{value}</dd>
                <dt>{name}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

// A column hanging below the baseline, with its rounded data end at the bottom.
function flipped(x, base, width, bottom) {
  const height = bottom - base;
  if (height <= 0) return '';
  const radius = Math.min(4, width / 2, height);
  return `M${x},${base}V${bottom - radius}Q${x},${bottom} ${x + radius},${bottom}H${x + width - radius}Q${x + width},${bottom} ${x + width},${bottom - radius}V${base}Z`;
}
