// Ledger integrity review: one journal line at a time, with its document, its account's habits and the
// postings that look like it. The planted problems live outside this folder and are only used to grade
// the report, never to build a state.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

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
function report(results, { labels = [], items = [], period } = {}) {
  const planted = new Map(labels.map((label) => [label.lineId, label]));
  const problems = [...new Set(labels.map((label) => label.problemId))];
  const found = (result) => planted.get(result.item.id)?.issue === result.evaluation.issue;

  const flagged = results.filter((result) => result.evaluation.flagged);
  const named = flagged.filter(found);
  const caught = new Set(named.map((result) => planted.get(result.item.id).problemId));
  const falseAlarms = flagged.filter((result) => !planted.has(result.item.id));
  const missed = labels.filter((label) => !caught.has(label.problemId) && results.some((result) => result.item.id === label.lineId));
  const missedProblems = firstLinePerProblem(missed);
  const matrix = confusion(results, planted);
  const counts = { results: results.length, labels: labels.length, problems: problems.length, caught: caught.size, flagged: flagged.length, named: named.length, falseAlarms: falseAlarms.length };
  const comparison = alternatives(counts, ruleRun(results, planted, items, period));

  return {
    note: `Graded against ${problems.length} problems planted in ${labels.length} lines. The model never sees them.`,
    findings: [...cluster(falseAlarms), ...comparison.findings],
    kpis: kpis(counts, results.filter((result) => result.evaluation.forReview).length),
    baselines: comparison.baselines,
    metrics: metrics(counts, matrix),
    distribution: countIssues(results),
    distributionTitle: 'What each line was called',
    matrix,
    curve: coverage(results, planted, problems.length),
    checks: [
      { id: 'missed', label: 'Planted problems the model did not name', detail: 'Graded on the issue type, not just on flagging the line. A problem that spans two lines is listed once, by its first line.', count: missedProblems.length, of: problems.length, items: missedProblems },
      { id: 'false-alarms', label: 'Clean lines flagged as problems', detail: 'Each one costs a person time at month end.', count: falseAlarms.length, of: results.length - labels.length, items: falseAlarms.map((result) => result.item.id) },
    ],
    topItemsTitle: 'Flagged lines, most severe first',
    topItems: mostSevere(flagged, planted),
  };
}
// #endregion

const ratio = (part, whole) => (whole ? part / whole : 0);
const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

/** A flag list that is mostly noise is bad news, not a warning. */
function flagTone(real, flagged) {
  if (real === flagged) return 'good';
  return real * 2 < flagged ? 'bad' : 'warn';
}

/** One line id per missed problem, so the chips under the check add up to its count. */
function firstLinePerProblem(missedLabels) {
  const first = new Map();
  for (const label of missedLabels) {
    if (!first.has(label.problemId)) first.set(label.problemId, label.lineId);
  }
  return [...first.values()];
}

function plantedTag(result, planted) {
  const label = planted.get(result.item.id);
  if (!label) return 'nothing planted';
  return label.issue === result.evaluation.issue ? 'planted, named right' : `planted as ${readable(label.issue)}`;
}

/**
 * The rules baseline. A line dated outside the period is a cut-off; a one-line document that does not
 * balance is missing its counter-entry; in a longer unbalanced document the line whose flip would
 * balance it has a reversed sign; the same counterparty and amount in an earlier document makes this
 * one a duplicate. Nothing here can see a wrong account.
 */
function ruleIssue(item, items, period) {
  if (period && (item.date < period.from || item.date > period.to)) return 'PERIOD_CUTOFF';

  const document = items.filter((line) => line.documentId === item.documentId);
  const imbalance = round(document.reduce((sum, line) => sum + line.debit - line.credit, 0));
  if (imbalance !== 0 && document.length === 1) return 'MISSING_COUNTER_ENTRY';
  if (imbalance !== 0 && Math.abs((item.debit - item.credit) * 2 - imbalance) < 0.01) return 'REVERSED_SIGN';

  const earlierTwin = items.some((line) => line.documentId !== item.documentId
    && line.counterparty && line.counterparty === item.counterparty && money(line) === money(item)
    && (line.date < item.date || (line.date === item.date && line.documentId < item.documentId)));
  return earlierTwin ? 'DUPLICATE_POSTING' : 'NONE';
}

/** The rule scored the way the model is: problems named, and clean lines flagged. */
function ruleRun(results, planted, items, period) {
  const calls = results.map((result) => ({ id: result.item.id, issue: ruleIssue(result.item, items, period) }));
  const flagged = calls.filter((call) => call.issue !== 'NONE');
  const caught = new Set(flagged.filter((call) => planted.get(call.id)?.issue === call.issue).map((call) => planted.get(call.id).problemId));
  return { caught: caught.size, falseAlarms: flagged.filter((call) => !planted.has(call.id)).length };
}

/** The model beside the rule and beside no judgement at all, each scored on problems named. */
function alternatives(counts, rule) {
  const of = counts.problems;
  const baselines = [
    { label: 'Jev', detail: `problems named with the right issue type; ${counts.falseAlarms} false alarms`, value: ratio(counts.caught, of), display: `${counts.caught} of ${of}`, model: true },
    { label: 'Rule: period, balance, twin', detail: `a date outside the period, a document that does not balance, the same payment posted earlier; ${rule.falseAlarms} false alarms`, value: ratio(rule.caught, of), display: `${rule.caught} of ${of}` },
    { label: 'Always call the line clean', detail: 'the commonest answer: no problems found, no false alarms', value: 0, display: `0 of ${of}` },
  ];
  // Said only when the rule does something the model did not: more problems, or fewer false alarms.
  const ruleAddsSomething = rule.caught > counts.caught || rule.falseAlarms < counts.falseAlarms;
  const findings = ruleAddsSomething
    ? [`A three-part rule over the same fields (a date outside the period, a document that does not balance, the same payment posted earlier) names ${rule.caught} of the ${of} problems with ${rule.falseAlarms} false alarms; the model names ${counts.caught} with ${counts.falseAlarms}. The rule cannot see a wrong account, which is the one kind of problem only the model can find here.`]
    : [];
  return { baselines, findings };
}

function kpis(counts, sentToPerson) {
  return [
    { label: 'Problems caught', value: `${counts.caught} of ${counts.problems}`, context: 'named with the right issue type', tone: counts.caught === counts.problems ? 'good' : 'warn' },
    { label: 'Flags that were real', value: share(counts.named, counts.flagged), context: `${counts.named} of ${counts.flagged} flagged lines carry the planted problem`, tone: flagTone(counts.named, counts.flagged) },
    { label: 'Lines flagged', value: counts.flagged, context: `${counts.falseAlarms} with nothing planted`, tone: counts.falseAlarms ? 'warn' : 'good' },
    { label: 'Sent to a person', value: sentToPerson, context: `review answer at ${Math.round(REVIEW_THRESHOLD * 100)}% and above` },
    { label: 'Lines reviewed', value: counts.results },
  ];
}

/** Precision and recall are per line; the headline is per problem, because a duplicate spans two lines. */
function metrics(counts, matrix) {
  const stats = matrixStats(matrix);
  return {
    headline: { label: 'Problems caught', value: ratio(counts.caught, counts.problems), n: counts.problems },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: counts.flagged ? counts.named / counts.flagged : null,
    recall: counts.labels ? counts.named / counts.labels : null,
  };
}

function mostSevere(flagged, planted) {
  return [...flagged]
    .sort((a, b) => b.evaluation.severity - a.evaluation.severity)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.evaluation.label} · ${plantedTag(result, planted)}`, value: `${result.evaluation.severity.toFixed(1)} of 6` }));
}

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
    rowLabel: 'the problem that was planted',
    columnLabel: 'what the model called the line',
  };
}

// Whole percents, so a line answered at exactly 30% is inside the 30% bar. Finer between 20% and 90%,
// where the workload actually moves.
const REVIEW_BARS = [0, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

/**
 * How many lines a person reads, and how many problems land in that pile, as the review threshold moves.
 * A problem counts here when any of its lines is opened, whatever the model called it: the person
 * reading the line is the one who catches it. That is a looser test than "Problems caught".
 */
function coverage(results, planted, problemCount) {
  const points = REVIEW_BARS.map((bar) => {
    const opened = results.filter((result) => Math.round(result.evaluation.review * 100) >= bar);
    const plantedLines = opened.filter((result) => planted.has(result.item.id));
    const caught = new Set(plantedLines.map((result) => planted.get(result.item.id).problemId));
    return { threshold: bar / 100, reviewed: opened.length, caught: caught.size, rate: opened.length ? plantedLines.length / opened.length : null };
  });
  return {
    title: 'Review threshold',
    xLabel: 'Lines a person opens',
    yLabel: 'Problems with a line in the pile',
    rateLabel: 'Share of opened lines that are planted',
    of: problemCount,
    defaultIndex: REVIEW_BARS.indexOf(Math.round(REVIEW_THRESHOLD * 100)),
    points,
  };
}

const SEVERITY_LEVELS = ['Nothing wrong', 'Cosmetic', 'Minor', 'Notable', 'Material', 'Serious', 'Critical'];
const levelOf = (value) => `${SEVERITY_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;
const percentOf = (value) => `${Math.round(value * 100)}%`;
const sentence = (issue) => readable(issue).replace(/^./, (letter) => letter.toUpperCase());
const amountOf = (item, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(money(item));

/** Whether one line was called what was planted on it. A line with no label is a clean line. */
function judge(result, label) {
  const expected = label?.issue ?? 'NONE';
  const got = result.evaluation.issue;
  return {
    agree: expected === got,
    expected,
    got,
    note: gradeNote(result, label),
    confidence: result.answers.issue_type.confidence,
  };
}

function gradeNote(result, label) {
  if (label) return `Planted as ${readable(label.issue)}: ${label.note}.`;
  if (!result.evaluation.flagged) return undefined;
  if (result.item.accountName === 'VAT payable' && result.evaluation.issue === 'REVERSED_SIGN') {
    return 'Nothing planted. This is the repeated objection of the run: purchase VAT debited to the VAT payable account.';
  }
  return 'Nothing planted on this line.';
}

/** The decision card: what the line was called, how bad, and whether a person should open it. */
function verdict(result, context) {
  const { evaluation, item, answers } = result;
  const action = evaluation.forReview ? 'send to a reviewer' : 'no review asked for';
  return {
    eyebrow: 'What this line becomes at month end',
    headline: evaluation.flagged ? `${sentence(evaluation.issue)} · ${action}` : `Clean · ${evaluation.forReview ? 'but send to a reviewer' : 'post as is'}`,
    detail: `${item.debit ? 'Debit' : 'Credit'} of ${amountOf(item, context?.currency)} to ${item.account} ${item.accountName}.`,
    facts: [
      { label: 'Issue named', value: `${sentence(evaluation.issue)} · ${percentOf(evaluation.confidence)}`, tone: evaluation.flagged ? 'warn' : 'good' },
      { label: 'Severity', value: levelOf(evaluation.severity), tone: evaluation.severity >= 3.5 ? 'bad' : evaluation.severity >= 1.5 ? 'warn' : undefined },
      { label: 'Document balances', value: `${evaluation.balances ? 'Yes' : 'No'} · ${percentOf(answers.document_balances.noul)}`, tone: evaluation.balances ? 'good' : 'bad' },
      { label: 'Memo matches the posting', value: `${evaluation.memoMatches ? 'Yes' : 'No'} · ${percentOf(answers.memo_matches_posting.noul)}`, tone: evaluation.memoMatches ? 'good' : 'warn' },
      { label: 'A person should open it', value: `${evaluation.forReview ? 'Yes' : 'No'} · ${percentOf(evaluation.review)}`, tone: evaluation.forReview ? 'warn' : undefined },
    ],
  };
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
  caveat: 'Each problem type is planted only two or three times, and most of the false alarms come from one quirk of the generated chart of accounts (purchase VAT debited to VAT payable), so read the per-type numbers as examples, not rates.',
  grade: {
    labelId: (label) => label.lineId,
    judge,
  },
  verdict,
  present: {
    number: 101,
    problem: {
      headline: 'One month of journal lines, and eleven problems planted somewhere in them.',
      stat: '502',
      statLabel: 'journal lines to review',
    },
    hero: {
      item: 'L-0106',
      caption: 'A 4,740.36 payment to Pinefield Print, posted five days after the same payment in DOC-0080. The twin is in the state, and the model names the duplicate.',
    },
    answers: {
      caption: 'Five typed answers per line: what is wrong, how serious, and whether a person should open it.',
      reveal: ['issue_type', 'severity', 'needs_human_review'],
    },
    miss: {
      item: 'L-0228',
      caption: 'The same pattern six days after DOC-0092, a 2,950.00 payment to Cedar Systems, and this time the model called it clean at 38%.',
    },
    proof: {
      kpis: ['Problems caught', 'Flags that were real', 'Sent to a person'],
      chart: 'curve',
      closing: 'Open 96 of 502 lines and 9 of the 11 problems are in the pile, but only 10 of the 85 flags were real.',
    },
  },
  explain: {
    data: 'scripts/generate/ledger-integrity.js#demo:data',
    state: 'demos/ledger-integrity/demo.js#demo:state',
    questions: 'demos/ledger-integrity/demo.js#demo:questions',
    evaluate: 'demos/ledger-integrity/demo.js#demo:evaluate',
  },
};
