import { matrixStats } from '../lib/metrics.js';
import { choice, noul, rubricOf, score } from '../lib/questions.js';

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

const QUALITY_LEVELS = rubricOf(questions.setup_quality);
const fiveBar = (result) => result.item.outcome.realisedFiveBarReturnPercent;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

/** Right means the favourable call matched the sign of the five-bar return, signed for the direction. */
const calledRight = (result) => result.evaluation.timingFavourable === fiveBar(result) > 0;

/** Rule: call the timing favourable for every long setup and unfavourable for every short one. */
const ruleFavourable = (item) => item.direction === 'LONG';

/** Does the answer simply follow the sign of the past slot return that the state supplies? */
function followsSuppliedFigure(result) {
  const hint = result.item.typicalPastSlotReturnPercent * (result.item.direction === 'LONG' ? 1 : -1);
  return result.evaluation.timingFavourable === hint > 0;
}

/** The slots the question offers that this setup's own calendar position falls in. */
function ownSlots(item) {
  const { weekday, monthPhase } = item.calendar;
  const slots = [];
  if (weekday === 'MONDAY') slots.push('MONDAY');
  if (weekday === 'FRIDAY') slots.push('FRIDAY');
  if (['TUESDAY', 'WEDNESDAY', 'THURSDAY'].includes(weekday)) slots.push('MIDWEEK');
  if (monthPhase === 'START') slots.push('MONTH_START');
  if (monthPhase === 'END') slots.push('MONTH_END');
  return slots;
}

/** Standard error of the difference between two group means. */
function differenceError(left, right) {
  const variance = (values) => {
    const mean = average(values);
    return values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0;
  };
  if (!left.length || !right.length) return 0;
  return Math.sqrt(variance(left) / left.length + variance(right) / right.length);
}

/** No label exists, so the favourable call is graded against the sign of the realised five-bar return. */
function judge(result) {
  if (!result.evaluation) return null;
  const noulValue = result.answers.timing_favourable.noul;
  const made = fiveBar(result);
  return {
    agree: calledRight(result),
    expected: made > 0 ? 'FAVOURABLE' : 'NOT_FAVOURABLE',
    got: result.evaluation.timingFavourable ? 'FAVOURABLE' : 'NOT_FAVOURABLE',
    note: `Graded against the price, not a label: the next five bars returned ${signed(made)} for a ${result.item.direction.toLowerCase()} setup. A single setup is mostly noise.`,
    confidence: Math.max(noulValue, 1 - noulValue),
  };
}

function verdict(result) {
  const { item, evaluation, answers } = result;
  const made = fiveBar(result);
  const echoed = ownSlots(item).includes(evaluation.bestSlot);
  return {
    eyebrow: 'The timing call on this setup',
    headline: `${evaluation.timingFavourable ? 'Favourable' : 'Not favourable'} for the ${item.direction.toLowerCase()} · ${Math.round(answers.timing_favourable.noul * 100)}%`,
    detail: `${title(item.setup)} on ${item.symbol}, a ${title(item.calendar.weekday)} at the ${item.calendar.monthPhase.toLowerCase()} of the month.`,
    facts: [
      { label: 'Setup quality', value: `${QUALITY_LEVELS[Math.round(evaluation.quality)]} · ${evaluation.quality.toFixed(1)} of 6` },
      { label: 'Past return for this slot, as supplied', value: signed(item.typicalPastSlotReturnPercent), tone: followsSuppliedFigure(result) ? 'warn' : undefined },
      { label: 'Best slot named', value: `${title(evaluation.bestSlot)}${echoed ? ' · the setup’s own slot' : ''}`, tone: echoed ? 'warn' : undefined },
      { label: 'Expected hold', value: `${title(evaluation.expectedHold)} bars` },
      { label: 'Next five bars, signed for the direction', value: signed(made), tone: calledRight(result) ? 'good' : 'bad' },
    ],
  };
}

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
  const tally = summarise(results, cells);
  const matrix = callMatrix(results);

  return {
    note: `No intraday timing is used. ${context.timeframe} Forward returns are revealed only here, after each recorded answer, and are signed for the setup’s direction, so a short that fell counts as a gain.`,
    findings: findings(results, tally),
    kpis: kpis(results, tally),
    baselines: baselines(results, tally),
    metrics: metrics(results, tally, matrix),
    matrix,
    timingGrid: { cells: cells.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.direction.localeCompare(b.direction) || a.weekday.localeCompare(b.weekday) || a.monthPhase.localeCompare(b.monthPhase)), directionRows: tally.directionRows },
    checks: checks(results, tally),
    topItemsTitle: 'Highest-graded setups, with the five-bar return that followed',
    topItems: [...results].sort((a, b) => b.evaluation.quality - a.evaluation.quality).slice(0, 12).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: signed(fiveBar(result)) })),
  };
}
// #endregion

/** Every count the report sentences and tiles are built from, worked out once. */
function summarise(results, cells) {
  const sufficient = cells.filter((cell) => cell.sufficient);
  const right = results.filter(calledRight);
  const wrong = results.filter((result) => !calledRight(result));
  const ruleRight = results.filter((result) => ruleFavourable(result.item) === fiveBar(result) > 0);
  const up = results.filter((result) => fiveBar(result) > 0);
  const holdAgree = results.filter((result) => result.evaluation.expectedHold === result.item.outcome.bestHold);
  const holdMiss = results.filter((result) => result.evaluation.expectedHold !== result.item.outcome.bestHold);
  const favourable = results.filter((result) => result.evaluation.timingFavourable);
  const rest = results.filter((result) => !result.evaluation.timingFavourable);
  const gap = average(favourable.map(fiveBar)) - average(rest.map(fiveBar));
  const gapError = differenceError(favourable.map(fiveBar), rest.map(fiveBar));
  const followed = results.filter(followsSuppliedFigure);
  const named = results.filter((result) => result.evaluation.bestSlot !== 'NO_PREFERENCE');
  const echoed = named.filter((result) => ownSlots(result.item).includes(result.evaluation.bestSlot));
  const directionRows = ['LONG', 'SHORT'].map((direction) => { const rows = results.filter((result) => result.item.direction === direction); return { direction, count: rows.length, averageReturn: rows.reduce((sum, row) => sum + row.item.outcome.realisedFiveBarReturnPercent, 0) / rows.length, favourableRate: rows.filter((row) => row.evaluation.timingFavourable).length / rows.length }; });
  return { sufficient, cells, right, wrong, ruleRight, up, holdAgree, holdMiss, favourable, rest, gap, gapError, followed, named, echoed, directionRows };
}

function kpis(results, tally) {
  const { right, ruleRight, favourable, rest, gap, gapError, followed, sufficient, cells } = tally;
  return [
    { label: 'Favourable-call accuracy', value: pct(right.length, results.length), context: `${right.length} of ${results.length} against the signed five-bar return. “Favourable if long” scores ${pct(ruleRight.length, results.length)}; a coin 50%`, tone: right.length > ruleRight.length ? 'good' : 'warn' },
    { label: 'Favourable against the rest', value: `${signed(average(favourable.map(fiveBar)))} against ${signed(average(rest.map(fiveBar)))}`, context: `mean five-bar return over ${favourable.length} and ${rest.length} setups; the gap is ${gap.toFixed(2)} ± ${gapError.toFixed(2)} points` },
    { label: 'Answers that follow the supplied slot figure', value: `${followed.length} of ${results.length}`, context: `${pct(followed.length, results.length)} share the sign of a past slot return that came with the state`, tone: followed.length > results.length * 0.7 ? 'warn' : undefined },
    { label: 'Real setup instances', value: String(results.length), context: 'four instruments · two readable detectors · daily bars only, no intraday' },
    { label: 'Sufficient grid cells', value: `${sufficient.length} of ${cells.length}`, context: `20-instance minimum against ${(results.length / Math.max(cells.length, 1)).toFixed(1)} instances a cell: settled by the design before any answer` },
  ];
}

function baselines(results, tally) {
  const { right, ruleRight, up } = tally;
  if (!results.length) return undefined;
  return [
    { label: 'Jev', detail: `favourable call matches the five-bar sign, ${right.length} of ${results.length}`, value: right.length / results.length, model: true },
    { label: 'Rule: favourable if long, unfavourable if short', detail: `one line over the direction in the state, ${ruleRight.length} of ${results.length}`, value: ruleRight.length / results.length },
    { label: 'Always the commoner outcome', detail: up.length * 2 >= results.length ? 'always favourable' : 'always not favourable', value: Math.max(up.length, results.length - up.length) / results.length },
  ];
}

function metrics(results, tally, matrix) {
  const stats = matrixStats(matrix);
  return {
    headline: { label: 'Favourable-call accuracy', value: results.length ? tally.right.length / results.length : 0, n: results.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: stats?.classes[0]?.precision ?? null,
    recall: stats?.classes[0]?.recall ?? null,
  };
}

function checks(results, tally) {
  const { wrong, holdMiss, echoed, named } = tally;
  return [
    { id: 'timing', label: 'Favourable calls against five-bar sign', detail: 'This grades direction only; insufficient grid cells still remain excluded from claims.', count: wrong.length, of: results.length, items: wrong.slice(0, 20).map((result) => result.item.id) },
    { id: 'hold', label: 'Different best realised window', detail: 'Best is the largest signed return at 1, 3, 5 and 8 bars, which is mostly noise; chance is one in four.', count: holdMiss.length, of: results.length, items: holdMiss.slice(0, 20).map((result) => result.item.id) },
    { id: 'echo', label: 'Best slot named is the setup’s own slot', detail: 'One instance cannot say which slot is best, and the answer repeats the calendar slot in the state.', count: echoed.length, of: named.length, items: echoed.slice(0, 20).map((result) => result.item.id) },
  ];
}

/** What the run supports, led by the baselines it has to be read against. */
function findings(results, tally) {
  const { right, ruleRight, favourable, rest, gap, gapError, followed, holdAgree, named, echoed, sufficient, cells, directionRows } = tally;
  const lines = [];
  if (results.length) {
    const [longs, shorts] = directionRows;
    lines.push(right.length > ruleRight.length
      ? `The favourable call matched the five-bar sign on ${right.length} of ${results.length} setups (${pct(right.length, results.length)}), ahead of the rule “favourable if long, unfavourable if short” at ${pct(ruleRight.length, results.length)}.`
      : `The favourable call matched the five-bar sign on ${right.length} of ${results.length} setups (${pct(right.length, results.length)}). The rule “favourable if long, unfavourable if short” scores ${pct(ruleRight.length, results.length)} with no model at all. ${(longs.favourableRate * 100).toFixed(0)}% of longs and ${(shorts.favourableRate * 100).toFixed(0)}% of shorts were called favourable: mostly that rule, applied slightly worse.`);
    lines.push(`Setups called favourable averaged ${signed(average(favourable.map(fiveBar)))} over five bars against ${signed(average(rest.map(fiveBar)))} for the rest. The gap of ${gap.toFixed(2)} points carries a standard error of ${gapError.toFixed(2)}, ${Math.abs(gap) > 2 * gapError ? 'more' : 'less'} than two of them: ${Math.abs(gap) > 2 * gapError ? 'worth a larger sample' : 'suggestive at most'}.`);
    lines.push(`${followed.length} of ${results.length} answers to the favourable question share the sign of the past slot return supplied in the state, a figure that can rest on as few as two earlier instances. The answer is largely that number read back.`);
    const commonest = Math.max(0, ...HOLDS.map((hold) => results.filter((result) => result.item.outcome.bestHold === hold).length));
    lines.push(`The hold-window answer matched the best realised window on ${holdAgree.length} of ${results.length} setups (${pct(holdAgree.length, results.length)}). Four windows make chance 25%, and always naming the commonest scores ${pct(commonest, results.length)}. The best window is the largest of four noisy returns, so it is not a gradeable target and is not a headline number here.`);
    if (named.length) lines.push(`Where a best slot was named it was the setup’s own slot in ${echoed.length} of ${named.length} cases. The answer echoes the state and is not graded.`);
  }
  lines.push(sufficient.length
    ? `${sufficient.length} of ${cells.length} cells reach 20 instances: ${[...sufficient].sort((a, b) => b.realisedReturn - a.realisedReturn).slice(0, 5).map((cell) => `${cell.symbol} ${cell.direction.toLowerCase()} · ${title(cell.weekday)} / ${title(cell.monthPhase)} ${signed(cell.realisedReturn)} over ${cell.count}`).join('; ')}.`
    : `No instrument/direction weekday-by-month cell reaches 20 instances, and none could: ${results.length} instances over ${cells.length} occupied cells is ${(results.length / Math.max(cells.length, 1)).toFixed(1)} a cell. That follows from the design and says nothing about the market. The cache cannot support a timing claim at this granularity.`);
  return lines;
}

/** The favourable call against what the next five bars did. The diagonal is the headline's "right". */
function callMatrix(results) {
  const rows = [
    ['Made money over five bars', (result) => fiveBar(result) > 0],
    ['Lost money over five bars', (result) => fiveBar(result) <= 0],
  ];
  const columns = [
    ['Favourable', (result) => result.evaluation.timingFavourable],
    ['Not favourable', (result) => !result.evaluation.timingFavourable],
  ];
  return {
    title: 'Timing call against the signed five-bar return',
    rowLabel: 'what the next five bars did, signed for the direction',
    columnLabel: 'the timing call',
    columns: columns.map(([label]) => label),
    rows: rows.map(([label, happened], rowIndex) => ({
      label,
      cells: columns.map(([predicted, called], columnIndex) => {
        const items = results.filter((result) => happened(result) && called(result)).map((result) => result.item.id);
        return { predicted, count: items.length, diagonal: rowIndex === columnIndex, items };
      }),
    })),
  };
}

const PRESENT = {
  number: 182,
  problem: {
    headline: 'Everyone has a Monday theory. Six years of daily bars is what there is to test it with.',
    stat: '480',
    statLabel: 'real setups across four instruments, long and short',
  },
  hero: {
    item: 'ST-0059',
    caption: 'Bitcoin closes above its twenty-session high on 6 February 2021. Called favourable for the long at 64%, quality 4.5 of 6. The next five bars returned +22.01%.',
  },
  answers: {
    caption: 'Five answers from the bars up to the setup. Only the favourable call can be graded against the price; the best slot and the hold window cannot.',
    reveal: ['timing_favourable', 'setup_quality', 'best_slot', 'expected_hold'],
  },
  miss: {
    item: 'ST-0005',
    caption: 'NVDA breaks down on 28 October 2020. The slot’s past return in the state was −2.14%, the short was called favourable at 70%, and the next five bars went 9.18% against it.',
  },
  proof: {
    kpis: ['Favourable-call accuracy', 'Favourable against the rest', 'Sufficient grid cells'],
    chart: 'baselines',
    closing: '52.1% on 480 setups. A rule that says favourable if long scores 56.0%, and the page says so.',
  },
};

export default {
  id: 'setup-timing', title: 'Setup timing', domain: 'strategy',
  value: 'Test when two daily setups work by weekday, month phase and direction without leaking a forward bar.',
  tags: ['strategy', 'timing', 'calendar', 'outcomes'], dataClass: 'cached-real', readMinutes: 6, view: 'timingGrid',
  itemLabel: (item) => `${item.symbol} · ${title(item.setup)} · ${item.direction.toLowerCase()} · ${item.setupDate}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  caveat: 'Four hundred and eighty setups over 127 weekday-by-month cells cannot reach the 20-instance minimum in any cell, the best-slot and hold-window questions have no gradeable truth, and each state supplies a past slot return that the favourable answer follows four times in five.',
  grade: { judge }, verdict, present: PRESENT,
  explain: { data: 'src/strategies/pullback.js', state: 'demos/setup-timing/demo.js#demo:state', questions: 'demos/setup-timing/demo.js#demo:questions', evaluate: 'demos/setup-timing/demo.js#demo:evaluate' },
};
