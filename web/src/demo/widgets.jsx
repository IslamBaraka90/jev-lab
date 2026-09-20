import { Icon } from '../components/Icon.jsx';
import { TimingHeatmap } from './TimingHeatmap.jsx';

// The shared report pieces. A demo's `report()` returns data in these shapes and never draws its own
// widgets, so every report in the catalog reads the same way.

export function KpiRow({ kpis = [], limit }) {
  const shown = limit ? kpis.slice(0, limit) : kpis;
  if (!shown.length) return null;
  return (
    <div className="kpi-strip">
      {shown.map((kpi) => (
        <article key={kpi.label} className={`kpi tone-${kpi.tone ?? 'plain'}`}>
          <span className="kpi-label">{kpi.label}</span>
          <strong className="kpi-value num">{kpi.value}</strong>
          {kpi.context && <span className="meta">{kpi.context}</span>}
        </article>
      ))}
    </div>
  );
}

/** The checks a demo runs over its own results: what was missed, what contradicts what. */
export function CheckList({ checks = [], onSelect, onFilter }) {
  if (checks.length === 0) return null;
  return (
    <ul className="check-list">
      {checks.map((check) => {
        const share = check.of ? check.count / check.of : null;
        return (
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
                  {check.items.length > 8 && onFilter && (
                    <button type="button" className="link-button" onClick={() => onFilter(check.label, check.items)}>
                      Show all {check.items.length} in the list
                    </button>
                  )}
                </span>
              )}
            </div>
            <span className="check-count num">
              <strong>{check.count}</strong>
              {check.of !== undefined && <span className="meta"> of {check.of}</span>}
              {share !== null && (
                <span className="check-rate" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, share * 100)}%` }} />
                </span>
              )}
            </span>
          </li>
        );
      })}
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
            <button type="button" className="top-item" onClick={() => onSelect?.(entry.id)}>
              <span>{entry.label ?? entry.id}</span>
              {entry.value !== undefined && <span className="num top-item-value">{entry.value}</span>}
              <Icon name="chevron" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STUDY_KEYS = ['analysisRows', 'fingerprints', 'costs', 'equityCurve', 'sizeScatter', 'breakdowns', 'comparisonTable', 'qualityGrid', 'ratioRows', 'yieldSafety', 'peerSets', 'eventClusters', 'entityNetwork', 'timingGrid', 'overfitGallery'];

export const hasStudy = (report) => STUDY_KEYS.some((key) => (Array.isArray(report[key]) ? report[key].length > 0 : Boolean(report[key])));

/** The charts that belong to one demo's subject rather than to grading in general. */
export function StudyWidgets({ report, onSelect }) {
  return (
    <>
      {report.analysisRows?.length > 0 && <FeatureGapTable title={report.analysisTitle} rows={report.analysisRows} />}
      {report.fingerprints && <FingerprintChart chart={report.fingerprints} />}
      {report.costs?.length > 0 && <CostBars items={report.costs} title={report.costsTitle} />}
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
    </>
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

function CostBars({ items, title = 'Estimated cost by habit' }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="stack" style={{ gap: 8 }}><h4>{title}</h4><ul className="cost-bars">{items.map((item) => <li key={item.label}><span>{item.label}</span><span className="cost-track"><i style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></span><strong className="num">{item.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</strong><small className="meta">{item.count} days</small></li>)}</ul></div>;
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
  return <div className="stack" style={{ gap: 8 }}><h4>{chart.title}</h4><svg className="behaviour-report-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${chart.points.length} trades; the diagonal represents actual size equal to the rolling norm.`}><line className="report-axis" x1="54" y1={height - 36} x2={width - 22} y2={height - 36} /><line className="report-axis" x1="54" y1="20" x2="54" y2={height - 36} /><line className="report-norm-line" x1="54" y1={height - 36} x2={x(max)} y2={y(max)} />{chart.points.map((point, index) => <circle key={`${point.label}-${index}`} className={point.flagged ? 'scatter-point flagged' : 'scatter-point'} cx={x(point.norm)} cy={y(point.value)} r="2.4"><title>{`${point.label}: norm ${point.norm}, actual ${point.value}`}</title></circle>)}<text className="report-axis-text" x="54" y={height - 10}>{chart.xLabel ?? 'Rolling median size'} →</text><text className="report-axis-text" x="58" y="14">{chart.yLabel ?? 'Actual size'} ↑</text></svg></div>;
}

function BreakdownTable({ table }) {
  return <div className="table-scroll"><h4>{table.title}</h4><table className="data-table compact"><thead><tr><th>{table.groupLabel ?? 'Group'}</th><th className="num">{table.totalLabel ?? 'Setups'}</th><th className="num">{table.countLabel ?? 'Missed'}</th><th className="num">{table.rateLabel ?? 'Miss rate'}</th><th className="num">{table.outcomeLabel ?? 'Missed outcome'}</th></tr></thead><tbody>{table.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td className="num">{row.total}</td><td className="num">{row.missed}</td><td className="num">{(row.rate * 100).toFixed(1)}%</td><td className="num">{row.outcome.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</td></tr>)}</tbody></table></div>;
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
  return <div className="stack timing-grid-report" style={{ gap: 16 }}><TimingHeatmap grid={grid} /><details><summary>Every cell as a table</summary><div className="table-scroll details-content"><table className="data-table compact"><thead><tr><th>Instrument</th><th>Direction</th><th>Weekday</th><th>Month phase</th><th className="num">Instances</th><th className="num">Jev favourable</th><th className="num">Realised 5-bar return</th><th>Claim status</th></tr></thead><tbody>{grid.cells.map((cell) => <tr key={cell.key} className={cell.sufficient ? undefined : 'timing-insufficient'}><th scope="row">{cell.symbol}</th><td>{cell.direction}</td><td>{cell.weekday.toLowerCase()}</td><td>{cell.monthPhase.toLowerCase()}</td><td className="num">{cell.count}</td><td className="num">{(cell.expectedRate * 100).toFixed(1)}%</td><td className="num">{cell.realisedReturn.toFixed(3)}%</td><td>{cell.sufficient ? 'Included' : 'Insufficient (<20)'}</td></tr>)}</tbody></table></div></details><div className="table-scroll"><table className="data-table compact"><thead><tr><th>Direction</th><th className="num">Instances</th><th className="num">Jev favourable</th><th className="num">Average realised return</th></tr></thead><tbody>{grid.directionRows.map((row) => <tr key={row.direction}><th scope="row">{row.direction}</th><td className="num">{row.count}</td><td className="num">{(row.favourableRate * 100).toFixed(1)}%</td><td className="num">{row.averageReturn.toFixed(3)}%</td></tr>)}</tbody></table></div></div>;
}

function OverfitGallery({ gallery, onSelect }) {
  const spark = (curve) => {
    const values = curve.map((point) => point.equity), min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
    return values.map((value, index) => `${index ? 'L' : 'M'}${(index / Math.max(values.length - 1, 1) * 126 + 2).toFixed(1)},${(4 + (max - value) / span * 32).toFixed(1)}`).join('');
  };
  return <div className="stack overfit-gallery" style={{ gap: 10 }}><h4>{gallery.title}</h4><p className="meta">Every one of the {gallery.rows.length} curves, ordered by Jev trust ascending and risk descending. The planted class appears only in this post-answer report.</p><div className="overfit-gallery-grid">{gallery.rows.map((row) => <button type="button" key={row.id} className="overfit-card" onClick={() => onSelect?.(row.id)}><span><strong>{row.id}</strong><small className="meta">trust {row.trust.toFixed(1)} · risk {row.risk.toFixed(1)}</small></span><svg viewBox="0 0 130 40" role="img" aria-label={`${row.id} curve; trust ${row.trust.toFixed(1)}; planted ${row.planted.toLowerCase().replaceAll('_', ' ')}`}><path d={spark(row.curve)} /></svg><span className="meta">{row.symptom.toLowerCase().replaceAll('_', ' ')} · planted {row.planted.toLowerCase().replaceAll('_', ' ')}</span></button>)}</div></div>;
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
