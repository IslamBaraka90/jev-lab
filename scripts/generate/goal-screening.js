// Sixteen real companies and funds, each read against six goals written in plain words: ninety-six
// judgements in all. Everything about the companies is real and cached — four years of statements and
// six years of prices. The goals are the only invented thing here, and there are no labels: this demo
// has no ground truth and its report says so. What it checks instead is consistency.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { averageVolume, candles, drawdown, fundamentals, last, MARKET_NOTE, returnOver, volatility } from './lib/market.js';

export const SEED = 1161;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT', 'GLD', 'SPY', 'XLE', 'BTC-USD'];

/** Six briefs, written the way somebody actually describes what they want. */
export const GOALS = [
  { id: 'income-now', brief: 'I need income now. I want to be paid while I hold this, and I would rather it grew slowly than not pay me at all.' },
  { id: 'ten-years', brief: 'I am putting this away for ten years and I will not look at it. I want the business to be bigger at the end than it is now.' },
  { id: 'preserve', brief: 'This is money I cannot afford to lose. I want it to still be here in three years, ahead of inflation if possible.' },
  { id: 'inflation', brief: 'I want something that holds its value when prices rise, even if it does nothing in a normal year.' },
  { id: 'first-holding', brief: 'This is the first thing I have ever bought. I want something I can understand and will not frighten me.' },
  { id: 'dividend-growth', brief: 'I want a dividend that goes up every year for the next twenty. The size of it today matters less than that.' },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];

  for (const symbol of SYMBOLS) {
    for (const goal of GOALS) items.push(candidate(symbol, goal));
  }

  return {
    dataset: {
      id: 'goal-screening',
      class: 'cached-real',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/goal-screening.js',
      context: {
        pricesAsOf: last('SPY').date,
        goals: GOALS,
        howToRead: 'Every number here comes from the cached statements or the cached prices. Where a statement line is missing it is null, and saying so is one of the questions.',
        note: `${MARKET_NOTE} This demo has no ground truth: nobody can label the right answer to "is this a good fit for my goal". What the report checks is whether the same company is read differently as the goal changes, and whether each disqualifier matches the numbers on the page.`,
      },
      items,
    },
  };
}

/** One company against one goal: the statements, the price behaviour, and the brief. */
function candidate(symbol, goal) {
  const profile = fundamentals(symbol);
  const years = profile.annual.filter((year) => year.revenue !== null).slice(0, 4);
  const latest = years[0] ?? {};
  const oldest = years.at(-1) ?? {};
  const price = last(symbol);

  return {
    id: `${symbol}-${goal.id}`,
    symbol,
    goalId: goal.id,
    goalBrief: goal.brief,
    sector: profile.sector,
    industry: profile.industry,
    statementYears: years.length,
    revenue: latest.revenue ?? null,
    revenueGrowthPercent: growth(latest.revenue, oldest.revenue, years.length),
    grossMarginPercent: ratio(latest.grossProfit, latest.revenue),
    operatingMarginPercent: ratio(latest.operatingIncome, latest.revenue),
    netMarginPercent: ratio(latest.netIncome, latest.revenue),
    totalAssets: latest.totalAssets ?? null,
    totalDebt: latest.totalDebt ?? null,
    debtToAssetsPercent: ratio(latest.totalDebt, latest.totalAssets),
    cash: latest.cash ?? null,
    operatingCashFlow: latest.operatingCashFlow ?? null,
    freeCashFlow: latest.freeCashFlow ?? null,
    dividendsPaid: latest.dividendsPaid ?? null,
    sharesOutstanding: profile.sharesOutstanding ?? null,
    price: price.price,
    priceAsOf: price.date,
    twelveMonthReturnPercent: returnOver(symbol),
    threeYearReturnPercent: returnOver(symbol, 756),
    volatilityPercent: volatility(symbol),
    worstFallPercent: drawdown(symbol, 756),
    averageDailyVolume: averageVolume(symbol),
    annualStatements: years.map(statementLine),
  };
}

// #region demo:data
/** One year of a real company's statements, exactly as the cached file has them. */
function statementLine(year) {
  return {
    fiscalYearEnd: year.fiscalYearEnd,
    revenue: year.revenue,
    operatingIncome: year.operatingIncome,
    netIncome: year.netIncome,
    totalAssets: year.totalAssets,
    totalDebt: year.totalDebt,
    cash: year.cash,
    operatingCashFlow: year.operatingCashFlow,
    freeCashFlow: year.freeCashFlow,
    dividendsPaid: year.dividendsPaid,
  };
}
// #endregion

const ratio = (part, whole) => (typeof part === 'number' && typeof whole === 'number' && whole ? round((part / whole) * 100, 1) : null);

/** Compound growth between the oldest and newest year on file, as a percentage a year. */
function growth(latest, oldest, years) {
  if (typeof latest !== 'number' || typeof oldest !== 'number' || oldest <= 0 || years < 2) return null;
  return round(((latest / oldest) ** (1 / (years - 1)) - 1) * 100, 1);
}
