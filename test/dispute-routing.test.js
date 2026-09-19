import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/dispute-routing/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// This demo's output is a backend call, so the tests hold the call to the same standard as the
// decision: the right endpoint, the right amount, and nothing in the state that gives the answer away.

const dataset = await loadDataset('dispute-routing');
const labels = await loadLabels('dispute-routing');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.disputeId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ action, band, reason, allows = true, automation = 5 }) => ({
  action: { type: 'choice', choice: action, confidence: 0.88, probabilities: { [action]: 0.88 } },
  refund_band: { type: 'choice', choice: band, confidence: 0.8, probabilities: { [band]: 0.8 } },
  reason_code: { type: 'choice', choice: reason, confidence: 0.82, probabilities: { [reason]: 0.82 } },
  policy_allows: { type: 'noul', noul: allows ? 0.9 : 0.1 },
  confidence_to_automate: { type: 'score', score: automation, confidence: 0.7, legend: {}, probabilities: {} },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({ action: label.correctAction, band: label.refundBand, reason: label.reasonCode }) };
};

test('the dataset plants every case the policy has a rule for', () => {
  assert.equal(dataset.items.length, 220);
  assert.equal(ofKind('friendly fraud').length, 18);
  assert.equal(ofKind('genuine non-delivery').length, 12);
  assert.equal(ofKind('duplicate charge').length, 8);
  assert.equal(ofKind('policy expired').length, 6);
  assert.equal(ofKind('needs one photo').length, 5);

  const actionsFor = (kind) => new Set(ofKind(kind).map((label) => label.correctAction));
  assert.deepEqual([...actionsFor('friendly fraud')], ['DENY']);
  assert.deepEqual([...actionsFor('genuine non-delivery')], ['REFUND_NOW']);
  assert.deepEqual([...actionsFor('policy expired')], ['DENY']);
  assert.deepEqual([...actionsFor('needs one photo')], ['REQUEST_EVIDENCE']);
  assert.ok(labels.filter((label) => label.correctAction === 'ESCALATE').length >= 10, 'the auto-refund limit sends the big ones to a person');
});

test('the state carries the policy and the evidence, and never the answer', () => {
  const state = demo.buildState(item(ofKind('friendly fraud')[0].disputeId), context);

  assert.equal(state.refund_policy.numbers.autoRefundLimit, 300);
  assert.equal(state.refund_policy.rules.length, 7);
  assert.ok(state.dispute.customer_message.length > 60);
  assert.equal(state.courier.proof_of_delivery, true);
  assert.ok(state.customer_history.of_those_not_received >= 2);

  const serialised = JSON.stringify(state);
  for (const value of ['REFUND_NOW', 'REQUEST_EVIDENCE', 'ESCALATE', 'NO_FAULT_FOUND', 'FULL_PLUS_SHIPPING', 'friendly fraud']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('the answers build the call the backend would receive', () => {
  const entry = dataset.items.find((candidate) => candidate.shippingPaid > 0 && candidate.orderTotal < 300);
  const refund = demo.evaluate(answerFor({ action: 'REFUND_NOW', band: 'FULL_PLUS_SHIPPING', reason: 'DAMAGE' }), entry, context);

  assert.equal(refund.call.endpoint, 'POST /v1/disputes/{id}/refund');
  assert.equal(refund.call.body.amount, Number((entry.orderTotal + entry.shippingPaid).toFixed(2)));
  assert.equal(refund.call.body.currency, 'GBP');
  assert.equal(refund.call.body.reason_code, 'DAMAGE');
  assert.equal(refund.call.body.dispute_id, entry.id);

  const denial = demo.evaluate(answerFor({ action: 'DENY', band: 'NONE', reason: 'NO_FAULT_FOUND', allows: false }), entry, context);
  assert.equal(denial.call.endpoint, 'POST /v1/disputes/{id}/decline');
  assert.equal(denial.call.body.notify_customer, true);
  assert.equal(denial.amount, 0, 'a denial never carries money');
  assert.equal('amount' in denial.call.body, false);
});

test('a partial band is a quarter or a half of the order, never of the shipping', () => {
  const entry = dataset.items.find((candidate) => candidate.shippingPaid > 0);
  const quarter = demo.evaluate(answerFor({ action: 'REFUND_NOW', band: 'PARTIAL_25', reason: 'NOT_AS_DESCRIBED' }), entry, context);
  const half = demo.evaluate(answerFor({ action: 'REFUND_NOW', band: 'PARTIAL_50', reason: 'NOT_AS_DESCRIBED' }), entry, context);

  assert.equal(quarter.amount, Number((entry.orderTotal * 0.25).toFixed(2)));
  assert.equal(half.amount, Number((entry.orderTotal * 0.5).toFixed(2)));
});

test('a perfect run agrees with the policy on every call', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Action agrees with policy').value, '100%');
  assert.equal(kpi(report, 'Whole call correct').value, '100%');
  assert.match(kpi(report, 'Refunded').context, /none against policy/);
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0, 0], 'including the refund calls that carry no money');
  assert.deepEqual(report.findings, []);
});

test('refunding everything is graded in money, not just in counts', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ action: 'REFUND_NOW', band: 'FULL', reason: 'NOT_AS_DESCRIBED' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'friendly-fraud').count, 18);
  assert.equal(report.checks.find((check) => check.id === 'empty-refunds').count, 0, 'a full refund on every dispute is wrong, but it is not self-contradictory');
  assert.equal(report.checks.find((check) => check.id === 'policy-expired').count, 6);
  assert.match(kpi(report, 'Refunded').context, /against policy/);
  assert.ok(report.findings.some((line) => /against the policy/.test(line)), 'the money that should not have gone out is named');
});

test('the automation bar trades volume against calls the policy agrees with', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = planted.get(entry.id);
      const easy = label.kind === 'everyday' || label.kind === 'duplicate charge';
      return { answers: answerFor({ action: easy ? label.correctAction : 'REFUND_NOW', band: label.refundBand, reason: label.reasonCode, automation: easy ? 6 : 2 }) };
    },
  });
  const { curve } = demo.report(results, { ...context, labels });

  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'a higher bar sends fewer calls unseen');
  }
  assert.equal(curve.points.at(-1).rate, 1, 'what is left at the top is right');
  assert.ok(curve.points[0].rate < 1, 'everything sent unseen is not');
});

test('the confusion matrix covers all four actions and stays on the diagonal when correct', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 4);
  for (const row of matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
});
