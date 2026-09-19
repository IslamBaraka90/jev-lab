// One hundred and forty reproducible backtests designed to make the usual research failures visible.
// The label file is the answer key. Nothing in an item says which failure was planted.

import { createRandom } from './lib/random.js';

export const SEED = 1184;

const MIX = [
  ['PARAMETER_CLIFF', 22],
  ['FEW_TRADES', 18],
  ['LOOK_AHEAD', 14],
  ['SURVIVORSHIP', 11],
  ['COSTS_OMITTED', 9],
  ['NONE', 66],
];

const STRATEGIES = [
  ['Dual moving-average trend', 'US large-cap equities', '20/100-day moving-average cross'],
  ['Short-term mean reversion', 'US liquid equities', 'Buy a three-day fall below the lower volatility band'],
  ['Range breakout', 'Developed equity index futures', 'Enter on a close beyond the prior twenty-session range'],
  ['Cross-sectional momentum', 'US large-cap equities', 'Long the strongest decile and short the weakest decile'],
  ['Earnings drift', 'US reporting companies', 'Buy positive earnings surprises after the announcement'],
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const planted = MIX.flatMap(([kind, count]) => Array.from({ length: count }, () => kind));
  const shuffled = random.shuffle(planted);
  const labels = [];
  const items = shuffled.map((kind, index) => {
    const id = `OR-${String(index + 1).padStart(4, '0')}`;
    labels.push({ backtestId: id, kind });
    return makeBacktest(random, id, kind, index);
  });

  return {
    dataset: {
      id: 'overfit-review',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/overfit-review.js',
      context: {
        note: 'Every report is invented and reproducible. The six planted classes exist only in data/synthetic/overfit-review.labels.json.',
        scale: 'Equity begins at $100,000. Sensitivity-grid returns are total percentage returns over the stated research period.',
      },
      items,
    },
    labels,
  };
}

function makeBacktest(random, id, kind, index) {
  const [strategyName, market, rule] = STRATEGIES[index % STRATEGIES.length];
  const tradeCount = kind === 'FEW_TRADES' ? random.int(5, 14) : random.int(84, 286);
  const chosen = { lookbackSessions: 20, entryThreshold: 1, exitSessions: 5 };
  const report = {
    id,
    title: `${strategyName} · research run ${String(index + 1).padStart(3, '0')}`,
    strategy: { name: strategyName, rule, market, parameters: chosen },
    period: { from: '2016-01-01', to: '2025-12-31', frequency: 'Daily bars' },
    tradeCount,
    tradeReturnDistribution: distribution(random, tradeCount, kind),
    costAssumptions: costs(kind),
    universe: universe(kind, market),
    signalAndExecution: execution(kind),
    validation: kind === 'NONE' ? { method: 'Parameters were frozen after 2016–2021 development, before an untouched 2022–2025 holdout was opened.', developmentSharpe: Number((0.86 + (index % 7) * 0.04).toFixed(2)), holdoutSharpe: Number((0.72 + (index % 6) * 0.05).toFixed(2)), holdoutUsedForSelection: false } : undefined,
    equityCurve: curve(random, kind, tradeCount),
    parameterGrid: grid(random, kind, chosen),
  };
  return report;
}

function costs(kind) {
  if (kind === 'COSTS_OMITTED') return { commissionBasisPoints: 0, slippageBasisPoints: 0, borrowCostsIncluded: false, note: 'No commissions, slippage, spread or borrow charge was applied.' };
  return { commissionBasisPoints: 1.5, slippageBasisPoints: 3, borrowCostsIncluded: true, note: 'Round-trip commissions, conservative slippage and borrow charges are deducted.' };
}

function universe(kind, market) {
  if (kind === 'SURVIVORSHIP') return { description: `${market}; constituents observed at the end of 2025 were used for the entire 2016–2025 history. Removed and delisted securities are absent.`, pointInTime: false };
  return { description: `${market}; membership is reconstructed on each historical date and includes later removals and delistings.`, pointInTime: true };
}

function execution(kind) {
  if (kind === 'LOOK_AHEAD') return { signalKnown: 'At the same daily close used to calculate the signal', fillAssumption: 'Filled at that same close', lagBars: 0 };
  return { signalKnown: 'After the daily bar has closed', fillAssumption: 'Filled at the next session open', lagBars: 1 };
}

function distribution(random, total, kind) {
  const shape = kind === 'LOOK_AHEAD' ? [0.02, 0.09, 0.26, 0.42, 0.21]
    : kind === 'PARAMETER_CLIFF' ? [0.05, 0.12, 0.25, 0.38, 0.2]
      : [0.08, 0.2, 0.32, 0.28, 0.12];
  const ranges = ['Below -4%', '-4% to -1%', '-1% to +1%', '+1% to +4%', 'Above +4%'];
  const counts = shape.map((share) => Math.floor(total * share));
  for (let left = total - counts.reduce((sum, count) => sum + count, 0); left > 0; left--) counts[random.int(0, counts.length - 1)]++;
  return ranges.map((range, position) => ({ range, trades: counts[position] }));
}

function curve(random, kind, tradeCount) {
  let equity = 100_000;
  const points = [{ period: '2016-Q1', equity }];
  const sparse = new Set(random.sample(Array.from({ length: 39 }, (_, index) => index + 1), Math.min(tradeCount, 10)));
  for (let quarter = 1; quarter < 40; quarter++) {
    let change;
    if (kind === 'FEW_TRADES') change = sparse.has(quarter) ? random.normal(0.035, 0.065, { min: -0.09, max: 0.16 }) : 0;
    else if (kind === 'LOOK_AHEAD') change = random.normal(0.029, 0.004, { min: 0.016, max: 0.042 });
    else if (kind === 'PARAMETER_CLIFF') change = random.normal(0.026, 0.009, { min: -0.01, max: 0.05 });
    else if (kind === 'SURVIVORSHIP') change = random.normal(0.018, 0.017, { min: -0.045, max: 0.055 });
    else if (kind === 'COSTS_OMITTED') change = random.normal(0.014, 0.019, { min: -0.05, max: 0.055 });
    else change = random.normal(0.009, 0.026, { min: -0.075, max: 0.07 });
    equity = Math.round(equity * (1 + change));
    const year = 2016 + Math.floor(quarter / 4);
    points.push({ period: `${year}-Q${quarter % 4 + 1}`, equity });
  }
  return points;
}

function grid(random, kind, chosen) {
  const lookbacks = [10, 15, 20, 25, 30];
  const thresholds = [0.5, 0.75, 1, 1.25, 1.5];
  return lookbacks.map((lookbackSessions, row) => ({
    lookbackSessions,
    cells: thresholds.map((entryThreshold, column) => {
      const selected = lookbackSessions === chosen.lookbackSessions && entryThreshold === chosen.entryThreshold;
      const distance = Math.abs(row - 2) + Math.abs(column - 2);
      let sharpe;
      let totalReturnPercent;
      if (kind === 'PARAMETER_CLIFF') {
        sharpe = selected ? random.float(2.9, 3.8, 2) : random.float(-0.45, 0.48, 2);
        totalReturnPercent = selected ? random.float(72, 118, 1) : random.float(-18, 8, 1);
      } else if (kind === 'NONE') {
        // An honest control is a plateau, not a centre-picked hill: adjacent and distant settings
        // can beat the displayed selection, and the entire surface stays in the same modest range.
        sharpe = Number(Math.max(0.75, 0.94 + random.normal(0, 0.025)).toFixed(2));
        totalReturnPercent = Number((23 + random.normal(0, 0.8)).toFixed(1));
      } else {
        const lift = kind === 'LOOK_AHEAD' ? 1.4 : kind === 'SURVIVORSHIP' ? 0.55 : kind === 'COSTS_OMITTED' ? 0.35 : kind === 'FEW_TRADES' ? 0.25 : 0;
        sharpe = Number(Math.max(-0.2, 1.15 + lift - distance * 0.13 + random.normal(0, 0.08)).toFixed(2));
        totalReturnPercent = Number((28 + lift * 24 - distance * 3.3 + random.normal(0, 3.5)).toFixed(1));
      }
      return { entryThreshold, selected, totalReturnPercent, sharpe, maxDrawdownPercent: Number((-random.float(5 + distance, 14 + distance * 2, 1)).toFixed(1)) };
    }),
  }));
}
