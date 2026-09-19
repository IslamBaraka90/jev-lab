// Wallet behaviour profiling: Jev sees the complete activity fingerprint, never the type label.

import { choice, noul, score } from '../lib/questions.js';

const TYPES = ['EXCHANGE', 'MARKET_MAKER', 'MEV_BOT', 'RETAIL', 'BRIDGE', 'SCAM_COLLECTOR'];
const MONITORING_BY_TYPE = { EXCHANGE: 'CONTINUOUS', MARKET_MAKER: 'PERIODIC', MEV_BOT: 'CONTINUOUS', RETAIL: 'NONE', BRIDGE: 'PERIODIC', SCAM_COLLECTOR: 'CONTINUOUS' };
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
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
  const ambiguityHonoured = ambiguous.filter((result) => {
    const label = intended.get(result.item.id);
    return !result.evaluation.clear || [label.type, label.ambiguousWith].includes(result.evaluation.walletType);
  });
  const automationError = mean(graded.map((result) => Math.abs(result.evaluation.automation - intended.get(result.item.id).automation)));

  return {
    note: `Two hundred fictional wallets across six behavioural types. The ten deliberately ambiguous wallets are scored separately: saying the type is unclear is a valid answer. ${context.caveat ?? ''}`,
    findings: findings(clear, ambiguous, intended),
    kpis: [
      { label: 'Clear wallet types correct', value: percent(correct.length, clear.length), context: `${correct.length} of ${clear.length}; ambiguous wallets are not in this denominator`, tone: correct.length === clear.length ? 'good' : 'warn' },
      { label: 'Ambiguity handled fairly', value: `${ambiguityHonoured.length} of ${ambiguous.length}`, context: 'unclear, or one of the two planted neighbouring types', tone: ambiguityHonoured.length === ambiguous.length ? 'good' : 'warn' },
      { label: 'Automation mean absolute error', value: automationError.toFixed(2), context: 'points on the zero-to-six rubric', tone: automationError <= 1 ? 'good' : 'warn' },
      { label: 'Monitoring agrees', value: percent(graded.filter((result) => result.evaluation.monitoring === MONITORING_BY_TYPE[intended.get(result.item.id).type]).length, graded.length), context: 'against the operational level attached to each labelled type' },
    ],
    distribution: TYPES.map((type) => ({ label: title(type), count: results.filter((result) => result.evaluation.walletType === type).length })).filter((entry) => entry.count),
    matrix: confusion(clear, intended),
    fingerprints: fingerprintChart(graded, intended),
    checks: [
      { id: 'ambiguous', label: 'Ambiguous wallets forced into one wrong type', detail: 'These planted boundary cases were called clear and were not labelled as either plausible neighbour.', count: ambiguous.length - ambiguityHonoured.length, of: ambiguous.length, items: ambiguous.filter((result) => !ambiguityHonoured.includes(result)).map((result) => result.item.id) },
      ...TYPES.map((type) => {
        const group = clear.filter((result) => intended.get(result.item.id).type === type);
        const missed = group.filter((result) => result.evaluation.walletType !== type);
        return { id: type.toLowerCase(), label: `${title(type)} wallets called something else`, detail: questions.wallet_type.criteria[type], count: missed.length, of: group.length, items: missed.map((result) => result.item.id) };
      }),
    ],
    topItems: ambiguous.map((result) => {
      const label = intended.get(result.item.id);
      return { id: result.item.id, label: `${result.item.id} · planted between ${readable(label.type)} and ${readable(label.ambiguousWith)} · called ${readable(result.evaluation.walletType)}${result.evaluation.clear ? ' (clear)' : ' (unclear)'}` };
    }),
  };
}
// #endregion

function confusion(clear, intended) {
  return {
    title: 'Behaviour type: planted against called (select a populated cell to open its wallets)',
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

function findings(clear, ambiguous, intended) {
  const lines = [];
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
  const forced = ambiguous.filter((result) => {
    const label = intended.get(result.item.id);
    return result.evaluation.clear && ![label.type, label.ambiguousWith].includes(result.evaluation.walletType);
  });
  if (forced.length) lines.push(`${forced.length} ambiguous wallets were forced into an unrelated type instead of being deferred.`);
  return lines;
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
