import { Icon } from '../components/Icon.jsx';
import { CalibrationPanel, ConfusionMatrix, CoverageCurve, DistributionBar, ExtraSections, SectionHeading } from './charts.jsx';
import { CheckList, KpiRow, StudyWidgets, TopItems, hasStudy } from './widgets.jsx';

// Every key a shared widget draws. Anything else a report returns is drawn by ExtraSections, so a demo
// that computes something new shows it without anybody editing this file.
const KNOWN = new Set([
  'note', 'kpis', 'findings', 'distribution', 'distributionTitle', 'analysisRows', 'analysisTitle', 'matrix', 'fingerprints', 'curve',
  'costs', 'costsTitle', 'equityCurve', 'sizeScatter', 'breakdowns', 'comparisonTable', 'qualityGrid', 'ratioRows', 'yieldSafety',
  'dividendRows', 'peerSets', 'eventClusters', 'entityNetwork', 'timingGrid', 'overfitGallery', 'checks', 'topItems', 'topItemsTitle',
  'metrics', 'baselines',
]);

/** The model beside the alternatives: a rule somebody could write in an afternoon, or no judgement at all. */
function BaselineBars({ rows }) {
  const best = Math.max(...rows.map((row) => row.value ?? 0), 0.0001);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>Against the alternatives</h4>
      <p className="meta">A number means little alone. These are what the same items score with no model at all.</p>
      <ul className="baseline-bars">
        {rows.map((row) => (
          <li key={row.label} className={row.model ? 'model' : undefined}>
            <span className="baseline-label">
              <strong>{row.label}</strong>
              {row.detail && <span className="meta">{row.detail}</span>}
            </span>
            <span className="baseline-track">
              <i style={{ width: `${Math.max(2, ((row.value ?? 0) / best) * 100)}%` }} />
            </span>
            <strong className="num">{row.display ?? `${((row.value ?? 0) * 100).toFixed(1)}%`}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The whole report, in the order a reader asks: how good, how sure, where to set the bar, what broke. */
export function ReportPanel({ report, grades = [], currency, onSelect, onFilter }) {
  if (!report) return null;
  const hasAccuracy = Boolean(report.matrix) || grades.length >= 10 || report.baselines?.length > 0;

  return (
    <section className="panel report-panel stack" id="report" aria-labelledby="report-title" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">The whole run</span>
        <h2 id="report-title">Report</h2>
        {report.note && <p className="meta report-note">{report.note}</p>}
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

      {report.distribution?.length > 0 && <DistributionBar title={report.distributionTitle} items={report.distribution} onSelect={(entry) => entry.itemId && onSelect?.(entry.itemId)} />}

      {hasAccuracy && (
        <div className="stack report-section" style={{ gap: 20 }}>
          <SectionHeading id="report-accuracy" icon="check" title="Against the right answer" note="Graded against labels the model never saw." />
          {report.baselines?.length > 0 && <BaselineBars rows={report.baselines} />}
          {report.matrix && <ConfusionMatrix matrix={report.matrix} onSelect={onSelect} onFilter={onFilter} />}
          <CalibrationPanel grades={grades} />
        </div>
      )}

      {report.curve && (
        <div className="stack report-section" style={{ gap: 20 }}>
          <SectionHeading id="report-threshold" icon="chart" title="Where to set the bar" note="The same answers, read at different thresholds." />
          <CoverageCurve curve={report.curve} />
        </div>
      )}

      {hasStudy(report) && (
        <div className="stack report-section" style={{ gap: 20 }}>
          <SectionHeading id="report-study" icon="report" title="What the run shows" />
          <StudyWidgets report={report} onSelect={onSelect} />
        </div>
      )}

      <ExtraSections report={report} known={KNOWN} onSelect={onSelect} currency={currency} />

      {report.checks?.length > 0 && (
        <div className="stack report-section" style={{ gap: 16 }}>
          <SectionHeading id="report-checks" icon="alert" title="Checks" note="What was missed, and where the answers contradict each other." />
          <CheckList checks={report.checks} onSelect={onSelect} onFilter={onFilter} />
        </div>
      )}

      <TopItems items={report.topItems} title={report.topItemsTitle} onSelect={onSelect} />
    </section>
  );
}
