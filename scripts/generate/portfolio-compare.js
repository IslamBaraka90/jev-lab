// Eighteen paired portfolios built from invented weights over real cached instruments. The market
// measurements come from the committed cache; only the client goal, weights and account sizes are
// synthetic. Labels stay outside the demo folder.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { averageVolume, drawdown, last, MARKET_NOTE, profile, returnOver, volatility } from './lib/market.js';

export const SEED = 1142;

const YIELD = { AAPL: 0.5, BAC: 2.5, 'BTC-USD': 0, CVX: 4.1, GLD: 0, JNJ: 3.1, JPM: 2.2, KO: 2.9, MSFT: 0.7, NVDA: 0.03, PEP: 3.6, PG: 2.5, SPY: 1.2, WMT: 0.9, XLE: 3.4, XOM: 3.5 };

const ARCHETYPES = {
  income: { KO: 22, PEP: 19, PG: 19, JNJ: 18, XOM: 17 },
  defensive: { KO: 20, PG: 20, JNJ: 20, GLD: 20, PEP: 15 },
  growth: { NVDA: 25, MSFT: 22, AAPL: 20, SPY: 18, JPM: 10 },
  inflation: { GLD: 28, XOM: 22, CVX: 18, XLE: 17, SPY: 10 },
  balanced: { SPY: 25, MSFT: 18, JPM: 17, JNJ: 18, GLD: 17 },
  concentrated: { NVDA: 58, MSFT: 12, AAPL: 10, SPY: 10, GLD: 5 },
  illiquid: { XLE: 36, PEP: 20, XOM: 16, JNJ: 13, GLD: 10 },
  risky: { GLD: 28, XOM: 22, CVX: 18, XLE: 17, SPY: 10 },
};

const GOALS = {
  income: { name: 'Income', words: 'Produce dependable income without taking a large capital-loss risk.', constraints: { minimum_income_yield_percent: 2.5, maximum_drawdown_percent: 28, minimum_liquid_share_percent: 90 } },
  preservation: { name: 'Capital preservation', words: 'Protect capital first; return comes second.', constraints: { maximum_volatility_percent: 20, maximum_drawdown_percent: 22, maximum_single_holding_percent: 30 } },
  growth: { name: 'Growth', words: 'Seek long-term capital growth while keeping any single name below the limit.', constraints: { maximum_single_holding_percent: 30, minimum_liquid_share_percent: 90, maximum_drawdown_percent: 50 } },
  inflation: { name: 'Inflation hedge', words: 'Hold a meaningful real-asset sleeve while remaining diversified and liquid.', constraints: { minimum_real_asset_share_percent: 45, maximum_single_holding_percent: 35, minimum_liquid_share_percent: 85 } },
  low_drawdown: { name: 'Low drawdown', words: 'Avoid deep falls, even if that means giving up the highest recent return.', constraints: { maximum_drawdown_percent: 18, maximum_volatility_percent: 20, maximum_single_holding_percent: 30 } },
};

const STANDARD = [
  ['income', 'income', 'growth', 'PORTFOLIO_A', 'INCOME'],
  ['preservation', 'defensive', 'growth', 'PORTFOLIO_A', 'DRAWDOWN_RISK'],
  ['growth', 'growth', 'defensive', 'PORTFOLIO_A', 'SECTOR_MIX'],
  ['inflation', 'inflation', 'balanced', 'PORTFOLIO_A', 'SECTOR_MIX'],
  ['low_drawdown', 'defensive', 'growth', 'PORTFOLIO_A', 'DRAWDOWN_RISK'],
  ['growth', 'balanced', 'concentrated', 'PORTFOLIO_A', 'CONCENTRATION'],
  ['income', 'growth', 'income', 'PORTFOLIO_B', 'INCOME'],
  ['preservation', 'growth', 'defensive', 'PORTFOLIO_B', 'DRAWDOWN_RISK'],
  ['growth', 'defensive', 'growth', 'PORTFOLIO_B', 'SECTOR_MIX'],
  ['inflation', 'balanced', 'inflation', 'PORTFOLIO_B', 'SECTOR_MIX'],
  ['growth', 'concentrated', 'balanced', 'PORTFOLIO_B', 'CONCENTRATION'],
  ['income', 'illiquid', 'income', 'PORTFOLIO_B', 'LIQUIDITY'],
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  STANDARD.forEach((entry) => addPair(random, items, labels, ...entry, { kind: 'decisive' }));
  addPair(random, items, labels, 'income', 'income', 'income', 'TOO_CLOSE', 'INCOME', { kind: 'close', variantB: 1 });
  addPair(random, items, labels, 'growth', 'growth', 'growth', 'TOO_CLOSE', 'SECTOR_MIX', { kind: 'close', variantB: 2 });
  addPair(random, items, labels, 'preservation', 'defensive', 'defensive', 'TOO_CLOSE', 'DRAWDOWN_RISK', { kind: 'close', variantB: 1 });
  addPair(random, items, labels, 'inflation', 'inflation', 'inflation', 'TOO_CLOSE', 'SECTOR_MIX', { kind: 'close', variantB: 2 });
  addPair(random, items, labels, 'low_drawdown', 'risky', 'defensive', 'PORTFOLIO_B', 'DRAWDOWN_RISK', { kind: 'trap', trap: true });
  addPair(random, items, labels, 'low_drawdown', 'defensive', 'risky', 'PORTFOLIO_A', 'DRAWDOWN_RISK', { kind: 'trap', trap: true });
  items.forEach((item, index) => { item.id = `PC-${String(index + 1).padStart(2, '0')}`; labels[index].pairId = item.id; });
  return {
    dataset: {
      id: 'portfolio-compare', class: 'mixed', generatedAt: '2026-09-19', seed,
      source: 'scripts/generate/portfolio-compare.js',
      context: { pricesAsOf: last('SPY').date, currency: 'USD', note: MARKET_NOTE, comparisonRule: 'The stated goal and its hard constraints outrank recent return.' },
      items,
    },
    labels,
  };
}

function addPair(random, items, labels, goalId, leftType, rightType, betterFit, reason, options = {}) {
  const number = items.length + 1;
  const left = makePortfolio(random, leftType, 'A', options.variantA ?? 0);
  const right = makePortfolio(random, rightType, 'B', options.variantB ?? 0);
  if (number === 6) applyCurrencyMix(right);
  if (number === 11) applyCurrencyMix(left);
  items.push({ id: null, goal: GOALS[goalId], portfolioA: left, portfolioB: right });
  labels.push({ pairId: null, betterFit, reason, kind: options.kind, trap: Boolean(options.trap) });
}

function makePortfolio(random, archetype, side, variant) {
  const base = { ...ARCHETYPES[archetype] };
  if (variant) {
    const keys = Object.keys(base);
    base[keys[0]] = round(base[keys[0]] - variant, 1);
    base[keys[1]] = round(base[keys[1]] + variant, 1);
  }
  const totalValue = archetype === 'illiquid' ? 24_000_000_000 : random.int(3, 12) * 1_000_000;
  const holdings = Object.entries(base).map(([symbol, weight]) => holding(symbol, weight, totalValue));
  return { name: `Portfolio ${side}`, cashPercent: round(100 - holdings.reduce((sum, entry) => sum + entry.weightPercent, 0), 1), holdings, summary: summarize(holdings) };
}

// #region demo:data
function holding(symbol, weightPercent, totalValue) {
  const identity = profile(symbol);
  const value = (weightPercent / 100) * totalValue;
  const days = value / Math.max(last(symbol).price * averageVolume(symbol), 1);
  return {
    symbol, sector: identity.sector ?? 'Other', currency: identity.currency, weightPercent,
    twelveMonthReturnPercent: returnOver(symbol), volatilityPercent: volatility(symbol),
    drawdownPercent: drawdown(symbol), incomeYieldPercent: YIELD[symbol],
    liquidity: days <= 0.25 ? 'same day' : days <= 1 ? 'within one day' : `${round(days, 1)} trading days`,
    daysOfAverageVolume: round(days, 3),
  };
}
// #endregion

function summarize(holdings) {
  const weighted = (key) => round(holdings.reduce((sum, entry) => sum + (entry.weightPercent / 100) * entry[key], 0), 2);
  const sectors = {};
  const currencies = {};
  for (const entry of holdings) {
    sectors[entry.sector] = round((sectors[entry.sector] ?? 0) + entry.weightPercent, 1);
    currencies[entry.currency] = round((currencies[entry.currency] ?? 0) + entry.weightPercent, 1);
  }
  return {
    twelveMonthReturnPercent: weighted('twelveMonthReturnPercent'), volatilityPercent: weighted('volatilityPercent'),
    drawdownPercent: weighted('drawdownPercent'), incomeYieldPercent: weighted('incomeYieldPercent'),
    largestHoldingPercent: Math.max(...holdings.map((entry) => entry.weightPercent)),
    liquidWithinOneDayPercent: round(holdings.filter((entry) => entry.daysOfAverageVolume <= 1).reduce((sum, entry) => sum + entry.weightPercent, 0), 1),
    realAssetSharePercent: round(holdings.filter((entry) => ['GLD', 'XOM', 'CVX', 'XLE'].includes(entry.symbol)).reduce((sum, entry) => sum + entry.weightPercent, 0), 1),
    sectorMixPercent: sectors, currencyMixPercent: currencies,
  };
}

function applyCurrencyMix(portfolio) {
  portfolio.holdings.slice(0, 2).forEach((entry, index) => { entry.currency = index ? 'GBP' : 'EUR'; });
  portfolio.summary = summarize(portfolio.holdings);
}
