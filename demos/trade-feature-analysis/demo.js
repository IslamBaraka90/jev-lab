import { matrixStats, wilson } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const SETUPS = ['BREAKOUT', 'PULLBACK', 'REVERSAL', 'RANGE_FADE'];
const CONTEXTS = ['TREND', 'RANGE', 'POST_GAP', 'NEWS_DAY'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (value) => `${(value * 100).toFixed(1)}%`;

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Read this trade only at its entry bar. Grade the setup and decide whether the entry is already extended. The outcome is withheld.',
    market_data: context.note,
    trade: { symbol: item.symbol, trader_labelled_setup: item.setupType, entry_date: item.entryDate, entry_price: item.entryPrice, planned_stop: item.plannedStop, planned_target: item.plannedTarget },
    entry_evidence: { moving_average_20: item.movingAverage20, distance_from_ma_percent: item.entryDistanceFromMaPercent, entry_bar_close_location_0_to_1: item.entryBarCloseLocation, recent_range_percent: item.recentRangePercent, entry_volume_vs_20_day_average: item.entryVolumeVsAverage, overnight_gap_percent: item.gapPercent },
    candles_through_entry_only: item.chart.bars,
  };
}
// #endregion

// #region demo:questions
const questions = {
  setup_type: choice('What setup is the trader attempting?', Object.fromEntries(SETUPS.map((value) => [value, title(value)]))),
  entry_quality: score('How good is the entry at this bar?', ['Terrible', 'Very poor', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']),
  context: choice('What market context best describes the entry?', Object.fromEntries(CONTEXTS.map((value) => [value, title(value)]))),
  extended_entry: noul('Is the entry already far from where the move started?', { yes: 'The entry is extended from its recent anchor.', no: 'The entry remains close enough to its recent anchor.' }),
  would_take_again: noul('Would you take this setup again from the evidence available at entry?', { yes: 'The entry evidence is good enough to repeat.', no: 'The entry evidence is not good enough to repeat.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return { setup: answers.setup_type.choice, quality: answers.entry_quality.score, context: answers.context.choice, extended: answers.extended_entry.noul >= 0.5, wouldTake: answers.would_take_again.noul >= 0.5, confidence: answers.would_take_again.noul, label: `${item.id} · ${title(answers.setup_type.choice)} · quality ${answers.entry_quality.score.toFixed(1)} · ${answers.extended_entry.noul >= 0.5 ? 'extended' : 'not extended'}` };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byItem = new Map((context.labels ?? []).map((label) => [label.tradeId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const winners = graded.filter((result) => byItem.get(result.item.id).outcome === 'WIN');
  const losers = graded.filter((result) => byItem.get(result.item.id).outcome === 'LOSS');
  const taken = graded.filter((result) => result.evaluation.wouldTake);
  const base = winners.length / Math.max(graded.length, 1);
  const takeRate = taken.filter((result) => byItem.get(result.item.id).outcome === 'WIN').length / Math.max(taken.length, 1);
  const edgeRows = modelFeatureRows(winners, losers);
  const controls = actualFeatureGaps(graded, byItem);
  const won = (result) => byItem.get(result.item.id).outcome === 'WIN';
  const takenWins = taken.filter(won).length;
  const interval = wilson(takenWins, taken.length);
  const rulePicks = graded.filter((result) => takeByRule(result.item));
  const matched = graded.filter((result) => result.evaluation.wouldTake === won(result));
  const extended = extendedRead(graded, byItem);
  const matrix = takeOutcomes(graded, won);
  return {
    note: `Outcomes were hidden until this report. ${graded.length} trades over cached-real entry candles; the outcomes are synthetic. ${context.note ?? ''}`,
    findings: findings({ graded, taken, base, takeRate, interval, rulePicks, won, extended }),
    kpis: [
      { label: 'Would-take-again win rate', value: pct(takeRate), context: `${taken.length} trades selected · ${(100 * (takeRate - base)).toFixed(1)} percentage points versus base · 95% interval ${pct(interval.low)} to ${pct(interval.high)}`, tone: interval.low > base ? 'good' : 'warn' },
      { label: 'Base win rate', value: pct(base), context: `${winners.length} of ${graded.length}` },
      { label: 'Take or pass matches the outcome', value: `${matched.length} of ${graded.length}`, context: `always passing matches ${losers.length} of ${graded.length}` },
      { label: 'Extended entry read right', value: `${extended.right} of ${graded.length}`, context: `precision ${pct(extended.precision)}, recall ${pct(extended.recall)}; the distance is a number in the state`, tone: extended.right === graded.length ? 'good' : 'warn' },
      { label: 'Winner entry quality', value: average(winners, (result) => result.evaluation.quality).toFixed(2), context: `losers ${average(losers, (result) => result.evaluation.quality).toFixed(2)}, out of 6 · AUC ${auc(winners, losers, (result) => result.evaluation.quality).toFixed(2)} against the outcome` },
    ],
    baselines: baselines({ graded, taken, takeRate, rulePicks, base, won }),
    metrics: metrics({ graded, taken, takeRate, matched, matrix }),
    analysisTitle: 'Jev answers split by revealed outcome, ranked by how well each separates them (AUC distance from 0.5)', analysisRows: edgeRows,
    setupOutcomes: setupOutcomes(graded, byItem),
    distributionTitle: 'Entry quality given, with the win rate in each bucket',
    distribution: Array.from({ length: 7 }, (_, bucket) => { const group = graded.filter((result) => Math.round(result.evaluation.quality) === bucket); return { label: `${bucket}/6 · ${questions.entry_quality.criteria[bucket]}`, count: group.length, detail: group.length ? `${pct(group.filter((result) => byItem.get(result.item.id).outcome === 'WIN').length / group.length)} win rate` : '' }; }).filter((entry) => entry.count),
    matrix,
    checks: controls.map((entry) => ({ id: entry.id, label: entry.label, detail: entry.detail, count: Math.round(entry.gap * 100), of: 100, items: [] })),
    topItemsTitle: 'Highest-graded entries, and what they went on to do',
    topItems: [...graded].sort((left, right) => right.evaluation.quality - left.evaluation.quality).slice(0, 10).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: byItem.get(result.item.id).outcome.toLowerCase() })),
  };
}
// #endregion

const average = (rows, read) => rows.length ? rows.reduce((sum, row) => sum + read(row), 0) / rows.length : 0;
const rate = (rows, test) => rows.length ? rows.filter(test).length / rows.length : 0;

// A score out of six and two shares cannot be ranked by their raw gaps, so each answer is ranked by one
// unit: how far its AUC against the outcome sits from 0.5, the value of an answer that says nothing.
function modelFeatureRows(winners, losers) {
  const separation = (read) => Math.abs(auc(winners, losers, read) - 0.5);
  return [
    { feature: 'Entry quality (average)', winners: average(winners, (r) => r.evaluation.quality).toFixed(2), losers: average(losers, (r) => r.evaluation.quality).toFixed(2), gap: separation((r) => r.answers.entry_quality.score) },
    { feature: 'Called extended', winners: pct(rate(winners, (r) => r.evaluation.extended)), losers: pct(rate(losers, (r) => r.evaluation.extended)), gap: separation((r) => r.answers.extended_entry.noul) },
    { feature: 'Would take again', winners: pct(rate(winners, (r) => r.evaluation.wouldTake)), losers: pct(rate(losers, (r) => r.evaluation.wouldTake)), gap: separation((r) => r.answers.would_take_again.noul) },
  ].sort((left, right) => right.gap - left.gap);
}

/** The chance that a winner scores above a loser on `read`; ties count half. 0.5 is no information. */
function auc(winners, losers, read) {
  if (!winners.length || !losers.length) return 0.5;
  let wins = 0;
  for (const winner of winners) {
    for (const loser of losers) {
      if (read(winner) > read(loser)) wins += 1;
      else if (read(winner) === read(loser)) wins += 0.5;
    }
  }
  return wins / (winners.length * losers.length);
}

// The rule: take a trade entered within 1.5% of its 20-day average on a bar that closed in its top third.
function takeByRule(item) {
  return item.entryDistanceFromMaPercent < 1.5 && item.entryBarCloseLocation >= 2 / 3;
}

// The rule the extended-entry label was planted with: 1.5% or more from the 20-day average.
const extendedByRule = (item) => item.entryDistanceFromMaPercent >= 1.5;

function extendedRead(graded, byItem) {
  const planted = graded.filter((result) => byItem.get(result.item.id).extendedEntry);
  const called = graded.filter((result) => result.evaluation.extended);
  const hits = called.filter((result) => byItem.get(result.item.id).extendedEntry).length;
  return {
    right: graded.filter((result) => result.evaluation.extended === byItem.get(result.item.id).extendedEntry).length,
    ruleRight: graded.filter((result) => extendedByRule(result.item) === byItem.get(result.item.id).extendedEntry).length,
    precision: called.length ? hits / called.length : 0,
    recall: planted.length ? hits / planted.length : 0,
  };
}

function findings({ graded, taken, base, takeRate, interval, rulePicks, won, extended }) {
  const lines = [];
  if (!graded.length) return lines;
  if (takeRate <= base) {
    lines.push(`“Would take again” did not beat the ${(base * 100).toFixed(1)}% base win rate; the report leaves that result unvarnished.`);
  } else if (interval.low <= base) {
    lines.push(`The ${(100 * (takeRate - base)).toFixed(1)}-point lift rests on ${taken.length} picks. Its 95% interval, ${pct(interval.low)} to ${pct(interval.high)}, includes the ${pct(base)} base rate, so this run cannot tell the lift from luck.`);
  }

  const ruleWins = rulePicks.filter(won).length;
  if (rulePicks.length && ruleWins / rulePicks.length > takeRate) {
    const shared = rulePicks.filter((result) => result.evaluation.wouldTake).length;
    lines.push(`A two-line rule on fields in the state (within 1.5% of the 20-day average, close in the top third of the bar) picks ${rulePicks.length} trades and ${ruleWins} of them won. The model took ${shared} of those ${rulePicks.length}. The outcomes were planted from those two fields, so the rule is the ceiling here, not a fair rival.`);
  }

  if (extended.ruleRight > extended.right) {
    lines.push(`The extended-entry call agrees with the planted label on ${extended.right} of ${graded.length} entries. Comparing the distance in the state with 1.5% agrees on ${extended.ruleRight}.`);
  }

  const echoed = graded.filter((result) => result.evaluation.setup === result.item.setupType).length;
  if (echoed === graded.length) lines.push(`The setup named equals the trader’s own label on all ${graded.length} trades. That label is in the state, so the answer is an echo and carries no information.`);

  const newsDays = graded.filter((result) => result.item.contextEvidence === 'NEWS_DAY');
  if (newsDays.length && !graded.some((result) => result.evaluation.context === 'NEWS_DAY')) {
    lines.push(`“News day” was never chosen, including on the ${newsDays.length} entries built as news days: nothing in the state says there was news.`);
  }
  return lines;
}

// Every row is the win rate of the trades a picker selects, the same measure as the headline.
function baselines({ graded, taken, takeRate, rulePicks, base, won }) {
  if (!graded.length) return undefined;
  const ruleWins = rulePicks.filter(won).length;
  return [
    { label: 'Jev', detail: `win rate of the ${taken.length} trades it would take again`, value: takeRate, model: true },
    { label: 'Rule: near the average, close in the top third', detail: `two lines over fields in the state; picks ${rulePicks.length} trades`, value: rulePicks.length ? ruleWins / rulePicks.length : 0 },
    { label: 'Take every trade', detail: 'the base win rate', value: base },
  ];
}

function metrics({ graded, taken, takeRate, matched, matrix }) {
  if (!graded.length) return undefined;
  const stats = matrixStats(matrix);
  const take = stats?.classes.find((entry) => entry.label === 'Win');
  return {
    headline: { label: 'Would-take-again win rate', value: takeRate, n: taken.length },
    accuracy: matched.length / graded.length,
    macroF1: stats?.macroF1 ?? null,
    precision: take?.precision ?? null,
    recall: take?.recall ?? null,
  };
}

/** Take or pass against what the trade went on to do: taking a winner and passing a loser are right. */
function takeOutcomes(graded, won) {
  const count = (outcome, took) => graded.filter((result) => won(result) === outcome && result.evaluation.wouldTake === took).length;
  return {
    title: 'Take or pass against the revealed outcome',
    rowLabel: 'what the trade went on to do',
    columnLabel: 'what the model would do at the entry bar',
    columns: ['Take', 'Pass'],
    rows: [
      { label: 'Win', cells: [{ predicted: 'TAKE', count: count(true, true), diagonal: true }, { predicted: 'PASS', count: count(true, false), diagonal: false }] },
      { label: 'Loss', cells: [{ predicted: 'TAKE', count: count(false, true), diagonal: false }, { predicted: 'PASS', count: count(false, false), diagonal: true }] },
    ],
  };
}

function actualFeatureGaps(graded, byItem) {
  const winRate = (rows) => rows.filter((r) => byItem.get(r.item.id).outcome === 'WIN').length / Math.max(rows.length, 1);
  const binaryGap = (test) => Math.abs(winRate(graded.filter(test)) - winRate(graded.filter((r) => !test(r))));
  const groupedGap = (read) => { const groups = Map.groupBy(graded, read); const rates = [...groups.values()].map(winRate); return Math.max(...rates) - Math.min(...rates); };
  return [
    { id: 'distance', label: 'Reveal · entry distance from moving average', gap: binaryGap((r) => byItem.get(r.item.id).extendedEntry), detail: 'Planted edge: extended versus not extended.' },
    { id: 'close-location', label: 'Reveal · entry bar closed in top third', gap: binaryGap((r) => byItem.get(r.item.id).topThirdClose), detail: 'Planted edge: top-third close versus the rest.' },
    { id: 'weekday-control', label: 'Control · day of week', gap: groupedGap((r) => r.item.dayOfWeek), detail: 'Not used to plant outcome.' },
    { id: 'round-control', label: 'Control · round-number entry', gap: binaryGap((r) => r.item.roundNumber), detail: 'Not used to plant outcome.' },
    { id: 'symbol-control', label: 'Control · symbol', gap: groupedGap((r) => r.item.symbol), detail: 'Not used to plant outcome.' },
  ];
}

/** Win rate by the trader's own setup label. A plain table: nothing here is a prediction. */
function setupOutcomes(graded, byItem) {
  return SETUPS.map((setup) => {
    const group = graded.filter((result) => result.item.setupType === setup);
    const wins = group.filter((result) => byItem.get(result.item.id).outcome === 'WIN').length;
    return { setup: title(setup), trades: group.length, wins, losses: group.length - wins, winRate: group.length ? pct(wins / group.length) : '–' };
  });
}

// #region demo:grade
/** Right means the take-or-pass call matches the hidden outcome: a winner taken, or a loser passed. */
const grade = {
  labelId: (label) => label.tradeId,
  judge: (result, label) => {
    if (!label) return null;
    const took = result.evaluation.wouldTake;
    const near = label.extendedEntry ? 'extended from its average' : 'near its average';
    const close = label.topThirdClose ? 'closed in the top third of its bar' : 'closed outside the top third of its bar';
    return {
      agree: took === (label.outcome === 'WIN'),
      expected: label.outcome === 'WIN' ? 'TAKE' : 'PASS',
      got: took ? 'TAKE' : 'PASS',
      note: `Revealed outcome: ${label.outcome.toLowerCase()}. Planted from two entry features: ${near}, ${close}.`,
      confidence: Math.max(result.answers.would_take_again.noul, 1 - result.answers.would_take_again.noul),
    };
  },
};
// #endregion

const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;

function qualityTone(value) {
  if (value >= 3.5) return 'good';
  return value >= 2 ? 'warn' : 'bad';
}

/** The entry read as a card. The outcome stays out of it: it is hidden until the report. */
function verdict(result) {
  const { answers, evaluation, item } = result;
  const take = answers.would_take_again.noul;
  const extended = answers.extended_entry.noul;
  return {
    eyebrow: 'Read at the entry bar, outcome hidden',
    headline: evaluation.wouldTake ? `Would take again · ${Math.round(take * 100)}%` : `Would pass · ${Math.round((1 - take) * 100)}%`,
    detail: `${title(item.setupType)} on ${item.symbol}, by the trader’s own label.`,
    facts: [
      { label: 'Entry quality', value: levelOf(answers.entry_quality), tone: qualityTone(evaluation.quality) },
      { label: 'Already extended', value: evaluation.extended ? `Yes · ${Math.round(extended * 100)}%` : `No · ${Math.round((1 - extended) * 100)}%`, tone: evaluation.extended ? 'warn' : 'good' },
      { label: 'Distance from the 20-day average', value: `${item.entryDistanceFromMaPercent.toFixed(2)}%` },
      { label: 'Close within the entry bar', value: `${Math.round(item.entryBarCloseLocation * 100)}% of the way up` },
      { label: 'Market context', value: title(evaluation.context) },
    ],
  };
}

const present = {
  number: 152,
  problem: {
    headline: 'Every trader has a theory about which entries work. Few have checked it against outcomes they could not see.',
    stat: '300',
    statLabel: 'entries read with the outcome hidden',
  },
  hero: {
    item: 'TF-237',
    caption: 'A PG breakout, read only up to its entry bar. The bar closed three quarters of the way up on 1.46× volume: entry quality 4.3 of 6, would take again at 65%. The hidden outcome was a win.',
  },
  answers: {
    caption: 'A grade for the entry, a yes or no on whether it is already extended, and whether to take it again.',
    reveal: ['entry_quality', 'extended_entry', 'would_take_again'],
  },
  miss: {
    item: 'TF-038',
    caption: 'An MSFT pullback entered 3.06% above its 20-day average. The data calls anything past 1.5% extended; the model did not, would take it at 57%, and it lost.',
  },
  proof: {
    kpis: ['Would-take-again win rate', 'Base win rate', 'Extended entry read right'],
    chart: 'baselines',
    closing: 'The 54 picks won 55.6% against a 44.3% base, but the 95% interval runs from 42% to 68%. A two-line rule on the same fields won 38 of 38.',
  },
};

export default {
  id: 'trade-feature-analysis', title: 'Trade feature analysis', domain: 'trades',
  value: 'Find which parts of a setup actually separate the winners from the losers, instead of guessing.',
  tags: ['trades', 'features', 'outcomes', 'real prices'], dataClass: 'mixed', readMinutes: 5, view: 'candles',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${title(item.setupType)} · ${item.entryDate}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/trade-feature-analysis.labels.json'),
  buildState, questions, evaluate, report, grade, verdict, present,
  caveat: 'The outcomes are planted from two numbers the state hands over, and a two-line rule on them picks 38 winners out of 38. The model’s 11-point lift over the base rate sits inside its own 95% interval, and the setup question only echoes the trader’s label.',
  explain: { data: 'scripts/generate/trade-feature-analysis.js#demo:data', state: 'demos/trade-feature-analysis/demo.js#demo:state', questions: 'demos/trade-feature-analysis/demo.js#demo:questions', evaluate: 'demos/trade-feature-analysis/demo.js#demo:evaluate' },
};
