// Portfolio compare: the goal stays above two aligned columns; Jev must pick against the goal rather
// than reward whichever side happened to have the best recent return.

import { choice, noul, score } from '../lib/questions.js';

const PICKS = ['PORTFOLIO_A', 'PORTFOLIO_B', 'TOO_CLOSE'];
const DIFFERENCES = ['CONCENTRATION', 'SECTOR_MIX', 'CURRENCY', 'LIQUIDITY', 'INCOME', 'DRAWDOWN_RISK'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const percent = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '–';

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
  return {
    note: `Eighteen invented pairs over cached-real holdings: twelve ordinary decisive comparisons, four close calls and two return traps. ${context.note ?? ''}`,
    findings: falseClose.length ? [`${falseClose.length} decisive pairs were called too close. A refusal to choose is useful only when the file is genuinely marginal.`] : [],
    kpis: [
      { label: 'Picks against labels', value: `${correct.length} of ${graded.length}`, context: percent(correct.length, graded.length), tone: correct.length === graded.length ? 'good' : 'warn' },
      { label: 'Close calls recognised', value: `${correctClose.length} of ${close.length}`, context: '“too close” is right only for the four deliberately marginal pairs', tone: correctClose.length === close.length ? 'good' : 'warn' },
      { label: 'Return traps avoided', value: `${caughtTraps.length} of ${traps.length}`, context: 'the higher-return side breaks the goal’s drawdown constraint', tone: caughtTraps.length === traps.length ? 'good' : 'bad' },
      { label: 'Decisive pairs refused', value: `${falseClose.length}`, context: 'ordinary decisive and trap pairs answered “too close”', tone: falseClose.length ? 'warn' : 'good' },
    ],
    distribution: PICKS.map((pick) => ({ label: title(pick), count: graded.filter((result) => result.evaluation.pick === pick).length })).filter((entry) => entry.count),
    matrix: differenceMatrix(graded, byItem),
    checks: [
      { id: 'close', label: 'Close calls not called too close', detail: 'The two sides differ only marginally and no goal constraint changes side.', count: close.length - correctClose.length, of: close.length, items: close.filter((result) => result.evaluation.pick !== 'TOO_CLOSE').map((result) => result.item.id) },
      { id: 'traps', label: 'Return traps missed', detail: 'Recent return is higher on the side that breaks the drawdown constraint.', count: traps.length - caughtTraps.length, of: traps.length, items: traps.filter((result) => result.evaluation.pick !== byItem.get(result.item.id).betterFit).map((result) => result.item.id) },
    ],
    topItems: [...graded].sort((left, right) => right.evaluation.decisiveness - left.evaluation.decisiveness).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: result.evaluation.pick === byItem.get(result.item.id).betterFit ? 'agrees' : `label: ${title(byItem.get(result.item.id).betterFit)}` })),
  };
}
// #endregion

function differenceMatrix(graded, byItem) {
  return {
    title: 'Intended separator against the dimension Jev named', columns: DIFFERENCES.map(title),
    rows: DIFFERENCES.map((actual) => ({ label: title(actual), cells: DIFFERENCES.map((predicted) => ({ predicted, count: graded.filter((result) => byItem.get(result.item.id).reason === actual && result.evaluation.difference === predicted).length, diagonal: actual === predicted })) })),
  };
}

const comparisonRows = (item) => [
  { label: '12-month return', left: `${item.portfolioA.summary.twelveMonthReturnPercent}%`, right: `${item.portfolioB.summary.twelveMonthReturnPercent}%` },
  { label: 'Volatility', left: `${item.portfolioA.summary.volatilityPercent}%`, right: `${item.portfolioB.summary.volatilityPercent}%` },
  { label: 'Worst drawdown', left: `${item.portfolioA.summary.drawdownPercent}%`, right: `${item.portfolioB.summary.drawdownPercent}%` },
  { label: 'Income yield', left: `${item.portfolioA.summary.incomeYieldPercent}%`, right: `${item.portfolioB.summary.incomeYieldPercent}%` },
  { label: 'Largest holding', left: `${item.portfolioA.summary.largestHoldingPercent}%`, right: `${item.portfolioB.summary.largestHoldingPercent}%` },
  { label: 'Liquid within one day', left: `${item.portfolioA.summary.liquidWithinOneDayPercent}%`, right: `${item.portfolioB.summary.liquidWithinOneDayPercent}%` },
  { label: 'Real assets', left: `${item.portfolioA.summary.realAssetSharePercent}%`, right: `${item.portfolioB.summary.realAssetSharePercent}%` },
  { label: 'Sector mix', left: item.portfolioA.summary.sectorMixPercent, right: item.portfolioB.summary.sectorMixPercent },
  { label: 'Currency mix', left: item.portfolioA.summary.currencyMixPercent, right: item.portfolioB.summary.currencyMixPercent },
  ...item.portfolioA.holdings.map((holding, index) => ({ label: `Holding ${index + 1}`, left: holding, right: item.portfolioB.holdings[index] })),
];

export default {
  id: 'portfolio-compare', title: 'Portfolio compare', domain: 'portfolio',
  value: 'Put two portfolios side by side against one goal and get a reasoned pick, not a performance table.',
  tags: ['portfolio', 'comparison', 'goals', 'real prices'], dataClass: 'mixed', readMinutes: 4,
  view: 'comparison', pairKeys: ['portfolioA', 'portfolioB'], comparisonRows,
  comparisonTitle: (item) => `${item.goal.name}: ${item.goal.words}`,
  itemLabel: (item) => `${item.id} · ${item.goal.name}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/portfolio-compare.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/portfolio-compare.js#demo:data', state: 'demos/portfolio-compare/demo.js#demo:state', questions: 'demos/portfolio-compare/demo.js#demo:questions', evaluate: 'demos/portfolio-compare/demo.js#demo:evaluate' },
};
