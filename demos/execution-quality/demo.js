// Execution quality: two hundred and sixty fills, each measured against the price its signal asked
// for. The state gives the bars, the intended price, the fill and the size — and no cost calculation,
// so the grade has to come from reading the fill rather than from a number somebody already worked out.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const CAUSES = ['GAP', 'CHASE', 'SIZE', 'SPREAD', 'CLEAN'];
const FIXES = ['EARLIER_ORDER', 'LIMIT_ORDER', 'SMALLER_SIZE', 'AVOID_SESSION', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const bps = (value) => `${Math.round(value)} bps`;
const usd = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value ?? 0);
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const value = (part / whole) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

// #region demo:state
/** The signal, the fill, and the ten bars either side. No cost: that is what is being asked for. */
function buildState(item, context) {
  return {
    task: 'Grade this fill against the price the signal asked for, say what caused the difference, and what would fix it.',
    desk: { sessions: context.sessions, how_slippage_is_counted: context.howSlippageIsCounted, note: context.note },
    order: {
      symbol: item.symbol,
      side: item.side,
      signal_date: item.signalDate,
      intended_price: item.intendedPrice,
      order_type: item.orderType,
      session: item.session,
      size_usd: item.sizeUsd,
      shares: item.shares,
      this_order_as_share_of_average_daily_volume_percent: item.shareOfAverageVolumePercent,
    },
    fill: {
      date: item.fillDate,
      price: item.fillPrice,
      bars_between_signal_and_fill: item.barsBetweenSignalAndFill,
    },
    daily_bars: item.chart.bars,
    how_to_read_the_bars: 'One line per day: date, open, high, low, close, volume. The signal bar is the eleventh.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  fill_quality: score('How good was this fill against what the signal asked for?', [
    'Unacceptable', 'Very poor', 'Poor', 'Fair', 'Good', 'Very good', 'Perfect',
  ]),
  cause: choice('What put the fill where it was?', {
    GAP: 'The market reopened past the level and the order filled where it could.',
    CHASE: 'The order went in several bars after the signal, into a price that had already moved.',
    SIZE: 'The order was large enough in this instrument to move the price it was paying.',
    SPREAD: 'The session itself: the open or the close, where the spread is widest.',
    CLEAN: 'Nothing. The fill is where a fill should be.',
  }),
  avoidable: noul('Could this have been avoided by the desk?', {
    yes: 'A different order, size or time would have got a better price.',
    no: 'The market moved and no order would have done better.',
  }),
  fix: choice('What would fix it next time?', {
    EARLIER_ORDER: 'Send the order when the signal happens, not several bars later.',
    LIMIT_ORDER: 'Name a price instead of taking whatever is there.',
    SMALLER_SIZE: 'Trade less at once, or spread it over the day.',
    AVOID_SESSION: 'Do not trade this in the first or last half hour.',
    NONE: 'Nothing. This is what execution looks like when it goes right.',
  }),
  worth_chasing: noul('Given the setup, was entering late still worth it?', {
    yes: 'The trade was worth having even at the worse price.',
    no: 'By the time it filled, the edge had gone into the slippage.',
  }),
};
// #endregion

// #region demo:evaluate
/** One fill's grade, and what it cost in basis points of the price the signal asked for. */
function evaluate(answers, item) {
  const paid = ((item.fillPrice - item.intendedPrice) / item.intendedPrice) * 10_000 * (item.side === 'BUY' ? 1 : -1);

  return {
    quality: answers.fill_quality.score,
    cause: answers.cause.choice,
    avoidable: answers.avoidable.noul >= 0.5,
    fix: answers.fix.choice,
    worthChasing: answers.worth_chasing.noul >= 0.5,
    confidence: answers.cause.confidence,
    costBps: Math.round(paid),
    costUsd: Math.round((paid / 10_000) * item.sizeUsd),
    label: `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${Math.round(paid)} bps · ${readable(answers.cause.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Slippage by cause, and whether the grade tracks what the fill actually cost. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.fillId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const costly = graded.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN');
  const clean = graded.filter((result) => byItem.get(result.item.id).cause === 'CLEAN');
  const causeRight = graded.filter((result) => result.evaluation.cause === byItem.get(result.item.id).cause);
  const ruleRight = graded.filter((result) => causeByRule(result.item) === byItem.get(result.item.id).cause);
  const matrix = confusion(graded, byItem);
  const stats = matrixStats(matrix);

  return {
    note: `Two hundred and sixty fills against real bars. ${costly.length} of them cost something for one of four reasons, and ${clean.length} are where a fill should be. ${context.note ?? ''}`,
    findings: findings(graded, byItem, clean, { causeRight, ruleRight }),
    kpis: kpis({ graded, costly, clean, causeRight, byItem }),
    baselines: baselines({ graded, causeRight, ruleRight, stats }),
    metrics: metrics({ graded, causeRight, stats }),
    slippageByCause: slippageByCause(graded, byItem),
    distributionTitle: 'Causes named',
    distribution: distribution(results),
    matrix,
    curve: coverage(graded, byItem, costly),
    checks: checks(graded, byItem, labels),
    topItemsTitle: 'Most expensive fills',
    topItems: topItems(results, byItem),
  };
}
// #endregion

const slippageBps = (item) => ((item.fillPrice - item.intendedPrice) / item.intendedPrice) * 10_000 * (item.side === 'BUY' ? 1 : -1);

// The rule: under 12 bps is clean; otherwise market-on-open is a gap, two or more bars late is a chase,
// the open or the close is spread, and whatever is left is size.
function causeByRule(item) {
  if (slippageBps(item) < 12) return 'CLEAN';
  if (item.orderType === 'MARKET_ON_OPEN') return 'GAP';
  if (item.barsBetweenSignalAndFill >= 2) return 'CHASE';
  if (item.session !== 'middle') return 'SPREAD';
  return 'SIZE';
}

function baselines({ graded, causeRight, ruleRight, stats }) {
  if (!graded.length || !stats) return undefined;
  return [
    { label: 'Jev', detail: 'cause agrees with the one the fill carries', value: causeRight.length / graded.length, model: true },
    { label: 'Rule: order type, bars late, session', detail: 'five lines over fields in the state, after working out the slippage', value: ruleRight.length / graded.length },
    { label: 'Always the commonest cause', detail: stats.majorityClass.toLowerCase(), value: stats.majorityBaseline },
  ];
}

function metrics({ graded, causeRight, stats }) {
  if (!graded.length || !stats) return undefined;
  const attributed = dollars(causeRight);
  return {
    headline: { label: 'Cause named exactly', value: causeRight.length / graded.length, n: graded.length },
    accuracy: stats.accuracy,
    macroF1: stats.macroF1,
    dollarWeightedAccuracy: dollars(graded) ? attributed / dollars(graded) : null,
  };
}

/** Where the money sits, by the cause each fill carries, and how much of it was filed under that cause. */
function slippageByCause(graded, byItem) {
  return CAUSES.map((cause) => {
    const group = graded.filter((result) => byItem.get(result.item.id).cause === cause);
    const named = group.filter((result) => result.evaluation.cause === cause);
    return { cause: sentence(cause), fills: group.length, slippage: usd(dollars(group)), namedRight: `${named.length} of ${group.length}`, filedUnderThisCause: usd(dollars(named)) };
  });
}

const cost = (results) => results.reduce((total, result) => total + Math.abs(Math.min(0, -result.evaluation.costBps)), 0);
const dollars = (results) => results.reduce((total, result) => total + Math.max(0, result.evaluation.costUsd), 0);

function kpis({ graded, costly, clean, causeRight, byItem }) {
  const fixRight = costly.filter((result) => SUITABLE_FIXES[byItem.get(result.item.id).cause].includes(result.evaluation.fix));
  const fixStrict = costly.filter((result) => result.evaluation.fix === RIGHT_FIX[byItem.get(result.item.id).cause]);
  const total = dollars(graded);
  const attributed = dollars(causeRight);
  const size = graded.filter((result) => byItem.get(result.item.id).cause === 'SIZE');
  const cleanCalled = clean.filter((result) => result.evaluation.cause === 'CLEAN');
  const worstQuartile = [...graded].sort((left, right) => left.evaluation.quality - right.evaluation.quality).slice(0, 65);
  const worstReallyCostly = worstQuartile.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN');

  return [
    { label: 'Cause named exactly', value: `${causeRight.length} of ${graded.length}`, context: `${share(causeRight.length, graded.length)} · gap, chase, size, spread or clean`, tone: causeRight.length === graded.length ? 'good' : 'warn' },
    { label: 'Clean fills called clean', value: `${cleanCalled.length} of ${clean.length}`, context: 'nothing to fix, and nothing invented to fix', tone: cleanCalled.length === clean.length ? 'good' : 'warn' },
    { label: 'The fix that matches the cause', value: `${fixRight.length} of ${costly.length}`, context: `any fix that suits the cause; holding to one fix per cause gives ${fixStrict.length}`, tone: fixRight.length === costly.length ? 'good' : 'warn' },
    { label: 'Worst sixty-five fills', value: `${worstReallyCostly.length} of ${worstQuartile.length}`, context: 'really cost something, sorted by the grade alone; clean fills cost under 10 bps and the rest 15 or more, so the gap is built in' },
    { label: 'Slippage filed under the right cause', value: share(attributed, total), context: `${usd(attributed)} of ${usd(total)} paid; the ${size.length} size fills hold ${share(dollars(size), total)} of the money`, tone: total && attributed / total >= 0.8 ? 'good' : 'warn' },
  ];
}

/** The fix that goes with each cause, which is the point of asking for both. */
const RIGHT_FIX = { GAP: 'LIMIT_ORDER', CHASE: 'EARLIER_ORDER', SIZE: 'SMALLER_SIZE', SPREAD: 'AVOID_SESSION', CLEAN: 'NONE' };

// More than one fix can suit a cause. Every gap fill here is a market-on-open order sent a bar after the
// signal, so an earlier order also fixes it; a limit order also caps what the open or the close can cost.
const SUITABLE_FIXES = {
  GAP: ['LIMIT_ORDER', 'EARLIER_ORDER'],
  CHASE: ['EARLIER_ORDER'],
  SIZE: ['SMALLER_SIZE'],
  SPREAD: ['AVOID_SESSION', 'LIMIT_ORDER'],
  CLEAN: ['NONE'],
};

function checks(graded, byItem, labels) {
  return CAUSES.filter((cause) => cause !== 'CLEAN').map((cause) => {
    const group = labels.filter((label) => label.cause === cause);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.fillId);
      return !result || result.evaluation.cause !== cause;
    });
    return { id: cause.toLowerCase(), label: `${sentence(cause)} fills named something else`, detail: questions.cause.criteria[cause], count: missed.length, of: group.length, items: missed.slice(0, 20).map((label) => label.fillId) };
  }).concat([{
    id: 'clean',
    label: 'Clean fills given a cause',
    detail: 'Fills within ten basis points of the price the signal asked for.',
    count: graded.filter((result) => byItem.get(result.item.id).cause === 'CLEAN' && result.evaluation.cause !== 'CLEAN').length,
    of: labels.filter((label) => label.cause === 'CLEAN').length,
    items: graded.filter((result) => byItem.get(result.item.id).cause === 'CLEAN' && result.evaluation.cause !== 'CLEAN').slice(0, 20).map((result) => result.item.id),
  }]);
}

function distribution(results) {
  return CAUSES
    .map((cause) => ({ label: sentence(cause), count: results.filter((result) => result.evaluation.cause === cause).length, tone: cause === 'CLEAN' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Cause named against the cause the fill carries',
    rowLabel: 'the cause the fill was built to carry',
    columnLabel: 'the cause the model named',
    columns: CAUSES.map(sentence),
    rows: CAUSES.map((actual) => ({
      label: sentence(actual),
      cells: CAUSES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).cause === actual && result.evaluation.cause === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, costly) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const poor = graded.filter((result) => result.evaluation.quality <= bar);
    const real = poor.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: poor.length, caught: real.length, rate: poor.length ? Number((real.length / poor.length).toFixed(3)) : null };
  });
  return { title: 'Reading the worst fills first', thresholdFormat: 'level', levels: 6, defaultIndex: 2, xLabel: 'Fills at this grade or below', yLabel: 'Fills that really cost something', rateLabel: 'Share of them that do', of: costly.length, points };
}

function findings(graded, byItem, clean, { causeRight = [], ruleRight = [] } = {}) {
  const lines = [];
  if (ruleRight.length > causeRight.length) {
    lines.push(`Five lines over order type, bars late, session and the two prices name ${ruleRight.length} of ${graded.length} causes; the model named ${causeRight.length}. On this dataset the rule wins.`);
  }

  const total = dollars(graded);
  const size = graded.filter((result) => byItem.get(result.item.id).cause === 'SIZE');
  if (total && dollars(causeRight) / total < 0.5) {
    const sizeNamed = size.filter((result) => result.evaluation.cause === 'SIZE').length;
    lines.push(`By count ${share(causeRight.length, graded.length)} of causes are right; by money ${share(dollars(causeRight), total)} is. ${usd(dollars(size))} of the ${usd(total)} paid sits in ${size.length} size fills, ${sizeNamed} of them recognised. Those orders are at most 1.1% of a day’s volume, so little in the record says too big.`);
  }

  const wrongFix = graded.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN' && result.evaluation.cause === byItem.get(result.item.id).cause && !SUITABLE_FIXES[result.evaluation.cause].includes(result.evaluation.fix));
  if (wrongFix.length >= 4) lines.push(`${wrongFix.length} fills were given the right cause and a fix that does not follow from it. The cause is the diagnosis; the fix is the only part anybody acts on.`);

  const chased = graded.filter((result) => byItem.get(result.item.id).cause === 'CHASE');
  const worthIt = chased.filter((result) => result.evaluation.worthChasing);
  if (chased.length) lines.push(`${worthIt.length} of the ${chased.length} chased fills were judged worth having at the worse price. That is the question a desk argues about, and it is asked here separately from the grade. Nothing in the data says which of them were, so this answer is not graded.`);

  const neverChosen = FIXES.filter((fix) => !graded.some((result) => result.evaluation.fix === fix));
  if (graded.length && neverChosen.length) lines.push(`${sentence(neverChosen.join(' and '))} ${neverChosen.length === 1 ? 'was' : 'were'} never chosen as a fix on any of the ${graded.length} fills.`);

  const calledClean = graded.filter((result) => result.evaluation.cause === 'CLEAN');
  const cleanWithFix = calledClean.filter((result) => result.evaluation.fix !== 'NONE');
  const cleanAvoidable = calledClean.filter((result) => result.evaluation.avoidable);
  if (cleanWithFix.length >= 4 || cleanAvoidable.length >= 4) {
    lines.push(`Of the ${calledClean.length} fills called clean, ${cleanWithFix.length} were still given a fix and ${cleanAvoidable.length} were called avoidable. The answers contradict each other there.`);
  }

  const gaps = graded.filter((result) => byItem.get(result.item.id).cause === 'GAP');
  const gapsAvoidable = gaps.filter((result) => result.evaluation.avoidable);
  if (gaps.length && gapsAvoidable.length === gaps.length) {
    lines.push(`All ${gaps.length} gap fills were called avoidable, although an overnight gap is the case the question describes as the market moving.`);
  }

  const cleanFlagged = clean.filter((result) => result.evaluation.cause !== 'CLEAN');
  if (cleanFlagged.length >= 4) lines.push(`${cleanFlagged.length} fills within ten basis points of the intended price were given a cause anyway. Execution that works is allowed to be uninteresting.`);

  const cheapButHarsh = graded.filter((result) => Math.abs(result.evaluation.costBps) < 5 && result.evaluation.quality <= 2);
  if (cheapButHarsh.length >= 5) lines.push(`${cheapButHarsh.length} fills that cost less than five basis points were graded two of six or worse. The grade is not tracking the money.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .sort((left, right) => right.evaluation.costUsd - left.evaluation.costUsd)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.cause === result.evaluation.cause ? ' · agrees' : ''}`,
      value: usd(result.evaluation.costUsd),
    }));
}

// #region demo:grade
/** Right means the cause named is the cause the fill was built to carry. */
const grade = {
  labelId: (label) => label.fillId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.cause === label.cause,
      expected: label.cause,
      got: result.evaluation.cause,
      note: label.cause === 'CLEAN' ? `Built as a clean fill, ${bps(label.costBps)} from the intended price.` : `Built as a ${readable(label.cause)} fill costing ${bps(label.costBps)}.`,
      confidence: result.answers.cause.confidence,
    };
  },
};
// #endregion

const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;

function gradeTone(value) {
  if (value >= 4) return 'good';
  return value >= 2.5 ? 'warn' : 'bad';
}

/** The fill as a card: what it cost, why, and what to change. */
function verdict(result) {
  const { answers, evaluation, item } = result;
  const costly = evaluation.costBps >= 12;
  const facts = [
    { label: 'Cost against the intended price', value: `${bps(evaluation.costBps)} · ${usd(evaluation.costUsd)}`, tone: costly ? 'bad' : 'good' },
    { label: 'Fill grade', value: levelOf(answers.fill_quality), tone: gradeTone(evaluation.quality) },
    { label: 'Fix for next time', value: sentence(evaluation.fix), tone: evaluation.fix === 'NONE' ? 'good' : 'warn' },
    { label: 'Avoidable by the desk', value: evaluation.avoidable ? `Yes · ${Math.round(answers.avoidable.noul * 100)}%` : `No · ${Math.round((1 - answers.avoidable.noul) * 100)}%`, tone: evaluation.avoidable ? 'warn' : undefined },
  ];
  // Only a late fill can have been worth chasing.
  if (item.barsBetweenSignalAndFill >= 2) {
    facts.push({ label: `Worth entering ${item.barsBetweenSignalAndFill} bars late`, value: evaluation.worthChasing ? 'Yes' : 'No', tone: evaluation.worthChasing ? undefined : 'bad' });
  }
  facts.push({ label: 'Confidence in the cause', value: `${Math.round(evaluation.confidence * 100)}%` });

  return {
    eyebrow: 'What put the fill where it was',
    headline: `${sentence(evaluation.cause)} · ${bps(evaluation.costBps)}`,
    detail: questions.cause.criteria[evaluation.cause],
    facts,
  };
}

const present = {
  number: 153,
  problem: {
    headline: 'A signal names a price. The fill is somewhere else, and nobody writes down why.',
    stat: '260',
    statLabel: 'fills to grade against their signals',
  },
  hero: {
    item: 'FL-0258',
    caption: 'An NVDA buy signalled at 209.66 and sent market-on-open the next day. It filled at 222.86: 630 bps, $11,207. Graded 0.7 of 6, cause named as a gap.',
  },
  answers: {
    caption: 'A grade for the fill, the cause of the distance, and the fix. Nobody handed over a basis-point figure.',
    reveal: ['fill_quality', 'cause', 'fix'],
  },
  miss: {
    item: 'FL-0169',
    caption: 'A $17.2M WMT buy, 0.78% of a day’s volume, 136 bps and $233,756 worse than the signal. Built as a size problem and named a gap, at 44% confidence.',
  },
  proof: {
    kpis: ['Cause named exactly', 'Slippage filed under the right cause', 'Clean fills called clean'],
    chart: 'baselines',
    closing: '217 of 260 causes named, but only 23% of the $2,827,408 paid was filed under the right one, and a five-line rule names all 260.',
  },
};

export default {
  id: 'execution-quality',
  title: 'Execution quality',
  domain: 'trades',
  value: 'Measure the distance between the signal and the fill, and say what caused it.',
  tags: ['trades', 'execution', 'slippage', 'real prices'],
  dataClass: 'mixed',
  readMinutes: 4,
  view: 'candles',
  itemLabel: (item) => `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${money(item.sizeUsd)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/execution-quality.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  grade,
  verdict,
  present,
  caveat: 'A five-line rule on order type, bars late, session and the two prices names all 260 planted causes. The size fills hold 92% of the dollars yet are at most 1.1% of a day’s volume, so little in the record says too big; a harder dataset is planned.',
  explain: {
    data: 'scripts/generate/execution-quality.js#demo:data',
    state: 'demos/execution-quality/demo.js#demo:state',
    questions: 'demos/execution-quality/demo.js#demo:questions',
    evaluate: 'demos/execution-quality/demo.js#demo:evaluate',
  },
};
