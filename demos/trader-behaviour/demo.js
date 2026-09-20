import { matrixStats } from '../lib/metrics.js';
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
  const matrix = patternMatrix(graded, byId);
  const scores = scoreboard(graded, byId, correct, matrix);
  return {
    note: `All ${graded.length} synthetic days are judged relative to their own prior-30-day norms. Costs are recomputed from the trades, never from Jev’s severity score. ${context.researchOnly ?? ''}`,
    findings: findings(graded, byId, falseAlarms, scores),
    kpis: [
      { label: 'Pattern accuracy', value: `${correct.length} of ${graded.length}`, context: `${pct(correct.length, graded.length)} · calling every day disciplined scores ${pct(scores.majority, graded.length)}`, tone: correct.length === graded.length ? 'good' : undefined },
      { label: 'Habit days named exactly', value: `${scores.habitNamed} of ${scores.habitDays}`, context: `${scores.flaggedWithHabit} of the ${scores.flagged} days it flagged really carry a habit` },
      { label: 'Estimated habit cost', value: money(totalCost), context: `from the trades, not from the answers: the half-year ended ${signedMoney(scores.halfYearResult)} and would have ended about ${signedMoney(scores.halfYearResult + totalCost)} without them` },
      { label: 'Good-but-lossy false alarms', value: `${falseAlarms.length} of ${controls.length}`, context: controlContext(controls), tone: falseAlarms.length ? 'warn' : 'good' },
    ],
    baselines: scores.baselines,
    metrics: scores.metrics,
    distributionTitle: 'Patterns named',
    topItemsTitle: 'Most expensive habit days',
    distribution: PATTERNS.map((pattern) => ({ label: title(pattern), count: graded.filter((result) => result.evaluation.pattern === pattern).length })).filter((entry) => entry.count),
    matrix, costs,
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

// The rule: largest trade 2.4× the median size is revenge, 1.5× is averaging down; twice the usual trade
// count is overtrading; any profit left on the table at the normal hold is an early exit; else disciplined.
function patternByRule(item) {
  const largest = Math.max(...item.trades.map((trade) => trade.sizeUsd)) / item.norms.medianSizeUsd;
  if (largest >= 2.4) return 'REVENGE';
  if (largest >= 1.5) return 'AVERAGING_DOWN';
  if (item.trades.length >= item.norms.averageTradesPerDay * 2) return 'OVERTRADING';
  if (item.trades.some((trade) => trade.missedAtNormHoldUsd > 0)) return 'EARLY_EXIT';
  return 'DISCIPLINED';
}

/** The counts the KPIs, baselines and metrics share, so they cannot disagree with each other. */
function scoreboard(graded, byId, correct, matrix) {
  const planted = (result) => byId.get(result.item.id).pattern;
  const habits = graded.filter((result) => planted(result) !== 'DISCIPLINED');
  const flagged = graded.filter((result) => result.evaluation.pattern !== 'DISCIPLINED');
  const ruleRight = graded.filter((result) => patternByRule(result.item) === planted(result)).length;
  const majority = graded.length - habits.length;
  const stats = matrixStats(matrix);
  const share = (count) => (graded.length ? count / graded.length : 0);
  return {
    correct: correct.length,
    habitDays: habits.length,
    habitNamed: habits.filter((result) => result.evaluation.pattern === planted(result)).length,
    flagged: flagged.length,
    flaggedWithHabit: flagged.filter((result) => planted(result) !== 'DISCIPLINED').length,
    ruleRight,
    majority,
    halfYearResult: graded.reduce((sum, result) => sum + result.item.resultUsd, 0),
    baselines: graded.length ? [
      { label: 'Jev', detail: 'pattern agrees with the planted one', value: share(correct.length), model: true },
      { label: 'Rule: four thresholds against the norms', detail: 'largest size, trade count and profit left at the normal hold', value: share(ruleRight) },
      { label: 'Always the commonest pattern', detail: 'disciplined', value: share(majority) },
    ] : undefined,
    metrics: graded.length ? {
      headline: { label: 'Pattern accuracy', value: share(correct.length), n: graded.length },
      accuracy: share(correct.length),
      macroF1: stats?.macroF1 ?? null,
      // Flagging a day at all, whatever habit it was given.
      precision: flagged.length ? flagged.filter((result) => planted(result) !== 'DISCIPLINED').length / flagged.length : null,
      recall: habits.length ? habits.filter((result) => result.evaluation.pattern !== 'DISCIPLINED').length / habits.length : null,
    } : undefined,
  };
}

const signedMoney = (value) => `${value < 0 ? '−' : '+'}${money(Math.abs(value))}`;

// The controls only prove something if they lose real money, so say how much they lost.
function controlContext(controls) {
  if (!controls.length) return 'no control days in this run';
  const losses = controls.map((result) => Math.abs(result.item.resultUsd));
  return `losing days with normal process; they lost ${money(Math.min(...losses))} to ${money(Math.max(...losses))} each, which is mild`;
}

function patternMatrix(graded, byId) {
  return { title: 'Planted process pattern against the pattern Jev named', rowLabel: 'the habit the day was built to carry', columnLabel: 'the pattern the model named', columns: PATTERNS.map(title), rows: PATTERNS.map((actual) => ({ label: title(actual), cells: PATTERNS.map((predicted) => ({ predicted, count: graded.filter((result) => byId.get(result.item.id).pattern === actual && result.evaluation.pattern === predicted).length, diagonal: actual === predicted })) })) };
}

function equityCurve(graded) {
  let equity = graded[0]?.item.startingEquityUsd ?? 100_000;
  return { title: 'Six-month equity curve with Jev-flagged days', points: graded.map((result) => { equity = round(equity + result.item.resultUsd); return { id: result.item.id, label: result.item.date, value: equity, flagged: result.evaluation.pattern !== 'DISCIPLINED', pattern: title(result.evaluation.pattern) }; }) };
}

function sizeScatter(graded) {
  return { title: 'Every position size against that day’s 30-day norm', xLabel: '30-day median size (USD)', yLabel: 'Size of the trade (USD)', points: graded.flatMap((result) => result.item.trades.map((trade) => ({ id: result.item.id, label: `${result.item.date} ${trade.tradeId}`, norm: result.item.norms.medianSizeUsd, value: trade.sizeUsd, flagged: result.evaluation.pattern !== 'DISCIPLINED' }))) };
}

function findings(graded, byId, falseAlarms, scores) {
  const lines = [];
  if (scores.ruleRight > scores.correct) {
    lines.push(`Four thresholds against the day’s own norms name ${scores.ruleRight} of ${graded.length} patterns; the model named ${scores.correct}. The planted habits do not overlap, so on this dataset the rule wins.`);
  }

  const leftOnTable = graded.filter((result) => result.item.trades.some((trade) => trade.missedAtNormHoldUsd > 0));
  if (leftOnTable.length && leftOnTable.every((result) => byId.get(result.item.id).pattern === 'EARLY_EXIT')) {
    lines.push(`The state’s “additional profit available at normal hold” is non-zero on ${leftOnTable.length} days, and every one of them is a planted early-exit day. That field gives the answer away.`);
  }

  const addedDown = graded.filter((result) => byId.get(result.item.id).pattern === 'AVERAGING_DOWN');
  const readAsRevenge = addedDown.filter((result) => result.evaluation.pattern === 'REVENGE');
  if (readAsRevenge.length) {
    lines.push(`${readAsRevenge.length} of ${addedDown.length} averaging-down days were named revenge. Adding to the same losing position minutes after a loss fits both definitions; the two habits overlap as written.`);
  }

  if (graded.length && !graded.some((result) => result.evaluation.stopAdvised)) {
    lines.push(`Stopping for the day was never advised, on any of ${graded.length} days. The state gives no stop rule to apply, so that question carries no information here.`);
  }
  if (falseAlarms.length) lines.push(`${falseAlarms.length} disciplined control days were flagged because their loss was mistaken for a process problem.`);
  const lossTriggered = graded.filter((result) => result.evaluation.triggeredByLoss && !['REVENGE', 'AVERAGING_DOWN'].includes(byId.get(result.item.id).pattern));
  if (lossTriggered.length) lines.push(`${lossTriggered.length} days without a loss-triggered sequence were described as loss-triggered.`);
  return lines;
}

const round = (value) => Math.round(value * 100) / 100;

const PLANTED_AS = {
  REVENGE: 'a revenge day: size jumps within minutes of a loss',
  OVERTRADING: 'an overtrading day: about three times the usual number of trades',
  EARLY_EXIT: 'an early-exit day: winners closed well inside the normal hold',
  AVERAGING_DOWN: 'an averaging-down day: the same losing position increased after losses',
  DISCIPLINED: 'a disciplined day',
};

// #region demo:grade
/** Right means the pattern named is the habit the day was built to carry. */
const grade = {
  labelId: (label) => label.dayId,
  judge: (result, label) => {
    if (!label) return null;
    const planted = label.goodButLossy ? 'Planted as a control: a losing day with normal count, sizing and holds.' : `Planted as ${PLANTED_AS[label.pattern]}.`;
    return {
      agree: result.evaluation.pattern === label.pattern,
      expected: label.pattern,
      got: result.evaluation.pattern,
      note: label.costEstimate ? `${planted} The habit cost ${money(label.costEstimate)} that day.` : planted,
      confidence: result.answers.pattern.confidence,
    };
  },
};
// #endregion

const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;
const yesOrNo = (answer) => (answer.noul >= 0.5 ? `Yes · ${Math.round(answer.noul * 100)}%` : `No · ${Math.round((1 - answer.noul) * 100)}%`);

function severityTone(value) {
  if (value >= 3.5) return 'bad';
  return value >= 2 ? 'warn' : 'good';
}

/** The day as a card. The day's result carries no tone on purpose: a loss is not a habit. */
function verdict(result) {
  const { answers, evaluation, item } = result;
  const habit = evaluation.pattern !== 'DISCIPLINED';
  const largest = Math.max(...item.trades.map((trade) => trade.sizeUsd)) / item.norms.medianSizeUsd;
  const facts = [
    { label: 'Day result', value: signedMoney(item.resultUsd) },
    { label: 'Severity', value: levelOf(answers.severity), tone: severityTone(evaluation.severity) },
    { label: 'Largest trade against the 30-day median size', value: `${largest.toFixed(1)}×`, tone: largest >= 1.5 ? 'bad' : 'good' },
    { label: 'Sizing stayed inside the norm', value: yesOrNo(answers.size_discipline), tone: evaluation.sizeDisciplined ? 'good' : 'bad' },
    { label: 'Set off by a loss', value: yesOrNo(answers.triggered_by_loss), tone: evaluation.triggeredByLoss ? 'warn' : undefined },
  ];
  if (habit) facts.splice(1, 0, { label: 'What the habit cost today', value: money(estimateHabitCost(item, evaluation.pattern)), tone: 'bad' });

  return {
    eyebrow: 'The habit this day shows',
    headline: `${title(evaluation.pattern)} · ${Math.round(evaluation.confidence * 100)}%`,
    detail: questions.pattern.criteria[evaluation.pattern],
    facts,
  };
}

const present = {
  number: 154,
  problem: {
    headline: 'A trader knows what they lost. They rarely know which habit lost it.',
    stat: '120',
    statLabel: 'trading days, each read against its own 30-day norms',
  },
  hero: {
    item: 'TB-026',
    caption: 'Two NVDA losses, −$182 and −$325. Six minutes later a $12,343 position, 2.7 times the median size, loses $571; nine minutes after that, $10,346 of AAPL loses $301. Named revenge, set off by a loss.',
  },
  answers: {
    caption: 'One pattern for the day, how severe it is, whether a loss set it off, and whether sizing held.',
    reveal: ['pattern', 'severity', 'triggered_by_loss', 'size_discipline'],
  },
  miss: {
    item: 'TB-097',
    caption: 'Three MSFT longs in a row, each larger than the last, each a loss. Built as averaging down; named revenge at 46% against 45%. Four of the six such days went the same way.',
  },
  proof: {
    kpis: ['Pattern accuracy', 'Estimated habit cost', 'Good-but-lossy false alarms'],
    chart: 'matrix',
    closing: '$22,680: what four habits cost in six months, the difference between a half-year that ended −$16,814 and one that would have ended about +$5,866.',
  },
};

export default {
  id: 'trader-behaviour', title: 'Trader behaviour', domain: 'trades',
  value: 'Read a complete trading day and name the repeatable habit that is costing money.',
  tags: ['trades', 'behaviour', 'coaching', 'sessions'], dataClass: 'synthetic', readMinutes: 4, view: 'sessionCurve',
  itemLabel: (item) => `${item.date} · ${item.trades.length} trades · ${money(item.resultUsd)}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/trader-behaviour.labels.json'),
  buildState, questions, evaluate, report, grade, verdict, present,
  caveat: 'The planted habits do not overlap: four thresholds against the day’s own norms name all 120 patterns, and one field in the state is non-zero only on early-exit days. The eight losing control days lose about 0.4% of the account each. A harder dataset is planned.',
  explain: { data: 'scripts/generate/trader-behaviour.js#demo:data', state: 'demos/trader-behaviour/demo.js#demo:state', questions: 'demos/trader-behaviour/demo.js#demo:questions', evaluate: 'demos/trader-behaviour/demo.js#demo:evaluate' },
};
