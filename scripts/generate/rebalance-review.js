// Twelve rebalancing runs across six invented accounts, producing two hundred proposed trades. The
// rebalancer is mechanical and does not know about tax lots, other accounts, or the note in the
// mandate — so forty-seven of its trades have something wrong with them. Sizes and liquidity come from
// the cached real prices and volumes. Verdicts go to data/synthetic/rebalance-review.labels.json.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { averageVolume, last, MARKET_NOTE } from './lib/market.js';

export const SEED = 1143;

const UNIVERSE = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT', 'GLD', 'SPY', 'XLE'];

const ACCOUNTS = [
  { id: 'ACC-GROWTH', name: 'Growth, taxable', taxable: true, valueUsd: 4_200_000_000, mandate: 'Growth. Deliberate overweight in energy while the refinery cycle runs; do not trim XOM or CVX below 9% before the December review.' },
  { id: 'ACC-BALANCED', name: 'Balanced, taxable', taxable: true, valueUsd: 6_800_000_000, mandate: 'Balanced. No single name above 8%. Tax matters: realised gains are reported quarterly.' },
  { id: 'ACC-PENSION', name: 'Pension, sheltered', taxable: false, valueUsd: 19_500_000_000, mandate: 'Long-dated pension money. No tax consequences. Keep turnover low and costs lower.' },
  { id: 'ACC-CHARITY', name: 'Charity, sheltered', taxable: false, valueUsd: 1_900_000_000, mandate: 'Charity. Income first. Nothing that needs explaining to a board of trustees.' },
  { id: 'ACC-FAMILY-A', name: 'Family trust A, taxable', taxable: true, valueUsd: 3_100_000_000, mandate: 'Family trust. Mirror the balanced model. Trades are netted against trust B where possible.' },
  { id: 'ACC-FAMILY-B', name: 'Family trust B, taxable', taxable: true, valueUsd: 2_700_000_000, mandate: 'Family trust. Mirror the balanced model. Trades are netted against trust A where possible.' },
];

const COST_FLOOR = 250_000;

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 14; index++) add(tooBig(random), { verdict: 'RESIZE', issue: 'LIQUIDITY' });
  for (let index = 0; index < 11; index++) add(washSale(random), { verdict: 'DEFER', issue: 'TAX_LOT' });
  for (let index = 0; index < 9; index++) add(crossing(random), { verdict: 'REJECT', issue: 'CROSSING' });
  for (let index = 0; index < 7; index++) add(tooSmall(random), { verdict: 'REJECT', issue: 'TOO_SMALL' });
  for (let index = 0; index < 6; index++) add(againstMandate(random), { verdict: 'DEFER', issue: 'MANDATE_CONFLICT' });
  for (let index = 0; index < 153; index++) add(ordinary(random), { verdict: 'APPROVE', issue: 'NONE' });

  items.sort((left, right) => left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `TR-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).tradeId = id;
    item.id = id;
    delete item.key;
  });
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'rebalance-review',
      class: 'mixed',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/rebalance-review.js',
      context: {
        manager: 'Ravenhill Advisers',
        currency: 'USD',
        pricesAsOf: last('SPY').date,
        accounts: ACCOUNTS.map((account) => ({ id: account.id, name: account.name, taxable: account.taxable, mandate: account.mandate })),
        rules: [
          'A single trade should not be more than a fifth of the instrument’s average daily volume.',
          `A trade worth less than ${(COST_FLOOR / 1_000).toFixed(0)} thousand dollars costs more in spread and settlement than the drift it corrects.`,
          'Selling at a loss and buying the same name back inside thirty days wastes the loss in a taxable account.',
          'Two accounts trading the same name in opposite directions on the same day should be netted, not sent to the market.',
          'A deliberate overweight written into the mandate is not drift, and the rebalancer does not know about it.',
        ],
        tolerance: 'Weights are inside tolerance at one and a half points either side of target.',
        note: MARKET_NOTE,
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One proposed trade, with the position around it and what the instrument can absorb. */
function trade(random, { account, symbol, side, valueUsd, currentPercent, targetPercent, recentTrades = [], sameNameOtherAccount = null, mandateNote = null }) {
  const price = last(symbol).price;
  const shares = Math.round(valueUsd / price);
  const volume = Math.max(averageVolume(symbol), 1);
  return {
    key: `${account.id}-${symbol}-${random.int(100_000, 999_999)}`,
    id: null,
    accountId: account.id,
    accountTaxable: account.taxable,
    symbol,
    side,
    shares,
    valueUsd: round(valueUsd),
    price,
    currentWeightPercent: round(currentPercent, 2),
    targetWeightPercent: round(targetPercent, 2),
    weightAfterPercent: round(currentPercent + (side === 'BUY' ? 1 : -1) * (valueUsd / account.valueUsd) * 100, 2),
    shareOfAverageVolumePercent: round((shares / volume) * 100, 2),
    averageDailyVolume: volume,
    recentTradesInThisName: recentTrades,
    sameNameOtherAccountToday: sameNameOtherAccount,
    mandateNote,
  };
}
// #endregion

const pick = (random) => random.pick(UNIVERSE);
const accountOf = (random, { taxable = null } = {}) => random.pick(taxable === null ? ACCOUNTS : ACCOUNTS.filter((account) => account.taxable === taxable));

/** A trade worth more than a fifth of what the instrument trades in a day. */
function tooBig(random) {
  const symbol = random.pick(['XLE', 'PEP', 'KO', 'GLD']);
  // Only the big books can move these instruments; a small account cannot make a liquidity problem.
  const account = random.pick(ACCOUNTS.filter((entry) => entry.valueUsd > 3_000_000_000));
  const volumeUsd = averageVolume(symbol) * last(symbol).price;
  return trade(random, {
    account,
    symbol,
    side: random.pick(['BUY', 'SELL']),
    valueUsd: Math.min(volumeUsd * random.float(0.28, 0.6, 3), account.valueUsd * 0.2),
    currentPercent: random.float(4, 9),
    targetPercent: random.float(2, 7),
  });
}

/** Selling at a loss in a taxable account that bought the same name three weeks ago. */
function washSale(random) {
  const symbol = pick(random);
  const account = accountOf(random, { taxable: true });
  const days = random.int(6, 27);
  return trade(random, {
    account,
    symbol,
    side: 'SELL',
    valueUsd: account.valueUsd * random.float(0.004, 0.02, 4),
    currentPercent: random.float(3, 9),
    targetPercent: random.float(1, 6),
    recentTrades: [
      { daysAgo: days, side: 'BUY', valueUsd: round(account.valueUsd * random.float(0.004, 0.02, 4)), note: 'lot still held, currently at a loss' },
      { daysAgo: random.int(60, 200), side: 'BUY', valueUsd: round(account.valueUsd * random.float(0.005, 0.03, 4)), note: 'older lot, at a gain' },
    ],
  });
}

/** Two family trusts sending the same name to the market in opposite directions on the same day. */
function crossing(random) {
  const symbol = pick(random);
  const account = random.pick(ACCOUNTS.filter((entry) => entry.id.startsWith('ACC-FAMILY')));
  const other = ACCOUNTS.find((entry) => entry.id.startsWith('ACC-FAMILY') && entry.id !== account.id);
  const side = random.pick(['BUY', 'SELL']);
  return trade(random, {
    account,
    symbol,
    side,
    valueUsd: account.valueUsd * random.float(0.006, 0.02, 4),
    currentPercent: random.float(3, 8),
    targetPercent: random.float(3, 8),
    sameNameOtherAccount: { account: other.id, side: side === 'BUY' ? 'SELL' : 'BUY', valueUsd: round(other.valueUsd * random.float(0.006, 0.02, 4)), sameDay: true },
  });
}

/** A trade too small to pay for itself. */
function tooSmall(random) {
  const account = accountOf(random);
  return trade(random, {
    account,
    symbol: pick(random),
    side: random.pick(['BUY', 'SELL']),
    valueUsd: random.float(20_000, COST_FLOOR - 40_000),
    currentPercent: random.float(2, 8),
    targetPercent: random.float(2, 8),
  });
}

/** A trade that quietly undoes the overweight the mandate asked for. */
function againstMandate(random) {
  const account = ACCOUNTS[0];
  const symbol = random.pick(['XOM', 'CVX']);
  return trade(random, {
    account,
    symbol,
    side: 'SELL',
    valueUsd: account.valueUsd * random.float(0.01, 0.03, 4),
    currentPercent: random.float(9.5, 12),
    targetPercent: random.float(5, 7),
    mandateNote: account.mandate,
  });
}

/** The rest: ordinary trades that do what a rebalance is for. */
function ordinary(random) {
  const account = accountOf(random);
  const symbol = pick(random);
  const current = random.float(1.5, 9);
  const target = current + random.pick([-1, 1]) * random.float(1.6, 3.5);
  const side = target > current ? 'BUY' : 'SELL';
  return trade(random, {
    account,
    symbol,
    side,
    valueUsd: Math.max(COST_FLOOR * 1.6, Math.min(account.valueUsd * random.float(0.002, 0.012, 4), averageVolume(symbol) * last(symbol).price * 0.1)),
    currentPercent: current,
    targetPercent: Math.max(0.5, target),
    recentTrades: random.bool(0.25) ? [{ daysAgo: random.int(45, 300), side: random.pick(['BUY', 'SELL']), valueUsd: round(account.valueUsd * random.float(0.003, 0.02, 4)), note: 'settled, nothing outstanding' }] : [],
  });
}
