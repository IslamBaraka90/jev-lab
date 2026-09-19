import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/mule-network/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Every account is answered on its own, so the thing worth testing is whether the networks can be put
// back together from those answers — and whether the payroll cluster, which fans out exactly like a
// network, is left alone.

const dataset = await loadDataset('mule-network');
const labels = await loadLabels('mule-network');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.accountId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofRole = (role) => labels.filter((label) => label.role === role);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ role, action, confidence = 5, passThrough = false, income = true }) => ({
  role: { type: 'choice', choice: role, confidence: 0.85, probabilities: { [role]: 0.85 } },
  pass_through: { type: 'noul', noul: passThrough ? 0.9 : 0.1 },
  network_confidence: { type: 'score', score: confidence, confidence: 0.7, legend: {}, probabilities: {} },
  action: { type: 'choice', choice: action, confidence: 0.8, probabilities: { [action]: 0.8 } },
  income_consistent: { type: 'noul', noul: income ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  const inNetwork = Boolean(label.networkId);
  return { answers: answerFor({
    role: label.role,
    action: label.role === 'COLLECTOR' ? 'FREEZE' : label.role === 'MULE' ? 'RESTRICT_OUTBOUND' : inNetwork ? 'MONITOR' : 'NO_ACTION',
    confidence: inNetwork ? 5.5 : 0.5,
    passThrough: label.role === 'MULE',
    income: !inNetwork,
  }) };
};

test('three networks are planted with the roles the spec asks for', () => {
  assert.equal(dataset.items.length, 120);
  assert.equal(ofRole('COLLECTOR').length, 3);
  assert.equal(ofRole('MULE').length, 14);
  assert.equal(ofRole('ORIGINATOR').length, 4);
  assert.equal(ofRole('UNRELATED').length, 99);
  assert.equal(new Set(labels.filter((label) => label.networkId).map((label) => label.networkId)).size, 3);
  assert.equal(labels.filter((label) => label.kind === 'touched a network').length, 12);
});

test('mules pass money through in minutes and keep almost none of it', () => {
  const mules = ofRole('MULE').map((label) => item(label.accountId));
  const ordinary = ofRole('UNRELATED').map((label) => item(label.accountId)).filter((entry) => entry.medianMinutesInToOut !== null);

  assert.ok(mules.every((entry) => entry.keptPercent <= 30), 'a mule does not keep the money');
  const muleMedian = mules.map((entry) => entry.medianMinutesInToOut).filter(Boolean).sort((a, b) => a - b);
  const ordinaryMedian = ordinary.map((entry) => entry.medianMinutesInToOut).sort((a, b) => a - b);
  assert.ok(muleMedian[Math.floor(muleMedian.length / 2)] < ordinaryMedian[Math.floor(ordinaryMedian.length / 2)] / 2, 'money moves through a mule far faster than through an ordinary account');
});

test('the payroll cluster fans out exactly like a network', () => {
  const employer = dataset.items.find((entry) => entry.holder.includes('Joinery'));
  assert.ok(employer, 'the decoy employer is in the file');
  assert.ok(employer.recipientsCount >= 10, 'it pays a crowd');
  assert.equal(planted.get(employer.id).role, 'UNRELATED');
  assert.equal(planted.get(employer.id).networkId, null);
});

test('the state shows the neighbourhood and never the cluster', () => {
  const collector = item(ofRole('COLLECTOR')[0].accountId);
  const state = demo.buildState(collector, context);

  assert.ok(state.flow.people_who_paid_it >= 4);
  assert.ok(state.payments_in.length > 0);
  assert.equal(typeof state.flow.median_minutes_between_money_in_and_money_out, 'number');

  const serialised = JSON.stringify(state);
  for (const value of ['COLLECTOR', 'ORIGINATOR', 'networkId', 'N1', 'touched a network']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('every account carries a graph the shared view can draw', () => {
  for (const entry of dataset.items.slice(0, 20)) {
    assert.ok(entry.graph.nodes.length >= 1);
    assert.ok(entry.graph.nodes.some((node) => node.id === entry.graph.focus), 'the focus is one of the nodes');
    assert.equal(entry.graph.focus, entry.id);
    for (const edge of entry.graph.edges) assert.equal(typeof edge.weight, 'number');
  }
});

test('a perfect run recovers all three networks and leaves the payroll alone', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Networks recovered whole').value, '3 of 3');
  assert.equal(kpi(report, 'Roles right').value, '21 of 21');
  assert.equal(kpi(report, 'Ordinary accounts flagged').value, '0 of 99');
  assert.match(kpi(report, 'The payroll cluster').value, /^12 of 12 left alone$/);
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
});

test('calling every fan-out a network catches the payroll and says so', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const busy = entry.recipientsCount >= 6 || entry.sendersCount >= 4;
      return { answers: answerFor({ role: busy ? 'COLLECTOR' : 'UNRELATED', action: busy ? 'FREEZE' : 'NO_ACTION', confidence: busy ? 5 : 1 }) };
    },
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.checks.find((check) => check.id === 'payroll').count > 0, 'the employer is swept up');
  assert.notEqual(kpi(report, 'Networks recovered whole').value, '3 of 3');
  assert.ok(Number(kpi(report, 'Money the bank would hold').value.replace(/[^\d]/g, '')) > 0);
});

test('the confidence bar pulls in fewer accounts and a denser set of them', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 21);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.ok(curve.points.at(-2).rate > curve.points[0].rate);
  assert.equal(matrix.rows.length, 4);
});
