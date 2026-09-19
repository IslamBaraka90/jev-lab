// Twenty-four portfolios, each built to carry one problem: too much in one name, four names that are
// really one bet, a tail nobody can sell, a currency position nobody chose, or weights that have
// drifted away from the stated plan. Five are healthy. The holdings are invented; the prices,
// volatilities and volumes behind them are real and cached. Labels go to
// data/synthetic/portfolio-health.labels.json.

import { createRandom } from './lib/random.js';
import { personName } from './lib/names.js';
import { round } from './lib/money.js';
import { averageVolume, correlation, drawdown, last, MARKET_NOTE, profile, returnOver, volatility } from './lib/market.js';

export const SEED = 1141;

const UNIVERSE = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT', 'GLD', 'SPY', 'XLE', 'BTC-USD'];

/** Groups that move together, whatever their tickers say. Used to build the hidden-correlation cases. */
const ONE_BET = [
  { name: 'big technology', symbols: ['NVDA', 'MSFT', 'AAPL'] },
  { name: 'American banks', symbols: ['JPM', 'BAC'] },
  { name: 'oil', symbols: ['XOM', 'CVX', 'XLE'] },
];

const OBJECTIVES = [
  { id: 'income', words: 'Income with capital preserved. Steady dividends, nothing that swings hard.', targets: { equity: 55, defensive: 35, cash: 10 } },
  { id: 'growth', words: 'Long-term growth. Volatility is acceptable; permanent loss is not.', targets: { equity: 85, defensive: 10, cash: 5 } },
  { id: 'balanced', words: 'Balanced. Grow ahead of inflation without a year that frightens anybody.', targets: { equity: 65, defensive: 25, cash: 10 } },
];

const DEFENSIVE = ['GLD', 'KO', 'PG', 'JNJ'];
const assetClassOf = (symbol) => (DEFENSIVE.includes(symbol) ? 'defensive' : 'equity');

/** At most one name from any group that moves together, so only the correlation cases carry that risk. */
function diversified(random, count, { exclude = [] } = {}) {
  const taken = new Set();
  const pool = random.shuffle(UNIVERSE.filter((symbol) => !exclude.includes(symbol)));
  const picked = [];
  for (const symbol of pool) {
    const group = ONE_BET.find((entry) => entry.symbols.includes(symbol));
    if (group && taken.has(group.name)) continue;
    if (group) taken.add(group.name);
    picked.push(symbol);
    if (picked.length === count) break;
  }
  return picked;
}

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 5; index++) add(concentrated(random), { plantedRisk: 'CONCENTRATION' });
  for (let index = 0; index < 4; index++) add(oneBet(random), { plantedRisk: 'CORRELATION' });
  for (let index = 0; index < 3; index++) add(illiquidTail(random), { plantedRisk: 'LIQUIDITY' });
  for (let index = 0; index < 4; index++) add(currencyBet(random), { plantedRisk: 'CURRENCY' });
  for (let index = 0; index < 3; index++) add(drifted(random), { plantedRisk: 'DRIFT' });
  for (let index = 0; index < 5; index++) add(healthy(random), { plantedRisk: 'NONE' });

  items.sort((left, right) => left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `PF-${String(index + 1).padStart(2, '0')}`;
    labels.find((label) => label.key === item.key).portfolioId = id;
    item.id = id;
    delete item.key;
  });
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'portfolio-health',
      class: 'mixed',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/portfolio-health.js',
      context: {
        adviser: 'Ravenhill Advisers',
        currency: 'USD',
        pricesAsOf: last('SPY').date,
        howToRead: {
          concentration: 'A single holding above a quarter of the portfolio is worth a sentence, whatever it is.',
          liquidity: 'A position worth more than one day of its own average volume cannot be sold in a hurry.',
          drift: 'Weights are compared with the plan the client agreed, not with anybody else’s.',
          correlation: 'Correlations are twelve-month daily, computed from the cached prices.',
        },
        note: MARKET_NOTE,
      },
      items,
    },
    labels,
  };
}

/** One portfolio: invented weights over real instruments, with the real numbers attached. */
function portfolio(random, { objective, weights, cashPercent, note, homeCurrency = 'USD', sizeUsd }) {
  const total = sizeUsd ?? random.int(140, 900) * 1_000_000;
  const holdings = Object.entries(weights).map(([symbol, weight]) => holdingOf(symbol, weight, total));
  const inClass = (name) => round(holdings.filter((holding) => holding.assetClass === name).reduce((sum, holding) => sum + holding.weightPercent, 0), 1);

  return {
    key: `${objective.id}-${random.int(100_000, 999_999)}`,
    id: null,
    client: personName(random),
    clientSpendsIn: homeCurrency,
    objective: objective.words,
    objectiveId: objective.id,
    targetAllocation: objective.targets,
    totalValueUsd: round(holdings.reduce((sum, holding) => sum + holding.valueUsd, 0) + (cashPercent / 100) * total),
    cashPercent: round(cashPercent, 1),
    holdingCount: holdings.length,
    currentAllocation: { equity: inClass('equity'), defensive: inClass('defensive'), cash: round(cashPercent, 1) },
    largestHoldingPercent: round(Math.max(...holdings.map((holding) => holding.weightPercent)), 1),
    heldOutsideTheClientsCurrencyPercent: round(holdings.filter((holding) => holding.currency !== homeCurrency).reduce((sum, holding) => sum + holding.weightPercent, 0), 1),
    adviserNote: note,
    holdings,
    pairCorrelations: pairsOf(holdings),
  };
}

// #region demo:data
/** One holding: an invented weight over a real instrument, with that instrument's own numbers. */
function holdingOf(symbol, weight, total) {
  const shape = profile(symbol);
  const value = round((weight / 100) * total);
  return {
    symbol,
    name: shape.industry ?? shape.sector ?? symbol,
    sector: shape.sector ?? 'Other',
    assetClass: assetClassOf(symbol),
    currency: shape.currency,
    weightPercent: round(weight, 1),
    valueUsd: value,
    price: last(symbol).price,
    twelveMonthReturnPercent: returnOver(symbol),
    volatilityPercent: volatility(symbol),
    worstFallPercent: drawdown(symbol),
    daysOfAverageVolume: round(value / last(symbol).price / Math.max(averageVolume(symbol), 1), 3),
  };
}
// #endregion

/** The three most correlated pairs in the portfolio, so a hidden single bet is visible if you look. */
function pairsOf(holdings) {
  const pairs = [];
  for (let left = 0; left < holdings.length; left++) {
    for (let right = left + 1; right < holdings.length; right++) {
      pairs.push({ pair: `${holdings[left].symbol}/${holdings[right].symbol}`, correlation: correlation(holdings[left].symbol, holdings[right].symbol) });
    }
  }
  return pairs.sort((a, b) => b.correlation - a.correlation).slice(0, 3);
}

/** Spreads a budget over some names, unevenly but adding up. */
const spread = (random, symbols, total) => {
  const raw = symbols.map(() => random.float(0.6, 1.4));
  const sum = raw.reduce((value, entry) => value + entry, 0);
  return Object.fromEntries(symbols.map((symbol, index) => [symbol, round((raw[index] / sum) * total, 1)]));
};

/**
 * Weights built from the plan the client agreed, so only the portfolios meant to have drifted have
 * drifted. `starWeight` carves one name out of the equity budget for the concentration cases.
 */
function weightsFor(random, { objective, equity, defensive, star = null, starWeight = 0, driftBy = 0 }) {
  const targets = objective.targets;
  const defensiveBudget = Math.max(2, targets.defensive - driftBy + random.float(-2, 2));
  const cash = Math.max(1, targets.cash - (driftBy ? random.float(4, 7) : random.float(-1.5, 1.5)));
  const equityBudget = 100 - defensiveBudget - cash;
  const rest = equity.filter((symbol) => symbol !== star);
  return {
    weights: {
      ...(star ? { [star]: round(starWeight, 1) } : {}),
      ...spread(random, rest, equityBudget - (star ? starWeight : 0)),
      ...spread(random, defensive, defensiveBudget),
    },
    cashPercent: cash,
  };
}

/** More than a third of the whole portfolio in one name. */
function concentrated(random) {
  const objective = random.pick(OBJECTIVES);
  const star = random.pick(['NVDA', 'AAPL', 'MSFT', 'XOM']);
  const equity = [star, ...diversified(random, random.int(3, 4), { exclude: [star, ...DEFENSIVE] }).filter((symbol) => !DEFENSIVE.includes(symbol))];
  return portfolio(random, {
    objective,
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 2), star, starWeight: random.float(34, 48) }),
    note: 'Client asked to keep the winner rather than trim it. Nothing has been sold in two years.',
  });
}

/** Several tickers, one bet. */
function oneBet(random) {
  const group = random.pick(ONE_BET);
  const objective = random.pick(OBJECTIVES);
  const others = diversified(random, 2, { exclude: [...group.symbols, ...DEFENSIVE] }).filter((symbol) => !DEFENSIVE.includes(symbol));
  const equity = [...group.symbols, ...others];
  return portfolio(random, {
    objective,
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 1) }),
    note: 'Looks diversified on a pie chart. The large positions are the same story told three ways.',
  });
}

/** A position worth more than half a day of its own trading volume. */
function illiquidTail(random) {
  const thin = random.pick(['XLE', 'PEP']);
  const objective = random.pick(OBJECTIVES);
  const group = ONE_BET.find((entry) => entry.symbols.includes(thin))?.symbols ?? [thin];
  const equity = [thin, ...diversified(random, 3, { exclude: [...group, ...DEFENSIVE] }).filter((symbol) => !DEFENSIVE.includes(symbol))];
  return portfolio(random, {
    objective,
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 2), star: thin, starWeight: random.float(20, 28) }),
    sizeUsd: random.int(2_800, 6_000) * 1_000_000,
    note: 'The position was built slowly over a year and nobody has tried to sell it since.',
  });
}

/**
 * A currency position nobody chose: the client earns and spends in another currency and every holding
 * is priced in dollars, so the whole portfolio is also a bet on the exchange rate.
 */
function currencyBet(random) {
  const objective = random.pick(OBJECTIVES);
  const equity = diversified(random, random.int(4, 5), { exclude: DEFENSIVE });
  return portfolio(random, {
    objective,
    homeCurrency: random.pick(['GBP', 'EUR', 'AED']),
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 2) }),
    note: 'The client earns, spends and retires in their own currency. Everything here is priced in dollars and nothing hedges it.',
  });
}

/** Weights that have wandered a long way from the plan the client agreed. */
function drifted(random) {
  const objective = OBJECTIVES.find((entry) => entry.id === 'income');
  const equity = [...random.sample(['NVDA', 'MSFT', 'AAPL'], 2), ...diversified(random, 2, { exclude: ['NVDA', 'MSFT', 'AAPL', ...DEFENSIVE] })];
  return portfolio(random, {
    objective,
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 1), driftBy: random.float(20, 28) }),
    note: 'Agreed as income three years ago. Nobody has rebalanced since the technology holdings ran.',
  });
}

/** Nothing wrong with these: at plan, spread out, liquid, in the client's own currency. */
function healthy(random) {
  const objective = random.pick(OBJECTIVES);
  const equity = diversified(random, random.int(4, 5), { exclude: DEFENSIVE });
  return portfolio(random, {
    objective,
    ...weightsFor(random, { objective, equity, defensive: random.sample(DEFENSIVE, 2) }),
    note: 'Reviewed in June, rebalanced in July, nothing outstanding.',
  });
}
