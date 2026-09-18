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
                    className={`num${cell.diagonal ? ' diagonal' : ''}${cell.count ? '' : ' empty'}`}
                    style={cell.count ? { backgroundColor: `color-mix(in srgb, var(--${cell.diagonal ? 'positiveBg' : 'warningBg'}) ${Math.round((cell.count / max) * 100)}%, transparent)` } : undefined}
                  >
                    {cell.count || '·'}
                  </td>
                ))}
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

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{curve.title}</h4>
      <svg className="coverage-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${curve.yLabel} against ${curve.xLabel}. ${curve.points.map((point) => `at ${Math.round(point.threshold * 100)} percent, ${point.reviewed} lines opened and ${point.caught} of ${curve.of} problems caught`).join('; ')}`}>
        <line className="axis-line" x1={40} y1={height - 30} x2={width - 16} y2={height - 30} />
        <line className="axis-line" x1={40} y1={16} x2={40} y2={height - 30} />
        <path className="curve-line" d={path} />
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
      {report.matrix && <ConfusionMatrix matrix={report.matrix} onSelect={onSelect} />}
      {report.curve && <CoverageCurve curve={report.curve} />}
      <CheckList checks={report.checks} onSelect={onSelect} />
      <TopItems items={report.topItems} onSelect={onSelect} />
    </section>
  );
}
