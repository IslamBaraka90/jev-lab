import { useEffect, useMemo, useState } from 'react';
import { ChartFrame, EmptyState, ErrorCallout, LegendItem, Signed } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { useRuns } from '../hooks/useRuns.jsx';
import { byDate, equityPoints, maxDrawdown, profitFactor, runDecisions, summarizeDecisions } from '../lib/analytics.js';
import { api } from '../lib/api.js';
import { formatCompact, formatDateTime, formatMoney, formatNumber, formatPercent } from '../lib/format.js';
import { ACTIONS, runTitle } from '../lib/labels.js';

const ACTION_KEYS = ['LONG', 'SHORT', 'NO_TRADE'];

export function ComparePage() {
  const { runs, loading } = useRuns();
  const finished = runs.filter((run) => run.status !== 'running' && run.overall?.decisions > 0);
  const [ids, setIds] = useState({ a: '', b: '' });
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Compare runs · Jev Backtest Lab';
  }, []);

  // Default to the newest run without indicators against the newest with them, when both exist.
  useEffect(() => {
    if (ids.a || finished.length < 2) return;
    const plain = finished.find((run) => !run.settings?.indicators);
    const withIndicators = finished.find((run) => run.settings?.indicators);
    const [a, b] = plain && withIndicators ? [plain, withIndicators] : [finished[1], finished[0]];
    setIds({ a: a.id, b: b.id });
  }, [finished, ids.a]);

  useEffect(() => {
    for (const id of [ids.a, ids.b]) {
      if (!id || loaded[id]) continue;
      api
        .run(id)
        .then((run) => setLoaded((current) => ({ ...current, [id]: run })))
        .catch((err) => setError(err.message));
    }
  }, [ids, loaded]);

  const a = loaded[ids.a];
  const b = loaded[ids.b];

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">Evaluation</span>
        <h1>Compare runs</h1>
        <p>Put two backtests side by side, for example the same cutoffs with and without technical indicators.</p>
      </div>

      {loading && <p className="meta">Loading runs…</p>}
      {!loading && finished.length < 2 && (
        <EmptyState title="Two finished runs are needed">Run the pilot with and without indicators, then compare them here.</EmptyState>
      )}
      {error && <ErrorCallout title="A run could not be loaded">{error}</ErrorCallout>}

      {finished.length >= 2 && (
        <div className="filterbar compare-pickers">
          {['a', 'b'].map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`run-${key}`}>
                <span className={`legend-key line ${key === 'a' ? 'accent' : 'compare-b'}`} aria-hidden="true" /> Run {key.toUpperCase()}
              </label>
              <select id={`run-${key}`} value={ids[key]} onChange={(event) => setIds((current) => ({ ...current, [key]: event.target.value }))}>
                {finished.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runTitle(run)} · {run.symbols.map((symbol) => symbol.symbol).join(', ')} · {formatDateTime(run.startedAt)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {a && b && <Comparison a={a} b={b} />}
    </>
  );
}

function Comparison({ a, b }) {
  const data = useMemo(
    () =>
      [a, b].map((run) => {
        const decisions = runDecisions(run);
        const equity = equityPoints(byDate(decisions));
        return {
          run,
          decisions,
          equity,
          summary: summarizeDecisions(decisions),
          drawdown: maxDrawdown(equity.map((point) => point.jev)),
          factor: profitFactor(decisions.filter((decision) => decision.trade).map((decision) => decision.trade)),
          currency: run.symbols.find((symbol) => symbol.instrument)?.instrument.currency ?? 'USD',
        };
      }),
    [a, b],
  );
  const [left, right] = data;
  const currency = left.currency;

  const rows = [
    ['Decisions', (item) => formatNumber(item.summary.decisions), (item) => item.summary.decisions],
    ['Long / short / no trade', (item) => `${item.summary.long} / ${item.summary.short} / ${item.summary.noTrade}`],
    ['Trades', (item) => formatNumber(item.summary.trades), (item) => item.summary.trades],
    ['Win rate', (item) => (item.summary.winRatePct === null ? '–' : `${item.summary.winRatePct}%`), (item) => item.summary.winRatePct, 'points'],
    ['Net return', (item) => <Signed value={item.summary.totalNetReturnPct} />, (item) => item.summary.totalNetReturnPct, '%'],
    ['Net return per trade', (item) => <Signed value={item.summary.averageNetReturnPct} />, (item) => item.summary.averageNetReturnPct, '%'],
    ['P&L', (item) => <Signed value={item.summary.totalPnl} kind="money" currency={item.currency} digits={0} />, (item) => item.summary.totalPnl, 'money'],
    ['Max drawdown', (item) => formatMoney(item.drawdown, item.currency, { digits: 0 }), (item) => item.drawdown, 'money'],
    ['Profit factor', (item) => (item.factor === null ? '–' : item.factor === Infinity ? 'No losses' : item.factor.toFixed(2))],
    ['Always long per cutoff', (item) => <Signed value={item.summary.alwaysLong.averageNetReturnPct} />],
    ['Input tokens', (item) => formatCompact(item.summary.usage.input_tokens), (item) => item.summary.usage.input_tokens, 'count'],
  ];

  const length = Math.max(left.equity.length, right.equity.length);
  const chartRows = Array.from({ length }, (_, index) => ({
    index,
    a: left.equity[index]?.jev ?? null,
    b: right.equity[index]?.jev ?? null,
  }));

  // Decisions made on the same symbol and date in both runs.
  const matched = [];
  const byKey = new Map(right.decisions.map((decision) => [`${decision.symbol}:${decision.date}`, decision]));
  for (const decision of left.decisions) {
    const other = byKey.get(`${decision.symbol}:${decision.date}`);
    if (other && decision.action && other.action) matched.push([decision.action, other.action]);
  }
  const agreed = matched.filter(([x, y]) => x === y).length;

  return (
    <div className="stack">
      <section className="panel stack" aria-labelledby="compare-table-title" style={{ gap: 16 }}>
        <h2 id="compare-table-title" className="section-heading">
          Headline results
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Run A · {runTitle(a)}
                </th>
                <th scope="col" className="num">
                  Run B · {runTitle(b)}
                </th>
                <th scope="col" className="num">
                  B minus A
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, show, value, unit]) => {
                const difference = value && Number.isFinite(value(right)) && Number.isFinite(value(left)) ? value(right) - value(left) : null;
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td className="num">{show(left)}</td>
                    <td className="num">{show(right)}</td>
                    <td className="num">
                      {difference === null ? (
                        '–'
                      ) : unit === '%' ? (
                        <Signed value={difference} />
                      ) : unit === 'money' ? (
                        <Signed value={difference} kind="money" currency={currency} digits={0} />
                      ) : unit === 'points' ? (
                        `${difference > 0 ? '+' : ''}${formatNumber(difference, 1)} pts`
                      ) : (
                        `${difference > 0 ? '+' : ''}${formatNumber(difference)}`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ChartFrame
        title="Cumulative P&L"
        question="Which run's trades earned more, decision by decision in date order?"
        legend={
          <>
            <LegendItem shape="line" tone="accent">
              Run A · {runTitle(a)}
            </LegendItem>
            <LegendItem shape="line" tone="compare-b">
              Run B · {runTitle(b)}
            </LegendItem>
          </>
        }
      >
        {length > 1 ? (
          <LineChart
            rows={chartRows}
            series={[
              { key: 'a', label: 'Run A', tone: 'accent' },
              { key: 'b', label: 'Run B', tone: 'compare-b' },
            ]}
            formatValue={(value, { compact } = {}) => (value === null ? '–' : formatMoney(value, currency, { digits: compact ? 0 : 2 }))}
            xLabel={(row) => `#${row.index + 1}`}
            tooltipTitle={(row) => `Decision #${row.index + 1}`}
            height={300}
            label="Cumulative profit and loss of the two runs"
          />
        ) : (
          <p className="meta chart-placeholder">The curves need at least two decisions.</p>
        )}
      </ChartFrame>

      <section className="panel stack" aria-labelledby="agreement-title" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="agreement-title" className="section-heading">
            Did the runs decide the same way?
          </h2>
          <p className="meta">
            {matched.length
              ? `${agreed} of ${matched.length} decisions on the same symbol and date matched (${formatPercent((agreed / matched.length) * 100, { digits: 0, signed: false })}).`
              : 'The runs share no symbol and date, so their decisions cannot be matched.'}
          </p>
        </div>
        {matched.length > 0 && (
          <div className="table-scroll">
            <table className="data-table agreement">
              <caption className="sr-only">Run A decisions in rows, run B decisions in columns</caption>
              <thead>
                <tr>
                  <th scope="col">Run A ↓ · Run B →</th>
                  {ACTION_KEYS.map((key) => (
                    <th key={key} scope="col" className="num">
                      {ACTIONS[key].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTION_KEYS.map((row) => (
                  <tr key={row}>
                    <th scope="row">{ACTIONS[row].label}</th>
                    {ACTION_KEYS.map((column) => {
                      const count = matched.filter(([x, y]) => x === row && y === column).length;
                      return (
                        <td key={column} className={`num${row === column ? ' diagonal' : ''}`}>
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
