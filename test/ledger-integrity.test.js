import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/ledger-integrity/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The state has to give a reviewer enough to find each planted problem, and the report has to grade the
// run honestly. Both are checked here with stand-in answers, so no request is needed.

const dataset = await loadDataset('ledger-integrity');
const labels = await loadLabels('ledger-integrity');
const context = demoContext(dataset);
const byId = (id) => dataset.items.find((item) => item.id === id);
const labelFor = (issue) => labels.find((label) => label.issue === issue);

const answersFor = (issue, { review = 0.9, severity = 4.2 } = {}) => ({
  issue_type: { type: 'choice', choice: issue, confidence: 0.6, probabilities: { [issue]: 0.7 } },
  document_balances: { type: 'noul', noul: issue === 'REVERSED_SIGN' || issue === 'MISSING_COUNTER_ENTRY' ? 0.1 : 0.9 },
  memo_matches_posting: { type: 'noul', noul: issue === 'MISCLASSIFIED_ACCOUNT' ? 0.2 : 0.9 },
  severity: { type: 'score', score: issue === 'NONE' ? 0.3 : severity, confidence: 0.5, legend: {}, probabilities: {} },
  needs_human_review: { type: 'noul', noul: issue === 'NONE' ? 0.1 : review },
});

test('the dataset carries eleven planted problems over thirteen lines', () => {
  assert.equal(dataset.items.length, 502);
  assert.equal(labels.length, 13);
  assert.equal(new Set(labels.map((label) => label.problemId)).size, 11);
  assert.deepEqual(
    [...new Set(labels.map((label) => label.issue))].sort(),
    ['DUPLICATE_POSTING', 'MISCLASSIFIED_ACCOUNT', 'MISSING_COUNTER_ENTRY', 'PERIOD_CUTOFF', 'REVERSED_SIGN'],
  );
});

test('the state shows the document, the account habits and the lookalikes, and no labels', () => {
  const duplicate = byId(labelFor('DUPLICATE_POSTING').lineId);
  const state = demo.buildState(duplicate, context);

  assert.equal(state.line.id, duplicate.id);
  assert.equal(state.document.id, duplicate.documentId);
  assert.ok(state.document.lines.length >= 2);
  assert.ok(state.account_this_month.postings > 1);
  assert.ok(state.account_this_month.usualCounterAccounts.length > 0);
  assert.ok(state.same_amount_same_counterparty.length > 0, 'a duplicate must be findable from the lookalikes');
  assert.ok(state.chart_of_accounts.length > 10);

  const text = JSON.stringify(state);
  for (const label of labels) {
    assert.ok(!text.includes(label.issue), 'the state must not name a planted issue');
    assert.ok(!text.includes(label.note), 'the state must not carry a planted note');
  }
  assert.ok(!text.includes('problemId'));
});

test('an unbalanced document shows its totals so the imbalance is visible', () => {
  const reversed = byId(labelFor('REVERSED_SIGN').lineId);
  const state = demo.buildState(reversed, context);
  assert.notEqual(state.document.total_debit, state.document.total_credit);
});

test('a clean line has no lookalikes and a balanced document', () => {
  const planted = new Set(labels.map((label) => label.lineId));
  const clean = dataset.items.find((item) => !planted.has(item.id) && item.memo.startsWith('Invoice to'));
  const state = demo.buildState(clean, context);
  assert.equal(state.document.total_debit, state.document.total_credit);
});

test('the report counts problems, not lines, and separates false alarms', async () => {
  const planted = new Map(labels.map((label) => [label.lineId, label.issue]));

  const perfect = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(planted.get(item.id) ?? 'NONE') }) });
  const clean = demo.report(perfect.results, { ...context, labels });
  assert.equal(clean.kpis.find((kpi) => kpi.label === 'Problems caught').value, '11 of 11');
  assert.equal(clean.checks.find((check) => check.id === 'false-alarms').count, 0);
  assert.equal(clean.checks.find((check) => check.id === 'missed').count, 0);

  // Calling every line a duplicate catches the two real ones and buries the month in false alarms.
  const shouty = await runDemo(demo, { dataset, ask: () => ({ answers: answersFor('DUPLICATE_POSTING') }) });
  const noisy = demo.report(shouty.results, { ...context, labels });
  assert.equal(noisy.kpis.find((kpi) => kpi.label === 'Problems caught').value, '2 of 11');
  assert.equal(noisy.checks.find((check) => check.id === 'false-alarms').count, dataset.items.length - labels.length);
});

test('the coverage curve falls as the review threshold rises', async () => {
  const planted = new Map(labels.map((label) => [label.lineId, label.issue]));
  const run = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(planted.get(item.id) ?? 'NONE') }) });
  const { curve } = demo.report(run.results, { ...context, labels });

  assert.equal(curve.of, 11);
  assert.ok(curve.points.length >= 8);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'opening fewer lines as the bar rises');
    assert.ok(curve.points[index].caught <= curve.points[index - 1].caught);
  }
});

test('the confusion matrix puts a correct call on the diagonal', async () => {
  const planted = new Map(labels.map((label) => [label.lineId, label.issue]));
  const run = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(planted.get(item.id) ?? 'NONE') }) });
  const { matrix } = demo.report(run.results, { ...context, labels });

  for (const row of matrix.rows) {
    for (const cell of row.cells) {
      if (!cell.diagonal) assert.equal(cell.count, 0, `${row.label} was called ${cell.predicted}`);
    }
  }
  assert.equal(matrix.rows.find((row) => row.label === 'duplicate posting').cells.find((cell) => cell.diagonal).count, 4);
});
