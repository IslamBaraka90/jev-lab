// Two hundred fictional wallet activity fingerprints. The generator deliberately makes ten wallets
// sit between two types; those labels are kept outside the demo folder so neither the state nor Jev's
// questions can see the answer.

import { createRandom } from './lib/random.js';
import { walletAddress } from './lib/names.js';

export const SEED = 1132;

export const TYPES = ['EXCHANGE', 'MARKET_MAKER', 'MEV_BOT', 'RETAIL', 'BRIDGE', 'SCAM_COLLECTOR'];

const PROFILES = {
  EXCHANGE: { transactions: [18_000, 80_000], inbound: [900, 4_500], outbound: [9_000, 55_000], counterparties: [1_200, 8_000], turnover: [30_000_000, 250_000_000], gas: [1.0, 1.3], sameBlock: [0.01, 0.05], round: [0.08, 0.2], paired: [0.03, 0.12], fixedContract: [0.03, 0.12], repeatedCalls: [0.02, 0.1], freshSources: [0.08, 0.22], sourceAge: [400, 1_300], automation: 6, monitoring: 'CONTINUOUS', hours: 'flat' },
  MARKET_MAKER: { transactions: [12_000, 60_000], inbound: [5_000, 28_000], outbound: [5_000, 28_000], counterparties: [18, 70], turnover: [20_000_000, 180_000_000], gas: [1.1, 1.7], sameBlock: [0.08, 0.22], round: [0.02, 0.1], paired: [0.18, 0.42], fixedContract: [0.08, 0.25], repeatedCalls: [0.25, 0.55], freshSources: [0.03, 0.12], sourceAge: [600, 1_600], automation: 5, monitoring: 'PERIODIC', hours: 'tight' },
  MEV_BOT: { transactions: [8_000, 45_000], inbound: [3_500, 20_000], outbound: [3_500, 20_000], counterparties: [5, 24], turnover: [8_000_000, 95_000_000], gas: [2.2, 5.8], sameBlock: [0.68, 0.96], round: [0, 0.04], paired: [0.5, 0.88], fixedContract: [0.35, 0.75], repeatedCalls: [0.7, 0.98], freshSources: [0.01, 0.08], sourceAge: [500, 1_500], automation: 6, monitoring: 'CONTINUOUS', hours: 'flat' },
  RETAIL: { transactions: [18, 650], inbound: [5, 180], outbound: [5, 210], counterparties: [3, 28], turnover: [2_000, 450_000], gas: [0.75, 1.25], sameBlock: [0, 0.04], round: [0.45, 0.82], paired: [0.02, 0.13], fixedContract: [0.03, 0.18], repeatedCalls: [0.01, 0.12], freshSources: [0.05, 0.25], sourceAge: [180, 1_500], automation: 1, monitoring: 'NONE', hours: 'evening' },
  BRIDGE: { transactions: [2_000, 18_000], inbound: [900, 8_500], outbound: [900, 8_500], counterparties: [100, 1_200], turnover: [4_000_000, 80_000_000], gas: [1.05, 1.8], sameBlock: [0.12, 0.38], round: [0.02, 0.12], paired: [0.76, 0.97], fixedContract: [0.72, 0.98], repeatedCalls: [0.58, 0.92], freshSources: [0.1, 0.35], sourceAge: [250, 1_100], automation: 5, monitoring: 'PERIODIC', hours: 'flat' },
  SCAM_COLLECTOR: { transactions: [320, 1_100], inbound: [300, 1_000], outbound: [1, 4], counterparties: [300, 1_000], turnover: [80_000, 2_500_000], gas: [0.8, 1.4], sameBlock: [0, 0.05], round: [0.2, 0.5], paired: [0, 0.02], fixedContract: [0, 0.08], repeatedCalls: [0, 0.08], freshSources: [0.72, 0.98], sourceAge: [1, 35], automation: 3, monitoring: 'CONTINUOUS', hours: 'bursts' },
};

const midpoint = (left, right) => [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
const blend = (left, right) => Object.fromEntries(Object.entries(left).map(([key, value]) => {
  if (Array.isArray(value)) return [key, midpoint(value, right[key])];
  return [key, value];
}));

const between = (random, [min, max], digits = 0) => digits
  ? random.float(min, max, digits)
  : random.int(Math.round(min), Math.round(max));

const boundedCounts = (random, total, weights) => {
  const raw = weights.map((weight) => weight * random.float(0.88, 1.12, 4));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  const counts = raw.map((value) => Math.max(0, Math.round((value / sum) * total)));
  counts[counts.indexOf(Math.max(...counts))] += total - counts.reduce((acc, value) => acc + value, 0);
  return counts;
};

function hourWeights(style) {
  if (style === 'evening') return [1, 1, 1, 1, 1, 1, 2, 3, 4, 4, 3, 3, 3, 3, 3, 4, 6, 10, 14, 16, 15, 12, 7, 3];
  if (style === 'tight') return [1, 1, 1, 1, 1, 1, 1, 2, 5, 12, 18, 20, 21, 21, 20, 18, 12, 6, 3, 2, 1, 1, 1, 1];
  if (style === 'bursts') return [1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 6, 9, 12, 12, 9, 5, 2, 1];
  return Array(24).fill(1);
}

function amountBuckets(random, type, total) {
  const weights = type === 'SCAM_COLLECTOR' ? [75, 18, 5, 2]
    : type === 'RETAIL' ? [18, 42, 30, 10]
      : type === 'EXCHANGE' ? [48, 32, 15, 5]
        : type === 'MEV_BOT' ? [4, 18, 46, 32]
          : [7, 20, 38, 35];
  const counts = boundedCounts(random, total, weights);
  return [
    { bucket: 'under $100', count: counts[0] },
    { bucket: '$100–$1k', count: counts[1] },
    { bucket: '$1k–$10k', count: counts[2] },
    { bucket: '$10k+', count: counts[3] },
  ];
}

// #region demo:data
function makeWallet(random, type, ambiguousWith = null) {
  const profile = ambiguousWith ? blend(PROFILES[type], PROFILES[ambiguousWith]) : PROFILES[type];
  let inbound = between(random, profile.inbound);
  let outbound = between(random, profile.outbound);
  if (type === 'SCAM_COLLECTOR' && !ambiguousWith) {
    inbound = Math.max(300, inbound);
    outbound = 1;
  }
  const transactions = inbound + outbound;
  const hours = boundedCounts(random, transactions, hourWeights(profile.hours));
  const meanGas = between(random, profile.gas, 2);
  return {
    id: null,
    address: walletAddress(random),
    observationDays: 90,
    transactions,
    inboundTransactions: inbound,
    outboundTransactions: outbound,
    counterparties: between(random, profile.counterparties),
    turnoverUsd: between(random, profile.turnover),
    hourOfDay: hours.map((count, hour) => ({ hour, count })),
    amountBuckets: amountBuckets(random, type, transactions),
    gas: { meanMultipleOfNetwork: meanGas, p95MultipleOfNetwork: Number((meanGas * random.float(1.15, 1.85, 2)).toFixed(2)), replacementRate: random.float(0, Math.min(0.45, meanGas / 10), 3) },
    interactions: { uniqueContracts: between(random, [2, Math.max(4, profile.counterparties[1] / 5)]), repeatedCallShare: between(random, profile.repeatedCalls, 3), fixedContractShare: between(random, profile.fixedContract, 3), sameBlockShare: between(random, profile.sameBlock, 3), pairedInOutShare: between(random, profile.paired, 3) },
    amounts: { roundAmountShare: between(random, profile.round, 3), medianUsd: between(random, [30, Math.max(80, profile.turnover[1] / Math.max(profile.transactions[0], 1) / 3)], 2), p95Usd: between(random, [800, Math.max(2_000, profile.turnover[1] / Math.max(profile.transactions[0], 1) * 2)], 2) },
    fundingSources: { medianAgeDays: between(random, profile.sourceAge), freshUnder7DaysShare: between(random, profile.freshSources, 3), uniqueSources: Math.max(1, Math.round(inbound * random.float(0.18, type === 'EXCHANGE' ? 0.4 : 0.92, 3))) },
  };
}
// #endregion

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const plan = { EXCHANGE: 34, MARKET_MAKER: 34, MEV_BOT: 33, RETAIL: 33, BRIDGE: 33, SCAM_COLLECTOR: 33 };
  const ambiguous = new Map([
    ['RETAIL', { count: 5, with: 'MEV_BOT' }],
    ['EXCHANGE', { count: 5, with: 'BRIDGE' }],
  ]);
  const entries = [];

  for (const type of TYPES) {
    for (let index = 0; index < plan[type]; index++) {
      const rule = ambiguous.get(type);
      const ambiguousWith = rule && index < rule.count ? rule.with : null;
      entries.push({ item: makeWallet(random, type, ambiguousWith), type, ambiguousWith });
    }
  }

  random.shuffle(entries).forEach((entry, index) => {
    entry.item.id = `WPF-${String(index + 1).padStart(4, '0')}`;
  });
  const items = entries.map((entry) => entry.item).sort((a, b) => a.id.localeCompare(b.id));
  const labels = entries.map((entry) => ({ wallet: entry.item.id, walletId: entry.item.id, type: entry.type, ambiguous: Boolean(entry.ambiguousWith), ambiguousWith: entry.ambiguousWith, automation: PROFILES[entry.type].automation })).sort((a, b) => a.wallet.localeCompare(b.wallet));

  return {
    dataset: {
      id: 'wallet-profiling',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/wallet-profiling.js',
      context: {
        period: 'A ninety-day behavioural observation window',
        caveat: 'Every wallet address and activity record is fictional. A behavioural profile is an operational hypothesis, not proof of identity or wrongdoing.',
        monitoringPolicy: {
          NONE: 'No monitoring beyond ordinary controls.',
          PERIODIC: 'Review when the behaviour materially changes.',
          CONTINUOUS: 'Keep the fingerprint under continuous automated monitoring.',
        },
      },
      items,
    },
    labels,
  };
}
