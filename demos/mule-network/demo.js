// Mule networks: a hundred and twenty accounts, judged one at a time from their own neighbourhood.
// No answer is allowed to see a cluster, so the networks have to be put back together from individual
// roles — and the report scores that per network, not only per account.

import { choice, noul, score } from '../lib/questions.js';

const ROLES = ['COLLECTOR', 'MULE', 'ORIGINATOR', 'UNRELATED'];
const ACTIONS = ['NO_ACTION', 'MONITOR', 'RESTRICT_OUTBOUND', 'FREEZE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** One account's own view: who paid it, who it paid, how long the money stayed, and what it shares. */
function buildState(item, context) {
  return {
    task: 'Decide what part this account plays in the money moving through it, and what the bank should do about it.',
    bank: { name: context.bank, currency: context.currency, period: context.period, what_is_normal: context.baseline },
    account: {
      opened_months_ago: item.openedMonthsAgo,
      type: item.accountType,
      identity_checks: item.kycLevel,
      declared_income: item.declaredIncome,
      shares_a_device_with: item.devicesSharedWith,
      shares_an_address_with: item.addressSharedWith,
    },
    flow: {
      payments_in: item.transfersIn,
      payments_out: item.transfersOut,
      total_in: item.totalIn,
      total_out: item.totalOut,
      people_who_paid_it: item.sendersCount,
      people_it_paid: item.recipientsCount,
      share_of_money_kept_percent: item.keptPercent,
      median_minutes_between_money_in_and_money_out: item.medianMinutesInToOut,
    },
    payments_in: item.incomingTransfers,
    payments_out: item.outgoingTransfers,
  };
}
// #endregion

// #region demo:questions
const questions = {
  role: choice('What part does this account play?', {
    COLLECTOR: 'Money from several accounts ends up here, and leaves in one piece.',
    MULE: 'The account takes money in and passes it on, keeping little or nothing.',
    ORIGINATOR: 'The money starts here and is pushed out to accounts that move it on.',
    UNRELATED: 'An ordinary account. Whatever it looks like, it is doing its own business.',
  }),
  pass_through: noul('Does money leave this account almost as fast as it arrives?', {
    yes: 'Credits are followed by debits within minutes or hours, and little stays behind.',
    no: 'Money sits in the account the way money usually sits in an account.',
  }),
  network_confidence: score('How sure are you that this account is part of an arrangement rather than acting alone?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  action: choice('What should the bank do with this account today?', {
    NO_ACTION: 'Nothing. Leave it alone.',
    MONITOR: 'Watch it, and look again if the pattern repeats.',
    RESTRICT_OUTBOUND: 'Let money in, stop it leaving, and ask the customer.',
    FREEZE: 'Stop the account moving money at all while it is investigated.',
  }),
  income_consistent: noul('Is the money going through this account consistent with the income it declared?', {
    yes: 'The turnover fits what this customer said they earn or turn over.',
    no: 'The account moves far more than the declared income explains.',
  }),
};
// #endregion

// #region demo:evaluate
/** One account's verdict, and the money the bank would be holding if it acted on it. */
function evaluate(answers, item) {
  const action = answers.action.choice;
  const held = action === 'FREEZE' ? item.totalIn - item.totalOut + item.totalOut : action === 'RESTRICT_OUTBOUND' ? item.totalOut : 0;

  return {
    role: answers.role.choice,
    action,
    confidence: answers.role.confidence,
    networkConfidence: answers.network_confidence.score,
    passThrough: answers.pass_through.noul >= 0.5,
    incomeConsistent: answers.income_consistent.noul >= 0.5,
    flagged: answers.role.choice !== 'UNRELATED',
    restricted: action === 'FREEZE' || action === 'RESTRICT_OUTBOUND',
    moneyHeld: Math.round(held),
    label: `${item.id} · ${readable(answers.role.choice)} · ${readable(action)}`,
  };
}
// #endregion

// #region demo:report
/** Accounts are answered one at a time; networks are what the bank actually has to find. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.accountId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const inNetwork = graded.filter((result) => byItem.get(result.item.id).networkId);
  const found = inNetwork.filter((result) => result.evaluation.role === byItem.get(result.item.id).role);
  const ordinary = graded.filter((result) => !byItem.get(result.item.id).networkId);

  return {
    note: `A hundred and twenty accounts, ${inNetwork.length} of them in three arrangements, and a small employer whose payroll fans out like one. ${context.note ?? ''}`,
    findings: findings(graded, byItem, ordinary),
    kpis: kpis({ graded, inNetwork, found, ordinary, byItem, currency: context.currency }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, inNetwork),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

/** How much of each planted network was recovered, by role and by count. */
function networks(graded, byItem) {
  const groups = new Map();
  for (const result of graded) {
    const label = byItem.get(result.item.id);
    if (!label.networkId) continue;
    const entry = groups.get(label.networkId) ?? { id: label.networkId, total: 0, right: 0, flagged: 0, collector: false };
    entry.total += 1;
    if (result.evaluation.role === label.role) entry.right += 1;
    if (result.evaluation.flagged) entry.flagged += 1;
    if (label.role === 'COLLECTOR' && result.evaluation.role === 'COLLECTOR') entry.collector = true;
    groups.set(label.networkId, entry);
  }
  return [...groups.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function kpis({ graded, inNetwork, found, ordinary, byItem, currency }) {
  const recovered = networks(graded, byItem);
  const whole = recovered.filter((entry) => entry.right === entry.total);
  const flaggedOrdinary = ordinary.filter((result) => result.evaluation.flagged);
  const payroll = graded.filter((result) => byItem.get(result.item.id).kind === 'payroll');
  const held = graded.filter((result) => result.evaluation.restricted);

  return [
    { label: 'Networks recovered whole', value: `${whole.length} of ${recovered.length}`, context: recovered.map((entry) => `${entry.id}: ${entry.right} of ${entry.total}`).join(' · '), tone: whole.length === recovered.length ? 'good' : 'warn' },
    { label: 'Roles right', value: `${found.length} of ${inNetwork.length}`, context: 'collectors, mules and originators, each named exactly' },
    { label: 'Ordinary accounts flagged', value: `${flaggedOrdinary.length} of ${ordinary.length}`, context: flaggedOrdinary.length ? `including ${flaggedOrdinary.filter((result) => byItem.get(result.item.id).kind === 'touched a network').length} that only touched a network once` : 'none', tone: flaggedOrdinary.length > 6 ? 'warn' : 'good' },
    { label: 'The payroll cluster', value: `${payroll.filter((result) => !result.evaluation.flagged).length} of ${payroll.length} left alone`, context: 'a joiner paying eleven people on the fifteenth and the twenty-ninth', tone: payroll.every((result) => !result.evaluation.flagged) ? 'good' : 'warn' },
    { label: 'Money the bank would hold', value: money(held.reduce((sum, result) => sum + result.evaluation.moneyHeld, 0), currency), context: `${held.length} accounts restricted or frozen` },
  ];
}

function checks(graded, byItem, labels) {
  const rows = ROLES.filter((role) => role !== 'UNRELATED').map((role) => {
    const group = labels.filter((label) => label.role === role);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.accountId);
      return !result || result.evaluation.role !== role;
    });
    return { id: role.toLowerCase(), label: `${sentence(role)} not named`, detail: questions.role.criteria[role], count: missed.length, of: group.length, items: missed.map((label) => label.accountId) };
  });

  const payroll = graded.filter((result) => byItem.get(result.item.id).kind === 'payroll');
  const flaggedPayroll = payroll.filter((result) => result.evaluation.flagged);
  const touched = graded.filter((result) => byItem.get(result.item.id).kind === 'touched a network');
  const flaggedTouched = touched.filter((result) => result.evaluation.flagged);
  return [
    ...rows,
    { id: 'payroll', label: 'The payroll cluster flagged', detail: 'A small employer and the people it pays. It fans out, on the same two days, every month.', count: flaggedPayroll.length, of: payroll.length, items: flaggedPayroll.map((result) => result.item.id) },
    { id: 'touched', label: 'Accounts that touched a network once, flagged', detail: 'Twelve ordinary accounts that sent one payment to somebody in an arrangement.', count: flaggedTouched.length, of: touched.length, items: flaggedTouched.map((result) => result.item.id) },
  ];
}

function distribution(results) {
  return ROLES
    .map((role) => ({ label: sentence(role), count: results.filter((result) => result.evaluation.role === role).length, tone: role === 'UNRELATED' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Role named against the role the account plays',
    columns: ROLES.map(sentence),
    rows: ROLES.map((actual) => ({
      label: sentence(actual),
      cells: ROLES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).role === actual && result.evaluation.role === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, inNetwork) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const queue = graded.filter((result) => result.evaluation.networkConfidence >= bar);
    const real = queue.filter((result) => byItem.get(result.item.id).networkId);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: queue.length, caught: real.length, rate: queue.length ? Number((real.length / queue.length).toFixed(3)) : null };
  });
  return { title: 'Accounts pulled in at each level of confidence', xLabel: 'Accounts an investigator opens', yLabel: 'Accounts really in an arrangement', rateLabel: 'Share of them that are', of: inNetwork.length, points };
}

function findings(graded, byItem, ordinary) {
  const lines = [];
  const missedCollectors = graded.filter((result) => byItem.get(result.item.id).role === 'COLLECTOR' && result.evaluation.role !== 'COLLECTOR');
  if (missedCollectors.length) lines.push(`${missedCollectors.length} of the three collectors ${missedCollectors.length === 1 ? 'was' : 'were'} named something else: ${missedCollectors.map((result) => `${result.item.id} as ${readable(result.evaluation.role)}`).join(', ')}. The collector is the account the money is for, so missing it leaves the network standing.`);

  const flaggedOrdinary = ordinary.filter((result) => result.evaluation.flagged);
  if (flaggedOrdinary.length >= 3) {
    const touched = flaggedOrdinary.filter((result) => byItem.get(result.item.id).kind === 'touched a network').length;
    lines.push(`${flaggedOrdinary.length} ordinary accounts were given a role in something, ${touched} of them after a single payment to someone in an arrangement. One transfer is not a network.`);
  }

  const passThrough = graded.filter((result) => result.evaluation.passThrough);
  const realPassThrough = passThrough.filter((result) => byItem.get(result.item.id).role === 'MULE');
  if (passThrough.length) lines.push(`Pass-through timing was called on ${passThrough.length} accounts and ${realPassThrough.length} of them are the mules. It is the single field that separates this file.`);
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.restricted)
    .sort((left, right) => right.evaluation.moneyHeld - left.evaluation.moneyHeld || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.networkId ? ` · ${byItem.get(result.item.id).networkId}` : ''}`,
      value: money(result.evaluation.moneyHeld, currency),
    }));
}

export default {
  id: 'mule-network',
  title: 'Mule networks',
  domain: 'fraud',
  value: 'Find the accounts that exist to move other people’s money, and the part each one plays.',
  tags: ['mules', 'networks', 'graph', 'financial crime'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'graph',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.accountType.toLowerCase()} · ${item.transfersIn} in, ${item.transfersOut} out`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/mule-network.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/mule-network.js#demo:data',
    state: 'demos/mule-network/demo.js#demo:state',
    questions: 'demos/mule-network/demo.js#demo:questions',
    evaluate: 'demos/mule-network/demo.js#demo:evaluate',
  },
};
