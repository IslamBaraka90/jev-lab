// Ledger integrity review: one journal line at a time, with its document, its account's habits and the
// postings that look like it. The planted problems live outside this folder and are only used to grade
// the report, never to build a state.

import { choice, noul, score } from '../lib/questions.js';

const round = (value) => Number(value.toFixed(2));
const money = (line) => round(line.debit || line.credit);

/** What this account normally looks like this month: how often, how much, and against which accounts. */
function accountHabits(item, items) {
  const postings = items.filter((line) => line.account === item.account);
  const amounts = postings.map(money).sort((a, b) => a - b);
  const counterAccounts = new Map();
  for (const posting of postings) {
    for (const sibling of items) {
      if (sibling.documentId !== posting.documentId || sibling.id === posting.id) continue;
      counterAccounts.set(sibling.accountName, (counterAccounts.get(sibling.accountName) ?? 0) + 1);
    }
  }
  return {
    postings: postings.length,
    medianAmount: amounts[Math.floor(amounts.length / 2)] ?? 0,
    largestAmount: amounts.at(-1) ?? 0,
    usualCounterAccounts: [...counterAccounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
  };
}

/** Other postings this month with the same counterparty and the same amount: how a duplicate shows up. */
function lookalikes(item, items) {
  return items
    .filter((line) => line.id !== item.id && line.documentId !== item.documentId && line.counterparty && line.counterparty === item.counterparty && money(line) === money(item))
    .slice(0, 4)
    .map((line) => ({ document: line.documentId, date: line.date, amount: money(line), memo: line.memo }));
}

// #region demo:state
/** Everything the model sees for one journal line. No labels, no hints, nothing from after the month. */
function buildState(item, context) {
  const document = context.items.filter((line) => line.documentId === item.documentId);
  const totals = document.reduce((sums, line) => ({ debit: round(sums.debit + line.debit), credit: round(sums.credit + line.credit) }), { debit: 0, credit: 0 });

  return {
    task: 'Review one journal line of a monthly general ledger and decide whether it was posted correctly.',
    entity: context.entity,
    period: context.period,
    currency: context.currency,
    line: {
      id: item.id,
      date: item.date,
      account: `${item.account} ${item.accountName}`,
      account_type: item.accountType,
      normal_balance: item.normalBalance,
      debit: item.debit,
      credit: item.credit,
      memo: item.memo,
      counterparty: item.counterparty,
      reference: item.reference,
      posted_by: item.postedBy,
      posted_at: item.postedAt,
    },
    document: {
      id: item.documentId,
      lines: document.map((line) => ({ id: line.id, account: `${line.account} ${line.accountName}`, debit: line.debit, credit: line.credit, memo: line.memo })),
      total_debit: totals.debit,
      total_credit: totals.credit,
    },
    account_this_month: accountHabits(item, context.items),
    same_amount_same_counterparty: lookalikes(item, context.items),
    chart_of_accounts: context.accounts.map((account) => `${account.code} ${account.name} (${account.type}, normally ${account.normalBalance})`),
  };
}
// #endregion

// #region demo:questions
const questions = {
  issue_type: choice('Which posting problem, if any, does this journal line have?', {
    DUPLICATE_POSTING: 'The same transaction has already been posted in another document.',
    REVERSED_SIGN: 'The amount is on the wrong side for this account.',
    MISSING_COUNTER_ENTRY: 'The document has no matching entry on the other side.',
    PERIOD_CUTOFF: 'The line is dated outside the period it was posted in.',
    MISCLASSIFIED_ACCOUNT: 'The posting belongs in a different account.',
    NONE: 'The line looks correct.',
  }),
  document_balances: noul('Do the lines of this document balance, with total debits equal to total credits?'),
  memo_matches_posting: noul('Does the memo describe what was actually posted, in this account and on this side?'),
  severity: score('If something is wrong with this line, how serious is it for the month-end accounts?', [
    'Nothing wrong',
    'Cosmetic',
    'Minor',
    'Notable',
    'Material',
    'Serious',
    'Critical',
  ]),
  needs_human_review: noul('Should a person open this line before the books are closed?'),
};
// #endregion

// #region demo:evaluate
/** The flag the page shows and the numbers the report counts, from the five answers. */
function evaluate(answers, item) {
  const issue = answers.issue_type.choice;
  const flagged = issue !== 'NONE';
  const review = answers.needs_human_review.noul;

  return {
    flagged,
    issue,
    confidence: answers.issue_type.confidence,
    severity: answers.severity.score,
    balances: answers.document_balances.noul >= 0.5,
    memoMatches: answers.memo_matches_posting.noul >= 0.5,
    review,
    forReview: review >= REVIEW_THRESHOLD,
    label: flagged ? `${item.id}: ${readable(issue)}` : `${item.id}: clean`,
  };
}
// #endregion

const REVIEW_THRESHOLD = 0.5;
const readable = (issue) => issue.toLowerCase().replaceAll('_', ' ');
const ISSUES = ['DUPLICATE_POSTING', 'REVERSED_SIGN', 'MISSING_COUNTER_ENTRY', 'PERIOD_CUTOFF', 'MISCLASSIFIED_ACCOUNT', 'NONE'];

// #region demo:report
/** Grades the run against the planted problems: caught, missed, false alarms, and the review workload. */
function report(results, { labels = [] } = {}) {
  const planted = new Map(labels.map((label) => [label.lineId, label]));
  const problems = [...new Set(labels.map((label) => label.problemId))];
  const found = (result) => planted.get(result.item.id)?.issue === result.evaluation.issue;

  const flagged = results.filter((result) => result.evaluation.flagged);
  const caught = new Set(flagged.filter(found).map((result) => planted.get(result.item.id).problemId));
  const falseAlarms = flagged.filter((result) => !planted.has(result.item.id));
  const missed = labels.filter((label) => !caught.has(label.problemId) && results.some((result) => result.item.id === label.lineId));

  return {
    note: `Graded against ${problems.length} problems planted in ${labels.length} lines. The model never sees them.`,
    findings: cluster(falseAlarms),
    kpis: [
      { label: 'Lines reviewed', value: results.length },
      { label: 'Problems caught', value: `${caught.size} of ${problems.length}`, tone: caught.size === problems.length ? 'good' : 'warn' },
      { label: 'Lines flagged', value: flagged.length, context: `${falseAlarms.length} with nothing planted` },
      { label: 'Sent to a person', value: results.filter((result) => result.evaluation.forReview).length, context: `at ${Math.round(REVIEW_THRESHOLD * 100)}% and above` },
    ],
    distribution: countIssues(results),
    matrix: confusion(results, planted),
    curve: coverage(results, planted, problems.length),
    checks: [
      { id: 'missed', label: 'Planted problems the model did not name', detail: 'Graded on the issue type, not just on flagging the line.', count: new Set(missed.map((label) => label.problemId)).size, of: problems.length, items: missed.map((label) => label.lineId) },
      { id: 'false-alarms', label: 'Clean lines flagged as problems', detail: 'Each one costs a person time at month end.', count: falseAlarms.length, of: results.length - labels.length, items: falseAlarms.map((result) => result.item.id) },
    ],
    topItems: [...flagged]
      .sort((a, b) => b.evaluation.severity - a.evaluation.severity)
      .slice(0, 10)
      .map((result) => ({ id: result.item.id, label: `${result.evaluation.label}${planted.has(result.item.id) ? ' · planted' : ''}`, value: result.evaluation.severity.toFixed(1) })),
  };
}
// #endregion

/**
 * The biggest group of false alarms that share an account and a verdict. One repeated disagreement says
 * something different from scattered mistakes, and it is usually worth reading before blaming the model.
 */
function cluster(falseAlarms) {
  if (falseAlarms.length < 5) return [];
  const groups = new Map();
  for (const result of falseAlarms) {
    const key = `${result.item.accountName}|${result.evaluation.issue}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const [key, group] = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  if (group.length < falseAlarms.length * 0.3) return [];
  const [accountName, issue] = key.split('|');
  const share = Math.round((group.length / falseAlarms.length) * 100);
  return [
    `${group.length} of the ${falseAlarms.length} false alarms are the same objection: ${readable(issue)} on ${accountName}, ${share}% of them. One repeated disagreement is worth reading before it is counted as a mistake.`,
  ];
}

function countIssues(results) {
  return ISSUES.map((issue) => ({
    label: readable(issue),
    count: results.filter((result) => result.evaluation.issue === issue).length,
    tone: issue === 'NONE' ? 'good' : 'warn',
  })).filter((entry) => entry.count > 0);
}

/** Predicted issue against what was actually planted, so mistakes are visible by kind. */
function confusion(results, planted) {
  return {
    title: 'What it called them, against what was planted',
    rows: ISSUES.map((actual) => ({
      label: readable(actual),
      cells: ISSUES.map((predicted) => ({
        predicted,
        count: results.filter((result) => (planted.get(result.item.id)?.issue ?? 'NONE') === actual && result.evaluation.issue === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
    columns: ISSUES.map(readable),
  };
}

/** How many lines a person reads, and how many problems that catches, as the review threshold moves. */
function coverage(results, planted, problemCount) {
  const points = [];
  for (let threshold = 0; threshold <= 0.9; threshold += 0.1) {
    const opened = results.filter((result) => result.evaluation.review >= threshold);
    const caught = new Set(opened.filter((result) => planted.has(result.item.id)).map((result) => planted.get(result.item.id).problemId));
    points.push({ threshold: round(threshold), reviewed: opened.length, caught: caught.size });
  }
  return { title: 'Review threshold', xLabel: 'Lines a person opens', yLabel: 'Problems caught', of: problemCount, points };
}

export default {
  id: 'ledger-integrity',
  title: 'Ledger integrity review',
  domain: 'books',
  value: 'Find the journal lines that do not reconcile, and say why each one is wrong.',
  tags: ['reconciliation', 'accounting', 'audit', 'month end'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'ledger',
  itemLabel: (item) => `${item.id} · ${item.accountName}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/ledger-integrity.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/ledger-integrity.js#demo:data',
    state: 'demos/ledger-integrity/demo.js#demo:state',
    questions: 'demos/ledger-integrity/demo.js#demo:questions',
    evaluate: 'demos/ledger-integrity/demo.js#demo:evaluate',
  },
};
