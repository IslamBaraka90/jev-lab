// Thirty invented portfolios over real cached instruments. The weights and owner beliefs are
// synthetic; every return, volatility and co-movement number is recomputed from the committed daily
// price cache. Labels stay outside the demo folder.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { correlation, last, MARKET_NOTE, profile, returnOver, volatility } from './lib/market.js';

export const SEED = 1144;

export const FACTORS = ['MOMENTUM', 'VALUE', 'QUALITY', 'SIZE', 'RATES', 'ENERGY', 'FX'];

const REPRESENTATIVES = {
  MOMENTUM: ['NVDA', 'MSFT', 'AAPL'],
  VALUE: ['JPM', 'BAC', 'XOM'],
  QUALITY: ['JNJ', 'PG', 'KO'],
  SIZE: ['SPY', 'WMT', 'MSFT'],
  RATES: ['JPM', 'BAC', 'GLD'],
  ENERGY: ['XOM', 'CVX', 'XLE'],
  FX: ['GLD', 'XOM', 'SPY'],
};

const ARCHETYPES = {
  MOMENTUM: { NVDA: 32, MSFT: 24, AAPL: 21, SPY: 18 },
  VALUE: { BAC: 28, JPM: 27, XOM: 21, CVX: 19 },
  QUALITY: { JNJ: 27, PG: 24, KO: 22, PEP: 17, MSFT: 5 },
  SIZE: { SPY: 30, WMT: 22, MSFT: 20, AAPL: 15, JPM: 8 },
  RATES: { JPM: 29, BAC: 27, GLD: 20, JNJ: 12, SPY: 7 },
  ENERGY: { XOM: 29, CVX: 27, XLE: 25, SPY: 14 },
  FX: { KO: 22, AAPL: 20, XOM: 19, PG: 18, JNJ: 16 },
};

const REVENUE_US = { AAPL: 42, BAC: 94, CVX: 47, GLD: 50, JNJ: 49, JPM: 77, KO: 38, MSFT: 49, NVDA: 45, PEP: 56, PG: 47, SPY: 61, WMT: 76, XLE: 55, XOM: 43 };

const UNINTENDED = {
  MOMENTUM: ['SIZE', 'SIZE', 'NONE', 'SIZE', 'NONE'],
  VALUE: ['ENERGY', 'RATES', 'NONE', 'ENERGY'],
  QUALITY: ['NONE', 'SIZE', 'NONE', 'SIZE'],
  SIZE: ['MOMENTUM', 'NONE', 'MOMENTUM', 'NONE'],
  RATES: ['VALUE', 'VALUE', 'NONE', 'VALUE'],
  ENERGY: ['VALUE', 'VALUE', 'NONE', 'VALUE'],
  FX: ['MOMENTUM', 'NONE', 'MOMENTUM', 'NONE', 'MOMENTUM'],
};

const BELIEFS = {
  MOMENTUM: ['A diversified growth portfolio, not a momentum trade.', 'Broad US leaders with no single style bet.', 'A deliberate momentum allocation.', 'Technology exposure diversified across business models.', 'A high-conviction momentum sleeve.'],
  VALUE: ['A broad value portfolio with limited commodity exposure.', 'Cheap financials, but not a rates bet.', 'A deliberate value allocation.', 'Diversified value across unrelated industries.'],
  QUALITY: ['A deliberate quality allocation.', 'Defensive income with no size tilt.', 'Durable businesses selected for quality.', 'A sector-balanced defensive book.'],
  SIZE: ['A broad market portfolio with no mega-cap bias.', 'A deliberate large-company allocation.', 'Diversified US equities of every size.', 'A deliberate mega-cap allocation.'],
  RATES: ['An income book whose returns should not depend on rates.', 'Diversified financial exposure rather than a macro bet.', 'A deliberate rates-sensitive allocation.', 'Capital preservation with no value tilt.'],
  ENERGY: ['An inflation hedge diversified beyond energy.', 'A real-assets book rather than one sector.', 'A deliberate energy allocation.', 'Diversified value with a small commodity sleeve.'],
  FX: ['A domestic US portfolio with little overseas sensitivity.', 'A deliberate global-revenue allocation.', 'US listings mean US economic exposure.', 'A deliberate foreign-revenue allocation.', 'A domestic portfolio that should track US demand.'],
};

const COUNTS = { MOMENTUM: 5, VALUE: 4, QUALITY: 4, SIZE: 4, RATES: 4, ENERGY: 4, FX: 5 };

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  for (const factor of FACTORS) {
    for (let index = 0; index < COUNTS[factor]; index++) {
      const id = `FE-${String(items.length + 1).padStart(2, '0')}`;
      const unintended = UNINTENDED[factor][index];
      // The global-revenue cases are quality-led in their real price behaviour. FX is the hidden
      // second exposure on the books sold as domestic; energy is second on the two explicitly global
      // books. Keeping that distinction in the labels prevents revenue geography from overriding the
      // stronger cached-price evidence.
      const labelledDominant = factor === 'FX' ? 'QUALITY' : factor;
      const labelledUnintended = factor === 'FX' ? (index % 2 ? 'ENERGY' : 'FX') : unintended;
      const weights = varyWeights(random, ARCHETYPES[factor]);
      const holdings = Object.entries(weights).map(([symbol, weightPercent]) => holding(symbol, weightPercent));
      const declaredMatch = /deliberate|selected for quality/.test(BELIEFS[factor][index]) && unintended === 'NONE';
      items.push({
        id,
        ownerBelief: BELIEFS[factor][index],
        homeCurrency: factor === 'FX' && index % 2 ? 'EUR' : 'USD',
        cashPercent: round(100 - holdings.reduce((sum, entry) => sum + entry.weightPercent, 0), 1),
        holdings,
        sectorWeights: groupWeights(holdings, 'sector'),
        currencyWeights: groupWeights(holdings, 'currency'),
        foreignRevenuePercent: round(holdings.reduce((sum, entry) => sum + (entry.weightPercent / 100) * (100 - entry.revenueFromUsPercent), 0), 1),
        coMovement: Object.fromEntries(FACTORS.map((name) => [name, portfolioCorrelation(holdings, name)])),
      });
      labels.push({ portfolioId: id, dominantFactor: labelledDominant, unintendedFactor: labelledUnintended, beliefMatchesHoldings: declaredMatch, singleFactorPortfolio: labelledUnintended === 'NONE' });
    }
  }
  return {
    dataset: {
      id: 'factor-exposure', class: 'mixed', generatedAt: '2026-09-19', seed,
      source: 'scripts/generate/factor-exposure.js',
      context: {
        pricesAsOf: last('SPY').date,
        note: MARKET_NOTE,
        factorNote: 'These are plain-language teaching buckets, not a licensed factor model or investment advice.',
        coMovementMethod: 'Weighted average of each holding’s 252-trading-day return correlation with the named representative basket.',
        representatives: REPRESENTATIVES,
        factorDefinitions: {
          MOMENTUM: 'A portfolio dominated by recent winners and their shared price behaviour.',
          VALUE: 'A portfolio dominated by banks, mature cash-generative companies and other cheaply priced cyclicals.',
          QUALITY: 'A portfolio dominated by durable, defensive businesses with comparatively steady price behaviour.',
          SIZE: 'A portfolio whose diversification is overwhelmed by the same mega-cap segment.',
          RATES: 'A portfolio dominated by banks, gold and other holdings whose common macro sensitivity is interest rates.',
          ENERGY: 'A portfolio dominated by producers and the broad energy-sector fund.',
          FX: 'A portfolio dominated by revenue earned outside the owner’s home economy or by a currency mismatch.',
        },
      },
      items,
    },
    labels,
  };
}

function varyWeights(random, base) {
  const entries = Object.entries(base);
  const shifts = entries.map(() => random.float(-1.2, 1.2));
  const raw = entries.map(([symbol, weight], index) => [symbol, weight + shifts[index]]);
  const total = raw.reduce((sum, [, weight]) => sum + weight, 0);
  return Object.fromEntries(raw.map(([symbol, weight]) => [symbol, round((weight / total) * 95, 1)]));
}

// #region demo:data
function holding(symbol, weightPercent) {
  const identity = profile(symbol);
  return {
    symbol,
    sector: identity.sector ?? 'Other',
    currency: identity.currency,
    weightPercent,
    revenueFromUsPercent: REVENUE_US[symbol],
    twelveMonthReturnPercent: returnOver(symbol),
    volatilityPercent: volatility(symbol),
    correlations: Object.fromEntries(FACTORS.map((factor) => [factor, representativeCorrelation(symbol, factor)])),
  };
}
// #endregion

function representativeCorrelation(symbol, factor) {
  const peers = REPRESENTATIVES[factor];
  return round(peers.reduce((sum, peer) => sum + correlation(symbol, peer), 0) / peers.length, 3);
}

function portfolioCorrelation(holdings, factor) {
  return round(holdings.reduce((sum, entry) => sum + (entry.weightPercent / 100) * entry.correlations[factor], 0), 3);
}

function groupWeights(holdings, key) {
  const grouped = {};
  for (const holding of holdings) grouped[holding[key]] = round((grouped[holding[key]] ?? 0) + holding.weightPercent, 1);
  return grouped;
}
