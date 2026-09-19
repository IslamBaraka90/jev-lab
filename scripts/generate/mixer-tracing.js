// Ninety traces on an invented graph. Each one follows a wallet's funding back up to five hops and
// says which labelled entities it passed. Twelve sit one hop from a mixer, fourteen two or three hops
// away, nine have an exchange between the subject and the taint — which the desk's own rules say
// breaks the chain — and eight carry amounts that do not add up along the path, which is the quietest
// case in the file. Labels go to data/synthetic/mixer-tracing.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { walletAddress } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1133;

export const ENTITIES = {
  MIXER_A: 'A coin mixer',
  SANCTIONED_ENTITY_B: 'An address on a sanctions list',
  EXCHANGE_C: 'An exchange that checks identity',
  EXCHANGE_F: 'A second exchange that checks identity',
  BRIDGE_D: 'A bridge between chains',
  GAMBLING_E: 'A betting site',
};

export const DESK_RULES = [
  'Taint is followed for five hops and acted on within three.',
  'A deposit into an exchange that checks identity breaks the chain: what comes out the other side is treated as clean.',
  'A bridge does not break the chain. It only changes which chain the money is on.',
  'Amounts have to add up along a path. A hop that passes on more than it received means the path is not what it claims to be.',
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 12; index++) add(trace(random, { hops: 1, source: 'MIXER_A' }), { tainted: true, hops: 'ONE', breaker: false, kind: 'one hop from a mixer' });
  for (let index = 0; index < 14; index++) {
    const depth = random.int(2, 3);
    add(trace(random, { hops: depth, source: random.pick(['MIXER_A', 'SANCTIONED_ENTITY_B']) }), { tainted: true, hops: depth === 2 ? 'TWO' : 'THREE', breaker: false, kind: 'two or three hops away' });
  }
  for (let index = 0; index < 9; index++) {
    const depth = random.int(2, 4);
    add(trace(random, { hops: depth, source: 'MIXER_A', breaker: true }), { tainted: false, hops: depth === 2 ? 'TWO' : depth === 3 ? 'THREE' : 'FOUR_PLUS', breaker: true, kind: 'an exchange broke the chain' });
  }
  for (let index = 0; index < 8; index++) {
    const depth = random.int(2, 4);
    add(trace(random, { hops: depth, source: random.pick(['MIXER_A', 'SANCTIONED_ENTITY_B']), leak: true }), { tainted: true, hops: depth === 2 ? 'TWO' : depth === 3 ? 'THREE' : 'FOUR_PLUS', breaker: false, kind: 'the amounts do not add up' });
  }
  for (let index = 0; index < 47; index++) add(trace(random, { hops: 0 }), { tainted: false, hops: 'NONE_FOUND', breaker: false, kind: 'nothing found' });

  items.sort((left, right) => left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `TRC-${String(index + 1).padStart(3, '0')}`;
    labels.find((label) => label.key === item.key).traceId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'mixer-tracing',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/mixer-tracing.js',
      context: {
        desk: 'Ashcombe Digital',
        currency: 'USD',
        period: 'Traces run in August 2026',
        rules: DESK_RULES,
        entities: Object.entries(ENTITIES).map(([label, what]) => ({ label, what_it_is: what })),
        note: 'A fictional graph of six hundred invented addresses. The entity names are placeholders and match no real service.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One trace: the subject, the funding paths behind it, and what each path passed through. */
function trace(random, { hops, source = null, breaker = false, leak = false }) {
  const subject = walletAddress(random);
  const funded = amount(random, { min: 4_000, max: 800_000, roundTo: 'natural' });
  const main = pathBack(random, { hops, source, breaker, leak, received: funded });
  const others = Array.from({ length: random.int(1, 2) }, () => pathBack(random, { hops: random.int(1, 3), source: null, received: round(funded * random.float(0.05, 0.3)) }));
  const paths = [main, ...others].filter(Boolean);
  const totalIn = round(paths.reduce((sum, path) => sum + path.amount, 0));

  return {
    key: subject,
    id: null,
    subject,
    chain: random.pick(['Ethereum', 'Arbitrum', 'Base']),
    fundingTotal: totalIn,
    pathsFollowed: paths.length,
    longestPathHops: Math.max(...paths.map((path) => path.hops.length)),
    entitiesSeen: [...new Set(paths.flatMap((path) => path.hops.map((hop) => hop.entity).filter(Boolean)))],
    paths: paths.map((path) => ({
      sharePercent: Math.round((path.amount / totalIn) * 100),
      amount: path.amount,
      hops: path.hops,
    })),
    graph: graphOf(subject, paths),
  };
}
// #endregion

/** One path walked backwards from the subject: each hop is where the money was before. */
function pathBack(random, { hops, source, breaker = false, leak = false, received }) {
  const steps = [];
  let carried = received;
  const day = random.int(1, 26);

  for (let index = 0; index < Math.max(hops, 0); index++) {
    const last = index === hops - 1;
    // Walking backwards, each hop held at least as much as the one after it. A leaking path breaks
    // that: one hop shows less money than it went on to pass, which cannot have happened.
    carried = leak && index === Math.max(0, hops - 2) ? round(carried * random.float(0.42, 0.66)) : round(carried * random.float(1, 1.35));
    steps.push({
      wallet: walletAddress(random),
      entity: last ? source : breaker && index === Math.max(0, hops - 2) ? random.pick(['EXCHANGE_C', 'EXCHANGE_F']) : random.bool(0.18) ? 'BRIDGE_D' : null,
      amount: carried,
      at: `2026-08-${String(Math.max(1, day - index * 2)).padStart(2, '0')}`,
    });
  }
  if (!steps.length) {
    steps.push({ wallet: walletAddress(random), entity: random.bool(0.5) ? random.pick(['EXCHANGE_C', 'EXCHANGE_F']) : null, amount: received, at: `2026-08-${String(day).padStart(2, '0')}` });
  }
  return { amount: received, hops: steps };
}

/** The picture the shared graph view draws: the subject in the middle, each path walking outward. */
function graphOf(subject, paths) {
  const nodes = [{ id: subject, label: subject.slice(0, 10), note: 'subject' }];
  const edges = [];
  for (const path of paths) {
    let previous = subject;
    for (const hop of path.hops) {
      nodes.push({ id: hop.wallet, label: hop.entity ?? hop.wallet.slice(0, 10) });
      edges.push({ from: hop.wallet, to: previous, weight: hop.amount });
      previous = hop.wallet;
    }
  }
  return { focus: subject, nodes: nodes.slice(0, 14), edges: edges.slice(0, 16) };
}
