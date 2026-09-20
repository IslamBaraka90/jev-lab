// Sixty pairs from a book of twelve strategies. The question behind all of them is whether a book of
// five things is five bets or one bet wearing five names.
//
// No correlation reaches the state. The two daily series do, in full, and reading them is the task.
// The demo computes every correlation itself and the report puts its number beside the answer, which
// is the only way to tell whether a pair was judged on its results or on its description.
//
// The three stress-window pairs are reported on their own. They are the point: a pair can sit at
// nothing for three years and then move together in the forty sessions when it matters.

import { choice, noul, rubricOf, score } from '../lib/questions.js';

const BETS = ['SAME_FACTOR', 'SAME_INSTRUMENT', 'SAME_TIMING', 'DIFFERENT'];
const MOVES = ['INCREASE', 'KEEP', 'REDUCE', 'DROP_ONE'];
const RELATIONS = ['SAME_PARAMETERS', 'SAME_FACTOR', 'STRESS_ONLY', 'INDEPENDENT', 'ORDINARY'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

// #region demo:state
/** Both rules, both books, and both daily series in full. Not one statistic about either. */
function buildState(item, context) {
  const side = (side_) => ({
    name: side_.name,
    rule: side_.rule,
    instruments: side_.instruments,
    average_hold_sessions: side_.averageHoldSessions,
    trades_in_the_period: side_.trades,
    daily_results_basis_points: context.series[side_.id],
  });

  return {
    task: 'These two strategies sit in the same book. Decide how much they overlap, whether holding both is really two bets, and what you would do about the allocation.',
    market_context: context.marketContext,
    how_to_read_the_numbers: context.howToRead,
    trading_days: context.tradingDays,
    strategy_one: side(item.left),
    strategy_two: side(item.right),
    note: 'Nothing has been worked out for you. The two series are the evidence.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  overlap: score('How much do these two overlap?', [
    'Independent', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Identical',
  ]),
  diversifying: noul('Does holding both actually diversify anything?', {
    yes: 'The second one earns its place beside the first.',
    no: 'The second one is mostly the first one again, at a different size.',
  }),
  same_underlying_bet: choice('If they overlap, what are they both really betting on?', {
    SAME_FACTOR: 'The same underlying driver, whatever they trade.',
    SAME_INSTRUMENT: 'The same thing, traded two ways.',
    SAME_TIMING: 'Different bets, but they are in and out at the same moments.',
    DIFFERENT: 'They are not the same bet.',
  }),
  allocation_change: choice('What would you do with the allocation?', {
    INCREASE: 'Put more into this pair; the diversification is real.',
    KEEP: 'Leave both as they are.',
    REDUCE: 'Take something off one of them.',
    DROP_ONE: 'One of these two should not be in the book.',
  }),
};
// #endregion

// #region demo:evaluate
/** One pair's reading, made from two series and two descriptions and no statistic. */
function evaluate(answers, item) {
  return {
    overlap: answers.overlap.score,
    diversifying: answers.diversifying.noul >= 0.5,
    bet: answers.same_underlying_bet.choice,
    move: answers.allocation_change.choice,
    confidence: answers.overlap.confidence,
    label: `${item.leftId} and ${item.rightId} · overlap ${answers.overlap.score.toFixed(1)} of 6 · ${readable(answers.allocation_change.choice)}`,
  };
}
// #endregion

// #region demo:report
/** The answers beside the correlations the demo worked out, and what the book adds up to. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.pairId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const of = (relation) => graded.filter((result) => byItem.get(result.item.id).relation === relation);

  return {
    note: `Sixty pairs from a book of twelve. ${of('SAME_PARAMETERS').length} are one strategy twice, ${of('SAME_FACTOR').length} share a factor, ${of('STRESS_ONLY').length} only move together under stress, ${of('INDEPENDENT').length} are genuinely independent, and the other ${of('ORDINARY').length} are ordinary pairs with nothing planted. ${context.note ?? ''}`,
    findings: findings(graded, byItem, of, context),
    kpis: kpis(graded, byItem, of),
    baselines: baselines(graded, byItem, context),
    metrics: metrics(graded, byItem),
    distributionTitle: 'What to do with the allocation',
    distribution: MOVES
      .map((move) => ({ label: sentence(move), count: graded.filter((result) => result.evaluation.move === move).length, tone: move === 'DROP_ONE' ? 'warn' : move === 'KEEP' ? 'good' : undefined }))
      .filter((entry) => entry.count),
    matrix: betMatrix(graded, byItem),
    curve: overlapCurve(graded, byItem),
    sizeScatter: scatter(graded, byItem),
    checks: checks(graded, byItem, of),
    topItemsTitle: 'Pairs graded most overlapping, with the correlation computed',
    topItems: topItems(graded, byItem),
  };
}
// #endregion

/**
 * How many independent bets a book of equally weighted strategies really holds: twelve squared over
 * the sum of every correlation between them, itself included. Twelve uncorrelated strategies give
 * twelve; twelve identical ones give one.
 */
function effectiveBets(labels, count = 12) {
  if (!labels.length) return count;
  const mean = average(labels.map((label) => label.correlation));
  const offDiagonal = count * (count - 1) * mean;
  return Number((count ** 2 / Math.max(count + offDiagonal, 0.001)).toFixed(2));
}

const ONE_BET = new Set(['SAME_PARAMETERS', 'SAME_FACTOR', 'STRESS_ONLY']);
const MIDPOINT = 3;

/** The pair is called one bet when overlap reaches the middle of its scale or holding both is said not to diversify. */
const calledOneBet = (result) => !result.evaluation.diversifying || result.evaluation.overlap >= MIDPOINT;

/** Right means the one-bet-or-two call matches the planted relation; ordinary and independent pairs are two bets. */
const readRight = (result, label) => calledOneBet(result) === ONE_BET.has(label.relation);

function pearson(left, right) {
  const mean = (values) => average(values);
  const [meanLeft, meanRight] = [mean(left), mean(right)];
  let cross = 0;
  let squaresLeft = 0;
  let squaresRight = 0;
  for (let index = 0; index < left.length; index++) {
    cross += (left[index] - meanLeft) * (right[index] - meanRight);
    squaresLeft += (left[index] - meanLeft) ** 2;
    squaresRight += (right[index] - meanRight) ** 2;
  }
  return squaresLeft && squaresRight ? cross / Math.sqrt(squaresLeft * squaresRight) : 0;
}

/** Rule: one bet if the whole-period correlation of the two daily series in the state is 0.5 or more. */
function ruleOneBet(item, context) {
  const series = (id) => String(context.series?.[id] ?? '').split(' ').map(Number);
  return pearson(series(item.leftId), series(item.rightId)) >= 0.5;
}

function baselines(graded, byItem, context) {
  if (!graded.length || !context.series) return undefined;
  const label = (result) => byItem.get(result.item.id);
  const model = graded.filter((result) => readRight(result, label(result))).length;
  const rule = graded.filter((result) => ruleOneBet(result.item, context) === ONE_BET.has(label(result).relation)).length;
  const twoBets = graded.filter((result) => !ONE_BET.has(label(result).relation)).length;
  return [
    { label: 'Jev', detail: `one bet or two, against the planted relation, ${model} of ${graded.length}`, value: model / graded.length, model: true },
    { label: 'Rule: correlate the two series, one bet at 0.5 or more', detail: `a few lines of arithmetic over the series in the state, ${rule} of ${graded.length}`, value: rule / graded.length },
    { label: 'Always two bets', detail: `the commoner answer, ${twoBets} of ${graded.length}`, value: twoBets / graded.length },
  ];
}

/** Rank agreement: how often a truly correlated pair was graded above an uncorrelated one. */
function rankAgreement(graded, byItem) {
  const strong = graded.filter((result) => byItem.get(result.item.id).correlation >= 0.6);
  const rest = graded.filter((result) => byItem.get(result.item.id).correlation < 0.6);
  if (!strong.length || !rest.length) return null;
  let wins = 0;
  for (const high of strong) {
    for (const low of rest) wins += high.evaluation.overlap > low.evaluation.overlap ? 1 : high.evaluation.overlap === low.evaluation.overlap ? 0.5 : 0;
  }
  return wins / (strong.length * rest.length);
}

function metrics(graded, byItem) {
  const right = graded.filter((result) => readRight(result, byItem.get(result.item.id)));
  const called = graded.filter(calledOneBet);
  const oneBet = graded.filter((result) => ONE_BET.has(byItem.get(result.item.id).relation));
  const hits = called.filter((result) => ONE_BET.has(byItem.get(result.item.id).relation)).length;
  return {
    headline: { label: 'One bet or two, read correctly', value: graded.length ? right.length / graded.length : 0, n: graded.length },
    accuracy: graded.length ? right.length / graded.length : null,
    precision: called.length ? hits / called.length : null,
    recall: oneBet.length ? hits / oneBet.length : null,
    rankAgreement: rankAgreement(graded, byItem),
  };
}

/** The same bets formula, fed with the overlap scores read as correlations: the book as the model sees it. */
function impliedBets(graded, count = 12) {
  if (!graded.length) return count;
  const mean = average(graded.map((result) => result.evaluation.overlap / 6));
  return Number((count ** 2 / Math.max(count + count * (count - 1) * mean, 0.001)).toFixed(2));
}

const OVERLAP_LEVELS = rubricOf(questions.overlap);

function judge(result, label) {
  if (!label || !result.evaluation) return null;
  const noulValue = result.answers.diversifying.noul;
  const planted = {
    SAME_PARAMETERS: 'Planted as one rule run twice with different parameters.',
    SAME_FACTOR: 'Planted as two strategies driven by the same factor.',
    STRESS_ONLY: `Planted as a stress-only pair: ${label.calmCorrelation} in calm markets, ${label.stressCorrelation} in the stress window.`,
    INDEPENDENT: 'Planted as a genuinely independent pair.',
    ORDINARY: 'Nothing planted: an ordinary pair.',
  }[label.relation];
  return {
    agree: readRight(result, label),
    expected: ONE_BET.has(label.relation) ? 'ONE_BET' : 'TWO_BETS',
    got: calledOneBet(result) ? 'ONE_BET' : 'TWO_BETS',
    note: `${planted} Computed correlation ${label.correlation}.`,
    confidence: Math.max(noulValue, 1 - noulValue),
  };
}

function verdict(result) {
  const { evaluation, item, answers } = result;
  const noulValue = answers.diversifying.noul;
  const undecided = Math.round(Math.abs(noulValue - 0.5) * 100) <= 5;
  const oneBet = calledOneBet(result);
  const sameBook = item.left.instruments[0] === item.right.instruments[0];
  return {
    eyebrow: 'What this pair is to the book',
    headline: `${oneBet ? 'One bet, held twice' : 'Two bets'} · ${sentence(evaluation.move)}`,
    facts: [
      { label: 'Overlap', value: `${OVERLAP_LEVELS[Math.round(evaluation.overlap)]} · ${evaluation.overlap.toFixed(1)} of 6`, tone: evaluation.overlap >= MIDPOINT ? 'warn' : undefined },
      { label: 'Holding both diversifies', value: `${undecided ? 'Undecided' : evaluation.diversifying ? 'Yes' : 'No'} · ${Math.round(noulValue * 100)}%`, tone: undecided ? 'warn' : evaluation.diversifying ? 'good' : 'bad' },
      { label: 'What they share', value: sentence(evaluation.bet), tone: evaluation.bet === 'DIFFERENT' ? undefined : 'warn' },
      { label: 'Allocation', value: sentence(evaluation.move), tone: evaluation.move === 'DROP_ONE' ? 'bad' : evaluation.move === 'REDUCE' ? 'warn' : undefined },
      { label: 'Instruments as described', value: sameBook ? `Both ${item.left.instruments[0]}` : `${item.left.instruments[0]} and ${item.right.instruments[0]}` },
    ],
  };
}

function kpis(graded, byItem, of) {
  const labels = graded.map((result) => byItem.get(result.item.id));
  const strong = graded.filter((result) => byItem.get(result.item.id).correlation >= 0.6);
  const spotted = strong.filter((result) => result.evaluation.overlap >= 4);
  const weak = graded.filter((result) => byItem.get(result.item.id).correlation < 0.2);
  const falseAlarms = weak.filter((result) => result.evaluation.overlap >= 4);
  const stress = of('STRESS_ONLY');
  const caughtStress = stress.filter((result) => !result.evaluation.diversifying || result.evaluation.overlap >= 3);
  const gap = average(strong.map((result) => result.evaluation.overlap)) - average(weak.map((result) => result.evaluation.overlap));
  const dropped = graded.filter((result) => result.evaluation.move === 'DROP_ONE');

  const right = graded.filter((result) => readRight(result, byItem.get(result.item.id)));
  const twoBets = graded.filter((result) => !ONE_BET.has(byItem.get(result.item.id).relation));
  const atMidpoint = strong.filter((result) => result.evaluation.overlap >= MIDPOINT);
  const rank = rankAgreement(graded, byItem);
  const undecided = stress.filter((result) => Math.round(Math.abs(result.answers.diversifying.noul - 0.5) * 100) <= 5);

  return [
    { label: 'One bet or two, read correctly', value: `${right.length} of ${graded.length}`, context: `against the planted relation; answering two bets every time scores ${twoBets.length}`, tone: right.length > twoBets.length ? 'good' : 'warn' },
    { label: 'Effective number of bets', value: `${effectiveBets(labels)} of 12`, context: `a fact about the book, the same on every run: twelve squared over the sum of every correlation. The overlap scores read as correlations imply ${impliedBets(graded)}` },
    { label: 'Stress-only pairs caught', value: `${caughtStress.length} of ${stress.length}`, context: `nothing for three years, then together in the forty sessions that mattered. ${undecided.length} of the ${stress.length} diversifying answers sit within five points of 50%, so this is undecided as much as wrong`, tone: stress.length && caughtStress.length >= stress.length * 0.6 ? 'good' : 'warn' },
    { label: 'Overlap against the arithmetic', value: gap.toFixed(1), context: `how much higher the correlated pairs were graded than the uncorrelated ones${rank === null ? '' : `; a correlated pair outranks an uncorrelated one ${(rank * 100).toFixed(1)}% of the time`}`, tone: gap > 1.5 ? 'good' : 'warn' },
    { label: 'Correlated pairs called out', value: `${spotted.length} of ${strong.length}`, context: `pairs correlating 0.6 or more, graded four of six or higher; ${atMidpoint.length} of ${strong.length} at three or higher, so the scores run low rather than out of order`, tone: strong.length && spotted.length >= strong.length * 0.7 ? 'good' : 'warn' },
    { label: 'Uncorrelated pairs accused', value: `${falseAlarms.length} of ${weak.length}`, context: 'pairs under 0.2, graded as substantially overlapping', tone: falseAlarms.length > weak.length / 8 ? 'warn' : 'good' },
    { label: 'Pairs where one should go', value: `${dropped.length} of ${graded.length}`, context: `${dropped.filter((result) => byItem.get(result.item.id).correlation >= 0.6).length} of those really do correlate above 0.6` },
  ];
}

function checks(graded, byItem, of) {
  const missed = (relation, test) => of(relation).filter(test);
  const sameTwice = missed('SAME_PARAMETERS', (result) => result.evaluation.overlap < 4);
  const sameFactor = missed('SAME_FACTOR', (result) => result.evaluation.bet === 'DIFFERENT');
  const stressMissed = missed('STRESS_ONLY', (result) => result.evaluation.diversifying && result.evaluation.overlap < 3);
  const independentDoubted = missed('INDEPENDENT', (result) => !result.evaluation.diversifying);
  const readWords = graded.filter((result) => {
    const label = byItem.get(result.item.id);
    return label.correlation >= 0.7 && result.item.left.instruments[0] !== result.item.right.instruments[0] && result.evaluation.overlap < 4;
  });

  return [
    { id: 'same-parameters', label: 'The same strategy twice, not seen', detail: 'One rule run with different parameters, correlating around 0.8.', count: sameTwice.length, of: of('SAME_PARAMETERS').length, items: sameTwice.slice(0, 20).map((result) => result.item.id) },
    { id: 'same-factor', label: 'Shared factor called different', detail: 'Different instruments, the same underlying driver.', count: sameFactor.length, of: of('SAME_FACTOR').length, items: sameFactor.slice(0, 20).map((result) => result.item.id) },
    { id: 'stress', label: 'Stress-only pair read as diversifying', detail: 'Flat correlation for three years, then together when it counted. Three pairs, so read it as an anecdote.', count: stressMissed.length, of: of('STRESS_ONLY').length, items: stressMissed.slice(0, 20).map((result) => result.item.id) },
    { id: 'independent', label: 'Genuinely independent pair doubted', detail: 'Correlating under 0.2 over the whole period.', count: independentDoubted.length, of: of('INDEPENDENT').length, items: independentDoubted.slice(0, 20).map((result) => result.item.id) },
    { id: 'words', label: 'Different instruments hid a high correlation', detail: 'Over 0.7 in the numbers, different books on the page, read as low overlap.', count: readWords.length, of: graded.filter((result) => byItem.get(result.item.id).correlation >= 0.7 && result.item.left.instruments[0] !== result.item.right.instruments[0]).length, items: readWords.slice(0, 20).map((result) => result.item.id) },
  ];
}

function betMatrix(graded, byItem) {
  const bands = [
    ['Over 0.7', (value) => value >= 0.7],
    ['0.4 to 0.7', (value) => value >= 0.4 && value < 0.7],
    ['0.2 to 0.4', (value) => value >= 0.2 && value < 0.4],
    ['Under 0.2', (value) => value < 0.2],
  ];
  return {
    title: 'What the pair was said to share, against the correlation the demo computed',
    rowLabel: 'bands of computed correlation, not classes',
    columnLabel: 'what the model said the pair shares',
    columns: BETS.map(sentence),
    rows: bands.map(([label, test]) => ({
      label,
      cells: BETS.map((bet) => ({
        predicted: bet,
        count: graded.filter((result) => test(byItem.get(result.item.id).correlation) && result.evaluation.bet === bet).length,
        diagonal: (label === 'Under 0.2' && bet === 'DIFFERENT') || (label === 'Over 0.7' && bet !== 'DIFFERENT'),
      })),
    })),
  };
}

function overlapCurve(graded, byItem) {
  const strong = graded.filter((result) => byItem.get(result.item.id).correlation >= 0.6);
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = graded.filter((result) => result.evaluation.overlap >= bar);
    const real = at.filter((result) => byItem.get(result.item.id).correlation >= 0.6);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: real.length, rate: at.length ? Number((real.length / at.length).toFixed(3)) : null };
  });
  return { title: 'Overlap graded against pairs that really correlate', xLabel: 'Pairs graded this much overlap or more', yLabel: 'Of those, the ones correlating 0.6 or above', rateLabel: 'Share that do', of: strong.length, thresholdFormat: 'level', levels: 6, defaultIndex: MIDPOINT, points };
}

/** The scatter that answers the real question: was the pair judged on its series or on its words? */
function scatter(graded, byItem) {
  return {
    title: 'Overlap said, against correlation computed',
    xLabel: 'Computed correlation, 0 to 1',
    yLabel: 'Overlap graded, as a share of 6',
    pointLabel: 'pairs',
    normLabel: 'computed correlation',
    valueLabel: 'overlap graded',
    flaggedLabel: 'stress-only pair',
    points: graded.map((result) => {
      const label = byItem.get(result.item.id);
      return {
        label: `${result.item.leftId}/${result.item.rightId} · ${readable(label.relation)}`,
        norm: Number(Math.max(0, label.correlation).toFixed(3)),
        value: Number((result.evaluation.overlap / 6).toFixed(3)),
        flagged: label.relation === 'STRESS_ONLY',
      };
    }),
  };
}

function findings(graded, byItem, of, context = {}) {
  const lines = [];
  const rows = baselines(graded, byItem, context);
  if (rows && rows[1].value >= rows[0].value) lines.push(`Correlating the two series and calling anything at 0.5 or above one bet reads ${Math.round(rows[1].value * graded.length)} of ${graded.length} pairs correctly; the model read ${Math.round(rows[0].value * graded.length)}, and answering two bets every time reads ${Math.round(rows[2].value * graded.length)}. The arithmetic is exact and cheap. Even it misses every stress-only pair, because whole-period correlation hides them.`);
  const stress = of('STRESS_ONLY');
  if (stress.length) {
    const caught = stress.filter((result) => !result.evaluation.diversifying || result.evaluation.overlap >= 3);
    const detail = stress.map((result) => `${result.item.leftId}/${result.item.rightId} (${byItem.get(result.item.id).calmCorrelation} calm, ${byItem.get(result.item.id).stressCorrelation} under stress)`).join(', ');
    lines.push(caught.length >= stress.length * 0.6
      ? `${caught.length} of the ${stress.length} stress-only pairs were flagged: ${detail}. Whole-period correlation would have hidden every one of them.`
      : `${stress.length - caught.length} of the ${stress.length} stress-only pairs were read as diversifying: ${detail}. Those are the pairs a book finds out about on the worst day it has. The diversifying answers were ${stress.map((result) => `${Math.round(result.answers.diversifying.noul * 100)}%`).join(', ')}, so with ${stress.length} pairs this is closer to undecided than to a finding.`);
  }

  const words = graded.filter((result) => {
    const label = byItem.get(result.item.id);
    return label.correlation >= 0.7 && result.item.left.instruments[0] !== result.item.right.instruments[0];
  });
  if (words.length) {
    const seen = words.filter((result) => result.evaluation.overlap >= 4);
    const above = graded.filter((result) => byItem.get(result.item.id).correlation >= 0.7);
    lines.push(`${above.length} pairs correlate above 0.7. ${above.length - words.length} trade the same instruments, and ${words.length} trade different ones: ${seen.length} of those ${words.length} were graded four of six or higher. That is the test of whether the series or the description is being read.`);
  }

  const labels = graded.map((result) => byItem.get(result.item.id));
  lines.push(`Across the whole book the effective number of bets is ${effectiveBets(labels)} against twelve strategies. The book is smaller than it looks, and that is before anything goes wrong.`);

  const drops = graded.filter((result) => result.evaluation.move === 'DROP_ONE');
  const wrongDrops = drops.filter((result) => byItem.get(result.item.id).correlation < 0.3);
  if (wrongDrops.length) lines.push(`${wrongDrops.length} pairs correlating under 0.3 were told to drop one of the two. Dropping a genuinely independent strategy costs more than keeping a redundant one.`);
  return lines;
}

function topItems(graded, byItem) {
  return [...graded]
    .sort((left, right) => right.evaluation.overlap - left.evaluation.overlap || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: result.evaluation.label,
      value: `${byItem.get(result.item.id).correlation} actual`,
    }));
}

const PRESENT = {
  number: 185,
  problem: {
    headline: 'Twelve strategies in one book. How many separate bets is that.',
    stat: '12',
    statLabel: 'strategies, sixty pairs between them',
  },
  hero: {
    item: 'SC-0001',
    caption: 'Twenty-day momentum against forty-day momentum, both on index futures, correlating 0.815. Graded 4.3 of 6 overlap: one bet held twice, drop one.',
  },
  answers: {
    caption: 'Four answers from two rules and two daily series in full. No correlation is given; the demo computes it afterwards and puts it beside the answer.',
    reveal: ['overlap', 'diversifying', 'same_underlying_bet', 'allocation_change'],
  },
  miss: {
    item: 'SC-0056',
    caption: 'Flat for three years at −0.01, then 0.81 in the forty-session stress window. Overlap 1.5 of 6, and the diversifying answer sat at exactly 50%.',
  },
  proof: {
    kpis: ['Effective number of bets', 'One bet or two, read correctly', 'Stress-only pairs caught'],
    chart: 'baselines',
    closing: '3.92 bets, not 12. The model read 47 of 60 pairs correctly; correlating the two series reads 56.',
  },
};

export default {
  id: 'strategy-correlation',
  title: 'Strategy correlation',
  domain: 'strategy',
  value: 'Find out whether a book of five strategies is really five bets or one bet wearing five names.',
  tags: ['strategy', 'correlation', 'portfolio', 'risk'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'pairCurves',
  itemLabel: (item) => `${item.leftId}/${item.rightId} · ${item.pair}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/strategy-correlation.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'Three stress-only pairs cannot carry a finding, and the book holds 60 of its 66 possible pairs. The correlation itself is a few lines of arithmetic that reads more pairs correctly than the model does; the judgement being tested is what to do about it.',
  grade: { labelId: (label) => label.pairId, judge },
  verdict,
  present: PRESENT,
  explain: {
    data: 'scripts/generate/strategy-correlation.js#demo:data',
    state: 'demos/strategy-correlation/demo.js#demo:state',
    questions: 'demos/strategy-correlation/demo.js#demo:questions',
    evaluate: 'demos/strategy-correlation/demo.js#demo:evaluate',
  },
};
