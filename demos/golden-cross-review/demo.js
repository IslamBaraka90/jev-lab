// Every fifty-over-two-hundred cross the rule found in the cached bars — not a sample, not a
// selection, all of them. The question is not whether the golden cross works. It is whether this one,
// on this chart, is worth the trade.
//
// There is no label anywhere. The report opens the bars that came after each cross, holds twenty
// sessions, applies the same cost to every approach it compares, and lets the price say who was
// right.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, rubricOf, score } from '../lib/questions.js';

const CONTEXTS = ['ESTABLISHED_TREND', 'CHOP', 'POST_GAP', 'RANGE_BREAK', 'REVERSAL_RISK'];
const STOPS = ['BELOW_SLOW_MA', 'BELOW_SWING_LOW', 'ATR_BASED', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const share = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '–');

/** Sample standard deviation, so a difference in averages can be put beside its standard error. */
function spread(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

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

const STOP_FIELDS = { BELOW_SLOW_MA: 'belowSlowMa', BELOW_SWING_LOW: 'belowSwingLow', ATR_BASED: 'atrBased' };

/** The price the named stop sits at, or nothing when no stop was named. */
const stopLevel = (item, stop) => item.stopLevels?.[STOP_FIELDS[stop]] ?? Number.NEGATIVE_INFINITY;

const QUALITY_LEVELS = rubricOf(questions.signal_quality);
const levelOf = (value) => `${QUALITY_LEVELS[Math.round(value)] ?? 'Unscored'} · ${value.toFixed(1)} of 6`;

/**
 * No label exists, so an item is graded against the price: a take is right if the trade was up
 * twenty sessions later net of cost, a skip is right if it was not. The same rule as the headline.
 */
function judge(result, label, context = {}) {
  if (!result.evaluation) return null;
  const made = outcome(result.item, context.costPercentPerTrade ?? 0.1);
  const take = result.evaluation.take;
  return {
    agree: take === made > 0,
    expected: made > 0 ? 'TAKE' : 'SKIP',
    got: take ? 'TAKE' : 'SKIP',
    note: `Graded against the price, not a label: the next twenty sessions returned ${percent(made)} net of cost. One trade is mostly noise, so read the run and not the item.`,
    confidence: result.answers.decision.confidence,
  };
}

/** The decision as a trader would read it, with what the price then did. */
function verdict(result, context = {}) {
  const { evaluation, item, answers } = result;
  const made = outcome(item, context.costPercentPerTrade ?? 0.1);
  const level = stopLevel(item, evaluation.stop);
  const stopAboveEntry = evaluation.take && level >= item.close;
  const agreed = evaluation.take === made > 0;
  const facts = [
    { label: 'Real change of trend', value: `${evaluation.valid ? 'Yes' : 'No'} · ${Math.round(answers.valid_signal.noul * 100)}%` },
    { label: 'Chart read as', value: sentence(evaluation.context), tone: evaluation.context === 'CHOP' || evaluation.context === 'REVERSAL_RISK' ? 'warn' : undefined },
    { label: 'Signal quality', value: levelOf(evaluation.quality) },
    { label: 'Confidence in the decision', value: `${Math.round(evaluation.confidence * 100)}%` },
  ];
  if (evaluation.take) {
    facts.push({
      label: 'Stop',
      value: Number.isFinite(level) ? `${sentence(evaluation.stop)} · ${level.toFixed(2)}${stopAboveEntry ? `, above the ${item.close.toFixed(2)} entry` : ''}` : 'None named',
      tone: stopAboveEntry || !Number.isFinite(level) ? 'bad' : undefined,
    });
  }
  facts.push({ label: 'Next twenty sessions', value: `${percent(made)} net of cost`, tone: agreed ? 'good' : 'bad' });

  return {
    eyebrow: 'The call on this cross',
    headline: `${evaluation.take ? 'Take' : 'Skip'} · ${item.symbol} · ${item.date}`,
    detail: evaluation.take
      ? `Taken, and the trade ${made > 0 ? 'made' : 'lost'} money: the price ${agreed ? 'agreed' : 'disagreed'}.`
      : `Skipped, and the trade would have ${made > 0 ? 'made' : 'lost'} money: the price ${agreed ? 'agreed' : 'disagreed'}.`,
    facts,
  };
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
  const matrix = decisionMatrix(scored);
  const instruments = new Set(scored.map((result) => result.item.symbol)).size;

  return {
    note: `${scored.length} crossovers, every one the rule found in the cached bars. Each is entered at the cross close, held ${context.holdingPeriodBars ?? 20} sessions, and charged ${cost} per cent. Totals are sums of per-trade returns, not a portfolio return: the trades come from ${instruments} instruments and overlap in time. ${context.note ?? ''}`,
    findings: findings(scored, kept),
    kpis: kpis(scored, kept),
    baselines: baselines(scored),
    metrics: metrics(scored, kept, matrix),
    distributionTitle: 'What the chart was called',
    distribution: CONTEXTS
      .map((value) => ({ label: sentence(value), count: scored.filter((result) => result.evaluation.context === value).length, tone: value === 'CHOP' || value === 'REVERSAL_RISK' ? 'warn' : undefined }))
      .filter((entry) => entry.count),
    matrix,
    outcomeByContext: contextTable(scored),
    outcomeByInstrument: instrumentTable(scored),
    curve: qualityCurve(scored),
    equityCurve: equity(scored, kept),
    checks: checks(scored, kept),
    topItemsTitle: 'Best-graded crosses, with what each went on to do',
    topItems: topItems(scored),
  };
}
// #endregion

/** Right means the decision matched the price: taken and up, or skipped and not up, net of cost. */
const agreedWithPrice = (result) => result.evaluation.take === result.outcome > 0;

/** Rule: take the cross only when the two-hundred-day average is already rising. */
const ruleTakes = (item) => item.slowSlopePercent > 0;

/** The instrument whose trades add up to the most, in either direction. One name can own a total. */
function dominantInstrument(scored) {
  const sums = new Map();
  for (const result of scored) sums.set(result.item.symbol, (sums.get(result.item.symbol) ?? 0) + result.outcome);
  const ranked = [...sums.entries()].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
  const [symbol, sum] = ranked[0] ?? [null, 0];
  return { symbol, sum, count: scored.filter((result) => result.item.symbol === symbol).length };
}

/** Flat numbers for the scoreboard. Precision is the share of taken trades that made money. */
function metrics(scored, kept, matrix) {
  const stats = matrixStats(matrix);
  const agreed = scored.filter(agreedWithPrice);
  return {
    headline: { label: 'Decision agreed with price', value: scored.length ? agreed.length / scored.length : 0, n: scored.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: kept.length ? kept.filter((result) => result.outcome > 0).length / kept.length : null,
    recall: stats?.classes[0]?.recall ?? null,
  };
}

function baselines(scored) {
  if (!scored.length) return undefined;
  const rate = (list) => list.length / scored.length;
  const modelRight = scored.filter(agreedWithPrice);
  const ruleRight = scored.filter((result) => ruleTakes(result.item) === result.outcome > 0);
  const up = scored.filter((result) => result.outcome > 0);
  return [
    { label: 'Jev', detail: `take-or-skip agreed with the next twenty sessions, ${modelRight.length} of ${scored.length}`, value: rate(modelRight), model: true },
    { label: 'Rule: take it if the 200-day average is rising', detail: `one line over a field in the state, ${ruleRight.length} of ${scored.length}`, value: rate(ruleRight) },
    { label: 'Always take the cross', detail: `no judgement at all: ${up.length} of ${scored.length} were up`, value: rate(up) },
  ];
}

function kpis(scored, kept) {
  const skipped = scored.filter((result) => !result.evaluation.take);
  const allReturn = total(scored);
  const keptReturn = total(kept);
  const winners = (list) => list.filter((result) => result.outcome > 0).length;
  const invalid = scored.filter((result) => !result.evaluation.valid);
  // Three is the middle of the nought-to-six scale, not a number found by looking at the outcomes.
  // Picking the threshold that happens to pay best is the error this whole demo exists to warn about.
  const byScore = scored.filter((result) => result.evaluation.quality >= MIDPOINT);

  const agreed = scored.filter(agreedWithPrice);
  const outcomes = scored.map((result) => result.outcome);
  const standardError = scored.length ? spread(outcomes) / Math.sqrt(scored.length) : 0;
  const dominant = dominantInstrument(scored);
  const without = (list) => list.filter((result) => result.item.symbol !== dominant.symbol);
  const mean = (list) => percent(average(list.map((result) => result.outcome)));
  // The score only earns a good tone if it still beats taking everything with the biggest instrument removed.
  const scoreHolds = total(byScore) > total(kept)
    && average(without(byScore).map((result) => result.outcome)) > average(without(scored).map((result) => result.outcome));

  return [
    { label: 'Decision agreed with price', value: `${agreed.length} of ${scored.length}`, context: `${share(agreed.length, scored.length)}: taken and up, or skipped and not. Taking every cross is right ${share(winners(scored), scored.length)} of the time`, tone: agreed.length > winners(scored) ? 'good' : 'warn' },
    { label: 'Average trade, kept against all', value: `${mean(kept)} against ${mean(scored)}`, context: `per trade. One trade varies by ${spread(outcomes).toFixed(1)} points, so the average of ${scored.length} is only known to within ${standardError.toFixed(2)}` },
    { label: `Without ${dominant.symbol ?? 'the biggest instrument'}`, value: `${mean(without(kept))} against ${mean(without(scored))}`, context: `kept against all, per trade. ${dominant.count} ${dominant.symbol} trades add up to ${percent(dominant.sum)} in a book that totals ${percent(allReturn)}; graded ${MIDPOINT} or better averages ${mean(without(byScore))} without them`, tone: 'warn' },
    { label: 'Taking only the kept ones', value: percent(keptReturn), context: `sum of ${kept.length} trade returns, ${winners(kept)} of them up. Every cross: ${percent(allReturn)} over ${scored.length}, ${winners(scored)} up`, tone: keptReturn > allReturn ? 'good' : 'warn' },
    { label: 'What the filter was worth', value: percent(keptReturn - allReturn), context: 'the difference of two sums over different numbers of trades, on the same bars with the same costs. The per-trade figure is the fair one', tone: keptReturn > allReturn ? 'good' : 'warn' },
    { label: 'Filtering on the score instead', value: percent(total(byScore)), context: `${byScore.length} trades graded ${MIDPOINT} or better, averaging ${mean(byScore)} against ${mean(kept)} for the ones it chose to take; ${winners(byScore)} of ${byScore.length} were up`, tone: scoreHolds ? 'good' : 'warn' },
    { label: 'Crosses skipped', value: `${skipped.length} of ${scored.length}`, context: `${skipped.filter((result) => result.outcome < 0).length} of those would have lost money; ${invalid.length} crosses were called an artefact` },
  ];
}

const MIDPOINT = 3;

const total = (list) => list.reduce((sum, result) => sum + result.outcome, 0);

function checks(scored, kept) {
  const missed = scored.filter((result) => !result.evaluation.take && result.outcome > 4);
  const bad = kept.filter((result) => result.outcome < -4);
  const noStop = kept.filter((result) => result.evaluation.stop === 'NONE');
  const stopOnSkip = scored.filter((result) => !result.evaluation.take && result.evaluation.stop !== 'NONE');
  const stopAboveEntry = kept.filter((result) => stopLevel(result.item, result.evaluation.stop) >= result.item.close);

  return [
    { id: 'missed', label: 'Skipped a cross that ran', detail: 'Left alone, and up more than four per cent twenty sessions later.', count: missed.length, of: scored.filter((result) => result.outcome > 4).length, items: missed.slice(0, 20).map((result) => result.item.id) },
    { id: 'bad', label: 'Took a cross that fell', detail: 'Taken, and down more than four per cent twenty sessions later.', count: bad.length, of: scored.filter((result) => result.outcome < -4).length, items: bad.slice(0, 20).map((result) => result.item.id) },
    { id: 'no-stop', label: 'Took the trade without a stop', detail: 'A decision to take with no stop rule named.', count: noStop.length, of: kept.length, items: noStop.slice(0, 20).map((result) => result.item.id) },
    { id: 'stop-on-skip', label: 'Named a stop for a trade it was not taking', detail: 'A skip with a stop placement other than none.', count: stopOnSkip.length, of: scored.length - kept.length, items: stopOnSkip.slice(0, 20).map((result) => result.item.id) },
    { id: 'stop-above-entry', label: 'Chose a stop that sits above the entry', detail: 'The level offered was at or above the cross close, which no long trade can use as a stop.', count: stopAboveEntry.length, of: kept.length, items: stopAboveEntry.slice(0, 20).map((result) => result.item.id) },
  ];
}

/** Take or skip against whether the trade made money. The diagonal is what the headline counts as right. */
function decisionMatrix(scored) {
  const rows = [
    ['Up after twenty sessions', (result) => result.outcome > 0],
    ['Flat or down', (result) => result.outcome <= 0],
  ];
  const columns = [
    ['Take', (result) => result.evaluation.take],
    ['Skip', (result) => !result.evaluation.take],
  ];
  return {
    title: 'Take or skip, against what the next twenty sessions did',
    rowLabel: 'what the price did, net of cost',
    columnLabel: 'the decision made at the cross',
    columns: columns.map(([label]) => label),
    rows: rows.map(([label, happened], rowIndex) => ({
      label,
      cells: columns.map(([predicted, decided], columnIndex) => {
        const items = scored.filter((result) => happened(result) && decided(result)).map((result) => result.item.id);
        return { predicted, count: items.length, diagonal: rowIndex === columnIndex, items };
      }),
    })),
  };
}

/** What each reading of the chart went on to do. Small groups are shown with their size, not hidden. */
function contextTable(scored) {
  return CONTEXTS
    .map((value) => {
      const group = scored.filter((result) => result.evaluation.context === value);
      return {
        calledAs: sentence(value),
        averageOutcome: percent(average(group.map((result) => result.outcome))),
        up: `${group.filter((result) => result.outcome > 0).length} of ${group.length}`,
        crosses: group.length,
      };
    })
    .filter((row) => row.crosses);
}

/** The same book by instrument, because one name can own the total. */
function instrumentTable(scored) {
  const symbols = [...new Set(scored.map((result) => result.item.symbol))];
  return symbols
    .map((symbol) => {
      const group = scored.filter((result) => result.item.symbol === symbol);
      return {
        instrument: symbol,
        crosses: group.length,
        taken: group.filter((result) => result.evaluation.take).length,
        sumOfTradeReturnsPercent: Number(total(group).toFixed(2)),
      };
    })
    .sort((left, right) => Math.abs(right.sumOfTradeReturnsPercent) - Math.abs(left.sumOfTradeReturnsPercent));
}

/** Does a higher quality score really mean a better chance of the trade working? */
function qualityCurve(scored) {
  const winners = scored.filter((result) => result.outcome > 0);
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = scored.filter((result) => result.evaluation.quality >= bar);
    const up = at.filter((result) => result.outcome > 0);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: up.length, rate: at.length ? Number((up.length / at.length).toFixed(3)) : null };
  });
  return { title: 'Signal quality against what the trade did', xLabel: 'Crosses graded this good or better', yLabel: 'Of those, the ones that made money', rateLabel: 'Share that did', of: winners.length, thresholdFormat: 'level', levels: 6, defaultIndex: MIDPOINT, points };
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

  // The trades overlap in time across instruments, so this orders the results; it is not a portfolio.
  return { title: 'Ten thousand through every cross one after another, against the same through the kept ones', seriesLabel: 'Every cross', compareLabel: 'Only the kept ones', points };
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

  const outcomes = scored.map((result) => result.outcome);
  const standardError = scored.length ? spread(outcomes) / Math.sqrt(scored.length) : 0;
  if (kept.length && standardError > 0) {
    lines.push(`One trade here varies by ${spread(outcomes).toFixed(1)} points, so the average of ${scored.length} trades is only known to within ${standardError.toFixed(2)} points either way. Every per-trade difference on this page is smaller than that. None of them separates the judgement from chance.`);
  }

  const agreed = scored.filter(agreedWithPrice);
  const up = scored.filter((result) => result.outcome > 0);
  const ruleRight = scored.filter((result) => ruleTakes(result.item) === result.outcome > 0);
  if (kept.length && agreed.length <= up.length) {
    lines.push(`The take-or-skip answer agreed with the price on ${agreed.length} of ${scored.length} crosses. Taking every cross is right on ${up.length}, and one line of code (take it if the 200-day average is rising) on ${ruleRight.length}. The model did not beat either.`);
  }

  const byScore = scored.filter((result) => result.evaluation.quality >= MIDPOINT);
  const mean = (list) => percent(average(list.map((result) => result.outcome)));
  if (kept.length && byScore.length && average(byScore.map((result) => result.outcome)) > average(kept.map((result) => result.outcome)) + 0.15) {
    const dominant = dominantInstrument(scored);
    const without = (list) => list.filter((result) => result.item.symbol !== dominant.symbol);
    const holds = average(without(byScore).map((result) => result.outcome)) > average(without(scored).map((result) => result.outcome));
    lines.push(`Filtering on the quality score at the middle of its own scale came out ahead of the take-or-leave answer: ${mean(byScore)} a trade against ${mean(kept)}. The threshold is the midpoint of the scale and not one chosen by looking at these results, which would be the very mistake this page is about. ${holds
      ? `It still holds with ${dominant.symbol} removed: ${mean(without(byScore))} against ${mean(without(scored))} for every cross.`
      : `It does not survive removing one instrument: ${dominant.count} ${dominant.symbol} trades add up to ${percent(dominant.sum)}, and without them the same filter averages ${mean(without(byScore))} against ${mean(without(scored))} for taking everything. That is ${dominant.symbol}, not the score.`}`);
  }

  const chop = scored.filter((result) => result.evaluation.context === 'CHOP');
  if (chop.length) {
    const rest = scored.filter((result) => result.evaluation.context !== 'CHOP');
    const against = average(chop.map((result) => result.outcome)) > average(rest.map((result) => result.outcome));
    lines.push(`${chop.length} crosses were read as a flat market bringing two averages together. Those averaged ${mean(chop)}, against ${mean(rest)} for the rest${against ? `, which runs against the reading, on ${chop.length} trades` : ''}.`);
  }

  const badStops = kept.filter((result) => stopLevel(result.item, result.evaluation.stop) >= result.item.close);
  if (badStops.length) lines.push(`${badStops.length} taken trades were given a stop that sits at or above the entry price, because the 200-day average was still above the close at the cross. A long stop above the entry is not a stop: ${badStops.slice(0, 4).map((result) => result.item.id).join(', ')}.`);

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

const PRESENT = {
  number: 181,
  problem: {
    headline: 'The rule finds the cross. Somebody still has to decide whether this one deserves the trade.',
    stat: '71',
    statLabel: 'golden crosses in six years across 16 instruments',
  },
  hero: {
    item: 'GX-0042',
    caption: 'AAPL, 13 June 2024. Called an established trend, graded 4.5 of 6, taken. Twenty sessions later it was up 9.31% net of cost.',
  },
  answers: {
    caption: 'Five answers from the chart up to the cross bar and nothing after it: is it real, what is the chart doing, how good, take or skip, where the stop goes.',
    reveal: ['valid_signal', 'context', 'signal_quality', 'decision', 'stop_placement'],
  },
  miss: {
    item: 'GX-0009',
    caption: 'WMT, 19 April 2022. Also called an established trend and taken at 3.4 of 6. Twenty sessions later it was down 16.79%.',
  },
  proof: {
    kpis: ['Decision agreed with price', 'Average trade, kept against all', 'Without BTC-USD'],
    chart: 'baselines',
    closing: 'The take-or-skip call matched the price on 30 of 71 crosses. Taking every cross matched on 38, and the page says so.',
  },
};

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
  caveat: 'Seventy-one trades that each vary by seven points cannot separate a filter from chance, and the state carries real tickers and dates, so a model could be remembering what followed rather than reading the chart.',
  grade: { judge },
  verdict,
  present: PRESENT,
  explain: {
    data: 'src/strategies/golden-cross.js#strategy:detector',
    state: 'demos/golden-cross-review/demo.js#demo:state',
    questions: 'demos/golden-cross-review/demo.js#demo:questions',
    evaluate: 'demos/golden-cross-review/demo.js#demo:evaluate',
  },
};
