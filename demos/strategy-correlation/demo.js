// Sixty pairs from a book of twelve strategies. The question behind all of them is whether a book of
// five things is five bets or one bet wearing five names.
//
// No correlation reaches the state. The two daily series do, in full, and reading them is the task.
// The demo computes every correlation itself and the report puts its number beside the answer, which
// is the only way to tell whether a pair was judged on its results or on its description.
//
// The three stress-window pairs are reported on their own. They are the point: a pair can sit at
// nothing for three years and then move together in the forty sessions when it matters.

import { choice, noul, score } from '../lib/questions.js';

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
    note: `Sixty pairs from a book of twelve. ${of('SAME_PARAMETERS').length} are one strategy twice, ${of('SAME_FACTOR').length} share a factor, ${of('STRESS_ONLY').length} only move together under stress, and ${of('INDEPENDENT').length} are genuinely independent. ${context.note ?? ''}`,
    findings: findings(graded, byItem, of),
    kpis: kpis(graded, byItem, of),
    distribution: MOVES
      .map((move) => ({ label: sentence(move), count: graded.filter((result) => result.evaluation.move === move).length, tone: move === 'DROP_ONE' ? 'warn' : move === 'KEEP' ? 'good' : undefined }))
      .filter((entry) => entry.count),
    matrix: betMatrix(graded, byItem),
    curve: overlapCurve(graded, byItem),
    sizeScatter: scatter(graded, byItem),
    checks: checks(graded, byItem, of),
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

  return [
    { label: 'Overlap against the arithmetic', value: gap.toFixed(1), context: 'how much higher the correlated pairs were graded than the uncorrelated ones', tone: gap > 1.5 ? 'good' : 'warn' },
    { label: 'Correlated pairs called out', value: `${spotted.length} of ${strong.length}`, context: 'pairs correlating 0.6 or more, graded four of six or higher', tone: strong.length && spotted.length >= strong.length * 0.7 ? 'good' : 'warn' },
    { label: 'Uncorrelated pairs accused', value: `${falseAlarms.length} of ${weak.length}`, context: 'pairs under 0.2, graded as substantially overlapping', tone: falseAlarms.length > weak.length / 8 ? 'warn' : 'good' },
    { label: 'Stress-only pairs caught', value: `${caughtStress.length} of ${stress.length}`, context: 'nothing for three years, then together in the forty sessions that mattered', tone: stress.length && caughtStress.length >= stress.length * 0.6 ? 'good' : 'warn' },
    { label: 'Effective number of bets', value: `${effectiveBets(labels)} of 12`, context: 'twelve squared over the sum of every correlation in the book: twelve uncorrelated strategies give twelve, twelve identical ones give one' },
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
    { id: 'stress', label: 'Stress-only pair read as diversifying', detail: 'Flat correlation for three years, then together when it counted.', count: stressMissed.length, of: of('STRESS_ONLY').length, items: stressMissed.slice(0, 20).map((result) => result.item.id) },
    { id: 'independent', label: 'Genuinely independent pair doubted', detail: 'Correlating under 0.2 over the whole period.', count: independentDoubted.length, of: of('INDEPENDENT').length, items: independentDoubted.slice(0, 20).map((result) => result.item.id) },
    { id: 'words', label: 'Different instruments hid a high correlation', detail: 'Over 0.7 in the numbers, different books on the page, read as low overlap.', count: readWords.length, of: graded.filter((result) => byItem.get(result.item.id).correlation >= 0.7).length, items: readWords.slice(0, 20).map((result) => result.item.id) },
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
  return { title: 'Overlap graded against pairs that really correlate', xLabel: 'Pairs graded this much overlap or more', yLabel: 'Of those, the ones correlating 0.6 or above', rateLabel: 'Share that do', of: strong.length, points };
}

/** The scatter that answers the real question: was the pair judged on its series or on its words? */
function scatter(graded, byItem) {
  return {
    title: 'Overlap said, against correlation computed',
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

function findings(graded, byItem, of) {
  const lines = [];
  const stress = of('STRESS_ONLY');
  if (stress.length) {
    const caught = stress.filter((result) => !result.evaluation.diversifying || result.evaluation.overlap >= 3);
    const detail = stress.map((result) => `${result.item.leftId}/${result.item.rightId} (${byItem.get(result.item.id).calmCorrelation} calm, ${byItem.get(result.item.id).stressCorrelation} under stress)`).join(', ');
    lines.push(caught.length >= stress.length * 0.6
      ? `${caught.length} of the ${stress.length} stress-only pairs were flagged: ${detail}. Whole-period correlation would have hidden every one of them.`
      : `${stress.length - caught.length} of the ${stress.length} stress-only pairs were read as diversifying: ${detail}. Those are the pairs a book finds out about on the worst day it has.`);
  }

  const words = graded.filter((result) => {
    const label = byItem.get(result.item.id);
    return label.correlation >= 0.7 && result.item.left.instruments[0] !== result.item.right.instruments[0];
  });
  if (words.length) {
    const seen = words.filter((result) => result.evaluation.overlap >= 4);
    lines.push(`${seen.length} of ${words.length} pairs that correlate above 0.7 while trading different instruments were graded as overlapping. That is the test of whether the series or the description is being read.`);
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
  explain: {
    data: 'scripts/generate/strategy-correlation.js#demo:data',
    state: 'demos/strategy-correlation/demo.js#demo:state',
    questions: 'demos/strategy-correlation/demo.js#demo:questions',
    evaluate: 'demos/strategy-correlation/demo.js#demo:evaluate',
  },
};
