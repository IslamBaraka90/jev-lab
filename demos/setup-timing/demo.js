import { choice, noul, score } from '../lib/questions.js';

const SLOTS = ['MONDAY', 'MIDWEEK', 'FRIDAY', 'MONTH_START', 'MONTH_END', 'NO_PREFERENCE'];
const DIRECTIONS = ['LONG', 'SHORT', 'EITHER', 'NEITHER'];
const HOLDS = ['ONE_BAR', 'TWO_TO_THREE', 'FOUR_TO_FIVE', 'SIX_TO_EIGHT'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Judge whether this daily setup’s calendar timing helps or hurts, its preferred slot and direction, and an expected holding window. Use only bars through the setup; no intraday timing or later bars are available.',
    timeframe_note: context.timeframe, cache_coverage: context.coverage,
    instrument: { symbol: item.symbol, currency: item.currency },
    setup: { name: item.setup, direction_considered: item.direction, conditions: item.conditions, setup_date: item.setupDate },
    calendar_slot: item.calendar,
    typical_past_return_in_same_weekday_and_month_phase_percent: item.typicalPastSlotReturnPercent,
    candles_oldest_to_setup_bar: item.candleWindowThroughSetup,
  };
}
// #endregion

// #region demo:questions
const questions = {
  timing_favourable: noul('Is this setup’s daily calendar timing favourable for the stated direction?', { yes: 'The calendar and prior-only context help the setup.', no: 'The timing is neutral or harmful.' }),
  best_slot: choice('Which calendar slot is most favourable for this setup?', Object.fromEntries(SLOTS.map((key) => [key, title(key)]))),
  direction_bias: choice('Which direction does the timing favour?', Object.fromEntries(DIRECTIONS.map((key) => [key, title(key)]))),
  expected_hold: choice('Which daily holding window best fits the setup?', Object.fromEntries(HOLDS.map((key) => [key, title(key)]))),
  setup_quality: score('How strong is this setup in its supplied daily context?', ['Worthless', 'Very poor', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    timingFavourable: answers.timing_favourable.noul >= 0.5, bestSlot: answers.best_slot.choice,
    directionBias: answers.direction_bias.choice, expectedHold: answers.expected_hold.choice,
    quality: answers.setup_quality.score, confidence: answers.setup_quality.confidence,
    label: `${item.symbol} · ${title(item.setup)} · ${item.direction.toLowerCase()} · ${answers.setup_quality.score.toFixed(1)}/6`,
  };
}
// #endregion

function cellKey(item) { return `${item.symbol}:${item.direction}:${item.calendar.weekday}:${item.calendar.monthPhase}`; }

// #region demo:report
function report(results, context = {}) {
  const groups = new Map();
  for (const result of results) {
    const key = cellKey(result.item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }
  const cells = [...groups.entries()].map(([key, rows]) => {
    const [symbol, direction, weekday, monthPhase] = key.split(':');
    const realised = rows.reduce((sum, row) => sum + row.item.outcome.realisedFiveBarReturnPercent, 0) / rows.length;
    const expectedRate = rows.filter((row) => row.evaluation.timingFavourable).length / rows.length;
    return { key, symbol, direction, weekday, monthPhase, count: rows.length, sufficient: rows.length >= 20, expectedRate, realisedReturn: realised };
  });
  const sufficient = cells.filter((cell) => cell.sufficient);
  const favourableAccuracy = results.filter((result) => result.evaluation.timingFavourable === (result.item.outcome.realisedFiveBarReturnPercent > 0));
  const holdAgree = results.filter((result) => result.evaluation.expectedHold === result.item.outcome.bestHold);
  const directionRows = ['LONG', 'SHORT'].map((direction) => { const rows = results.filter((result) => result.item.direction === direction); return { direction, count: rows.length, averageReturn: rows.reduce((sum, row) => sum + row.item.outcome.realisedFiveBarReturnPercent, 0) / rows.length, favourableRate: rows.filter((row) => row.evaluation.timingFavourable).length / rows.length }; });
  return {
    note: `No intraday timing is used. ${context.timeframe} Forward returns are revealed only here, after each recorded answer.`,
    findings: sufficient.length ? sufficient.sort((a, b) => b.realisedReturn - a.realisedReturn).slice(0, 5).map((cell) => `${cell.symbol} ${cell.direction.toLowerCase()} · ${title(cell.weekday)} / ${title(cell.monthPhase)}: ${cell.realisedReturn.toFixed(2)}% average over ${cell.count} instances.`) : ['No instrument/direction weekday-by-month cell reaches 20 instances. That is the result: the cache cannot support a timing claim at this granularity.'],
    kpis: [
      { label: 'Real setup instances', value: String(results.length), context: 'four instruments · two readable detectors' },
      { label: 'Sufficient grid cells', value: `${sufficient.length} of ${cells.length}`, context: '20-instance minimum; all others greyed and excluded' },
      { label: 'Favourable-call accuracy', value: pct(favourableAccuracy.length, results.length), context: 'Jev expectation against signed five-bar return' },
      { label: 'Hold-window agreement', value: pct(holdAgree.length, results.length), context: 'answered window against best of 1, 3, 5 and 8 bars' },
      { label: 'Daily only', value: 'No intraday', context: 'time-of-day is explicitly out of scope' },
    ],
    timingGrid: { cells: cells.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.direction.localeCompare(b.direction) || a.weekday.localeCompare(b.weekday) || a.monthPhase.localeCompare(b.monthPhase)), directionRows },
    checks: [
      { id: 'timing', label: 'Favourable calls against five-bar sign', detail: 'This grades direction only; insufficient grid cells still remain excluded from claims.', count: results.length - favourableAccuracy.length, of: results.length, items: results.filter((result) => result.evaluation.timingFavourable !== (result.item.outcome.realisedFiveBarReturnPercent > 0)).map((result) => result.item.id) },
      { id: 'hold', label: 'Different best realised window', detail: 'Best is selected from signed returns at 1, 3, 5 and 8 bars.', count: results.length - holdAgree.length, of: results.length, items: results.filter((result) => result.evaluation.expectedHold !== result.item.outcome.bestHold).map((result) => result.item.id) },
    ],
    topItems: [...results].sort((a, b) => b.item.outcome.realisedFiveBarReturnPercent - a.item.outcome.realisedFiveBarReturnPercent).slice(0, 30).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.item.outcome.realisedFiveBarReturnPercent.toFixed(2)}%` })),
  };
}
// #endregion

export default {
  id: 'setup-timing', title: 'Setup timing', domain: 'strategy',
  value: 'Test when two daily setups work by weekday, month phase and direction without leaking a forward bar.',
  tags: ['strategy', 'timing', 'calendar', 'outcomes'], dataClass: 'cached-real', readMinutes: 6, view: 'timingGrid',
  itemLabel: (item) => `${item.symbol} · ${title(item.setup)} · ${item.direction.toLowerCase()} · ${item.setupDate}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'src/strategies/pullback.js', state: 'demos/setup-timing/demo.js#demo:state', questions: 'demos/setup-timing/demo.js#demo:questions', evaluate: 'demos/setup-timing/demo.js#demo:evaluate' },
};
