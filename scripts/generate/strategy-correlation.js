// Twelve invented strategies with three years of daily results each, arranged into sixty pairs. The
// question every pair asks is whether two things with different rules are actually the same bet.
//
// Planted: four pairs that are one strategy run with different parameters, five that trade different
// instruments but load on the same factor, six genuinely independent, and three that look unrelated
// right up until a stress window where they move together. The rest are ordinary.
//
// The correlations are never sent to the model. The demo computes them and the report puts them
// beside the answers. Labels go to data/synthetic/strategy-correlation.labels.json.

import { createRandom } from './lib/random.js';

export const SEED = 1185;

const DAYS = 756;
const STRESS_FROM = 430;
const STRESS_TO = 470;

/** Twelve strategies, each with a rule somebody could read and a factor it really loads on. */
const BOOK = [
  { id: 'S01', name: 'Momentum, twenty day', family: 'MOMENTUM', factor: 'TREND', instruments: ['index futures'], hold: 12, rule: 'Buy the twenty-day high, out after twelve sessions.' },
  { id: 'S02', name: 'Momentum, forty day', family: 'MOMENTUM', factor: 'TREND', instruments: ['index futures'], hold: 22, rule: 'Buy the forty-day high, out after twenty-two sessions.' },
  { id: 'S03', name: 'Trend, dual average', family: 'MOMENTUM', factor: 'TREND', instruments: ['large cap equities'], hold: 30, rule: 'Long while the fast average is above the slow one.' },
  { id: 'S04', name: 'Trend, dual average, slower', family: 'MOMENTUM', factor: 'TREND', instruments: ['large cap equities'], hold: 45, rule: 'The same, with both averages doubled in length.' },
  { id: 'S05', name: 'Carry, rates', family: 'CARRY', factor: 'CARRY', instruments: ['government bonds'], hold: 60, rule: 'Hold the steeper end of the curve against the flatter.' },
  { id: 'S06', name: 'Carry, currencies', family: 'CARRY', factor: 'CARRY', instruments: ['major currencies'], hold: 40, rule: 'Long the higher-yielding currency against the lower.' },
  { id: 'S07', name: 'Short volatility, index', family: 'VOLATILITY', factor: 'SHORT_VOL', instruments: ['index options'], hold: 21, rule: 'Sell the front-month straddle and delta hedge.' },
  { id: 'S08', name: 'Credit spread', family: 'CREDIT', factor: 'SHORT_VOL', instruments: ['corporate bonds'], hold: 90, rule: 'Long high yield against duration-matched government bonds.' },
  { id: 'S09', name: 'Mean reversion, intraday', family: 'REVERSION', factor: 'REVERSION', instruments: ['liquid equities'], hold: 1, rule: 'Fade the first hour move, flat by the close.' },
  { id: 'S10', name: 'Pairs, sector neutral', family: 'REVERSION', factor: 'REVERSION', instruments: ['sector equities'], hold: 8, rule: 'Long the cheaper of a matched pair, short the dearer.' },
  { id: 'S11', name: 'Seasonal, energy', family: 'SEASONAL', factor: 'IDIOSYNCRATIC', instruments: ['energy futures'], hold: 25, rule: 'Long into the seasonal build, out before the draw.' },
  { id: 'S12', name: 'Event, index rebalance', family: 'EVENT', factor: 'IDIOSYNCRATIC', instruments: ['index constituents'], hold: 4, rule: 'Trade the flow around a scheduled index change.' },
];

/** The pairs whose relationship is planted rather than incidental. */
const PLANTED = {
  'S01:S02': 'SAME_PARAMETERS', 'S03:S04': 'SAME_PARAMETERS', 'S01:S03': 'SAME_PARAMETERS', 'S02:S04': 'SAME_PARAMETERS',
  'S05:S06': 'SAME_FACTOR', 'S07:S08': 'SAME_FACTOR', 'S09:S10': 'SAME_FACTOR', 'S01:S04': 'SAME_FACTOR', 'S02:S03': 'SAME_FACTOR',
  'S05:S09': 'INDEPENDENT', 'S06:S11': 'INDEPENDENT', 'S11:S12': 'INDEPENDENT', 'S09:S12': 'INDEPENDENT', 'S05:S11': 'INDEPENDENT', 'S06:S12': 'INDEPENDENT',
  'S07:S10': 'STRESS_ONLY', 'S08:S11': 'STRESS_ONLY', 'S07:S12': 'STRESS_ONLY',
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const series = daily(random);
  const pairs = [];
  const labels = [];

  for (let left = 0; left < BOOK.length; left++) {
    for (let right = left + 1; right < BOOK.length; right++) {
      const key = `${BOOK[left].id}:${BOOK[right].id}`;
      if (!(key in PLANTED) && pairs.length >= 60) continue;
      pairs.push({ left: BOOK[left], right: BOOK[right], relation: PLANTED[key] ?? 'ORDINARY' });
    }
  }

  const chosen = [...pairs.filter((pair) => pair.relation !== 'ORDINARY'), ...pairs.filter((pair) => pair.relation === 'ORDINARY')].slice(0, 60);
  chosen.sort((left, right) => `${left.left.id}${left.right.id}`.localeCompare(`${right.left.id}${right.right.id}`));

  const items = chosen.map((pair, index) => {
    const id = `SC-${String(index + 1).padStart(4, '0')}`;
    const a = series[pair.left.id];
    const b = series[pair.right.id];
    labels.push({
      pairId: id,
      relation: pair.relation,
      correlation: round(correlate(a, b)),
      stressCorrelation: round(correlate(a.slice(STRESS_FROM, STRESS_TO), b.slice(STRESS_FROM, STRESS_TO))),
      calmCorrelation: round(correlate([...a.slice(0, STRESS_FROM), ...a.slice(STRESS_TO)], [...b.slice(0, STRESS_FROM), ...b.slice(STRESS_TO)])),
    });
    return item(id, pair, a, b);
  });

  return {
    dataset: {
      id: 'strategy-correlation',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/strategy-correlation.js',
      context: {
        book: BOOK.map(({ id, name, instruments, hold, rule }) => ({ id, name, instruments, hold, rule })),
        // One copy of each series, not one per pair: twelve strategies appear in sixty pairs and a
        // pair carries two of them, so copying would ship the same numbers ten times over.
        series: Object.fromEntries(BOOK.map((strategy) => [strategy.id, series[strategy.id].join(' ')])),
        tradingDays: DAYS,
        marketContext: 'Three years of daily results. The period contains one stress window of about forty sessions, roughly two thirds of the way through, when most risk assets fell together.',
        howToRead: 'Each series is that strategy’s daily result in basis points of the capital allocated to it, one number per trading day in order. Every statistic about the two series together has been left out on purpose.',
        note: 'Twelve invented strategies with invented results. No correlation, covariance or summary statistic is in the state: reading the two series is the task.',
      },
      items,
    },
    labels,
  };
}

const round = (value) => Number(value.toFixed(3));
const day1 = (value) => Number(value.toFixed(1));

/** Daily results in basis points: a shared market factor, a factor loading, and each one's own noise. */
function daily(random) {
  const market = Array.from({ length: DAYS }, (_, day) => (day >= STRESS_FROM && day < STRESS_TO ? random.float(-70, 30, 1) : random.float(-22, 24, 1)));
  const trend = Array.from({ length: DAYS }, () => random.float(-30, 33, 1));
  const carry = Array.from({ length: DAYS }, () => random.float(-14, 18, 1));
  const reversion = Array.from({ length: DAYS }, () => random.float(-26, 27, 1));
  const factors = { TREND: trend, CARRY: carry, REVERSION: reversion, SHORT_VOL: null, IDIOSYNCRATIC: null };

  const out = {};
  for (const strategy of BOOK) {
    const own = Array.from({ length: DAYS }, () => random.float(-20, 20, 1));
    const shared = factors[strategy.factor];
    out[strategy.id] = Array.from({ length: DAYS }, (_, day) => {
      const stress = day >= STRESS_FROM && day < STRESS_TO;
      // Short-vol strategies earn a little every day and lose it all at once, which is the whole
      // reason a credit book and an options book look unrelated until they do not.
      if (strategy.factor === 'SHORT_VOL') return day1(stress ? market[day] * random.float(1.3, 1.9, 2) : random.float(2, 9, 1) + own[day] * 0.25);
      if (strategy.factor === 'IDIOSYNCRATIC') return day1(own[day] + (stress ? market[day] * 0.45 : 0));
      return day1(shared[day] * loading(strategy) + own[day] * 0.7 + (stress ? market[day] * 0.25 : market[day] * 0.15));
    });
  }
  return out;
}

/** How hard a strategy leans on its factor. The same-parameter pairs lean almost identically. */
const loading = (strategy) => ({ S01: 0.92, S02: 0.88, S03: 0.85, S04: 0.82, S05: 0.7, S06: 0.66, S09: 0.75, S10: 0.72 }[strategy.id] ?? 0.5);

/** Pearson correlation of two equal-length series. Used for the labels and the report, never the state. */
function correlate(left, right) {
  const size = Math.min(left.length, right.length);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const ml = mean(left.slice(0, size));
  const mr = mean(right.slice(0, size));
  let top = 0;
  let sl = 0;
  let sr = 0;
  for (let index = 0; index < size; index++) {
    top += (left[index] - ml) * (right[index] - mr);
    sl += (left[index] - ml) ** 2;
    sr += (right[index] - mr) ** 2;
  }
  return sl && sr ? top / Math.sqrt(sl * sr) : 0;
}

/** A daily series as a running weekly total, which is what a result curve actually looks like. */
function cumulative(series) {
  const out = [];
  let running = 0;
  for (let day = 0; day < series.length; day++) {
    running += series[day];
    if (day % 5 === 4 || day === series.length - 1) out.push(Math.round(running));
  }
  return out;
}

// #region demo:data
/** One pair: both rules, both books, and both daily series. No statistic of any kind. */
function item(id, pair, left, right) {
  const summarise = (strategy) => ({
    id: strategy.id,
    name: strategy.name,
    rule: strategy.rule,
    instruments: strategy.instruments,
    averageHoldSessions: strategy.hold,
    trades: Math.max(4, Math.round(DAYS / strategy.hold)),
  });

  return {
    id,
    leftId: pair.left.id,
    rightId: pair.right.id,
    pair: `${pair.left.name} and ${pair.right.name}`,
    left: summarise(pair.left),
    right: summarise(pair.right),
    // Weekly cumulative totals, for the chart only. The state gets the daily series in full.
    curves: { left: cumulative(left), right: cumulative(right), stressFromWeek: Math.floor(STRESS_FROM / 5), stressToWeek: Math.ceil(STRESS_TO / 5) },
  };
}
// #endregion
