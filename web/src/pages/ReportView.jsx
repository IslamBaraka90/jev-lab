import { useMemo } from 'react';
import { Icon } from '../components/Icon.jsx';
import { ChartFrame, EmptyState, Kpi, LegendItem, Signed } from '../components/ui.jsx';
import { ColumnChart } from '../charts/ColumnChart.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { MixBar, Sparkline } from '../charts/small.jsx';
import {
  byDate,
  confidenceBuckets,
  consistencyChecks,
  equityPoints,
  maxDrawdown,
  noTradeReview,
  profitFactor,
  runDecisions,
  signalOutcomes,
  summarizeDecisions,
} from '../lib/analytics.js';
import { formatDate, formatMoney, formatNumber, formatPercent, formatShare } from '../lib/format.js';
import { EXIT_REASONS } from '../lib/labels.js';

export function ReportView({ run, onOpenDecision }) {
  const decisions = useMemo(() => runDecisions(run), [run]);
  const summary = useMemo(() => summarizeDecisions(decisions), [decisions]);
  const equity = useMemo(() => equityPoints(byDate(decisions)), [decisions]);
  const buckets = useMemo(() => confidenceBuckets(decisions), [decisions]);
  const checks = useMemo(() => consistencyChecks(decisions), [decisions]);
  const flat = useMemo(() => noTradeReview(decisions), [decisions]);
  const signals = useMemo(() => signalOutcomes(decisions), [decisions]);

  if (decisions.length === 0) {
    return <EmptyState title="No decisions to report yet">The report fills in as soon as Jev makes its first decision.</EmptyState>;
  }

  const currency = run.symbols.find((symbol) => symbol.instrument)?.instrument.currency ?? 'USD';
  const settings = run.settings ?? {};
  const notional = settings.notional ?? 10_000;
  const horizon = settings.horizonBars ?? 8;
  const trades = decisions.filter((decision) => decision.trade).map((decision) => decision.trade);
  const drawdown = maxDrawdown(equity.map((point) => point.jev));
  const factor = profitFactor(trades);
  const money = (value, { compact } = {}) => formatMoney(value, currency, { digits: compact ? 0 : 2 });

  return (
    <div className="report stack">
      {run.status === 'running' && (
        <p className="callout">
          <Icon name="bolt" size={16} /> This report updates as Jev's decisions arrive: {decisions.length} so far.
        </p>
      )}

      <section aria-labelledby="headline-title">
        <h2 id="headline-title" className="sr-only">
          Headline results
        </h2>
        <div className="kpi-strip">
          <Kpi label="Net return" value={<Signed value={summary.totalNetReturnPct} />} context={`Sum of ${summary.trades} trades, net of ${settings.costBpsPerSide ?? 5} bps per side`} />
          <Kpi label="P&L" value={<Signed value={summary.totalPnl} kind="money" currency={currency} digits={0} />} context={`Trading ${formatMoney(notional, currency, { signed: false, digits: 0 })} per trade`} />
          <Kpi
            label="Win rate"
            value={summary.winRatePct === null ? '–' : formatPercent(summary.winRatePct, { digits: 1, signed: false })}
            context={`${summary.wins} won, ${summary.losses} lost`}
          />
          <Kpi
            label="Per trade"
            value={<Signed value={summary.averageNetReturnPct} />}
            context={`Always long: ${formatPercent(summary.alwaysLong.averageNetReturnPct)} per cutoff`}
          />
          <Kpi label="Max drawdown" value={drawdown === 0 ? 'None' : money(drawdown, { compact: true })} context="Largest fall in cumulative P&L" />
          <Kpi
            label="Profit factor"
            value={factor === null ? '–' : factor === Infinity ? 'No losses' : factor.toFixed(2)}
            context="Gross profit divided by gross loss"
          />
        </div>
      </section>

      <ChartFrame
        title="Cumulative P&L"
        question="How did following Jev compare with buying at every cutoff? Decisions are in date order."
        legend={
          <>
            <LegendItem shape="line" tone="accent">
              Following Jev
            </LegendItem>
            <LegendItem shape="line" tone="context">
              Always long for {horizon} bars
            </LegendItem>
          </>
        }
        table={
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Date</th>
                <th scope="col">Symbol</th>
                <th scope="col">Action</th>
                <th scope="col" className="num">
                  Following Jev
                </th>
                <th scope="col" className="num">
                  Always long
                </th>
              </tr>
            </thead>
            <tbody>
              {equity.map((point, index) => (
                <tr key={`${point.decision.symbol}-${point.decision.cutoff}`}>
                  <td className="num">{index + 1}</td>
                  <td>{formatDate(point.decision.date)}</td>
                  <td>{point.decision.symbol}</td>
                  <td>{point.decision.action}</td>
                  <td className="num">{money(point.jev)}</td>
                  <td className="num">{money(point.alwaysLong)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {equity.length > 1 ? (
          <LineChart
            rows={equity}
            series={[
              { key: 'jev', label: 'Following Jev', tone: 'accent' },
              { key: 'alwaysLong', label: 'Always long', tone: 'context' },
            ]}
            formatValue={money}
            xLabel={(row) => formatDate(row.decision.date)}
            tooltipTitle={(row, index) => `#${index + 1} · ${row.decision.symbol} ${formatDate(row.decision.date)} · ${row.decision.action}`}
            height={300}
            label="Cumulative profit and loss of Jev's trades compared with going long at every cutoff"
          />
        ) : (
          <p className="meta chart-placeholder">The curve needs at least two decisions.</p>
        )}
      </ChartFrame>

      <SymbolResults run={run} currency={currency} />

      <div className="grid two">
        <TradeEndings summary={summary} currency={currency} />
        <ChartFrame
          title="Confidence and results"
          question="Did trades Jev was more confident in earn more? Average net return per trade by decision confidence."
          table={
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">Confidence</th>
                  <th scope="col" className="num">
                    Trades
                  </th>
                  <th scope="col" className="num">
                    Win rate
                  </th>
                  <th scope="col" className="num">
                    Net per trade
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.label}>
                    <td>{bucket.label}</td>
                    <td className="num">{bucket.trades}</td>
                    <td className="num">{bucket.winRatePct === null ? '–' : `${bucket.winRatePct}%`}</td>
                    <td className="num">{formatPercent(bucket.averageNetReturnPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ColumnChart
            items={buckets.map((bucket) => ({
              label: bucket.label,
              value: bucket.averageNetReturnPct,
              notes: bucket.trades ? [`${bucket.trades} ${bucket.trades === 1 ? 'trade' : 'trades'}`, `${bucket.winRatePct}% won`] : ['No trades'],
              tooltip: bucket.trades
                ? [
                    ['Trades', String(bucket.trades)],
                    ['Win rate', `${bucket.winRatePct}%`],
                    ['Net per trade', formatPercent(bucket.averageNetReturnPct)],
                  ]
                : null,
            }))}
            formatValue={(value) => formatPercent(value, { digits: 1 })}
            label="Average net return per trade for each decision-confidence range"
          />
        </ChartFrame>
      </div>

      <Contradictions checks={checks} onOpenDecision={onOpenDecision} />

      <div className="grid two">
        <FlatReview review={flat} horizon={horizon} decisions={decisions.length} />
        <SignalTable signals={signals} />
      </div>
    </div>
  );
}

function SymbolResults({ run, currency }) {
  return (
    <section className="panel stack" aria-labelledby="symbols-title" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="symbols-title">Results by symbol</h3>
        <p className="meta">Net return is the sum of each symbol's trades; always long buys every cutoff and holds for the full horizon.</p>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Symbol</th>
              <th scope="col">Actions</th>
              <th scope="col" className="num">
                Trades
              </th>
              <th scope="col" className="num">
                Win rate
              </th>
              <th scope="col" className="num">
                Net return
              </th>
              <th scope="col" className="num">
                Per trade
              </th>
              <th scope="col" className="num">
                P&amp;L
              </th>
              <th scope="col" className="num">
                Always long
              </th>
              <th scope="col">P&amp;L path</th>
            </tr>
          </thead>
          <tbody>
            {run.symbols.map((symbol) => {
              const decisions = symbol.decisions.map((decision) => ({ ...decision, symbol: symbol.symbol }));
              const summary = summarizeDecisions(decisions);
              const path = equityPoints(decisions).map((point) => point.jev);
              return (
                <tr key={symbol.symbol}>
                  <th scope="row">
                    <strong>{symbol.symbol}</strong>
                    <span className="meta run-meta">{symbol.instrument?.instrumentType?.toLowerCase() ?? symbol.status}</span>
                  </th>
                  <td>
                    <span className="stack" style={{ gap: 6 }}>
                      <MixBar long={summary.long} short={summary.short} noTrade={summary.noTrade} />
                      <span className="meta">
                        {summary.long} long · {summary.short} short · {summary.noTrade} no trade
                      </span>
                    </span>
                  </td>
                  <td className="num">{summary.trades}</td>
                  <td className="num">{summary.winRatePct === null ? '–' : `${summary.winRatePct}%`}</td>
                  <td className="num">
                    <Signed value={summary.totalNetReturnPct} />
                  </td>
                  <td className="num">
                    <Signed value={summary.averageNetReturnPct} />
                  </td>
                  <td className="num">
                    <Signed value={summary.totalPnl} kind="money" currency={symbol.instrument?.currency ?? currency} digits={0} />
                  </td>
                  <td className="num">
                    <Signed value={summary.alwaysLong.averageNetReturnPct} />
                  </td>
                  <td>
                    <Sparkline values={path} label={`${symbol.symbol} cumulative P&L ending at ${formatMoney(path.at(-1) ?? 0, currency)}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradeEndings({ summary, currency }) {
  const exits = Object.entries(EXIT_REASONS).map(([key, label]) => ({ key, label, count: summary.exitReasons[key] }));
  return (
    <section className="panel stack" aria-labelledby="endings-title" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="endings-title">How the trades ended</h3>
        <p className="meta">Exit reasons, and results for long and short trades.</p>
      </div>
      <ul className="stat-list">
        {exits.map((exit) => (
          <li key={exit.key}>
            <span>{exit.label}</span>
            <span className="stat-bar" aria-hidden="true">
              <span style={{ width: `${summary.trades ? (exit.count / summary.trades) * 100 : 0}%` }} />
            </span>
            <strong className="num">{exit.count}</strong>
            <span className="meta num">{summary.trades ? formatShare(exit.count / summary.trades) : '–'}</span>
          </li>
        ))}
      </ul>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Side</th>
              <th scope="col" className="num">
                Trades
              </th>
              <th scope="col" className="num">
                Win rate
              </th>
              <th scope="col" className="num">
                Per trade
              </th>
              <th scope="col" className="num">
                P&amp;L
              </th>
            </tr>
          </thead>
          <tbody>
            {['LONG', 'SHORT'].map((side) => {
              const result = summary.bySide[side];
              return (
                <tr key={side}>
                  <th scope="row">{side === 'LONG' ? 'Long' : 'Short'}</th>
                  <td className="num">{result.trades}</td>
                  <td className="num">{result.winRatePct === null ? '–' : `${result.winRatePct}%`}</td>
                  <td className="num">
                    <Signed value={result.averageNetReturnPct} />
                  </td>
                  <td className="num">
                    <Signed value={result.totalPnl} kind="money" currency={currency} digits={0} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Contradictions({ checks, onOpenDecision }) {
  const found = checks.filter((check) => check.count > 0).length;
  return (
    <section className="panel stack" aria-labelledby="contradictions-title" style={{ gap: 16 }}>
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <h3 id="contradictions-title">Contradictions to report to the Jev team</h3>
          <p className="meta">
            Every question is answered on its own, so a trade can come with a plan that contradicts it. Trades still run under the current rules, for
            example with no stop.
          </p>
        </div>
        <span className={`badge ${found ? 'warn' : 'pass'}`}>
          <Icon name={found ? 'alert' : 'check'} size={16} />
          {found ? `${found} of ${checks.length} checks found cases` : 'No contradictions'}
        </span>
      </div>
      <ul className="check-list">
        {checks.map((check) => (
          <li key={check.id} className={check.count ? 'flagged' : undefined}>
            <span className="check-icon" aria-hidden="true">
              <Icon name={check.count ? 'alert' : 'check'} size={18} />
            </span>
            <div className="grow stack" style={{ gap: 4 }}>
              <strong>{check.label}</strong>
              <span className="meta">{check.detail}</span>
              {check.count > 0 && (
                <span className="check-examples">
                  {check.decisions.slice(0, 8).map((decision) => (
                    <button key={`${decision.symbol}-${decision.cutoff}`} type="button" className="button ghost chip" onClick={() => onOpenDecision(decision.symbol, decision.cutoff)}>
                      {decision.symbol} {formatDate(decision.date)}
                    </button>
                  ))}
                  {check.count > 8 && <span className="meta">and {check.count - 8} more</span>}
                </span>
              )}
            </div>
            <span className="check-count num">
              <strong>{check.count}</strong>
              <span className="meta"> of {check.of}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlatReview({ review, horizon, decisions }) {
  return (
    <section className="panel stack" aria-labelledby="flat-title" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="flat-title">When Jev stayed flat</h3>
        <p className="meta">
          {review.count} of {decisions} decisions were No trade. What the price did over the next {horizon} bars:
        </p>
      </div>
      <dl className="facts">
        <div>
          <dt>Average move after No trade</dt>
          <dd>{review.averageAbsoluteMovePct === null ? '–' : formatPercent(review.averageAbsoluteMovePct, { signed: false })}</dd>
          <dd className="meta">in either direction</dd>
        </div>
        <div>
          <dt>Average move after a trade</dt>
          <dd>{review.averageAbsoluteMoveAfterTradesPct === null ? '–' : formatPercent(review.averageAbsoluteMoveAfterTradesPct, { signed: false })}</dd>
          <dd className="meta">in either direction</dd>
        </div>
        <div>
          <dt>Big moves sat out</dt>
          <dd>
            <Icon name="up" size={16} /> {review.bigUp} up · <Icon name="down" size={16} /> {review.bigDown} down
          </dd>
          <dd className="meta">moves of {review.bigMovePct}% or more</dd>
        </div>
        <div>
          <dt>Always long after No trade</dt>
          <dd>
            <Signed value={review.alwaysLongAfterFlatPct} />
          </dd>
          <dd className="meta">
            versus <Signed value={review.alwaysLongAfterTradesPct} /> after trades
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SignalTable({ signals }) {
  const format = (row, value) => {
    if (value === null) return '–';
    return row.kind === 'score' ? `${value.toFixed(2)} of ${row.levels - 1}` : formatShare(value);
  };
  return (
    <section className="panel stack" aria-labelledby="signals-title" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="signals-title">Answers behind winning and losing trades</h3>
        <p className="meta">
          Average answers for the {formatNumber(signals.winners)} winning and {formatNumber(signals.losers)} losing trades. Large gaps show which reads
          separated good trades from bad ones.
        </p>
      </div>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Answer</th>
              <th scope="col" className="num">
                Winners
              </th>
              <th scope="col" className="num">
                Losers
              </th>
            </tr>
          </thead>
          <tbody>
            {signals.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td className="num">{format(row, row.winners)}</td>
                <td className="num">{format(row, row.losers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
