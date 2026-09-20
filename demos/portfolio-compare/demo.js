// Portfolio compare: the goal stays above two aligned columns; Jev must pick against the goal rather
// than reward whichever side happened to have the best recent return.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const PICKS = ['PORTFOLIO_A', 'PORTFOLIO_B', 'TOO_CLOSE'];
const DIFFERENCES = ['CONCENTRATION', 'SECTOR_MIX', 'CURRENCY', 'LIQUIDITY', 'INCOME', 'DRAWDOWN_RISK'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const percent = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '–';
const OTHER_SIDE = { PORTFOLIO_A: 'PORTFOLIO_B', PORTFOLIO_B: 'PORTFOLIO_A', TOO_CLOSE: 'TOO_CLOSE' };

const foreignPercent = (summary) => Object.entries(summary.currencyMixPercent ?? {})
  .filter(([currency]) => currency !== 'USD')
  .reduce((total, [, weight]) => total + weight, 0);

// Each hard constraint a goal can carry: the row it reads, how to say it, and how far over a side is.
const CONSTRAINTS = {
  minimum_income_yield_percent: { row: 'Income yield', words: (limit) => `at least ${limit}%`, over: (summary, limit) => limit - summary.incomeYieldPercent },
  maximum_drawdown_percent: { row: 'Worst drawdown', words: (limit) => `no worse than −${limit}%`, over: (summary, limit) => Math.abs(summary.drawdownPercent) - limit },
  maximum_volatility_percent: { row: 'Volatility', words: (limit) => `at most ${limit}%`, over: (summary, limit) => summary.volatilityPercent - limit },
  maximum_single_holding_percent: { row: 'Largest holding', words: (limit) => `at most ${limit}%`, over: (summary, limit) => summary.largestHoldingPercent - limit },
  minimum_liquid_share_percent: { row: 'Liquid within one day', words: (limit) => `at least ${limit}%`, over: (summary, limit) => limit - summary.liquidWithinOneDayPercent },
  minimum_real_asset_share_percent: { row: 'Real assets', words: (limit) => `at least ${limit}%`, over: (summary, limit) => limit - summary.realAssetSharePercent },
  maximum_foreign_currency_percent: { row: 'Held outside USD', words: (limit) => `at most ${limit}%`, over: (summary, limit) => foreignPercent(summary) - limit },
};

/** The constraints one side breaks, as [{ row, by }], read from the summary the state already carries. */
function breaches(portfolio, goal) {
  return Object.entries(goal.constraints ?? {})
    .filter(([key]) => CONSTRAINTS[key])
    .map(([key, limit]) => ({ row: CONSTRAINTS[key].row, by: CONSTRAINTS[key].over(portfolio.summary, limit) }))
    .filter((entry) => entry.by > 0);
}

const summaryFigures = (summary) => [
  summary.twelveMonthReturnPercent, summary.volatilityPercent, summary.drawdownPercent, summary.incomeYieldPercent,
  summary.largestHoldingPercent, summary.liquidWithinOneDayPercent, summary.realAssetSharePercent, foreignPercent(summary),
];

// The rule: too close if no summary figure differs by more than two points; otherwise the side that
// breaks fewer constraints, then the side that breaks them by less, then the higher return.
function constraintRule(item) {
  const left = summaryFigures(item.portfolioA.summary);
  const right = summaryFigures(item.portfolioB.summary);
  if (left.every((value, index) => Math.abs(value - right[index]) <= 2)) return 'TOO_CLOSE';
  const brokenA = breaches(item.portfolioA, item.goal);
  const brokenB = breaches(item.portfolioB, item.goal);
  if (brokenA.length !== brokenB.length) return brokenA.length < brokenB.length ? 'PORTFOLIO_A' : 'PORTFOLIO_B';
  const overA = brokenA.reduce((total, entry) => total + entry.by, 0);
  const overB = brokenB.reduce((total, entry) => total + entry.by, 0);
  if (overA !== overB) return overA < overB ? 'PORTFOLIO_A' : 'PORTFOLIO_B';
  return returnChaser(item);
}

// The rule a performance table invites: whichever side returned more over twelve months.
function returnChaser(item) {
  return item.portfolioA.summary.twelveMonthReturnPercent >= item.portfolioB.summary.twelveMonthReturnPercent ? 'PORTFOLIO_A' : 'PORTFOLIO_B';
}

/** Pairs that are the same two portfolios under the same goal with the sides swapped. */
function mirroredPairs(results) {
  const side = (portfolio) => JSON.stringify([portfolio.summary, portfolio.holdings.map((holding) => [holding.symbol, holding.weightPercent])]);
  const pairs = [];
  results.forEach((first, index) => {
    for (const second of results.slice(index + 1)) {
      const sameGoal = JSON.stringify(first.item.goal) === JSON.stringify(second.item.goal);
      if (sameGoal && side(first.item.portfolioA) === side(second.item.portfolioB) && side(first.item.portfolioB) === side(second.item.portfolioA)) pairs.push([first, second]);
    }
  });
  return pairs;
}

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Compare both portfolios against this one client goal. Hard goal constraints outrank recent return.',
    market_data: { prices_as_of: context.pricesAsOf, note: context.note },
    comparison_rule: context.comparisonRule,
    goal: item.goal,
    portfolio_a: item.portfolioA,
    portfolio_b: item.portfolioB,
  };
}
// #endregion

// #region demo:questions
const questions = {
  better_fit: choice('Which portfolio fits the stated goal better?', {
    PORTFOLIO_A: 'Portfolio A fits the goal better.',
    PORTFOLIO_B: 'Portfolio B fits the goal better.',
    TOO_CLOSE: 'The evidence does not support a meaningful preference.',
  }),
  biggest_difference: choice('Where do the portfolios differ most for this goal?', Object.fromEntries(DIFFERENCES.map((value) => [value, title(value)]))),
  decisiveness: score('How decisive is the comparison?', ['Indistinguishable', 'Marginal', 'Slight', 'Clear', 'Strong', 'Very strong', 'Overwhelming']),
  goal_constraint_breached: noul('Does either portfolio break a constraint in the goal?', { yes: 'At least one explicit goal constraint is breached.', no: 'Neither side breaches an explicit goal constraint.' }),
  one_change_would_flip_it: noul('Would one realistic allocation change flip the preferred side?', { yes: 'One bounded change would reverse or erase the preference.', no: 'The gap rests on more than one small change.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    pick: answers.better_fit.choice,
    difference: answers.biggest_difference.choice,
    decisiveness: answers.decisiveness.score,
    constraintBreached: answers.goal_constraint_breached.noul >= 0.5,
    oneChange: answers.one_change_would_flip_it.noul >= 0.5,
    confidence: answers.better_fit.confidence,
    label: `${item.id} · ${title(answers.better_fit.choice)} · ${title(answers.biggest_difference.choice)} · ${answers.decisiveness.score.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byItem = new Map((context.labels ?? []).map((label) => [label.pairId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const correct = graded.filter((result) => result.evaluation.pick === byItem.get(result.item.id).betterFit);
  const close = graded.filter((result) => byItem.get(result.item.id).kind === 'close');
  const traps = graded.filter((result) => byItem.get(result.item.id).trap);
  const correctClose = close.filter((result) => result.evaluation.pick === 'TOO_CLOSE');
  const caughtTraps = traps.filter((result) => result.evaluation.pick === byItem.get(result.item.id).betterFit);
  const falseClose = graded.filter((result) => byItem.get(result.item.id).kind !== 'close' && result.evaluation.pick === 'TOO_CLOSE');
  const mirrors = mirroredPairs(graded);
  const steady = mirrors.filter(([first, second]) => OTHER_SIDE[first.evaluation.pick] === second.evaluation.pick);
  const ruleRight = graded.filter((result) => constraintRule(result.item) === byItem.get(result.item.id).betterFit);
  const chaserRight = graded.filter((result) => returnChaser(result.item) === byItem.get(result.item.id).betterFit);
  const breachWrong = graded.filter((result) => result.evaluation.constraintBreached !== anyBreach(result.item));
  const stats = matrixStats(pickMatrix(graded, byItem));
  const total = graded.length;
  return {
    note: `Eighteen invented pairs over cached-real holdings: twelve ordinary decisive comparisons, four close calls and two return traps. ${context.note ?? ''}`,
    findings: findings({ graded, byItem, correct, falseClose, ruleRight, chaserRight, breachWrong, mirrors }),
    kpis: [
      { label: 'Picks against labels', value: `${correct.length} of ${graded.length}`, context: percent(correct.length, graded.length), tone: correct.length === graded.length ? 'good' : 'warn' },
      { label: 'Close calls recognised', value: `${correctClose.length} of ${close.length}`, context: '“too close” is right only for the four deliberately marginal pairs', tone: correctClose.length === close.length ? 'good' : 'warn' },
      { label: 'Return traps avoided', value: `${caughtTraps.length} of ${traps.length}`, context: 'the higher-return side breaks the goal’s drawdown constraint', tone: caughtTraps.length === traps.length ? 'good' : 'bad' },
      { label: 'Decisive pairs refused', value: `${falseClose.length}`, context: 'ordinary decisive and trap pairs answered “too close”', tone: falseClose.length ? 'warn' : 'good' },
      { label: 'Mirrored pairs answered consistently', value: `${steady.length} of ${mirrors.length}`, context: 'the same two portfolios with the sides swapped: the pick should swap too', tone: steady.length === mirrors.length ? 'good' : 'bad' },
    ],
    baselines: baselines({ total, correct, ruleRight, chaserRight, stats }),
    metrics: { headline: { label: 'Picks against labels', value: total ? correct.length / total : 0, n: total }, accuracy: stats?.accuracy ?? null, macroF1: stats?.macroF1 ?? null },
    distributionTitle: 'Sides picked',
    topItemsTitle: 'Pairs by decisiveness',
    distribution: PICKS.map((pick) => ({ label: title(pick), count: graded.filter((result) => result.evaluation.pick === pick).length })).filter((entry) => entry.count),
    matrix: differenceMatrix(graded, byItem),
    checks: [
      { id: 'close', label: 'Close calls not called too close', detail: 'The two sides differ only marginally and no goal constraint changes side.', count: close.length - correctClose.length, of: close.length, items: close.filter((result) => result.evaluation.pick !== 'TOO_CLOSE').map((result) => result.item.id) },
      ...consistencyChecks({ mirrors, steady, breachWrong, total }),
      { id: 'traps', label: 'Return traps missed', detail: 'Recent return is higher on the side that breaks the drawdown constraint.', count: traps.length - caughtTraps.length, of: traps.length, items: traps.filter((result) => result.evaluation.pick !== byItem.get(result.item.id).betterFit).map((result) => result.item.id) },
    ],
    topItems: [...graded].sort((left, right) => right.evaluation.decisiveness - left.evaluation.decisiveness).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: result.evaluation.pick === byItem.get(result.item.id).betterFit ? 'agrees' : `label: ${title(byItem.get(result.item.id).betterFit)}` })),
  };
}
// #endregion

function baselines({ total, correct, ruleRight, chaserRight, stats }) {
  if (!total) return [];
  const count = (hits) => `${hits} of ${total}`;
  const majority = Math.round((stats?.majorityBaseline ?? 0) * total);
  return [
    { label: 'Jev', detail: 'pick agrees with the label', value: correct.length / total, display: count(correct.length), model: true },
    { label: 'Rule: count the broken constraints', detail: 'too close within two points everywhere; else fewer breaches, smaller breach, higher return', value: ruleRight.length / total, display: count(ruleRight.length) },
    { label: 'Rule: take the higher 12-month return', detail: 'what a performance table would pick', value: chaserRight.length / total, display: count(chaserRight.length) },
    { label: 'Always the commonest answer', detail: (stats?.majorityClass ?? '').toLowerCase(), value: majority / total, display: count(majority) },
  ];
}

function consistencyChecks({ mirrors, steady, breachWrong, total }) {
  const unsteady = mirrors.filter((pair) => !steady.includes(pair));
  return [
    { id: 'mirrors', label: 'Mirrored pairs answered differently', detail: 'The same two portfolios under the same goal, sides swapped. A pick that follows the column is position bias.', count: unsteady.length, of: mirrors.length, items: unsteady.flatMap((pair) => pair.map((result) => result.item.id)) },
    { id: 'breach', label: 'Constraint-breach answer wrong', detail: 'Whether either side breaks a hard constraint, checked against the summaries in the state.', count: breachWrong.length, of: total, items: breachWrong.map((result) => result.item.id) },
  ];
}

const anyBreach = (item) => breaches(item.portfolioA, item.goal).length + breaches(item.portfolioB, item.goal).length > 0;

/** Label against pick, only to derive accuracy, macro F1 and the majority baseline the shared way. */
function pickMatrix(graded, byItem) {
  return {
    columns: PICKS.map(title),
    rows: PICKS.map((actual) => ({
      label: title(actual),
      cells: PICKS.map((predicted) => ({
        count: graded.filter((result) => byItem.get(result.item.id).betterFit === actual && result.evaluation.pick === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function findings({ graded, byItem, correct, falseClose, ruleRight, chaserRight, breachWrong, mirrors }) {
  const lines = [];
  const total = graded.length;
  if (falseClose.length) lines.push(`${falseClose.length} decisive pairs were called too close. A refusal to choose is useful only when the file is genuinely marginal.`);
  if (total && ruleRight.length >= correct.length) lines.push(`A rule that counts broken constraints scores ${ruleRight.length} of ${total}, against ${correct.length} for the model. Every figure a constraint needs is precomputed in the state, so this file is easy; picking the higher 12-month return scores ${chaserRight.length} of ${total}.`);
  const separable = graded.filter((result) => byItem.get(result.item.id).kind !== 'close');
  const separatorRight = separable.filter((result) => result.evaluation.difference === byItem.get(result.item.id).reason);
  if (separable.length) lines.push(`The dimension that separates the pair was named on ${separatorRight.length} of ${separable.length} decisive and trap pairs. The ${total - separable.length} close pairs sit in the matrix too, but their separator label is arbitrary: the sides differ by fractions of a point.`);
  if (mirrors.length) lines.push(`${mirrors.length * 2} of the ${total} pairs are ${mirrors.length} comparisons shown in both orders, so the file holds fewer distinct decisions than it has rows. Whether one change would flip the pick has no label and is not graded; the constraint-breach answer was wrong on ${breachWrong.length} of ${total}.`);
  return lines;
}

function differenceMatrix(graded, byItem) {
  return {
    title: 'Intended separator against the dimension Jev named', columns: DIFFERENCES.map(title),
    rowLabel: 'the dimension the pair was built to differ on', columnLabel: 'the dimension the model named',
    rows: DIFFERENCES.map((actual) => ({ label: title(actual), cells: DIFFERENCES.map((predicted) => ({ predicted, count: graded.filter((result) => byItem.get(result.item.id).reason === actual && result.evaluation.difference === predicted).length, diagonal: actual === predicted })) })),
  };
}

const SUMMARY_ROWS = [
  ['12-month return', (summary) => summary.twelveMonthReturnPercent],
  ['Volatility', (summary) => summary.volatilityPercent],
  ['Worst drawdown', (summary) => summary.drawdownPercent],
  ['Income yield', (summary) => summary.incomeYieldPercent],
  ['Largest holding', (summary) => summary.largestHoldingPercent],
  ['Liquid within one day', (summary) => summary.liquidWithinOneDayPercent],
  ['Real assets', (summary) => summary.realAssetSharePercent],
  ['Held outside USD', foreignPercent],
];

const mixWords = (mix) => Object.entries(mix ?? {}).map(([name, weight]) => `${name} ${weight}%`).join(' · ') || '–';
const holdingWords = (holding) => (holding ? `${holding.symbol} ${holding.weightPercent}% · ${holding.sector} · ${holding.currency} · yield ${holding.incomeYieldPercent}% · worst fall ${holding.drawdownPercent}%` : '–');

/** The goal's limit for a row, in words, when the goal constrains that row. */
function limitFor(row, goal) {
  const entry = Object.entries(goal.constraints ?? {}).find(([key]) => CONSTRAINTS[key]?.row === row);
  return entry ? CONSTRAINTS[entry[0]].words(entry[1]) : null;
}

/** Each summary figure side by side; a constrained row carries its limit and says which side breaks it. */
function comparisonRows(item) {
  const brokenA = new Set(breaches(item.portfolioA, item.goal).map((entry) => entry.row));
  const brokenB = new Set(breaches(item.portfolioB, item.goal).map((entry) => entry.row));
  const cell = (value, broken) => `${value}%${broken ? ' · breaks the goal' : ''}`;
  const figures = SUMMARY_ROWS.map(([row, read]) => {
    const limit = limitFor(row, item.goal);
    return {
      label: limit ? `${row} · goal: ${limit}` : row,
      left: cell(read(item.portfolioA.summary), brokenA.has(row)),
      right: cell(read(item.portfolioB.summary), brokenB.has(row)),
    };
  });
  return [
    ...figures,
    { label: 'Sector mix', left: mixWords(item.portfolioA.summary.sectorMixPercent), right: mixWords(item.portfolioB.summary.sectorMixPercent) },
    { label: 'Currency mix', left: mixWords(item.portfolioA.summary.currencyMixPercent), right: mixWords(item.portfolioB.summary.currencyMixPercent) },
    ...item.portfolioA.holdings.map((holding, index) => ({ label: `Holding ${index + 1}`, left: holdingWords(holding), right: holdingWords(item.portfolioB.holdings[index]) })),
  ];
}

/** The goal in its own words, then every hard constraint it carries. */
function comparisonTitle(item) {
  const limits = Object.entries(item.goal.constraints ?? {})
    .filter(([key]) => CONSTRAINTS[key])
    .map(([key, limit]) => `${CONSTRAINTS[key].row.replace(/^./, (letter) => letter.toLowerCase())} ${CONSTRAINTS[key].words(limit)}`);
  return `${item.goal.name}: ${item.goal.words}${limits.length ? ` Hard constraints: ${limits.join('; ')}.` : ''}`;
}

const level = (question, value) => `${question.criteria[Math.round(value)] ?? '–'} · ${value.toFixed(1)} of ${question.criteria.length - 1}`;
const yesNo = (value) => `${value >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(value, 1 - value) * 100)}%`;
const brokenWords = (portfolio, goal) => breaches(portfolio, goal).map((entry) => entry.row.toLowerCase()).join(', ') || 'none';

function plantedNote(label) {
  if (label.trap) return 'Planted as a return trap: the side with the higher 12-month return breaks the drawdown limit.';
  if (label.kind === 'close') return 'Planted as a close call: no summary figure differs by more than two points.';
  return `Planted as decisive on ${title(label.reason).toLowerCase()}.`;
}

/** Right means the preferred side, or the refusal to prefer one, matches the label. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: result.evaluation.pick === label.betterFit,
    expected: label.betterFit,
    got: result.evaluation.pick,
    note: plantedNote(label),
    confidence: result.answers.better_fit.confidence,
  };
}

function verdict(result) {
  const { evaluation, answers, item } = result;
  const chosen = evaluation.pick === 'TOO_CLOSE' ? 'Too close to call' : `Portfolio ${evaluation.pick === 'PORTFOLIO_A' ? 'A' : 'B'} fits the goal better`;
  return {
    eyebrow: `Against the goal: ${item.goal.name.toLowerCase()}`,
    headline: chosen,
    facts: [
      { label: 'How decisive', value: level(questions.decisiveness, evaluation.decisiveness) },
      { label: 'Where they differ most', value: title(evaluation.difference) },
      { label: 'Constraints broken, from the figures', value: `A: ${brokenWords(item.portfolioA, item.goal)} · B: ${brokenWords(item.portfolioB, item.goal)}` },
      { label: 'Model says a constraint is broken', value: yesNo(answers.goal_constraint_breached.noul), tone: evaluation.constraintBreached === anyBreach(item) ? 'good' : 'bad' },
      { label: 'One change would flip it', value: yesNo(answers.one_change_would_flip_it.noul), tone: evaluation.oneChange ? 'warn' : undefined },
      { label: 'Confidence in the pick', value: `${Math.round(evaluation.confidence * 100)}%`, tone: evaluation.confidence < 0.5 ? 'warn' : undefined },
    ],
  };
}

export default {
  id: 'portfolio-compare', title: 'Portfolio compare', domain: 'portfolio',
  value: 'Put two portfolios side by side against one goal and get a reasoned pick, not a performance table.',
  tags: ['portfolio', 'comparison', 'goals', 'real prices'], dataClass: 'mixed', readMinutes: 4,
  view: 'comparison', pairKeys: ['portfolioA', 'portfolioB'], comparisonRows,
  comparisonTitle,
  itemLabel: (item) => `${item.id} · ${item.goal.name}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/portfolio-compare.labels.json'),
  buildState, questions, evaluate, report,
  caveat: 'The eighteen pairs are built from about six portfolios, ten of them are five comparisons shown in both orders, and every figure a constraint needs is precomputed in the state, so a short rule also scores 18 of 18.',
  stage: {
    hide: ['daysOfAverageVolume', 'cashPercent', 'name'],
    labels: { twelveMonthReturnPercent: '12-month return (%)', drawdownPercent: 'Worst drawdown (%)', incomeYieldPercent: 'Income yield (%)', liquidWithinOneDayPercent: 'Liquid within one day (%)', realAssetSharePercent: 'Real assets (%)' },
    highlight: ['drawdownPercent', 'incomeYieldPercent', 'largestHoldingPercent', 'realAssetSharePercent'],
  },
  grade: { labelId: (label) => label.pairId, judge },
  verdict,
  present: {
    number: 142,
    problem: {
      headline: 'A performance table rewards last year’s return. The client asked for something else.',
      stat: '18',
      statLabel: 'pairs of portfolios, each against one goal with hard constraints',
    },
    hero: {
      item: 'PC-17',
      caption: 'The goal is a drawdown no worse than 18%. Portfolio A returned 28.95% against 17.65%, but fell 19.37% on the way. B is the pick.',
    },
    answers: {
      caption: 'B is preferred at 96% confidence, the difference is named as drawdown risk, and the comparison is graded strong at 4.1 of 6.',
      reveal: ['better_fit', 'biggest_difference', 'decisiveness'],
    },
    miss: {
      item: 'PC-14',
      caption: 'No pick was wrong in this run. This is the least sure one, at 29%: two growth portfolios within a point of each other, correctly called too close.',
    },
    proof: {
      kpis: ['Picks against labels', 'Return traps avoided', 'Mirrored pairs answered consistently'],
      chart: 'baselines',
      closing: '18 of 18 picks agree with the labels. Taking the higher return gets 6 of 18; a rule that counts broken constraints also gets 18.',
    },
  },
  explain: { data: 'scripts/generate/portfolio-compare.js#demo:data', state: 'demos/portfolio-compare/demo.js#demo:state', questions: 'demos/portfolio-compare/demo.js#demo:questions', evaluate: 'demos/portfolio-compare/demo.js#demo:evaluate' },
};
