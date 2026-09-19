// Sybil clusters: a hundred and fifty wallets queueing for an allocation, judged one at a time. The
// state compares each wallet against the population — how many wallets share its funding source, its
// minute, its sequence, its gas price — and never names them, so a cluster has to be inferred from
// the shape of the crowd rather than read off a list.

import { choice, noul, score } from '../lib/questions.js';

const SIGNALS = ['FUNDING_SOURCE', 'CREATION_TIMING', 'ACTION_SEQUENCE', 'GAS_PATTERN', 'WITHDRAWAL_ENDPOINT', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);
const allocation = (results) => results.reduce((sum, result) => sum + result.item.allocation, 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** One wallet, and how much of the crowd looks like it. The crowd is counted, never named. */
function buildState(item, context) {
  return {
    task: 'Decide whether this wallet is one of several belonging to the same person, and whether to exclude it from the allocation.',
    programme: { name: context.programme, currency: context.currency, wallets_in_the_programme: context.wallets, rule: context.allocationRule, how_similarity_is_measured: context.similarityNote },
    wallet: {
      address: item.address,
      created: item.createdAt,
      funded_by: item.fundingSource,
      funded_with: item.fundedWith,
      days_active: item.daysActive,
      actions_taken: item.actionCount,
      action_sequence: item.actionSequence,
      gas_price_gwei: item.gasPriceGwei,
      gas_price_variation: item.gasPriceStdev,
      withdrew_to: item.withdrawalEndpoint,
      allocation_at_stake: item.allocation,
    },
    how_many_others_look_like_this: {
      share_its_funding_source: item.walletsWithTheSameFundingSource,
      were_created_within_ten_minutes: item.walletsWithinTenMinutesOfCreation,
      took_the_same_actions_in_the_same_order: item.walletsWithTheSameActionSequence,
      paid_exactly_the_same_gas_price: item.walletsWithTheSameGasPrice,
      withdrew_to_the_same_address: item.walletsWithTheSameWithdrawalEndpoint,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  sybil_likelihood: score('How likely is it that this wallet is one of several belonging to one person?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  linking_signal: choice('What links it to the others, if anything does?', {
    FUNDING_SOURCE: 'The same address funded a group of wallets that includes this one.',
    CREATION_TIMING: 'A group of wallets, this one among them, appeared within minutes of each other.',
    ACTION_SEQUENCE: 'The same actions in the same order as a group of other wallets.',
    GAS_PATTERN: 'A gas price shared to the decimal with a group of others, which people do not do.',
    WITHDRAWAL_ENDPOINT: 'The money ends up at an address a group of wallets shares.',
    NONE: 'Nothing links it. Whatever it shares, it shares with the whole population.',
  }),
  exclude_from_allocation: noul('Should this wallet be left out of the allocation?', {
    yes: 'The evidence that this is one of several is strong enough to take the allocation away.',
    no: 'Give it the allocation. Doubt is not evidence.',
  }),
  independent_user: noul('Does this look like one person with one wallet?', {
    yes: 'The funding, timing, actions and gas all look like somebody acting for themselves.',
    no: 'It behaves like part of a set.',
  }),
};
// #endregion

// #region demo:evaluate
/** The verdict on one wallet, and the allocation it turns on. */
function evaluate(answers, item) {
  const excluded = answers.exclude_from_allocation.noul >= 0.5;

  return {
    likelihood: answers.sybil_likelihood.score,
    signal: answers.linking_signal.choice,
    excluded,
    independent: answers.independent_user.noul >= 0.5,
    confidence: answers.linking_signal.confidence,
    allocationAtStake: item.allocation,
    label: `${item.id} · ${excluded ? 'excluded' : 'allocated'} · ${money(item.allocation)}${answers.linking_signal.choice === 'NONE' ? '' : ` · ${readable(answers.linking_signal.choice)}`}`,
  };
}
// #endregion

// #region demo:report
/** Two costs, always together: the allocation saved, and the real users it was taken from. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.wallet, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const farmed = graded.filter((result) => byItem.get(result.item.id).clusterId);
  const real = graded.filter((result) => !byItem.get(result.item.id).clusterId);

  return {
    note: `A hundred and fifty wallets. ${farmed.length} of them are eight people, twelve share nothing but an exchange, and six did the same things because they read the same guide. ${context.note ?? ''}`,
    findings: findings(graded, byItem, real),
    kpis: kpis({ graded, farmed, real, byItem, currency: context.currency }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, farmed),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

/** How much of each planted cluster was excluded, cluster by cluster. */
function clusters(graded, byItem) {
  const groups = new Map();
  for (const result of graded) {
    const label = byItem.get(result.item.id);
    if (!label.clusterId) continue;
    const entry = groups.get(label.clusterId) ?? { id: label.clusterId, total: 0, found: 0, signal: label.linkingSignal, signalRight: 0 };
    entry.total += 1;
    if (result.evaluation.excluded) entry.found += 1;
    if (result.evaluation.signal === label.linkingSignal) entry.signalRight += 1;
    groups.set(label.clusterId, entry);
  }
  return [...groups.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function kpis({ graded, farmed, real, byItem, currency }) {
  const recovered = clusters(graded, byItem);
  const whole = recovered.filter((entry) => entry.found === entry.total);
  const excludedFarmed = farmed.filter((result) => result.evaluation.excluded);
  const excludedReal = real.filter((result) => result.evaluation.excluded);
  const signalRight = farmed.filter((result) => result.evaluation.signal === byItem.get(result.item.id).linkingSignal);
  const claimed = real.filter((result) => result.evaluation.signal !== 'NONE');

  return [
    { label: 'Clusters excluded whole', value: `${whole.length} of ${recovered.length}`, context: recovered.map((entry) => `${entry.id}: ${entry.found}/${entry.total}`).join(' · '), tone: whole.length === recovered.length ? 'good' : 'warn' },
    { label: 'Farmed wallets excluded', value: `${excludedFarmed.length} of ${farmed.length}`, context: `${money(allocation(excludedFarmed), currency)} of allocation saved` },
    { label: 'Real users excluded', value: `${excludedReal.length} of ${real.length}`, context: `${money(allocation(excludedReal), currency)} taken from people who earned it`, tone: excludedReal.length ? 'warn' : 'good' },
    { label: 'Linking signal named', value: `${signalRight.length} of ${farmed.length}`, context: 'the trait the farmer was actually careless about' },
    { label: 'Signals claimed where there are none', value: `${claimed.length} of ${real.length}`, context: 'wallets with no cluster that were still given a link', tone: claimed.length > real.length / 4 ? 'warn' : 'good' },
    { label: 'Allocation paid out', value: money(allocation(graded.filter((result) => !result.evaluation.excluded)), currency), context: `${graded.filter((result) => !result.evaluation.excluded).length} wallets, ${farmed.length - excludedFarmed.length} of them farmed` },
  ];
}

function checks(graded, byItem, labels) {
  const missedClusters = clusters(graded, byItem).map((entry) => ({
    id: entry.id.toLowerCase(),
    label: `${entry.id} (${readable(entry.signal)}) not fully excluded`,
    detail: `Eight people built these wallets; this one was linked by ${readable(entry.signal)}.`,
    count: entry.total - entry.found,
    of: entry.total,
    items: graded.filter((result) => byItem.get(result.item.id).clusterId === entry.id && !result.evaluation.excluded).map((result) => result.item.id),
  }));

  const decoys = [['same exchange, nothing else', 'Twelve wallets funded from one exchange hot wallet, which is what an exchange is.'], ['read the same guide', 'Six people who did the same five things in the same order because a guide said to.']];
  const decoyRows = decoys.map(([kind, detail]) => {
    const group = labels.filter((label) => label.kind === kind);
    const excluded = group.filter((label) => graded.some((result) => result.item.id === label.wallet && result.evaluation.excluded));
    return { id: kind.replaceAll(/[^a-z]+/gi, '-'), label: `${sentence(kind)}: excluded anyway`, detail, count: excluded.length, of: group.length, items: excluded.map((label) => label.wallet) };
  });
  return [...missedClusters, ...decoyRows];
}

function distribution(results) {
  return SIGNALS
    .map((signal) => ({ label: sentence(signal), count: results.filter((result) => result.evaluation.signal === signal).length, tone: signal === 'NONE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Linking signal named against the one the farmer left',
    columns: SIGNALS.map(sentence),
    rows: SIGNALS.map((actual) => ({
      label: sentence(actual),
      cells: SIGNALS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).linkingSignal === actual && result.evaluation.signal === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, farmed) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const cut = graded.filter((result) => result.evaluation.likelihood >= bar);
    const right = cut.filter((result) => byItem.get(result.item.id).clusterId);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: cut.length, caught: right.length, rate: cut.length ? Number((right.length / cut.length).toFixed(3)) : null };
  });
  return { title: 'Where the bar goes: allocation saved against users turned away', xLabel: 'Wallets excluded at this likelihood or above', yLabel: 'Farmed wallets among them', rateLabel: 'Share of the excluded that are farmed', of: farmed.length, points };
}

function findings(graded, byItem, real) {
  const lines = [];
  const excludedReal = real.filter((result) => result.evaluation.excluded);
  if (excludedReal.length) {
    const kinds = [...new Set(excludedReal.map((result) => byItem.get(result.item.id).kind))];
    lines.push(`${excludedReal.length} real ${excludedReal.length === 1 ? 'user was' : 'users were'} excluded, worth ${money(allocation(excludedReal))}: ${kinds.join(', ')}. Every one of them keeps their allocation only if the bar is argued for.`);
  }

  const guide = graded.filter((result) => byItem.get(result.item.id).kind === 'read the same guide');
  const guideExcluded = guide.filter((result) => result.evaluation.excluded);
  if (guideExcluded.length >= 2) lines.push(`${guideExcluded.length} of the six wallets that followed the same guide were excluded for it. Doing the same five things in the same order is what a guide is for, and it is the hardest case in this file.`);

  const wrongSignal = graded.filter((result) => byItem.get(result.item.id).clusterId && result.evaluation.excluded && result.evaluation.signal !== byItem.get(result.item.id).linkingSignal);
  if (wrongSignal.length >= 3) lines.push(`${wrongSignal.length} farmed wallets were excluded for the wrong reason. The exclusion holds; the sentence written next to it does not.`);
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.excluded)
    .sort((left, right) => right.item.allocation - left.item.allocation)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.clusterId ? ` · ${byItem.get(result.item.id).clusterId}` : ' · a real user'}`,
      value: money(result.item.allocation, currency),
    }));
}

export default {
  id: 'sybil-clusters',
  title: 'Sybil clusters',
  domain: 'crypto',
  value: 'Find the wallets that are really one person, before an allocation goes out.',
  tags: ['crypto', 'sybil', 'allocation', 'clusters'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${money(item.allocation)} at stake · ${item.actionCount} actions`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/sybil-clusters.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/sybil-clusters.js#demo:data',
    state: 'demos/sybil-clusters/demo.js#demo:state',
    questions: 'demos/sybil-clusters/demo.js#demo:questions',
    evaluate: 'demos/sybil-clusters/demo.js#demo:evaluate',
  },
};
