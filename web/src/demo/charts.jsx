import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { automationCurve, matrixStats, percent, reliability } from '../../../demos/lib/metrics.js';
import { formatAmount, humaniseKey, humaniseValue } from '../lib/humanise.js';

// The charts every graded report shares. Each one states its axes, carries its numbers as text, and
// has a table behind it; none of them knows which demo it is drawing.

const SERIES = ['var(--positive)', 'var(--warning)', 'var(--cyan)', 'var(--violet)', 'var(--danger)', 'var(--long)', 'var(--domain-screening)', 'var(--domain-news)', 'var(--control)'];
const TONE_COLOR = { good: 'var(--positive)', bad: 'var(--danger)' };

/** How the answers split across the options: one bar, a colour per option, the counts beside it. */
export function DistributionBar({ items = [], title = 'How the answers split', onSelect }) {
  const total = items.reduce((sum, entry) => sum + entry.count, 0) || 1;
  let next = 0;
  const coloured = items.map((entry) => ({ ...entry, color: TONE_COLOR[entry.tone] ?? SERIES[1 + (next++ % (SERIES.length - 1))] }));
  return (
    <div className="distribution">
      <h4>{title}</h4>
      <div className="distribution-bar" role="img" aria-label={items.map((entry) => `${entry.label}: ${entry.count}`).join(', ')}>
        {coloured.map((entry) => (
          <span key={entry.label} className="segment" style={{ flexGrow: entry.count, background: entry.color }}>
            {entry.count / total > 0.08 && <span className="segment-label num">{Math.round((entry.count / total) * 100)}%</span>}
          </span>
        ))}
      </div>
      <ul className="distribution-legend">
        {coloured.map((entry) => (
          <li key={entry.label}>
            <button type="button" className="legend-chip" onClick={() => onSelect?.(entry)} disabled={!entry.itemId}>
              <span className="legend-key" style={{ background: entry.color }} aria-hidden="true" />
              {humaniseValue(entry.label)}
              <span className="meta num">{entry.count.toLocaleString('en-US')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Expected against answered. Each row is shaded by its own total, so a rare class is as legible as
 * a common one; the table underneath turns the same counts into precision, recall and F1.
 */
export function ConfusionMatrix({ matrix, onSelect, onFilter }) {
  const [selection, setSelection] = useState(null);
  const stats = useMemo(() => matrixStats(matrix), [matrix]);
  if (!matrix?.rows?.length) return null;
  const columnTotals = matrix.columns.map((_, index) => matrix.rows.reduce((sum, row) => sum + (row.cells[index]?.count ?? 0), 0));

  return (
    <div className="stack matrix-block" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 2 }}>
        <h4>{matrix.title}</h4>
        <p className="meta">
          Rows are {matrix.rowLabel ?? 'the expected answer'}, columns are {matrix.columnLabel ?? 'what the model answered'}. Shading is the share of each row.
        </p>
      </div>
      <div className="table-scroll">
        <table className="data-table compact confusion">
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span>Expected ↓</span>
                <span>Answered →</span>
              </th>
              {matrix.columns.map((column) => (
                <th key={column} scope="col" className="num">
                  {humaniseValue(column)}
                </th>
              ))}
              <th scope="col" className="num total">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const rowTotal = row.cells.reduce((sum, cell) => sum + (cell.count ?? 0), 0);
              return (
                <tr key={row.label}>
                  <th scope="row">{humaniseValue(row.label)}</th>
                  {row.cells.map((cell, index) => {
                    const share = rowTotal ? cell.count / rowTotal : 0;
                    const key = `${row.label}:${index}`;
                    const label = cell.ariaLabel ?? `Expected ${humaniseValue(row.label)}, answered ${humaniseValue(matrix.columns[index])}`;
                    return (
                      <td
                        key={index}
                        className={`num${cell.diagonal ? ' diagonal' : ''}${cell.count ? '' : ' cell-empty'}`}
                        style={cell.count ? { backgroundColor: `color-mix(in srgb, var(--${cell.diagonal ? 'positive' : 'warning'}) ${Math.round(8 + share * 42)}%, transparent)` } : undefined}
                      >
                        {cell.count && cell.items?.length ? (
                          <button
                            type="button"
                            className="matrix-cell-button"
                            aria-label={`${label}: ${cell.count}`}
                            aria-expanded={selection?.key === key}
                            onClick={() => {
                              setSelection({ key, label, items: cell.items });
                              onFilter?.(label, cell.items);
                            }}
                          >
                            {cell.count}
                          </button>
                        ) : (
                          cell.count || '·'
                        )}
                        {cell.count > 0 && rowTotal > 0 && <small className="cell-share">{Math.round(share * 100)}%</small>}
                      </td>
                    );
                  })}
                  <td className="num total">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {columnTotals.map((value, index) => (
                <td key={index} className="num total">
                  {value}
                </td>
              ))}
              <td className="num total">{stats?.total ?? ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selection && !onFilter && (
        <div className="matrix-drilldown stack" role="region" aria-live="polite" aria-label={selection.label}>
          <strong>{selection.label}</strong>
          <div className="cluster-list">
            {selection.items.map((id) => (
              <button key={id} type="button" className="button ghost chip" onClick={() => onSelect?.(id)}>
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {stats && <ClassTable stats={stats} />}
    </div>
  );
}

function ClassTable({ stats }) {
  const lift = stats.accuracy - stats.majorityBaseline;
  return (
    <div className="stack class-table" style={{ gap: 8 }}>
      <p className="accuracy-line">
        <strong className="num">{percent(stats.accuracy)}</strong> agreement
        <span className="meta num">
          {' '}
          ({stats.correct} of {stats.total}; 95% interval {percent(stats.interval.low, 0)}–{percent(stats.interval.high, 0)})
        </span>
        <span className="sep">·</span>
        always answering “{humaniseValue(stats.majorityClass)}” would score <strong className="num">{percent(stats.majorityBaseline)}</strong>
        <span className={`lift ${lift > 0.02 ? 'up' : 'flat'}`}>
          {lift >= 0 ? '+' : '−'}
          {Math.abs(lift * 100).toFixed(1)} pts over that
        </span>
        {stats.macroF1 !== null && (
          <>
            <span className="sep">·</span>macro F1 <strong className="num">{stats.macroF1.toFixed(2)}</strong>
          </>
        )}
      </p>
      <details>
        <summary>Precision, recall and F1 by class</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col" className="num">Expected</th>
                <th scope="col" className="num">Answered</th>
                <th scope="col" className="num">Precision</th>
                <th scope="col" className="num">Recall</th>
                <th scope="col" className="num">F1</th>
              </tr>
            </thead>
            <tbody>
              {stats.classes.map((entry) => (
                <tr key={entry.label} className={entry.support < 10 ? 'thin-sample' : undefined}>
                  <th scope="row">{humaniseValue(entry.label)}</th>
                  <td className="num">{entry.support}</td>
                  <td className="num">{entry.predicted}</td>
                  <td className="num">{percent(entry.precision, 0)}</td>
                  <td className="num">{percent(entry.recall, 0)}</td>
                  <td className="num">{entry.f1 === null ? '–' : entry.f1.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta">Classes with fewer than ten expected items are greyed: a rate over so few is an anecdote.</p>
        </div>
      </details>
    </div>
  );
}

const niceTicks = (max, count = 4) => {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw) ?? raw;
  const ticks = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
};

/**
 * Where to set the bar. The demo supplies the points; the slider picks one and the sentence under the
 * chart says what that choice means in items, in catches and, where the demo has it, in the rate.
 */
export function CoverageCurve({ curve }) {
  const points = curve?.points ?? [];
  const [index, setIndex] = useState(() => Math.max(0, Math.min(points.length - 1, curve?.defaultIndex ?? Math.floor(points.length / 2))));
  if (!points.length) return null;

  const width = 860;
  const height = 300;
  const pad = { top: 22, right: 56, bottom: 46, left: 56 };
  const hasRate = points.some((point) => Number.isFinite(point.rate));
  const maxX = Math.max(...points.map((point) => point.reviewed), 1);
  const maxY = Math.max(curve.of ?? 0, ...points.map((point) => point.caught), 1);
  const x = (value) => pad.left + (value / maxX) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - (value / maxY) * (height - pad.top - pad.bottom);
  const yRate = (value) => height - pad.bottom - value * (height - pad.top - pad.bottom);
  const ordered = [...points].sort((a, b) => a.reviewed - b.reviewed);
  const path = ordered.map((point, step) => `${step ? 'L' : 'M'}${x(point.reviewed).toFixed(1)},${y(point.caught).toFixed(1)}`).join('');
  const ratePath = ordered.filter((point) => Number.isFinite(point.rate)).map((point, step) => `${step ? 'L' : 'M'}${x(point.reviewed).toFixed(1)},${yRate(point.rate).toFixed(1)}`).join('');
  const chosen = points[index];
  const thresholdText = (point) => (curve.thresholdFormat === 'level' ? `${Math.round(point.threshold * (curve.levels ?? 6))} of ${curve.levels ?? 6}` : `${Math.round(point.threshold * 100)}%`);

  return (
    <div className="stack coverage-block" style={{ gap: 10 }}>
      <h4>{curve.title}</h4>
      <svg className="coverage-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${curve.yLabel} against ${curve.xLabel}. ${points.map((point) => `at ${thresholdText(point)}, ${point.reviewed} and ${point.caught} of ${curve.of}`).join('; ')}`}>
        {niceTicks(maxY).map((tick) => (
          <g key={`y${tick}`}>
            <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis-text" x={pad.left - 8} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {niceTicks(maxX, 6).map((tick) => (
          <text key={`x${tick}`} className="axis-text" x={x(tick)} y={height - pad.bottom + 18} textAnchor="middle">
            {tick}
          </text>
        ))}
        {hasRate &&
          [0, 0.5, 1].map((tick) => (
            <text key={`r${tick}`} className="axis-text rate" x={width - pad.right + 8} y={yRate(tick) + 4}>
              {Math.round(tick * 100)}%
            </text>
          ))}
        <line className="axis-line" x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} />
        <line className="axis-line" x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} />
        <path className="curve-line" d={path} />
        {ratePath && <path className="curve-rate" d={ratePath} />}
        <line className="threshold-line" x1={x(chosen.reviewed)} x2={x(chosen.reviewed)} y1={pad.top} y2={height - pad.bottom} />
        {points.map((point, step) => (
          <circle key={point.threshold} className={`curve-dot${step === index ? ' chosen' : ''}`} cx={x(point.reviewed)} cy={y(point.caught)} r={step === index ? 7 : 4} onClick={() => setIndex(step)}>
            <title>{`${thresholdText(point)}: ${point.reviewed} · ${point.caught} of ${curve.of}`}</title>
          </circle>
        ))}
        <text className="axis-title" x={(pad.left + width - pad.right) / 2} y={height - 8} textAnchor="middle">
          {curve.xLabel} →
        </text>
        <text className="axis-title" x={pad.left} y={12}>
          ↑ {curve.yLabel}
          {curve.of ? ` (of ${curve.of})` : ''}
        </text>
        {hasRate && (
          <text className="axis-title rate" x={width - pad.right} y={12} textAnchor="end">
            {curve.rateLabel ?? 'Rate'} (dashed) ↑
          </text>
        )}
      </svg>

      <div className="threshold-control">
        <label htmlFor={`threshold-${curve.title}`}>
          <span className="eyebrow">Set the bar</span>
          <strong className="num">{thresholdText(chosen)}</strong>
        </label>
        <input id={`threshold-${curve.title}`} type="range" min={0} max={points.length - 1} step={1} value={index} onChange={(event) => setIndex(Number(event.target.value))} aria-valuetext={thresholdText(chosen)} />
        <p className="threshold-readout" aria-live="polite">
          <strong className="num">{chosen.reviewed.toLocaleString('en-US')}</strong> {(curve.xLabel ?? 'items').toLowerCase()}
          <span className="sep">·</span>
          <strong className="num">
            {chosen.caught.toLocaleString('en-US')}
            {curve.of ? ` of ${curve.of}` : ''}
          </strong>{' '}
          {(curve.yLabel ?? 'caught').toLowerCase()}
          {Number.isFinite(chosen.rate) && (
            <>
              <span className="sep">·</span>
              <strong className="num">{percent(chosen.rate)}</strong> {(curve.rateLabel ?? 'rate').toLowerCase()}
            </>
          )}
        </p>
      </div>

      <details>
        <summary>The curve as a table</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">Bar</th>
                <th scope="col" className="num">{curve.xLabel}</th>
                <th scope="col" className="num">{curve.yLabel}</th>
                {hasRate && <th scope="col" className="num">{curve.rateLabel ?? 'Rate'}</th>}
              </tr>
            </thead>
            <tbody>
              {points.map((point, step) => (
                <tr key={point.threshold} className={step === index ? 'selected' : undefined}>
                  <th scope="row">{thresholdText(point)}</th>
                  <td className="num">{point.reviewed}</td>
                  <td className="num">
                    {point.caught}
                    {curve.of ? ` of ${curve.of}` : ''}
                  </td>
                  {hasRate && <td className="num">{Number.isFinite(point.rate) ? percent(point.rate) : '–'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * Does a confident answer deserve its confidence? Bars are how often each confidence band was right;
 * the diagonal is what perfect calibration would look like. Only drawn for demos that grade per item.
 */
export function CalibrationPanel({ grades }) {
  const data = useMemo(() => reliability(grades), [grades]);
  const curve = useMemo(() => automationCurve(grades), [grades]);
  const [step, setStep] = useState(3);
  if (!data) return null;

  const width = 420;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 40, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (value) => pad.left + value * plotW;
  const y = (value) => height - pad.bottom - value * plotH;
  const chosen = curve?.[Math.min(step, (curve?.length ?? 1) - 1)];

  return (
    <div className="calibration-block">
      <div className="stack" style={{ gap: 8 }}>
        <h4>Is the confidence earned?</h4>
        <p className="meta">
          {data.total} graded answers, grouped by the confidence the model gave. Bars on the dashed line mean a 70% answer is right 70% of the time. Calibration error{' '}
          <strong className="num">{(data.ece * 100).toFixed(1)} pts</strong>.
        </p>
        <svg className="calibration-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Reliability diagram. ${data.buckets.filter((bucket) => bucket.count).map((bucket) => `confidence ${Math.round(bucket.from * 100)} to ${Math.round(bucket.to * 100)} percent: right ${percent(bucket.accuracy, 0)} of ${bucket.count}`).join('; ')}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
              <text className="axis-text" x={pad.left - 8} y={y(tick) + 4} textAnchor="end">
                {Math.round(tick * 100)}%
              </text>
              <text className="axis-text" x={x(tick)} y={height - pad.bottom + 16} textAnchor="middle">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          <line className="ideal-line" x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
          {data.buckets.map(
            (bucket) =>
              bucket.count > 0 && (
                <g key={bucket.from} className={bucket.count < 10 ? 'thin' : undefined}>
                  <rect className="calibration-bar" x={x(bucket.from) + 3} width={plotW / data.buckets.length - 6} y={y(bucket.accuracy)} height={Math.max(1, y(0) - y(bucket.accuracy))} rx="3">
                    <title>{`Confidence ${Math.round(bucket.from * 100)}–${Math.round(bucket.to * 100)}%: right ${bucket.right} of ${bucket.count}`}</title>
                  </rect>
                  <line className="interval" x1={x((bucket.from + bucket.to) / 2)} x2={x((bucket.from + bucket.to) / 2)} y1={y(bucket.interval.low)} y2={y(bucket.interval.high)} />
                  <text className="bar-count" x={x((bucket.from + bucket.to) / 2)} y={y(bucket.accuracy) - 6} textAnchor="middle">
                    n={bucket.count}
                  </text>
                </g>
              ),
          )}
          <text className="axis-title" x={(pad.left + width - pad.right) / 2} y={height - 4} textAnchor="middle">
            Confidence the model gave →
          </text>
        </svg>
      </div>

      {curve && chosen && (
        <div className="stack automation" style={{ gap: 10 }}>
          <h4>What could run without a person</h4>
          <p className="meta">Only let an answer through when its confidence clears the bar. Move the bar and read the trade.</p>
          <div className="threshold-control">
            <label htmlFor="automation-bar">
              <span className="eyebrow">Confidence bar</span>
              <strong className="num">{Math.round(chosen.threshold * 100)}%</strong>
            </label>
            <input id="automation-bar" type="range" min={0} max={curve.length - 1} step={1} value={step} onChange={(event) => setStep(Number(event.target.value))} aria-valuetext={`${Math.round(chosen.threshold * 100)} percent`} />
          </div>
          <dl className="automation-readout" aria-live="polite">
            <div>
              <dt>Runs unattended</dt>
              <dd className="num">{percent(chosen.share, 0)}</dd>
              <span className="meta num">{chosen.cleared} of {data.total}</span>
            </div>
            <div>
              <dt>Of those, right</dt>
              <dd className="num">{percent(chosen.precision)}</dd>
              <span className="meta num">{chosen.wrong} wrong would go through</span>
            </div>
            <div>
              <dt>Left for a person</dt>
              <dd className="num">{data.total - chosen.cleared}</dd>
              <span className="meta">below the bar</span>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const showValue = (key, value, currency) => {
  if (typeof value === 'number') return /(amount|cost|value|held|released|total|saved|restricted|disputed|gather|risk)/i.test(key) && !/count|problems|failures|scans|points/i.test(key) ? formatAmount(value, currency ?? 'USD').replace(/\.00$/, '') : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return humaniseValue(value) ?? '–';
};

/**
 * Anything a report returns that no widget claims. A record of numbers becomes a row of figures and a
 * list of records becomes a table, so a demo that computes something new is never silently dropped.
 */
export function ExtraSections({ report, known, onSelect, currency }) {
  const extras = Object.entries(report).filter(([key, value]) => !known.has(key) && value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0));
  if (!extras.length) return null;
  const scalars = extras.filter(([, value]) => !isRecord(value) && !Array.isArray(value));

  return (
    <div className="stack extra-sections" style={{ gap: 20 }}>
      {scalars.length > 0 && (
        <dl className="extra-figures">
          {scalars.map(([key, value]) => (
            <div key={key}>
              <dt>{humaniseKey(key)}</dt>
              <dd className="num">{showValue(key, value, currency)}</dd>
            </div>
          ))}
        </dl>
      )}
      {extras
        .filter(([, value]) => isRecord(value))
        .map(([key, value]) => (
          <div key={key} className="stack" style={{ gap: 8 }}>
            <h4>{humaniseKey(key)}</h4>
            <dl className="extra-figures">
              {Object.entries(value)
                .filter(([, inner]) => !isRecord(inner) && !Array.isArray(inner))
                .map(([innerKey, inner]) => (
                  <div key={innerKey}>
                    <dt>{humaniseKey(innerKey)}</dt>
                    <dd className="num">{showValue(innerKey, inner, currency)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      {extras
        .filter(([, value]) => Array.isArray(value) && value.every(isRecord))
        .map(([key, rows]) => {
          const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((column) => rows.some((row) => !isRecord(row[column]) && !Array.isArray(row[column])));
          const numeric = columns.filter((column) => column !== 'id' && rows.every((row) => typeof row[column] === 'number'));
          const lead = numeric[numeric.length - 1];
          const max = lead ? Math.max(...rows.map((row) => Math.abs(row[lead])), 1) : 1;
          return (
            <div key={key} className="stack" style={{ gap: 8 }}>
              <h4>
                {humaniseKey(key)} <span className="meta num">{rows.length}</span>
              </h4>
              <div className="table-scroll">
                <table className="data-table compact ranked-table">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} scope="col" className={numeric.includes(column) ? 'num' : undefined}>
                          {humaniseKey(column)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 25).map((row, index) => (
                      <tr key={row.id ?? index}>
                        {columns.map((column) => (
                          <td key={column} className={numeric.includes(column) ? 'num' : undefined}>
                            {column === 'id' && onSelect ? (
                              <button type="button" className="button ghost chip" onClick={() => onSelect(row.id)}>
                                {row.id}
                              </button>
                            ) : (
                              <>
                                {column === lead && <span className="rank-bar" style={{ width: `${Math.max(2, (Math.abs(row[column]) / max) * 100)}%` }} aria-hidden="true" />}
                                <span className="rank-value">{showValue(column, row[column], currency)}</span>
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 25 && <p className="meta">Showing the first 25 of {rows.length}.</p>}
            </div>
          );
        })}
    </div>
  );
}

export function SectionHeading({ id, icon, title, note }) {
  return (
    <div className="report-section-head" id={id}>
      <Icon name={icon} size={18} />
      <div className="stack" style={{ gap: 2 }}>
        <h3>{title}</h3>
        {note && <p className="meta">{note}</p>}
      </div>
    </div>
  );
}
