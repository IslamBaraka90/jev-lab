// Post-trade review: two hundred and twenty closed trades on real price history, taken apart one at a
// time. Was there a plan, was the target ever reachable, was the stop honoured, and what is the lesson.
// The bars after the exit are not in the state: the review only sees what the trader saw.

import { choice, noul, score } from '../lib/questions.js';

const LESSONS = ['NO_STOP', 'TARGET_TOO_FAR', 'EXITED_EARLY', 'MOVED_STOP', 'CHASED_ENTRY', 'PLAN_FOLLOWED'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const share = (part, whole) => {
  if (!whole) return '–';
  const value = (part / whole) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

// #region demo:state
/** The plan as written, the fills as they happened, and the bars around them. */
function buildState(item, context) {
  return {
    task: 'Review this closed trade: whether it had a plan, whether the plan was possible, whether it was followed, and what to learn.',
    desk: { rules: context.rules, note: context.note },
    trade: {
      symbol: item.symbol,
      direction: item.direction,
      signal_date: item.signalDate,
      signal_price: item.signalPrice,
      bars_between_signal_and_entry: item.barsBetweenSignalAndEntry,
      entry_date: item.entryDate,
      entry_price: item.entryPrice,
      planned_stop: item.plannedStop,
      planned_target: item.plannedTarget,
      planned_horizon_bars: item.plannedHorizonBars,
      size_usd: item.sizeUsd,
    },
    what_happened: {
      exit_date: item.exitDate,
      exit_price: item.exitPrice,
      exit_reason: item.exitReason,
      bars_held: item.barsHeld,
      result_percent: item.resultPercent,
      stop_moves: item.stopMoves,
    },
    instrument: {
      average_daily_range_percent: item.averageDailyRangePercent,
      how_to_read_the_bars: 'One line per day: date, open, high, low, close, volume. The entry bar is the twenty-sixth.',
      daily_bars: item.chart.bars,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  plan_complete: noul('Was the plan complete before entry: direction, stop, target and holding period?', {
    yes: 'All four were written down before the trade was taken.',
    no: 'At least one of them is missing from the record.',
  }),
  target_realistic: noul('Could the target have been reached inside the planned horizon?', {
    yes: 'The instrument moves enough in a day for that target to be reachable in that many bars.',
    no: 'The target needed more than the instrument’s recent range could deliver in the time allowed.',
  }),
  stop_honoured: noul('Was the stop honoured as written?', {
    yes: 'It was not moved after entry, and it was respected if it was reached.',
    no: 'The stop was moved, ignored, or never there to honour.',
  }),
  exit_discipline: score('How disciplined was the exit?', [
    'Abandoned', 'Very poor', 'Poor', 'Acceptable', 'Good', 'Very good', 'Textbook',
  ]),
  lesson: choice('What is the lesson from this trade?', {
    NO_STOP: 'It was taken without a stop.',
    TARGET_TOO_FAR: 'The target was never reachable in the time allowed.',
    EXITED_EARLY: 'It was closed before either level was reached, for no recorded reason.',
    MOVED_STOP: 'The stop was moved after entry.',
    CHASED_ENTRY: 'The entry was taken late, well after the level that justified it.',
    PLAN_FOLLOWED: 'The plan was complete and it was followed. The result is not the lesson.',
  }),
  repeatable_setup: noul('Would this setup be worth taking again?', {
    yes: 'The idea and the levels were sound, whatever this one did.',
    no: 'Nothing here is worth repeating.',
  }),
};
// #endregion

// #region demo:evaluate
/** One trade's review: what was wrong with it, and how well it was closed. */
function evaluate(answers, item) {
  return {
    lesson: answers.lesson.choice,
    planComplete: answers.plan_complete.noul >= 0.5,
    targetRealistic: answers.target_realistic.noul >= 0.5,
    stopHonoured: answers.stop_honoured.noul >= 0.5,
    discipline: answers.exit_discipline.score,
    repeatable: answers.repeatable_setup.noul >= 0.5,
    confidence: answers.lesson.confidence,
    result: item.resultPercent,
    label: `${item.id} · ${item.symbol} ${item.direction.toLowerCase()} · ${percent(item.resultPercent)} · ${readable(answers.lesson.choice)}`,
  };
}
// #endregion

// #region demo:report
/** The lessons that repeat, and whether the review is reading the plan or the result. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.tradeId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const withFault = graded.filter((result) => byItem.get(result.item.id).lesson !== 'PLAN_FOLLOWED');
  const named = withFault.filter((result) => result.evaluation.lesson === byItem.get(result.item.id).lesson);
  const clean = graded.filter((result) => byItem.get(result.item.id).lesson === 'PLAN_FOLLOWED');

  return {
    note: `Two hundred and twenty closed trades on real price history, ${withFault.length} of them with something wrong with the plan. ${context.note ?? ''}`,
    findings: findings(graded, byItem, clean),
    kpis: kpis({ graded, withFault, named, clean, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, withFault),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

function kpis({ graded, withFault, named, clean, byItem }) {
  const planRight = graded.filter((result) => result.evaluation.planComplete === byItem.get(result.item.id).planComplete);
  const faultedClean = clean.filter((result) => result.evaluation.lesson !== 'PLAN_FOLLOWED');
  const winners = graded.filter((result) => result.item.resultPercent > 0);
  const losers = graded.filter((result) => result.item.resultPercent <= 0);
  const disciplineOnWinners = average(winners.map((result) => result.evaluation.discipline));
  const disciplineOnLosers = average(losers.map((result) => result.evaluation.discipline));

  return [
    { label: 'Lesson named exactly', value: `${named.length} of ${withFault.length}`, context: 'the fault the trade was built to carry', tone: named.length === withFault.length ? 'good' : 'warn' },
    { label: 'Well-run trades left alone', value: `${clean.length - faultedClean.length} of ${clean.length}`, context: faultedClean.length ? `${faultedClean.length} given a fault they did not have` : 'none given a fault', tone: faultedClean.length ? 'warn' : 'good' },
    { label: 'Plan completeness read right', value: share(planRight.length, graded.length), context: `${planRight.length} of ${graded.length} trades` },
    { label: 'Discipline on winners against losers', value: `${disciplineOnWinners.toFixed(1)} against ${disciplineOnLosers.toFixed(1)}`, context: 'a review that reads the result rather than the plan scores these far apart', tone: Math.abs(disciplineOnWinners - disciplineOnLosers) > 1.5 ? 'warn' : 'good' },
    { label: 'Setups worth repeating', value: `${graded.filter((result) => result.evaluation.repeatable).length} of ${graded.length}`, context: 'whatever this particular trade did' },
  ];
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function checks(graded, byItem, labels) {
  return LESSONS.filter((lesson) => lesson !== 'PLAN_FOLLOWED').map((lesson) => {
    const group = labels.filter((label) => label.lesson === lesson);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.tradeId);
      return !result || result.evaluation.lesson !== lesson;
    });
    return { id: lesson.toLowerCase().replaceAll('_', '-'), label: `${sentence(lesson)} not named`, detail: questions.lesson.criteria[lesson], count: missed.length, of: group.length, items: missed.slice(0, 20).map((label) => label.tradeId) };
  }).concat([{
    id: 'clean',
    label: 'Well-run trades given a fault',
    detail: 'A complete plan, a reachable target, a stop that stayed where it was put.',
    count: graded.filter((result) => byItem.get(result.item.id).lesson === 'PLAN_FOLLOWED' && result.evaluation.lesson !== 'PLAN_FOLLOWED').length,
    of: labels.filter((label) => label.lesson === 'PLAN_FOLLOWED').length,
    items: graded.filter((result) => byItem.get(result.item.id).lesson === 'PLAN_FOLLOWED' && result.evaluation.lesson !== 'PLAN_FOLLOWED').slice(0, 20).map((result) => result.item.id),
  }]);
}

function distribution(results) {
  return LESSONS
    .map((lesson) => ({ label: sentence(lesson), count: results.filter((result) => result.evaluation.lesson === lesson).length, tone: lesson === 'PLAN_FOLLOWED' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Lesson named against the fault the trade carries',
    columns: LESSONS.map(sentence),
    rows: LESSONS.map((actual) => ({
      label: sentence(actual),
      cells: LESSONS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).lesson === actual && result.evaluation.lesson === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, withFault) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const poor = graded.filter((result) => result.evaluation.discipline <= bar);
    const real = poor.filter((result) => byItem.get(result.item.id).lesson !== 'PLAN_FOLLOWED');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: poor.length, caught: real.length, rate: poor.length ? Number((real.length / poor.length).toFixed(3)) : null };
  });
  return { title: 'Reading the worst-run trades first', xLabel: 'Trades at this discipline score or below', yLabel: 'Trades with a real fault among them', rateLabel: 'Share of them that do', of: withFault.length, points };
}

function findings(graded, byItem, clean) {
  const lines = [];
  const wrong = graded.filter((result) => byItem.get(result.item.id).lesson !== result.evaluation.lesson);
  const groups = new Map();
  for (const result of wrong) {
    const key = `${byItem.get(result.item.id).lesson}|${result.evaluation.lesson}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const worst = [...groups].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 4) {
    const [actual, predicted] = worst[0].split('|');
    lines.push(`${worst[1]} of ${wrong.length} misread trades are the same swap: ${readable(actual)} reviewed as ${readable(predicted)}.`);
  }

  const winners = graded.filter((result) => result.item.resultPercent > 0);
  const losers = graded.filter((result) => result.item.resultPercent <= 0);
  const gap = average(winners.map((result) => result.evaluation.discipline)) - average(losers.map((result) => result.evaluation.discipline));
  if (Math.abs(gap) > 1.5) lines.push(`Discipline scores differ by ${gap.toFixed(1)} points between winners and losers. A review that grades the plan should not care which way the trade went.`);

  const faultedClean = clean.filter((result) => result.evaluation.lesson !== 'PLAN_FOLLOWED');
  if (faultedClean.length >= 4) lines.push(`${faultedClean.length} trades with a complete plan and a stop that stayed put were still given a fault. A trade that loses money after a good plan is a loss, not a lesson.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .sort((left, right) => left.evaluation.discipline - right.evaluation.discipline || left.item.resultPercent - right.item.resultPercent)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.lesson === result.evaluation.lesson ? ' · agrees' : ''}`,
      value: `${result.evaluation.discipline.toFixed(1)} of 6`,
    }));
}

export default {
  id: 'post-trade-review',
  title: 'Post-trade lesson review',
  domain: 'trades',
  value: 'Take a closed trade apart: was there a plan, was it possible, was it followed, and what is the lesson.',
  tags: ['trades', 'discipline', 'charts', 'real prices'],
  dataClass: 'mixed',
  readMinutes: 5,
  view: 'candles',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.symbol} ${item.direction.toLowerCase()} · ${percent(item.resultPercent)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/post-trade-review.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/post-trade-review.js#demo:data',
    state: 'demos/post-trade-review/demo.js#demo:state',
    questions: 'demos/post-trade-review/demo.js#demo:questions',
    evaluate: 'demos/post-trade-review/demo.js#demo:evaluate',
  },
};
