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
      {report.distribution?.length > 0 && <DistributionBar items={report.distribution} onSelect={(entry) => onSelect?.(entry.itemId)} />}
      <CheckList checks={report.checks} onSelect={onSelect} />
      <TopItems items={report.topItems} onSelect={onSelect} />
    </section>
  );
}
