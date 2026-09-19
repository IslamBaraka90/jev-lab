import { useState } from 'react';
import { Icon } from '../components/Icon.jsx';

// The shared report pieces. A demo's `report()` returns data in these shapes and never draws its own
// widgets, so every report in the catalog reads the same way.

export function KpiRow({ kpis = [] }) {
  return (
    <div className="kpi-strip">
      {kpis.map((kpi) => (
        <article key={kpi.label} className={`kpi tone-${kpi.tone ?? 'plain'}`}>
          <span className="kpi-label">{kpi.label}</span>
          <strong className="kpi-value num">{kpi.value}</strong>
          {kpi.context && <span className="meta">{kpi.context}</span>}
        </article>
      ))}
    </div>
  );
}

/** How the answers split across the options, as one bar and a legend. */
export function DistributionBar({ items = [], onSelect }) {
  const total = items.reduce((sum, entry) => sum + entry.count, 0) || 1;
  return (
    <div className="distribution">
      <div className="distribution-bar" role="img" aria-label={items.map((entry) => `${entry.label}: ${entry.count}`).join(', ')}>
        {items.map((entry) => (
          <span key={entry.label} className={`segment ${entry.tone ?? ''}`} style={{ flexGrow: entry.count }} />
        ))}
      </div>
      <ul className="distribution-legend">
        {items.map((entry) => (
          <li key={entry.label}>
            <button type="button" className="link-button" onClick={() => onSelect?.(entry)}>
              <span className={`legend-key ${entry.tone ?? ''}`} aria-hidden="true" />
              {entry.label.toLowerCase().replaceAll('_', ' ')}
              <span className="meta num">
                {entry.count} · {Math.round((entry.count / total) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The checks a demo runs over its own results: what was missed, what contradicts what. */
export function CheckList({ checks = [], onSelect }) {
  if (checks.length === 0) return null;
  return (
    <ul className="check-list">
      {checks.map((check) => (
        <li key={check.id} className={check.count ? 'flagged' : undefined}>
          <span className="check-icon" aria-hidden="true">
            <Icon name={check.count ? 'alert' : 'check'} size={18} />
          </span>
          <div className="grow stack" style={{ gap: 4 }}>
            <strong>{check.label}</strong>
            {check.detail && <span className="meta">{check.detail}</span>}
            {check.items?.length > 0 && (
              <span className="check-examples">
                {check.items.slice(0, 8).map((id) => (
                  <button key={id} type="button" className="button ghost chip" onClick={() => onSelect?.(id)}>
                    {id}
                  </button>
                ))}
                {check.items.length > 8 && <span className="meta">and {check.items.length - 8} more</span>}
              </span>
            )}
          </div>
          <span className="check-count num">
            <strong>{check.count}</strong>
            {check.of !== undefined && <span className="meta"> of {check.of}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The handful of items worth opening, straight from the report. */
export function TopItems({ items = [], title = 'Worth opening', onSelect }) {
  if (items.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{title}</h4>
      <ul className="top-items">
        {items.map((entry) => (
          <li key={entry.id}>
            <button type="button" className="link-button" onClick={() => onSelect?.(entry.id)}>
              <span>{entry.label ?? entry.id}</span>
              {entry.value !== undefined && <span className="meta num">{entry.value}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


/** Predicted against actual, for demos that know the right answer. The diagonal is the good news. */
export function ConfusionMatrix({ matrix, onSelect }) {
  const [selection, setSelection] = useState(null);
  if (!matrix?.rows?.length) return null;
  const max = Math.max(...matrix.rows.flatMap((row) => row.cells.map((cell) => cell.count)), 1);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{matrix.title}</h4>
      <div className="table-scroll">
        <table className="data-table compact confusion">
          <thead>
            <tr>
              <th scope="col">Planted ↓ · Called →</th>
              {matrix.columns.map((column) => (
                <th key={column} scope="col" className="num">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td
                    key={index}
                    className={`num${cell.diagonal ? ' diagonal' : ''}${cell.count ? '' : ' cell-empty'}`}
                    style={cell.count ? { backgroundColor: `color-mix(in srgb, var(--${cell.diagonal ? 'positiveBg' : 'warningBg'}) ${Math.round((cell.count / max) * 100)}%, transparent)` } : undefined}
                  >
                    {cell.count && cell.items?.length ? (
                      <button
                        type="button"
                        className="matrix-cell-button"
                        aria-label={cell.ariaLabel ?? `${row.label}, ${matrix.columns[index]}: ${cell.count}`}
                        aria-expanded={selection?.key === `${row.label}:${index}`}
                        onClick={() => setSelection({ key: `${row.label}:${index}`, label: cell.ariaLabel ?? `${row.label} called ${matrix.columns[index]}`, items: cell.items })}
                      >
                        {cell.count}
                      </button>
                    ) : (cell.count || '·')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selection && (
        <div className="matrix-drilldown stack" role="region" aria-live="polite" aria-label={selection.label}>
          <strong>{selection.label}</strong>
          <div className="cluster-list">
            {selection.items.map((id) => (
              <button key={id} type="button" className="button ghost chip" onClick={() => onSelect?.(id)}>{id}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A compact, data-derived comparison of normalised fingerprints across labelled groups. */
export function FingerprintChart({ chart }) {
  if (!chart?.series?.length || !chart?.metrics?.length) return null;
  return (
    <div className="stack fingerprint-chart" style={{ gap: 8 }}>
      <h4>{chart.title}</h4>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Fingerprint</th>
              {chart.metrics.map((metric) => <th key={metric.key} scope="col">{metric.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {chart.series.map((series) => (
              <tr key={series.id}>
                <th scope="row">{series.label}</th>
                {chart.metrics.map((metric) => {
                  const value = series.values.find((entry) => entry.key === metric.key)?.value ?? 0;
                  return (
                    <td key={metric.key}>
                      <span className="fingerprint-bar" aria-label={`${metric.label}: ${Math.round(value * 100)} percent`}>
                        <span style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
                      </span>
                      <span className="meta num">{Math.round(value * 100)}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Where to set a threshold: how much a person reads against how much that catches. */
export function CoverageCurve({ curve }) {
  if (!curve?.points?.length) return null;
  const width = 520;
  const height = 180;
  const maxReviewed = Math.max(...curve.points.map((point) => point.reviewed), 1);
  const x = (point) => 40 + (point.reviewed / maxReviewed) * (width - 60);
  const y = (point) => height - 30 - (point.caught / Math.max(curve.of, 1)) * (height - 50);
  const path = curve.points.map((point, index) => `${index ? 'L' : 'M'}${x(point).toFixed(1)},${y(point).toFixed(1)}`).join('');
  // A demo may also carry a rate per point, such as the share of automatic postings that were right.
  const rates = curve.points.filter((point) => Number.isFinite(point.rate));
  const ratePath = rates.map((point, index) => `${index ? 'L' : 'M'}${x(point).toFixed(1)},${(height - 30 - point.rate * (height - 50)).toFixed(1)}`).join('');

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{curve.title}</h4>
      <svg className="coverage-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${curve.yLabel} against ${curve.xLabel}. ${curve.points.map((point) => `at ${Math.round(point.threshold * 100)} percent, ${point.reviewed} lines opened and ${point.caught} of ${curve.of} problems caught`).join('; ')}`}>
        <line className="axis-line" x1={40} y1={height - 30} x2={width - 16} y2={height - 30} />
        <line className="axis-line" x1={40} y1={16} x2={40} y2={height - 30} />
        <path className="curve-line" d={path} />
        {ratePath && <path className="curve-rate" d={ratePath} />}
        {curve.points.map((point) => (
          <circle key={point.threshold} className="curve-dot" cx={x(point)} cy={y(point)} r={3.5}>
            <title>{`${Math.round(point.threshold * 100)}%: ${point.reviewed} lines, ${point.caught} of ${curve.of} problems`}</title>
          </circle>
        ))}
        <text className="axis-text" x={40} y={height - 10}>
          {curve.xLabel}
        </text>
        <text className="axis-text" x={40} y={12}>
          {curve.yLabel} (of {curve.of})
          {rates.length > 0 ? ` · dashed: ${curve.rateLabel ?? 'rate'}` : ''}
        </text>
      </svg>
      <details>
        <summary>Table</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">Threshold</th>
                <th scope="col" className="num">Lines opened</th>
                <th scope="col" className="num">Problems caught</th>
                {rates.length > 0 && (
                  <th scope="col" className="num">
                    {curve.rateLabel ?? 'Rate'}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {curve.points.map((point) => (
                <tr key={point.threshold}>
                  <th scope="row">{Math.round(point.threshold * 100)}%</th>
                  <td className="num">{point.reviewed}</td>
                  <td className="num">
                    {point.caught} of {curve.of}
                  </td>
                  {rates.length > 0 && <td className="num">{Number.isFinite(point.rate) ? `${Math.round(point.rate * 100)}%` : '–'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** The whole report: whatever the demo filled in, in a fixed order. */
export function ReportPanel({ report, onSelect }) {
  if (!report) return null;
  return (
    <section className="panel report-panel stack" aria-labelledby="report-title" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="report-title">Report</h3>
        {report.note && <p className="meta">{report.note}</p>}
      </div>
      <KpiRow kpis={report.kpis} />
      {report.findings?.length > 0 && (
        <ul className="findings">
          {report.findings.map((finding) => (
            <li key={finding}>
              <Icon name="info" size={16} />
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      )}
      {report.distribution?.length > 0 && <DistributionBar items={report.distribution} onSelect={(entry) => onSelect?.(entry.itemId)} />}
      {report.analysisRows?.length > 0 && <FeatureGapTable title={report.analysisTitle} rows={report.analysisRows} />}
      {report.matrix && <ConfusionMatrix matrix={report.matrix} onSelect={onSelect} />}
      {report.fingerprints && <FingerprintChart chart={report.fingerprints} />}
      {report.curve && <CoverageCurve curve={report.curve} />}
      {report.costs?.length > 0 && <CostBars items={report.costs} />}
      {report.equityCurve && <EquityCurve chart={report.equityCurve} />}
      {report.sizeScatter && <SizeScatter chart={report.sizeScatter} />}
      {report.breakdowns?.map((table) => <BreakdownTable key={table.title} table={table} />)}
      {report.comparisonTable && <ComparisonTable table={report.comparisonTable} />}
      {report.qualityGrid && <QualityLeverageGrid chart={report.qualityGrid} />}
      {report.ratioRows?.length > 0 && <RatioCrossCheck rows={report.ratioRows} />}
      {report.yieldSafety && <DividendSafetyScatter chart={report.yieldSafety} rows={report.dividendRows} />}
      {report.peerSets?.length > 0 && <PeerValuationReport sets={report.peerSets} />}
      {report.eventClusters && <EventClusterReport clusters={report.eventClusters} />}
      {report.entityNetwork && <EntityNetworkReport network={report.entityNetwork} />}
      {report.timingGrid && <TimingGridReport grid={report.timingGrid} />}
      {report.overfitGallery && <OverfitGallery gallery={report.overfitGallery} onSelect={onSelect} />}
      <CheckList checks={report.checks} onSelect={onSelect} />
      <TopItems items={report.topItems} onSelect={onSelect} />
    </section>
  );
}

function CostBars({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="stack" style={{ gap: 8 }}><h4>Estimated cost by habit</h4><ul className="cost-bars">{items.map((item) => <li key={item.label}><span>{item.label}</span><span className="cost-track"><i style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></span><strong className="num">{item.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</strong><small className="meta">{item.count} days</small></li>)}</ul></div>;
}

/**
 * One equity curve, or two on the same axes when the points carry a `compare` value — which is how a
 * demo shows "every signal" against "only the ones it kept" without the two being scaled differently.
 */
function EquityCurve({ chart }) {
  const width = 760;
  const height = 220;
  const compared = chart.points.some((point) => typeof point.compare === 'number');
  const values = chart.points.flatMap((point) => (compared ? [point.value, point.compare] : [point.value]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const x = (index) => 54 + index / Math.max(chart.points.length - 1, 1) * (width - 76);
  const y = (value) => 18 + (max - value) / span * (height - 52);
  const line = (pick) => chart.points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join('');
  const money = (value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{chart.title}</h4>
      <svg className="behaviour-report-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${compared ? `Two curves over ${chart.points.length} events; the table below carries both.` : `${chart.points.filter((point) => point.flagged).length} flagged days among ${chart.points.length}.`}`}>
        <line className="report-axis" x1="54" y1={height - 30} x2={width - 22} y2={height - 30} />
        <path className="report-line" d={line((point) => point.value)} />
        {compared && <path className="report-line compare" d={line((point) => point.compare)} />}
        {chart.points.map((point, index) => point.flagged && <circle key={point.id} className="report-flag" cx={x(index)} cy={y(compared ? point.compare : point.value)} r="3.5"><title>{`${point.label}: ${(compared ? point.compare : point.value).toLocaleString('en-US')} · ${point.pattern}`}</title></circle>)}
        <text className="report-axis-text" x="54" y={height - 9}>{compared ? `${chart.seriesLabel} against ${chart.compareLabel} · marked where the second one traded` : 'Trading days · flagged days are marked'}</text>
      </svg>
      {compared && (
        <p className="meta equity-legend">
          <span><i className="legend-line series-key" />{chart.seriesLabel}</span>
          <span><i className="legend-line compare-key" />{chart.compareLabel}</span>
        </p>
      )}
      <details>
        <summary>Equity curve as a table</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead><tr><th>Date</th><th className="num">{compared ? chart.seriesLabel : 'Equity'}</th>{compared && <th className="num">{chart.compareLabel}</th>}<th>Jev flag</th></tr></thead>
            <tbody>{chart.points.map((point) => <tr key={point.id}><th scope="row">{point.label}</th><td className="num">{money(point.value)}</td>{compared && <td className="num">{money(point.compare)}</td>}<td>{point.flagged ? point.pattern : 'None'}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SizeScatter({ chart }) {
  const width = 640;
  const height = 220;
  const max = Math.max(...chart.points.flatMap((point) => [point.norm, point.value]), 1) * 1.05;
  const x = (value) => 54 + value / max * (width - 80);
  const y = (value) => height - 36 - value / max * (height - 58);
  return <div className="stack" style={{ gap: 8 }}><h4>{chart.title}</h4><svg className="behaviour-report-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${chart.points.length} trades; the diagonal represents actual size equal to the rolling norm.`}><line className="report-axis" x1="54" y1={height - 36} x2={width - 22} y2={height - 36} /><line className="report-axis" x1="54" y1="20" x2="54" y2={height - 36} /><line className="report-norm-line" x1="54" y1={height - 36} x2={x(max)} y2={y(max)} />{chart.points.map((point, index) => <circle key={`${point.label}-${index}`} className={point.flagged ? 'scatter-point flagged' : 'scatter-point'} cx={x(point.norm)} cy={y(point.value)} r="2.4"><title>{`${point.label}: norm ${point.norm}, actual ${point.value}`}</title></circle>)}<text className="report-axis-text" x="54" y={height - 10}>Rolling median size →</text><text className="report-axis-text" x="58" y="14">Actual size ↑</text></svg></div>;
}

function BreakdownTable({ table }) {
  return <div className="table-scroll"><h4>{table.title}</h4><table className="data-table compact"><thead><tr><th>Group</th><th className="num">Setups</th><th className="num">Missed</th><th className="num">Miss rate</th><th className="num">Missed outcome</th></tr></thead><tbody>{table.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td className="num">{row.total}</td><td className="num">{row.missed}</td><td className="num">{(row.rate * 100).toFixed(1)}%</td><td className="num">{row.outcome.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</td></tr>)}</tbody></table></div>;
}

function ComparisonTable({ table }) {
  return <div className="table-scroll"><h4>{table.title}</h4><table className="data-table compact"><thead><tr><th>Measure</th>{table.columns.map((column) => <th key={column.label} className="num">{column.label}</th>)}</tr></thead><tbody>{table.rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th>{table.columns.map((column) => <td key={column.label} className="num">{row.format(column[row.key])}</td>)}</tr>)}</tbody></table></div>;
}

function QualityLeverageGrid({ chart }) {
  const width = 560, height = 300, pad = 44;
  const x = (value) => pad + value / 6 * (width - pad * 2);
  const y = (value) => height - pad - value / 6 * (height - pad * 2);
  return <div className="stack" style={{ gap: 8 }}><h4>{chart.title}</h4><svg className="quality-grid" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${chart.points.map((point) => `${point.label}: quality ${point.quality.toFixed(1)}, leverage ${point.leverage.toFixed(1)}${point.gap ? ', statement gap' : ''}`).join('; ')}`}>
    {Array.from({ length: 7 }, (_, tick) => <g key={tick}><line className="report-axis" x1={x(tick)} y1={pad} x2={x(tick)} y2={height - pad} /><line className="report-axis" x1={pad} y1={y(tick)} x2={width - pad} y2={y(tick)} /><text className="report-axis-text" x={x(tick)} y={height - 16} textAnchor="middle">{tick}</text><text className="report-axis-text" x={24} y={y(tick) + 4} textAnchor="middle">{tick}</text></g>)}
    {chart.points.map((point) => <g key={point.id} className={point.gap ? 'quality-point gap' : 'quality-point'}><circle cx={x(point.leverage)} cy={y(point.quality)} r="8"><title>{`${point.label}: quality ${point.quality.toFixed(1)}, leverage ${point.leverage.toFixed(1)}`}</title></circle><text x={x(point.leverage) + 10} y={y(point.quality) - 8}>{point.label}</text></g>)}
    <text className="report-axis-text" x={width / 2} y={height - 2} textAnchor="middle">Leverage risk →</text><text className="report-axis-text" x={pad} y={16}>Quality ↑</text>
  </svg></div>;
}

function RatioCrossCheck({ rows }) {
  return <div className="table-scroll ratio-cross-check"><h4>Jev reading against computed ratios</h4><table className="data-table compact"><thead><tr><th>Symbol</th><th>Jev earnings</th><th>Computed earnings</th><th>Jev direction</th><th>Computed direction</th><th className="num">Cash conversion</th><th className="num">Debt / equity</th><th className="num">Net debt / EBITDA proxy</th><th>Gap</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={row.disagree ? 'ratio-disagree' : undefined}><th scope="row">{row.symbol}{row.disagree ? ' ⚠' : ''}</th><td>{row.modelEarnings}</td><td>{row.computedEarnings}</td><td>{row.modelDirection}</td><td>{row.computedDirection}</td><td className="num">{Number.isFinite(row.cashConversion) ? row.cashConversion.toFixed(2) : '–'}</td><td className="num">{Number.isFinite(row.debtToEquity) ? row.debtToEquity.toFixed(2) : '–'}</td><td className="num">{Number.isFinite(row.netDebtProxy) ? row.netDebtProxy.toFixed(2) : '–'}</td><td>{row.gap}</td></tr>)}</tbody></table></div>;
}

function DividendSafetyScatter({ chart, rows = [] }) {
  const width = 600, height = 300, pad = 48;
  const maxYield = Math.max(...chart.points.map((point) => point.yield), 1) * 1.1;
  const x = (value) => pad + value / maxYield * (width - pad * 2);
  const y = (value) => height - pad - value / 6 * (height - pad * 2);
  return <div className="stack dividend-safety-chart" style={{ gap: 8 }}><h4>{chart.title}</h4><svg className="quality-grid" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${chart.points.map((point) => `${point.label}: ${point.yield.toFixed(2)} percent yield, safety ${point.safety.toFixed(1)}`).join('; ')}`}>
    {Array.from({ length: 7 }, (_, tick) => <g key={tick}><line className="report-axis" x1={pad} y1={y(tick)} x2={width - pad} y2={y(tick)} /><text className="report-axis-text" x={26} y={y(tick) + 4}>{tick}</text></g>)}
    {chart.points.map((point) => <g key={point.id} className={point.highRisk ? 'quality-point gap' : 'quality-point'}><circle cx={x(point.yield)} cy={y(point.safety)} r="8"><title>{`${point.label}: ${point.yield.toFixed(2)}% yield, safety ${point.safety.toFixed(1)}/6`}</title></circle><text x={x(point.yield) + 10} y={y(point.safety) - 8}>{point.label}</text></g>)}
    <text className="report-axis-text" x={width / 2} y={height - 4} textAnchor="middle">Computed yield →</text><text className="report-axis-text" x={pad} y={16}>Jev safety ↑</text>
  </svg><details><summary>Yield and safety as a table</summary><div className="table-scroll details-content"><table className="data-table compact"><thead><tr><th>Symbol</th><th className="num">Jev safety</th><th className="num">Yield</th><th className="num">Earnings cover</th><th className="num">Cash cover</th><th className="num">Dividend growth</th><th>First pressure · Jev / computed</th><th>Debt-funded · Jev / computed</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.symbol}</th><td className="num">{row.safety.toFixed(1)} / 6</td><td className="num">{Number.isFinite(row.yield) ? `${row.yield.toFixed(2)}%` : '–'}</td><td className="num">{Number.isFinite(row.earningsCover) ? `${row.earningsCover.toFixed(2)}×` : '–'}</td><td className="num">{Number.isFinite(row.cashCover) ? `${row.cashCover.toFixed(2)}×` : '–'}</td><td className="num">{Number.isFinite(row.growth) ? `${row.growth.toFixed(1)}%` : '–'}</td><td>{row.modelBreak} / {row.computedBreak}</td><td>{row.debtFunded ? 'Yes' : 'No'} / {row.computedDebtFunded === null ? '–' : row.computedDebtFunded ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div></details></div>;
}

function PeerValuationReport({ sets }) {
  const multiple = (value) => Number.isFinite(value) ? `${value.toFixed(2)}×` : '–';
  return <div className="stack peer-valuation-report" style={{ gap: 14 }}><h4>Peer picks against computed multiples</h4>{sets.map((set) => <details key={set.id} open><summary>{set.name} · Jev {set.modelPick} / computed {set.computedBest ?? 'n/a'}{set.loose ? ' · loose set' : ''}</summary><div className="details-content stack" style={{ gap: 10 }}><p className="meta">Cheapest P/E: {set.cheapestPe ?? '–'} · P/B: {set.cheapestPb ?? '–'} · P/FCF: {set.cheapestPfcf ?? '–'} · {set.comparable ? 'Jev accepted comparability' : 'Jev rejected comparability'} · premium {set.premiumJustified ? 'earned' : 'not earned'} · discount reason {set.discountReason}</p><div className="table-scroll"><table className="data-table compact"><thead><tr><th>Peer</th><th className="num">P/E</th><th className="num">P/B</th><th className="num">P/FCF</th><th className="num">EV proxy / FCF</th><th className="num">Operating margin</th><th className="num">4y revenue change</th></tr></thead><tbody>{set.peers.map((peer) => <tr key={peer.symbol}><th scope="row">{peer.symbol}{peer.symbol === set.modelPick ? ' · Jev' : ''}{peer.symbol === set.computedBest ? ' · computed' : ''}</th><td className="num">{multiple(peer.pe)}</td><td className="num">{multiple(peer.pb)}</td><td className="num">{multiple(peer.pfcf)}</td><td className="num">{multiple(peer.evFcf)}</td><td className="num">{Number.isFinite(peer.margin) ? `${peer.margin.toFixed(1)}%` : '–'}</td><td className="num">{Number.isFinite(peer.growth) ? `${peer.growth.toFixed(1)}%` : '–'}</td></tr>)}</tbody></table></div></div></details>)}</div>;
}

function EventClusterReport({ clusters }) {
  return <div className="stack event-cluster-report" style={{ gap: 10 }}><h4>Raw feed → clustered feed</h4><p className="meta">{clusters.before} headlines before · {clusters.after} clusters after</p><div className="table-scroll"><table className="data-table compact"><thead><tr><th>Cluster’s reading source</th><th>Primary outlet</th><th className="num">Headlines</th><th className="num">Adding information</th></tr></thead><tbody>{clusters.rows.map((row) => <tr key={row.id}><th scope="row">{row.title}</th><td>{row.primary}</td><td className="num">{row.size}</td><td className="num">{row.informative}</td></tr>)}</tbody></table></div></div>;
}

function EntityNetworkReport({ network }) {
  const names = new Map(network.nodes.map((node) => [node.id, node.name]));
  return <div className="stack entity-network-report" style={{ gap: 10 }}><h4>Answer-built contagion view</h4><p className="meta">{network.edges.length} active sufficient edges · {network.paths.length} directed two-step paths. Labels are not used to build this view.</p><div className="table-scroll"><table className="data-table compact"><thead><tr><th>From</th><th>Relationship</th><th>To</th><th className="num">Strength</th><th>Contagion</th></tr></thead><tbody>{network.edges.slice(0, 100).map((edge) => <tr key={edge.id}><td>{names.get(edge.from)}</td><td>{edge.relationship.toLowerCase().replaceAll('_', ' ')}</td><td>{names.get(edge.to)}</td><td className="num">{edge.strength.toFixed(1)} / 6</td><td>{edge.contagion ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div><details><summary>Two-step paths</summary><div className="table-scroll details-content"><table className="data-table compact"><thead><tr><th>From</th><th>Via</th><th>Two steps away</th></tr></thead><tbody>{network.paths.slice(0, 100).map((path, index) => <tr key={`${path.from}-${path.via}-${path.to}-${index}`}><td>{names.get(path.from)}</td><td>{names.get(path.via)}</td><td>{names.get(path.to)}</td></tr>)}</tbody></table></div></details></div>;
}

function TimingGridReport({ grid }) {
  return <div className="stack timing-grid-report" style={{ gap: 10 }}><h4>Daily timing grid · long and short kept separate</h4><div className="table-scroll"><table className="data-table compact"><thead><tr><th>Instrument</th><th>Direction</th><th>Weekday</th><th>Month phase</th><th className="num">Instances</th><th className="num">Jev favourable</th><th className="num">Realised 5-bar return</th><th>Claim status</th></tr></thead><tbody>{grid.cells.map((cell) => <tr key={cell.key} className={cell.sufficient ? undefined : 'timing-insufficient'}><th scope="row">{cell.symbol}</th><td>{cell.direction}</td><td>{cell.weekday.toLowerCase()}</td><td>{cell.monthPhase.toLowerCase()}</td><td className="num">{cell.count}</td><td className="num">{(cell.expectedRate * 100).toFixed(1)}%</td><td className="num">{cell.realisedReturn.toFixed(3)}%</td><td>{cell.sufficient ? 'Included' : 'Insufficient (<20)'}</td></tr>)}</tbody></table></div><div className="table-scroll"><table className="data-table compact"><thead><tr><th>Direction</th><th className="num">Instances</th><th className="num">Jev favourable</th><th className="num">Average realised return</th></tr></thead><tbody>{grid.directionRows.map((row) => <tr key={row.direction}><th scope="row">{row.direction}</th><td className="num">{row.count}</td><td className="num">{(row.favourableRate * 100).toFixed(1)}%</td><td className="num">{row.averageReturn.toFixed(3)}%</td></tr>)}</tbody></table></div></div>;
}

function OverfitGallery({ gallery, onSelect }) {
  const spark = (curve) => {
    const values = curve.map((point) => point.equity), min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
    return values.map((value, index) => `${index ? 'L' : 'M'}${(index / Math.max(values.length - 1, 1) * 126 + 2).toFixed(1)},${(4 + (max - value) / span * 32).toFixed(1)}`).join('');
  };
  return <div className="stack overfit-gallery" style={{ gap: 10 }}><h4>{gallery.title}</h4><p className="meta">Every one of the 140 curves, ordered by Jev trust ascending and risk descending. The planted class appears only in this post-answer report.</p><div className="overfit-gallery-grid">{gallery.rows.map((row) => <button type="button" key={row.id} className="overfit-card" onClick={() => onSelect?.(row.id)}><span><strong>{row.id}</strong><small className="meta">trust {row.trust.toFixed(1)} · risk {row.risk.toFixed(1)}</small></span><svg viewBox="0 0 130 40" role="img" aria-label={`${row.id} curve; trust ${row.trust.toFixed(1)}; planted ${row.planted.toLowerCase().replaceAll('_', ' ')}`}><path d={spark(row.curve)} /></svg><span className="meta">{row.symptom.toLowerCase().replaceAll('_', ' ')} · planted {row.planted.toLowerCase().replaceAll('_', ' ')}</span></button>)}</div></div>;
}

function FeatureGapTable({ title = 'Feature gaps', rows }) {
  return (
    <div className="table-scroll">
      <h4>{title}</h4>
      <table className="data-table compact">
        <thead><tr><th>Model answer</th><th>Winners</th><th>Losers</th><th className="num">Gap</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.feature}><th scope="row">{row.feature}</th><td>{row.winners}</td><td>{row.losers}</td><td className="num">{Number(row.gap).toFixed(2)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
