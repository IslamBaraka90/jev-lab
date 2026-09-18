import { useMemo, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { extent, linear, niceTicks } from './scale.js';

const MARGIN = { top: 16, right: 20, bottom: 34, left: 80 };

/**
 * Lines over a shared index, on one axis that always includes zero. `series` is [{ key, label, tone }];
 * a crosshair shows every series at the pointer, and `highlightIndex` marks a position (the replay).
 */
export function LineChart({ rows, series, formatValue, xLabel, tooltipTitle, highlightIndex, height = 280, label }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const layout = useMemo(() => {
    if (!width || rows.length === 0) return null;
    const [low, high] = extent([0, ...rows.flatMap((row) => series.map((line) => row[line.key]))]);
    const padding = (high - low) * 0.08 || 1;
    const y = linear([low - padding, high + padding], [height - MARGIN.bottom, MARGIN.top]);
    const x = linear([0, Math.max(1, rows.length - 1)], [MARGIN.left, width - MARGIN.right]);
    // A missing value (a shorter series) breaks the line instead of dropping to zero.
    const paths = series.map((line) => {
      let drawing = false;
      return rows
        .map((row, index) => {
          if (!Number.isFinite(row[line.key])) {
            drawing = false;
            return '';
          }
          const command = drawing ? 'L' : 'M';
          drawing = true;
          return `${command}${x(index).toFixed(1)},${y(row[line.key]).toFixed(1)}`;
        })
        .join('');
    });
    const labelled = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    return { x, y, paths, labelled, ticks: niceTicks(low - padding, high + padding, 4) };
  }, [width, height, rows, series]);

  const pointer = hover ?? null;

  return (
    <div className="line-chart" ref={ref} style={{ height }}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <g className="axis">
            {layout.ticks.map((tick) => (
              <g key={tick}>
                <line className={tick === 0 ? 'zero' : 'grid'} x1={MARGIN.left} x2={width - MARGIN.right} y1={layout.y(tick)} y2={layout.y(tick)} />
                <text x={MARGIN.left - 10} y={layout.y(tick) + 5} textAnchor="end">
                  {formatValue(tick, { compact: true })}
                </text>
              </g>
            ))}
            {layout.labelled.map((index) => (
              <text key={index} x={layout.x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>
                {xLabel(rows[index], index)}
              </text>
            ))}
          </g>

          {highlightIndex !== undefined && highlightIndex !== null && rows[highlightIndex] && (
            <line className="current-marker" x1={layout.x(highlightIndex)} x2={layout.x(highlightIndex)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
          )}

          {series.map((line, index) => (
            <path key={line.key} className={`series-line ${line.tone}`} d={layout.paths[index]} />
          ))}

          {series.map((line) => {
            const last = rows.findLastIndex((row) => Number.isFinite(row[line.key]));
            return last < 0 ? null : <circle key={line.key} className={`series-dot ${line.tone}`} cx={layout.x(last)} cy={layout.y(rows[last][line.key])} r={4} />;
          })}

          {pointer !== null && (
            <g>
              <line className="crosshair" x1={layout.x(pointer)} x2={layout.x(pointer)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
              {series.map((line) =>
                Number.isFinite(rows[pointer][line.key]) ? (
                  <circle key={line.key} className={`series-dot ${line.tone}`} cx={layout.x(pointer)} cy={layout.y(rows[pointer][line.key])} r={4.5} />
                ) : null,
              )}
            </g>
          )}

          <rect
            className="hit-area"
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, width - MARGIN.left - MARGIN.right)}
            height={height - MARGIN.top - MARGIN.bottom}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const index = Math.round(layout.x.invert(event.clientX - bounds.left + MARGIN.left));
              setHover(Math.max(0, Math.min(rows.length - 1, index)));
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {layout && pointer !== null && (
        <div className="chart-tooltip" style={layout.x(pointer) > width - 240 ? { right: width - layout.x(pointer) + 16 } : { left: layout.x(pointer) + 16 }}>
          <strong>{tooltipTitle(rows[pointer], pointer)}</strong>
          <dl>
            {series.map((line) => (
              <div key={line.key}>
                <dd>
                  <span className={`line-key ${line.tone}`} aria-hidden="true" />
                  {formatValue(rows[pointer][line.key])}
                </dd>
                <dt>{line.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
