import { fundamentals, last, MARKET_NOTE } from './lib/market.js';

export const SETS = [
  { id: 'PV-TECH', name: 'Large-cap technology', members: ['NVDA', 'AAPL', 'MSFT', 'GOOGL'], loose: false, note: 'Four operating technology companies with different growth and margin profiles.' },
  { id: 'PV-BANKS', name: 'Large US banks', members: ['JPM', 'BAC', 'WFC', 'C'], loose: false, note: 'Four diversified US banks; cash-flow multiples may be unavailable because bank statements do not map cleanly to industrial free cash flow.' },
  { id: 'PV-ENERGY', name: 'Energy operators', members: ['XOM', 'CVX', 'COP', 'SLB'], loose: true, note: 'Deliberately loose: integrated producers, an upstream producer and an oilfield-services company test whether the model rejects a mechanical comparison.' },
  { id: 'PV-STAPLES', name: 'Defensive staples', members: ['KO', 'PG', 'JNJ', 'WMT', 'PEP'], loose: false, note: 'Five defensive consumer and health franchises with different margin structures.' },
];

export function generate() {
  return {
    dataset: {
      id: 'peer-valuation', class: 'cached-real', generatedAt: '2026-09-19', source: 'data/market/fundamentals/*.json + data/market/candles/*.json',
      context: {
        note: MARKET_NOTE,
        units: 'Statement amounts are whole units of the stated currency; price is the last cached close. Null means unavailable and is never treated as zero.',
        coverage: 'Four named peer sets are retained. ETFs and trusts deliberately remain where specified, even when issuer statements are absent.',
      },
      items: SETS.map((set) => ({ ...set, peers: set.members.map(peerFor) })),
    },
    artifacts: [{ path: 'demos/peer-valuation/sets.json', data: { sets: SETS } }],
  };
}

function peerFor(symbol) {
  const source = fundamentals(symbol);
  const cachedPrice = last(symbol);
  return {
    symbol, sector: source.sector, industry: source.industry, currency: source.currency,
    price: cachedPrice.price, priceDate: cachedPrice.date, sharesOutstanding: source.sharesOutstanding,
    annualStatements: [...source.annual].slice(0, 4).sort((left, right) => left.fiscalYearEnd.localeCompare(right.fiscalYearEnd)).map((year) => ({
      fiscalYearEnd: year.fiscalYearEnd, revenue: year.revenue, operatingIncome: year.operatingIncome, netIncome: year.netIncome,
      operatingCashFlow: year.operatingCashFlow, capitalExpenditure: year.capitalExpenditure,
      totalDebt: year.totalDebt, cash: year.cash, equity: year.equity,
    })),
  };
}
