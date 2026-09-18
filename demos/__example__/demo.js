// The example demo: the smallest thing that exercises the whole runtime. It is loaded by the tests
// and by the dev server, and never appears in the catalog. Catalog demos follow this exact shape.

import { choice, noul, score } from '../lib/questions.js';

// #region demo:state
/** Everything the model sees for one journal line: the line, its document, and the account's context. */
function buildState(item, context) {
  const document = context.items.filter((line) => line.documentId === item.documentId);
  const totals = document.reduce(
    (sums, line) => ({ debit: round(sums.debit + line.debit), credit: round(sums.credit + line.credit) }),
    { debit: 0, credit: 0 },
  );

  return {
    task: 'Review one journal line for posting problems.',
    entity: context.entity,
    period: context.period,
    line: {
      id: item.id,
      date: item.date,
      account: `${item.account} ${item.accountName}`,
      accountType: item.accountType,
      normalBalance: item.normalBalance,
      debit: item.debit,
      credit: item.credit,
      currency: item.currency,
      memo: item.memo,
      counterparty: item.counterparty,
      reference: item.reference,
    },
    document: {
      id: item.documentId,
      lines: document.map((line) => ({ id: line.id, account: `${line.account} ${line.accountName}`, debit: line.debit, credit: line.credit, memo: line.memo })),
      totals,
    },
    accounts: context.accounts.map((account) => `${account.code} ${account.name} (${account.type}, normally ${account.normalBalance})`),
  };
}
// #endregion

const round = (value) => Number(value.toFixed(2));

// #region demo:questions
const questions = {
  issue_type: choice('Which posting problem, if any, does this journal line have?', {
    DUPLICATE_POSTING: 'The same transaction has already been posted.',
    REVERSED_SIGN: 'The amount is on the wrong side for this account.',
    MISSING_COUNTER_ENTRY: 'The document has no matching entry on the other side.',
    NONE: 'The line looks correct.',
  }),
  document_balances: noul('Do the lines of this document balance, with debits equal to credits?'),
  severity: score('How serious is any problem with this line?', [
    'No problem',
    'Cosmetic',
    'Minor',
    'Notable',
    'Material',
    'Serious',
    'Critical',
  ]),
};
// #endregion

// #region demo:evaluate
/** Turns the answers into the flag the page shows and the report counts. */
function evaluate(answers, item) {
  const issue = answers.issue_type.choice;
  const flagged = issue !== 'NONE';
  return {
    flagged,
    issue,
    confidence: answers.issue_type.confidence,
    severity: answers.severity.score,
    balances: answers.document_balances.noul >= 0.5,
    label: flagged ? `${item.id}: ${issue.toLowerCase().replaceAll('_', ' ')}` : `${item.id}: clean`,
  };
}
// #endregion

// #region demo:report
/** Rolls the per-line results up into the report, graded against the planted problems. */
function report(results, { labels = [] } = {}) {
  const planted = new Map(labels.map((label) => [label.lineId, label.issue]));
  const flagged = results.filter((result) => result.evaluation.flagged);
  const caught = flagged.filter((result) => planted.get(result.item.id) === result.evaluation.issue);
  const missed = [...planted.keys()].filter((id) => !flagged.some((result) => result.item.id === id));

  return {
    kpis: [
      { label: 'Lines reviewed', value: results.length },
      { label: 'Flagged', value: flagged.length },
      { label: 'Caught', value: `${caught.length} of ${planted.size}`, tone: caught.length === planted.size ? 'good' : 'warn' },
      { label: 'False alarms', value: flagged.length - caught.length, tone: flagged.length - caught.length === 0 ? 'good' : 'warn' },
    ],
    distribution: countBy(results, (result) => result.evaluation.issue),
    checks: [
      { id: 'missed', label: 'Planted problems missed', count: missed.length, of: planted.size, items: missed },
    ],
    topItems: [...flagged].sort((a, b) => b.evaluation.severity - a.evaluation.severity).slice(0, 5).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: result.evaluation.severity.toFixed(1) })),
  };
}
// #endregion

function countBy(results, read) {
  const counts = new Map();
  for (const result of results) counts.set(read(result), (counts.get(read(result)) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count }));
}

export default {
  id: '__example__',
  title: 'Example: one journal line',
  domain: 'books',
  value: 'The smallest demo in the project: it exists to prove the runtime works.',
  tags: ['example', 'runtime'],
  dataClass: 'synthetic',
  readMinutes: 1,
  view: 'ledger',
  hidden: true,
  itemLabel: (item) => `${item.id} · ${item.accountName}`,
  // Browser-only loaders: the bundler turns these into their own chunks, so the catalog never
  // downloads a dataset. On the server and in tests, `loadDataset`/`loadFixtures` read the files.
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  // The planted problems, used only by the report. They live outside this folder so a state builder
  // cannot reach them by accident.
  labels: () => import('../../data/synthetic/__example__.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/example.js',
    state: 'demos/__example__/demo.js#demo:state',
    questions: 'demos/__example__/demo.js#demo:questions',
    evaluate: 'demos/__example__/demo.js#demo:evaluate',
  },
};
