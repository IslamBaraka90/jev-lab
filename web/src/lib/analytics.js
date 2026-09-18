import { summarizeDecisions } from '../../../src/services/backtest.js';

// Evaluation metrics derived from a run's decisions. Each decision view carries its answers, plan,
// simulated trade, always-long baseline and forward returns (see src/services/run-model.js).

export { summarizeDecisions };

/** Every decision in a run with its symbol and currency attached, in run order. */
export function runDecisions(run) {
  return run.symbols.flatMap((symbol) =>
    symbol.decisions.map((decision) => ({ ...decision, symbol: symbol.symbol, currency: symbol.instrument?.currency ?? 'USD' })),
  );
}

export function byDate(decisions) {
  return [...decisions].sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
}

/** Cumulative P&L after each answered decision: following Jev versus going long at every cutoff. */
export function equityPoints(decisions) {
  let jev = 0;
  let alwaysLong = 0;
  return decisions
    .filter((decision) => !decision.error)
    .map((decision) => {
      jev += decision.trade?.pnl ?? 0;
      alwaysLong += decision.baseline?.pnl ?? 0;
      return { decision, jev, alwaysLong };
    });
}

/** The largest fall from a running peak, as a negative number (0 when equity never fell). */
export function maxDrawdown(values) {
  let peak = 0;
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value - peak);
  }
  return worst;
}

/** Gross profit over gross loss; null without trades, Infinity without losses. */
export function profitFactor(trades) {
  const gains = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const losses = -trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0);
  if (!trades.length) return null;
  return losses === 0 ? (gains > 0 ? Infinity : null) : gains / losses;
}

export const CONFIDENCE_BUCKETS = [
  { label: 'Below 35%', min: 0, max: 0.35 },
  { label: '35 to 50%', min: 0.35, max: 0.5 },
  { label: '50 to 65%', min: 0.5, max: 0.65 },
  { label: '65% and up', min: 0.65, max: Infinity },
];

/** Trades grouped by the confidence of the trade decision, with each group's results. */
export function confidenceBuckets(decisions) {
  return CONFIDENCE_BUCKETS.map((bucket) => {
    const trades = decisions
      .filter((decision) => decision.trade && decision.confidence >= bucket.min && decision.confidence < bucket.max)
      .map((decision) => decision.trade);
    const summary = summarizeDecisions(trades.map((trade) => ({ trade })));
    return { ...bucket, trades: trades.length, winRatePct: summary.winRatePct, averageNetReturnPct: summary.averageNetReturnPct };
  });
}

/**
 * Answers that contradict each other or the decision. Every question is answered independently, so these
 * are worth reporting: the simulator trades a LONG or SHORT even when its plan answers are NOT_APPLICABLE.
 */
export function consistencyChecks(decisions) {
  const trades = decisions.filter((decision) => decision.trade);
  const flat = decisions.filter((decision) => decision.action === 'NO_TRADE');
  const answer = (decision, key) => decision.answers?.[key];
  const checks = [
    {
      id: 'no-stop',
      label: 'Traded with no stop-loss',
      detail: 'The stop-loss answer was Not applicable, so the trade ran without a stop.',
      pool: trades,
      test: (decision) => decision.plan?.stopLossPct === null,
    },
    {
      id: 'no-target',
      label: 'Traded with no take-profit',
      detail: 'The take-profit answer was Not applicable.',
      pool: trades,
      test: (decision) => decision.plan?.takeProfitPct === null,
    },
    {
      id: 'no-hold',
      label: 'Traded with no holding period',
      detail: 'The holding period answer was Not applicable, so the trade was held for the whole horizon.',
      pool: trades,
      test: (decision) => answer(decision, 'expected_holding_period')?.choice === 'NOT_APPLICABLE',
    },
    {
      id: 'direction',
      label: 'Direction answer disagrees with the trade',
      detail: 'The direction-if-traded answer was not the side that was traded.',
      pool: trades,
      test: (decision) => answer(decision, 'trade_direction_if_taken')?.choice !== decision.action,
    },
    {
      id: 'setup',
      label: 'Traded while a setup was judged unlikely',
      detail: 'The trade-setup-exists answer was below 50%.',
      pool: trades,
      test: (decision) => answer(decision, 'trade_setup_exists')?.noul < 0.5,
    },
    {
      id: 'stay-flat',
      label: 'Traded while advising to stay flat',
      detail: 'The stay-flat-because-of-uncertainty answer was 50% or more.',
      pool: trades,
      test: (decision) => answer(decision, 'remain_flat_due_to_uncertainty')?.noul >= 0.5,
    },
    {
      id: 'flat-direction',
      label: 'No trade, but a direction was chosen',
      detail: 'The decision was No trade while direction-if-traded was Long or Short.',
      pool: flat,
      test: (decision) => ['LONG', 'SHORT'].includes(answer(decision, 'trade_direction_if_taken')?.choice),
    },
  ];
  return checks.map(({ pool, test, ...check }) => {
    const matches = pool.filter(test);
    return { ...check, count: matches.length, of: pool.length, decisions: matches };
  });
}

/** What the market did after Jev stayed flat, compared with after it traded. */
export function noTradeReview(decisions, { bigMovePct = 5 } = {}) {
  const answered = decisions.filter((decision) => !decision.error);
  const flat = answered.filter((decision) => decision.action === 'NO_TRADE');
  const traded = answered.filter((decision) => decision.trade);
  const lastMove = (decision) => decision.forwardReturnsPct?.at(-1);
  const moves = flat.map(lastMove).filter(Number.isFinite);
  return {
    count: flat.length,
    bigMovePct,
    averageAbsoluteMovePct: average(moves.map(Math.abs)),
    bigUp: moves.filter((move) => move >= bigMovePct).length,
    bigDown: moves.filter((move) => move <= -bigMovePct).length,
    alwaysLongAfterFlatPct: average(flat.map((decision) => decision.baseline?.netReturnPct)),
    alwaysLongAfterTradesPct: average(traded.map((decision) => decision.baseline?.netReturnPct)),
    averageAbsoluteMoveAfterTradesPct: average(traded.map(lastMove).filter(Number.isFinite).map(Math.abs)),
  };
}

export const SIGNALS = [
  { key: 'confidence', label: 'Decision confidence', kind: 'share' },
  { key: 'trade_setup_exists', label: 'A trade setup exists', kind: 'share' },
  { key: 'volume_confirmation', label: 'Volume confirms the move', kind: 'share' },
  { key: 'price_overextended', label: 'Price is overextended', kind: 'share' },
  { key: 'remain_flat_due_to_uncertainty', label: 'Stay flat because of uncertainty', kind: 'share' },
  { key: 'setup_strength', label: 'Setup strength', kind: 'score' },
  { key: 'risk_quality', label: 'Risk quality', kind: 'score' },
];

/** Average answers for winning versus losing trades. */
export function signalOutcomes(decisions) {
  const trades = decisions.filter((decision) => decision.trade);
  const winners = trades.filter((decision) => decision.trade.netReturnPct > 0);
  const losers = trades.filter((decision) => decision.trade.netReturnPct < 0);
  const read = (decision, { key, kind }) => {
    if (key === 'confidence') return decision.confidence;
    const value = decision.answers?.[key];
    return kind === 'score' ? value?.score : value?.noul;
  };
  return {
    winners: winners.length,
    losers: losers.length,
    rows: SIGNALS.map((signal) => {
      const levels = signal.kind === 'score' ? Object.keys(trades[0]?.answers?.[signal.key]?.legend ?? {}).length : null;
      return {
        ...signal,
        levels,
        winners: average(winners.map((decision) => read(decision, signal))),
        losers: average(losers.map((decision) => read(decision, signal))),
      };
    }),
  };
}

export function average(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}
