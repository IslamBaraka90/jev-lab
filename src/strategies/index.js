// The strategies the demos run. Three rules, each a handful of lines, each with a family the regime
// gate in demo 183 can switch on and off. They are not good strategies and are not meant to be: they
// are ordinary, widely used rules, so that when a gate changes the result it is the gate doing it.
//
// Every signal is generated from bars that have already closed. Nothing here looks forward.

import { crossovers, movingAverage } from './golden-cross.js';

export const FAMILIES = ['TREND_FOLLOWING', 'MEAN_REVERSION', 'BREAKOUT'];

// #region strategy:rules
/** Buy a pullback: price above its fifty-day average, but back within two per cent of it. */
export function pullback(bars, { hold = 10, near = 2 } = {}) {
  const average = movingAverage(bars, 50);
  const signals = [];
  for (let index = 50; index < bars.length - hold; index++) {
    const line = average[index];
    if (line === null) continue;
    const distance = ((bars[index].close - line) / line) * 100;
    const wasFurther = average[index - 5] !== null && ((bars[index - 5].close - average[index - 5]) / average[index - 5]) * 100 > near * 2;
    if (distance >= 0 && distance <= near && wasFurther) signals.push(index);
  }
  return dedupe(signals, hold);
}

/** Buy a range break: today closes above the highest high of the twenty bars before it. */
export function rangeBreak(bars, { hold = 10, lookback = 20 } = {}) {
  const signals = [];
  for (let index = lookback; index < bars.length - hold; index++) {
    const highest = Math.max(...bars.slice(index - lookback, index).map((bar) => bar.high));
    if (bars[index].close > highest) signals.push(index);
  }
  return dedupe(signals, hold);
}

/** The fifty over the two hundred, from the module demo 181 is built on. */
export function goldenCross(bars, { hold = 10 } = {}) {
  return dedupe(crossovers(bars).map((cross) => cross.index).filter((index) => index < bars.length - hold), hold);
}
// #endregion

export const STRATEGIES = [
  { id: 'pullback', name: 'Pullback to the fifty', family: 'MEAN_REVERSION', signals: pullback, rule: 'Buy when price is above its fifty-day average but has come back to within two per cent of it, having been further away a week earlier. Out after ten sessions.' },
  { id: 'range-break', name: 'Twenty-day range break', family: 'BREAKOUT', signals: rangeBreak, rule: 'Buy when the close is above the highest high of the previous twenty sessions. Out after ten sessions.' },
  { id: 'golden-cross', name: 'Fifty over two hundred', family: 'TREND_FOLLOWING', signals: goldenCross, rule: 'Buy when the fifty-day average closes above the two-hundred-day average. Out after ten sessions.' },
];

/** One trade per signal: in at the close, out `hold` sessions later, cost charged once. */
export function trades(bars, signals, { hold = 10, cost = 0.1 } = {}) {
  return signals.map((index) => {
    const exit = bars[Math.min(index + hold, bars.length - 1)];
    return {
      index,
      date: bars[index].date,
      exitDate: exit.date,
      returnPercent: Number((((exit.close - bars[index].close) / bars[index].close) * 100 - cost).toFixed(3)),
    };
  });
}

/** Signals inside `gap` bars of one already taken are the same idea twice, so only the first counts. */
function dedupe(signals, gap) {
  const kept = [];
  for (const index of signals) if (!kept.length || index - kept.at(-1) > gap) kept.push(index);
  return kept;
}
