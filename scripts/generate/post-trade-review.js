// Two hundred and twenty closed trades placed on real price history. The prices, gaps and wicks are
// genuine, cached from Yahoo Finance and committed; the trades, the plans and the discipline are
// invented — and invented badly on purpose, in the five ways a trading journal usually goes wrong.
// Lessons go to data/synthetic/post-trade-review.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { candles, MARKET_NOTE } from './lib/market.js';

export const SEED = 1151;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'WMT', 'GLD', 'SPY', 'XLE'];
const BEFORE = 20;
const AFTER = 15;

/** The five ways a plan goes wrong here, and how many trades carry each. */
const PLAN = [
  { lesson: 'NO_STOP', count: 30 },
  { lesson: 'TARGET_TOO_FAR', count: 28 },
  { lesson: 'EXITED_EARLY', count: 26 },
  { lesson: 'MOVED_STOP', count: 24 },
  { lesson: 'CHASED_ENTRY', count: 22 },
  { lesson: 'PLAN_FOLLOWED', count: 90 },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];

  for (const entry of PLAN) {
    for (let index = 0; index < entry.count; index++) {
      const trade = closedTrade(random, entry.lesson);
      items.push(trade);
      labels.push({ key: trade.key, lesson: entry.lesson, planComplete: entry.lesson !== 'NO_STOP' && entry.lesson !== 'TARGET_TOO_FAR' });
    }
  }

  items.sort((left, right) => left.entryDate.localeCompare(right.entryDate) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `TD-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).tradeId = id;
    item.id = id;
    delete item.key;
  });
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'post-trade-review',
      class: 'mixed',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/post-trade-review.js',
      context: {
        desk: 'One trader’s own book',
        currency: 'USD',
        rules: [
          'A plan is complete when direction, stop, target and holding period are all written down before entry.',
          'A target is realistic when the instrument’s recent daily range could reach it inside the planned horizon.',
          'A stop is honoured when it is not moved after entry, in either direction.',
          'Closing before either level is hit needs a reason written at the time, not afterwards.',
        ],
        note: MARKET_NOTE,
      },
      items,
    },
    labels,
  };
}

/** One closed trade: the plan, the fills, and the bars around it from the real chart. */
function closedTrade(random, lesson) {
  const symbol = random.pick(SYMBOLS);
  const bars = candles(symbol).bars;
  const entryIndex = random.int(260, bars.length - AFTER - 2);
  const direction = random.bool(0.72) ? 'LONG' : 'SHORT';
  // Every trade has a signal bar. On a chased entry it is several bars back, at a much better price.
  const barsLate = lesson === 'CHASED_ENTRY' ? random.int(3, 6) : random.weighted([[0, 70], [1, 30]]);
  const signalBar = bars[entryIndex - barsLate];
  const range = averageRange(bars, entryIndex);
  const entryBar = bars[entryIndex];
  const entryPrice = lesson === 'CHASED_ENTRY'
    ? round(Math.max(...bars.slice(entryIndex - barsLate, entryIndex + 1).map((bar) => (direction === 'LONG' ? bar.high : -bar.low)) ) * (direction === 'LONG' ? 1 : -1), 2)
    : round(entryBar.open + (entryBar.close - entryBar.open) * random.float(0.1, 0.6), 2);
  const horizon = random.int(4, 12);
  const plan = planFor(random, { lesson, direction, entryPrice, range, horizon });
  const walk = walkForward(bars, entryIndex, { direction, ...plan, horizon, lesson, random });
  walk.exitDate = bars[entryIndex + walk.barsHeld].date;
  const window = bars.slice(entryIndex - BEFORE, Math.min(bars.length, entryIndex + Math.max(walk.barsHeld + 1, 3)));

  return tradeRecord({ symbol, direction, signalBar, barsLate, entryBar, entryPrice, plan, horizon, walk, window, range, random });
}

// #region demo:data
/** The record a review reads: what was planned, what happened, and the bars around it. */
function tradeRecord({ symbol, direction, signalBar, barsLate, entryBar, entryPrice, plan, horizon, walk, window, range, random }) {
  return {
    key: `${symbol}-${entryBar.date}-${random.int(1_000, 9_999)}`,
    id: null,
    symbol,
    direction,
    signalDate: signalBar.date,
    signalPrice: round(direction === 'LONG' ? signalBar.close : signalBar.close, 2),
    barsBetweenSignalAndEntry: barsLate,
    entryDate: entryBar.date,
    entryPrice,
    plannedStop: plan.stop,
    plannedTarget: plan.target,
    plannedHorizonBars: horizon,
    sizeUsd: random.int(4, 60) * 1_000,
    exitDate: walk.exitDate,
    exitPrice: walk.exitPrice,
    exitReason: walk.reason,
    barsHeld: walk.barsHeld,
    resultPercent: round(((walk.exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'LONG' ? 1 : -1), 2),
    stopMoves: walk.stopMoves,
    averageDailyRangePercent: round((range / entryPrice) * 100, 2),
    chart: {
      markIndex: BEFORE,
      bars: window.map((bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${bar.volume ?? 0}`),
    },
  };
}
// #endregion

/** Average true range over the twenty bars before entry, in price. */
function averageRange(bars, index) {
  const window = bars.slice(index - 20, index);
  return window.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / window.length;
}

/** The plan as it was written down before entry, including the ways it was written badly. */
function planFor(random, { lesson, direction, entryPrice, range, horizon }) {
  const away = (multiple) => round(entryPrice + (direction === 'LONG' ? 1 : -1) * range * multiple, 2);
  const back = (multiple) => round(entryPrice - (direction === 'LONG' ? 1 : -1) * range * multiple, 2);

  if (lesson === 'NO_STOP') return { stop: null, target: away(random.float(1.5, 3)) };
  if (lesson === 'EXITED_EARLY') return { stop: back(random.float(3.5, 5)), target: away(random.float(4, 6)) };
  // A target further away than the instrument could travel in the whole planned horizon.
  if (lesson === 'TARGET_TOO_FAR') return { stop: back(random.float(0.8, 1.5)), target: away(horizon * random.float(1.6, 2.6)) };
  return { stop: back(random.float(0.8, 1.6)), target: away(random.float(1.2, 2.6)) };
}

/** What actually happened after entry, bar by bar, including the stop moves and the early exits. */
function walkForward(bars, entryIndex, { direction, stop, target, horizon, lesson, random }) {
  const stopMoves = [];
  let workingStop = stop;
  const hitStop = (bar) => workingStop !== null && (direction === 'LONG' ? bar.low <= workingStop : bar.high >= workingStop);
  const hitTarget = (bar) => (direction === 'LONG' ? bar.high >= target : bar.low <= target);

  for (let step = 1; step <= Math.min(horizon, AFTER - 1); step++) {
    const bar = bars[entryIndex + step];
    // Moved on the first bar, so the move is always in the record whatever the price then did.
    if (lesson === 'MOVED_STOP' && step === 1 && workingStop !== null) {
      const moved = round(workingStop - (direction === 'LONG' ? 1 : -1) * Math.abs(workingStop) * random.float(0.01, 0.03, 4), 2);
      stopMoves.push({ onBar: step, from: workingStop, to: moved, note: 'moved further away after entry' });
      workingStop = moved;
    }
    if (lesson === 'EXITED_EARLY' && step === Math.max(2, Math.floor(horizon / 2))) {
      return { exitPrice: round(bar.close, 2), reason: 'closed by hand, no reason recorded', barsHeld: step, stopMoves };
    }
    if (hitStop(bar)) return { exitPrice: workingStop, reason: 'stop hit', barsHeld: step, stopMoves };
    if (hitTarget(bar)) return { exitPrice: target, reason: 'target hit', barsHeld: step, stopMoves };
  }
  const last = Math.min(horizon, AFTER - 1);
  return { exitPrice: round(bars[entryIndex + last].close, 2), reason: 'closed at the end of the planned horizon', barsHeld: last, stopMoves };
}
