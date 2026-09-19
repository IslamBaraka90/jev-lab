// One week of one instrument, judged on the weeks before it. Four instruments over eighteen months:
// three hundred and twelve weeks in all, every one of them real cached bars.
//
// The daily and weekly series live once each in the dataset's context and the items point into them
// by index. Four hundred copies of a sixty-bar window is most of a megabyte of the same numbers.
//
// There are no labels. The comparison in the report is the shipped strategies' own results on these
// same bars, run twice: once always on, once only in the weeks the gate allowed.

import { candles, MARKET_NOTE, volatility } from './lib/market.js';

export const SEED = 1183;

const SYMBOLS = ['SPY', 'NVDA', 'GLD', 'XOM'];
const WEEKS = 78;
const DAILY_IN_STATE = 45;
const WEEKLY_IN_STATE = 39;
const CHART_BARS = 20;
const WARM_UP = 260;

export function generate(seed = SEED) {
  const series = {};
  const weekly = {};
  const items = [];

  for (const symbol of SYMBOLS) {
    const bars = candles(symbol).bars;
    const weeks = intoWeeks(bars);
    const firstWeek = weeks.length - WEEKS;

    // Only the bars anything can reach are worth shipping — six years of history would be five sixths
    // dead weight. The warm-up is set by the slowest rule the report runs, not by the daily window the
    // state shows: a two-hundred-day average with forty-five bars behind it is undefined, and a
    // strategy that can never fire is not a fair comparison.
    const firstBar = Math.max(0, weeks[firstWeek].from - WARM_UP);
    series[symbol] = bars.slice(firstBar).map(line);
    weekly[symbol] = weeks.slice(Math.max(0, firstWeek - WEEKLY_IN_STATE)).map(summary);
    const weekOffset = Math.max(0, firstWeek - WEEKLY_IN_STATE);

    for (let order = 0; order < WEEKS; order++) {
      items.push(item(symbol, bars, weeks, firstWeek + order, order, { firstBar, weekOffset }));
    }
  }

  items.sort((left, right) => left.weekEnd.localeCompare(right.weekEnd) || left.symbol.localeCompare(right.symbol));
  items.forEach((entry, index) => { entry.id = `RG-${String(index + 1).padStart(4, '0')}`; });

  return {
    dataset: {
      id: 'regime-classification',
      class: 'cached-real',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/regime-classification.js',
      context: {
        instruments: SYMBOLS,
        dailySeries: series,
        weeklySeries: weekly,
        dailyBarsInState: DAILY_IN_STATE,
        weeklySummariesInState: WEEKLY_IN_STATE,
        longRunVolatility: Object.fromEntries(SYMBOLS.map((symbol) => [symbol, volatility(symbol, 1_000)])),
        barFormat: 'date open high low close',
        weekFormat: 'week-ending change-percent range-percent gaps-over-1-percent',
        note: `${MARKET_NOTE} Each week is judged on the bars up to and including that week and nothing after it. The strategies in the report are the ones shipped in src/strategies, run on these same bars with the same costs; the only difference between the two runs is whether the gate let them trade.`,
      },
      items,
    },
  };
}

const line = (bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close}`;

/** Daily bars grouped into calendar weeks, each remembering where it sits in the daily series. */
function intoWeeks(bars) {
  const weeks = [];
  let current = null;
  for (let index = 0; index < bars.length; index++) {
    const monday = weekOf(bars[index].date);
    if (!current || current.monday !== monday) {
      current = { monday, from: index, to: index, bars: [] };
      weeks.push(current);
    }
    current.to = index;
    current.bars.push(bars[index]);
  }
  return weeks;
}

/** The Monday of the week a date falls in, so bars group the way a person would group them. */
function weekOf(date) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** One week in one line: what it did, how wide it was, and how many gaps it opened. */
function summary(week) {
  const first = week.bars[0];
  const last = week.bars.at(-1);
  const high = Math.max(...week.bars.map((bar) => bar.high));
  const low = Math.min(...week.bars.map((bar) => bar.low));
  const gaps = week.bars.filter((bar, index) => index > 0 && Math.abs((bar.open - week.bars[index - 1].close) / week.bars[index - 1].close) > 0.01).length;
  return `${last.date} ${round(((last.close - first.open) / first.open) * 100)} ${round(((high - low) / first.open) * 100)} ${gaps}`;
}

const round = (value) => Number(value.toFixed(2));

// #region demo:data
/** One week: where it sits in the two series, and the short window the chart draws. */
function item(symbol, bars, weeks, weekIndex, order, { firstBar, weekOffset }) {
  const week = weeks[weekIndex];
  const from = Math.max(0, week.to - CHART_BARS + 1);
  const window = bars.slice(from, week.to + 1);

  return {
    id: null,
    symbol,
    weekEnd: bars[week.to].date,
    weekStart: bars[week.from].date,
    weekIndex: weekIndex - weekOffset,
    lastBarIndex: week.to - firstBar,
    sessionsInTheWeek: week.bars.length,
    weeksOnFile: order + 1,
    chart: {
      markIndex: window.length - week.bars.length,
      label: `${symbol} · week ending ${bars[week.to].date}`,
      bars: window.map((bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${Math.round((bar.volume ?? 0) / 1000)}`),
    },
  };
}
// #endregion
