// A headline against the chart it landed on. Forty of the three hundred sit in front of a real move of
// six per cent or more; forty equally dramatic ones sit in front of nothing at all. Both sets are
// written from the same templates, so a reader working from the text alone must grade them the same.
// Whether the chart underneath changes that is the whole question this demo asks.
//
// Nothing after the headline day reaches the state. The bars that follow are on the page, revealed
// once the answer is in, and in the report.

import { choice, noul, score } from '../lib/questions.js';

const DIRECTIONS = ['POSITIVE', 'NEGATIVE', 'MIXED', 'NEUTRAL'];
const HORIZONS = ['SAME_DAY', 'DAYS', 'WEEKS', 'STRUCTURAL'];
const REAL_MOVE = 4;

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

// #region demo:state
/** The story, and the chart up to the day it broke. Not one bar after it. */
function buildState(item, context) {
  const upToToday = item.chart.bars.slice(0, item.chart.markIndex + 1);
  return {
    task: 'Read this headline against the chart behind it and say whether it matters, which way, over what horizon, and whether the market already knew.',
    issuer: { ticker: item.ticker, company: item.company, sector: item.sector },
    date: item.date,
    headline: item.headline,
    body: item.body,
    last_three_headlines: item.priorHeadlines,
    close_on_the_day: item.close,
    daily_bars_up_to_and_including_today: upToToday,
    bar_format: 'date open high low close volume, volume in thousands',
    note: context.note,
  };
}
// #endregion

// #region demo:questions
const questions = {
  materiality: score('How much does this headline matter to the price?', [
    'None', 'Trivial', 'Minor', 'Notable', 'Material', 'Major', 'Transformative',
  ]),
  direction: choice('Which way, if it matters?', {
    POSITIVE: 'Good for the price.',
    NEGATIVE: 'Bad for the price.',
    MIXED: 'Real, but it cuts both ways.',
    NEUTRAL: 'No directional read at all.',
  }),
  horizon: choice('Over what horizon does it play out?', {
    SAME_DAY: 'It is in the price by the close.',
    DAYS: 'It works through over the next few days.',
    WEEKS: 'It takes weeks to show up.',
    STRUCTURAL: 'It changes what the business is worth, not what the price does this month.',
  }),
  already_priced: noul('Has the market already moved on this?', {
    yes: 'The bars before the headline already show it being discounted.',
    no: 'The chart gives no sign anybody knew.',
  }),
  tradeable_now: noul('Is there anything to act on today?', {
    yes: 'A position taken on this today would be taken on the news, not on hope.',
    no: 'Nothing here is worth acting on at this price.',
  }),
};
// #endregion

// #region demo:evaluate
/** One reading of one headline, before anything that followed it is known. */
function evaluate(answers, item) {
  return {
    materiality: answers.materiality.score,
    direction: answers.direction.choice,
    horizon: answers.horizon.choice,
    alreadyPriced: answers.already_priced.noul >= 0.5,
    tradeable: answers.tradeable_now.noul >= 0.5,
    confidence: answers.direction.confidence,
    label: `${item.ticker} · ${item.date} · ${answers.materiality.score.toFixed(1)} of 6 · ${readable(answers.direction.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Materiality against what the market actually did next, which is not the same as being right. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.headlineId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const group = (name) => graded.filter((result) => byItem.get(result.item.id).group === name);

  return {
    note: `Three hundred headlines. ${group('MOVED').length} landed in front of a real move, ${group('NOTHING').length} in front of nothing, and ${group('ROUTINE').length} are routine. ${context.note ?? ''}`,
    findings: findings(graded, byItem, group),
    kpis: kpis(graded, byItem, group),
    distribution: distribution(graded),
    matrix: directionMatrix(graded, byItem),
    curve: calibration(graded, byItem),
    checks: checks(graded, byItem, group),
    topItems: topItems(graded, byItem),
  };
}
// #endregion

const moved = (label) => Math.abs(label.actualMovePct) >= REAL_MOVE;
const directional = (label) => (label.actualMovePct >= 0 ? 'POSITIVE' : 'NEGATIVE');

/** When a move of any size first showed up. Comparing the day against the month instead would only
 *  measure how a random walk spreads out, and would call almost everything a slow burn. */
function actualHorizon(label) {
  if (Math.abs(label.actualMoveSameDayPct) >= 3) return 'SAME_DAY';
  if (Math.abs(label.actualMovePct) >= REAL_MOVE) return 'DAYS';
  if (Math.abs(label.actualMove20Pct) >= 6) return 'WEEKS';
  return 'STRUCTURAL';
}

function kpis(graded, byItem, group) {
  const bigOnes = group('MOVED');
  const duds = group('NOTHING');
  const gap = average(bigOnes.map((result) => result.evaluation.materiality)) - average(duds.map((result) => result.evaluation.materiality));
  const real = graded.filter((result) => Math.abs(byItem.get(result.item.id).actualMovePct) >= 2);
  const called = real.filter((result) => ['POSITIVE', 'NEGATIVE'].includes(result.evaluation.direction));
  const rightWay = called.filter((result) => result.evaluation.direction === directional(byItem.get(result.item.id)));
  const dramatic = [...group('MOVED'), ...group('NOTHING')];
  const routine = group('ROUTINE');
  const separation = average(dramatic.map((result) => result.evaluation.materiality)) - average(routine.map((result) => result.evaluation.materiality));
  const horizons = graded.filter((result) => result.evaluation.horizon === actualHorizon(byItem.get(result.item.id)));
  const drifted = graded.filter((result) => Math.abs(byItem.get(result.item.id).priorDriftPct) >= 3);
  const spotted = drifted.filter((result) => result.evaluation.alreadyPriced);
  const acted = graded.filter((result) => result.evaluation.tradeable);
  const actedWell = acted.filter((result) => moved(byItem.get(result.item.id)));

  return [
    { label: 'Big news told from small', value: separation.toFixed(1), context: 'how much more material the eighty dramatic headlines were graded than the routine ones', tone: separation > 1 ? 'good' : 'warn' },
    { label: 'Materiality gap, real move against none', value: gap.toFixed(1), context: 'the same wording, one set followed by a six per cent move and one by nothing', tone: gap > 0.5 ? 'good' : 'warn' },
    { label: 'Direction called at all', value: `${called.length} of ${real.length}`, context: 'a positive or negative read, on headlines followed by a move of two per cent or more' },
    { label: 'Right when it called one', value: `${rightWay.length} of ${called.length}`, context: 'declining to call a direction is not counted as getting it wrong', tone: called.length && rightWay.length > called.length * 0.6 ? 'good' : 'warn' },
    { label: 'Horizon matched', value: `${horizons.length} of ${graded.length}`, context: 'measured as when a move of any size first showed up: the day, the week, the month, or never' },
    { label: 'Pre-news drift noticed', value: `${spotted.length} of ${drifted.length}`, context: 'headlines whose chart had already moved three per cent in the week before' },
    { label: 'Acted on', value: `${acted.length} of ${graded.length}`, context: `${actedWell.length} of those were followed by a move worth acting on` },
    { label: 'Hit rate when acting', value: share(actedWell.length, acted.length), context: `against ${share(graded.filter((result) => moved(byItem.get(result.item.id))).length, graded.length)} if you acted on every headline`, tone: acted.length && actedWell.length / acted.length > graded.filter((result) => moved(byItem.get(result.item.id))).length / graded.length ? 'good' : 'warn' },
  ];
}

function checks(graded, byItem, group) {
  const dramatic = [...group('MOVED'), ...group('NOTHING')];
  const bar = average(dramatic.map((result) => result.evaluation.materiality));
  const missed = group('MOVED').filter((result) => result.evaluation.materiality < bar);
  const overGraded = group('NOTHING').filter((result) => result.evaluation.materiality >= bar);
  const wrongWay = graded.filter((result) => {
    const label = byItem.get(result.item.id);
    return moved(label) && ['POSITIVE', 'NEGATIVE'].includes(result.evaluation.direction) && result.evaluation.direction !== directional(label);
  });
  const routineRaised = group('ROUTINE').filter((result) => result.evaluation.materiality >= bar);

  return [
    { id: 'missed', label: 'Real move graded below the average dramatic headline', detail: 'A six per cent move followed within the week, and this one was read as the quieter sort.', count: missed.length, of: group('MOVED').length, items: missed.slice(0, 20).map((result) => result.item.id) },
    { id: 'over', label: 'Nothing happened, graded above that average', detail: 'The same dramatic wording, followed by a move of one per cent or less.', count: overGraded.length, of: group('NOTHING').length, items: overGraded.slice(0, 20).map((result) => result.item.id) },
    { id: 'wrong-way', label: 'Direction called against the move', detail: 'A real move, read the wrong way round.', count: wrongWay.length, of: graded.filter((result) => moved(byItem.get(result.item.id))).length, items: wrongWay.slice(0, 20).map((result) => result.item.id) },
    { id: 'routine', label: 'Routine headline graded as heavily as the dramatic ones', detail: 'Dividends declared, conference appearances, broker notes.', count: routineRaised.length, of: group('ROUTINE').length, items: routineRaised.slice(0, 20).map((result) => result.item.id) },
  ];
}

function distribution(graded) {
  return DIRECTIONS
    .map((direction) => ({ label: sentence(direction), count: graded.filter((result) => result.evaluation.direction === direction).length, tone: direction === 'NEUTRAL' ? 'good' : undefined }))
    .filter((entry) => entry.count);
}

function directionMatrix(graded, byItem) {
  const buckets = [
    ['Fell over 4%', (label) => label.actualMovePct <= -REAL_MOVE],
    ['Fell a little', (label) => label.actualMovePct > -REAL_MOVE && label.actualMovePct < -1],
    ['Went nowhere', (label) => Math.abs(label.actualMovePct) <= 1],
    ['Rose a little', (label) => label.actualMovePct > 1 && label.actualMovePct < REAL_MOVE],
    ['Rose over 4%', (label) => label.actualMovePct >= REAL_MOVE],
  ];

  return {
    title: 'Direction called against what the price did over the next five days',
    columns: DIRECTIONS.map(sentence),
    rows: buckets.map(([label, test]) => ({
      label,
      cells: DIRECTIONS.map((direction) => ({
        predicted: direction,
        count: graded.filter((result) => test(byItem.get(result.item.id)) && result.evaluation.direction === direction).length,
        diagonal: (label === 'Fell over 4%' && direction === 'NEGATIVE') || (label === 'Rose over 4%' && direction === 'POSITIVE') || (label === 'Went nowhere' && direction === 'NEUTRAL'),
      })),
    })),
  };
}

/** The calibration the brief asks for: as the materiality bar rises, does the hit rate rise with it? */
function calibration(graded, byItem) {
  const real = graded.filter((result) => moved(byItem.get(result.item.id)));
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = graded.filter((result) => result.evaluation.materiality >= bar);
    const hits = at.filter((result) => moved(byItem.get(result.item.id)));
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: hits.length, rate: at.length ? Number((hits.length / at.length).toFixed(3)) : null };
  });
  return { title: 'Materiality against what actually followed', xLabel: 'Headlines graded at this materiality or above', yLabel: 'Followed by a move over four per cent', rateLabel: 'Share that were', of: real.length, points };
}

function findings(graded, byItem, group) {
  const lines = [];
  const bigOnes = group('MOVED');
  const duds = group('NOTHING');
  const gap = average(bigOnes.map((result) => result.evaluation.materiality)) - average(duds.map((result) => result.evaluation.materiality));

  if (Math.abs(gap) <= 0.5) {
    lines.push(`The forty headlines followed by a real move and the forty followed by nothing were graded within ${Math.abs(gap).toFixed(1)} of a point of each other. They are written from the same templates, so this is the demo working: the text does not know what happens next, and neither does anybody reading it.`);
  } else {
    lines.push(`Headlines followed by a real move were graded ${gap.toFixed(1)} points more material than the identically worded ones followed by nothing. Whatever separated them was in the chart, because it was not in the words.`);
  }

  const top = Math.max(...graded.map((result) => result.evaluation.materiality));
  if (top < 4.5) lines.push(`Nothing in three hundred headlines was graded above ${top.toFixed(1)} of 6. The bottom two thirds of the scale is doing all the work, so read the gaps between groups rather than the numbers themselves.`);

  const declined = graded.filter((result) => result.evaluation.direction === 'NEUTRAL');
  if (declined.length >= 40) lines.push(`${declined.length} of ${graded.length} headlines got no directional read at all. That is the honest answer to most news, and it is why the direction score counts only the ones it committed to.`);

  const drifted = graded.filter((result) => Math.abs(byItem.get(result.item.id).priorDriftPct) >= 3);
  const spotted = drifted.filter((result) => result.evaluation.alreadyPriced);
  if (drifted.length) lines.push(`${spotted.length} of ${drifted.length} headlines whose chart had already moved three per cent in the week before were read as already priced. That one is answerable from the bars alone.`);

  const acted = graded.filter((result) => result.evaluation.tradeable);
  if (acted.length) {
    const rate = acted.filter((result) => moved(byItem.get(result.item.id))).length / acted.length;
    const base = graded.filter((result) => moved(byItem.get(result.item.id))).length / graded.length;
    lines.push(`Acting on every headline marked tradeable would have caught a real move ${Math.round(rate * 100)} per cent of the time, against ${Math.round(base * 100)} per cent for acting on all of them.`);
  }
  return lines;
}

function topItems(graded, byItem) {
  return [...graded]
    .sort((left, right) => right.evaluation.materiality - left.evaluation.materiality || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: result.evaluation.label,
      value: `${byItem.get(result.item.id).actualMovePct > 0 ? '+' : ''}${byItem.get(result.item.id).actualMovePct}% after`,
    }));
}

export default {
  id: 'news-impact',
  title: 'News impact',
  domain: 'news',
  value: 'Judge a headline against the chart it landed on: does it matter, which way, over what horizon, and did the market already know.',
  tags: ['news', 'prices', 'real data', 'calibration'],
  dataClass: 'mixed',
  readMinutes: 4,
  view: 'candles',
  itemLabel: (item) => `${item.ticker} · ${item.date} · ${item.headline}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/news-impact.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/news-impact.js#demo:data',
    state: 'demos/news-impact/demo.js#demo:state',
    questions: 'demos/news-impact/demo.js#demo:questions',
    evaluate: 'demos/news-impact/demo.js#demo:evaluate',
  },
};
