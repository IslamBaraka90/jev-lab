import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/cod-abuse/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('cod-abuse');
const labels = await loadLabels('cod-abuse');
const context = demoContext(dataset);
const labelByItem = new Map(labels.map((label) => [label.customerId, label]));
const ofPattern = (pattern) => labels.filter((label) => label.pattern === pattern);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);

function answerFor(label, overrides = {}) {
  const pattern = overrides.pattern ?? label.pattern;
  const intent = overrides.intent ?? label.intent;
  const restriction = overrides.restriction ?? label.restriction;
  const severity = overrides.severity ?? (label.kind === 'abuse' ? 6 : label.kind === 'innocent' ? 1 : 0);
  return {
    pattern: { type: 'choice', choice: pattern, confidence: 0.9, probabilities: { [pattern]: 0.9 } },
    intent: { type: 'choice', choice: intent, confidence: 0.8, probabilities: { [intent]: 0.8 } },
    restriction: { type: 'choice', choice: restriction, confidence: 0.9, probabilities: { [restriction]: 0.9 } },
    severity: { type: 'score', score: severity, confidence: 0.8, legend: {}, probabilities: {} },
    courier_at_fault: { type: 'noul', noul: overrides.courierAtFault ?? (label.courierAtFault ? 0.95 : 0.05) },
  };
}

const perfect = ({ item }) => ({ answers: answerFor(labelByItem.get(item.id)) });

test('the dataset has the exact planted population and bounded histories', () => {
  assert.equal(dataset.items.length, 180);
  assert.equal(labels.length, 180);
  assert.equal(ofPattern('SERIAL_REFUSER').length, 14);
  assert.equal(ofPattern('SERIAL_RETURNER').length, 9);
  assert.equal(ofPattern('ADDRESS_HOPPER').length, 7);
  assert.equal(ofPattern('PROMO_ABUSER').length, 6);
  assert.equal(ofKind('innocent').length, 10);
  assert.equal(ofKind('normal').length, 134);
  assert.ok(dataset.items.every((item) => item.orders.length >= 4 && item.orders.length <= 30));
  assert.ok(dataset.items.flatMap((item) => item.orders).every((order) => order.date >= '2025-01-01' && order.date <= '2026-06-30'));
  assert.ok(Buffer.byteLength(JSON.stringify(dataset)) < 500 * 1024);
});

test('the dataset contains the two promised camera cases', () => {
  const elevenOfFourteen = dataset.items.find((item) => item.orders.length === 14 && item.orders.filter((order) => order.deliveryOutcome === 'REFUSED').length === 11);
  assert.ok(elevenOfFourteen);
  assert.equal(labelByItem.get(elevenOfFourteen.id).pattern, 'SERIAL_REFUSER');

  const outageInnocent = dataset.items.find((item) => {
    const failures = item.orders.filter((order) => order.reasonCode === 'COURIER_OUTAGE');
    return failures.length === 3 && failures.every((order) => dataset.context.courierOutageDays.includes(order.date));
  });
  assert.ok(outageInnocent);
  assert.equal(labelByItem.get(outageInnocent.id).kind, 'innocent');
});

test('the state includes raw history, baselines, outage days and reason meanings without labels', () => {
  const label = labels.find((entry) => entry.courierAtFault);
  const item = dataset.items.find((entry) => entry.id === label.customerId);
  const state = demo.buildState(item, context);

  assert.equal(state.customer.id, item.id);
  assert.equal(state.order_history.length, item.orders.length);
  assert.equal(state.courier_outage_days.length, 7);
  assert.match(state.delivery_reason_codes.COURIER_OUTAGE, /documented courier/i);
  assert.equal(state.store_baselines.average_shipping_cost, 12.5);
  assert.equal(state.customer.pattern, undefined);
  assert.equal(state.customer.restriction, undefined);
  assert.equal(state.refusal_rate, undefined);
});

test('address hoppers are detectable from linked accounts, one phone and changing addresses', () => {
  const label = labels.find((entry) => entry.pattern === 'ADDRESS_HOPPER');
  const item = dataset.items.find((entry) => entry.id === label.customerId);
  const state = demo.buildState(item, context);

  assert.ok(state.customer.phone.startsWith('+971 50 000'));
  assert.ok(state.customer.account_ids.length >= 3);
  assert.ok(new Set(state.order_history.map((order) => order.addressUsed)).size >= 5);
});

test('a perfect run gets patterns and restrictions right and preserves every innocent', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.kpis.find((kpi) => kpi.label === 'Pattern accuracy').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Restriction accuracy').value, '100%');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
  assert.ok(report.innocents.every((entry) => entry.keptAccess));
  assert.equal(report.findings.length, 0);
  assert.ok(report.economics.shippingSaved > 0);
  assert.ok(report.economics.goodValueRestricted > 0);
});

test('restriction accuracy is graded separately from a correct pattern name', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor(labelByItem.get(item.id), { restriction: 'ALLOW' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.kpis.find((kpi) => kpi.label === 'Pattern accuracy').value, '100%');
  assert.notEqual(report.kpis.find((kpi) => kpi.label === 'Restriction accuracy').value, '100%');
  assert.equal(report.economics.shippingSaved, 0);
  assert.equal(report.economics.goodValueRestricted, 0);
});

test('restricting everyone exposes all normal and innocent customers as wrongly restricted', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor(labelByItem.get(item.id), { restriction: 'BLOCK_COD' }) }),
  });
  const report = demo.report(results, { ...context, labels });
  const restriction = report.kpis.find((kpi) => kpi.label === 'Restriction accuracy');

  assert.match(restriction.context, /^144 customers wrongly restricted/);
  assert.equal(report.checks.find((check) => check.id === 'innocents').count, 10);
  assert.ok(report.economics.shippingSaved > 0);
  assert.ok(report.economics.goodValueRestricted > 0);
});

test('the severity curve restricts fewer customers as the threshold rises', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });

  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points.at(-1).caught, 36);
  assert.ok(curve.points[0].reviewed > curve.points.at(-1).reviewed);
});

test('the pattern matrix is diagonal for a perfect run', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 5);
  assert.equal(matrix.columns.length, 5);
  for (const row of matrix.rows) for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
});
