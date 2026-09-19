import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/delivery-exceptions/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('delivery-exceptions');
const labels = await loadLabels('delivery-exceptions');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.shipmentId, label]));
const ofKind = (kind) => labels.filter((label) => label.kind === kind);

function answersFor(label, overrides = {}) {
  const fault = overrides.fault ?? label.fault;
  const nextAction = overrides.nextAction ?? label.bestAction;
  return {
    fault: { type: 'choice', choice: fault, confidence: 0.9, probabilities: { [fault]: 0.9 } },
    address_quality: { type: 'score', score: overrides.addressQuality ?? label.addressQuality, confidence: 0.9, probabilities: {}, legend: {} },
    next_action: { type: 'choice', choice: nextAction, confidence: 0.9, probabilities: { [nextAction]: 0.9 } },
    preventable: { type: 'noul', noul: overrides.preventable ?? (label.preventable ? 0.95 : 0.05) },
  };
}

const perfect = ({ item }) => ({ answers: answersFor(byId.get(item.id)) });

test('dataset has 250 shipments and the exact planted cohorts', () => {
  assert.equal(dataset.items.length, 250);
  assert.equal(labels.length, 250);
  assert.equal(ofKind('address-quality').length, 38);
  assert.equal(ofKind('customer-unavailable').length, 22);
  assert.equal(ofKind('courier').length, 19);
  assert.equal(ofKind('customer-refusal').length, 11);
  assert.equal(ofKind('unclear').length, 14);
  assert.equal(ofKind('background').length, 146);
  assert.equal(labels.filter((label) => label.fault === 'UNCLEAR').length, 14);
});

test('the 11 refusal cases link back to serial-refuser customers from demo 112', async () => {
  const codLabels = await loadLabels('cod-abuse');
  const refusers = new Set(codLabels.filter((label) => label.pattern === 'SERIAL_REFUSER').map((label) => label.customerId));
  const refusalItems = ofKind('customer-refusal').map((label) => dataset.items.find((item) => item.id === label.shipmentId));
  assert.equal(refusalItems.length, 11);
  assert.ok(refusalItems.every((item) => refusers.has(item.customer.id)));
  assert.ok(refusalItems.every((item) => item.customer.linkedToDemo === 'cod-abuse'));
});

test('invalid courier attempts are derivable from raw event time, depot location and GPS distance', () => {
  const labelsWithScan = labels.filter((label) => label.neverAttemptedScan);
  assert.equal(labelsWithScan.length, 10);
  const events = labelsWithScan.map((label) => dataset.items.find((item) => item.id === label.shipmentId).trackingEvents.at(-1));
  assert.ok(events.some((event) => event.at.endsWith('T03:10:00Z')));
  assert.ok(events.every((event) => event.status === 'DELIVERY_ATTEMPTED'));
  assert.ok(events.every((event) => event.location.endsWith('central depot')));
  assert.ok(events.every((event) => event.gpsDistanceFromAddressKm > 2));
});

test('state sends the complete evidence and visible cost without labels', () => {
  const item = dataset.items[0];
  const state = demo.buildState(item, context);
  assert.equal(state.shipment_id, item.id);
  assert.equal(state.shipment.costPerAttempt, item.shipment.costPerAttempt);
  assert.deepEqual(state.tracking_events, item.trackingEvents);
  assert.deepEqual(state.address, item.address);
  assert.deepEqual(state.customer_contact_log, item.contactLog);
  assert.equal(state.fault, undefined);
  assert.equal(state.bestAction, undefined);
});

test('a perfect run grades every fault and action and preserves the unclear count', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Fault accuracy').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Next-action accuracy').value, '100%');
  assert.deepEqual(report.unclear, { predicted: 14, planted: 14 });
  assert.ok(report.money.avoidableCost > 0);
  assert.ok(report.money.allFailedAttemptCost >= report.money.avoidableCost);
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
});

test('avoidable cost is based on each visible cost per attempt', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  const expected = Number(dataset.items.reduce((sum, item) => {
    const label = byId.get(item.id);
    return sum + (label.preventable ? item.shipment.failedAttempts * item.shipment.costPerAttempt : 0);
  }, 0).toFixed(2));
  assert.equal(report.money.avoidableCost, expected);
});

test('the fault matrix is diagonal for a perfect run', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });
  for (const row of matrix.rows) for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
});

