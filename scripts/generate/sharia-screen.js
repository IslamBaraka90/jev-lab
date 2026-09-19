// Sixteen real companies and funds run against three named rule sets: forty-eight screenings. The
// business descriptions, balance sheets and market values are real and cached. The rule sets are
// written for this demo from published standards, simplified, and attributed in notes.md — they are
// not any body's official text and the page says so.
//
// There are no outcome labels. The ground truth here is arithmetic: the demo computes every ratio it
// asks about, and the report puts its own number beside the answer.

import { fundamentals, last, MARKET_NOTE } from './lib/market.js';

export const SEED = 1163;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT', 'GLD', 'SPY', 'XLE', 'BTC-USD'];

/** Three rule sets, each with its own denominator. Written for this demo, not quoted from anybody. */
export const STANDARDS = [
  {
    id: 'market-cap',
    name: 'Market capitalisation standard',
    denominator: 'market capitalisation, averaged over the last year in the published standards and taken here as the latest value',
    debtLimitPercent: 33,
    liquidAssetsLimitPercent: 33,
    receivablesLimitPercent: 49,
    impureIncomeLimitPercent: 5,
    note: 'The best known of the published screens uses market capitalisation as the denominator, which moves the answer as the price moves.',
  },
  {
    id: 'total-assets',
    name: 'Total assets standard',
    denominator: 'total assets from the latest balance sheet',
    debtLimitPercent: 33,
    liquidAssetsLimitPercent: 33,
    receivablesLimitPercent: 45,
    impureIncomeLimitPercent: 5,
    note: 'Using total assets instead of market capitalisation makes the screen independent of the share price, and usually stricter for a company trading above book.',
  },
  {
    id: 'house',
    name: 'House rules, deliberately stricter',
    denominator: 'total assets from the latest balance sheet',
    debtLimitPercent: 25,
    liquidAssetsLimitPercent: 25,
    receivablesLimitPercent: 35,
    impureIncomeLimitPercent: 3,
    note: 'A stricter in-house set, included so the demo can show the same company passing one standard and failing another.',
  },
];

/** What each company actually does, in the words a screen has to read. */
const BUSINESS = {
  NVDA: 'Designs and sells graphics and data-centre processors. Revenue is hardware and licensed software.',
  MSFT: 'Software, cloud services and devices. A financing arm exists for enterprise customers.',
  AAPL: 'Consumer hardware and services. Services include a payments product and a credit card issued through a partner bank.',
  JPM: 'A universal bank: deposits, lending, trading and asset management. Net interest income is the largest single revenue line.',
  BAC: 'A retail and commercial bank. Interest on loans and securities is the main source of revenue.',
  XOM: 'Exploration, production, refining and chemicals.',
  CVX: 'Exploration, production, refining and chemicals.',
  KO: 'Concentrates and finished non-alcoholic beverages sold through bottlers.',
  PEP: 'Beverages and snack foods. No alcohol. Some products contain pork-derived gelatine in specific markets.',
  PG: 'Household and personal care products.',
  JNJ: 'Pharmaceuticals and medical devices.',
  WMT: 'General retail. Stores sell alcohol, tobacco and pork in most markets, as a minor share of turnover.',
  GLD: 'An exchange traded fund holding allocated physical gold. It holds no equities and files no income statement.',
  SPY: 'An exchange traded fund tracking a broad equity index, including banks and insurers.',
  XLE: 'An exchange traded fund holding energy companies.',
  'BTC-USD': 'A digital asset with no issuer, no balance sheet and no revenue.',
};

export function generate(seed = SEED) {
  const items = [];
  for (const symbol of SYMBOLS) {
    for (const standard of STANDARDS) items.push(screening(symbol, standard));
  }

  return {
    dataset: {
      id: 'sharia-screen',
      class: 'cached-real',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/sharia-screen.js',
      context: {
        standards: STANDARDS,
        activityScreen: [
          'Conventional banking, insurance and any business whose main revenue is interest.',
          'Alcohol, tobacco, pork, gambling, adult entertainment and weapons.',
          'A business that only touches one of these incidentally is judged on the share of revenue it represents.',
        ],
        note: `${MARKET_NOTE} The rule sets here are written for this demo from published standards, simplified, and are not any standards body's official text. Nothing here is a fatwa or a compliance opinion, and the demo shows its own arithmetic beside every answer.`,
      },
      items,
    },
  };
}

// #region demo:data
/** One company under one standard: the business, the balance sheet, and the rules being applied. */
function screening(symbol, standard) {
  const profile = fundamentals(symbol);
  const latest = profile.annual.find((year) => year.totalAssets !== null) ?? {};
  const price = last(symbol);
  const marketCap = profile.marketCap ?? (profile.sharesOutstanding ? Math.round(profile.sharesOutstanding * price.price) : null);
  const byMarketCap = standard.denominator.startsWith('market');

  return {
    id: `${symbol}-${standard.id}`,
    symbol,
    standardId: standard.id,
    standardName: standard.name,
    sector: profile.sector,
    industry: profile.industry,
    business: BUSINESS[symbol],
    fiscalYearEnd: latest.fiscalYearEnd ?? null,
    revenue: latest.revenue ?? null,
    totalAssets: latest.totalAssets ?? null,
    totalDebt: latest.totalDebt ?? null,
    cashAndSecurities: latest.cash ?? null,
    receivables: latest.receivables ?? null,
    interestIncome: latest.interestIncome ?? null,
    interestExpense: latest.interestExpense ?? null,
    marketCap,
    price: price.price,
    priceAsOf: price.date,
    denominator: byMarketCap ? marketCap : latest.totalAssets ?? null,
    denominatorName: standard.denominator,
    debtLimitPercent: standard.debtLimitPercent,
    liquidAssetsLimitPercent: standard.liquidAssetsLimitPercent,
    receivablesLimitPercent: standard.receivablesLimitPercent,
    impureIncomeLimitPercent: standard.impureIncomeLimitPercent,
  };
}
// #endregion
