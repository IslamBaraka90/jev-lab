import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/three-way-match/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('three-way-match');
const labels = await loadLabels('three-way-match');
const context = demoContext(dataset);
const labelByItem = new Map(labels.map((label) => [label.packetId, label]));
const ofMismatch = (mismatch) => labels.filter((label) => label.mismatch === mismatch);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);

function answerFor(label, overrides = {}) {
  const problem = label.kind === 'problem';
  const allowed = label.kind !== 'problem';
  const mismatch = overrides.mismatch ?? label.mismatch;
  return {
    mismatch: { type: 'choice', choice: mismatch, confidence: 0.9, probabilities: { [mismatch]: 0.9 } },
    within_tolerance: { type: 'noul', noul: overrides.withinTolerance ?? (allowed ? 0.95 : 0.05) },
    overbilling_risk: { type: 'score', score: overrides.riskScore ?? (problem ? 6 : label.kind === 'within-tolerance' ? 1 : 0), confidence: 0.8, legend: {}, probabilities: {} },
    hold_payment: { type: 'noul', noul: overrides.hold ?? (problem ? 0.95 : 0.05) },
  };
}

const perfect = ({ item }) => ({ answers: answerFor(labelByItem.get(item.id)) });

test('the dataset has the exact planted mix across forty suppliers', () => {
  assert.equal(dataset.items.length, 150);
  assert.equal(labels.length, 150);
  assert.equal(new Set(dataset.items.map((item) => item.supplier)).size, 40);
  assert.equal(ofMismatch('PRICE').length, 9);
  assert.equal(ofMismatch('QUANTITY').length, 7);
  assert.equal(ofMismatch('TAX').length, 5);
  assert.equal(ofMismatch('CURRENCY').length, 4);
  assert.equal(ofMismatch('DUPLICATE').length, 3);
  assert.equal(ofMismatch('PARTIAL_DELIVERY').length, 6);
  assert.equal(ofKind('within-tolerance').length, 8);
  assert.equal(ofKind('clean').length, 108);
  assert.ok(labels.filter((label) => label.kind === 'problem').every((label) => label.amountAtRisk > 0));
  assert.ok(labels.filter((label) => label.kind !== 'problem').every((label) => label.amountAtRisk === 0));
  assert.ok(Buffer.byteLength(JSON.stringify(dataset)) < 500 * 1024);
});

test('the state carries all documents, policy, terms and at most two prior supplier packets', () => {
  const duplicateLabel = labels.find((label) => label.mismatch === 'DUPLICATE');
  const item = dataset.items.find((entry) => entry.id === duplicateLabel.packetId);
  const state = demo.buildState(item, context);

  assert.equal(state.purchase_order.id, item.purchaseOrder.id);
  assert.equal(state.goods_receipt.id, item.goodsReceipt.id);
  assert.equal(state.supplier_invoice.id, item.invoice.id);
  assert.equal(state.supplier.payment_terms, item.paymentTerms);
  assert.deepEqual(state.supplier.agreed_tolerances, { unit_price_percent: 2, quantity_units: 1 });
  assert.ok(state.previous_supplier_packets.length > 0 && state.previous_supplier_packets.length <= 2);
  assert.equal(state.previous_supplier_packets.at(-1).invoice.id, item.invoice.id, 'the duplicate is visible only in supplier history');

  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('amountAtRisk'), false);
  assert.equal(serialised.includes('within-tolerance'), false);
  assert.equal(serialised.includes('priceVariance'), false);
  assert.equal(serialised.includes('totalDifference'), false);
  assert.equal(serialised.includes('isDuplicate'), false);
});

test('a perfect run catches every problem, releases every allowed difference and has no finding', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.kpis.find((kpi) => kpi.label === 'Problems caught').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'False holds').value, '0%');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(report.findings, []);
  assert.equal(results.filter((result) => labelByItem.get(result.item.id).kind === 'within-tolerance' && result.evaluation.held).length, 0);
  for (const result of results.filter((entry) => labelByItem.get(entry.item.id).kind === 'problem')) {
    assert.equal(result.evaluation.amountAtRisk, labelByItem.get(result.item.id).amountAtRisk);
  }
});

test('holding everything exposes every non-problem as a false hold', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => {
      const label = labelByItem.get(item.id);
      return { answers: answerFor(label, { hold: 0.99 }) };
    },
  });
  const report = demo.report(results, { ...context, labels });
  const falseHolds = report.kpis.find((kpi) => kpi.label === 'False holds');

  assert.equal(falseHolds.value, '100%');
  assert.match(falseHolds.context, /^116 of 116/);
  assert.equal(report.checks.find((check) => check.id === 'within-tolerance').count, 8);
});

test('money held plus money released equals total exposure on a partial run', async () => {
  const selected = dataset.items.slice(0, 73).map((item) => item.id);
  const { results } = await runDemo(demo, {
    dataset,
    items: selected,
    ask: ({ item }) => {
      const label = labelByItem.get(item.id);
      const number = Number(item.id.slice(2));
      return { answers: answerFor(label, { hold: label.kind === 'problem' && number % 2 === 0 ? 0.95 : 0.05 }) };
    },
  });
  const { money } = demo.report(results, { ...context, labels });

  assert.equal(money.difference, 0);
  assert.equal(Number((money.held + money.released).toFixed(2)), money.total);
  assert.ok(money.held > 0);
  assert.ok(money.released > 0);
});

test('the risk threshold holds fewer packets as it rises', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });

  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'held count must not rise with the threshold');
  }
  assert.ok(curve.points[0].reviewed > curve.points.at(-1).reviewed);
  assert.equal(curve.points.at(-1).caught, 34);
});

test('the planted mismatch matrix is diagonal for a perfect run', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 7);
  assert.equal(matrix.columns.length, 7);
  for (const row of matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
});
