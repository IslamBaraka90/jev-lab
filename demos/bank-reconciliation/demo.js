// Bank reconciliation: one open statement line, five ledger candidates, and a decision that can be
// graded against synthetic ground truth without putting that truth anywhere in the model state.

import { choice, noul, score } from '../lib/questions.js';

const QUALITY_THRESHOLD = 4;
const CLEAR_PROBABILITY = 0.5;
const BREAK_REASONS = ['TIMING', 'BANK_FEE', 'FX_DIFFERENCE', 'PARTIAL_PAYMENT', 'DUPLICATE', 'MISSING_IN_BOOKS', 'MATCHED'];
const round = (value) => Number(value.toFixed(2));
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const signed = (line) => (line.direction === 'INFLOW' ? line.amount : -line.amount);
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

function selectedEntry(item, answer) {
  if (answer === 'NONE') return null;
  const index = Number(answer.replace('CANDIDATE_', '')) - 1;
  return Number.isInteger(index) ? item.candidates[index] ?? null : null;
}

// #region demo:state
/** The statement line and ranked candidates are all the model sees; labels stay in a separate file. */
function buildState(item, context) {
  return {
    task: 'Reconcile this open bank statement line to one ledger entry, or decide that none matches.',
    period: context.period,
    bank_account: {
      bank: context.bank.name,
      account_reference: context.bank.accountReference,
      currency: context.currency,
      opening_balance: context.openingBalance,
      closing_balance: context.closingBalance,
      bank_reference_format: context.referenceFormat,
    },
    statement_line: item.statement,
    candidate_ledger_entries: item.candidates.map((entry, index) => ({
      option: `CANDIDATE_${index + 1}`,
      ...entry,
    })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  best_match: choice('Which candidate ledger entry best matches the statement line?', {
    CANDIDATE_1: 'The first candidate in the ranked ledger list.',
    CANDIDATE_2: 'The second candidate in the ranked ledger list.',
    CANDIDATE_3: 'The third candidate in the ranked ledger list.',
    CANDIDATE_4: 'The fourth candidate in the ranked ledger list.',
    CANDIDATE_5: 'The fifth candidate in the ranked ledger list.',
    NONE: 'No candidate is the same underlying transaction.',
  }),
  match_quality: score('How strong is the match between the statement line and the chosen candidate?', [
    'No match',
    'Weak',
    'Possible',
    'Likely',
    'Strong',
    'Near certain',
    'Exact',
  ]),
  break_reason: choice('What explains why this statement line did not pre-clear automatically?', {
    TIMING: 'The same transaction was posted on a meaningfully different date.',
    BANK_FEE: 'The bank charged a fee that has not been booked.',
    FX_DIFFERENCE: 'The transaction-currency amount agrees but the account-currency amount changed.',
    PARTIAL_PAYMENT: 'The bank movement settles only part of the booked amount.',
    DUPLICATE: 'The books contain more than one posting for the same bank movement.',
    MISSING_IN_BOOKS: 'The bank movement has no corresponding ledger entry.',
    MATCHED: 'One candidate is the transaction despite a messy reference or date.',
  }),
  auto_clear: noul('Should this line be cleared automatically without a person opening it?', {
    yes: 'The match is strong, singular, and safe to clear.',
    no: 'A person should resolve the difference or ambiguity.',
  }),
};
// #endregion

// #region demo:evaluate
/** Converts four typed answers into the operating decision shown beside this statement line. */
function evaluate(answers, item) {
  const entry = selectedEntry(item, answers.best_match.choice);
  const reason = answers.break_reason.choice;
  const quality = answers.match_quality.score;
  const clearProbability = answers.auto_clear.noul;
  const autoCleared = Boolean(entry) && reason === 'MATCHED' && quality >= QUALITY_THRESHOLD && clearProbability >= CLEAR_PROBABILITY;

  return {
    flagged: reason !== 'MATCHED',
    bestMatch: entry?.id ?? 'NONE',
    breakReason: reason,
    matchQuality: quality,
    clearProbability,
    autoCleared,
    forReview: !autoCleared,
    label: autoCleared ? `${item.id}: auto-clear to ${entry.id}` : `${item.id}: ${readable(reason)}`,
  };
}
// #endregion

// #region demo:report
/** Grades matching and break reasons, then turns the quality bar into automation and workload. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const labelByItem = new Map(labels.map((label) => [label.statementLineId, label]));
  const problems = groupProblems(labels);
  const correct = results.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const cleared = results.filter((result) => result.evaluation.autoCleared);
  const gradedClears = cleared.filter((result) => labelByItem.has(result.item.id));
  const preciseClears = gradedClears.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const remaining = context.items.filter((item) => !cleared.some((result) => result.item.id === item.id));
  const reconciliation = reconcile(context, cleared, remaining);

  return {
    note: `Graded against ${problems.size} planted reconciliation problems. Labels never enter the model state.`,
    findings: clusterDisagreements(results, labelByItem),
    kpis: kpis(results, cleared, gradedClears, preciseClears, remaining, context.currency),
    distribution: distribution(results),
    matrix: confusion(results, labelByItem),
    curve: coverage(results, labelByItem, labels),
    checks: checks(results, labels, problems, labelByItem, reconciliation),
    topItems: topItems(results, labelByItem, context.currency),
    reconciliation,
    resolvedProblems: resolvedProblemCount(correct, problems),
  };
}
// #endregion

function agrees(result, label) {
  return Boolean(label) && result.evaluation.bestMatch === (label.matchesEntryId ?? 'NONE') && result.evaluation.breakReason === label.breakReason;
}

function groupProblems(labels) {
  const groups = new Map();
  for (const label of labels) groups.set(label.problemId, [...(groups.get(label.problemId) ?? []), label]);
  return groups;
}

function resolvedProblemCount(correctResults, problems) {
  const itemIds = new Set(correctResults.map((result) => result.item.id));
  return [...problems.values()].filter((labels) => labels.some((label) => itemIds.has(label.statementLineId))).length;
}

function kpis(results, cleared, gradedClears, preciseClears, remaining, currency) {
  const precision = gradedClears.length ? `${Math.round((preciseClears.length / gradedClears.length) * 100)}%` : '—';
  const clearRate = results.length ? `${Math.round((cleared.length / results.length) * 100)}%` : '—';
  const gross = round(remaining.reduce((sum, item) => sum + Math.abs(signed(item.statement)), 0));
  return [
    { label: 'Auto-clear rate', value: clearRate, context: `${cleared.length} of ${results.length} at quality ${QUALITY_THRESHOLD} of 6 or higher` },
    { label: 'Clear precision', value: precision, context: `${preciseClears.length} of ${gradedClears.length} labelled clears`, tone: preciseClears.length === gradedClears.length ? 'good' : 'warn' },
    { label: 'Money left to reconcile', value: money(gross, currency), context: `${remaining.length} statement lines`, tone: remaining.length ? 'warn' : 'good' },
    { label: 'Human workload', value: remaining.length, context: `${results.length} answered so far` },
  ];
}

function reconcile(context, cleared, remaining) {
  const autoClearedNet = round(cleared.reduce((sum, result) => sum + signed(result.item.statement), 0));
  const remainingNet = round(remaining.reduce((sum, item) => sum + signed(item.statement), 0));
  const derivedClosingBalance = round(context.openingBalance + context.preClearedNet + autoClearedNet + remainingNet);
  return { openingBalance: context.openingBalance, preClearedNet: context.preClearedNet, autoClearedNet, remainingNet, derivedClosingBalance, closingBalance: context.closingBalance, difference: round(derivedClosingBalance - context.closingBalance) };
}

function checks(results, labels, problems, labelByItem, reconciliation) {
  const correct = results.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const resolved = resolvedProblemCount(correct, problems);
  const falseAlarms = results.filter((result) => labelByItem.get(result.item.id)?.breakReason === 'MATCHED' && result.evaluation.breakReason !== 'MATCHED');
  const unsafe = results.filter((result) => result.evaluation.autoCleared && !agrees(result, labelByItem.get(result.item.id)));
  const missed = labels.filter((label) => results.some((result) => result.item.id === label.statementLineId) && !correct.some((result) => result.item.id === label.statementLineId));
  return [
    { id: 'missed', label: 'Problems not resolved exactly', detail: 'Both the ledger match and break reason must agree.', count: problems.size - resolved, of: problems.size, items: missed.map((label) => label.statementLineId) },
    { id: 'false-alarms', label: 'Messy matches called breaks', detail: 'These were valid matches that only defeated the strict pre-clear rule.', count: falseAlarms.length, of: labels.filter((label) => label.breakReason === 'MATCHED').length, items: falseAlarms.map((result) => result.item.id) },
    { id: 'unsafe-clears', label: 'Incorrect lines sent through auto-clear', detail: 'A wrong match or reason at the operating point is an unsafe clear.', count: unsafe.length, of: results.length, items: unsafe.map((result) => result.item.id) },
    { id: 'balance', label: 'Closing-balance reconciliation difference', detail: 'Opening balance + pre-clears + automated lines + remaining lines must equal the statement close.', count: Math.abs(reconciliation.difference) > 0.005 ? 1 : 0, of: 1 },
  ];
}

function distribution(results) {
  return BREAK_REASONS.map((reason) => ({ label: readable(reason), count: results.filter((result) => result.evaluation.breakReason === reason).length, tone: reason === 'MATCHED' ? 'good' : 'warn' })).filter((entry) => entry.count);
}

function confusion(results, labelByItem) {
  return {
    title: 'Break reason called against what was planted',
    columns: BREAK_REASONS.map(readable),
    rows: BREAK_REASONS.map((actual) => ({
      label: readable(actual),
      cells: BREAK_REASONS.map((predicted) => ({ predicted, count: results.filter((result) => labelByItem.get(result.item.id)?.breakReason === actual && result.evaluation.breakReason === predicted).length, diagonal: actual === predicted })),
    })),
  };
}

function wouldClear(result, minimumQuality) {
  return result.evaluation.bestMatch !== 'NONE' && result.evaluation.breakReason === 'MATCHED' && result.evaluation.clearProbability >= CLEAR_PROBABILITY && result.evaluation.matchQuality >= minimumQuality;
}

function coverage(results, labelByItem, labels) {
  const matchProblems = new Set(labels.filter((label) => label.breakReason === 'MATCHED').map((label) => label.problemId));
  const points = Array.from({ length: 7 }, (_, minimumQuality) => {
    const automated = results.filter((result) => wouldClear(result, minimumQuality));
    const correct = automated.filter((result) => agrees(result, labelByItem.get(result.item.id)));
    return { threshold: round(minimumQuality / 6), reviewed: results.length - automated.length, caught: new Set(correct.map((result) => labelByItem.get(result.item.id).problemId)).size };
  });
  return { title: 'Quality threshold and human workload', xLabel: 'Lines a person opens', yLabel: 'Correct auto-clears', of: matchProblems.size, points };
}

function clusterDisagreements(results, labelByItem) {
  const wrong = results.filter((result) => labelByItem.has(result.item.id) && !agrees(result, labelByItem.get(result.item.id)));
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const label = labelByItem.get(result.item.id);
    const key = `${label.breakReason}|${result.evaluation.breakReason}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const [key, group] = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  if (group.length < 3 || group.length < wrong.length * 0.3) return [];
  const [actual, predicted] = key.split('|');
  return [`${group.length} of ${wrong.length} disagreements form one look-alike cluster: ${readable(actual)} lines called ${readable(predicted)}. Review that pattern as one data question, not ${group.length} unrelated model failures.`];
}

function topItems(results, labelByItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.forReview)
    .sort((left, right) => right.item.statement.amount - left.item.statement.amount)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.evaluation.label}${agrees(result, labelByItem.get(result.item.id)) ? ' · agrees' : ''}`, value: money(result.item.statement.amount, currency) }));
}

export default {
  id: 'bank-reconciliation',
  title: 'Bank reconciliation',
  domain: 'books',
  value: 'Match the bank statement to the books, and name the reason for everything left over.',
  tags: ['reconciliation', 'accounting', 'cash', 'month end'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.statement.direction === 'INFLOW' ? '+' : '−'}${money(item.statement.amount, item.statement.currency)} · ${item.statement.description}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/bank-reconciliation.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/bank-reconciliation.js#demo:data',
    state: 'demos/bank-reconciliation/demo.js#demo:state',
    questions: 'demos/bank-reconciliation/demo.js#demo:questions',
    evaluate: 'demos/bank-reconciliation/demo.js#demo:evaluate',
  },
};
