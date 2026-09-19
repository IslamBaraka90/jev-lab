// Every fifty-over-two-hundred cross the rule found in the cached bars — not a sample, not a
// selection, all of them. The question is not whether the golden cross works. It is whether this one,
// on this chart, is worth the trade.
//
// There is no label anywhere. The report opens the bars that came after each cross, holds twenty
// sessions, applies the same cost to every approach it compares, and lets the price say who was
// right.

import { choice, noul, score } from '../lib/questions.js';

const CONTEXTS = ['ESTABLISHED_TREND', 'CHOP', 'POST_GAP', 'RANGE_BREAK', 'REVERSAL_RISK'];
const STOPS = ['BELOW_SLOW_MA', 'BELOW_SWING_LOW', 'ATR_BASED', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

// #region demo:state
/** The chart up to the cross bar and nothing after it, with the numbers a reader would work from. */
function buildState(item, context) {
  return {
    task: 'This cross happened. Decide whether it is worth taking, and say where the stop goes if it is.',
    rule_that_found_it: context.rule,
    instrument: item.symbol,
    cross_date: item.date,
    at_the_cross: {
      close: item.close,
      fifty_day_average: item.fastMa,
      two_hundred_day_average: item.slowMa,
      gap_between_them_percent: item.gapPercent,
      fifty_day_slope_over_20_bars_percent: item.fastSlopePercent,
      two_hundred_day_slope_over_20_bars_percent: item.slowSlopePercent,
      price_above_the_slow_average_percent: item.priceAboveSlowPercent,
      sixty_day_range_as_percent_of_price: item.sixtyDayRangePercent,
      average_true_range_percent: item.averageTrueRangePercent,
      volume_against_its_sixty_day_average: item.volumeAgainstAverage,
      bars_since_this_instrument_last_crossed: item.barsSinceLastCross,
    },
    where_a_stop_could_go: item.stopLevels,
    daily_bars_up_to_and_including_the_cross: item.chart.bars.slice(0, item.chart.markIndex + 1),
    bar_format: 'date open high low close volume, volume in thousands',
    note: 'Nothing after the cross bar is here. What happened next is not knowable at this point and is not on this page.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  valid_signal: noul('Is this a real change of trend?', {
    yes: 'The averages crossed because the trend turned, not because a flat market wandered.',
    no: 'This is the arithmetic of two averages meeting in a market going nowhere.',
  }),
  context: choice('What is the chart doing around this cross?', {
    ESTABLISHED_TREND: 'The move was already under way and the cross is late confirmation.',
    CHOP: 'Price has been going sideways and the averages are tangled.',
    POST_GAP: 'A gap did most of the work and the averages are catching up to it.',
    RANGE_BREAK: 'Price has just left a range it had been held in.',
    REVERSAL_RISK: 'The cross is up, but the chart looks more like a top than a start.',
  }),
  signal_quality: score('How good is this particular signal?', [
    'Worthless', 'Very poor', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent',
  ]),
  decision: choice('Take it or leave it?', {
    TAKE: 'Worth the trade on what is visible here.',
    SKIP: 'Not this one.',
  }),
  stop_placement: choice('Where does the stop go?', {
    BELOW_SLOW_MA: 'Under the two-hundred-day average.',
    BELOW_SWING_LOW: 'Under the last swing low.',
    ATR_BASED: 'Two average true ranges below the entry.',
    NONE: 'No stop, because there is no trade.',
  }),
};
// #endregion

// #region demo:evaluate
/** One judgement of one cross, made with no sight of the bars that followed it. */
function evaluate(answers, item) {
  const take = answers.decision.choice === 'TAKE';
  return {
    valid: answers.valid_signal.noul >= 0.5,
    context: answers.context.choice,
    quality: answers.signal_quality.score,
    take,
    stop: answers.stop_placement.choice,
    confidence: answers.decision.confidence,
    label: `${item.symbol} · ${item.date} · ${take ? 'take' : 'skip'} · ${answers.signal_quality.score.toFixed(1)} of 6`,
  };
}
// #endregion

/** What the cross was actually followed by: entry at the cross close, out twenty sessions later. */
function outcome(item, cost) {
  const bars = item.chart.bars.map((line) => Number(String(line).split(' ')[4]));
  const entry = bars[item.chart.markIndex];
  const exit = bars.at(-1);
  return Number((((exit - entry) / entry) * 100 - cost).toFixed(3));
}

// #region demo:report
/** Taking every cross against taking only the kept ones, on the same bars and the same costs. */
function report(results, context = {}) {
  const cost = context.costPercentPerTrade ?? 0.1;
  const scored = results
    .filter((result) => result.evaluation)
    .map((result) => ({ ...result, outcome: outcome(result.item, cost) }))
    .sort((left, right) => left.item.date.localeCompare(right.item.date));
  const kept = scored.filter((result) => result.evaluation.take);

  return {
    note: `${scored.length} crossovers, every one the rule found in the cached bars. Each is entered at the cross close, held ${context.holdingPeriodBars ?? 20} sessions, and charged ${cost} per cent. ${context.note ?? ''}`,
    findings: findings(scored, kept),
    kpis: kpis(scored, kept),
    distribution: CONTEXTS
      .map((value) => ({ label: sentence(value), count: scored.filter((result) => result.evaluation.context === value).length, tone: value === 'CHOP' || value === 'REVERSAL_RISK' ? 'warn' : undefined }))
      .filter((entry) => entry.count),
    matrix: contextMatrix(scored),
    curve: qualityCurve(scored),
    equityCurve: equity(scored, kept),
    checks: checks(scored, kept),
    topItems: topItems(scored),
  };
}
// #endregion

function kpis(scored, kept) {
  const skipped = scored.filter((result) => !result.evaluation.take);
  const allReturn = total(scored);
  const keptReturn = total(kept);
  const winners = (list) => list.filter((result) => result.outcome > 0).length;
  const invalid = scored.filter((result) => !result.evaluation.valid);
  // Three is the middle of the nought-to-six scale, not a number found by looking at the outcomes.
  // Picking the threshold that happens to pay best is the error this whole demo exists to warn about.
  const byScore = scored.filter((result) => result.evaluation.quality >= MIDPOINT);

  return [
    { label: 'Taking every cross', value: percent(allReturn), context: `${scored.length} trades, ${winners(scored)} of them up after twenty sessions`, tone: allReturn > 0 ? 'good' : 'warn' },
    { label: 'Taking only the kept ones', value: percent(keptReturn), context: `${kept.length} trades, ${winners(kept)} of them up`, tone: keptReturn > allReturn ? 'good' : 'warn' },
    { label: 'What the filter was worth', value: percent(keptReturn - allReturn), context: 'the difference between the two, on the same bars with the same costs', tone: keptReturn > allReturn ? 'good' : 'warn' },
    { label: 'Average trade, kept against all', value: `${percent(average(kept.map((result) => result.outcome)))} against ${percent(average(scored.map((result) => result.outcome)))}`, context: 'per trade, which is the fairer comparison when the counts differ' },
    { label: 'Filtering on the score instead', value: percent(total(byScore)), context: `${byScore.length} trades graded ${MIDPOINT} or better, averaging ${percent(average(byScore.map((result) => result.outcome)))} against ${percent(average(kept.map((result) => result.outcome)))} for the ones it chose to take`, tone: total(byScore) > total(kept) ? 'good' : 'warn' },
    { label: 'Crosses skipped', value: `${skipped.length} of ${scored.length}`, context: `${skipped.filter((result) => result.outcome < 0).length} of those would have lost money` },
    { label: 'Called an artefact', value: `${invalid.length} of ${scored.length}`, context: `averaging ${percent(average(invalid.map((result) => result.outcome)))} against ${percent(average(scored.filter((result) => result.evaluation.valid).map((result) => result.outcome)))} for the ones called real` },
  ];
}

const MIDPOINT = 3;

const total = (list) => list.reduce((sum, result) => sum + result.outcome, 0);

function checks(scored, kept) {
  const missed = scored.filter((result) => !result.evaluation.take && result.outcome > 4);
  const bad = kept.filter((result) => result.outcome < -4);
  const noStop = kept.filter((result) => result.evaluation.stop === 'NONE');
  const stopOnSkip = scored.filter((result) => !result.evaluation.take && result.evaluation.stop !== 'NONE');

  return [
    { id: 'missed', label: 'Skipped a cross that ran', detail: 'Left alone, and up more than four per cent twenty sessions later.', count: missed.length, of: scored.filter((result) => result.outcome > 4).length, items: missed.slice(0, 20).map((result) => result.item.id) },
    { id: 'bad', label: 'Took a cross that fell', detail: 'Taken, and down more than four per cent twenty sessions later.', count: bad.length, of: scored.filter((result) => result.outcome < -4).length, items: bad.slice(0, 20).map((result) => result.item.id) },
    { id: 'no-stop', label: 'Took the trade without a stop', detail: 'A decision to take with no stop rule named.', count: noStop.length, of: kept.length, items: noStop.slice(0, 20).map((result) => result.item.id) },
    { id: 'stop-on-skip', label: 'Named a stop for a trade it was not taking', detail: 'A skip with a stop placement other than none.', count: stopOnSkip.length, of: scored.length - kept.length, items: stopOnSkip.slice(0, 20).map((result) => result.item.id) },
  ];
}

function contextMatrix(scored) {
  const buckets = [
    ['Fell over 4%', (value) => value <= -4],
    ['Flat', (value) => value > -4 && value < 4],
    ['Rose over 4%', (value) => value >= 4],
  ];
  return {
    title: 'What the chart was called against what the next twenty sessions did',
    columns: CONTEXTS.map(sentence),
    rows: buckets.map(([label, test]) => ({
      label,
      cells: CONTEXTS.map((value) => ({
        predicted: value,
        count: scored.filter((result) => test(result.outcome) && result.evaluation.context === value).length,
        diagonal: false,
      })),
    })),
  };
}

/** Does a higher quality score really mean a better chance of the trade working? */
function qualityCurve(scored) {
  const winners = scored.filter((result) => result.outcome > 0);
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = scored.filter((result) => result.evaluation.quality >= bar);
    const up = at.filter((result) => result.outcome > 0);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: up.length, rate: at.length ? Number((up.length / at.length).toFixed(3)) : null };
  });
  return { title: 'Signal quality against what the trade did', xLabel: 'Crosses graded this good or better', yLabel: 'Of those, the ones that made money', rateLabel: 'Share that did', of: winners.length, points };
}

/** Both curves off the same trades in date order: one takes everything, one takes what was kept. */
function equity(scored, kept) {
  const keptIds = new Set(kept.map((result) => result.item.id));
  let all = 10_000;
  let filtered = 10_000;

  const points = scored.map((result) => {
    all *= 1 + result.outcome / 100;
    if (keptIds.has(result.item.id)) filtered *= 1 + result.outcome / 100;
    return {
      id: result.item.id,
      label: `${result.item.date} · ${result.item.symbol}`,
      value: Math.round(all),
      compare: Math.round(filtered),
      flagged: keptIds.has(result.item.id),
      pattern: `${keptIds.has(result.item.id) ? 'taken' : 'skipped'} · ${percent(result.outcome)}`,
    };
  });

  return { title: 'Ten thousand through every cross, against ten thousand through the kept ones', seriesLabel: 'Every cross', compareLabel: 'Only the kept ones', points };
}

function findings(scored, kept) {
  const lines = [];
  const allReturn = total(scored);
  const keptReturn = total(kept);
  const perTrade = average(kept.map((result) => result.outcome)) - average(scored.map((result) => result.outcome));

  if (!kept.length) {
    lines.push('Every cross was skipped, so there is no filtered curve to compare. A filter that never takes anything cannot lose money and cannot make any either.');
  } else if (Math.abs(perTrade) < 0.2) {
    lines.push(`The kept trades averaged ${percent(average(kept.map((result) => result.outcome)))} against ${percent(average(scored.map((result) => result.outcome)))} for all of them. On this evidence the judgement added nothing to the rule, which is worth knowing and is not what anybody wants to hear.`);
  } else {
    lines.push(`The kept trades averaged ${perTrade > 0 ? 'better' : 'worse'} than the full set by ${Math.abs(perTrade).toFixed(2)} points a trade${keptReturn > allReturn ? '' : ', and taking fewer of them still came out behind in total'}.`);
  }

  const byScore = scored.filter((result) => result.evaluation.quality >= MIDPOINT);
  if (kept.length && byScore.length && average(byScore.map((result) => result.outcome)) > average(kept.map((result) => result.outcome)) + 0.15) {
    lines.push(`Filtering on the quality score at the middle of its own scale beat the take-or-leave answer: ${percent(average(byScore.map((result) => result.outcome)))} a trade against ${percent(average(kept.map((result) => result.outcome)))}. The score knew something the decision threw away. The threshold is the midpoint of the scale and not one chosen by looking at these results, which would be the very mistake this page is about.`);
  }

  const chop = scored.filter((result) => result.evaluation.context === 'CHOP');
  if (chop.length) lines.push(`${chop.length} crosses were read as a flat market bringing two averages together. Those averaged ${percent(average(chop.map((result) => result.outcome)))}, against ${percent(average(scored.filter((result) => result.evaluation.context !== 'CHOP').map((result) => result.outcome)))} for the rest.`);

  const missed = scored.filter((result) => !result.evaluation.take && result.outcome > 8);
  if (missed.length) lines.push(`${missed.length} skipped crosses ran more than eight per cent in the twenty sessions that followed: ${missed.slice(0, 4).map((result) => `${result.item.symbol} ${result.item.date}`).join(', ')}.`);
  return lines;
}

function topItems(scored) {
  return [...scored]
    .sort((left, right) => right.evaluation.quality - left.evaluation.quality || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: percent(result.outcome) }));
}

export default {
  id: 'golden-cross-review',
  title: 'Golden cross review',
  domain: 'strategy',
  value: 'Stop asking whether the strategy works. Ask whether this signal, on this chart, deserves the trade.',
  tags: ['strategy', 'prices', 'real data', 'signals'],
  dataClass: 'cached-real',
  readMinutes: 4,
  view: 'candles',
  itemLabel: (item) => `${item.symbol} · ${item.date}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'src/strategies/golden-cross.js#strategy:detector',
    state: 'demos/golden-cross-review/demo.js#demo:state',
    questions: 'demos/golden-cross-review/demo.js#demo:questions',
    evaluate: 'demos/golden-cross-review/demo.js#demo:evaluate',
  },
};
