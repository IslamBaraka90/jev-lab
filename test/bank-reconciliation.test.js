import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/bank-reconciliation/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('bank-reconciliation');
const labels = await loadLabels('bank-reconciliation');
const context = demoContext(dataset);
const labelByItem = new Map(labels.map((label) => [label.statementLineId, label]));

function answersFor(item, label, overrides = {}) {
  const index = label.matchesEntryId ? item.candidates.findIndex((entry) => entry.id === label.matchesEntryId) : -1;
  const bestMatch = label.matchesEntryId ? `CANDIDATE_${index + 1}` : 'NONE';
  const quality = label.breakReason === 'MATCHED' ? 6 : label.matchesEntryId ? 4.5 : 0;
  return {
    best_match: { type: 'choice', choice: overrides.bestMatch ?? bestMatch, confidence: 0.9, probabilities: { [overrides.bestMatch ?? bestMatch]: 0.9 } },
    match_quality: { type: 'score', score: overrides.quality ?? quality, confidence: 0.8, legend: {}, probabilities: {} },
    break_reason: { type: 'choice', choice: overrides.reason ?? label.breakReason, confidence: 0.9, probabilities: { [overrides.reason ?? label.breakReason]: 0.9 } },
    auto_clear: { type: 'noul', noul: overrides.autoClear ?? (label.breakReason === 'MATCHED' ? 0.95 : 0.05) },
  };
}

test('the dataset has the claimed month, pre-clears and planted break counts', () => {
  assert.equal(dataset.items.length, 60);
  assert.equal(dataset.context.statementLineCount, 240);
  assert.equal(dataset.context.ledgerEntryCount, 232);
  assert.equal(dataset.context.preClearedCount, 180);
  assert.ok(Buffer.byteLength(JSON.stringify(dataset)) < 500 * 1024);

  const counts = Object.fromEntries(Object.entries(Object.groupBy(labels, (label) => label.breakReason)).map(([reason, rows]) => [reason, rows.length]));
  assert.deepEqual(counts, {
    TIMING: 12,
    BANK_FEE: 9,
    FX_DIFFERENCE: 7,
    PARTIAL_PAYMENT: 8,
    DUPLICATE: 6,
    MISSING_IN_BOOKS: 5,
    MATCHED: 13,
  });
  assert.equal(new Set(labels.map((label) => label.problemId)).size, 60);
  assert.ok(dataset.items.every((item) => item.candidates.length === 5));
  for (const label of labels.filter((entry) => entry.matchesEntryId)) {
    const item = dataset.items.find((entry) => entry.id === label.statementLineId);
    assert.ok(item.candidates.some((candidate) => candidate.id === label.matchesEntryId), `${label.matchesEntryId} is not a candidate for ${item.id}`);
  }
});

test('the state contains full candidates and balances without carrying ground truth', () => {
  const label = labels.find((entry) => entry.breakReason === 'FX_DIFFERENCE');
  const item = dataset.items.find((entry) => entry.id === label.statementLineId);
  const state = demo.buildState(item, context);

  assert.equal(state.statement_line.id, item.id);
  assert.equal(state.candidate_ledger_entries.length, 5);
  assert.equal(state.candidate_ledger_entries[0].option, 'CANDIDATE_1');
  assert.equal(state.bank_account.opening_balance, dataset.context.openingBalance);
  assert.equal(state.bank_account.closing_balance, dataset.context.closingBalance);
  assert.deepEqual(state.period, dataset.context.period);

  const text = JSON.stringify(state);
  assert.ok(!text.includes('problemId'));
  assert.ok(!text.includes('matchesEntryId'));
  assert.ok(!text.includes(label.breakReason));
  for (const planted of labels) assert.ok(!text.includes(planted.problemId));
});

test('perfect stand-in answers resolve every planted problem with no false alarms', async () => {
  const run = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(item, labelByItem.get(item.id)) }) });
  const report = demo.report(run.results, { ...context, labels });

  assert.equal(report.resolvedProblems, 60);
  assert.equal(report.checks.find((check) => check.id === 'missed').count, 0);
  assert.equal(report.checks.find((check) => check.id === 'false-alarms').count, 0);
  assert.equal(report.checks.find((check) => check.id === 'unsafe-clears').count, 0);
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Clear precision').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Auto-clear rate').value, '22%');
  assert.equal(report.reconciliation.difference, 0);
  assert.equal(report.reconciliation.derivedClosingBalance, dataset.context.closingBalance);
});

test('calling every line a timing difference performs badly and creates false alarms', async () => {
  const run = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answersFor(item, labelByItem.get(item.id), { bestMatch: 'CANDIDATE_1', reason: 'TIMING', quality: 3, autoClear: 0.05 }) }),
  });
  const report = demo.report(run.results, { ...context, labels });

  assert.ok(report.resolvedProblems <= 12);
  assert.ok(report.checks.find((check) => check.id === 'missed').count >= 48);
  assert.equal(report.checks.find((check) => check.id === 'false-alarms').count, 13);
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Auto-clear rate').value, '0%');
});

test('the quality coverage curve is monotonic as the human workload rises', async () => {
  const run = await runDemo(demo, {
    dataset,
    ask: ({ item }) => {
      const label = labelByItem.get(item.id);
      const quality = label.breakReason === 'MATCHED' ? 1 + (Number(item.id.slice(2)) % 6) : 2;
      return { answers: answersFor(item, label, { quality }) };
    },
  });
  const { curve } = demo.report(run.results, { ...context, labels });

  assert.equal(curve.of, 13);
  assert.equal(curve.points.length, 7);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed >= curve.points[index - 1].reviewed, 'a higher quality bar cannot reduce human work');
    assert.ok(curve.points[index].caught <= curve.points[index - 1].caught, 'a higher quality bar cannot add auto-clears');
  }
  assert.ok(curve.points.at(-1).reviewed > curve.points[0].reviewed);
});
