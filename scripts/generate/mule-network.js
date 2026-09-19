// A hundred and twenty accounts at an invented bank and nine hundred transfers between them over a
// month. Three of the clusters in here exist to move other people's money; one looks exactly like a
// fan-out and is a small employer paying wages. Every account is scored on its own, from its own
// neighbourhood, so the network has to be put back together from individual answers — which is what the
// report measures. Roles go to data/synthetic/mule-network.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { companyName, personName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1125;

const DAYS = { from: '2026-08-01', to: '2026-08-30' };
const CHANNELS = ['Faster payment', 'Standing order', 'Card transfer', 'Branch transfer'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const accounts = Array.from({ length: 120 }, (_, index) => makeAccount(random, index));
  const transfers = [];
  const roles = new Map(accounts.map((account) => [account.id, { role: 'UNRELATED', networkId: null, kind: 'ordinary' }]));
  const at = (day, hour, minute) => `2026-08-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
  const send = (from, to, value, when, channel = 'Faster payment') => transfers.push({ from, to, amount: round(value), at: when, channel });

  // Network one: a straight fan-in. Six mules collect from strangers and push it all to one account.
  fanIn(random, accounts.slice(2, 12), roles, send, at, 'N1', 6, 0, 2);
  // Network two: the same money through two layers, each hop a few minutes after the one before.
  chain(random, accounts.slice(20, 30), roles, send, at, 'N2');
  // Network three: a smaller fan-in, and its collector keeps a slice rather than passing everything on.
  fanIn(random, accounts.slice(40, 48), roles, send, at, 'N3', 4, 0.12);
  // The decoy: a small employer paying eleven people on the same two days every month.
  payroll(random, accounts.slice(60, 72), roles, send, at);
  // Everything else: ordinary trade, including twelve accounts that deal with a network by accident.
  ordinaryTraffic(random, accounts, roles, send, at, transfers);

  const items = accounts.map((account) => withNeighbourhood(account, accounts, transfers));
  const labels = accounts.map((account) => ({ accountId: account.id, ...roles.get(account.id) }));

  return {
    dataset: {
      id: 'mule-network',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/mule-network.js',
      context: {
        bank: 'Wrenfield Bank',
        currency: 'GBP',
        period: 'Transfers between 1 and 30 August 2026',
        accounts: accounts.length,
        transfers: transfers.length,
        baseline: {
          newAccountsUsually: 'An account under a year old moves three to fifteen payments a month, to eight or fewer people.',
          passThroughUsually: 'Most personal accounts hold money for days, not minutes.',
          deviceSharingUsually: 'Sharing a device with another customer happens, mostly inside a family.',
        },
        note: 'Every account is judged on its own neighbourhood. Nothing in the state says which cluster an account belongs to.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One account as the bank holds it, before any transfer is attached to it. */
function makeAccount(random, index) {
  const business = random.bool(0.18);
  return {
    id: `ACC-${String(index + 1).padStart(4, '0')}`,
    holder: business ? `${companyName(random)} Ltd` : personName(random),
    accountType: business ? 'Business' : 'Personal',
    openedMonthsAgo: random.weighted([[random.int(1, 6), 30], [random.int(7, 24), 40], [random.int(25, 140), 30]]),
    kycLevel: random.weighted([['full', 72], ['simplified', 22], ['pending refresh', 6]]),
    declaredIncome: business ? amount(random, { min: 40_000, max: 400_000 }) : amount(random, { min: 12_000, max: 68_000 }),
    devicesSharedWith: [],
    addressSharedWith: [],
  };
}
// #endregion

/** Strangers pay the mules, the mules pay the collector, the collector empties itself out. */
function fanIn(random, group, roles, send, at, networkId, muleCount, retain = 0, originatorCount = 1) {
  const [collector, ...rest] = group;
  const mules = rest.slice(0, muleCount);
  const originators = rest.slice(muleCount, muleCount + originatorCount);
  roles.set(collector.id, { role: 'COLLECTOR', networkId, kind: 'network' });
  for (const mule of mules) roles.set(mule.id, { role: 'MULE', networkId, kind: 'network' });
  for (const originator of originators) roles.set(originator.id, { role: 'ORIGINATOR', networkId, kind: 'network' });

  for (const [index, mule] of mules.entries()) {
    const day = 4 + index * 3;
    let taken = 0;
    for (let payment = 0; payment < random.int(3, 6); payment++) {
      const value = amount(random, { min: 240, max: 1_900 });
      taken += value;
      send(random.pick(originators).id, mule.id, value, at(day, random.int(9, 20), random.int(0, 59)));
    }
    send(mule.id, collector.id, round(taken * random.float(0.94, 0.99)), at(day, random.int(21, 23), random.int(0, 59)));
  }
  const collected = round(random.int(9_000, 24_000) * (1 - retain));
  send(collector.id, group.at(-1).id, collected, at(28, 7, 12), 'Branch transfer');
}

/** The same money, two hops, minutes apart: in at ten past, out at twenty past. */
function chain(random, group, roles, send, at, networkId) {
  const collector = group[0];
  const layerOne = group.slice(1, 3);
  const layerTwo = group.slice(3, 5);
  const originator = group[8];
  roles.set(collector.id, { role: 'COLLECTOR', networkId, kind: 'network' });
  for (const account of [...layerOne, ...layerTwo]) roles.set(account.id, { role: 'MULE', networkId, kind: 'network' });
  roles.set(originator.id, { role: 'ORIGINATOR', networkId, kind: 'network' });

  for (const [index, first] of layerOne.entries()) {
    const day = 6 + index * 4;
    const value = amount(random, { min: 2_400, max: 7_800 });
    const hour = random.int(10, 16);
    send(originator.id, first.id, value, at(day, hour, 2));
    const seconds = layerTwo.slice(index, index + 2);
    for (const [step, second] of seconds.entries()) {
      send(first.id, second.id, round(value / seconds.length * 0.98), at(day, hour, 9 + step * 3));
      send(second.id, collector.id, round((value / seconds.length) * 0.95), at(day, hour, 21 + step * 4));
    }
  }
}

/** Eleven people paid on the same two days by the same employer. It fans out and it is nothing. */
function payroll(random, group, roles, send, at) {
  const [employer, ...staff] = group;
  employer.accountType = 'Business';
  employer.holder = `${companyName(random)} Joinery Ltd`;
  employer.kycLevel = 'full';
  employer.openedMonthsAgo = random.int(48, 130);
  for (const account of group) roles.set(account.id, { role: 'UNRELATED', networkId: null, kind: 'payroll' });
  for (const day of [15, 29]) {
    for (const person of staff) {
      send(employer.id, person.id, amount(random, { min: 1_300, max: 2_600 }), at(day, 6, random.int(0, 30)), 'Standing order');
    }
  }
  for (const person of staff) {
    person.openedMonthsAgo = Math.max(person.openedMonthsAgo, random.int(20, 120));
    send(person.id, `ACC-${String(random.int(85, 119)).padStart(4, '0')}`, amount(random, { min: 200, max: 900 }), at(random.int(17, 27), random.int(9, 20), random.int(0, 59)));
  }
}

/** The rest of the month: bills, rent, shopping, and twelve accounts that touch a network by accident. */
function ordinaryTraffic(random, accounts, roles, send, at, transfers) {
  const outside = accounts.filter((account) => roles.get(account.id).kind === 'ordinary');
  const networkAccounts = accounts.filter((account) => roles.get(account.id).kind === 'network');

  while (transfers.length < 880) {
    const from = random.pick(outside);
    const to = random.pick(outside.filter((account) => account.id !== from.id));
    send(from.id, to.id, amount(random, { min: 15, max: 1_400 }), at(random.int(1, 30), random.int(7, 22), random.int(0, 59)), random.pick(CHANNELS));
  }

  for (const innocent of random.sample(outside, 12)) {
    const other = random.pick(networkAccounts);
    roles.set(innocent.id, { role: 'UNRELATED', networkId: null, kind: 'touched a network' });
    send(innocent.id, other.id, amount(random, { min: 40, max: 600 }), at(random.int(2, 29), random.int(9, 21), random.int(0, 59)), random.pick(CHANNELS));
  }

  // A handful of families share a device, which is ordinary and looks like the thing that is not.
  for (const pair of [[80, 81], [92, 93], [104, 105]]) {
    accounts[pair[0]].devicesSharedWith.push(accounts[pair[1]].id);
    accounts[pair[1]].devicesSharedWith.push(accounts[pair[0]].id);
    accounts[pair[0]].addressSharedWith.push(accounts[pair[1]].id);
    accounts[pair[1]].addressSharedWith.push(accounts[pair[0]].id);
  }
  // The mules in network one were opened from the same two handsets.
  for (const group of [[3, 4, 5], [6, 7, 8]]) {
    for (const index of group) {
      accounts[index].devicesSharedWith = group.filter((other) => other !== index).map((other) => accounts[other].id);
    }
  }
}

/** Everything the account's own page needs: its transfers, its totals, and the graph around it. */
function withNeighbourhood(account, accounts, transfers) {
  const nameOf = new Map(accounts.map((entry) => [entry.id, entry.id]));
  const incoming = transfers.filter((transfer) => transfer.to === account.id);
  const outgoing = transfers.filter((transfer) => transfer.from === account.id);
  const totalIn = round(incoming.reduce((sum, transfer) => sum + transfer.amount, 0));
  const totalOut = round(outgoing.reduce((sum, transfer) => sum + transfer.amount, 0));
  const neighbours = [...new Set([...incoming.map((transfer) => transfer.from), ...outgoing.map((transfer) => transfer.to)])];
  const second = transfers.filter((transfer) => neighbours.includes(transfer.from) || neighbours.includes(transfer.to));

  return {
    ...account,
    transfersIn: incoming.length,
    transfersOut: outgoing.length,
    totalIn,
    totalOut,
    sendersCount: new Set(incoming.map((transfer) => transfer.from)).size,
    recipientsCount: new Set(outgoing.map((transfer) => transfer.to)).size,
    keptPercent: totalIn ? Math.round(((totalIn - totalOut) / totalIn) * 100) : null,
    medianMinutesInToOut: passThroughMinutes(incoming, outgoing),
    incomingTransfers: incoming.slice(-10).map((transfer) => line(transfer.at, transfer.from, transfer.amount, transfer.channel)),
    outgoingTransfers: outgoing.slice(-10).map((transfer) => line(transfer.at, transfer.to, transfer.amount, transfer.channel)),
    graph: {
      focus: account.id,
      nodes: [account.id, ...neighbours, ...new Set(second.flatMap((transfer) => [transfer.from, transfer.to]))]
        .filter((id, index, list) => list.indexOf(id) === index && nameOf.has(id))
        .slice(0, 12)
        .map((id) => (id === account.id ? { id, label: id.replace('ACC-', ''), note: account.accountType.toLowerCase() } : { id, label: id.replace('ACC-', '') })),
      edges: second.slice(0, 14).map((transfer) => ({ from: transfer.from, to: transfer.to, weight: Math.round(transfer.amount) })),
    },
  };
}

/** One transfer on one line, the way a statement reads. */
const line = (at, other, value, channel) => `${at.slice(5, 16).replace('T', ' ')} · ${other} · ${value} · ${channel}`;

/** How long money sits: the median gap between a credit and the next debit, in minutes. */
function passThroughMinutes(incoming, outgoing) {
  const gaps = [];
  for (const credit of incoming) {
    const next = outgoing.find((debit) => debit.at > credit.at);
    if (next) gaps.push(Math.round((Date.parse(next.at) - Date.parse(credit.at)) / 60_000));
  }
  if (!gaps.length) return null;
  const sorted = [...gaps].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
