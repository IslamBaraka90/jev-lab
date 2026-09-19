// Execution quality: two hundred and sixty fills, each measured against the price its signal asked
// for. The state gives the bars, the intended price, the fill and the size — and no cost calculation,
// so the grade has to come from reading the fill rather than from a number somebody already worked out.

import { choice, noul, score } from '../lib/questions.js';

const CAUSES = ['GAP', 'CHASE', 'SIZE', 'SPREAD', 'CLEAN'];
const FIXES = ['EARLIER_ORDER', 'LIMIT_ORDER', 'SMALLER_SIZE', 'AVOID_SESSION', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const bps = (value) => `${value > 0 ? '' : '+'}${(-value).toFixed(0)} bps`;
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

  return {
    note: `Two hundred and sixty fills against real bars. ${costly.length} of them cost something for one of four reasons, and ${clean.length} are where a fill should be. ${context.note ?? ''}`,
    findings: findings(graded, byItem, clean),
    kpis: kpis({ graded, costly, clean, causeRight, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, costly),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

const cost = (results) => results.reduce((total, result) => total + Math.abs(Math.min(0, -result.evaluation.costBps)), 0);
const dollars = (results) => results.reduce((total, result) => total + Math.max(0, result.evaluation.costUsd), 0);

function kpis({ graded, costly, clean, causeRight, byItem }) {
  const fixRight = costly.filter((result) => result.evaluation.fix === RIGHT_FIX[byItem.get(result.item.id).cause]);
  const cleanCalled = clean.filter((result) => result.evaluation.cause === 'CLEAN');
  const worstQuartile = [...graded].sort((left, right) => left.evaluation.quality - right.evaluation.quality).slice(0, 65);
  const worstReallyCostly = worstQuartile.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN');

  return [
    { label: 'Cause named exactly', value: `${causeRight.length} of ${graded.length}`, context: 'gap, chase, size, spread or clean' },
    { label: 'Clean fills called clean', value: `${cleanCalled.length} of ${clean.length}`, context: 'nothing to fix, and nothing invented to fix', tone: cleanCalled.length === clean.length ? 'good' : 'warn' },
    { label: 'The fix that matches the cause', value: `${fixRight.length} of ${costly.length}`, context: 'earlier order, limit, smaller size or a different session' },
    { label: 'Worst sixty-five fills', value: `${worstReallyCostly.length} really cost something`, context: 'sorted by the grade alone, before any cost is known' },
    { label: 'Slippage paid', value: money(dollars(graded)), context: `${graded.filter((result) => result.evaluation.costBps > 0).length} fills worse than the signal price` },
  ];
}

/** The fix that goes with each cause, which is the point of asking for both. */
const RIGHT_FIX = { GAP: 'LIMIT_ORDER', CHASE: 'EARLIER_ORDER', SIZE: 'SMALLER_SIZE', SPREAD: 'AVOID_SESSION', CLEAN: 'NONE' };

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
    detail: 'Fills within a basis point of the price the signal asked for.',
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
  return { title: 'Reading the worst fills first', xLabel: 'Fills at this grade or below', yLabel: 'Fills that really cost something', rateLabel: 'Share of them that do', of: costly.length, points };
}

function findings(graded, byItem, clean) {
  const lines = [];
  const wrongFix = graded.filter((result) => byItem.get(result.item.id).cause !== 'CLEAN' && result.evaluation.cause === byItem.get(result.item.id).cause && result.evaluation.fix !== RIGHT_FIX[result.evaluation.cause]);
  if (wrongFix.length >= 4) lines.push(`${wrongFix.length} fills were given the right cause and a fix that does not follow from it. The cause is the diagnosis; the fix is the only part anybody acts on.`);

  const chased = graded.filter((result) => byItem.get(result.item.id).cause === 'CHASE');
  const worthIt = chased.filter((result) => result.evaluation.worthChasing);
  if (chased.length) lines.push(`${worthIt.length} of the ${chased.length} chased fills were judged worth having at the worse price. That is the question a desk argues about, and it is asked here separately from the grade.`);

  const cleanFlagged = clean.filter((result) => result.evaluation.cause !== 'CLEAN');
  if (cleanFlagged.length >= 4) lines.push(`${cleanFlagged.length} fills within a basis point of the intended price were given a cause anyway. Execution that works is allowed to be uninteresting.`);

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
      value: money(result.evaluation.costUsd),
    }));
}

export default {
  id: 'execution-quality',
  title: 'Execution quality',
  domain: 'trades',
  value: 'Measure the distance between the signal and the fill, and say what caused it.',
  tags: ['trades', 'execution', 'slippage', 'real prices'],
  dataClass: 'mixed',
  readMinutes: 4,
  view: 'candles',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${money(item.sizeUsd)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/execution-quality.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/execution-quality.js#demo:data',
    state: 'demos/execution-quality/demo.js#demo:state',
    questions: 'demos/execution-quality/demo.js#demo:questions',
    evaluate: 'demos/execution-quality/demo.js#demo:evaluate',
  },
};
