// A hundred and fifty invented wallets queueing for an allocation. Sixty-two of them are eight people
// wearing more hats than they own, built with the signals farmers actually leave: one funding source,
// creation minutes apart, the same actions in the same order, gas prices copied to the wei, and one
// withdrawal address at the end. Twelve share nothing but an exchange, and six behaved alike because
// they read the same guide. Clusters go to data/synthetic/sybil-clusters.labels.json.

import { createRandom } from './lib/random.js';
import { walletAddress } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1135;

const SIGNALS = ['FUNDING_SOURCE', 'CREATION_TIMING', 'ACTION_SEQUENCE', 'GAS_PATTERN', 'WITHDRAWAL_ENDPOINT'];

const ACTIONS = ['bridge in', 'swap to stable', 'provide liquidity', 'borrow', 'repay', 'stake', 'unstake', 'vote', 'claim', 'swap back', 'bridge out'];
const GUIDE_SEQUENCE = ['bridge in', 'swap to stable', 'provide liquidity', 'vote', 'claim'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const wallets = [];
  const labels = [];
  const add = (wallet, label) => { wallets.push(wallet); labels.push({ key: wallet.key, ...label }); };

  // Eight clusters, each built around the signal its farmer was careless about.
  const plan = [
    { id: 'C1', size: 9, signal: 'FUNDING_SOURCE' },
    { id: 'C2', size: 8, signal: 'FUNDING_SOURCE' },
    { id: 'C3', size: 8, signal: 'CREATION_TIMING' },
    { id: 'C4', size: 7, signal: 'CREATION_TIMING' },
    { id: 'C5', size: 8, signal: 'ACTION_SEQUENCE' },
    { id: 'C6', size: 8, signal: 'ACTION_SEQUENCE' },
    { id: 'C7', size: 7, signal: 'GAS_PATTERN' },
    { id: 'C8', size: 7, signal: 'WITHDRAWAL_ENDPOINT' },
  ];
  for (const entry of plan) {
    for (const wallet of cluster(random, entry)) add(wallet, { clusterId: entry.id, linkingSignal: entry.signal, kind: 'farmed' });
  }
  for (const wallet of sameExchange(random)) add(wallet, { clusterId: null, linkingSignal: 'NONE', kind: 'same exchange, nothing else' });
  for (const wallet of sameGuide(random)) add(wallet, { clusterId: null, linkingSignal: 'NONE', kind: 'read the same guide' });
  for (let index = 0; index < 70; index++) add(independent(random), { clusterId: null, linkingSignal: 'NONE', kind: 'independent' });

  wallets.sort((left, right) => left.key.localeCompare(right.key));
  wallets.forEach((wallet, index) => {
    const id = `SW-${String(index + 1).padStart(3, '0')}`;
    labels.find((label) => label.key === wallet.key).wallet = id;
    labels.find((label) => label.key === wallet.key).walletId = id;
    wallet.id = id;
  });

  // The population counts each wallet is compared against, worked out after everything exists.
  const counts = (field, value) => wallets.filter((entry) => entry[field] === value).length;
  for (const wallet of wallets) {
    wallet.walletsWithTheSameFundingSource = counts('fundingSource', wallet.fundingSource);
    wallet.walletsWithTheSameWithdrawalEndpoint = counts('withdrawalEndpoint', wallet.withdrawalEndpoint);
    wallet.walletsWithTheSameActionSequence = wallets.filter((entry) => entry.actionSequence.join('>') === wallet.actionSequence.join('>')).length;
    wallet.walletsWithinTenMinutesOfCreation = wallets.filter((entry) => Math.abs(Date.parse(entry.createdAt) - Date.parse(wallet.createdAt)) <= 600_000).length;
    wallet.walletsWithTheSameGasPrice = counts('gasPriceGwei', wallet.gasPriceGwei);
    delete wallet.key;
  }
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'sybil-clusters',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/sybil-clusters.js',
      context: {
        programme: 'Kestrel Protocol allocation',
        currency: 'USD',
        period: 'Wallets active between March and August 2026',
        wallets: wallets.length,
        allocationRule: 'Every eligible wallet receives an allocation. Excluding a real user costs more than excluding a farmed one saves, so the bar has to be argued for.',
        similarityNote: 'Each wallet is compared against the population, not against named wallets: the counts say how many wallets share a trait, never which.',
        note: 'Every address in this file is invented and starts 0xDEMO. No real allocation, protocol or user is represented.',
      },
      items: wallets,
    },
    labels,
  };
}

// #region demo:data
/** One wallet as the allocation sees it: when it appeared, what it did, and how it paid for gas. */
function wallet(random, { createdAt, fundingSource, funded, actions, gasPriceGwei, gasStdev, withdrawalEndpoint, allocation }) {
  const address = walletAddress(random);
  return {
    key: address,
    id: null,
    address,
    createdAt,
    fundingSource,
    fundedWith: funded,
    actionCount: actions.length,
    actionSequence: actions,
    daysActive: random.int(4, 150),
    gasPriceGwei,
    gasPriceStdev: gasStdev,
    withdrawalEndpoint,
    allocation,
  };
}
// #endregion

const at = (random, { month = null, day, hour = null, minute = null }) => `2026-0${month ?? random.int(3, 8)}-${String(day).padStart(2, '0')}T${String(hour ?? random.int(0, 23)).padStart(2, '0')}:${String(minute ?? random.int(0, 59)).padStart(2, '0')}:00Z`;

/** One farmer's wallets: alike in the way they were careless, ordinary everywhere else. */
function cluster(random, { size, signal }) {
  const source = `0xDEMO_FUNDER_${random.int(1_000, 9_999)}`;
  const endpoint = `0xDEMO_OUT_${random.int(1_000, 9_999)}`;
  const month = random.int(3, 8);
  const day = random.int(2, 26);
  const hour = random.int(0, 22);
  const sequence = random.sample(ACTIONS, random.int(5, 7));
  const gas = round(random.float(11, 46, 3), 3);

  return Array.from({ length: size }, (_, index) => wallet(random, {
    createdAt: signal === 'CREATION_TIMING' ? at(random, { month, day, hour, minute: index }) : at(random, { day: random.int(1, 28) }),
    fundingSource: signal === 'FUNDING_SOURCE' ? source : `0xDEMO_FUNDER_${random.int(1_000, 9_999)}`,
    funded: amount(random, { min: 120, max: 900 }),
    actions: signal === 'ACTION_SEQUENCE' ? [...sequence] : random.sample(ACTIONS, random.int(4, 8)),
    gasPriceGwei: signal === 'GAS_PATTERN' ? gas : round(random.float(8, 60, 3), 3),
    gasStdev: signal === 'GAS_PATTERN' ? 0 : round(random.float(0.4, 9), 2),
    withdrawalEndpoint: signal === 'WITHDRAWAL_ENDPOINT' ? endpoint : `0xDEMO_OUT_${random.int(1_000, 9_999)}`,
    allocation: amount(random, { min: 400, max: 2_600, roundTo: 'natural' }),
  }));
}

/** Twelve wallets funded from the same exchange, which is what an exchange is for. */
function sameExchange(random) {
  const exchange = '0xDEMO_EXCHANGE_HOTWALLET';
  return Array.from({ length: 12 }, () => wallet(random, {
    createdAt: at(random, { day: random.int(1, 28) }),
    fundingSource: exchange,
    funded: amount(random, { min: 80, max: 4_000 }),
    actions: random.sample(ACTIONS, random.int(3, 9)),
    gasPriceGwei: round(random.float(8, 60, 3), 3),
    gasStdev: round(random.float(1, 12), 2),
    withdrawalEndpoint: `0xDEMO_OUT_${random.int(1_000, 9_999)}`,
    allocation: amount(random, { min: 300, max: 3_000, roundTo: 'natural' }),
  }));
}

/** Six people who did the same five things in the same order because a guide told them to. */
function sameGuide(random) {
  return Array.from({ length: 6 }, () => wallet(random, {
    createdAt: at(random, { day: random.int(1, 28) }),
    fundingSource: `0xDEMO_FUNDER_${random.int(1_000, 9_999)}`,
    funded: amount(random, { min: 60, max: 1_800 }),
    actions: [...GUIDE_SEQUENCE],
    gasPriceGwei: round(random.float(8, 60, 3), 3),
    gasStdev: round(random.float(1, 10), 2),
    withdrawalEndpoint: `0xDEMO_OUT_${random.int(1_000, 9_999)}`,
    allocation: amount(random, { min: 250, max: 2_200, roundTo: 'natural' }),
  }));
}

/** Everyone else: one person, one wallet, their own habits. */
function independent(random) {
  return wallet(random, {
    createdAt: at(random, { day: random.int(1, 28) }),
    fundingSource: random.bool(0.35) ? '0xDEMO_EXCHANGE_HOTWALLET' : `0xDEMO_FUNDER_${random.int(1_000, 9_999)}`,
    funded: amount(random, { min: 40, max: 9_000 }),
    actions: random.sample(ACTIONS, random.int(2, 9)),
    gasPriceGwei: round(random.float(6, 70, 3), 3),
    gasStdev: round(random.float(0.6, 14), 2),
    withdrawalEndpoint: random.bool(0.2) ? '0xDEMO_EXCHANGE_HOTWALLET' : `0xDEMO_OUT_${random.int(1_000, 9_999)}`,
    allocation: amount(random, { min: 200, max: 4_000, roundTo: 'natural' }),
  });
}
