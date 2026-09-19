// Wallet risk scoring: two hundred and forty wallets offering a deposit, graded before the money is
// taken. The score is only half of it — the demo also asks what drove the score, and the report checks
// that the driver matches the exposure that was actually planted.

import { choice, noul, score } from '../lib/questions.js';

const EXPOSURES = ['MIXER', 'SANCTIONED_ENTITY', 'GAMBLING', 'BRIDGE', 'EXCHANGE', 'NONE'];
const DECISIONS = ['ACCEPT', 'REVIEW', 'REJECT'];
const BANDS = ['high', 'medium', 'low'];
const BAND_FLOOR = { high: 4, medium: 2 };

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

  return {
    note: `Two hundred and forty wallets. ${high.length} carry exposure that should stop the money, ${graded.filter((result) => byItem.get(result.item.id).riskBand === 'medium').length} are worth asking about, and ${labels.filter((label) => label.kind === 'looks bad, is not').length} look alarming and are ordinary. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis({ graded, high, takenHigh, lowBand, byItem, currency: context.currency }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, high),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

function kpis({ graded, high, takenHigh, lowBand, byItem, currency }) {
  const bandRight = graded.filter((result) => result.evaluation.band === byItem.get(result.item.id).riskBand);
  const driverRight = high.filter((result) => result.evaluation.exposure === byItem.get(result.item.id).driver);
  const rejectedLow = lowBand.filter((result) => result.evaluation.rejected);
  const accepted = graded.filter((result) => result.evaluation.accepted);

  return [
    { label: 'High-risk money refused or held', value: `${high.length - takenHigh.length} of ${high.length}`, context: takenHigh.length ? `${money(total(takenHigh), currency)} of it would have been taken` : 'none of it was accepted', tone: takenHigh.length ? 'warn' : 'good' },
    { label: 'Band agrees with the label', value: share(bandRight.length, graded.length), context: `${bandRight.length} of ${graded.length} wallets in the right band` },
    { label: 'Driver named on the high-risk wallets', value: `${driverRight.length} of ${high.length}`, context: 'mixer, sanctions or gambling, exactly' },
    { label: 'Ordinary wallets refused', value: `${rejectedLow.length} of ${lowBand.length}`, context: `${money(total(rejectedLow), currency)} of ordinary deposits turned away`, tone: rejectedLow.length ? 'warn' : 'good' },
    { label: 'Accepted', value: money(total(accepted), currency), context: `${accepted.length} deposits, ${accepted.filter((result) => byItem.get(result.item.id).riskBand === 'high').length} of them high risk` },
  ];
}

function checks(graded, byItem, labels) {
  const rows = ['MIXER', 'SANCTIONED_ENTITY', 'GAMBLING'].map((driver) => {
    const group = labels.filter((label) => label.riskBand === 'high' && label.driver === driver);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.wallet);
      return !result || result.evaluation.accepted;
    });
    return { id: driver.toLowerCase(), label: `${sentence(driver)} exposure accepted`, detail: questions.main_exposure.criteria[driver], count: missed.length, of: group.length, items: missed.map((label) => label.wallet) };
  });

  const decoyList = labels.filter((label) => label.kind === 'looks bad, is not');
  const refusedDecoys = decoyList.filter((label) => graded.some((result) => result.item.id === label.wallet && result.evaluation.rejected));
  const ordinary = graded.filter((result) => byItem.get(result.item.id).kind === 'ordinary');
  const refusedOrdinary = ordinary.filter((result) => result.evaluation.rejected);
  return [
    ...rows,
    { id: 'decoys', label: 'Big, busy, ordinary wallets refused', detail: 'A market maker, a bridge relayer, and a wallet that slept three years and woke up once.', count: refusedDecoys.length, of: decoyList.length, items: refusedDecoys.map((label) => label.wallet) },
    { id: 'ordinary', label: 'Everyday wallets refused', detail: 'The rest of the file: nothing about these asks for a question.', count: refusedOrdinary.length, of: ordinary.length, items: refusedOrdinary.slice(0, 20).map((result) => result.item.id) },
  ];
}

function distribution(results) {
  return DECISIONS
    .map((decision) => ({ label: sentence(decision), count: results.filter((result) => result.evaluation.decision === decision).length, tone: decision === 'ACCEPT' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Band scored against the band the wallet belongs in',
    columns: BANDS.map(sentence),
    rows: BANDS.map((actual) => ({
      label: sentence(actual),
      cells: BANDS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).riskBand === actual && result.evaluation.band === predicted).length,
        diagonal: actual === predicted,
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
  return { title: 'Where the desk draws its line', xLabel: 'Wallets held at this grade or above', yLabel: 'High-risk wallets among them', rateLabel: 'Share of the held wallets that are high risk', of: high.length, points };
}

function findings(graded, byItem) {
  const lines = [];
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

export default {
  id: 'wallet-risk',
  title: 'Wallet risk scoring',
  domain: 'crypto',
  value: 'Score a wallet before you take its money, and name the exposure that drove the score.',
  tags: ['crypto', 'wallets', 'screening', 'deposits'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  status: 'pending-recording',
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
