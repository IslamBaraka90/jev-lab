import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/order-risk/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The demo is only worth anything if both costs are visible: fraud that ships, and good customers
// turned away. So the tests check the planted fraud, the twelve good orders built to look bad, and
// that no single field separates them — otherwise this would be a filter, not a judgement.

const dataset = await loadDataset('order-risk');
const labels = await loadLabels('order-risk');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.orderId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ decision, pattern, risk, consistent = true, stepUp = false }) => ({
  decision: { type: 'choice', choice: decision, confidence: 0.85, probabilities: { [decision]: 0.85 } },
  fraud_pattern: { type: 'choice', choice: pattern, confidence: 0.8, probabilities: { [pattern]: 0.8 } },
  risk: { type: 'score', score: risk, confidence: 0.7, legend: {}, probabilities: {} },
  address_consistent: { type: 'noul', noul: consistent ? 0.9 : 0.1 },
  step_up_would_help: { type: 'noul', noul: stepUp ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({ decision: label.fraud ? 'DECLINE' : 'APPROVE', pattern: label.pattern, risk: label.fraud ? 5.5 : 0.5 }) };
};

test('the dataset plants nine frauds in four patterns and twelve good orders that look bad', () => {
  assert.equal(dataset.items.length, 300);
  assert.equal(labels.filter((label) => label.fraud).length, 9);
  assert.equal(ofKind('decoy').length, 12);
  assert.equal(ofKind('ordinary').length, 279);

  for (const pattern of ['CARD_TESTING', 'RESHIPPER', 'ACCOUNT_TAKEOVER', 'FIRST_PARTY_MISUSE']) {
    assert.ok(labels.filter((label) => label.pattern === pattern).length >= 2, `${pattern} must appear at least twice`);
  }
  assert.equal(new Set(ofKind('decoy').map((label) => label.look)).size, 4, 'four kinds of good order that look bad');
});

test('no single signal separates fraud from ordinary trade', () => {
  const ordinary = ofKind('ordinary').map((label) => item(label.orderId));
  const some = (predicate) => ordinary.filter(predicate).length;

  assert.ok(some((entry) => entry.priorChargebacks > 0) >= 5, 'ordinary customers have chargebacks too');
  assert.ok(some((entry) => entry.shippingCountry !== 'GB') >= 5, 'ordinary orders ship abroad too');
  assert.ok(some((entry) => entry.connectionCountry !== 'GB') >= 5, 'ordinary customers connect from abroad too');
  assert.ok(some((entry) => entry.deviceIsNew) >= 20, 'ordinary customers use new devices too');
  assert.ok(some((entry) => entry.accountChangedHoursAgo !== null) >= 5, 'ordinary accounts change details too');
});

test('the card testing burst is one device, three cards, one night', () => {
  const burst = labels.filter((label) => label.pattern === 'CARD_TESTING').map((label) => item(label.orderId));
  assert.equal(new Set(burst.map((entry) => entry.deviceId)).size, 1);
  assert.equal(new Set(burst.map((entry) => entry.card)).size, burst.length);
  assert.ok(burst.every((entry) => entry.total < 60 && entry.ordersFromThisDeviceToday >= 4));
});

test('the state carries the basket, the device and the addresses, and no answer', () => {
  const burst = item(labels.find((label) => label.pattern === 'CARD_TESTING').orderId);
  const state = demo.buildState(burst, context);

  assert.equal(state.order.basket.length >= 1, true);
  assert.equal(state.device.orders_from_this_device_today, burst.ordersFromThisDeviceToday);
  assert.equal(state.addresses.billing.country, burst.billingCountry);
  assert.equal(state.store.average_order_value, 118);

  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('CARD_TESTING'), false);
  assert.equal(serialised.includes('ordinary'), false);
  assert.equal(serialised.includes('"fraud"'), false);
});

test('a perfect run stops every fraud and turns nobody away', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Fraud stopped').value, '9 of 9');
  assert.equal(kpi(report, 'Pattern named right').value, '9 of 9');
  assert.equal(kpi(report, 'Good orders declined').value, 0);
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0, 0], 'including orders approved with a fraud pattern named');
  assert.deepEqual(report.findings, []);
});

test('declining everything that crosses a border is a bad rule, and the report says so in money', async () => {
  const abroad = (entry) => entry.shippingCountry !== 'GB' || entry.connectionCountry !== 'GB';
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ decision: abroad(entry) ? 'DECLINE' : 'APPROVE', pattern: abroad(entry) ? 'RESHIPPER' : 'NONE', risk: abroad(entry) ? 4 : 0.5 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Fraud stopped').value, '2 of 9', 'only the reshippers cross a border');
  assert.ok(kpi(report, 'Good orders declined').value > 10, 'and it turns away a pile of good customers');
  assert.match(kpi(report, 'Good orders declined').context, /£[\d,]+ of basket value turned away/);
  assert.ok(report.findings.some((line) => /went straight through/.test(line)), 'the fraud it missed is named');
});

test('the risk bar trades workload against how much of the queue is fraud', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = planted.get(entry.id);
      const risk = label.fraud ? 6 : label.kind === 'decoy' ? 3 : 0.5;
      return { answers: answerFor({ decision: risk >= 3 ? 'REVIEW' : 'APPROVE', pattern: label.pattern, risk }) };
    },
  });
  const { curve } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 9);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'a higher bar stops fewer orders');
  }
  assert.equal(curve.points[0].reviewed, 21, 'nine frauds and twelve look-alikes');
  assert.equal(curve.points.at(-1).rate, 1, 'at the top of the scale only the fraud is left');
});

test('the confusion matrix covers every pattern and stays on the diagonal when correct', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 5);
  for (const row of matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
});
