import { useEffect, useMemo, useState } from 'react';
import { Answer, IndicatorSignals } from '../components/answers.jsx';
import { Icon } from '../components/Icon.jsx';
import { ActionBadge, Dialog, ErrorCallout, Signed } from '../components/ui.jsx';
import { CandleChart } from '../charts/CandleChart.jsx';
import { consistencyChecks, runDecisions } from '../lib/analytics.js';
import { api } from '../lib/api.js';
import { formatCompact, formatDate, formatNumber, formatPrice, formatShare } from '../lib/format.js';
import { EXIT_REASONS, QUESTION_GROUPS } from '../lib/labels.js';
import { Link } from '../lib/router.jsx';

/** Everything about one decision: the chart, the result, all 15 answers and the exact state sent to Jev. */
export function DecisionDrawer({ run, target, onClose }) {
  const all = useMemo(() => runDecisions(run), [run]);
  const [symbolName, cutoffText] = target ? target.split(':') : [];
  const position = all.findIndex((decision) => decision.symbol === symbolName && decision.cutoff === Number(cutoffText));
  const decision = all[position];
  const symbol = run.symbols.find((item) => item.symbol === symbolName);

  return (
    <Dialog
      open={Boolean(decision)}
      onClose={onClose}
      className="drawer"
      eyebrow={decision ? `Decision ${decision.cutoff} of ${symbol.cutoffs.length || run.settings?.cutoffs}` : ''}
      title={decision ? `${decision.symbol} · ${formatDate(decision.date)}` : ''}
    >
      {decision && <DecisionDetail key={target} run={run} symbol={symbol} decision={decision} all={all} position={position} />}
    </Dialog>
  );
}

function DecisionDetail({ run, symbol, decision, all, position }) {
  const [saved, setSaved] = useState({ state: 'loading' });
  const horizon = run.settings?.horizonBars ?? 8;
  const lookback = run.settings?.lookbackBars ?? 90;
  const start = Math.max(0, decision.candleIndex - lookback + 1);
  const candles = symbol.candles.slice(start, decision.candleIndex + horizon + 1);
  const flags = useMemo(
    () => consistencyChecks([decision]).filter((check) => check.count > 0),
    [decision],
  );
  const { trade } = decision;
  const currency = symbol.instrument?.currency ?? 'USD';

  useEffect(() => {
    let cancelled = false;
    api
      .decision(run.id, decision.symbol, decision.cutoff)
      .then((full) => !cancelled && setSaved({ state: 'ready', full }))
      .catch((error) => !cancelled && setSaved({ state: 'error', error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [run.id, decision.symbol, decision.cutoff]);

  const previous = all[position - 1];
  const next = all[position + 1];
  const link = (item) => `${window.location.pathname}?decision=${encodeURIComponent(`${item.symbol}:${item.cutoff}`)}`;

  return (
    <div className="decision-detail stack">
      <div className="row between">
        <div className="row" style={{ gap: 16 }}>
          <ActionBadge action={decision.error ? null : decision.action} large />
          {decision.confidence !== null && <span className="meta">confidence {formatShare(decision.confidence)}</span>}
        </div>
        {trade ? (
          <span className="detail-result">
            <Signed value={trade.netReturnPct} />
            <span className="meta">
              <Signed value={trade.pnl} kind="money" currency={currency} />
            </span>
          </span>
        ) : (
          <span className="meta">
            Price moved <Signed value={decision.forwardReturnsPct?.at(-1)} /> over the next {horizon} bars
          </span>
        )}
      </div>

      <CandleChart
        candles={candles}
        decisionIndex={decision.candleIndex - start}
        revealed={horizon}
        trade={trade}
        showPlan
        showExit
        height={340}
        label={`${decision.symbol} candles around the decision on ${formatDate(decision.date)}`}
      />

      {decision.error && <ErrorCallout title="The request failed">{decision.error.message}</ErrorCallout>}

      {trade && (
        <dl className="facts trade-facts">
          <div>
            <dt>Entry</dt>
            <dd>
              {formatPrice(trade.entryPrice)} <span className="meta">{formatDate(trade.entryDate, { year: false })}</span>
            </dd>
          </div>
          <div>
            <dt>Exit</dt>
            <dd>
              {formatPrice(trade.exitPrice)} <span className="meta">{formatDate(trade.exitDate, { year: false })}</span>
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>
              {EXIT_REASONS[trade.exitReason]}{' '}
              <span className="meta">
                after {trade.barsHeld} {trade.barsHeld === 1 ? 'bar' : 'bars'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Stop / target</dt>
            <dd>
              {trade.stopPrice === null ? 'None' : formatPrice(trade.stopPrice)} / {trade.targetPrice === null ? 'None' : formatPrice(trade.targetPrice)}
            </dd>
          </div>
          <div>
            <dt>Gross / net</dt>
            <dd>
              <Signed value={trade.grossReturnPct} /> / <Signed value={trade.netReturnPct} />
            </dd>
          </div>
          <div>
            <dt>Always long</dt>
            <dd>
              <Signed value={decision.baseline?.netReturnPct} />
            </dd>
          </div>
        </dl>
      )}

      {flags.length > 0 && (
        <div className="callout warning">
          <strong>Contradictions in this decision</strong>
          <ul>
            {flags.map((flag) => (
              <li key={flag.id}>
                {flag.label}: {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.answers &&
        QUESTION_GROUPS.map((group) => (
          <section key={group.title} className="answer-group" aria-label={group.title}>
            <h3>{group.title}</h3>
            {group.keys.map((key) => (
              <Answer key={key} name={key} answer={decision.answers[key]} question={run.questions?.[key]} />
            ))}
          </section>
        ))}

      {decision.indicators && (
        <section className="answer-group" aria-label="Technical indicators">
          <h3>Technical indicators in the state</h3>
          <IndicatorSignals indicators={decision.indicators} detailed />
        </section>
      )}

      <section className="answer-group" aria-label="Request">
        <h3>Request</h3>
        <dl className="facts">
          <div>
            <dt>Model</dt>
            <dd>{decision.model ?? '–'}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{decision.latencyMs ? `${formatNumber(decision.latencyMs)} ms` : '–'}</dd>
          </div>
          <div>
            <dt>Tokens</dt>
            <dd>
              {decision.usage ? `${formatCompact(decision.usage.input_tokens)} in, ${formatCompact(decision.usage.output_tokens)} out` : '–'}
            </dd>
          </div>
          <div>
            <dt>Request id</dt>
            <dd className="mono">{decision.requestId ?? '–'}</dd>
          </div>
        </dl>
        <details>
          <summary>State sent to Jev</summary>
          <div className="details-content stack" style={{ gap: 12 }}>
            {saved.state === 'loading' && <p className="meta">Loading the saved state…</p>}
            {saved.state === 'error' && <ErrorCallout title="The saved state could not be loaded">{saved.error}</ErrorCallout>}
            {saved.state === 'ready' && (
              <>
                <button type="button" className="button secondary copy-button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(saved.full.state, null, 2))}>
                  <Icon name="copy" />
                  Copy state JSON
                </button>
                <pre className="state-json">{JSON.stringify(saved.full.state, null, 2)}</pre>
              </>
            )}
          </div>
        </details>
      </section>

      <nav className="row between drawer-pager" aria-label="Other decisions">
        {previous ? (
          <Link className="button secondary" to={link(previous)} scroll={false}>
            <Icon name="previous" />
            {previous.symbol} {formatDate(previous.date, { year: false })}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="button secondary" to={link(next)} scroll={false}>
            {next.symbol} {formatDate(next.date, { year: false })}
            <Icon name="next" />
          </Link>
        )}
      </nav>
    </div>
  );
}
