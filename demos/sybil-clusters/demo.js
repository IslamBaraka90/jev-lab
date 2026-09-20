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
  const right = graded.filter((result) => result.evaluation.excluded === isFarmed(byItem.get(result.item.id)));
  const rows = baselines(graded, byItem, right);

  return {
    note: `A hundred and fifty wallets. ${farmed.length} of them are eight people, twelve share nothing but an exchange, and six did the same things because they read the same guide. ${context.note ?? ''}`,
    findings: findings(graded, byItem, real, rows),
    kpis: kpis({ graded, farmed, real, right, byItem, currency: context.currency }),
    baselines: rows,
    metrics: metrics(graded, farmed, real, right, byItem),
    distribution: distribution(results),
    distributionTitle: 'Linking signal named, all 150 wallets',
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, farmed),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
    topItemsTitle: 'Largest allocations withheld',
  };
}
// #endregion

const isFarmed = (label) => Boolean(label.clusterId);
const EXCHANGE_HUB = '0xDEMO_EXCHANGE_HOTWALLET';
const RULE_BAR = 5;

/** The five crowd counts for one wallet, with the labelled exchange hot wallet counted as nobody's link. */
function crowdCounts(item) {
  return {
    FUNDING_SOURCE: item.fundingSource === EXCHANGE_HUB ? 1 : item.walletsWithTheSameFundingSource,
    WITHDRAWAL_ENDPOINT: item.withdrawalEndpoint === EXCHANGE_HUB ? 1 : item.walletsWithTheSameWithdrawalEndpoint,
    ACTION_SEQUENCE: item.walletsWithTheSameActionSequence,
    CREATION_TIMING: item.walletsWithinTenMinutesOfCreation,
    GAS_PATTERN: item.walletsWithTheSameGasPrice,
  };
}

// The rule: exclude a wallet that shares any one trait with five or more wallets, ignoring the
// exchange hot wallet the state itself labels.
const ruleExcludes = (item) => Math.max(...Object.values(crowdCounts(item))) >= RULE_BAR;

function baselines(graded, byItem, right) {
  if (!graded.length) return [];
  const ruleRight = graded.filter((result) => ruleExcludes(result.item) === isFarmed(byItem.get(result.item.id)));
  const real = graded.filter((result) => !isFarmed(byItem.get(result.item.id)));
  return [
    { label: 'Jev', detail: 'farmed wallets excluded, real users allocated', value: right.length / graded.length, count: right.length, model: true },
    { label: 'Rule: any trait shared with five or more wallets', detail: 'three lines of code over the five counts in the state, ignoring the labelled exchange', value: ruleRight.length / graded.length, count: ruleRight.length },
    { label: 'Exclude nobody', detail: 'the commoner right answer in this file', value: real.length / graded.length, count: real.length },
  ];
}

function metrics(graded, farmed, real, right, byItem) {
  const excluded = graded.filter((result) => result.evaluation.excluded);
  const signalRight = farmed.filter((result) => result.evaluation.signal === byItem.get(result.item.id).linkingSignal);
  const rate = (part, whole) => (whole ? part / whole : null);
  return {
    headline: { label: 'Allocation decision right', value: rate(right.length, graded.length) ?? 0, n: graded.length },
    accuracy: rate(right.length, graded.length),
    precision: rate(excluded.filter((result) => isFarmed(byItem.get(result.item.id))).length, excluded.length),
    recall: rate(farmed.filter((result) => result.evaluation.excluded).length, farmed.length),
    signalNamedRate: rate(signalRight.length, farmed.length),
    falseSignalRate: rate(real.filter((result) => result.evaluation.signal !== 'NONE').length, real.length),
  };
}

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

function kpis({ graded, farmed, real, right, byItem, currency }) {
  const recovered = clusters(graded, byItem);
  const whole = recovered.filter((entry) => entry.found === entry.total);
  const excludedFarmed = farmed.filter((result) => result.evaluation.excluded);
  const excludedReal = real.filter((result) => result.evaluation.excluded);
  const signalRight = farmed.filter((result) => result.evaluation.signal === byItem.get(result.item.id).linkingSignal);
  const claimed = real.filter((result) => result.evaluation.signal !== 'NONE');
  const nothingExcluded = graded.length > 0 && !graded.some((result) => result.evaluation.excluded);
  const paidToFarmers = farmed.filter((result) => !result.evaluation.excluded);

  return [
    { label: 'Allocation decision right', value: `${right.length} of ${graded.length}`, context: nothingExcluded ? 'no wallet was excluded at all, so this is exactly what excluding nobody scores' : 'farmed wallets excluded and real users allocated', tone: right.length >= graded.length * 0.9 ? 'good' : 'warn' },
    { label: 'Clusters excluded whole', value: `${whole.length} of ${recovered.length}`, context: recovered.map((entry) => `${entry.id}: ${entry.found}/${entry.total}`).join(' · '), tone: whole.length === recovered.length ? 'good' : 'warn' },
    { label: 'Farmed wallets excluded', value: `${excludedFarmed.length} of ${farmed.length}`, context: `${money(allocation(excludedFarmed), currency)} of allocation saved, ${money(allocation(paidToFarmers), currency)} paid to farmers`, tone: excludedFarmed.length === farmed.length ? 'good' : 'warn' },
    { label: 'Real users excluded', value: `${excludedReal.length} of ${real.length}`, context: `${money(allocation(excludedReal), currency)} taken from people who earned it${nothingExcluded ? '; nobody was excluded, so this says nothing about care' : ''}`, tone: excludedReal.length ? 'warn' : nothingExcluded ? undefined : 'good' },
    { label: 'Signals claimed where there are none', value: `${claimed.length} of ${real.length}`, context: `wallets with no cluster that were still given a link; on the farmed wallets the planted signal was named ${signalRight.length} of ${farmed.length} times, which the largest count in the state also gives`, tone: claimed.length > real.length / 4 ? 'warn' : 'good' },
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
    rowLabel: 'the trait the farmer left (none for a real user)',
    columnLabel: 'the signal the model named',
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
  return { title: 'Where the bar goes: allocation saved against users turned away', xLabel: 'Wallets excluded at this likelihood or above', yLabel: 'Farmed wallets among them', rateLabel: 'Share of the excluded that are farmed', of: farmed.length, thresholdFormat: 'level', levels: 6, defaultIndex: 4, points };
}

function findings(graded, byItem, real, rows = []) {
  const lines = [];
  const farmed = graded.filter((result) => isFarmed(byItem.get(result.item.id)));
  if (graded.length && !graded.some((result) => result.evaluation.excluded)) {
    const answers = graded.map((result) => result.answers?.exclude_from_allocation?.noul).filter(Number.isFinite);
    const range = answers.length ? ` The exclusion answer ran from ${Math.round(Math.min(...answers) * 100)}% to ${Math.round(Math.max(...answers) * 100)}% and never crossed 50%.` : '';
    lines.push(`Nothing was excluded: all ${graded.length} wallets were allocated and ${money(allocation(farmed))} went to the ${new Set(farmed.map((result) => byItem.get(result.item.id).clusterId)).size} farmers.${range} With one answer for every wallet, precision and recall say nothing here.`);
  }

  const [model, rule] = rows;
  if (model && rule && rule.count > model.count) {
    const ruleReal = real.filter((result) => ruleExcludes(result.item));
    lines.push(`A three-line rule over the five counts in the state gets ${rule.count} of ${graded.length} decisions right; the model gets ${model.count}. The rule excludes every farmed wallet and ${ruleReal.length} real ${ruleReal.length === 1 ? 'user' : 'users'}, the ones who followed the same guide, which is where a model could still earn its place.`);
  }

  const cashOuts = real.filter((result) => result.item.withdrawalEndpoint === EXCHANGE_HUB);
  const cashOutsLinked = cashOuts.filter((result) => result.evaluation.signal === 'WITHDRAWAL_ENDPOINT');
  if (cashOutsLinked.length >= 2) lines.push(`${cashOuts.length} real users withdraw to the exchange hot wallet, and ${cashOutsLinked.length} of them were given "withdrawal endpoint" as a linking signal. Cashing out to an exchange is not a cluster.`);
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

const LIKELIHOOD_WORDS = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain'];
const COUNT_FIELD = {
  FUNDING_SOURCE: 'walletsWithTheSameFundingSource',
  WITHDRAWAL_ENDPOINT: 'walletsWithTheSameWithdrawalEndpoint',
  ACTION_SEQUENCE: 'walletsWithTheSameActionSequence',
  CREATION_TIMING: 'walletsWithinTenMinutesOfCreation',
  GAS_PATTERN: 'walletsWithTheSameGasPrice',
};
const asPercent = (value) => `${Math.round(value * 100)}%`;
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${asPercent(Math.max(probability, 1 - probability))}`;

const PLANTED_NOTE = {
  farmed: (label) => `Planted in cluster ${label.clusterId}: one operator, linked by ${readable(label.linkingSignal)}.`,
  'same exchange, nothing else': () => 'Planted decoy: funded from an exchange hot wallet and nothing else in common.',
  'read the same guide': () => 'Planted decoy: did the same five things in the same order because a guide said to.',
};

/** Right means a farmed wallet was excluded and a real user was not. */
function judge(result, label) {
  if (!label) return null;
  const probability = result.answers.exclude_from_allocation.noul;
  return {
    agree: result.evaluation.excluded === isFarmed(label),
    expected: isFarmed(label) ? 'exclude' : 'allocate',
    got: result.evaluation.excluded ? 'exclude' : 'allocate',
    note: PLANTED_NOTE[label.kind]?.(label),
    confidence: Math.max(probability, 1 - probability),
  };
}

function verdict(result, context = {}) {
  const { item, answers, evaluation } = result;
  const shared = item[COUNT_FIELD[evaluation.signal]] ?? 0;
  const word = LIKELIHOOD_WORDS[Math.round(evaluation.likelihood)];
  return {
    eyebrow: 'What happens to this allocation',
    headline: `${evaluation.excluded ? 'Exclude' : 'Allocate'} · ${money(item.allocation, context.currency)}`,
    facts: [
      { label: 'Exclude from the allocation', value: yesNo(answers.exclude_from_allocation.noul), tone: evaluation.excluded ? 'bad' : undefined },
      { label: 'Sybil likelihood', value: `${word} · ${evaluation.likelihood.toFixed(1)} of 6`, tone: evaluation.likelihood >= 4 ? 'bad' : evaluation.likelihood >= 3 ? 'warn' : 'good' },
      { label: 'Linking signal', value: evaluation.signal === 'NONE' ? 'None' : `${sentence(evaluation.signal)}${shared > 1 ? ` · shared with ${shared} wallets` : ''}`, tone: evaluation.signal === 'NONE' ? 'good' : 'warn' },
      { label: 'An independent user', value: yesNo(answers.independent_user.noul), tone: evaluation.independent ? 'good' : 'warn' },
    ],
  };
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
  caveat: 'In this recorded run the model excluded no wallet at all: the exclusion answer never rose above 46%, so every exclusion figure below is the score of doing nothing. The question wording and the state lean toward "no"; the demo needs a revised state and a new recording before its numbers mean anything.',
  stage: {
    hide: ['address'],
    labels: {
      createdAt: 'Wallet created',
      fundedWith: 'First funding (USD)',
      actionSequence: 'Actions, in order',
      gasPriceGwei: 'Mean gas price (gwei)',
      gasPriceStdev: 'Gas price spread (gwei)',
      allocation: 'Allocation at stake',
      walletsWithTheSameFundingSource: 'Wallets with the same funding source',
      walletsWithTheSameWithdrawalEndpoint: 'Wallets with the same withdrawal endpoint',
      walletsWithTheSameActionSequence: 'Wallets with the same action sequence',
      walletsWithinTenMinutesOfCreation: 'Wallets created within ten minutes',
      walletsWithTheSameGasPrice: 'Wallets with the same gas price',
    },
    highlight: ['walletsWithTheSameFundingSource', 'walletsWithTheSameActionSequence', 'walletsWithinTenMinutesOfCreation', 'walletsWithTheSameGasPrice'],
  },
  grade: { labelId: (label) => label.wallet, judge },
  verdict,
  present: {
    number: 135,
    problem: {
      headline: 'An allocation is about to go out. Some of the wallets in the queue are one person many times over.',
      stat: '150',
      statLabel: 'wallets queueing for $186,373',
    },
    hero: {
      item: 'SW-001',
      caption: 'Funded from an exchange hot wallet that 36 wallets share, and nothing else in common with anyone. The model still names the funding source as a link, but allocates the $1,133, which is right: the same exchange is not the same person.',
    },
    answers: {
      caption: 'A likelihood, the one trait that links the wallet to others, and whether to withhold the allocation.',
      reveal: ['sybil_likelihood', 'linking_signal', 'exclude_from_allocation'],
    },
    miss: {
      item: 'SW-004',
      caption: 'One of nine wallets paid for by a single funder. The model names the funding source at 96% and scores it 4.1 of 6, then allocates $949 anyway. The exclusion answer was 41%.',
    },
    proof: {
      kpis: ['Allocation decision right', 'Farmed wallets excluded', 'Signals claimed where there are none'],
      chart: 'baselines',
      closing: '0 of 62 farmed wallets excluded: $69,026 went to eight farmers, and a three-line rule would have kept all of it.',
    },
  },
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
