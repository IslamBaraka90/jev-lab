// Mule networks: a hundred and twenty accounts, judged one at a time from their own neighbourhood.
// No answer is allowed to see a cluster, so the networks have to be put back together from individual
// roles — and the report scores that per network, not only per account.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const ROLES = ['COLLECTOR', 'MULE', 'ORIGINATOR', 'UNRELATED'];
const ACTIONS = ['NO_ACTION', 'MONITOR', 'RESTRICT_OUTBOUND', 'FREEZE'];
// The bar the confidence queue is cut at: "Moderate" on the rubric.
const CONFIDENCE_BAR = 3;

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
/** One account's verdict, and the money still in the account if the bank stops it today. */
function evaluate(answers, item) {
  const action = answers.action.choice;
  const stopped = action === 'FREEZE' || action === 'RESTRICT_OUTBOUND';
  // Money that has already left cannot be held: only the month's inflow that has not gone out again.
  const held = stopped ? Math.max(0, item.totalIn - item.totalOut) : 0;

  return {
    role: answers.role.choice,
    action,
    confidence: answers.role.confidence,
    networkConfidence: answers.network_confidence.score,
    passThrough: answers.pass_through.noul >= 0.5,
    incomeConsistent: answers.income_consistent.noul >= 0.5,
    flagged: answers.role.choice !== 'UNRELATED',
    restricted: stopped,
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
    baselines: baselines(graded, byItem),
    metrics: metrics(graded, byItem, inNetwork),
    distribution: distribution(results),
    distributionTitle: 'Roles named',
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, inNetwork),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
    topItemsTitle: 'Accounts restricted or frozen',
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

/** The accounts at or above the confidence bar, and the ones among them that really are in a network. */
function confidenceQueue(graded, byItem) {
  const queue = graded.filter((result) => result.evaluation.networkConfidence >= CONFIDENCE_BAR);
  return { queue, real: queue.filter((result) => byItem.get(result.item.id).networkId) };
}

// The rule: an account that keeps between nothing and a tenth of what came in is a mule; everything else is unrelated.
function ruleRole(item) {
  const passesItOn = item.totalIn > 0 && item.transfersOut > 0 && item.keptPercent !== null && item.keptPercent >= 0 && item.keptPercent <= 10;
  return passesItOn ? 'MULE' : 'UNRELATED';
}

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const rightShare = (pick) => graded.filter((result) => pick(result) === byItem.get(result.item.id).role).length / graded.length;
  return [
    { label: 'Jev', detail: 'role named exactly, all accounts', value: rightShare((result) => result.evaluation.role), model: true },
    { label: 'Rule: keeps a tenth or less of what came in', detail: 'one line over the kept share; calls it a mule, never a collector or an originator', value: rightShare((result) => ruleRole(result.item)) },
    { label: 'Always unrelated', detail: 'the commonest role; finds no network at all', value: rightShare(() => 'UNRELATED') },
  ];
}

/** Flat numbers for the scoreboard. Precision and recall are of "in a network", by the role flag. */
function metrics(graded, byItem, inNetwork) {
  const recovered = networks(graded, byItem);
  const whole = recovered.filter((entry) => entry.right === entry.total);
  const flagged = graded.filter((result) => result.evaluation.flagged);
  const flaggedReal = flagged.filter((result) => byItem.get(result.item.id).networkId);
  const { queue, real } = confidenceQueue(graded, byItem);
  const stats = matrixStats(confusion(graded, byItem));
  return {
    headline: { label: 'Networks recovered whole', value: recovered.length ? whole.length / recovered.length : 0, n: recovered.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: flagged.length ? flaggedReal.length / flagged.length : null,
    recall: inNetwork.length ? flaggedReal.length / inNetwork.length : null,
    precisionAtConfidenceBar: queue.length ? real.length / queue.length : null,
    recallAtConfidenceBar: inNetwork.length ? real.length / inNetwork.length : null,
  };
}

function kpis({ graded, inNetwork, found, ordinary, byItem, currency }) {
  const recovered = networks(graded, byItem);
  const { queue, real: queueReal } = confidenceQueue(graded, byItem);
  const flaggedAll = graded.filter((result) => result.evaluation.flagged);
  const openCollectors = graded.filter((result) => byItem.get(result.item.id).role === 'COLLECTOR' && !result.evaluation.restricted);
  const whole = recovered.filter((entry) => entry.right === entry.total);
  const flaggedOrdinary = ordinary.filter((result) => result.evaluation.flagged);
  const payroll = graded.filter((result) => byItem.get(result.item.id).kind === 'payroll');
  const held = graded.filter((result) => result.evaluation.restricted);
  const heldReal = held.filter((result) => byItem.get(result.item.id).networkId);

  return [
    { label: 'Networks recovered whole', value: `${whole.length} of ${recovered.length}`, context: recovered.map((entry) => `${entry.id}: ${entry.right} of ${entry.total}`).join(' · '), tone: whole.length === recovered.length ? 'good' : 'warn' },
    { label: 'Roles right', value: `${found.length} of ${inNetwork.length}`, context: 'collectors, mules and originators, each named exactly', tone: found.length === inNetwork.length ? 'good' : 'warn' },
    { label: 'Ordinary accounts flagged', value: `${flaggedOrdinary.length} of ${ordinary.length}`, context: flaggedOrdinary.length ? `by the role: ${share(flaggedAll.length - flaggedOrdinary.length, flaggedAll.length)} of what it flags is real · at a network confidence of ${CONFIDENCE_BAR} of 6, ${queueReal.length} of ${queue.length} are (${share(queueReal.length, queue.length)})` : 'none', tone: flaggedOrdinary.length > 6 ? 'warn' : 'good' },
    { label: 'The payroll cluster', value: `${payroll.filter((result) => !result.evaluation.flagged).length} of ${payroll.length} left alone`, context: 'a joiner paying eleven people on the fifteenth and the twenty-ninth', tone: payroll.every((result) => !result.evaluation.flagged) ? 'good' : 'warn' },
    { label: 'Money the bank would hold', value: money(heldReal.reduce((sum, result) => sum + result.evaluation.moneyHeld, 0), currency), context: `inflow not yet passed on, in the ${heldReal.length} network accounts stopped · ${held.length - heldReal.length} innocent accounts stopped too · ${openCollectors.length} collectors left open holding ${money(openCollectors.reduce((sum, result) => sum + Math.max(0, result.item.totalIn - result.item.totalOut), 0), currency)}`, tone: openCollectors.length || held.length > heldReal.length ? 'warn' : 'good' },
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
    rowLabel: 'the role the account plays',
    columnLabel: 'the role the model named',
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
  return { title: 'Accounts pulled in at each level of confidence', xLabel: 'Accounts an investigator opens', yLabel: 'Accounts really in an arrangement', rateLabel: 'Share of them that are', of: inNetwork.length, points, thresholdFormat: 'level', levels: 6, defaultIndex: CONFIDENCE_BAR };
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

  const flagged = graded.filter((result) => result.evaluation.flagged);
  const { queue, real } = confidenceQueue(graded, byItem);
  if (flagged.length > queue.length && queue.length) {
    const flaggedReal = flagged.filter((result) => byItem.get(result.item.id).networkId);
    lines.push(`The confidence score is the sharper instrument. The role question flags ${flagged.length} accounts and ${flaggedReal.length} are in a network (${share(flaggedReal.length, flagged.length)}); a network confidence of ${CONFIDENCE_BAR} of 6 or above pulls ${queue.length} and ${real.length} are (${share(real.length, queue.length)}).`);
  }

  const openCollectors = graded.filter((result) => byItem.get(result.item.id).role === 'COLLECTOR' && !result.evaluation.restricted);
  if (openCollectors.length) lines.push(`${openCollectors.length} ${openCollectors.length === 1 ? 'collector was' : 'collectors were'} named and then left able to move money: ${openCollectors.map((result) => `${result.item.id} (${readable(result.evaluation.action)})`).join(', ')}. The collector is where the money ends up, so that is the account to stop.`);

  const stoppedInnocent = graded.filter((result) => result.evaluation.restricted && !byItem.get(result.item.id).networkId);
  if (stoppedInnocent.length) lines.push(`${stoppedInnocent.length} accounts outside any network were restricted or frozen: ${stoppedInnocent.map((result) => result.item.id).join(', ')}.`);

  const ruleRight = graded.filter((result) => ruleRole(result.item) === byItem.get(result.item.id).role);
  const modelRight = graded.filter((result) => result.evaluation.role === byItem.get(result.item.id).role);
  if (graded.length >= 10 && ruleRight.length > modelRight.length) lines.push(`On role accuracy across all ${graded.length} accounts, a one-line rule on the kept share scores ${ruleRight.length} and the model ${modelRight.length}, because the model gives ${flagged.length - flagged.filter((result) => byItem.get(result.item.id).networkId).length} ordinary accounts a role. The rule names no collector and no originator; the model names them.`);

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
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.networkId ? ` · ${byItem.get(result.item.id).networkId}` : byItem.has(result.item.id) ? ' · not in any network' : ''}`,
      value: money(result.evaluation.moneyHeld, currency),
    }));
}

const levelName = (value) => questions.network_confidence.criteria[Math.max(0, Math.min(6, Math.round(value)))];
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;

/** What a planted account was, in a sentence. Plain ordinary accounts carry no note. */
function plantedNote(label) {
  if (label.networkId) return `Planted as the ${readable(label.role)} in network ${label.networkId}.`;
  if (label.kind === 'payroll') return 'Planted as part of the payroll cluster: an employer paying eleven people on the same two days.';
  if (label.kind === 'touched a network') return 'Planted as an ordinary account that sent one payment to somebody in a network.';
  return undefined;
}

// Right means the role named exactly, which is what "Roles right" and the matrix count.
const grade = {
  labelId: (label) => label.accountId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.role === label.role,
      expected: label.role,
      got: result.evaluation.role,
      note: plantedNote(label),
      confidence: result.answers.role.confidence,
    };
  },
};

function verdict(result, context = {}) {
  const { item, answers, evaluation } = result;
  const stillThere = Math.max(0, item.totalIn - item.totalOut);
  const confidence = evaluation.networkConfidence;
  return {
    eyebrow: 'The part this account plays, and what the bank does',
    headline: `${sentence(evaluation.role)} · ${readable(evaluation.action)}`,
    facts: [
      { label: 'Part of an arrangement', value: `${levelName(confidence)} · ${confidence.toFixed(1)} of 6`, tone: confidence >= 4 ? 'bad' : confidence >= CONFIDENCE_BAR ? 'warn' : 'good' },
      { label: 'Money passes straight through', value: yesNo(answers.pass_through.noul), tone: evaluation.passThrough ? 'bad' : undefined },
      { label: 'Fits the declared income', value: yesNo(answers.income_consistent.noul), tone: evaluation.incomeConsistent ? 'good' : 'warn' },
      { label: 'This month', value: `${money(item.totalIn, context.currency)} in · ${money(item.totalOut, context.currency)} out` },
      { label: 'Inflow not yet passed on', value: money(stillThere, context.currency) },
      { label: 'Confidence in the role', value: `${Math.round(answers.role.confidence * 100)}%` },
    ],
  };
}

const present = {
  number: 125,
  problem: {
    headline: 'A month of transfers between 120 accounts, judged one account at a time. The model never sees a cluster, so the networks have to reassemble from single reads.',
    stat: '120',
    statLabel: 'accounts, 21 of them in three networks',
  },
  hero: {
    item: 'ACC-0022',
    caption: '£7,714 arrives from ACC-0029 at 15:02 and leaves in two halves at 15:09 and 15:12. The account keeps 2%. Mule, 4.8 of 6, freeze.',
  },
  answers: {
    caption: 'The role, whether money passes straight through, how sure the model is that this is an arrangement, and what the bank should do today.',
    reveal: ['role', 'pass_through', 'network_confidence', 'action'],
  },
  miss: {
    item: 'ACC-0061',
    caption: 'A small employer paying its staff: £34,528 out and nothing in. The model called it an originator and froze it, the one error in the payroll cluster.',
  },
  proof: {
    kpis: ['Networks recovered whole', 'Ordinary accounts flagged', 'The payroll cluster'],
    chart: 'curve',
    closing: 'All 3 collectors named from single-account reads, and at a network confidence of 3 of 6, 16 of the 23 accounts pulled are real.',
  },
};

export default {
  id: 'mule-network',
  title: 'Mule networks',
  domain: 'fraud',
  value: 'Find the accounts that exist to move other people’s money, and the part each one plays.',
  tags: ['mules', 'networks', 'graph', 'financial crime'],
  dataClass: 'synthetic',
  readMinutes: 5,
  caveat: 'Ordinary accounts here have no salary or opening balance, so many appear to pay out far more than they receive and the kept share runs as low as −14,225%. That feeds the false positives, and three networks is a small sample; a regenerated dataset is planned.',
  view: 'graph',
  itemLabel: (item) => `${item.id} · ${item.accountType.toLowerCase()} · ${item.transfersIn} in, ${item.transfersOut} out`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/mule-network.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/mule-network.js#demo:data',
    state: 'demos/mule-network/demo.js#demo:state',
    questions: 'demos/mule-network/demo.js#demo:questions',
    evaluate: 'demos/mule-network/demo.js#demo:evaluate',
  },
};
