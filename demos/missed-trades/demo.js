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
  const missCost = avoidable.reduce((sum, result) => sum + byId.get(result.item.id).outcomeUsd, 0);
  const scores = scoreboard(missed, justified);
  const takenOutcome = taken.reduce((sum, result) => sum + byId.get(result.item.id).outcomeUsd, 0);
  const honoured = justified.filter((result) => !result.evaluation.shouldTake);
  const qualified = graded.filter((result) => result.evaluation.qualified);
  return {
    note: `Future prices were withheld from Jev and revealed only here. Miss cost is the net real ten-session outcome of the avoidable misses, winners and losers together; all ${justified.length} justified skips are excluded. ${context.note ?? ''}`,
    findings: findings(graded, byId, scores),
    kpis: [
      { label: 'Skips judged as the written policy does', value: `${scores.right} of ${missed.length}`, context: `against the labels it is ${scores.rightByLabel}: ${scores.disputed} gap labels sit under the policy’s own 2.5% line`, tone: scores.right === missed.length ? 'good' : 'warn' },
      { label: 'Avoidable miss cost', value: money(missCost), context: missCostContext(avoidable, byId) },
      { label: 'Taken-trade outcome', value: money(takenOutcome), context: `${taken.length} taken setups over the same ten-session horizon`, tone: takenOutcome >= 0 ? 'good' : 'warn' },
      { label: 'Good-reason skips honoured', value: `${honoured.length} of ${justified.length}`, context: honouredContext(justified, byId), tone: honoured.length === justified.length ? 'good' : 'warn' },
    ],
    baselines: scores.baselines,
    metrics: scores.metrics,
    distributionTitle: 'Reasons given for the trade-log decision',
    topItemsTitle: 'Avoidable misses that went on to gain the most',
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

// The rule: the written policy itself. Skip on next-day earnings, on open risk at the limit, or on a gap above 2.5%.
function skipAllowedByPolicy(item) {
  const riskUsed = item.account.openRiskPercent >= item.account.maximumOpenRiskPercent;
  return item.calendar.earningsNextTradingDay || riskUsed || Math.abs(item.gapPercent) > 2.5;
}

/**
 * Only the skipped setups test anything: a taken setup is always "should take". Right is measured against
 * the written policy the model was given, because some gap labels contradict that policy.
 */
function scoreboard(missed, justified) {
  const right = missed.filter((result) => result.evaluation.shouldTake === !skipAllowedByPolicy(result.item));
  const rightByLabel = missed.filter((result) => result.evaluation.shouldTake === !justified.includes(result));
  const disputed = justified.filter((result) => !skipAllowedByPolicy(result.item));
  const share = (count) => (missed.length ? count / missed.length : 0);
  return {
    right: right.length,
    rightByLabel: rightByLabel.length,
    disputed: disputed.length,
    baselines: missed.length ? [
      { label: 'Jev', detail: 'take or honour the skip, as the written policy would', value: share(right.length), model: true },
      { label: 'Rule: the three policy checks', detail: 'earnings tomorrow, risk at the limit, gap above 2.5%; the policy is mechanical, so this is the reference', value: 1 },
      { label: 'Always “should have been taken”', detail: 'the commonest answer', value: share(missed.filter((result) => !skipAllowedByPolicy(result.item)).length) },
    ] : undefined,
    metrics: missed.length ? {
      headline: { label: 'Skips judged as the written policy does', value: share(right.length), n: missed.length },
      accuracy: share(right.length),
      accuracyAgainstLabels: share(rightByLabel.length),
    } : undefined,
  };
}

function missCostContext(avoidable, byId) {
  const outcomes = avoidable.map((result) => byId.get(result.item.id).outcomeUsd);
  const gains = outcomes.filter((value) => value > 0);
  const gained = gains.reduce((sum, value) => sum + value, 0);
  const lost = outcomes.filter((value) => value <= 0).reduce((sum, value) => sum + value, 0);
  return `${avoidable.length} missed setups, net: ${money(gained)} gained on ${gains.length} of them, ${money(Math.abs(lost))} lost on the other ${outcomes.length - gains.length}`;
}

function honouredContext(justified, byId) {
  const parts = ['EARNINGS_NEXT_DAY', 'RISK_LIMIT_USED', 'GAP_RULE_SPIRIT'].map((reason) => {
    const group = justified.filter((result) => byId.get(result.item.id).goodReason === reason);
    return `${title(reason).toLowerCase()} ${group.filter((result) => !result.evaluation.shouldTake).length} of ${group.length}`;
  });
  return `as labelled: ${parts.join(', ')}`;
}

function findings(graded, byId, scores = {}) {
  const monday = graded.filter((result) => result.item.weekday === 'Monday');
  const afterLosses = graded.filter((result) => result.item.account.recentState === 'AFTER_LOSSES');
  const rate = (rows) => rows.filter((result) => !byId.get(result.item.id).taken).length / Math.max(rows.length, 1);
  const lines = modelFindings(graded, byId, scores);
  if (rate(monday) === 1 && rate(afterLosses) === 1) lines.push('Both miss patterns below are planted as all-or-nothing, which no real trade log would show.');
  return [...lines, `Miss rate was ${pct(rate(monday), 1)} on Mondays and ${pct(rate(graded.filter((result) => result.item.weekday !== 'Monday')), 1)} on other weekdays.`, `Miss rate was ${pct(rate(afterLosses), 1)} after recent losses and ${pct(rate(graded.filter((result) => result.item.account.recentState === 'NORMAL')), 1)} in the normal state.`];
}

/** What the answers themselves show, as opposed to what the labels say about the trade log. */
function modelFindings(graded, byId, scores) {
  const lines = [];
  if (scores.disputed) {
    lines.push(`${scores.disputed} skips are labelled as justified by a gap, but their gaps are below the 2.5% the written policy names. The model said take on those, which is what the policy says; against the labels that reads as ${scores.rightByLabel} right instead of ${scores.right}.`);
  }

  const qualified = graded.filter((result) => result.evaluation.qualified).length;
  if (graded.length && qualified === graded.length) lines.push(`All ${graded.length} setups were called qualified, and all ${graded.length} are: every item came from the rule, so that question has no wrong answer to find.`);

  const clarify = graded.filter((result) => result.evaluation.clarifyRule).length;
  if (clarify > graded.length * 0.9) lines.push(`The rule was said to need a clearer gap clause on ${clarify} of ${graded.length} setups, whatever the gap. The policy text in the state mentions the ambiguity on every item.`);

  const gained = graded.filter((result) => byId.get(result.item.id).outcomeUsd > 0);
  const lost = graded.filter((result) => byId.get(result.item.id).outcomeUsd <= 0);
  const mean = (rows) => rows.reduce((sum, result) => sum + result.evaluation.quality, 0) / Math.max(rows.length, 1);
  if (gained.length && lost.length && Math.abs(mean(gained) - mean(lost)) < 0.2) {
    lines.push(`Setup quality averaged ${mean(gained).toFixed(2)} of 6 on setups that went on to gain and ${mean(lost).toFixed(2)} on those that lost: it does not separate them.`);
  }
  return lines;
}

// #region demo:grade
/** Skipped setups only. Right means the take-or-skip call is the one the written policy gives. */
const grade = {
  labelId: (label) => label.setupId,
  judge: (result, label) => {
    if (!label || label.taken) return null;
    const allowed = skipAllowedByPolicy(result.item);
    const certainty = result.answers.should_have_been_taken.noul;
    const outcome = `The next ten sessions: ${label.forwardReturnPercent > 0 ? '+' : ''}${label.forwardReturnPercent}%.`;
    const disputed = label.goodReasonToSkip && !allowed ? ` The label calls this ${Math.abs(result.item.gapPercent)}% gap a good reason to skip, but the policy only allows it above 2.5%.` : '';
    return {
      agree: result.evaluation.shouldTake === !allowed,
      expected: allowed ? 'HONOUR_SKIP' : 'SHOULD_HAVE_TAKEN',
      got: result.evaluation.shouldTake ? 'SHOULD_HAVE_TAKEN' : 'HONOUR_SKIP',
      note: `${label.goodReason ? `Planted with a reason to skip: ${title(label.goodReason).toLowerCase()}.` : 'Planted as a skip with no valid reason.'}${disputed} ${outcome}`,
      confidence: Math.max(certainty, 1 - certainty),
    };
  },
};
// #endregion

const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;
const yesOrNo = (answer) => (answer.noul >= 0.5 ? `Yes · ${Math.round(answer.noul * 100)}%` : `No · ${Math.round((1 - answer.noul) * 100)}%`);

function headlineFor(item, evaluation) {
  if (item.tradeLog.setupWasTaken) return evaluation.shouldTake ? 'Taken, as the rule asked' : 'Taken, against a visible constraint';
  return evaluation.shouldTake ? 'Skipped, and should have been taken' : 'Skipped for a valid reason';
}

/** The audit as a card. A skipped setup that should have been taken is the bad news here. */
function verdict(result) {
  const { answers, evaluation, item } = result;
  const skipped = !item.tradeLog.setupWasTaken;
  const riskUsed = item.account.openRiskPercent >= item.account.maximumOpenRiskPercent;
  return {
    eyebrow: 'The audit of this rule hit',
    headline: headlineFor(item, evaluation),
    detail: questions.skip_reason.criteria[evaluation.skipReason],
    facts: [
      { label: 'Should have been taken', value: yesOrNo(answers.should_have_been_taken), tone: skipped && evaluation.shouldTake ? 'bad' : 'good' },
      { label: 'Reason for the log decision', value: `${title(evaluation.skipReason)} · ${Math.round(evaluation.confidence * 100)}%` },
      { label: 'Met every rule condition', value: yesOrNo(answers.qualified), tone: evaluation.qualified ? 'good' : 'bad' },
      { label: 'Setup quality', value: levelOf(answers.setup_quality) },
      { label: 'Open risk against the limit', value: `${item.account.openRiskPercent.toFixed(2)}% of ${item.account.maximumOpenRiskPercent.toFixed(2)}%`, tone: riskUsed ? 'bad' : undefined },
      { label: 'Rule needs a clearer gap clause', value: yesOrNo(answers.rule_needs_clarifying), tone: evaluation.clarifyRule ? 'warn' : undefined },
    ],
  };
}

const present = {
  number: 156,
  problem: {
    headline: 'The trader’s own rule fired 240 times in three years. 130 of those setups were never taken.',
    stat: '130',
    statLabel: 'valid setups skipped, 100 of them for no written reason',
  },
  hero: {
    item: 'MT-225',
    caption: 'JNJ, a Monday, the last three trades −$301, −$156 and +$65. No earnings, open risk 1.26% of 2%. Should have been taken, 78%; reason, recent losses. The next ten sessions: +15.54%, $1,554 on $10,000.',
  },
  answers: {
    caption: 'Did it qualify, why was it skipped, and should it have been taken. Future prices stay hidden until the report.',
    reveal: ['qualified', 'skip_reason', 'should_have_been_taken'],
  },
  miss: {
    item: 'MT-073',
    caption: 'The least sure call, 60%. A 2.42% gap: the label says a fair reason to skip, the written policy only allows it above 2.5%. The model followed the policy; 9 of the 10 gap labels are like this.',
  },
  proof: {
    kpis: ['Skips judged as the written policy does', 'Avoidable miss cost', 'Taken-trade outcome'],
    chart: 'baselines',
    closing: 'The 100 setups skipped for no written reason made $10,732 net over ten sessions each. The 110 that were taken made $5,432.',
  },
};

export default {
  id: 'missed-trades', title: 'Missed trades', domain: 'trades',
  value: 'Audit every valid setup that was not taken, then count what hesitation cost without penalising justified skips.',
  tags: ['trades', 'rules', 'misses', 'real prices'], dataClass: 'mixed', readMinutes: 5, view: 'candles',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${item.date} · ${item.tradeLog.setupWasTaken ? 'taken' : 'not taken'}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/missed-trades.labels.json'),
  buildState, questions, evaluate, report, grade, verdict, present,
  caveat: 'The take-or-skip policy is three mechanical checks, every item already passed the rule, and the account’s loss state arrives in the state as a ready-made label, so most answers here are lookups. Nine of the ten gap labels contradict the policy’s own 2.5% line, and the miss pattern is planted at exactly 100% on Mondays and after losses.',
  explain: { data: 'demos/missed-trades/rule.js#demo:data', state: 'demos/missed-trades/demo.js#demo:state', questions: 'demos/missed-trades/demo.js#demo:questions', evaluate: 'demos/missed-trades/demo.js#demo:evaluate' },
};
