import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/expense-posting/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Two things have to hold: the state gives a bookkeeper enough to decide without handing over the
// answer, and the report tells the truth about accuracy and about what automation would let through.

const dataset = await loadDataset('expense-posting');
const labels = await loadLabels('expense-posting');
const context = demoContext(dataset);
const intended = new Map(labels.map((label) => [label.expenseId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);

const answerFor = (code, confidence = 0.85, clarity = 4.5) => ({
  account: { type: 'choice', choice: `ACCOUNT_${code}`, confidence, probabilities: { [`ACCOUNT_${code}`]: confidence } },
  receipt_required: { type: 'noul', noul: 0.8 },
  vat_treatment: { type: 'choice', choice: 'STANDARD', confidence: 0.7, probabilities: { STANDARD: 0.7 } },
  posting_clarity: { type: 'score', score: clarity, confidence: 0.6, legend: {}, probabilities: {} },
});

const perfect = ({ item: entry }) => ({ answers: answerFor(intended.get(entry.id).account) });

test('the dataset has the planted mix of difficulty', () => {
  assert.equal(dataset.items.length, 400);
  assert.equal(labels.length, 400);
  assert.equal(ofKind('ambiguous').length, 30);
  assert.equal(ofKind('no-memo').length, 20);
  assert.equal(ofKind('refund').length, 15);
  assert.equal(new Set(labels.map((label) => label.account)).size, 12);
  assert.equal(dataset.items.filter((entry) => entry.description === '').length, 20);
  assert.equal(dataset.items.filter((entry) => entry.amount < 0).length, 15);
});

test('the state shows the charge, the chart and a bounded vendor history, and no answer', () => {
  const withHistory = dataset.items.find((entry) => entry.priorPostings.length === 3);
  const state = demo.buildState(withHistory, context);

  assert.equal(state.expense.vendor, withHistory.vendor);
  assert.equal(state.chart_of_accounts.length, 12);
  assert.equal(state.vendor_history.length, 3, 'history is capped at three postings');
  assert.match(state.vendor_history[0], /posted to \d{4}/);

  // Nothing in the state may name the intended account for this expense.
  assert.equal(JSON.stringify(state).includes('"kind"'), false);
  assert.equal(JSON.stringify(state).includes('expenseId'), false);
  assert.equal(state.expense.account, undefined);
});

test('a first charge from a vendor has no history to lean on', () => {
  const fresh = dataset.items.find((entry) => entry.priorPostings.length === 0);
  const state = demo.buildState(fresh, context);
  assert.equal(state.vendor_history, 'No earlier charge from this vendor.');
});

test('a memo-free expense still carries the vendor and the amount', () => {
  const blank = dataset.items.find((entry) => entry.description === '');
  const state = demo.buildState(blank, context);
  assert.equal(state.expense.description, '(no description on the transaction)');
  assert.ok(state.expense.vendor.length > 3);
});

test('the report is honest when every posting is right', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.kpis.find((kpi) => kpi.label === 'Accuracy').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Accuracy when automatic').value, '100%');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0]);
  assert.deepEqual(report.findings, [], 'no findings when there is nothing to explain');
});

test('automation is measured separately from accuracy', async () => {
  // Confident and wrong on every hotel charge: the automatic rate should fall, not the volume.
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = intended.get(entry.id);
      const wrong = label.kind === 'ambiguous' && label.account === '5500';
      return { answers: answerFor(wrong ? '5510' : label.account, 0.9) };
    },
  });
  const report = demo.report(results, { ...context, labels });
  const wrongCount = ofKind('ambiguous').filter((label) => label.account === '5500').length;

  assert.equal(report.checks.find((check) => check.id === 'ambiguous').count, wrongCount);
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Posted automatically').value, '100%');
  assert.notEqual(report.kpis.find((kpi) => kpi.label === 'Accuracy when automatic').value, '100%');
  assert.match(report.findings[0] ?? '', /same swap/);
});

test('the coverage curve shows volume falling and the rate holding', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = intended.get(entry.id);
      const confident = label.kind === 'clear';
      return { answers: answerFor(confident ? label.account : '5100', confident ? 0.9 : 0.4) };
    },
  });
  const { curve } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 400);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'fewer post automatically as the bar rises');
  }
  const high = curve.points.at(-1);
  assert.ok(high.rate > curve.points[0].rate, 'what does go through automatically is more often right');
});

test('the confusion matrix covers all twelve accounts and lands on the diagonal when correct', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 12);
  assert.equal(matrix.columns.length, 12);
  for (const row of matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
});
