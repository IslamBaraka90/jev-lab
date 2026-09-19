// Two hundred and forty invented wallets waiting at a deposit desk. Eighteen carry exposure that
// should stop the money, twenty-two are worth a look, and fourteen look alarming and are ordinary:
// a market maker, a bridge relayer, a wallet that slept for three years and woke up once. Every
// address here starts 0xDEMO and belongs to nobody. Bands go to
// data/synthetic/wallet-risk.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { walletAddress } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1131;

/** The labelled entities in this file are fictional, and the demo says so on the page. */
export const ENTITIES = {
  MIXER_A: { kind: 'MIXER', note: 'A coin mixer' },
  SANCTIONED_ENTITY_B: { kind: 'SANCTIONED_ENTITY', note: 'An address on a sanctions list' },
  EXCHANGE_C: { kind: 'EXCHANGE', note: 'A large exchange that checks identity' },
  EXCHANGE_F: { kind: 'EXCHANGE', note: 'A second exchange that checks identity' },
  BRIDGE_D: { kind: 'BRIDGE', note: 'A bridge between chains' },
  GAMBLING_E: { kind: 'GAMBLING', note: 'A betting site' },
  UNKNOWN: { kind: 'UNKNOWN', note: 'Addresses with no label of any kind' },
};

const CHAINS = ['Ethereum', 'Arbitrum', 'Polygon', 'Base'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 6; index++) add(mixerExposed(random), { riskBand: 'high', driver: 'MIXER', kind: 'planted high' });
  for (let index = 0; index < 6; index++) add(sanctionsNeighbour(random), { riskBand: 'high', driver: 'SANCTIONED_ENTITY', kind: 'planted high' });
  for (let index = 0; index < 6; index++) add(gamblingDominated(random), { riskBand: 'high', driver: 'GAMBLING', kind: 'planted high' });
  for (let index = 0; index < 11; index++) add(twoHops(random), { riskBand: 'medium', driver: random.pick(['MIXER', 'SANCTIONED_ENTITY']), kind: 'planted medium' });
  for (let index = 0; index < 11; index++) add(someGambling(random), { riskBand: 'medium', driver: 'GAMBLING', kind: 'planted medium' });
  for (const entry of decoys(random)) add(entry.item, { riskBand: 'low', driver: entry.driver, kind: 'looks bad, is not', look: entry.look });
  for (let index = 0; index < 186; index++) add(ordinary(random), { riskBand: 'low', driver: 'NONE', kind: 'everyday' });

  items.sort((left, right) => left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `W-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).wallet = id;
    labels.find((label) => label.key === item.key).walletId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'wallet-risk',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/wallet-risk.js',
      context: {
        desk: 'Ashcombe Digital',
        currency: 'USD',
        period: 'Deposits offered in August 2026',
        entities: Object.entries(ENTITIES).map(([label, entity]) => ({ label, kind: entity.kind, what_it_is: entity.note })),
        typical: {
          ordinaryWallet: 'A wallet a year or two old, a few hundred transactions, most volume with exchanges, some unlabelled.',
          marketMakers: 'Market makers move enormous volume between exchanges and are not unusual for it.',
          unknownShare: 'Half of all volume on these chains touches addresses nobody has labelled.',
        },
        note: 'Every address, entity and label in this file is invented. The entity names are not real services and the flows are not real flows.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One wallet as a deposit desk sees it: how old, how busy, and who its money came from. */
function wallet(random, { ageDays, transactions, received, sent, mix, hopsToFlagged, nearestFlagged, last30Transactions, last30Received, chain = null, offered }) {
  const address = walletAddress(random);
  return {
    key: address,
    id: null,
    address,
    chain: chain ?? random.pick(CHAINS),
    ageDays,
    transactions,
    totalReceived: received,
    totalSent: sent,
    balance: round(Math.max(0, received - sent)),
    amountOffered: offered,
    counterpartyMix: mix,
    largestCounterparty: mix[0]?.label ?? 'UNKNOWN',
    largestCounterpartySharePercent: mix[0]?.sharePercent ?? 0,
    hopsToFlaggedEntity: hopsToFlagged,
    nearestFlaggedEntity: nearestFlagged,
    transactionsLast30Days: last30Transactions,
    receivedLast30Days: last30Received,
  };
}
// #endregion

/** A mix of counterparties that adds up to a hundred per cent, heaviest first. */
function mixOf(random, parts) {
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  return parts
    .map((part) => ({ label: part.label, kind: ENTITIES[part.label].kind, sharePercent: Math.max(1, Math.round((part.weight / total) * 100)) }))
    .sort((left, right) => right.sharePercent - left.sharePercent);
}

const offer = (random, { min, max }) => amount(random, { min, max, roundTo: 'natural' });

/** Money straight out of a mixer and into the deposit. */
function mixerExposed(random) {
  const received = offer(random, { min: 40_000, max: 900_000 });
  return wallet(random, {
    ageDays: random.int(9, 120),
    transactions: random.int(12, 90),
    received,
    sent: round(received * random.float(0.2, 0.7)),
    mix: mixOf(random, [{ label: 'MIXER_A', weight: random.int(35, 70) }, { label: 'UNKNOWN', weight: random.int(15, 40) }, { label: 'EXCHANGE_C', weight: random.int(5, 20) }]),
    hopsToFlagged: 0,
    nearestFlagged: 'MIXER_A',
    last30Transactions: random.int(6, 40),
    last30Received: round(received * random.float(0.4, 0.9)),
    offered: offer(random, { min: 20_000, max: 300_000 }),
  });
}

/** One hop from an address on a sanctions list. */
function sanctionsNeighbour(random) {
  const received = offer(random, { min: 25_000, max: 600_000 });
  return wallet(random, {
    ageDays: random.int(40, 400),
    transactions: random.int(30, 200),
    received,
    sent: round(received * random.float(0.4, 0.9)),
    mix: mixOf(random, [{ label: 'UNKNOWN', weight: random.int(30, 55) }, { label: 'EXCHANGE_C', weight: random.int(20, 40) }, { label: 'BRIDGE_D', weight: random.int(10, 25) }]),
    hopsToFlagged: 1,
    nearestFlagged: 'SANCTIONED_ENTITY_B',
    last30Transactions: random.int(4, 30),
    last30Received: round(received * random.float(0.1, 0.5)),
    offered: offer(random, { min: 15_000, max: 250_000 }),
  });
}

/** Most of the money came from, and went back to, a betting site. */
function gamblingDominated(random) {
  const received = offer(random, { min: 15_000, max: 300_000 });
  return wallet(random, {
    ageDays: random.int(60, 700),
    transactions: random.int(120, 900),
    received,
    sent: round(received * random.float(0.7, 1)),
    mix: mixOf(random, [{ label: 'GAMBLING_E', weight: random.int(55, 85) }, { label: 'UNKNOWN', weight: random.int(8, 25) }, { label: 'EXCHANGE_F', weight: random.int(5, 15) }]),
    hopsToFlagged: random.int(2, 4),
    nearestFlagged: 'MIXER_A',
    last30Transactions: random.int(30, 200),
    last30Received: round(received * random.float(0.2, 0.6)),
    offered: offer(random, { min: 5_000, max: 90_000 }),
  });
}

/** Two hops away from something flagged, which is worth asking about and not worth refusing over. */
function twoHops(random) {
  const received = offer(random, { min: 8_000, max: 240_000 });
  return wallet(random, {
    ageDays: random.int(120, 1_200),
    transactions: random.int(60, 500),
    received,
    sent: round(received * random.float(0.5, 0.95)),
    mix: mixOf(random, [{ label: 'EXCHANGE_C', weight: random.int(30, 50) }, { label: 'UNKNOWN', weight: random.int(25, 45) }, { label: 'BRIDGE_D', weight: random.int(10, 25) }]),
    hopsToFlagged: 2,
    nearestFlagged: random.pick(['MIXER_A', 'SANCTIONED_ENTITY_B']),
    last30Transactions: random.int(3, 40),
    last30Received: round(received * random.float(0.05, 0.4)),
    offered: offer(random, { min: 4_000, max: 120_000 }),
  });
}

/** A sixth or so of the flow is betting, which is a question rather than an answer. */
function someGambling(random) {
  const received = offer(random, { min: 6_000, max: 150_000 });
  return wallet(random, {
    ageDays: random.int(200, 1_400),
    transactions: random.int(80, 600),
    received,
    sent: round(received * random.float(0.6, 0.95)),
    mix: mixOf(random, [{ label: 'EXCHANGE_C', weight: random.int(35, 55) }, { label: 'GAMBLING_E', weight: random.int(15, 30) }, { label: 'UNKNOWN', weight: random.int(15, 35) }]),
    hopsToFlagged: random.int(3, 5),
    nearestFlagged: 'GAMBLING_E',
    last30Transactions: random.int(5, 60),
    last30Received: round(received * random.float(0.1, 0.45)),
    offered: offer(random, { min: 3_000, max: 60_000 }),
  });
}

/** Fourteen wallets that look wrong at a glance and are exactly what they appear to be. */
function decoys(random) {
  const list = [];
  for (let index = 0; index < 5; index++) {
    const received = offer(random, { min: 8_000_000, max: 90_000_000 });
    list.push({ look: 'a market maker', driver: 'EXCHANGE', item: wallet(random, {
      ageDays: random.int(700, 2_000), transactions: random.int(9_000, 60_000), received, sent: round(received * random.float(0.96, 1)),
      mix: mixOf(random, [{ label: 'EXCHANGE_C', weight: 45 }, { label: 'EXCHANGE_F', weight: 35 }, { label: 'UNKNOWN', weight: 20 }]),
      hopsToFlagged: random.int(3, 6), nearestFlagged: 'GAMBLING_E',
      last30Transactions: random.int(800, 5_000), last30Received: round(received * random.float(0.05, 0.2)),
      offered: offer(random, { min: 200_000, max: 2_000_000 }),
    }) });
  }
  for (let index = 0; index < 5; index++) {
    const received = offer(random, { min: 900_000, max: 12_000_000 });
    list.push({ look: 'a bridge relayer', driver: 'BRIDGE', item: wallet(random, {
      ageDays: random.int(400, 1_400), transactions: random.int(3_000, 20_000), received, sent: round(received * random.float(0.97, 1)),
      mix: mixOf(random, [{ label: 'BRIDGE_D', weight: 70 }, { label: 'EXCHANGE_C', weight: 18 }, { label: 'UNKNOWN', weight: 12 }]),
      hopsToFlagged: random.int(2, 5), nearestFlagged: 'MIXER_A',
      last30Transactions: random.int(200, 2_000), last30Received: round(received * random.float(0.08, 0.25)),
      offered: offer(random, { min: 50_000, max: 600_000 }),
    }) });
  }
  for (let index = 0; index < 4; index++) {
    const received = offer(random, { min: 300_000, max: 3_000_000 });
    list.push({ look: 'three years asleep, one transfer awake', driver: 'NONE', item: wallet(random, {
      ageDays: random.int(1_300, 2_400), transactions: random.int(6, 30), received, sent: round(received * random.float(0, 0.05)),
      mix: mixOf(random, [{ label: 'EXCHANGE_C', weight: 80 }, { label: 'UNKNOWN', weight: 20 }]),
      hopsToFlagged: random.int(4, 7), nearestFlagged: 'MIXER_A',
      last30Transactions: 1, last30Received: round(received * random.float(0.9, 1)),
      offered: offer(random, { min: 100_000, max: 1_500_000 }),
    }) });
  }
  return list;
}

/** The rest: wallets doing what wallets do. */
function ordinary(random) {
  const received = offer(random, { min: 400, max: 180_000 });
  const unknownWeight = random.int(20, 55);
  return wallet(random, {
    ageDays: random.int(30, 1_800),
    transactions: random.int(8, 900),
    received,
    sent: round(received * random.float(0.3, 0.98)),
    mix: mixOf(random, [
      { label: random.pick(['EXCHANGE_C', 'EXCHANGE_F']), weight: random.int(30, 60) },
      { label: 'UNKNOWN', weight: unknownWeight },
      { label: random.pick(['BRIDGE_D', 'EXCHANGE_F', 'UNKNOWN']), weight: random.int(5, 20) },
    ]),
    hopsToFlagged: random.weighted([[3, 30], [4, 30], [5, 25], [6, 15]]),
    nearestFlagged: random.pick(['MIXER_A', 'GAMBLING_E', 'SANCTIONED_ENTITY_B']),
    last30Transactions: random.int(0, 60),
    last30Received: round(received * random.float(0, 0.4)),
    offered: offer(random, { min: 200, max: 60_000 }),
  });
}
