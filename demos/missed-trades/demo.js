import { choice, noul, score } from '../lib/questions.js';

const REASONS = ['RISK_LIMIT', 'RECENT_LOSSES', 'CALENDAR_EVENT', 'ATTENTION', 'RULE_AMBIGUITY', 'NOT_SKIPPED'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Audit this rule hit using only information available on the setup date. Confirm the mechanical qualification, infer why it was skipped when applicable, and say whether it should have been taken. Future prices are withheld.',
    market_data: context.note, written_rule: context.rule, risk_and_calendar_policy: context.riskPolicy,
    setup: { id: item.id, symbol: item.symbol, date: item.date, weekday: item.weekday, direction: item.direction, assumed_size_usd: item.assumedSizeUsd, setup_close: item.setupClose, moving_average_20: item.movingAverage20, average_range_percent: item.averageRangePercent, overnight_gap_percent: item.gapPercent },
    rule_conditions: item.conditions,
    trade_log: item.tradeLog,
    account_at_setup: item.account,
    calendar_known_at_setup: item.calendar,
    candles_through_setup_only: item.chart.bars,
  };
}
// #endregion

// #region demo:questions
const questions = {
  qualified: noul('Did this setup mechanically meet every written rule condition?', { yes: 'Every supplied condition passed.', no: 'At least one written condition failed.' }),
  skip_reason: choice('What best explains the trade-log decision from the evidence available then?', {
    RISK_LIMIT: 'Open risk was already at the stated limit.', RECENT_LOSSES: 'The setup was missed after a cluster of recent losses.',
    CALENDAR_EVENT: 'A known earnings or calendar event justified standing aside.', ATTENTION: 'No risk, calendar or loss-state reason is visible; attention is the remaining practical explanation.',
    RULE_AMBIGUITY: 'The mechanical rule passed, but its treatment of a material gap is not written clearly.', NOT_SKIPPED: 'The trade log shows that the setup was taken.',
  }),
  setup_quality: score('How strong is the setup from the rule evidence and visible pre-setup bars?', ['Poor', 'Weak', 'Below average', 'Average', 'Good', 'Very good', 'Excellent']),
  should_have_been_taken: noul('Should this setup have been taken under the written process and visible constraints?', { yes: 'It qualified and no valid risk, calendar or rule-spirit exception is present.', no: 'A visible constraint made skipping appropriate.' }),
  rule_needs_clarifying: noul('Does the written setup rule need a clearer gap or exception clause?', { yes: 'The visible case exposes an ambiguity the rule should resolve.', no: 'The rule and exception policy resolve the case.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    qualified: answers.qualified.noul >= 0.5, skipReason: answers.skip_reason.choice,
    quality: answers.setup_quality.score, shouldTake: answers.should_have_been_taken.noul >= 0.5,
    clarifyRule: answers.rule_needs_clarifying.noul >= 0.5, confidence: answers.skip_reason.confidence,
    label: `${item.id} · ${item.symbol} · ${answers.should_have_been_taken.noul >= 0.5 ? 'take' : 'honour skip'} · ${title(answers.skip_reason.choice)}`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byId = new Map((context.labels ?? []).map((label) => [label.setupId, label]));
  const graded = results.filter((result) => byId.has(result.item.id));
  const taken = graded.filter((result) => byId.get(result.item.id).taken);
  const missed = graded.filter((result) => !byId.get(result.item.id).taken);
  const justified = missed.filter((result) => byId.get(result.item.id).goodReasonToSkip);
  const avoidable = missed.filter((result) => !byId.get(result.item.id).goodReasonToSkip);
  const missCost = avoidable.reduce((sum, result) => sum + Math.max(0, byId.get(result.item.id).outcomeUsd), 0);
  const takenOutcome = taken.reduce((sum, result) => sum + byId.get(result.item.id).outcomeUsd, 0);
  const honoured = justified.filter((result) => !result.evaluation.shouldTake);
  const qualified = graded.filter((result) => result.evaluation.qualified);
  return {
    note: `Future prices were withheld from Jev and revealed only here. Miss cost uses positive real ten-session outcomes on avoidable misses; all ${justified.length} justified skips are excluded. ${context.note ?? ''}`,
    findings: findings(graded, byId),
    kpis: [
      { label: 'Avoidable miss cost', value: money(missCost), context: `${avoidable.length} missed setups; positive outcomes only` },
      { label: 'Taken-trade outcome', value: money(takenOutcome), context: `${taken.length} taken setups over the same ten-session horizon`, tone: takenOutcome >= 0 ? 'good' : 'warn' },
      { label: 'Good-reason skips honoured', value: `${honoured.length} of ${justified.length}`, context: pct(honoured.length, justified.length), tone: honoured.length === justified.length ? 'good' : 'warn' },
      { label: 'Mechanical qualification', value: `${qualified.length} of ${graded.length}`, context: 'all items came from the executable rule' },
    ],
    distribution: REASONS.map((reason) => ({ label: title(reason), count: graded.filter((result) => result.evaluation.skipReason === reason).length })).filter((entry) => entry.count),
    breakdowns: [breakdown('Misses by weekday', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], graded, byId, (result) => result.item.weekday), breakdown('Misses by recent-result state', ['AFTER_LOSSES', 'NORMAL'], graded, byId, (result) => result.item.account.recentState)],
    comparisonTable: outcomeComparison(taken, avoidable, justified, byId),
    checks: [
      { id: 'good-skip', label: 'Justified skips Jev would take', detail: 'Next-day earnings, risk already used, or an unclarified material gap.', count: justified.length - honoured.length, of: justified.length, items: justified.filter((result) => result.evaluation.shouldTake).map((result) => result.item.id) },
      { id: 'qualified', label: 'Executable rule hits called unqualified', detail: 'Every item passed all four conditions in the shared rule module.', count: graded.length - qualified.length, of: graded.length, items: graded.filter((result) => !result.evaluation.qualified).map((result) => result.item.id) },
      { id: 'ambiguity', label: 'Rule clarification recommended', detail: 'Model answer, shown separately from ground truth.', count: graded.filter((result) => result.evaluation.clarifyRule).length, of: graded.length, items: graded.filter((result) => result.evaluation.clarifyRule).map((result) => result.item.id) },
    ],
    topItems: [...avoidable].sort((left, right) => byId.get(right.item.id).outcomeUsd - byId.get(left.item.id).outcomeUsd).slice(0, 12).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: money(byId.get(result.item.id).outcomeUsd) })),
  };
}
// #endregion

function breakdown(titleText, groups, graded, byId, read) {
  return { title: titleText, rows: groups.map((group) => { const cohort = graded.filter((result) => read(result) === group); const skipped = cohort.filter((result) => !byId.get(result.item.id).taken); return { label: title(group), total: cohort.length, missed: skipped.length, rate: skipped.length / Math.max(cohort.length, 1), outcome: skipped.reduce((sum, result) => sum + byId.get(result.item.id).outcomeUsd, 0) }; }) };
}

function outcomeComparison(taken, avoidable, justified, byId) {
  const metrics = (rows) => ({ count: rows.length, average: rows.reduce((sum, result) => sum + byId.get(result.item.id).forwardReturnPercent, 0) / Math.max(rows.length, 1), positive: rows.filter((result) => byId.get(result.item.id).outcomeUsd > 0).length / Math.max(rows.length, 1), total: rows.reduce((sum, result) => sum + byId.get(result.item.id).outcomeUsd, 0) });
  const columns = [{ label: 'Taken', ...metrics(taken) }, { label: 'Avoidable misses', ...metrics(avoidable) }, { label: 'Justified skips', ...metrics(justified) }];
  return { title: 'Taken and missed ten-session outcomes', columns, rows: [{ label: 'Setups', key: 'count', format: (value) => value }, { label: 'Average return', key: 'average', format: (value) => `${value.toFixed(2)}%` }, { label: 'Positive outcome', key: 'positive', format: (value) => pct(value, 1) }, { label: 'Net outcome on $10k each', key: 'total', format: money }] };
}

function findings(graded, byId) {
  const monday = graded.filter((result) => result.item.weekday === 'Monday');
  const afterLosses = graded.filter((result) => result.item.account.recentState === 'AFTER_LOSSES');
  const rate = (rows) => rows.filter((result) => !byId.get(result.item.id).taken).length / Math.max(rows.length, 1);
  return [`Miss rate was ${pct(rate(monday), 1)} on Mondays and ${pct(rate(graded.filter((result) => result.item.weekday !== 'Monday')), 1)} on other weekdays.`, `Miss rate was ${pct(rate(afterLosses), 1)} after recent losses and ${pct(rate(graded.filter((result) => result.item.account.recentState === 'NORMAL')), 1)} in the normal state.`];
}

export default {
  id: 'missed-trades', title: 'Missed trades', domain: 'trades',
  value: 'Audit every valid setup that was not taken, then count what hesitation cost without penalising justified skips.',
  tags: ['trades', 'rules', 'misses', 'real prices'], dataClass: 'mixed', readMinutes: 5, view: 'candles', status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${item.date} · ${item.tradeLog.setupWasTaken ? 'taken' : 'not taken'}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/missed-trades.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'demos/missed-trades/rule.js#demo:data', state: 'demos/missed-trades/demo.js#demo:state', questions: 'demos/missed-trades/demo.js#demo:questions', evaluate: 'demos/missed-trades/demo.js#demo:evaluate' },
};
