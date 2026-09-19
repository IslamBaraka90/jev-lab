// Factor and sector exposure: the model sees complete holdings, owner belief and cached-real
// co-movement evidence, then names the portfolio's real and unintended bets.

import { choice, noul, score } from '../lib/questions.js';

const FACTORS = ['MOMENTUM', 'VALUE', 'QUALITY', 'SIZE', 'RATES', 'ENERGY', 'FX'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const percent = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Name what this portfolio is actually betting on, including any material bet the owner did not intend.',
    owner: { stated_belief: item.ownerBelief, home_currency: item.homeCurrency },
    market_evidence: { prices_as_of: context.pricesAsOf, method: context.coMovementMethod, factor_definitions: context.factorDefinitions, representatives: context.representatives, note: context.note },
    portfolio: {
      cash_percent: item.cashPercent,
      sector_weights_percent: item.sectorWeights,
      currency_weights_percent: item.currencyWeights,
      revenue_earned_outside_us_percent: item.foreignRevenuePercent,
      co_movement_by_plain_language_factor: item.coMovement,
      holdings: item.holdings.map((holding) => ({
        symbol: holding.symbol, sector: holding.sector, currency: holding.currency,
        weight_percent: holding.weightPercent, revenue_from_us_percent: holding.revenueFromUsPercent,
        twelve_month_return_percent: holding.twelveMonthReturnPercent, volatility_percent: holding.volatilityPercent,
        correlations_to_representative_baskets: holding.correlations,
      })),
    },
    interpretation_note: context.factorNote,
  };
}
// #endregion

// #region demo:questions
const questions = {
  dominant_factor: choice('What is the dominant exposure?', Object.fromEntries(FACTORS.map((factor) => [factor, title(factor)]))),
  unintended_exposure: choice('After excluding the dominant factor, what is the strongest distinct exposure the owner did not describe? Never repeat dominant_factor; choose NONE when no distinct second exposure is material.', { ...Object.fromEntries(FACTORS.map((factor) => [factor, title(factor)])), NONE: 'No material unintended exposure distinct from the dominant factor.' }),
  exposure_strength: score('How strong is the dominant exposure?', ['None', 'Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Dominant']),
  belief_matches_holdings: noul('Does the owner’s stated belief match the holdings?', { yes: 'The stated belief is a fair description of the actual exposures.', no: 'The holdings carry a materially different bet.' }),
  single_factor_portfolio: noul('Is this effectively a single-factor portfolio?', { yes: 'One factor explains the portfolio without a second material exposure.', no: 'A second material factor must be named.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  const matches = answers.belief_matches_holdings.noul >= 0.5;
  const single = answers.single_factor_portfolio.noul >= 0.5;
  return {
    dominant: answers.dominant_factor.choice,
    unintended: answers.unintended_exposure.choice,
    strength: answers.exposure_strength.score,
    matches,
    single,
    confidence: answers.dominant_factor.confidence,
    beliefGap: (matches ? 0 : 3) + (answers.unintended_exposure.choice === 'NONE' ? 0 : 2) + answers.exposure_strength.score / 6,
    label: `${item.id} · ${title(answers.dominant_factor.choice)} · unintended ${title(answers.unintended_exposure.choice)} · ${answers.exposure_strength.score.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byItem = new Map((context.labels ?? []).map((label) => [label.portfolioId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const dominantCorrect = graded.filter((result) => result.evaluation.dominant === byItem.get(result.item.id).dominantFactor);
  const unintendedCorrect = graded.filter((result) => result.evaluation.unintended === byItem.get(result.item.id).unintendedFactor);
  const beliefCorrect = graded.filter((result) => result.evaluation.matches === byItem.get(result.item.id).beliefMatchesHoldings);
  const singleCorrect = graded.filter((result) => result.evaluation.single === byItem.get(result.item.id).singleFactorPortfolio);
  return {
    note: `Thirty invented portfolios over cached-real instruments. Factor names are plain-language teaching buckets, not a licensed decomposition. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: [
      { label: 'Dominant factor accuracy', value: `${dominantCorrect.length} of ${graded.length}`, context: percent(dominantCorrect.length, graded.length), tone: dominantCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Unintended factor accuracy', value: `${unintendedCorrect.length} of ${graded.length}`, context: 'graded separately from the dominant exposure', tone: unintendedCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Belief matches holdings accuracy', value: `${beliefCorrect.length} of ${graded.length}`, context: 'owner story compared with the actual book', tone: beliefCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Single-factor calls', value: `${singleCorrect.length} of ${graded.length}`, context: 'whether a second material factor remains' },
    ],
    distribution: Array.from({ length: 7 }, (_, strength) => ({ label: `${strength}/6 · ${questions.exposure_strength.criteria[strength]}`, count: graded.filter((result) => Math.round(result.evaluation.strength) === strength).length })).filter((entry) => entry.count),
    matrix: factorMatrix(graded, byItem),
    checks: [
      check('dominant', 'Dominant exposure missed', graded, byItem, (result, label) => result.evaluation.dominant !== label.dominantFactor),
      check('unintended', 'Unintended exposure missed', graded, byItem, (result, label) => result.evaluation.unintended !== label.unintendedFactor),
      check('belief', 'Belief-versus-holdings call wrong', graded, byItem, (result, label) => result.evaluation.matches !== label.beliefMatchesHoldings),
    ],
    topItems: [...graded].sort((left, right) => right.evaluation.beliefGap - left.evaluation.beliefGap || right.evaluation.strength - left.evaluation.strength).slice(0, 5).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `gap ${result.evaluation.beliefGap.toFixed(1)}` })),
  };
}
// #endregion

function factorMatrix(graded, byItem) {
  return { title: 'Planted dominant factor against the factor Jev named', columns: FACTORS.map(title), rows: FACTORS.map((actual) => ({ label: title(actual), cells: FACTORS.map((predicted) => ({ predicted, count: graded.filter((result) => byItem.get(result.item.id).dominantFactor === actual && result.evaluation.dominant === predicted).length, diagonal: actual === predicted })) })) };
}

function check(id, label, graded, byItem, fails) {
  const missed = graded.filter((result) => fails(result, byItem.get(result.item.id)));
  return { id, label, detail: 'Compared with the exposure planted in the weights and visible market evidence.', count: missed.length, of: graded.length, items: missed.map((result) => result.item.id) };
}

function findings(graded, byItem) {
  const lines = [];
  const falseNone = graded.filter((result) => byItem.get(result.item.id).unintendedFactor !== 'NONE' && result.evaluation.unintended === 'NONE');
  if (falseNone.length) lines.push(`${falseNone.length} portfolios with a planted second exposure were called clean. The unintended answer is graded independently of the dominant one.`);
  const beliefErrors = graded.filter((result) => result.evaluation.matches !== byItem.get(result.item.id).beliefMatchesHoldings);
  if (beliefErrors.length) lines.push(`${beliefErrors.length} owner stories were read incorrectly against the holdings.`);
  return lines;
}

export default {
  id: 'factor-exposure', title: 'Factor and sector exposure', domain: 'portfolio',
  value: 'Say what a portfolio is actually betting on, including the bets nobody meant to make.',
  tags: ['portfolio', 'factor', 'sector', 'real prices'], dataClass: 'mixed', readMinutes: 4, view: 'table',
  itemLabel: (item) => `${item.id} · ${item.holdings.length} holdings · ${item.ownerBelief}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/factor-exposure.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/factor-exposure.js#demo:data', state: 'demos/factor-exposure/demo.js#demo:state', questions: 'demos/factor-exposure/demo.js#demo:questions', evaluate: 'demos/factor-exposure/demo.js#demo:evaluate' },
};
