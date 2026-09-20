// Factor and sector exposure: the model sees complete holdings, owner belief and cached-real
// co-movement evidence, then names the portfolio's real and unintended bets.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const FACTORS = ['MOMENTUM', 'VALUE', 'QUALITY', 'SIZE', 'RATES', 'ENERGY', 'FX'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

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
  const stats = matrixStats(beliefMatrix(graded, byItem));
  return {
    note: `Thirty invented portfolios over cached-real instruments. Factor names are plain-language teaching buckets, not a licensed decomposition. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis({ graded, byItem, dominantCorrect, unintendedCorrect, beliefCorrect, singleCorrect }),
    baselines: baselines(graded, byItem, beliefCorrect, stats),
    metrics: { headline: { label: 'Belief matches holdings accuracy', value: graded.length ? beliefCorrect.length / graded.length : 0, n: graded.length }, accuracy: stats?.accuracy ?? null, macroF1: stats?.macroF1 ?? null },
    distributionTitle: 'How strong the dominant exposure was graded',
    topItemsTitle: 'Strongest bets the owner did not describe',
    distribution: Array.from({ length: 7 }, (_, strength) => ({ label: `${strength}/6 · ${questions.exposure_strength.criteria[strength]}`, count: graded.filter((result) => Math.round(result.evaluation.strength) === strength).length })).filter((entry) => entry.count),
    matrix: factorMatrix(graded, byItem),
    checks: [
      check('dominant', 'Dominant exposure missed', graded, byItem, (result, label) => result.evaluation.dominant !== label.dominantFactor),
      check('unintended', 'Unintended exposure missed', graded, byItem, (result, label) => result.evaluation.unintended !== label.unintendedFactor),
      check('belief', 'Belief-versus-holdings call wrong', graded, byItem, (result, label) => result.evaluation.matches !== label.beliefMatchesHoldings),
    ],
    topItems: [...graded].sort((left, right) => right.evaluation.beliefGap - left.evaluation.beliefGap || right.evaluation.strength - left.evaluation.strength).slice(0, 5).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: result.evaluation.matches ? 'story matches' : 'story does not match' })),
  };
}
// #endregion

function kpis({ graded, byItem, dominantCorrect, unintendedCorrect, beliefCorrect, singleCorrect }) {
  const total = graded.length;
  const argmaxRight = graded.filter((result) => largestCoMovement(result.item) === byItem.get(result.item.id).dominantFactor);
  const oneBet = graded.filter((result) => byItem.get(result.item.id).unintendedFactor === 'NONE');
  const invented = oneBet.filter((result) => result.evaluation.unintended !== 'NONE');
  return [
    { label: 'Belief matches holdings accuracy', value: `${beliefCorrect.length} of ${total}`, context: 'owner story compared with the actual book', tone: beliefCorrect.length === total ? 'good' : 'warn' },
    { label: 'Dominant factor accuracy', value: `${dominantCorrect.length} of ${total}`, context: `taking the largest co-movement figure in the state scores ${argmaxRight.length} of ${total}`, tone: dominantCorrect.length === total ? 'good' : 'warn' },
    { label: 'Unintended factor accuracy', value: `${unintendedCorrect.length} of ${total}`, context: 'graded separately from the dominant exposure', tone: unintendedCorrect.length === total ? 'good' : 'warn' },
    { label: 'Second bet named where none was planted', value: `${invented.length} of ${oneBet.length}`, context: 'books whose owner described the whole bet', tone: invented.length ? 'warn' : 'good' },
    { label: 'Single-factor calls', value: `${singleCorrect.length} of ${total}`, context: 'whether a second material factor remains', tone: singleCorrect.length < total * 0.6 ? 'warn' : undefined },
  ];
}

/** The factor with the largest precomputed co-movement figure, which the state carries. */
function largestCoMovement(item) {
  return Object.entries(item.coMovement ?? {}).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

// The rule: the story matches the holdings when the owner calls the allocation deliberate.
const deliberateRule = (item) => /deliberate/i.test(item.ownerBelief ?? '');

function baselines(graded, byItem, beliefCorrect, stats) {
  const total = graded.length;
  if (!total) return [];
  const count = (hits) => `${hits} of ${total}`;
  const ruleRight = graded.filter((result) => deliberateRule(result.item) === byItem.get(result.item.id).beliefMatchesHoldings).length;
  const majority = Math.round((stats?.majorityBaseline ?? 0) * total);
  return [
    { label: 'Jev', detail: 'whether the owner’s story matches the holdings', value: beliefCorrect.length / total, display: count(beliefCorrect.length), model: true },
    { label: 'Rule: it matches if the owner says "deliberate"', detail: 'one word in the owner’s sentence, no holdings read at all', value: ruleRight / total, display: count(ruleRight) },
    { label: 'Always the commonest answer', detail: (stats?.majorityClass ?? '').toLowerCase(), value: majority / total, display: count(majority) },
  ];
}

/** Label against answer for the belief question, to derive accuracy and macro F1 the shared way. */
function beliefMatrix(graded, byItem) {
  const sides = [['Matches', true], ['Does not match', false]];
  return {
    columns: sides.map(([name]) => name),
    rows: sides.map(([name, actual]) => ({
      label: name,
      cells: sides.map(([, predicted]) => ({
        count: graded.filter((result) => byItem.get(result.item.id).beliefMatchesHoldings === actual && result.evaluation.matches === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function factorMatrix(graded, byItem) {
  return { title: 'Planted dominant factor against the factor Jev named', rowLabel: 'the dominant factor planted in the weights', columnLabel: 'the factor the model named', columns: FACTORS.map(title), rows: FACTORS.map((actual) => ({ label: title(actual), cells: FACTORS.map((predicted) => ({ predicted, count: graded.filter((result) => byItem.get(result.item.id).dominantFactor === actual && result.evaluation.dominant === predicted).length, diagonal: actual === predicted })) })) };
}

function check(id, label, graded, byItem, fails) {
  const missed = graded.filter((result) => fails(result, byItem.get(result.item.id)));
  return { id, label, detail: 'Compared with the exposure planted in the weights and visible market evidence.', count: missed.length, of: graded.length, items: missed.map((result) => result.item.id) };
}

function findings(graded, byItem) {
  const lines = [];
  const falseNone = graded.filter((result) => byItem.get(result.item.id).unintendedFactor !== 'NONE' && result.evaluation.unintended === 'NONE');
  if (falseNone.length) lines.push(`${falseNone.length} ${falseNone.length === 1 ? 'portfolio' : 'portfolios'} with a planted second exposure ${falseNone.length === 1 ? 'was' : 'were'} called clean. The unintended answer is graded independently of the dominant one.`);
  const oneBet = graded.filter((result) => byItem.get(result.item.id).unintendedFactor === 'NONE');
  const invented = oneBet.filter((result) => result.evaluation.unintended !== 'NONE');
  if (invented.length >= 2) lines.push(`${invented.length} of the ${oneBet.length} books with no planted second bet were given one. Most are twins of a book with the same holdings whose owner did not describe that bet, so the label turns on the owner’s wording and the model answered from the holdings.`);
  const beliefErrors = graded.filter((result) => result.evaluation.matches !== byItem.get(result.item.id).beliefMatchesHoldings);
  if (beliefErrors.length) lines.push(`${beliefErrors.length} owner ${beliefErrors.length === 1 ? 'story was' : 'stories were'} read incorrectly against the holdings.`);
  const ruleRight = graded.filter((result) => deliberateRule(result.item) === byItem.get(result.item.id).beliefMatchesHoldings).length;
  const argmaxRight = graded.filter((result) => largestCoMovement(result.item) === byItem.get(result.item.id).dominantFactor).length;
  if (ruleRight > graded.length - beliefErrors.length) lines.push(`Checking the owner’s sentence for the word "deliberate" reads ${ruleRight} of ${graded.length} stories correctly, against ${graded.length - beliefErrors.length} for the model.${argmaxRight === graded.length ? ' The dominant factor is likewise the largest co-movement figure already in the state on every book.' : ''}`);
  const singleRight = graded.filter((result) => result.evaluation.single === byItem.get(result.item.id).singleFactorPortfolio).length;
  const contradicts = graded.filter((result) => result.evaluation.single && result.evaluation.unintended !== 'NONE');
  if (graded.length >= 10 && singleRight < graded.length * 0.6) lines.push(`The single-factor question was right on ${singleRight} of ${graded.length}, about what a coin would score, and on ${contradicts.length} books it said yes while a second bet was also named. It is not a usable answer in this run.`);
  return lines;
}

const level = (question, value) => `${question.criteria[Math.round(value)] ?? '–'} · ${value.toFixed(1)} of ${question.criteria.length - 1}`;
const yesNo = (value) => `${value >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(value, 1 - value) * 100)}%`;

/** Right means the belief question, the headline: does the owner's story match the holdings. */
function judge(result, label) {
  if (!label) return null;
  const said = result.answers.belief_matches_holdings.noul;
  const second = label.unintendedFactor === 'NONE' ? 'no second bet' : `${title(label.unintendedFactor).toLowerCase()} as the bet the owner did not describe`;
  return {
    agree: result.evaluation.matches === label.beliefMatchesHoldings,
    expected: label.beliefMatchesHoldings ? 'STORY_MATCHES' : 'STORY_DOES_NOT_MATCH',
    got: result.evaluation.matches ? 'STORY_MATCHES' : 'STORY_DOES_NOT_MATCH',
    note: `Planted with ${title(label.dominantFactor).toLowerCase()} dominant and ${second}.`,
    confidence: Math.max(said, 1 - said),
  };
}

function verdict(result) {
  const { evaluation, answers, item } = result;
  const coMovement = item.coMovement?.[evaluation.dominant];
  const contradiction = evaluation.single && evaluation.unintended !== 'NONE';
  return {
    eyebrow: `The owner says: ${item.ownerBelief}`,
    headline: `${title(evaluation.dominant)} · the story ${evaluation.matches ? 'matches' : 'does not match'}`,
    facts: [
      { label: 'Dominant exposure', value: `${title(evaluation.dominant)}${Number.isFinite(coMovement) ? ` · co-movement ${coMovement.toFixed(2)}` : ''}` },
      { label: 'How strong', value: level(questions.exposure_strength, evaluation.strength) },
      { label: 'Bet the owner did not describe', value: title(evaluation.unintended), tone: evaluation.unintended === 'NONE' ? 'good' : 'warn' },
      { label: 'Story matches the holdings', value: yesNo(answers.belief_matches_holdings.noul), tone: evaluation.matches ? 'good' : 'warn' },
      { label: 'Single-factor portfolio', value: `${yesNo(answers.single_factor_portfolio.noul)}${contradiction ? ' · contradicts the second bet' : ''}`, tone: contradiction ? 'warn' : undefined },
    ],
  };
}

export default {
  id: 'factor-exposure', title: 'Factor and sector exposure', domain: 'portfolio',
  value: 'Say what a portfolio is actually betting on, including the bets nobody meant to make.',
  tags: ['portfolio', 'factor', 'sector', 'real prices'], dataClass: 'mixed', readMinutes: 4, view: 'table',
  itemLabel: (item) => `${item.id} · ${item.holdings.length} holdings · ${item.ownerBelief}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/factor-exposure.labels.json'),
  buildState, questions, evaluate, report,
  caveat: 'The dominant factor is the largest co-movement figure already in the state, the thirty books come from about seven sets of holdings, and whether a second bet counts as unintended is decided by the owner’s wording, so only the belief question measures judgement here.',
  stage: {
    hide: ['homeCurrency'],
    labels: { ownerBelief: 'What the owner says', cashPercent: 'Cash (%)', foreignRevenuePercent: 'Revenue earned outside the US (%)', coMovement: 'Co-movement with each factor basket', revenueFromUsPercent: 'Revenue from the US (%)', weightPercent: 'Weight (%)' },
    highlight: ['ownerBelief', 'foreignRevenuePercent'],
  },
  grade: { labelId: (label) => label.portfolioId, judge },
  verdict,
  present: {
    number: 144,
    problem: {
      headline: 'Owners describe their portfolio in one sentence. The holdings do not always agree with it.',
      stat: '30',
      statLabel: 'portfolios, each with the owner’s own description',
    },
    hero: {
      item: 'FE-18',
      caption: 'The owner calls it an income book whose returns should not depend on rates. Its co-movement with the rates basket is 0.48, the largest figure it has.',
    },
    answers: {
      caption: 'Rates is named as the dominant bet, value as the one nobody described, and the story is judged not to match at 89%.',
      reveal: ['dominant_factor', 'unintended_exposure', 'belief_matches_holdings'],
    },
    miss: {
      item: 'FE-13',
      caption: 'A book described as sector-balanced and defensive that moves 0.53 with quality and with little else. The label says the story does not match; the model said it does, at 63%.',
    },
    proof: {
      kpis: ['Belief matches holdings accuracy', 'Dominant factor accuracy', 'Second bet named where none was planted'],
      chart: 'baselines',
      closing: '24 of 30 owner stories read correctly. Looking for the word "deliberate" in the owner’s sentence reads 29.',
    },
  },
  explain: { data: 'scripts/generate/factor-exposure.js#demo:data', state: 'demos/factor-exposure/demo.js#demo:state', questions: 'demos/factor-exposure/demo.js#demo:questions', evaluate: 'demos/factor-exposure/demo.js#demo:evaluate' },
};
