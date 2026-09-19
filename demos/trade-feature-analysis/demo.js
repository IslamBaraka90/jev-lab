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
  return {
    note: `Outcomes were hidden until this report. ${graded.length} trades over cached-real entry candles; the outcomes are synthetic. ${context.note ?? ''}`,
    findings: takeRate <= base ? [`“Would take again” did not beat the ${(base * 100).toFixed(1)}% base win rate; the report leaves that result unvarnished.`] : [],
    kpis: [
      { label: 'Base win rate', value: pct(base), context: `${winners.length} of ${graded.length}` },
      { label: 'Would-take-again win rate', value: pct(takeRate), context: `${taken.length} trades selected · ${(100 * (takeRate - base)).toFixed(1)} percentage points versus base`, tone: takeRate > base ? 'good' : 'warn' },
      { label: 'Winner entry quality', value: average(winners, (result) => result.evaluation.quality).toFixed(2), context: `losers ${average(losers, (result) => result.evaluation.quality).toFixed(2)}` },
      { label: 'Extended entries among winners', value: pct(rate(winners, (result) => result.evaluation.extended)), context: `losers ${pct(rate(losers, (result) => result.evaluation.extended))}` },
    ],
    analysisTitle: 'Jev answers split by revealed outcome, ranked by gap', analysisRows: edgeRows,
    distribution: Array.from({ length: 7 }, (_, bucket) => { const group = graded.filter((result) => Math.round(result.evaluation.quality) === bucket); return { label: `${bucket}/6 · ${questions.entry_quality.criteria[bucket]}`, count: group.length, detail: group.length ? `${pct(group.filter((result) => byItem.get(result.item.id).outcome === 'WIN').length / group.length)} win rate` : '' }; }).filter((entry) => entry.count),
    matrix: setupOutcomes(graded, byItem),
    checks: controls.map((entry) => ({ id: entry.id, label: entry.label, detail: entry.detail, count: Math.round(entry.gap * 100), of: 100, items: [] })),
    topItems: [...graded].sort((left, right) => right.evaluation.quality - left.evaluation.quality).slice(0, 10).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: byItem.get(result.item.id).outcome.toLowerCase() })),
  };
}
// #endregion

const average = (rows, read) => rows.length ? rows.reduce((sum, row) => sum + read(row), 0) / rows.length : 0;
const rate = (rows, test) => rows.length ? rows.filter(test).length / rows.length : 0;

function modelFeatureRows(winners, losers) {
  return [
    { feature: 'Entry quality (average)', winners: average(winners, (r) => r.evaluation.quality).toFixed(2), losers: average(losers, (r) => r.evaluation.quality).toFixed(2), gap: Math.abs(average(winners, (r) => r.evaluation.quality) - average(losers, (r) => r.evaluation.quality)) },
    { feature: 'Called extended', winners: pct(rate(winners, (r) => r.evaluation.extended)), losers: pct(rate(losers, (r) => r.evaluation.extended)), gap: Math.abs(rate(winners, (r) => r.evaluation.extended) - rate(losers, (r) => r.evaluation.extended)) },
    { feature: 'Would take again', winners: pct(rate(winners, (r) => r.evaluation.wouldTake)), losers: pct(rate(losers, (r) => r.evaluation.wouldTake)), gap: Math.abs(rate(winners, (r) => r.evaluation.wouldTake) - rate(losers, (r) => r.evaluation.wouldTake)) },
  ].sort((left, right) => right.gap - left.gap);
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

function setupOutcomes(graded, byItem) {
  return { title: 'Trader-labelled setup and revealed outcome', columns: ['Win', 'Loss'], rows: SETUPS.map((setup) => ({ label: title(setup), cells: ['WIN', 'LOSS'].map((outcome) => ({ predicted: outcome, count: graded.filter((result) => result.item.setupType === setup && byItem.get(result.item.id).outcome === outcome).length, diagonal: false })) })) };
}

export default {
  id: 'trade-feature-analysis', title: 'Trade feature analysis', domain: 'trades', status: 'pending-recording',
  value: 'Find which parts of a setup actually separate the winners from the losers, instead of guessing.',
  tags: ['trades', 'features', 'outcomes', 'real prices'], dataClass: 'mixed', readMinutes: 5, view: 'candles',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${title(item.setupType)} · ${item.entryDate}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/trade-feature-analysis.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/trade-feature-analysis.js#demo:data', state: 'demos/trade-feature-analysis/demo.js#demo:state', questions: 'demos/trade-feature-analysis/demo.js#demo:questions', evaluate: 'demos/trade-feature-analysis/demo.js#demo:evaluate' },
};
