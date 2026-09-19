// The fifty-over-two-hundred crossover, written once so the demos that argue about it are all arguing
// about the same rule. Nothing here is clever and nothing here is fitted: it is the textbook signal,
// and the point of demo 181 is that the rule is the easy part.
//
// Everything is computed from bars that have already closed. No function in this file ever looks at a
// bar after the one it is asked about.

/** Simple moving average, aligned to the bars: the first `length - 1` entries are null. */
export function movingAverage(bars, length) {
  const out = new Array(bars.length).fill(null);
  let sum = 0;
  for (let index = 0; index < bars.length; index++) {
    sum += bars[index].close;
    if (index >= length) sum -= bars[index - length].close;
    if (index >= length - 1) out[index] = sum / length;
  }
  return out;
}

// #region strategy:detector
/**
 * Every bar where the fast average closes above the slow one having been at or below it the day
 * before. That is the whole signal. It takes no parameters that were chosen by looking at results.
 */
export function crossovers(bars, { fast = 50, slow = 200 } = {}) {
  const quick = movingAverage(bars, fast);
  const steady = movingAverage(bars, slow);
  const found = [];

  for (let index = 1; index < bars.length; index++) {
    const before = quick[index - 1] !== null && steady[index - 1] !== null && quick[index - 1] <= steady[index - 1];
    const after = quick[index] !== null && steady[index] !== null && quick[index] > steady[index];
    if (before && after) found.push({ index, date: bars[index].date, fast: quick[index], slow: steady[index] });
  }
  return found;
}
// #endregion

/** What the chart looks like at the cross, in the numbers somebody would actually look at. */
export function context(bars, index, { fast = 50, slow = 200 } = {}) {
  const quick = movingAverage(bars, fast);
  const steady = movingAverage(bars, slow);
  const bar = bars[index];
  const window = bars.slice(Math.max(0, index - 59), index + 1);

  return {
    close: bar.close,
    // Three decimals, not two: a cross can be a fraction of a penny wide, and rounding it to the
    // price's own precision prints two identical averages and a gap of zero on a real crossover.
    fastMa: round(quick[index], 3),
    slowMa: round(steady[index], 3),
    gapPercent: round(((quick[index] - steady[index]) / steady[index]) * 100, 3),
    fastSlopePercent: slope(quick, index, 20),
    slowSlopePercent: slope(steady, index, 20),
    priceAboveSlowPercent: round(((bar.close - steady[index]) / steady[index]) * 100, 2),
    sixtyDayRangePercent: round(((Math.max(...window.map((entry) => entry.high)) - Math.min(...window.map((entry) => entry.low))) / bar.close) * 100, 2),
    averageTrueRangePercent: round((trueRange(bars, index, 14) / bar.close) * 100, 2),
    volumeAgainstAverage: volumeRatio(bars, index, 60),
    barsSinceLastCross: null,
  };
}

/** Where a stop would go under each of the three rules the demo asks about. */
export function levels(bars, index, { slow = 200 } = {}) {
  const steady = movingAverage(bars, slow);
  const window = bars.slice(Math.max(0, index - 39), index + 1);
  const atr = trueRange(bars, index, 14);

  return {
    belowSlowMa: round(steady[index]),
    belowSwingLow: round(Math.min(...window.map((bar) => bar.low))),
    atrBased: round(bars[index].close - atr * 2),
  };
}

/** The forward return the report grades on. Never called from anything the model can see. */
export function forwardReturn(bars, index, days = 20) {
  const exit = bars[Math.min(index + days, bars.length - 1)];
  return round(((exit.close - bars[index].close) / bars[index].close) * 100, 2);
}

const round = (value, digits = 2) => (typeof value === 'number' ? Number(value.toFixed(digits)) : null);

/** How far an average has travelled over the last `days` bars, as a percentage of where it was. */
function slope(series, index, days) {
  const from = series[index - days];
  if (from === null || from === undefined || series[index] === null) return null;
  return round(((series[index] - from) / from) * 100, 2);
}

/** Average true range over `length` bars, in price. */
function trueRange(bars, index, length) {
  let sum = 0;
  let counted = 0;
  for (let step = Math.max(1, index - length + 1); step <= index; step++) {
    const bar = bars[step];
    const previous = bars[step - 1];
    sum += Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close));
    counted++;
  }
  return counted ? sum / counted : 0;
}

/** Today's volume against the recent average, or null where the series carries no volume. */
function volumeRatio(bars, index, length) {
  const window = bars.slice(Math.max(0, index - length + 1), index + 1).filter((bar) => Number.isFinite(bar.volume) && bar.volume > 0);
  if (window.length < length / 2 || !bars[index].volume) return null;
  const mean = window.reduce((sum, bar) => sum + bar.volume, 0) / window.length;
  return round(bars[index].volume / mean, 2);
}
