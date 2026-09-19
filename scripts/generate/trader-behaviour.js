// One hundred and twenty synthetic trading days. Each day's norms are calculated from the prior
// thirty completed days before that day's planted behaviour is applied. Labels never enter state.

import { createRandom, addDays, nextWorkday } from './lib/random.js';
import { round } from './lib/money.js';

export const SEED = 1154;
const PATTERNS = ['REVENGE', 'OVERTRADING', 'EARLY_EXIT', 'AVERAGING_DOWN', 'DISCIPLINED'];
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'XOM', 'KO'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const history = prehistory(random);
  const dates = workdays('2026-01-05', 120);
  const slots = random.shuffle(Array.from({ length: 110 }, (_, index) => index + 10));
  const schedule = new Map();
  let offset = 0;
  plant(schedule, slots.slice(offset, offset += 11), 'REVENGE');
  plant(schedule, slots.slice(offset, offset += 9), 'OVERTRADING');
  plant(schedule, slots.slice(offset, offset += 7), 'EARLY_EXIT');
  plant(schedule, slots.slice(offset, offset += 6), 'AVERAGING_DOWN');
  const remaining = dates.map((_, index) => index).filter((index) => !schedule.has(index));
  const lossySlots = new Set(random.sample(remaining.filter((index) => index >= 10), 8));
  const items = [];
  const labels = [];
  let equity = 100_000;

  dates.forEach((date, index) => {
    const pattern = schedule.get(index) ?? 'DISCIPLINED';
    const norms = computeNorms(history.slice(-30));
    const goodButLossy = lossySlots.has(index);
    const trades = makeTrades(random, date, pattern, norms, goodButLossy);
    const result = round(trades.reduce((sum, trade) => sum + trade.resultUsd, 0));
    const id = `TB-${String(index + 1).padStart(3, '0')}`;
    const item = {
      id, date, previousDayResultUsd: history.at(-1).resultUsd, startingEquityUsd: equity,
      endingEquityUsd: round(equity + result), resultUsd: result, norms, trades,
    };
    equity = item.endingEquityUsd;
    items.push(item);
    labels.push({ dayId: id, date, pattern, costEstimate: estimateHabitCost(item, pattern), goodButLossy });
    history.push({ resultUsd: result, trades });
  });

  return {
    dataset: {
      id: 'trader-behaviour', class: 'synthetic', generatedAt: '2026-09-19', seed,
      source: 'scripts/generate/trader-behaviour.js',
      context: {
        currency: 'USD', timezone: 'America/New_York',
        interpretation: 'Judge process relative to the supplied rolling 30-day norms. A large loss alone is not evidence of a behaviour problem. All trades are closed intraday, and minutes_after_previous_exit is measured from the prior exit to the next entry.',
        researchOnly: 'Synthetic coaching scenario only. Keep the assessment neutral and practical; this is not investment advice.',
      },
      items,
    },
    labels,
  };
}

function plant(schedule, indexes, pattern) {
  for (const index of indexes) schedule.set(index, pattern);
}

function workdays(first, count) {
  const days = [];
  let day = nextWorkday(first);
  while (days.length < count) {
    days.push(day);
    day = nextWorkday(addDays(day, 1));
  }
  return days;
}

function prehistory(random) {
  return workdays('2025-11-24', 30).map((date) => {
    const trades = ordinaryTrades(random, date, null, false);
    return { resultUsd: round(trades.reduce((sum, trade) => sum + trade.resultUsd, 0)), trades };
  });
}

export function computeNorms(days) {
  const trades = days.flatMap((day) => day.trades);
  const winners = trades.filter((trade) => trade.resultUsd > 0);
  return {
    windowTradingDays: days.length,
    // Cap exceptional sessions when measuring the normal cadence, so an earlier overtrading day
    // cannot redefine later overtrading as normal.
    averageTradesPerDay: round(days.reduce((sum, day) => sum + Math.min(day.trades.length, 6), 0) / Math.max(days.length, 1), 1),
    medianSizeUsd: round(median(trades.map((trade) => trade.sizeUsd))),
    averageResultPerTradeUsd: round(trades.reduce((sum, trade) => sum + trade.resultUsd, 0) / Math.max(trades.length, 1)),
    medianWinningHoldMinutes: round(median(winners.map((trade) => trade.holdingMinutes)), 1),
  };
}

function makeTrades(random, date, pattern, norms, goodButLossy) {
  if (pattern === 'OVERTRADING') return overtradingTrades(random, date, norms);
  const trades = ordinaryTrades(random, date, norms, goodButLossy);
  if (pattern === 'REVENGE') plantRevenge(random, trades, norms);
  if (pattern === 'EARLY_EXIT') plantEarlyExit(random, trades, norms);
  if (pattern === 'AVERAGING_DOWN') plantAveragingDown(random, trades, norms);
  return scheduleTrades(date, trades);
}

function ordinaryTrades(random, date, norms, goodButLossy) {
  const normalSize = norms?.medianSizeUsd ?? 5_000;
  const normalHold = norms?.medianWinningHoldMinutes ?? 42;
  const count = goodButLossy ? 5 : random.int(3, 5);
  const trades = Array.from({ length: count }, (_, index) => {
    const win = random.bool(0.56);
    const result = win ? random.int(65, 240) : -random.int(55, 190);
    return {
      tradeId: `${date}-T${String(index + 1).padStart(2, '0')}`,
      symbol: random.pick(SYMBOLS), side: random.bool(0.72) ? 'LONG' : 'SHORT',
      sizeUsd: round(normalSize * random.float(0.78, 1.18)),
      resultUsd: result, holdingMinutes: Math.max(12, Math.round(normalHold * random.float(0.72, 1.28))),
      minutesAfterPreviousExit: index === 0 ? null : random.int(12, 38), missedAtNormHoldUsd: 0,
    };
  });
  if (goodButLossy) {
    trades.forEach((trade, index) => { trade.resultUsd = index === 2 ? -850 : random.int(70, 155); });
  }
  return trades;
}

function plantRevenge(random, trades, norms) {
  while (trades.length < 5) trades.push({ ...trades.at(-1), tradeId: `${trades[0].tradeId.slice(0, 10)}-T${String(trades.length + 1).padStart(2, '0')}` });
  trades[1].resultUsd = -random.int(180, 330);
  trades[2].symbol = trades[1].symbol;
  trades[2].sizeUsd = round(norms.medianSizeUsd * random.float(2.5, 3.2));
  trades[2].resultUsd = -random.int(390, 690);
  trades[2].minutesAfterPreviousExit = random.int(3, 7);
  trades[3].sizeUsd = round(norms.medianSizeUsd * random.float(1.8, 2.3));
  trades[3].resultUsd = -random.int(180, 360);
  trades[3].minutesAfterPreviousExit = random.int(5, 9);
}

function overtradingTrades(random, date, norms) {
  const count = random.int(13, 14);
  const normalCount = Math.max(3, Math.round(norms.averageTradesPerDay));
  const trades = Array.from({ length: count }, (_, index) => ({
    tradeId: `${date}-T${String(index + 1).padStart(2, '0')}`,
    symbol: random.pick(SYMBOLS), side: random.bool(0.7) ? 'LONG' : 'SHORT',
    sizeUsd: round(norms.medianSizeUsd * random.float(0.78, 1.18)),
    resultUsd: index < normalCount ? random.int(25, 135) : -random.int(35 + index * 3, 105 + index * 5),
    holdingMinutes: random.int(12, 30), minutesAfterPreviousExit: index === 0 ? null : random.int(2, 8), missedAtNormHoldUsd: 0,
  }));
  return scheduleTrades(date, trades);
}

function plantEarlyExit(random, trades, norms) {
  while (trades.length < 5) trades.push({ ...trades.at(-1), tradeId: `${trades[0].tradeId.slice(0, 10)}-T${String(trades.length + 1).padStart(2, '0')}` });
  for (const trade of trades.slice(0, 4)) {
    trade.resultUsd = random.int(35, 105);
    trade.holdingMinutes = Math.max(5, Math.floor(norms.medianWinningHoldMinutes * random.float(0.22, 0.42)));
    trade.missedAtNormHoldUsd = random.int(85, 230);
  }
}

function plantAveragingDown(random, trades, norms) {
  while (trades.length < 5) trades.push({ ...trades.at(-1), tradeId: `${trades[0].tradeId.slice(0, 10)}-T${String(trades.length + 1).padStart(2, '0')}` });
  const symbol = random.pick(SYMBOLS);
  for (let index = 0; index < 3; index++) {
    trades[index].symbol = symbol;
    trades[index].side = 'LONG';
    trades[index].sizeUsd = round(norms.medianSizeUsd * [0.95, 1.45, 2.05][index]);
    trades[index].resultUsd = -random.int(120 + index * 90, 230 + index * 130);
    trades[index].minutesAfterPreviousExit = index === 0 ? null : random.int(4, 9);
  }
}

function scheduleTrades(date, trades) {
  let minute = 9 * 60 + 35;
  return trades.map((trade, index) => {
    if (index > 0) minute += trade.minutesAfterPreviousExit;
    const entryMinute = minute;
    minute += trade.holdingMinutes;
    return { ...trade, enteredAt: timestamp(date, entryMinute), exitedAt: timestamp(date, minute) };
  });
}

function timestamp(date, minute) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`;
}

// #region demo:data
export function estimateHabitCost(item, pattern) {
  const { trades, norms } = item;
  if (pattern === 'REVENGE') {
    return round(trades.reduce((cost, trade, index) => {
      const prior = trades[index - 1];
      const followsLossFast = prior?.resultUsd < 0 && trade.minutesAfterPreviousExit <= 10;
      if (!followsLossFast || trade.sizeUsd < norms.medianSizeUsd * 1.8 || trade.resultUsd >= 0) return cost;
      return cost + Math.abs(trade.resultUsd) * Math.max(0, 1 - norms.medianSizeUsd / trade.sizeUsd);
    }, 0));
  }
  if (pattern === 'OVERTRADING') {
    const usualCount = Math.max(1, Math.round(norms.averageTradesPerDay));
    return round(trades.slice(usualCount).reduce((cost, trade) => cost + Math.max(0, -trade.resultUsd), 0));
  }
  if (pattern === 'EARLY_EXIT') return round(trades.reduce((cost, trade) => cost + (trade.missedAtNormHoldUsd ?? 0), 0));
  if (pattern === 'AVERAGING_DOWN') {
    return round(trades.reduce((cost, trade, index) => {
      const priorSame = trades.slice(0, index).some((prior) => prior.symbol === trade.symbol && prior.resultUsd < 0 && trade.sizeUsd > prior.sizeUsd);
      return cost + (priorSame ? Math.max(0, -trade.resultUsd) : 0);
    }, 0));
  }
  return 0;
}
// #endregion

const median = (values) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

export { PATTERNS };
