import { useEffect, useMemo } from 'react';
import { IndicatorSignals } from '../components/answers.jsx';
import { Icon } from '../components/Icon.jsx';
import { ActionBadge, ChartFrame, Kpi, LegendItem, Meter, Segmented, Signed } from '../components/ui.jsx';
import { CandleChart } from '../charts/CandleChart.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { DecisionTimeline } from '../charts/small.jsx';
import { PHASES, SPEEDS, usePlayback } from '../hooks/usePlayback.js';
import { equityPoints, summarizeDecisions } from '../lib/analytics.js';
import { formatDate, formatMoney, formatPercent, formatPrice, formatShare } from '../lib/format.js';
import { ACTIONS, EXIT_REASONS, nearestLevel, optionLabel } from '../lib/labels.js';
import { useLocation } from '../lib/router.jsx';

const KEY_READS = ['market_direction', 'market_structure', 'momentum_state'];

/** Replays every decision: the bars Jev saw, its answers, then the bars after the decision and the result. */
export function TheaterView({ run, onOpenDecision }) {
  const live = run.status === 'running';
  const horizon = run.settings?.horizonBars ?? 8;
  const lookback = run.settings?.lookbackBars ?? 90;
  const sequence = useMemo(() => run.symbols.flatMap((symbol) => symbol.decisions.map((decision) => ({ symbol, decision }))), [run]);
  const positions = useMemo(() => new Map(sequence.map(({ symbol, decision }, index) => [`${symbol.symbol}:${decision.cutoff}`, index])), [sequence]);
  const planned = run.symbols.reduce((sum, symbol) => sum + (symbol.cutoffs.length || run.settings?.cutoffs || 0), 0);
  const { searchParams } = useLocation();
  const openAt = searchParams.has('at') ? Number(searchParams.get('at')) - 1 : undefined;
  const playback = usePlayback({ total: sequence.length, horizon, live, start: openAt });
  const { toggle, seek } = playback;

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === ' ' && !event.target.closest('button, a')) {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'ArrowRight' && !event.target.closest('[role="radiogroup"]')) seek(playback.index + 1);
      if (event.key === 'ArrowLeft' && !event.target.closest('[role="radiogroup"]')) seek(playback.index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek, playback.index]);

  const scored = playback.phase === 'scored';
  const played = useMemo(
    () => sequence.slice(0, playback.index + (scored ? 1 : 0)).map(({ symbol, decision }) => ({ ...decision, symbol: symbol.symbol })),
    [sequence, playback.index, scored],
  );
  const summary = useMemo(() => summarizeDecisions(played), [played]);
  const equity = useMemo(() => equityPoints(played), [played]);
  const currency = run.symbols.find((symbol) => symbol.instrument)?.instrument.currency ?? 'USD';

  const item = sequence[playback.index];
  if (!item) {
    const preparing = run.symbols.find((symbol) => symbol.status === 'running') ?? run.symbols[0];
    return (
      <section className="panel theater-waiting" aria-live="polite">
        <span className="eyebrow">Getting ready</span>
        <h2>{live ? `Preparing ${preparing.symbol}` : 'This run has no decisions'}</h2>
        <p className="muted">
          {live
            ? 'Fetching three years of daily candles and choosing the cutoffs. The first decision appears here as soon as Jev answers.'
            : 'The run stopped before Jev made any decisions.'}
        </p>
      </section>
    );
  }

  const { symbol, decision } = item;
  const start = Math.max(0, decision.candleIndex - lookback + 1);
  const candles = symbol.candles.slice(start, decision.candleIndex + horizon + 1);
  const decisionIndex = decision.candleIndex - start;
  const phaseIndex = PHASES.findIndex((phase) => phase.id === playback.phase);
  const decided = phaseIndex >= 1;
  const revealed = phaseIndex >= 2 ? playback.revealed : 0;
  const showExit = Boolean(decision.trade) && revealed >= decision.trade.barsHeld;
  const symbolPlanned = symbol.cutoffs.length || run.settings?.cutoffs;

  return (
    <div className="theater">
      <div className="theater-stage">
        <section className="panel stage" aria-labelledby="stage-title">
          <header className="stage-head">
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">
                {symbol.symbol}
                {symbol.instrument?.exchange ? ` · ${symbol.instrument.exchange}` : ''} · decision {decision.cutoff} of {symbolPlanned}
              </span>
              <h2 id="stage-title">{formatDate(decision.date)}</h2>
            </div>
            <PhaseSteps current={phaseIndex} />
          </header>
          <CandleChart
            candles={candles}
            decisionIndex={decisionIndex}
            revealed={revealed}
            trade={decision.trade}
            showPlan={decided}
            showExit={showExit}
            height={560}
            label={`${symbol.symbol} daily candles up to ${formatDate(decision.date)}, with ${revealed} of ${horizon} later bars shown`}
          />
          <div className="chart-legend">
            <LegendItem shape="zone" tone="future">
              After the decision, hidden from Jev
            </LegendItem>
            {decision.trade && (
              <>
                <LegendItem tone="accent">Entry at next open</LegendItem>
                {decision.trade.stopPrice !== null && (
                  <LegendItem shape="line" tone="stop">
                    Stop {formatPrice(decision.trade.stopPrice)}
                  </LegendItem>
                )}
                {decision.trade.targetPrice !== null && (
                  <LegendItem shape="line" tone="target">
                    Target {formatPrice(decision.trade.targetPrice)}
                  </LegendItem>
                )}
              </>
            )}
          </div>
        </section>

        <p className="sr-only" aria-live="polite">
          {decided && !decision.error ? `${symbol.symbol} ${formatDate(decision.date)}: ${ACTIONS[decision.action]?.label}` : ''}
          {phaseIndex === 3 && decision.trade ? `, result ${formatPercent(decision.trade.netReturnPct)}` : ''}
        </p>
        <aside className="panel stage-rail" aria-label="Jev's decision">
          <div className="rail-scroll">
            <DecisionCard run={run} symbol={symbol} decision={decision} phaseIndex={phaseIndex} revealed={revealed} horizon={horizon} showExit={showExit} onOpen={() => onOpenDecision(symbol.symbol, decision.cutoff)} />
          </div>
        </aside>
      </div>

      <PlaybackBar playback={playback} total={sequence.length} planned={planned} live={live} />

      <section className="panel stack" aria-labelledby="timeline-title" style={{ gap: 16 }}>
        <div className="row between">
          <h3 id="timeline-title">Every decision</h3>
          <div className="chart-legend">
            <LegendItem tone="long">Long</LegendItem>
            <LegendItem tone="short">Short</LegendItem>
            <LegendItem tone="flat">No trade</LegendItem>
            <LegendItem shape="ring" tone="gain">
              Trade won
            </LegendItem>
            <LegendItem shape="ring" tone="loss">
              Trade lost
            </LegendItem>
          </div>
        </div>
        <DecisionTimeline run={run} positions={positions} current={playback.index} onSeek={seek} />
      </section>

      <div className="theater-bottom">
        <section className="panel stack" aria-labelledby="scoreboard-title" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 4 }}>
            <h3 id="scoreboard-title">Scoreboard</h3>
            <p className="meta">
              After {played.length} of {planned} decisions
            </p>
          </div>
          <div className="kpi-grid">
            <Kpi label="Net return" value={<Signed value={summary.totalNetReturnPct} />} context={`${summary.trades} trades, net of costs`} />
            <Kpi label="P&L" value={<Signed value={summary.totalPnl} kind="money" currency={currency} digits={0} />} context={`${formatMoney(run.settings?.notional ?? 10000, currency, { signed: false, digits: 0 })} per trade`} />
            <Kpi label="Win rate" value={summary.winRatePct === null ? '–' : formatPercent(summary.winRatePct, { digits: 0, signed: false })} context={`${summary.wins} won, ${summary.losses} lost`} />
            <Kpi
              label="Stayed flat"
              value={played.length ? formatShare(summary.noTrade / played.length) : '–'}
              context={`Traded ${summary.long} long, ${summary.short} short`}
            />
          </div>
        </section>

        <ChartFrame
          title="Cumulative P&L so far"
          question="Did following Jev beat buying at every cutoff?"
          legend={
            <>
              <LegendItem shape="line" tone="accent">
                Following Jev
              </LegendItem>
              <LegendItem shape="line" tone="context">
                Always long
              </LegendItem>
            </>
          }
        >
          {equity.length > 1 ? (
            <LineChart
              rows={equity}
              series={[
                { key: 'jev', label: 'Following Jev', tone: 'accent' },
                { key: 'alwaysLong', label: 'Always long', tone: 'context' },
              ]}
              formatValue={(value, { compact } = {}) => formatMoney(value, currency, { digits: compact ? 0 : 2 })}
              xLabel={(row, index) => `#${index + 1}`}
              tooltipTitle={(row, index) => `#${index + 1} · ${row.decision.symbol} ${formatDate(row.decision.date)}`}
              height={240}
              label="Cumulative profit and loss of Jev's trades compared with going long at every cutoff"
            />
          ) : (
            <p className="meta chart-placeholder">The curve appears after two decisions have been scored.</p>
          )}
        </ChartFrame>
      </div>
    </div>
  );
}

function PhaseSteps({ current }) {
  return (
    <ol className="phase-steps" aria-label="Replay phase">
      {PHASES.map((phase, index) => (
        <li key={phase.id} className={index < current ? 'done' : index === current ? 'active' : undefined} aria-current={index === current ? 'step' : undefined}>
          <span className="step-num">{index < current ? <Icon name="check" size={16} /> : index + 1}</span>
          <span className="step-label">{phase.label}</span>
        </li>
      ))}
    </ol>
  );
}

function DecisionCard({ run, symbol, decision, phaseIndex, revealed, horizon, showExit, onOpen }) {
  const bars = Math.min(run.settings?.lookbackBars ?? 90, decision.candleIndex + 1);
  if (phaseIndex === 0) {
    return (
      <div className="decision-card reading">
        <span className="eyebrow">Jev is reading</span>
        <p className="reading-text">
          {bars} daily {symbol.symbol} bars up to the close of {formatDate(decision.date)}
          {decision.indicators ? ', and ten technical indicators' : ''}.
        </p>
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (decision.error) {
    return (
      <div className="decision-card">
        <ActionBadge action={null} large />
        <p className="callout error">The request failed: {decision.error.message}</p>
      </div>
    );
  }

  const { answers, trade, plan } = decision;
  const move = decision.forwardReturnsPct?.[Math.max(0, revealed - 1)];
  return (
    <div className="decision-card">
      <div className="stack" style={{ gap: 12 }}>
        <span className="eyebrow">Jev decided</span>
        <div className="row between">
          <ActionBadge action={decision.action} large />
          <span className="meta">confidence {formatShare(decision.confidence)}</span>
        </div>
        <Meter value={decision.confidence} tone="accent" label={`Decision confidence ${formatShare(decision.confidence)}`} />
      </div>

      <dl className="reads">
        {KEY_READS.map((key) => (
          <div key={key}>
            <dt>{key === 'market_direction' ? 'Direction' : key === 'market_structure' ? 'Structure' : 'Momentum'}</dt>
            <dd>
              {optionLabel(answers[key].choice)} <span className="meta">{formatShare(answers[key].probabilities[answers[key].choice])}</span>
            </dd>
          </div>
        ))}
        <div>
          <dt>Setup strength</dt>
          <dd>
            {nearestLevel(answers.setup_strength)}{' '}
            <span className="meta">
              {answers.setup_strength.score.toFixed(1)} of {Object.keys(answers.setup_strength.legend).length - 1}
            </span>
          </dd>
        </div>
        <div>
          <dt>Setup exists</dt>
          <dd>{formatShare(answers.trade_setup_exists.noul)} yes</dd>
        </div>
        <div>
          <dt>Stay flat</dt>
          <dd>{formatShare(answers.remain_flat_due_to_uncertainty.noul)} yes</dd>
        </div>
      </dl>

      {plan && (
        <div className="plan">
          <h4>Plan</h4>
          <dl className="reads compact-reads">
            <div>
              <dt>Stop-loss</dt>
              <dd>{plan.stopLossPct === null ? 'None' : `${plan.stopLossPct}%`}</dd>
            </div>
            <div>
              <dt>Take-profit</dt>
              <dd>{plan.takeProfitPct === null ? 'None' : `${plan.takeProfitPct}%`}</dd>
            </div>
            <div>
              <dt>Hold up to</dt>
              <dd>{plan.maxBars} bars</dd>
            </div>
            <div>
              <dt>Entry style</dt>
              <dd>{optionLabel(answers.entry_style.choice)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className={`outcome${phaseIndex === 3 ? ' final' : ''}`}>
        {trade ? (
          showExit ? (
            <>
              <span className="eyebrow">Result</span>
              <span className="outcome-value">
                <Signed value={trade.netReturnPct} />
              </span>
              <span>
                <Signed value={trade.pnl} kind="money" currency={symbol.instrument?.currency} /> · {EXIT_REASONS[trade.exitReason]} on {formatDate(trade.exitDate)}{' '}
                <span className="nowrap">
                  after {trade.barsHeld} {trade.barsHeld === 1 ? 'bar' : 'bars'}
                </span>
              </span>
            </>
          ) : phaseIndex >= 2 ? (
            <>
              <span className="eyebrow">Trade open</span>
              <span>
                Entered at {formatPrice(trade.entryPrice)} on {formatDate(trade.entryDate)}; bar {revealed} of up to {plan.maxBars}.
              </span>
            </>
          ) : (
            <span className="meta">The trade enters at the next open.</span>
          )
        ) : phaseIndex >= 2 ? (
          <>
            <span className="eyebrow">{ACTIONS.NO_TRADE.label}</span>
            <span>
              Stayed flat. The price moved <Signed value={move} /> over the next {revealed} {revealed === 1 ? 'bar' : 'bars'}
              {revealed === horizon ? '' : ' so far'}.
            </span>
          </>
        ) : (
          <span className="meta">No position is opened.</span>
        )}
      </div>

      {decision.indicators && (
        <details className="indicators-details">
          <summary>
            Indicator signals
            <span className="meta summary-meta">
              {decision.indicators.summary.bullish} bullish · {decision.indicators.summary.bearish} bearish · {decision.indicators.summary.neutral} neutral
            </span>
          </summary>
          <div className="details-content">
            <IndicatorSignals indicators={decision.indicators} />
          </div>
        </details>
      )}

      <button type="button" className="button secondary" onClick={onOpen}>
        <Icon name="decisions" />
        Open all 15 answers
      </button>
    </div>
  );
}

function PlaybackBar({ playback, total, planned, live }) {
  const { index, playing, speed, atEnd, waiting, toggle, seek, setSpeed } = playback;
  const status = waiting ? 'Waiting for the next decision…' : playing ? 'Playing' : atEnd && !live ? 'Replay finished' : 'Paused';
  return (
    <section className="panel playback" aria-label="Replay controls">
      <div className="playback-buttons">
        <button type="button" className="button ghost icon" onClick={() => seek(0)} disabled={index === 0} aria-label="First decision">
          <Icon name="restart" />
        </button>
        <button type="button" className="button ghost icon" onClick={() => seek(index - 1)} disabled={index === 0} aria-label="Previous decision">
          <Icon name="previous" />
        </button>
        <button type="button" className="button primary icon play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} disabled={total === 0}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button type="button" className="button ghost icon" onClick={() => seek(index + 1)} disabled={index >= total - 1} aria-label="Next decision">
          <Icon name="next" />
        </button>
        {live && (
          <button type="button" className="button secondary" onClick={() => seek(total - 1)} disabled={index >= total - 1}>
            <Icon name="latest" />
            Latest
          </button>
        )}
      </div>
      <label className="playback-slider">
        <span className="sr-only">Decision</span>
        <input type="range" min={1} max={Math.max(1, total)} value={index + 1} onChange={(event) => seek(Number(event.target.value) - 1)} />
      </label>
      <span className="playback-position num">
        {index + 1} / {total}
        {live && planned > total ? <span className="meta"> of {planned}</span> : null}
      </span>
      <Segmented label="Replay speed" size="small" options={SPEEDS.map((value) => ({ value, label: `${value}×` }))} value={speed} onChange={setSpeed} />
      <span className="meta playback-status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}
