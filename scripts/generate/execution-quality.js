// Two hundred and sixty fills against the price the signal asked for. The bars are real — genuine
// gaps, genuine wide days — and the fills are invented with four causes of slippage and one clean
// majority. The cost of each fill is worked out from the prices and kept in the labels, never in the
// state: data/synthetic/execution-quality.labels.json.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { averageVolume, candles, MARKET_NOTE } from './lib/market.js';

export const SEED = 1153;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'WMT', 'GLD', 'SPY', 'XLE'];
const AROUND = 10;

const PLAN = [
  { cause: 'GAP', count: 40 },
  { cause: 'CHASE', count: 35 },
  { cause: 'SPREAD', count: 30 },
  { cause: 'SIZE', count: 25 },
  { cause: 'CLEAN', count: 130 },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];

  for (const entry of PLAN) {
    for (let index = 0; index < entry.count; index++) {
      const fill = oneFill(random, entry.cause);
      items.push(fill);
      labels.push({ key: fill.key, cause: entry.cause, costBps: fill.costBps });
    }
  }

  items.sort((left, right) => left.signalDate.localeCompare(right.signalDate) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `FL-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).fillId = id;
    item.id = id;
    delete item.key;
    delete item.costBps;
  });
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'execution-quality',
      class: 'mixed',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/execution-quality.js',
      context: {
        desk: 'One trader’s own fills',
        currency: 'USD',
        sessions: 'The open is the first half hour, the close the last, and the middle is everything between.',
        howSlippageIsCounted: 'Slippage is the distance from the price the signal asked for to the price that was paid, in basis points of the intended price, always counted against the trader.',
        note: MARKET_NOTE,
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One fill: what the signal asked for, what was paid, and the bars either side of it. */
function oneFill(random, cause) {
  const symbol = random.pick(SYMBOLS);
  const bars = candles(symbol).bars;
  const index = random.int(260, bars.length - AROUND - 2);
  const signal = bars[index];
  const side = random.bool(0.6) ? 'BUY' : 'SELL';
  const intended = round(signal.close, 2);
  const shaped = shape(random, { cause, bars, index, side, intended });
  const sizeUsd = shaped.sizeUsd ?? random.int(20, 400) * 1_000;
  const shares = Math.round(sizeUsd / intended);

  return {
    key: `${symbol}-${signal.date}-${random.int(1_000, 9_999)}`,
    id: null,
    symbol,
    side,
    signalDate: signal.date,
    intendedPrice: intended,
    fillPrice: shaped.fillPrice,
    fillDate: bars[index + shaped.barsLate].date,
    barsBetweenSignalAndFill: shaped.barsLate,
    orderType: shaped.orderType,
    session: shaped.session,
    sizeUsd,
    shares,
    shareOfAverageVolumePercent: round((shares / Math.max(averageVolume(symbol), 1)) * 100, 3),
    costBps: Math.round(((shaped.fillPrice - intended) / intended) * 10_000 * (side === 'BUY' ? 1 : -1)),
    chart: { markIndex: AROUND, bars: bars.slice(index - AROUND, index + AROUND).map((bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${bar.volume ?? 0}`) },
  };
}
// #endregion

/** Where the slippage came from, and what that does to the price actually paid. */
function shape(random, { cause, bars, index, side, intended }) {
  const worse = (fraction) => round(intended * (1 + (side === 'BUY' ? 1 : -1) * fraction), 2);

  if (cause === 'GAP') {
    // The next bar opened past the level, so the order filled where the market reopened.
    const next = bars[index + 1];
    const gap = Math.abs(next.open - intended) / intended;
    return { fillPrice: worse(Math.max(gap, random.float(0.004, 0.02, 4))), barsLate: 1, orderType: 'MARKET_ON_OPEN', session: 'open' };
  }
  if (cause === 'CHASE') {
    const late = random.int(2, 5);
    return { fillPrice: worse(random.float(0.004, 0.018, 4)), barsLate: late, orderType: 'MARKET', session: 'middle' };
  }
  if (cause === 'SPREAD') {
    return { fillPrice: worse(random.float(0.0015, 0.005, 4)), barsLate: 0, orderType: 'MARKET', session: random.pick(['open', 'close']) };
  }
  if (cause === 'SIZE') {
    return { fillPrice: worse(random.float(0.003, 0.014, 4)), barsLate: random.int(0, 1), orderType: 'MARKET', session: 'middle', sizeUsd: random.int(3_000, 20_000) * 1_000 };
  }
  return { fillPrice: worse(random.float(0, 0.0008, 5)), barsLate: 0, orderType: random.pick(['LIMIT', 'MARKET']), session: 'middle' };
}
