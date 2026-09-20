import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Segmented } from '../components/ui.jsx';
import scoreboard from '../generated/scoreboard.json';
import { DOMAINS } from '../../../demos/index.js';
import { formatDate } from '../lib/format.js';
import { Link } from '../lib/router.jsx';

// The whole suite on one page: every demo's recorded run, scored by `npm run score` with the same code
// the demo pages run. This is the page to open after recording a new model version.

const percent = (value, digits = 1) => (Number.isFinite(value) ? `${(value * 100).toFixed(value === 1 || value === 0 ? 0 : digits)}%` : '–');

const SORTS = [
  { value: 'series', label: 'Series order' },
  { value: 'worst', label: 'Weakest first' },
  { value: 'lift', label: 'Least lift first' },
];

/** The strongest alternative a demo lists: a rule, or always answering the commonest class. */
function bestBaseline(row) {
  const others = row.baselines.filter((entry) => !entry.model && Number.isFinite(entry.value));
  if (others.length) return others.reduce((best, entry) => (entry.value > best.value ? entry : best));
  return Number.isFinite(row.metrics.majorityBaseline) ? { label: 'Always the commonest answer', value: row.metrics.majorityBaseline } : null;
}

const modelScore = (row) => row.baselines.find((entry) => entry.model)?.value ?? row.metrics.accuracy ?? row.metrics.agreement ?? null;

function AgreementBar({ row }) {
  if (!row.graded) return <span className="meta">Not graded per item</span>;
  const share = row.right / row.graded;
  return (
    <span className="bench-agreement">
      <span className="bench-track" role="img" aria-label={`${row.right} of ${row.graded} match ground truth`}>
        {row.interval && <i className="bench-interval" style={{ left: `${row.interval.low * 100}%`, width: `${(row.interval.high - row.interval.low) * 100}%` }} />}
        <i className="bench-fill" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="num">
        <strong>{percent(share)}</strong> <span className="meta">{row.right} of {row.graded}</span>
      </span>
    </span>
  );
}

function Lift({ row }) {
  const baseline = bestBaseline(row);
  const model = modelScore(row);
  if (!baseline || !Number.isFinite(model)) return <span className="meta">–</span>;
  const lift = model - baseline.value;
  return (
    <span className={`bench-lift ${lift > 0.02 ? 'up' : lift < -0.005 ? 'down' : 'flat'}`} title={`${baseline.label}: ${percent(baseline.value)}`}>
      <span className="num">
        {lift >= 0 ? '+' : '−'}
        {Math.abs(lift * 100).toFixed(1)} pts
      </span>
      <span className="meta">vs {baseline.label.toLowerCase().replace(/^rule: /, 'rule: ')}</span>
    </span>
  );
}

export function BenchmarkPage() {
  const [sort, setSort] = useState('series');
  const { summary, rows } = scoreboard;

  const groups = useMemo(() => {
    const score = (row) => (row.graded ? row.right / row.graded : 2);
    const lift = (row) => {
      const baseline = bestBaseline(row);
      const model = modelScore(row);
      return baseline && Number.isFinite(model) ? model - baseline.value : 9;
    };
    if (sort === 'series') return DOMAINS.map((domain) => ({ domain, rows: rows.filter((row) => row.domain === domain.id) })).filter((group) => group.rows.length);
    const ordered = [...rows].sort((a, b) => (sort === 'worst' ? score(a) - score(b) : lift(a) - lift(b)));
    return [{ domain: null, rows: ordered }];
  }, [rows, sort]);

  const caveats = rows.filter((row) => row.caveat).length;

  return (
    <div className="stack benchmark">
      <div className="page-heading">
        <span className="eyebrow">Benchmark</span>
        <h1>One model, fifty jobs, every answer graded</h1>
        <p>
          Each row is a recorded run scored by <code>npm run score</code>: the same evaluate, grade and report code the demo pages run, over the committed answers. Record a new model
          version and this page shows what moved.
        </p>
      </div>

      <section className="bench-summary" aria-label="The suite in numbers">
        <article>
          <strong className="num">{summary.items.toLocaleString('en-US')}</strong>
          <span className="meta">items across {summary.demos} demos</span>
        </article>
        <article>
          <strong className="num">{summary.answers.toLocaleString('en-US')}</strong>
          <span className="meta">typed answers recorded</span>
        </article>
        <article>
          <strong className="num">{percent(summary.rightItems / Math.max(summary.gradedItems, 1))}</strong>
          <span className="meta">
            of {summary.gradedItems.toLocaleString('en-US')} graded items match ground truth, across {summary.gradedDemos} demos
          </span>
        </article>
        <article>
          <strong className="mono bench-model">{summary.models.join(', ') || '–'}</strong>
          <span className="meta">latest recording {summary.latest ? formatDate(summary.latest) : '–'}</span>
        </article>
      </section>

      <div className="row between bench-tools">
        <p className="meta">
          The shaded band on each bar is the 95% interval: with a few dozen items it is wide, and the bar should be read that way.
          {caveats > 0 && ` ${caveats} demos carry a caveat about their dataset; it is on the demo page.`}
        </p>
        <Segmented label="Order" size="small" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {groups.map((group) => (
        <section key={group.domain?.id ?? 'all'} className={`panel bench-group${group.domain ? ` domain-${group.domain.id}` : ''}`}>
          {group.domain && (
            <header className="bench-group-head">
              <h2>{group.domain.title}</h2>
              <span className="meta">{group.domain.blurb}</span>
            </header>
          )}
          <div className="table-scroll">
            <table className="data-table bench-table">
              <thead>
                <tr>
                  <th scope="col">Demo</th>
                  <th scope="col">Headline</th>
                  <th scope="col">Matches ground truth</th>
                  <th scope="col">Against the best alternative</th>
                  <th scope="col" className="num">Calibration error</th>
                  <th scope="col">Since last run</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link to={`/demos/${row.id}`} className="bench-demo">
                        {row.number && <span className="num bench-number">{row.number}</span>}
                        <span>
                          {row.title}
                          <span className="meta bench-meta">
                            {row.items.toLocaleString('en-US')} items{row.caveat ? ' · caveat' : ''}
                            {row.gates.length > 0 && (
                              <span className={`bench-gate ${row.passed ? 'pass' : 'fail'}`}>
                                <Icon name={row.passed ? 'check' : 'alert'} size={12} />
                                {row.passed ? 'gates pass' : 'gate failed'}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </th>
                    <td>
                      <strong className="num bench-headline">{row.headline?.display ?? '–'}</strong>
                      <span className="meta bench-meta">{row.headline?.label}</span>
                    </td>
                    <td>
                      <AgreementBar row={row} />
                    </td>
                    <td>
                      <Lift row={row} />
                    </td>
                    <td className="num">{Number.isFinite(row.metrics.calibrationError) ? `${(row.metrics.calibrationError * 100).toFixed(1)} pts` : '–'}</td>
                    <td>
                      {row.delta === null ? (
                        <span className="meta">{row.previous ? 'different test' : 'first run'}</span>
                      ) : (
                        <span className={`bench-lift ${row.delta > 0.005 ? 'up' : row.delta < -0.005 ? 'down' : 'flat'}`}>
                          <span className="num">
                            {row.delta >= 0 ? '+' : '−'}
                            {Math.abs(row.delta * 100).toFixed(1)} pts
                          </span>
                          <span className="meta">from {row.previous.model}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="panel stack bench-how" style={{ gap: 12 }}>
        <h2>Running it again</h2>
        <ol className="bench-steps">
          <li>
            <code>npm run record &lt;demo&gt;</code> asks the model every item again and replaces the pinned run. The run it replaces is kept under <code>benchmarks/runs/</code>.
          </li>
          <li>
            <code>npm run score</code> re-scores all fifty offline, rewrites this page's data and appends the run to <code>benchmarks/history.json</code>. Two runs are compared only when
            their dataset and questions hash the same: a changed dataset is a different test.
          </li>
          <li>
            <code>npm run check</code> fails if a demo misses a gate it declares, or if a headline falls more than three points between two runs of the same test.
          </li>
        </ol>
      </section>
    </div>
  );
}
