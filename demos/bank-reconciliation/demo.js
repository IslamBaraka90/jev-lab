// Bank reconciliation: one open statement line, five ledger candidates, and a decision that can be
// graded against synthetic ground truth without putting that truth anywhere in the model state.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

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
  const graded = results.filter((result) => labelByItem.has(result.item.id));
  const matrix = confusion(results, labelByItem);
  const comparison = alternatives(graded, correct, labelByItem);

  return {
    note: `Graded against ${problems.size} planted reconciliation problems. Labels never enter the model state.`,
    findings: [...clusterDisagreements(results, labelByItem), ...comparison.findings],
    kpis: kpis({ results, graded, correct, cleared, gradedClears, preciseClears, remaining, context }),
    baselines: comparison.baselines,
    metrics: metrics({ results, graded, correct, cleared, gradedClears, preciseClears, matrix }),
    distribution: distribution(results),
    distributionTitle: 'Break reasons named',
    matrix,
    curve: coverage(results, labelByItem, labels),
    checks: checks(results, labels, problems, labelByItem),
    topItemsTitle: 'Largest lines left for a person',
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

const ratio = (part, whole) => (whole ? part / whole : 0);

function kpis({ results, graded, correct, cleared, gradedClears, preciseClears, remaining, context }) {
  const precision = gradedClears.length ? `${Math.round((preciseClears.length / gradedClears.length) * 100)}%` : '—';
  const clearRate = results.length ? `${Math.round((cleared.length / results.length) * 100)}%` : '—';
  const gross = round(remaining.reduce((sum, item) => sum + Math.abs(signed(item.statement)), 0));
  return [
    { label: 'Resolved exactly', value: `${correct.length} of ${graded.length}`, context: 'right ledger entry and right break reason', tone: correct.length === graded.length ? 'good' : 'warn' },
    { label: 'Auto-clear rate', value: clearRate, context: `${cleared.length} of ${results.length} at quality ${QUALITY_THRESHOLD} of 6 or higher${straightThrough(cleared.length, context)}` },
    { label: 'Clear precision', value: precision, context: `${preciseClears.length} of ${gradedClears.length} labelled clears`, tone: preciseClears.length === gradedClears.length ? 'good' : 'warn' },
    { label: 'Money left to reconcile', value: money(gross, context.currency), context: `gross, across ${remaining.length} statement lines`, tone: remaining.length ? 'warn' : 'good' },
    { label: 'Human workload', value: remaining.length, context: `of ${context.items.length} open lines, each left with a named reason` },
  ];
}

/** The open lines are what a strict rule could not clear; the whole statement is the fairer denominator. */
function straightThrough(clearedCount, context) {
  if (!context.statementLineCount) return '';
  const total = context.preClearedCount + clearedCount;
  return `; with the ${context.preClearedCount} the strict rule cleared, ${total} of ${context.statementLineCount} lines need nobody`;
}

function metrics({ results, graded, correct, cleared, gradedClears, preciseClears, matrix }) {
  return {
    headline: { label: 'Resolved exactly', value: ratio(correct.length, graded.length), n: graded.length },
    accuracy: ratio(correct.length, graded.length),
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    automationRate: ratio(cleared.length, results.length),
    automationPrecision: gradedClears.length ? preciseClears.length / gradedClears.length : null,
  };
}

function reconcile(context, cleared, remaining) {
  const autoClearedNet = round(cleared.reduce((sum, result) => sum + signed(result.item.statement), 0));
  const remainingNet = round(remaining.reduce((sum, item) => sum + signed(item.statement), 0));
  const derivedClosingBalance = round(context.openingBalance + context.preClearedNet + autoClearedNet + remainingNet);
  return { openingBalance: context.openingBalance, preClearedNet: context.preClearedNet, autoClearedNet, remainingNet, derivedClosingBalance, closingBalance: context.closingBalance, difference: round(derivedClosingBalance - context.closingBalance) };
}

function checks(results, labels, problems, labelByItem) {
  const correct = results.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const resolved = resolvedProblemCount(correct, problems);
  const falseAlarms = results.filter((result) => labelByItem.get(result.item.id)?.breakReason === 'MATCHED' && result.evaluation.breakReason !== 'MATCHED');
  const unsafe = results.filter((result) => result.evaluation.autoCleared && !agrees(result, labelByItem.get(result.item.id)));
  const missed = labels.filter((label) => results.some((result) => result.item.id === label.statementLineId) && !correct.some((result) => result.item.id === label.statementLineId));
  return [
    { id: 'missed', label: 'Problems not resolved exactly', detail: 'Both the ledger match and break reason must agree.', count: problems.size - resolved, of: problems.size, items: missed.map((label) => label.statementLineId) },
    { id: 'false-alarms', label: 'Messy matches called breaks', detail: 'These were valid matches that only defeated the strict pre-clear rule.', count: falseAlarms.length, of: labels.filter((label) => label.breakReason === 'MATCHED').length, items: falseAlarms.map((result) => result.item.id) },
    { id: 'unsafe-clears', label: 'Incorrect lines sent through auto-clear', detail: 'A wrong match or reason at the operating point is an unsafe clear.', count: unsafe.length, of: results.length, items: unsafe.map((result) => result.item.id) },
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
    rowLabel: 'the break reason that was planted',
    columnLabel: 'the reason the model named',
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
    return { threshold: round(minimumQuality / 6), reviewed: results.length - automated.length, caught: new Set(correct.map((result) => labelByItem.get(result.item.id).problemId)).size, rate: automated.length ? correct.length / automated.length : null };
  });
  return { title: 'Quality threshold and human workload', xLabel: 'Lines a person opens', yLabel: 'Correct auto-clears', rateLabel: 'Clear precision', of: matchProblems.size, thresholdFormat: 'level', levels: 6, defaultIndex: QUALITY_THRESHOLD, points };
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

const DAY = 24 * 60 * 60 * 1000;
const daysApart = (left, right) => Math.round(Math.abs(Date.parse(left) - Date.parse(right)) / DAY);

/**
 * The rules baseline, which reads no reference at all. Keep the candidates with the statement's payee
 * and direction. Two at the same amount is a duplicate; one is a timing difference when more than three
 * days apart and a plain match otherwise. No equal amount but one within 15% is an FX difference when
 * the entry carries a transaction currency, else a partial payment. Nothing left is a bank fee when the
 * line has no payee, and missing from the books when it has one.
 */
function ruleAnswer(item) {
  const line = item.statement;
  const samePayee = item.candidates.filter((entry) => entry.direction === line.direction && entry.counterparty && entry.counterparty === line.counterparty);
  const exact = samePayee.filter((entry) => entry.amount === line.amount);
  if (exact.length > 1) return { entry: exact[0].id, reason: 'DUPLICATE' };
  if (exact.length === 1) return { entry: exact[0].id, reason: daysApart(exact[0].date, line.date) > 3 ? 'TIMING' : 'MATCHED' };

  const near = samePayee
    .filter((entry) => Math.abs(entry.amount - line.amount) / entry.amount <= 0.15)
    .sort((left, right) => Math.abs(left.amount - line.amount) - Math.abs(right.amount - line.amount))[0];
  if (near) return { entry: near.id, reason: near.transactionCurrency ? 'FX_DIFFERENCE' : 'PARTIAL_PAYMENT' };
  return { entry: 'NONE', reason: line.counterparty ? 'MISSING_IN_BOOKS' : 'BANK_FEE' };
}

function ruleAgrees(item, label) {
  const answer = ruleAnswer(item);
  return answer.entry === (label.matchesEntryId ?? 'NONE') && answer.reason === label.breakReason;
}

/** No judgement at all: the first candidate every time, with whichever reason was planted most often. */
function commonestAnswer(graded, labelByItem) {
  const counts = new Map();
  for (const result of graded) {
    const reason = labelByItem.get(result.item.id).breakReason;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const reason = [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'MATCHED';
  const right = graded.filter((result) => {
    const label = labelByItem.get(result.item.id);
    return label.breakReason === reason && label.matchesEntryId === result.item.candidates[0]?.id;
  });
  return { reason, right: right.length };
}

/** The model beside the rule and beside no judgement, all scored as "entry and reason both agree". */
function alternatives(graded, correct, labelByItem) {
  const ruleRight = graded.filter((result) => ruleAgrees(result.item, labelByItem.get(result.item.id))).length;
  const commonest = commonestAnswer(graded, labelByItem);
  const baselines = [
    { label: 'Jev', detail: 'ledger entry and break reason both agree', value: ratio(correct.length, graded.length), model: true },
    { label: 'Rule: payee, amount, day gap', detail: 'same payee and direction, then the amount and the days apart decide the reason; no reference is read', value: ratio(ruleRight, graded.length) },
    { label: 'Always the first candidate', detail: `with the commonest reason, ${readable(commonest.reason)}`, value: ratio(commonest.right, graded.length) },
  ];
  // Worth saying whenever a few lines of code come within two lines of the model: then the data is easy.
  const close = graded.length > 0 && ruleRight >= correct.length - 2;
  const findings = close
    ? [`A rule that compares payee, amount and days apart, and never reads a reference, resolves ${ruleRight} of ${graded.length} against the model's ${correct.length}. On this dataset the model adds almost nothing over that rule.`]
    : [];
  return { baselines, findings };
}

function topItems(results, labelByItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.forReview)
    .sort((left, right) => right.item.statement.amount - left.item.statement.amount)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.evaluation.label}${agrees(result, labelByItem.get(result.item.id)) ? ' · agrees' : ''}`, value: money(result.item.statement.amount, currency) }));
}

const QUALITY_LEVELS = ['No match', 'Weak', 'Possible', 'Likely', 'Strong', 'Near certain', 'Exact'];
const percentOf = (value) => `${Math.round(value * 100)}%`;

const GRADE_NOTES = {
  TIMING: 'Planted as a timing difference: the same payment, posted five or six days apart.',
  BANK_FEE: 'Planted as a bank fee that was never booked, so no candidate is right.',
  FX_DIFFERENCE: 'Planted as an FX difference: the euro amount agrees and the dollar amount does not.',
  PARTIAL_PAYMENT: 'Planted as a partial payment against a larger open invoice.',
  DUPLICATE: 'Planted as a duplicate: the books carry this movement twice.',
  MISSING_IN_BOOKS: 'Planted as missing from the books, so no candidate is right.',
  MATCHED: 'Planted as a plain match that only a messy reference and a two or three day gap kept from pre-clearing.',
};

/** Right means what the report counts as resolved: the ledger entry and the break reason both agree. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: agrees(result, label),
    expected: `${label.matchesEntryId ?? 'no entry'} · ${readable(label.breakReason)}`,
    got: `${result.evaluation.bestMatch === 'NONE' ? 'no entry' : result.evaluation.bestMatch} · ${readable(result.evaluation.breakReason)}`,
    note: GRADE_NOTES[label.breakReason],
    confidence: Math.min(result.answers.best_match.confidence, result.answers.break_reason.confidence),
  };
}

/** One sentence on what the chosen entry and the named reason mean for this line, in money. */
function verdictDetail(line, entry, reason) {
  const amount = money(line.amount, line.currency);
  if (!entry && reason === 'BANK_FEE') return `Nothing in the books: book a bank charge of ${amount}.`;
  if (!entry) return `Nothing in the books for this ${amount}: it needs an entry before the account reconciles.`;

  const booked = money(entry.amount, entry.currency);
  const difference = money(round(Math.abs(entry.amount - line.amount)), line.currency);
  if (reason === 'PARTIAL_PAYMENT') return `${amount} moved against ${booked} booked, so ${difference} is still open.`;
  if (reason === 'FX_DIFFERENCE') return `${amount} at the bank against ${booked} booked: ${difference} of exchange difference to post.`;
  if (reason === 'DUPLICATE') return `The books carry this ${amount} more than once; one posting has to be reversed.`;

  const gap = daysApart(entry.date, line.date);
  return `${booked} booked ${gap === 0 ? 'the same day' : `${gap} day${gap === 1 ? '' : 's'} apart`}.`;
}

/** The decision card for one statement line: clear it, or leave it open with a reason. */
function verdict(result) {
  const { evaluation, item, answers } = result;
  const line = item.statement;
  const entry = item.candidates.find((candidate) => candidate.id === evaluation.bestMatch) ?? null;
  const clearUnseen = evaluation.clearProbability >= CLEAR_PROBABILITY;
  return {
    eyebrow: 'What happens to this bank line',
    headline: evaluation.autoCleared ? `Auto-clear to ${entry.id}` : `Leave open · ${readable(evaluation.breakReason)}`,
    detail: verdictDetail(line, entry, evaluation.breakReason),
    facts: [
      { label: 'Bank line', value: `${line.direction === 'INFLOW' ? '+' : '−'}${money(line.amount, line.currency)}` },
      { label: 'Ledger entry chosen', value: `${entry ? entry.id : 'None'} · ${percentOf(answers.best_match.confidence)}` },
      { label: 'Match quality', value: `${QUALITY_LEVELS[Math.round(evaluation.matchQuality)]} · ${evaluation.matchQuality.toFixed(1)} of 6`, tone: entry && evaluation.matchQuality < QUALITY_THRESHOLD ? 'warn' : undefined },
      { label: 'Break reason', value: `${readable(evaluation.breakReason)} · ${percentOf(answers.break_reason.confidence)}` },
      { label: 'Safe to clear unseen', value: `${clearUnseen ? 'Yes' : 'No'} · ${percentOf(evaluation.clearProbability)}`, tone: evaluation.autoCleared ? 'good' : undefined },
    ],
  };
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
  itemLabel: (item) => `${item.id} · ${item.statement.direction === 'INFLOW' ? '+' : '−'}${money(item.statement.amount, item.statement.currency)} · ${item.statement.description}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/bank-reconciliation.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'Every statement reference and ledger document id in this dataset ends in a token that names the planted break reason (-FEE, -PART, -FX, -DUP, MESSY), so this run measures reading, not reconciling; a dataset without those tokens is planned.',
  stage: {
    hide: ['documentId'],
    labels: {
      statement: 'Bank statement line',
      candidates: 'Ledger candidates, in ranked order',
      transactionCurrency: 'Invoice currency',
      transactionAmount: 'Invoice amount',
    },
    highlight: ['amount', 'date', 'counterparty', 'reference'],
  },
  grade: {
    labelId: (label) => label.statementLineId,
    judge,
  },
  verdict,
  present: {
    number: 102,
    problem: {
      headline: 'A strict rule cleared 180 of the 240 bank lines. These are the ones it could not.',
      stat: '60',
      statLabel: 'open statement lines',
    },
    hero: {
      item: 'S-0033',
      caption: 'The bank and the books wrote the reference differently and posted three days apart. The payee and the $3,266.53 agree, so the line clears without a person.',
    },
    answers: {
      caption: 'Four typed answers: which entry, how strong the match, why it broke, and whether it is safe to clear unseen.',
      reveal: ['best_match', 'match_quality', 'break_reason', 'auto_clear'],
    },
    miss: {
      item: 'S-0198',
      caption: 'Nothing was graded wrong in this run. This is the least sure answer: a $10.75 account service fee, called an unbooked bank fee at 54%, with missing from the books as the runner-up.',
    },
    proof: {
      kpis: ['Resolved exactly', 'Auto-clear rate', 'Clear precision'],
      chart: 'baselines',
      closing: '60 of 60 resolved, and a rule that never reads a reference resolves 59: this dataset is too easy to prove much.',
    },
  },
  explain: {
    data: 'scripts/generate/bank-reconciliation.js#demo:data',
    state: 'demos/bank-reconciliation/demo.js#demo:state',
    questions: 'demos/bank-reconciliation/demo.js#demo:questions',
    evaluate: 'demos/bank-reconciliation/demo.js#demo:evaluate',
  },
};
