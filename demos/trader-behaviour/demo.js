import { choice, noul, score } from '../lib/questions.js';
import { estimateHabitCost } from '../../scripts/generate/trader-behaviour.js';

const PATTERNS = ['REVENGE', 'OVERTRADING', 'EARLY_EXIT', 'AVERAGING_DOWN', 'DISCIPLINED'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const pct = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Review this complete trading day relative to the trader’s rolling 30-day norms. Name one dominant process pattern. Do not infer indiscipline from a loss alone.',
    interpretation: context.interpretation,
    coaching_note: context.researchOnly,
    day: { date: item.date, previous_day_result_usd: item.previousDayResultUsd, day_result_usd: item.resultUsd },
    rolling_30_day_norms: {
      completed_days: item.norms.windowTradingDays,
      average_trades_per_day: item.norms.averageTradesPerDay,
      median_position_size_usd: item.norms.medianSizeUsd,
      average_result_per_trade_usd: item.norms.averageResultPerTradeUsd,
      median_winning_hold_minutes: item.norms.medianWinningHoldMinutes,
    },
    trades_in_order: item.trades.map((trade) => ({
      trade_id: trade.tradeId, entered_at: trade.enteredAt, exited_at: trade.exitedAt,
      minutes_after_previous_exit: trade.minutesAfterPreviousExit, symbol: trade.symbol, side: trade.side,
      size_usd: trade.sizeUsd, result_usd: trade.resultUsd, holding_minutes: trade.holdingMinutes,
      additional_profit_available_at_normal_hold_usd: trade.missedAtNormHoldUsd,
    })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  pattern: choice('Which single process pattern best describes this trading day?', {
    REVENGE: 'After a loss, size jumps well above norm within minutes and compounds damage.',
    OVERTRADING: 'Trade count is about three times normal and later trades deteriorate.',
    EARLY_EXIT: 'Winning trades are repeatedly closed inside half the normal winning hold time, leaving visible profit behind.',
    AVERAGING_DOWN: 'The same losing position is repeatedly increased after losses.',
    DISCIPLINED: 'Count, sizing and hold behavior remain broadly inside norms, even if the day loses money.',
  }),
  severity: score('How costly and repeated is the process problem?', ['None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Extreme']),
  triggered_by_loss: noul('Was the day’s dominant behavior triggered by a preceding loss?', { yes: 'The visible sequence shows a loss triggering the behavior.', no: 'The behavior is not triggered by a preceding loss.' }),
  size_discipline: noul('Did position sizing stay inside the trader’s normal range?', { yes: 'Sizing stays near the supplied 30-day median.', no: 'Sizing materially exceeds the supplied norm or increases into losses.' }),
  stop_trading_advised: noul('Should the trader stop for the day under a neutral process rule?', { yes: 'The behavior is repeated or severe enough to stop the session.', no: 'No stop-for-the-day intervention is warranted from the visible process.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    pattern: answers.pattern.choice, severity: answers.severity.score,
    triggeredByLoss: answers.triggered_by_loss.noul >= 0.5,
    sizeDisciplined: answers.size_discipline.noul >= 0.5,
    stopAdvised: answers.stop_trading_advised.noul >= 0.5,
    confidence: answers.pattern.confidence,
    label: `${item.date} · ${title(answers.pattern.choice)} · severity ${answers.severity.score.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byId = new Map((context.labels ?? []).map((label) => [label.dayId, label]));
  const graded = results.filter((result) => byId.has(result.item.id));
  const correct = graded.filter((result) => result.evaluation.pattern === byId.get(result.item.id).pattern);
  const controls = graded.filter((result) => byId.get(result.item.id).goodButLossy);
  const falseAlarms = controls.filter((result) => result.evaluation.pattern !== 'DISCIPLINED');
  const costs = PATTERNS.filter((pattern) => pattern !== 'DISCIPLINED').map((pattern) => {
    const cohort = graded.filter((result) => byId.get(result.item.id).pattern === pattern);
    return { label: title(pattern), value: round(cohort.reduce((sum, result) => sum + estimateHabitCost(result.item, pattern), 0)), count: cohort.length };
  });
  const totalCost = costs.reduce((sum, entry) => sum + entry.value, 0);
  return {
    note: `All ${graded.length} synthetic days are judged relative to their own prior-30-day norms. Costs are recomputed from the trades, never from Jev’s severity score. ${context.researchOnly ?? ''}`,
    findings: findings(graded, byId, falseAlarms),
    kpis: [
      { label: 'Pattern accuracy', value: `${correct.length} of ${graded.length}`, context: pct(correct.length, graded.length), tone: correct.length === graded.length ? 'good' : 'warn' },
      { label: 'Estimated habit cost', value: money(totalCost), context: 'derived from excess-size loss, extra trades, missed profit and added-down losses' },
      { label: 'Good-but-lossy false alarms', value: `${falseAlarms.length} of ${controls.length}`, context: pct(falseAlarms.length, controls.length), tone: falseAlarms.length ? 'warn' : 'good' },
      { label: 'Stop-day recommendations', value: graded.filter((result) => result.evaluation.stopAdvised).length, context: 'model recommendations, not ground truth' },
    ],
    distribution: PATTERNS.map((pattern) => ({ label: title(pattern), count: graded.filter((result) => result.evaluation.pattern === pattern).length })).filter((entry) => entry.count),
    matrix: patternMatrix(graded, byId), costs,
    equityCurve: equityCurve(graded), sizeScatter: sizeScatter(graded),
    checks: [
      mistakeCheck('revenge', 'Revenge days missed', 'REVENGE', graded, byId),
      mistakeCheck('overtrading', 'Overtrading days missed', 'OVERTRADING', graded, byId),
      mistakeCheck('early-exit', 'Early-exit days missed', 'EARLY_EXIT', graded, byId),
      mistakeCheck('averaging-down', 'Averaging-down days missed', 'AVERAGING_DOWN', graded, byId),
      { id: 'lossy-controls', label: 'Disciplined large-loss days wrongly flagged', detail: 'These eight days lost money while count, sizing and holding behavior remained normal.', count: falseAlarms.length, of: controls.length, items: falseAlarms.map((result) => result.item.id) },
    ],
    topItems: [...graded].filter((result) => byId.get(result.item.id).pattern !== 'DISCIPLINED').sort((left, right) => estimateHabitCost(right.item, byId.get(right.item.id).pattern) - estimateHabitCost(left.item, byId.get(left.item.id).pattern)).slice(0, 12).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: money(estimateHabitCost(result.item, byId.get(result.item.id).pattern)) })),
  };
}
// #endregion

function mistakeCheck(id, label, pattern, graded, byId) {
  const cohort = graded.filter((result) => byId.get(result.item.id).pattern === pattern);
  const missed = cohort.filter((result) => result.evaluation.pattern !== pattern);
  return { id, label, detail: questions.pattern.criteria[pattern], count: missed.length, of: cohort.length, items: missed.map((result) => result.item.id) };
}

function patternMatrix(graded, byId) {
  return { title: 'Planted process pattern against the pattern Jev named', columns: PATTERNS.map(title), rows: PATTERNS.map((actual) => ({ label: title(actual), cells: PATTERNS.map((predicted) => ({ predicted, count: graded.filter((result) => byId.get(result.item.id).pattern === actual && result.evaluation.pattern === predicted).length, diagonal: actual === predicted })) })) };
}

function equityCurve(graded) {
  let equity = graded[0]?.item.startingEquityUsd ?? 100_000;
  return { title: 'Six-month equity curve with Jev-flagged days', points: graded.map((result) => { equity = round(equity + result.item.resultUsd); return { id: result.item.id, label: result.item.date, value: equity, flagged: result.evaluation.pattern !== 'DISCIPLINED', pattern: title(result.evaluation.pattern) }; }) };
}

function sizeScatter(graded) {
  return { title: 'Every position size against that day’s 30-day norm', points: graded.flatMap((result) => result.item.trades.map((trade) => ({ id: result.item.id, label: `${result.item.date} ${trade.tradeId}`, norm: result.item.norms.medianSizeUsd, value: trade.sizeUsd, flagged: result.evaluation.pattern !== 'DISCIPLINED' }))) };
}

function findings(graded, byId, falseAlarms) {
  const lines = [];
  if (falseAlarms.length) lines.push(`${falseAlarms.length} disciplined control days were flagged because their loss was mistaken for a process problem.`);
  const lossTriggered = graded.filter((result) => result.evaluation.triggeredByLoss && !['REVENGE', 'AVERAGING_DOWN'].includes(byId.get(result.item.id).pattern));
  if (lossTriggered.length) lines.push(`${lossTriggered.length} days without a loss-triggered sequence were described as loss-triggered.`);
  return lines;
}

const round = (value) => Math.round(value * 100) / 100;

export default {
  id: 'trader-behaviour', title: 'Trader behaviour', domain: 'trades',
  value: 'Read a complete trading day and name the repeatable habit that is costing money.',
  tags: ['trades', 'behaviour', 'coaching', 'sessions'], dataClass: 'synthetic', readMinutes: 4, view: 'sessionCurve',
  itemLabel: (item) => `${item.date} · ${item.trades.length} trades · ${money(item.resultUsd)}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/trader-behaviour.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/trader-behaviour.js#demo:data', state: 'demos/trader-behaviour/demo.js#demo:state', questions: 'demos/trader-behaviour/demo.js#demo:questions', evaluate: 'demos/trader-behaviour/demo.js#demo:evaluate' },
};
