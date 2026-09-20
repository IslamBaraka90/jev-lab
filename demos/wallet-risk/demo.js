// Wallet risk scoring: two hundred and forty wallets offering a deposit, graded before the money is
// taken. The score is only half of it — the demo also asks what drove the score, and the report checks
// that the driver matches the exposure that was actually planted.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const EXPOSURES = ['MIXER', 'SANCTIONED_ENTITY', 'GAMBLING', 'BRIDGE', 'EXCHANGE', 'NONE'];
const DECISIONS = ['ACCEPT', 'REVIEW', 'REJECT'];
const BAND_FLOOR = { high: 4, medium: 2 };
const RISK_WORDS = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Severe'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);
const total = (results) => results.reduce((sum, result) => sum + result.item.amountOffered, 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The wallet's shape and company: how old, how busy, whose money, and how far from something flagged. */
function buildState(item, context) {
  return {
    task: 'Grade this wallet before the deposit is taken, name what drives the grade, and decide whether to accept it.',
    desk: { name: context.desk, currency: context.currency, what_is_normal: context.typical, labelled_entities: context.entities, note: context.note },
    wallet: {
      address: item.address,
      chain: item.chain,
      age_days: item.ageDays,
      transactions: item.transactions,
      total_received: item.totalReceived,
      total_sent: item.totalSent,
      balance: item.balance,
      transactions_last_30_days: item.transactionsLast30Days,
      received_last_30_days: item.receivedLast30Days,
    },
    deposit_offered: item.amountOffered,
    counterparty_mix: item.counterpartyMix,
    distance: { hops_to_the_nearest_flagged_entity: item.hopsToFlaggedEntity, which_entity: item.nearestFlaggedEntity },
  };
}
// #endregion

// #region demo:questions
const questions = {
  risk: score('How risky is taking money from this wallet?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Severe',
  ]),
  main_exposure: choice('What drives that grade?', {
    MIXER: 'Money that has been through a mixer.',
    SANCTIONED_ENTITY: 'A listed address, at or near this wallet.',
    GAMBLING: 'Betting flow making up much of what this wallet does.',
    BRIDGE: 'Volume moving across chains through a bridge.',
    EXCHANGE: 'Exchange flow, which is where most ordinary volume goes.',
    NONE: 'Nothing here drives a grade. The wallet is unremarkable.',
  }),
  decision: choice('What happens to this deposit?', {
    ACCEPT: 'Take the money.',
    REVIEW: 'Hold it and ask the customer where it came from.',
    REJECT: 'Refuse the deposit.',
  }),
  exposure_direct: noul('Is the exposure direct rather than several hops away?', {
    yes: 'This wallet dealt with the flagged or risky entity itself.',
    no: 'Whatever it is sits at a distance, through other addresses.',
  }),
  activity_consistent: noul('Does the activity fit what this wallet appears to be?', {
    yes: 'The volume, the count and the counterparties tell one story.',
    no: 'The shape of the activity does not fit the kind of wallet this looks like.',
  }),
};
// #endregion

// #region demo:evaluate
/** The grade, the driver, and the money it would let through or hold back. */
function evaluate(answers, item) {
  const risk = answers.risk.score;
  const decision = answers.decision.choice;

  return {
    risk,
    band: risk >= BAND_FLOOR.high ? 'high' : risk >= BAND_FLOOR.medium ? 'medium' : 'low',
    exposure: answers.main_exposure.choice,
    decision,
    direct: answers.exposure_direct.noul >= 0.5,
    consistent: answers.activity_consistent.noul >= 0.5,
    accepted: decision === 'ACCEPT',
    rejected: decision === 'REJECT',
    confidence: answers.main_exposure.confidence,
    label: `${item.id} · ${readable(decision)} · ${money(item.amountOffered)}${answers.main_exposure.choice === 'NONE' ? '' : ` · ${readable(answers.main_exposure.choice)}`}`,
  };
}
// #endregion

// #region demo:report
/** Two questions at once: is the grade right, and would the desk have taken the money anyway. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.wallet, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const high = graded.filter((result) => byItem.get(result.item.id).riskBand === 'high');
  const takenHigh = high.filter((result) => result.evaluation.accepted);
  const lowBand = graded.filter((result) => byItem.get(result.item.id).riskBand === 'low');
  const right = graded.filter((result) => decisionFits(result, byItem.get(result.item.id)));
  const matrix = confusion(graded, byItem);
  const rows = baselines(graded, byItem, right);

  return {
    note: `Two hundred and forty wallets. ${high.length} carry exposure that should stop the money, ${graded.filter((result) => byItem.get(result.item.id).riskBand === 'medium').length} are worth asking about, and ${labels.filter((label) => label.kind === 'looks bad, is not').length} look alarming and are ordinary. ${context.note ?? ''}`,
    findings: findings(graded, byItem, rows),
    kpis: kpis({ graded, high, takenHigh, lowBand, right, byItem, currency: context.currency }),
    baselines: rows,
    metrics: metrics(graded, byItem, right, matrix),
    distribution: distribution(results),
    distributionTitle: 'What happened to the deposits',
    matrix,
    curve: coverage(graded, byItem, high),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
    topItemsTitle: 'Largest deposits held or refused',
  };
}
// #endregion

/** A deposit is handled right when exposure stops it for a person and an ordinary wallet is not stopped. */
const shouldStop = (label) => label.riskBand !== 'low';
const stopped = (result) => !result.evaluation.accepted;
const decisionFits = (result, label) => stopped(result) === shouldStop(label);

const mixShare = (item, kind) => item.counterpartyMix.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.sharePercent, 0);

// The rule: stop the deposit if the wallet is within two hops of a flagged entity, has any mixer or
// listed flow, or a tenth or more of its flow is betting.
function ruleStops(item) {
  if (item.hopsToFlaggedEntity <= 2) return true;
  if (mixShare(item, 'MIXER') + mixShare(item, 'SANCTIONED_ENTITY') > 0) return true;
  return mixShare(item, 'GAMBLING') >= 10;
}

function baselines(graded, byItem, right) {
  if (!graded.length) return [];
  const ruleRight = graded.filter((result) => ruleStops(result.item) === shouldStop(byItem.get(result.item.id)));
  const ordinary = graded.filter((result) => !shouldStop(byItem.get(result.item.id)));
  return [
    { label: 'Jev', detail: 'deposit stopped when it should be, taken when it should be', value: right.length / graded.length, count: right.length, model: true },
    { label: 'Rule: hops, mixer or listed flow, betting share', detail: 'five lines of code over the hop count and the counterparty mix', value: ruleRight.length / graded.length, count: ruleRight.length },
    { label: 'Always accept', detail: 'the commonest right answer in this file', value: ordinary.length / graded.length, count: ordinary.length },
  ];
}

function metrics(graded, byItem, right, matrix) {
  const held = graded.filter(stopped);
  const needed = graded.filter((result) => shouldStop(byItem.get(result.item.id)));
  const heldRight = held.filter((result) => shouldStop(byItem.get(result.item.id)));
  const rate = (part, whole) => (whole ? part / whole : null);
  return {
    headline: { label: 'Decision fits the wallet', value: rate(right.length, graded.length) ?? 0, n: graded.length },
    accuracy: rate(right.length, graded.length),
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    precision: rate(heldRight.length, held.length),
    recall: rate(heldRight.length, needed.length),
  };
}

function kpis({ graded, high, takenHigh, lowBand, right, byItem, currency }) {
  const driverRight = high.filter((result) => result.evaluation.exposure === byItem.get(result.item.id).driver);
  const rejectedLow = lowBand.filter((result) => result.evaluation.rejected);
  const heldLow = lowBand.filter(stopped);
  const bar = split(graded, byItem);

  return [
    { label: 'Decision fits the wallet', value: `${right.length} of ${graded.length}`, context: `${share(right.length, graded.length)}: exposure held or refused, ordinary wallets accepted`, tone: right.length >= graded.length * 0.9 ? 'good' : 'warn' },
    { label: 'High-risk money refused or held', value: `${high.length - takenHigh.length} of ${high.length}`, context: takenHigh.length ? `${money(total(takenHigh), currency)} of it would have been taken` : 'none of it was accepted', tone: takenHigh.length ? 'warn' : 'good' },
    { label: 'Ordinary deposits held or refused', value: `${heldLow.length} of ${lowBand.length}`, context: `${money(total(heldLow), currency)} of clean money waiting on a person; ${money(total(rejectedLow), currency)} of ordinary deposits turned away`, tone: heldLow.length ? 'warn' : 'good' },
    { label: 'A bar that splits the file', value: bar.label, context: `${bar.detail}${bar.clean ? '; fitted on this same file' : ''}`, tone: bar.clean ? 'good' : 'warn' },
    { label: 'Driver named on the high-risk wallets', value: `${driverRight.length} of ${high.length}`, context: 'mixer, sanctions or gambling, exactly', tone: driverRight.length === high.length ? 'good' : 'warn' },
  ];
}

/**
 * Whether one number on the scale separates the high-risk wallets from everything else. A model can
 * grade a file perfectly well without using the words at the top of a rubric, and this says so.
 */
function split(graded, byItem) {
  const scores = (band) => graded.filter((result) => byItem.get(result.item.id).riskBand === band).map((result) => result.evaluation.risk);
  const high = scores('high');
  const rest = graded.filter((result) => byItem.get(result.item.id).riskBand !== 'high').map((result) => result.evaluation.risk);
  if (!high.length || !rest.length) return { label: '–', detail: 'nothing to separate', clean: false };

  const lowestHigh = Math.min(...high);
  const highestRest = Math.max(...rest);
  if (lowestHigh > highestRest) {
    const bar = Math.round(((lowestHigh + highestRest) / 2) * 10) / 10;
    return { label: `${bar} of 6`, detail: `every high-risk wallet scored ${lowestHigh.toFixed(2)} or more and nothing else went above ${highestRest.toFixed(2)}`, clean: true };
  }
  const overlap = rest.filter((value) => value >= lowestHigh).length;
  return { label: 'none', detail: `${overlap} wallets that are not high risk score at or above the lowest high-risk wallet (${lowestHigh.toFixed(2)})`, clean: false };
}

function checks(graded, byItem, labels) {
  const rows = ['MIXER', 'SANCTIONED_ENTITY', 'GAMBLING'].map((driver) => {
    const group = labels.filter((label) => label.riskBand === 'high' && label.driver === driver);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.wallet);
      return !result || result.evaluation.accepted;
    });
    return { id: driver.toLowerCase(), label: `${sentence(driver)} wallets whose deposit was accepted`, detail: questions.main_exposure.criteria[driver], count: missed.length, of: group.length, items: missed.map((label) => label.wallet) };
  });

  const decoyList = labels.filter((label) => label.kind === 'looks bad, is not');
  // A held deposit costs the customer too, so these two count REVIEW as well as REJECT.
  const refusedDecoys = decoyList.filter((label) => graded.some((result) => result.item.id === label.wallet && stopped(result)));
  const ordinary = graded.filter((result) => byItem.get(result.item.id).kind === 'everyday');
  const refusedOrdinary = ordinary.filter(stopped);
  return [
    ...rows,
    { id: 'decoys', label: 'Big, busy, ordinary wallets held or refused', detail: 'A market maker, a bridge relayer, and a wallet that slept three years and woke up once.', count: refusedDecoys.length, of: decoyList.length, items: refusedDecoys.map((label) => label.wallet) },
    { id: 'ordinary', label: 'Everyday wallets held or refused', detail: 'The rest of the file: nothing about these asks for a question.', count: refusedOrdinary.length, of: ordinary.length, items: refusedOrdinary.slice(0, 20).map((result) => result.item.id) },
  ];
}

function distribution(results) {
  return DECISIONS
    .map((decision) => ({ label: sentence(decision), count: results.filter((result) => result.evaluation.decision === decision).length, tone: decision === 'ACCEPT' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  const sides = [{ label: 'Hold or refuse', stop: true }, { label: 'Accept', stop: false }];
  return {
    title: 'What the wallet called for against what happened to the deposit',
    rowLabel: 'what the planted exposure calls for',
    columnLabel: 'what the model decided',
    columns: sides.map((side) => side.label),
    rows: sides.map((actual) => ({
      label: actual.label,
      cells: sides.map((predicted) => ({
        predicted: predicted.label,
        count: graded.filter((result) => shouldStop(byItem.get(result.item.id)) === actual.stop && stopped(result) === predicted.stop).length,
        diagonal: actual.stop === predicted.stop,
      })),
    })),
  };
}

function coverage(graded, byItem, high) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const held = graded.filter((result) => result.evaluation.risk >= bar);
    const real = held.filter((result) => byItem.get(result.item.id).riskBand === 'high');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: held.length, caught: real.length, rate: held.length ? Number((real.length / held.length).toFixed(3)) : null };
  });
  return { title: 'Where the desk draws its line', xLabel: 'Wallets held at this grade or above', yLabel: 'High-risk wallets among them', rateLabel: 'Share of the held wallets that are high risk', of: high.length, thresholdFormat: 'level', levels: 6, defaultIndex: 4, points };
}

function findings(graded, byItem, rows = []) {
  const lines = [];
  const [model, rule] = rows;
  if (model && rule && rule.count > model.count) {
    lines.push(`A five-line rule over the hop count and the counterparty mix handles ${rule.count} of ${graded.length} deposits correctly; the model handles ${model.count}. The labels follow the hop count and the mix closely, so this file cannot show the model beating a rules engine.`);
  }

  const clean = graded.filter((result) => !shouldStop(byItem.get(result.item.id)));
  const heldClean = clean.filter(stopped);
  if (heldClean.length) {
    const decoys = graded.filter((result) => byItem.get(result.item.id).kind === 'looks bad, is not');
    const heldDecoys = decoys.filter(stopped);
    lines.push(`${heldClean.length} of ${clean.length} ordinary deposits were held or refused: ${money(total(heldClean))} of clean money waiting on a person. ${heldDecoys.length} of the ${decoys.length} large-but-ordinary wallets are among them, worth ${money(total(heldDecoys))}.`);
  }

  const bandRight = graded.filter((result) => result.evaluation.band === byItem.get(result.item.id).riskBand);
  if (graded.length && bandRight.length < graded.length / 2 && split(graded, byItem).clean) {
    lines.push(`Read by the rubric's own words (four of six is "high", under two is "low") the band matches the label on only ${bandRight.length} of ${graded.length} wallets. The scores sit in the middle of the scale: the ranking is sound and the absolute numbers are not.`);
  }

  const taken = graded.filter((result) => byItem.get(result.item.id).riskBand === 'high' && result.evaluation.accepted);
  if (taken.length) lines.push(`${taken.length} high-risk ${taken.length === 1 ? 'deposit was' : 'deposits were'} accepted, worth ${money(total(taken))}: ${taken.map((result) => `${result.item.id} (${readable(byItem.get(result.item.id).driver)})`).join(', ')}.`);

  const refusedDecoys = graded.filter((result) => byItem.get(result.item.id).kind === 'looks bad, is not' && result.evaluation.rejected);
  if (refusedDecoys.length >= 2) {
    const looks = [...new Set(refusedDecoys.map((result) => byItem.get(result.item.id).look))];
    lines.push(`${refusedDecoys.length} of the fourteen large-but-ordinary wallets were refused, worth ${money(total(refusedDecoys))}: ${looks.join(', ')}. Size is not exposure.`);
  }

  const wrongDriver = graded.filter((result) => byItem.get(result.item.id).riskBand === 'high' && result.evaluation.exposure !== byItem.get(result.item.id).driver);
  if (wrongDriver.length >= 2) {
    const pairs = wrongDriver.map((result) => `${readable(byItem.get(result.item.id).driver)} read as ${readable(result.evaluation.exposure)}`);
    lines.push(`${wrongDriver.length} high-risk wallets were graded high for the wrong reason: ${[...new Set(pairs)].slice(0, 3).join('; ')}. The grade survives; the reason on the file does not.`);
  }
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => !result.evaluation.accepted)
    .sort((left, right) => right.item.amountOffered - left.item.amountOffered)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label} · ${byItem.get(result.item.id)?.riskBand ?? 'low'} risk`,
      value: money(result.item.amountOffered, currency),
    }));
}

const PLANTED_NOTE = {
  'planted high': (label) => `Planted high risk: ${readable(label.driver)} exposure that should stop the money.`,
  'planted medium': () => 'Planted medium risk: two hops from something flagged, or a share of betting flow. Worth a question.',
  'looks bad, is not': (label) => `Planted decoy: ${label.look}. Large and ordinary.`,
};

/** Right means the deposit was stopped when the label carries exposure and taken when it does not. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: decisionFits(result, label),
    expected: shouldStop(label) ? 'hold or refuse' : 'accept',
    got: readable(result.evaluation.decision),
    note: PLANTED_NOTE[label.kind]?.(label),
    confidence: result.answers.decision.confidence,
  };
}

const RISK_BAR = 3.6;
const DECISION_WORDS = { ACCEPT: 'Accept', REVIEW: 'Hold for review', REJECT: 'Refuse' };
const level = (value, words) => `${words[Math.round(value)]} · ${value.toFixed(1)} of ${words.length - 1}`;
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;

function verdict(result, context = {}) {
  const { item, answers, evaluation } = result;
  const driverIsBad = ['MIXER', 'SANCTIONED_ENTITY', 'GAMBLING'].includes(evaluation.exposure);
  return {
    eyebrow: 'What happens to this deposit',
    headline: `${DECISION_WORDS[evaluation.decision]} · ${money(item.amountOffered, context.currency)}`,
    detail: `Nearest flagged entity: ${item.nearestFlaggedEntity}, ${item.hopsToFlaggedEntity} ${item.hopsToFlaggedEntity === 1 ? 'hop' : 'hops'} away.`,
    facts: [
      { label: 'Risk', value: level(evaluation.risk, RISK_WORDS), tone: evaluation.risk >= RISK_BAR ? 'bad' : evaluation.risk >= 3 ? 'warn' : 'good' },
      { label: 'What drives it', value: `${sentence(evaluation.exposure)} · ${Math.round(answers.main_exposure.confidence * 100)}%`, tone: driverIsBad ? 'warn' : undefined },
      { label: 'Exposure is direct', value: yesNo(answers.exposure_direct.noul), tone: evaluation.direct ? 'bad' : 'good' },
      { label: 'Activity fits the wallet', value: yesNo(answers.activity_consistent.noul), tone: evaluation.consistent ? 'good' : 'warn' },
      { label: 'Confidence in the decision', value: `${Math.round(answers.decision.confidence * 100)}%` },
    ],
  };
}

export default {
  id: 'wallet-risk',
  title: 'Wallet risk scoring',
  domain: 'crypto',
  value: 'Score a wallet before you take its money, and name the exposure that drove the score.',
  tags: ['crypto', 'wallets', 'screening', 'deposits'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  caveat: 'The labels in this file follow the hop count and the counterparty mix so closely that a five-line rule handles 237 of 240 deposits. This run measures reading the state, not judgement; a harder file is planned.',
  stage: {
    hide: ['largestCounterparty', 'largestCounterpartySharePercent'],
    labels: {
      amountOffered: 'Deposit offered',
      ageDays: 'Wallet age (days)',
      hopsToFlaggedEntity: 'Hops to the nearest flagged entity',
      nearestFlaggedEntity: 'Nearest flagged entity',
      transactionsLast30Days: 'Transactions, last 30 days',
      receivedLast30Days: 'Received, last 30 days',
      counterpartyMix: 'Counterparty mix',
      label: 'Counterparty',
      sharePercent: 'Share of flow (%)',
    },
    highlight: ['amountOffered', 'hopsToFlaggedEntity', 'nearestFlaggedEntity'],
  },
  grade: { labelId: (label) => label.wallet, judge },
  verdict,
  present: {
    number: 131,
    problem: {
      headline: 'A deposit is offered. Before it lands, someone has to say whose money it is.',
      stat: '240',
      statLabel: 'wallets offering a deposit',
    },
    hero: {
      item: 'W-0151',
      caption: '$218,926 offered by a wallet with 56% of its flow from a mixer, zero hops away. Refused, risk 5.3 of 6, driver named as the mixer.',
    },
    answers: {
      caption: 'A grade, the exposure that drives it, and one of three lanes for the money.',
      reveal: ['risk', 'main_exposure', 'decision'],
    },
    miss: {
      item: 'W-0032',
      caption: 'A market maker offering $1,975,736: 80% exchange flow, three hops from a betting site. Held for review at 2.8 of 6. Size is not exposure.',
    },
    proof: {
      kpis: ['High-risk money refused or held', 'Ordinary deposits held or refused', 'Decision fits the wallet'],
      chart: 'baselines',
      closing: '18 of 18 dirty deposits stopped, $938,805 in all, and $6.3m of clean money held for a second look.',
    },
  },
  itemLabel: (item) => `${item.id} · ${item.chain} · ${money(item.amountOffered)} offered`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/wallet-risk.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/wallet-risk.js#demo:data',
    state: 'demos/wallet-risk/demo.js#demo:state',
    questions: 'demos/wallet-risk/demo.js#demo:questions',
    evaluate: 'demos/wallet-risk/demo.js#demo:evaluate',
  },
};
