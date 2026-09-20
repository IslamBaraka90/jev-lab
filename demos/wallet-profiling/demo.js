// Wallet behaviour profiling: Jev sees the complete activity fingerprint, never the type label.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const TYPES = ['EXCHANGE', 'MARKET_MAKER', 'MEV_BOT', 'RETAIL', 'BRIDGE', 'SCAM_COLLECTOR'];
const AUTOMATION_WORDS = ['Fully manual', 'Mostly manual', 'Some automation', 'Mixed', 'Mostly automated', 'Highly automated', 'Machine only'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^mev\b/, 'MEV');
const title = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const percent = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '–';
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Name the wallet behaviour represented by this complete ninety-day activity fingerprint, estimate how automated it is, and choose proportionate monitoring.',
    observation_window: context.period,
    caution: context.caveat,
    monitoring_policy: context.monitoringPolicy,
    wallet: { address: item.address, transactions: item.transactions, inbound_transactions: item.inboundTransactions, outbound_transactions: item.outboundTransactions, counterparties: item.counterparties, turnover_usd: item.turnoverUsd },
    timing: { transactions_by_hour_utc: item.hourOfDay },
    amounts: { distribution: item.amountBuckets, round_amount_share: item.amounts.roundAmountShare, median_usd: item.amounts.medianUsd, p95_usd: item.amounts.p95Usd },
    gas: item.gas,
    contract_and_sequence_activity: item.interactions,
    funding_sources: item.fundingSources,
  };
}
// #endregion

// #region demo:questions
const questions = {
  wallet_type: choice('Which behavioural type best explains this activity?', {
    EXCHANGE: 'Exchange hot wallet: constant activity, many small outbound transfers, and comparatively few inbound sources.',
    MARKET_MAKER: 'Market maker: balanced two-sided venue flow with tightly timed activity.',
    MEV_BOT: 'MEV bot: same-block sequences, high gas bidding, and repeated contract calls around the clock.',
    RETAIL: 'Retail wallet: bursts, round amounts, few counterparties, and a human time-of-day rhythm.',
    BRIDGE: 'Bridge or relayer: paired in-and-out activity concentrated on a fixed contract.',
    SCAM_COLLECTOR: 'Collector pattern: hundreds of small inflows from fresh wallets followed by one or very few large outflows.',
  }),
  automation: score('How automated is the observed activity?', ['Fully manual', 'Mostly manual', 'Some automation', 'Mixed', 'Mostly automated', 'Highly automated', 'Machine only']),
  monitoring_level: choice('What monitoring level fits this behaviour?', {
    NONE: 'Ordinary controls are enough.',
    PERIODIC: 'Review if the activity fingerprint materially changes.',
    CONTINUOUS: 'Continuously monitor this fingerprint for changes or escalation.',
  }),
  type_is_clear: noul('Does one type clearly explain the evidence?', {
    yes: 'One behavioural type is materially better supported than the alternatives.',
    no: 'The wallet sits between plausible types; say so rather than forcing certainty.',
  }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  const walletType = answers.wallet_type.choice;
  return {
    walletType,
    automation: answers.automation.score,
    monitoring: answers.monitoring_level.choice,
    clear: answers.type_is_clear.noul >= 0.5,
    confidence: answers.wallet_type.confidence,
    label: `${item.id} · ${title(walletType)} · ${answers.type_is_clear.noul >= 0.5 ? 'clear' : 'ambiguous'}`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.wallet, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const clear = graded.filter((result) => !intended.get(result.item.id).ambiguous);
  const ambiguous = graded.filter((result) => intended.get(result.item.id).ambiguous);
  const correct = clear.filter((result) => result.evaluation.walletType === intended.get(result.item.id).type);
  const forced = ambiguous.filter((result) => !namedNeighbour(result, intended.get(result.item.id)));
  const calledUnclear = clear.filter((result) => !result.evaluation.clear);
  const matrix = confusion(clear, intended);
  const rows = baselines(clear, intended, correct);

  return {
    note: `Two hundred fictional wallets across six behavioural types. The ten deliberately ambiguous wallets are scored separately, on whether the type named is one of the two they were planted between. ${context.caveat ?? ''}`,
    findings: findings(clear, ambiguous, intended, rows),
    kpis: kpis({ graded, clear, ambiguous, correct, calledUnclear, intended }),
    baselines: rows,
    metrics: metrics(clear, correct, calledUnclear, matrix),
    distributionTitle: 'Types named across all 200 wallets',
    distribution: TYPES.map((type) => ({ label: title(type), count: results.filter((result) => result.evaluation.walletType === type).length })).filter((entry) => entry.count),
    matrix,
    fingerprints: fingerprintChart(graded, intended),
    checks: [
      { id: 'ambiguous', label: 'Ambiguous wallets named as neither neighbour', detail: 'These planted boundary cases were given a type that is not one of the two they sit between.', count: forced.length, of: ambiguous.length, items: forced.map((result) => result.item.id) },
      ...TYPES.map((type) => {
        const group = clear.filter((result) => intended.get(result.item.id).type === type);
        const missed = group.filter((result) => result.evaluation.walletType !== type);
        return { id: type.toLowerCase(), label: `${title(type)} wallets called something else`, detail: questions.wallet_type.criteria[type], count: missed.length, of: group.length, items: missed.map((result) => result.item.id) };
      }),
    ],
    topItemsTitle: 'The ten planted boundary wallets',
    topItems: ambiguous.map((result) => {
      const label = intended.get(result.item.id);
      return { id: result.item.id, label: `${result.item.id} · planted between ${readable(label.type)} and ${readable(label.ambiguousWith)} · called ${readable(result.evaluation.walletType)} at ${Math.round(result.evaluation.confidence * 100)}% confidence` };
    }),
  };
}
// #endregion

const namedNeighbour = (result, label) => [label.type, label.ambiguousWith].includes(result.evaluation.walletType);

function kpis({ graded, clear, ambiguous, correct, calledUnclear, intended }) {
  // The yes/no on clarity is not used here: a wallet passes only if it was named one of its two neighbours.
  const ambiguityHonoured = ambiguous.filter((result) => namedNeighbour(result, intended.get(result.item.id)));
  const automationError = mean(graded.map((result) => Math.abs(result.evaluation.automation - intended.get(result.item.id).automation)));
  const monitoring = commonest(graded.map((result) => result.evaluation.monitoring));
  const neverChosen = Object.keys(questions.monitoring_level.criteria).filter((level) => !graded.some((result) => result.evaluation.monitoring === level));

  return [
    { label: 'Clear wallet types correct', value: percent(correct.length, clear.length), context: `${correct.length} of ${clear.length}; ambiguous wallets are not in this denominator`, tone: correct.length >= clear.length * 0.9 ? 'good' : 'warn' },
    { label: 'Ambiguity handled fairly', value: `${ambiguityHonoured.length} of ${ambiguous.length}`, context: 'boundary wallets named as one of their two planted neighbouring types', tone: ambiguityHonoured.length === ambiguous.length ? 'good' : 'warn' },
    { label: 'Clear wallets called unclear', value: `${calledUnclear.length} of ${clear.length}`, context: 'a yes/no that says "unclear" about nearly every wallet tells the desk nothing about any one of them', tone: calledUnclear.length > clear.length * 0.15 ? 'warn' : 'good' },
    { label: 'Automation mean absolute error', value: automationError.toFixed(2), context: 'points on the zero-to-six rubric; the label is one fixed number per type', tone: automationError <= 1 ? 'good' : 'warn' },
    { label: 'Commonest monitoring level', value: `${title(monitoring.value ?? 'NONE')} · ${monitoring.count} of ${graded.length}`, context: `${neverChosen.length ? `${neverChosen.map((level) => `"${title(level)}"`).join(' and ')} never chosen; ` : ''}not scored, because the state gives no rule tying a type to a level` },
  ];
}

function commonest(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { value, count };
}

// The rule: read the type straight off the fingerprint, one threshold per type, in the order the
// option texts describe the tells.
function ruleType(item) {
  if (item.interactions.sameBlockShare >= 0.5) return 'MEV_BOT';
  if (item.fundingSources.freshUnder7DaysShare >= 0.5) return 'SCAM_COLLECTOR';
  if (item.interactions.pairedInOutShare >= 0.6) return 'BRIDGE';
  if (item.transactions < 1000) return 'RETAIL';
  if (item.counterparties >= 1000) return 'EXCHANGE';
  return 'MARKET_MAKER';
}

function baselines(clear, intended, correct) {
  if (!clear.length) return [];
  const ruleRight = clear.filter((result) => ruleType(result.item) === intended.get(result.item.id).type);
  const majority = commonest(clear.map((result) => intended.get(result.item.id).type));
  return [
    { label: 'Jev', detail: 'type named from the fingerprint, clear wallets only', value: correct.length / clear.length, count: correct.length, model: true },
    { label: 'Rule: one threshold per type', detail: 'six lines of code over same-block share, fresh funders, paired flow, size and counterparties', value: ruleRight.length / clear.length, count: ruleRight.length },
    { label: 'Always the commonest type', detail: readable(majority.value), value: majority.count / clear.length, count: majority.count },
  ];
}

function metrics(clear, correct, calledUnclear, matrix) {
  const stats = matrixStats(matrix);
  return {
    headline: { label: 'Clear wallet types correct', value: clear.length ? correct.length / clear.length : 0, n: clear.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    falseAmbiguityRate: clear.length ? calledUnclear.length / clear.length : null,
  };
}

function confusion(clear, intended) {
  return {
    title: 'Behaviour type: planted against called',
    rowLabel: 'the type the wallet was planted as',
    columnLabel: 'the type the model named',
    columns: TYPES.map(title),
    rows: TYPES.map((actual) => ({
      label: title(actual),
      cells: TYPES.map((predicted) => {
        const items = clear.filter((result) => intended.get(result.item.id).type === actual && result.evaluation.walletType === predicted).map((result) => result.item.id);
        return { predicted, count: items.length, diagonal: actual === predicted, items, ariaLabel: `${title(actual)} called ${title(predicted)}: ${items.length}` };
      }),
    })),
  };
}

function fingerprintChart(graded, intended) {
  const metrics = [
    { key: 'same_block', label: 'Same-block sequences', read: (item) => item.interactions.sameBlockShare },
    { key: 'paired_flow', label: 'Paired in/out flow', read: (item) => item.interactions.pairedInOutShare },
    { key: 'fixed_contract', label: 'Fixed-contract concentration', read: (item) => item.interactions.fixedContractShare },
    { key: 'round_amounts', label: 'Round amounts', read: (item) => item.amounts.roundAmountShare },
    { key: 'fresh_sources', label: 'Fresh funding sources', read: (item) => item.fundingSources.freshUnder7DaysShare },
    { key: 'gas_premium', label: 'Gas premium', read: (item) => Math.min(1, Math.max(0, (item.gas.meanMultipleOfNetwork - 0.7) / 5.1)) },
  ];
  return {
    title: 'Average fingerprint computed from the displayed wallet data',
    metrics: metrics.map(({ key, label }) => ({ key, label })),
    series: TYPES.map((type) => {
      const items = graded.filter((result) => intended.get(result.item.id).type === type).map((result) => result.item);
      return { id: type, label: title(type), values: metrics.map(({ key, read }) => ({ key, value: Number(mean(items.map(read)).toFixed(3)) })) };
    }),
  };
}

function findings(clear, ambiguous, intended, rows = []) {
  const lines = [];
  const [model, rule] = rows;
  if (model && rule && rule.count > model.count) {
    lines.push(`A six-line rule with one threshold per type names ${rule.count} of ${clear.length} clear wallets correctly; the model names ${model.count}. The types are separated by construction, so this file shows the model reading a fingerprint from prose, not beating a rules engine.`);
  }
  const mistakes = clear.filter((result) => result.evaluation.walletType !== intended.get(result.item.id).type);
  if (mistakes.length) {
    const pair = new Map();
    for (const result of mistakes) {
      const key = `${intended.get(result.item.id).type} → ${result.evaluation.walletType}`;
      pair.set(key, (pair.get(key) ?? 0) + 1);
    }
    const [largest, count] = [...pair.entries()].sort((a, b) => b[1] - a[1])[0];
    lines.push(`${mistakes.length} clear wallets were misclassified. The largest blur is ${readable(largest)} (${count}).`);
  }
  const forced = ambiguous.filter((result) => !namedNeighbour(result, intended.get(result.item.id)));
  if (forced.length) lines.push(`${forced.length} of the ${ambiguous.length} ambiguous wallets were named a type that is neither of the two they sit between: ${forced.map((result) => `${result.item.id} (${readable(result.evaluation.walletType)})`).join(', ')}.`);

  const calledUnclear = clear.filter((result) => !result.evaluation.clear);
  if (calledUnclear.length > clear.length * 0.5) {
    lines.push(`The "does one type clearly explain it" answer said no for ${calledUnclear.length} of ${clear.length} clear wallets, including ones named at full confidence. It ran between 36% and 55% on every wallet in the file, so it does not pick out the planted boundary cases.`);
  }
  return lines;
}

/** Clear wallets only, as in the headline. The ten boundary wallets are left ungraded, not counted wrong. */
function judge(result, label) {
  if (!label || label.ambiguous) return null;
  return {
    agree: result.evaluation.walletType === label.type,
    expected: label.type,
    got: result.evaluation.walletType,
    note: `Planted as ${readable(label.type)}, with an automation label of ${label.automation} of 6.`,
    confidence: result.answers.wallet_type.confidence,
  };
}

const MONITORING_WORDS = { NONE: 'Ordinary controls', PERIODIC: 'Periodic review', CONTINUOUS: 'Continuous monitoring' };
const asPercent = (value) => `${Math.round(value * 100)}%`;

function runnerUp(answer) {
  const others = Object.entries(answer.probabilities ?? {}).filter(([type]) => type !== answer.choice);
  const [type, probability] = others.sort((a, b) => b[1] - a[1])[0] ?? [];
  return type ? `${title(type)} · ${asPercent(probability)}` : 'None offered';
}

function verdict(result) {
  const { item, answers, evaluation } = result;
  const clearShare = answers.type_is_clear.noul;
  return {
    eyebrow: 'What this wallet appears to be',
    headline: `${title(evaluation.walletType)} · ${asPercent(answers.wallet_type.probabilities?.[evaluation.walletType] ?? evaluation.confidence)}`,
    detail: `${item.inboundTransactions.toLocaleString('en-US')} transfers in and ${item.outboundTransactions.toLocaleString('en-US')} out across ${item.counterparties.toLocaleString('en-US')} counterparties in ninety days.`,
    facts: [
      { label: 'Confidence in the type', value: asPercent(evaluation.confidence), tone: evaluation.confidence >= 0.7 ? 'good' : evaluation.confidence < 0.5 ? 'warn' : undefined },
      { label: 'Next most likely type', value: runnerUp(answers.wallet_type) },
      { label: 'Automation', value: `${AUTOMATION_WORDS[Math.round(evaluation.automation)]} · ${evaluation.automation.toFixed(1)} of 6` },
      { label: 'Monitoring', value: MONITORING_WORDS[evaluation.monitoring], tone: evaluation.monitoring === 'CONTINUOUS' ? 'warn' : undefined },
      { label: 'One type clearly explains it', value: `${evaluation.clear ? 'Yes' : 'No'} · ${asPercent(Math.max(clearShare, 1 - clearShare))}`, tone: evaluation.clear ? 'good' : 'warn' },
    ],
  };
}

export default {
  id: 'wallet-profiling',
  title: 'Wallet behaviour profiling',
  domain: 'crypto',
  value: 'Name what a wallet appears to be from its activity fingerprint alone, and expose where types blur.',
  tags: ['crypto', 'wallets', 'behaviour', 'classification'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  caveat: 'The six types in this file are separated by construction: a six-line rule with one threshold per type names all 190 clear wallets correctly. This run shows the model reading a fingerprint from prose descriptions, not beating a rules engine; a file with overlapping types is planned.',
  stage: {
    hide: ['address', 'observationDays'],
    labels: {
      transactions: 'Transactions in 90 days',
      inboundTransactions: 'Transfers in',
      outboundTransactions: 'Transfers out',
      turnoverUsd: 'Turnover (USD)',
      hourOfDay: 'Transactions by hour of day (UTC)',
      amountBuckets: 'Transfers by size',
      roundAmountShare: 'Round amounts (share)',
      medianUsd: 'Median transfer (USD)',
      p95Usd: '95th percentile transfer (USD)',
      meanMultipleOfNetwork: 'Mean gas, multiple of network',
      p95MultipleOfNetwork: '95th percentile gas, multiple of network',
      replacementRate: 'Replaced transactions (share)',
      interactions: 'Contract and sequence activity',
      repeatedCallShare: 'Repeated calls (share)',
      fixedContractShare: 'One fixed contract (share)',
      sameBlockShare: 'Same-block sequences (share)',
      pairedInOutShare: 'Paired in and out (share)',
      freshUnder7DaysShare: 'Funders younger than 7 days (share)',
      medianAgeDays: 'Median funder age (days)',
      uniqueSources: 'Unique funders',
    },
    highlight: ['inboundTransactions', 'outboundTransactions', 'sameBlockShare', 'freshUnder7DaysShare'],
  },
  grade: { labelId: (label) => label.wallet, judge },
  verdict,
  present: {
    number: 132,
    problem: {
      headline: 'Nobody labels a wallet for you. Ninety days of behaviour is all there is.',
      stat: '200',
      statLabel: 'wallets, six kinds of actor, no names',
    },
    hero: {
      item: 'WPF-0001',
      caption: '874 transfers in and 1 out. 87% of the funders are less than a week old and 644 payments are under $100. Named a scam collector at 100%.',
    },
    answers: {
      caption: 'A type, how automated the activity is, and how closely to watch it.',
      reveal: ['wallet_type', 'automation', 'monitoring_level'],
    },
    miss: {
      item: 'WPF-0007',
      caption: 'A market maker sending out twice what it takes in: 12,503 in, 26,157 out. Called an exchange. 14 of the 17 misses are this one confusion.',
    },
    proof: {
      kpis: ['Clear wallet types correct', 'Ambiguity handled fairly', 'Clear wallets called unclear'],
      chart: 'matrix',
      closing: '173 of 190 wallets named from behaviour alone, and 14 of the 17 misses are market makers called exchanges.',
    },
  },
  itemLabel: (item) => `${item.id} · ${item.transactions.toLocaleString('en-US')} tx · ${item.counterparties.toLocaleString('en-US')} counterparties`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/wallet-profiling.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/wallet-profiling.js#demo:data',
    state: 'demos/wallet-profiling/demo.js#demo:state',
    questions: 'demos/wallet-profiling/demo.js#demo:questions',
    evaluate: 'demos/wallet-profiling/demo.js#demo:evaluate',
  },
};
