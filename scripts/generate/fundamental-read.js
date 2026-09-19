// A thin, deterministic packaging layer over the committed Yahoo Finance statement cache. Empty ETF
// and crypto statement files remain visible as gaps; no instrument is silently dropped.

import { fundamentals, MARKET_NOTE } from './lib/market.js';

export const SYMBOLS = ['NVDA', 'JPM', 'XOM', 'BTC-USD', 'GLD', 'AAPL', 'MSFT', 'KO', 'PG', 'JNJ', 'CVX', 'BAC', 'WMT', 'PEP', 'XLE', 'SPY'];

export function generate() {
  return {
    dataset: {
      id: 'fundamental-read', class: 'cached-real', generatedAt: '2026-09-19', source: 'data/market/fundamentals/*.json',
      context: {
        note: MARKET_NOTE,
        units: 'All statement amounts are in whole units of the stated reporting currency. Null means the cached provider did not supply the line; zero remains a reported zero.',
        coverage: 'The cache contains four comparable annual statements for operating companies. Quarterly statements were not available from the cached provider response. Funds and crypto may have no issuer financial statements and must remain visible as short-history gaps.',
      },
      items: SYMBOLS.map((symbol) => itemFor(symbol)),
    },
  };
}

function itemFor(symbol) {
  const source = fundamentals(symbol);
  const annualStatements = [...source.annual].slice(0, 4).sort((left, right) => left.fiscalYearEnd.localeCompare(right.fiscalYearEnd));
  return {
    id: `FR-${symbol}`, symbol, sector: source.sector, industry: source.industry,
    currency: source.currency, sharesOutstanding: source.sharesOutstanding,
    annualStatements, quarterlyStatements: [],
    cacheCoverage: { annualYears: annualStatements.length, quarterlyPeriods: 0 },
  };
}
