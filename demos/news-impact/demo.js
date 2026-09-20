// A headline against the chart it landed on. Forty of the three hundred sit in front of a real move of
// six per cent or more; forty equally dramatic ones sit in front of nothing at all. Both sets are
// written from the same templates, so a reader working from the text alone must grade them the same.
// Whether the chart underneath changes that is the whole question this demo asks.
//
// Nothing after the headline day reaches the state. The bars that follow are on the page, revealed
// once the answer is in, and in the report.

import { matrixStats } from '../lib/metrics.js';
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
/** How the words were read, graded against what the template meant. What the price did next is
 *  shown beside it as context, because the text cannot know that and neither can a reader. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.headlineId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const group = (name) => graded.filter((result) => byItem.get(result.item.id).group === name);
  const matrix = intendedMatrix(graded, byItem);

  return {
    note: `Three hundred headlines. ${group('MOVED').length} landed in front of a real move, ${group('NOTHING').length} in front of nothing, and ${group('ROUTINE').length} are routine. ${context.note ?? ''}`,
    findings: findings(graded, byItem, group),
    kpis: kpis(graded, byItem, group),
    baselines: baselines(graded, byItem),
    metrics: metrics(graded, byItem, group, matrix),
    distribution: distribution(graded),
    distributionTitle: 'Direction called',
    matrix,
    curve: calibration(graded, byItem),
    alsoMeasured: alsoMeasured(graded, byItem),
    materialityByIntendedLevel: materialityByIntendedLevel(graded, byItem),
    priceOverTheNextFiveDays: priceAfterRows(graded, byItem),
    checks: checks(graded, byItem, group),
    topItems: topItems(graded, byItem),
    topItemsTitle: 'Misread headlines first, then the ones graded most material',
  };
}
// #endregion

const moved = (label) => Math.abs(label.actualMovePct) >= REAL_MOVE;
const directional = (label) => (label.actualMovePct >= 0 ? 'POSITIVE' : 'NEGATIVE');
const signed = (pct) => `${pct > 0 ? '+' : ''}${pct}%`;
const MATERIALITY_LEVELS = ['None', 'Trivial', 'Minor', 'Notable', 'Material', 'Major', 'Transformative'];
const readAsWritten = (result, label) => result.evaluation.direction === label.intendedDirection;

/** When a move of any size first showed up. Comparing the day against the month instead would only
 *  measure how a random walk spreads out, and would call almost everything a slow burn. */
function actualHorizon(label) {
  if (Math.abs(label.actualMoveSameDayPct) >= 3) return 'SAME_DAY';
  if (Math.abs(label.actualMovePct) >= REAL_MOVE) return 'DAYS';
  if (Math.abs(label.actualMove20Pct) >= 6) return 'WEEKS';
  return 'STRUCTURAL';
}

const BAD_NEWS = /\b(cuts|loses|misses|steps down|regulatory review)\b/i;
const GOOD_NEWS = /\b(raises?|signs|appoints|ahead of|clears)\b/i;

/** The rule: bad-news verbs in the headline mean negative, good-news verbs mean positive, anything else neutral. */
function keywordDirection(headline) {
  if (BAD_NEWS.test(headline)) return 'NEGATIVE';
  if (GOOD_NEWS.test(headline)) return 'POSITIVE';
  return 'NEUTRAL';
}

/** Share of real-move and no-move pairs in which the real move was graded higher. A half is a text
 *  that cannot tell them apart, which is what identical wording should give. */
function pairedShare(bigOnes, duds) {
  if (!bigOnes.length || !duds.length) return null;
  let wins = 0;
  for (const big of bigOnes) {
    for (const dud of duds) {
      if (big.evaluation.materiality > dud.evaluation.materiality) wins += 1;
      else if (big.evaluation.materiality === dud.evaluation.materiality) wins += 0.5;
    }
  }
  return wins / (bigOnes.length * duds.length);
}

function groupGaps(group) {
  const bigOnes = group('MOVED');
  const duds = group('NOTHING');
  const dramatic = [...bigOnes, ...duds];
  const grade = (list) => average(list.map((result) => result.evaluation.materiality));
  return {
    gap: grade(bigOnes) - grade(duds),
    separation: grade(dramatic) - grade(group('ROUTINE')),
    pairedShare: pairedShare(bigOnes, duds),
  };
}

function kpis(graded, byItem, group) {
  const { gap, separation } = groupGaps(group);
  const asWritten = graded.filter((result) => readAsWritten(result, byItem.get(result.item.id)));
  const acted = graded.filter((result) => result.evaluation.tradeable);
  const actedWell = acted.filter((result) => moved(byItem.get(result.item.id)));
  const everyone = graded.filter((result) => moved(byItem.get(result.item.id)));
  const beatsActingOnAll = acted.length > 0 && actedWell.length / acted.length > everyone.length / graded.length;

  return [
    { label: 'Direction read as written', value: `${asWritten.length} of ${graded.length}`, context: 'positive, negative or no read, against what the template was written to say', tone: asWritten.length >= graded.length * 0.95 ? 'good' : 'warn' },
    { label: 'Big news told from small', value: separation.toFixed(1), context: 'how much more material the eighty dramatic headlines were graded than the routine ones', tone: separation > 1 ? 'good' : 'warn' },
    { label: 'Materiality gap, real move against none', value: gap.toFixed(1), context: 'the same wording, one set followed by a six per cent move and one by nothing; near zero is the pass, because the words are the same', tone: gap >= -0.5 ? 'good' : 'warn' },
    { label: 'Acted on', value: `${acted.length} of ${graded.length}`, context: `the rest were left alone; ${actedWell.length} of the ${acted.length} were followed by a move over four per cent` },
    { label: 'Hit rate when acting', value: `${actedWell.length} of ${acted.length}`, context: `${share(actedWell.length, acted.length)}, against ${share(everyone.length, graded.length)} if you acted on every headline; too few calls to read a rate from`, tone: beatsActingOnAll ? undefined : 'warn' },
  ];
}

/** The numbers that set the reading beside the market. None of them grades the model: the words do
 *  not know what the price does next. */
function alsoMeasured(graded, byItem) {
  const labelOf = (result) => byItem.get(result.item.id);
  const real = graded.filter((result) => Math.abs(labelOf(result).actualMovePct) >= 2);
  const called = real.filter((result) => ['POSITIVE', 'NEGATIVE'].includes(result.evaluation.direction));
  const rightWay = called.filter((result) => result.evaluation.direction === directional(labelOf(result)));
  const horizons = graded.filter((result) => result.evaluation.horizon === actualHorizon(labelOf(result)));
  const drifted = graded.filter((result) => Math.abs(labelOf(result).priorDriftPct) >= 3);
  const steady = graded.filter((result) => Math.abs(labelOf(result).priorDriftPct) < 3);
  const spotted = drifted.filter((result) => result.evaluation.alreadyPriced);
  const falseAlarms = steady.filter((result) => result.evaluation.alreadyPriced);

  return [
    { label: 'Direction called at all', value: `${called.length} of ${real.length}`, context: 'a positive or negative read, on headlines followed by a move of two per cent or more' },
    { label: 'Right when it called one', value: `${rightWay.length} of ${called.length}`, context: 'not a forecast: the dramatic headlines that moved were written to match the way the price went, so this mostly repeats the reading of the words' },
    { label: 'Pre-news drift noticed', value: `${spotted.length} of ${drifted.length}`, context: `charts that had moved three per cent in the week before; it also said yes on ${falseAlarms.length} of the ${steady.length} that had not` },
    { label: 'Horizon matched', value: `${horizons.length} of ${graded.length}`, context: 'when a move of any size first showed up; a price series barely records this, so read it as a description of the answers' },
  ];
}

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const intended = (result) => byItem.get(result.item.id).intendedDirection;
  const right = (pick) => graded.filter((result) => pick(result) === intended(result)).length;
  const model = right((result) => result.evaluation.direction);
  const rule = right((result) => keywordDirection(result.item.headline));
  const neutral = right(() => 'NEUTRAL');
  const row = (count) => ({ value: count / graded.length, display: `${count} of ${graded.length}` });

  return [
    { label: 'Jev', detail: 'direction read as the template intended', model: true, ...row(model) },
    { label: 'Rule: good-news and bad-news verbs', detail: 'two word lists over the headline, nothing else', ...row(rule) },
    { label: 'Always no directional read', detail: 'the commonest intended answer', ...row(neutral) },
  ];
}

function metrics(graded, byItem, group, matrix) {
  if (!graded.length) return undefined;
  const stats = matrixStats(matrix);
  const gaps = groupGaps(group);
  const asWritten = graded.filter((result) => readAsWritten(result, byItem.get(result.item.id)));
  const acted = graded.filter((result) => result.evaluation.tradeable);

  return {
    headline: { label: 'Direction read as written', value: asWritten.length / graded.length, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    materialitySeparation: Number(gaps.separation.toFixed(2)),
    materialityGapMovedAgainstNothing: Number(gaps.gap.toFixed(2)),
    // A ceiling, not a floor: well above a half would mean the future had leaked into the state.
    movedGradedAboveNothingShare: gaps.pairedShare === null ? null : Number(gaps.pairedShare.toFixed(3)),
    maxMaterialityUsed: Math.max(...graded.map((result) => result.evaluation.materiality)),
    actedOnRate: acted.length / graded.length,
  };
}

function checks(graded, byItem, group) {
  const dramatic = [...group('MOVED'), ...group('NOTHING')];
  const bar = average(dramatic.map((result) => result.evaluation.materiality));
  const missed = group('MOVED').filter((result) => result.evaluation.materiality < bar);
  const overGraded = group('NOTHING').filter((result) => result.evaluation.materiality >= bar);
  const misread = graded.filter((result) => !readAsWritten(result, byItem.get(result.item.id)));
  // Only the planted moves count here. A routine broker note followed by a jump is the market, not a misreading.
  const wrongWay = group('MOVED').filter((result) => ['POSITIVE', 'NEGATIVE'].includes(result.evaluation.direction) && result.evaluation.direction !== directional(byItem.get(result.item.id)));
  const routineRaised = group('ROUTINE').filter((result) => result.evaluation.materiality >= bar);
  const steady = graded.filter((result) => Math.abs(byItem.get(result.item.id).priorDriftPct) < 3);
  const pricedOnNothing = steady.filter((result) => result.evaluation.alreadyPriced);
  const ids = (list) => list.slice(0, 20).map((result) => result.item.id);

  return [
    { id: 'misread', label: 'Direction read differently from how the headline was written', detail: 'A routine notice given a direction, or a dramatic one given none.', count: misread.length, of: graded.length, items: ids(misread) },
    { id: 'missed', label: 'Real move graded below the average dramatic headline', detail: 'A six per cent move followed within the week, and this one was read as the quieter sort.', count: missed.length, of: group('MOVED').length, items: ids(missed) },
    { id: 'over', label: 'Nothing happened, graded above that average', detail: 'The same dramatic wording, followed by a move of one per cent or less.', count: overGraded.length, of: group('NOTHING').length, items: ids(overGraded) },
    { id: 'wrong-way', label: 'Direction called against a planted move', detail: 'One of the forty real moves, read the wrong way round.', count: wrongWay.length, of: group('MOVED').length, items: ids(wrongWay) },
    { id: 'routine', label: 'Routine headline graded as heavily as the dramatic ones', detail: 'Dividends declared, conference appearances, broker notes.', count: routineRaised.length, of: group('ROUTINE').length, items: ids(routineRaised) },
    { id: 'priced-on-nothing', label: 'Called already priced with no move in the week before', detail: 'The chart had moved less than three per cent before the headline, and the answer was still yes.', count: pricedOnNothing.length, of: steady.length, items: ids(pricedOnNothing) },
  ];
}

function distribution(graded) {
  return DIRECTIONS
    .map((direction) => ({ label: sentence(direction), count: graded.filter((result) => result.evaluation.direction === direction).length, tone: direction === 'NEUTRAL' ? 'good' : undefined }))
    .filter((entry) => entry.count);
}

/** What the template was written to say against what was read. Nothing is written as mixed, so that
 *  row is left out; the column stays, because the model could have chosen it. */
function intendedMatrix(graded, byItem) {
  const intended = DIRECTIONS.filter((direction) => graded.some((result) => byItem.get(result.item.id).intendedDirection === direction));
  return {
    title: 'Direction read against the direction the headline was written with',
    rowLabel: 'what the template was written to say',
    columnLabel: 'the direction the model read',
    columns: DIRECTIONS.map(sentence),
    rows: intended.map((truth) => ({
      label: sentence(truth),
      cells: DIRECTIONS.map((direction) => ({
        predicted: direction,
        count: graded.filter((result) => byItem.get(result.item.id).intendedDirection === truth && result.evaluation.direction === direction).length,
        diagonal: truth === direction,
      })),
    })),
  };
}

/** The direction called, set beside what the price went on to do. Context only: most of it is the
 *  market moving for reasons no headline here carries. */
function priceAfterRows(graded, byItem) {
  const buckets = [
    ['Fell over 4%', (label) => label.actualMovePct <= -REAL_MOVE],
    ['Fell a little', (label) => label.actualMovePct > -REAL_MOVE && label.actualMovePct < -1],
    ['Went nowhere', (label) => Math.abs(label.actualMovePct) <= 1],
    ['Rose a little', (label) => label.actualMovePct > 1 && label.actualMovePct < REAL_MOVE],
    ['Rose over 4%', (label) => label.actualMovePct >= REAL_MOVE],
  ];
  const count = (test, direction) => graded.filter((result) => test(byItem.get(result.item.id)) && result.evaluation.direction === direction).length;

  return buckets.map(([label, test]) => ({
    thePrice: label,
    readPositive: count(test, 'POSITIVE'),
    readNegative: count(test, 'NEGATIVE'),
    readMixed: count(test, 'MIXED'),
    noRead: count(test, 'NEUTRAL'),
  }));
}

/** Where on the scale each intended level landed. The rubric position is the finding: the top two
 *  intended levels come out at the same grade. */
function materialityByIntendedLevel(graded, byItem) {
  const levels = [...new Set(graded.map((result) => byItem.get(result.item.id).intendedMateriality))].sort((left, right) => left - right);
  return levels.map((level) => {
    const at = graded.filter((result) => byItem.get(result.item.id).intendedMateriality === level);
    return {
      writtenAs: `${MATERIALITY_LEVELS[level]} (${level} of 6)`,
      headlines: at.length,
      meanGraded: Number(average(at.map((result) => result.evaluation.materiality)).toFixed(2)),
    };
  });
}

/** As the materiality bar rises, does the share followed by a real move rise with it? With identical
 *  wording in front of moves and non-moves it should barely rise at all. */
function calibration(graded, byItem) {
  const real = graded.filter((result) => moved(byItem.get(result.item.id)));
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = graded.filter((result) => result.evaluation.materiality >= bar);
    const hits = at.filter((result) => moved(byItem.get(result.item.id)));
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: hits.length, rate: at.length ? Number((hits.length / at.length).toFixed(3)) : null };
  });
  return {
    title: 'Materiality against what actually followed',
    xLabel: 'Headlines graded at this materiality or above',
    yLabel: 'Followed by a move over four per cent',
    rateLabel: 'Share that were',
    of: real.length,
    thresholdFormat: 'level',
    levels: 6,
    defaultIndex: 3,
    points,
  };
}

function findings(graded, byItem, group) {
  const lines = [];
  if (!graded.length) return lines;
  const { gap } = groupGaps(group);

  if (Math.abs(gap) <= 0.5) {
    lines.push(`The forty headlines followed by a real move and the forty followed by nothing were graded within ${Math.abs(gap).toFixed(1)} of a point of each other. They are written from the same templates, so this is the demo working: the text does not know what happens next, and neither does anybody reading it.`);
  } else {
    lines.push(`Headlines followed by a real move were graded ${gap.toFixed(1)} points more material than the identically worded ones followed by nothing. Whatever separated them was in the chart, because it was not in the words.`);
  }

  const asWritten = graded.filter((result) => readAsWritten(result, byItem.get(result.item.id)));
  const byRule = graded.filter((result) => keywordDirection(result.item.headline) === byItem.get(result.item.id).intendedDirection);
  if (byRule.length >= asWritten.length) lines.push(`The direction was read as written on ${asWritten.length} of ${graded.length} headlines. Two lists of verbs get ${byRule.length} of ${graded.length}, so on these templates the direction is a reading exercise and the rule is at least as good.`);

  const top = Math.max(...graded.map((result) => result.evaluation.materiality));
  if (top < 4.5) lines.push(`Nothing in three hundred headlines was graded above ${top.toFixed(1)} of 6. The bottom two thirds of the scale is doing all the work, so read the gaps between groups rather than the numbers themselves.`);

  const levels = materialityByIntendedLevel(graded, byItem);
  const [second, first] = levels.slice(-2);
  if (levels.length >= 2 && first.meanGraded - second.meanGraded < 0.3) lines.push(`Headlines written as ${first.writtenAs} were graded ${first.meanGraded.toFixed(2)} on average and those written as ${second.writtenAs} were graded ${second.meanGraded.toFixed(2)}. The top two intended levels are not told apart.`);

  const declined = graded.filter((result) => result.evaluation.direction === 'NEUTRAL');
  if (declined.length >= 40) lines.push(`${declined.length} of ${graded.length} headlines got no directional read at all. That is the honest answer to most news, and ${graded.length - declined.length} were given a direction.`);
  if (!graded.some((result) => result.evaluation.direction === 'MIXED')) lines.push('Mixed went unused: no headline was read as cutting both ways.');

  const drifted = graded.filter((result) => Math.abs(byItem.get(result.item.id).priorDriftPct) >= 3);
  const steady = graded.filter((result) => Math.abs(byItem.get(result.item.id).priorDriftPct) < 3);
  const spotted = drifted.filter((result) => result.evaluation.alreadyPriced);
  const falseAlarms = steady.filter((result) => result.evaluation.alreadyPriced);
  if (drifted.length && steady.length) {
    const reading = falseAlarms.length / steady.length >= spotted.length / drifted.length ? 'The answer does not follow the bars, so it should not be used as a reading of the chart.' : 'The answer leans the way of the bars.';
    lines.push(`Already priced was answered yes on ${spotted.length} of ${drifted.length} headlines whose chart had moved three per cent in the week before (${share(spotted.length, drifted.length)}), and on ${falseAlarms.length} of the ${steady.length} whose chart had not (${share(falseAlarms.length, steady.length)}). ${reading}`);
  }

  const acted = graded.filter((result) => result.evaluation.tradeable);
  if (acted.length) {
    const hits = acted.filter((result) => moved(byItem.get(result.item.id))).length;
    const base = graded.filter((result) => moved(byItem.get(result.item.id))).length / graded.length;
    lines.push(`${acted.length} of ${graded.length} headlines were marked as something to act on, and ${hits} of those were followed by a move over four per cent, against ${Math.round(base * 100)} per cent for acting on all of them.${acted.length < 30 ? ' That is too few to call a hit rate.' : ''}`);
  }
  return lines;
}

function topItems(graded, byItem) {
  const row = (result) => ({
    id: result.item.id,
    label: result.evaluation.label,
    value: `${signed(byItem.get(result.item.id).actualMovePct)} in 5 days`,
  });
  const misread = graded.filter((result) => !readAsWritten(result, byItem.get(result.item.id)));
  const heaviest = graded
    .filter((result) => readAsWritten(result, byItem.get(result.item.id)))
    .sort((left, right) => right.evaluation.materiality - left.evaluation.materiality || right.evaluation.confidence - left.evaluation.confidence);
  return [...misread, ...heaviest].slice(0, 10).map(row);
}

// #region demo:grade
/** Right means the direction matches what the template was written to say. The move that followed
 *  is quoted in the note and never graded: nothing in the text could know it. */
const grade = {
  labelId: (label) => label.headlineId,
  judge: (result, label) => {
    if (!label) return null;
    const written = `${MATERIALITY_LEVELS[label.intendedMateriality].toLowerCase()}, ${readable(label.intendedDirection)}`;
    const planted = { MOVED: 'Planted in front of a real move. ', NOTHING: 'Planted in front of nothing. ', ROUTINE: '' }[label.group] ?? '';
    return {
      agree: readAsWritten(result, label),
      expected: label.intendedDirection,
      got: result.evaluation.direction,
      note: `${planted}Written as ${written}. The price then moved ${signed(label.actualMovePct)} in five days, which the text cannot know.`,
      confidence: result.answers.direction.confidence,
    };
  },
};
// #endregion

const yesNo = (answer) => `${answer.noul >= 0.5 ? 'Yes' : 'No'} · ${Math.round(answer.noul * 100)}%`;

// #region demo:verdict
function verdict(result) {
  const { answers, evaluation } = result;
  const level = MATERIALITY_LEVELS[Math.round(evaluation.materiality)];
  return {
    eyebrow: 'Read before anything that followed was known',
    headline: `${level} · ${evaluation.materiality.toFixed(1)} of 6 · ${evaluation.direction === 'NEUTRAL' ? 'no directional read' : readable(evaluation.direction)}`,
    detail: evaluation.tradeable ? 'Marked as something to act on today.' : 'Nothing to act on today.',
    facts: [
      { label: 'Materiality', value: `${level} · ${evaluation.materiality.toFixed(1)} of 6`, tone: evaluation.materiality >= 3 ? 'warn' : undefined },
      { label: 'Direction', value: `${sentence(evaluation.direction)} · ${Math.round(answers.direction.confidence * 100)}%` },
      { label: 'Horizon', value: `${sentence(evaluation.horizon)} · ${Math.round(answers.horizon.confidence * 100)}%` },
      { label: 'Market already moved on it', value: yesNo(answers.already_priced) },
      { label: 'Anything to act on today', value: yesNo(answers.tradeable_now), tone: evaluation.tradeable ? 'warn' : undefined },
    ],
  };
}
// #endregion

const CAVEAT = 'The headlines come from nineteen templates and each template carries its direction in its verb, so the direction score measures reading, not judgement; the comparison that matters here is the materiality gap between identical wording.';

const present = {
  number: 171,
  problem: {
    headline: 'The same dramatic headline lands in front of a seven per cent drop and in front of nothing.',
    stat: '300',
    statLabel: 'headlines, each read against the chart it landed on',
  },
  hero: {
    item: 'NW-0021',
    caption: 'Lantern Devices cuts full-year guidance. Graded 3.9 of 6 and negative, with only the bars up to that day; the price then fell 7.36% in five days.',
  },
  answers: {
    caption: 'Five answers from the words and the chart so far. The same sentence about Orchard Beverages (NW-0188) was graded 3.8, and that price moved 0.29%.',
    reveal: ['materiality', 'direction', 'already_priced', 'tradeable_now'],
  },
  miss: {
    item: 'NW-0065',
    caption: 'A regulator clears the main programme, written as major good news. It was graded 0.8 of 6 with no direction, and the price rose 6.44%.',
  },
  proof: {
    kpis: ['Big news told from small', 'Materiality gap, real move against none', 'Acted on'],
    chart: 'matrix',
    closing: 'Identical wording in front of a real move and in front of nothing was graded 0.1 of a point apart, and 293 of 300 headlines were left alone.',
  },
};

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
  grade,
  verdict,
  present,
  caveat: CAVEAT,
  explain: {
    data: 'scripts/generate/news-impact.js#demo:data',
    state: 'demos/news-impact/demo.js#demo:state',
    questions: 'demos/news-impact/demo.js#demo:questions',
    evaluate: 'demos/news-impact/demo.js#demo:evaluate',
  },
};
