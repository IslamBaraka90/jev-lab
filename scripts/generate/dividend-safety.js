// Packages the committed fundamentals and last cached close. Ratios and yield are intentionally left
// to the report-only helper, while the model receives the underlying statement lines.

import { fundamentals, last, MARKET_NOTE } from './lib/market.js';
import { SYMBOLS } from './fundamental-read.js';

export function generate() {
  return {
    dataset: {
      id: 'dividend-safety', class: 'cached-real', generatedAt: '2026-09-19', source: 'data/market/fundamentals/*.json + data/market/candles/*.json',
      context: {
        note: MARKET_NOTE,
        units: 'Statement amounts are whole units of the reporting currency. Negative dividendsPaid is a cash outflow. Null means unavailable, not zero.',
        coverage: 'Four annual periods are retained where issuer statements exist. Debt maturities and historical share counts were unavailable in the committed provider cache and are disclosed as unavailable rather than inferred.',
      },
      items: SYMBOLS.map(itemFor),
    },
  };
}

function itemFor(symbol) {
  const source = fundamentals(symbol);
  const price = last(symbol);
  const annualStatements = [...source.annual].slice(0, 4).sort((left, right) => left.fiscalYearEnd.localeCompare(right.fiscalYearEnd)).map((year) => ({
    fiscalYearEnd: year.fiscalYearEnd, dividendsPaid: year.dividendsPaid, netIncome: year.netIncome,
    operatingCashFlow: year.operatingCashFlow, capitalExpenditure: year.capitalExpenditure,
    totalDebt: year.totalDebt, cash: year.cash,
  }));
  return {
    id: `DS-${symbol}`, symbol, sector: source.sector, industry: source.industry, currency: source.currency,
    sharesOutstanding: source.sharesOutstanding, shareCountHistory: [], debtMaturities: [], annualStatements,
    latestPrice: price.price, latestPriceDate: price.date,
    cacheCoverage: { annualYears: annualStatements.length, shareCountTrendAvailable: false, debtMaturitiesAvailable: false },
  };
}
