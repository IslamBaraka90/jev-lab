import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/account-takeover/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('account-takeover');
const labels = await loadLabels('account-takeover');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.sessionId, label]));
const ofShape = (shape) => labels.filter((label) => label.shape === shape);

function answersFor(label, overrides = {}) {
  const signal = overrides.signal ?? label.strongestSignal;
  const action = overrides.action ?? label.action;
  const method = overrides.method ?? label.stepUpMethod;
  return {
    takeover_likelihood: { type: 'score', score: overrides.score ?? (label.takeover ? 5.5 : label.kind === 'innocent-lookalike' ? 2.5 : 0.5), confidence: 0.9, probabilities: {}, legend: {} },
    strongest_signal: { type: 'choice', choice: signal, confidence: 0.9, probabilities: { [signal]: 0.9 } },
    action: { type: 'choice', choice: action, confidence: 0.9, probabilities: { [action]: 0.9 } },
    step_up_method: { type: 'choice', choice: method, confidence: 0.9, probabilities: { [method]: 0.9 } },
    customer_friction_justified: { type: 'noul', noul: overrides.frictionJustified ?? (label.frictionJustified ? 0.95 : 0.05) },
  };
}

const perfect = ({ item }) => ({ answers: answersFor(byId.get(item.id)) });

test('dataset contains 260 sessions, 14 takeovers and 20 balanced innocent lookalikes', () => {
  assert.equal(dataset.items.length, 260);
  assert.equal(labels.length, 260);
  assert.equal(labels.filter((label) => label.takeover).length, 14);
  assert.equal(labels.filter((label) => label.kind === 'innocent-lookalike').length, 20);
  assert.equal(ofShape('CREDENTIAL_STUFFING').length, 4);
  assert.equal(ofShape('SIM_SWAP').length, 4);
  assert.equal(ofShape('SESSION_HIJACK').length, 3);
  assert.equal(ofShape('INSIDER_FAMILIAR_DEVICE').length, 3);
  for (const shape of ['TRAVEL', 'NEW_PHONE', 'EMERGENCY_TRANSFER', 'SHARED_FAMILY_DEVICE']) assert.equal(ofShape(shape).length, 5);
  assert.equal(ofShape('NORMAL').length, 226);
});

test('impossible travel is derivable from raw timestamps and locations, never precomputed', () => {
  for (const label of [...ofShape('TRAVEL'), ...ofShape('SESSION_HIJACK')]) {
    const item = dataset.items.find((entry) => entry.id === label.sessionId);
    const serialised = JSON.stringify(item).toLowerCase();
    assert.ok(!serialised.includes('impossible'));
    if (label.shape === 'TRAVEL') {
      const prior = item.account.recentLogins[0];
      assert.notEqual(prior.country, item.session.network.country);
      assert.ok(Date.parse(item.session.startedAt) - Date.parse(prior.at) <= 90 * 60_000);
      assert.equal(item.account.customerContext.travelNotice.country, item.session.network.country);
    } else {
      const change = item.timeline.find((event) => event.type === 'SESSION_CONTEXT_CHANGE');
      assert.notEqual(change.fromCountry, change.toCountry);
      assert.ok(Date.parse(change.at) - Date.parse(item.timeline[0].at) <= 10 * 60_000);
    }
  }
});

test('state sends the complete item, event policy and friction weights without labels', () => {
  const item = dataset.items[0];
  const state = demo.buildState(item, context);
  assert.deepEqual(state.session_case, item);
  assert.equal(state.action_risk_weights.TRANSFER, 6);
  assert.equal(state.friction_points.find((entry) => entry.intervention === 'push approval').points, 1);
  assert.equal(state.takeover, undefined);
  assert.equal(state.shape, undefined);
});

test('a perfect run catches every takeover and measures justified lookalike friction', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Takeovers caught').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Action accuracy').value, '100%');
  assert.equal(report.friction.challengedLegitimate, 15);
  assert.equal(report.friction.points, 25);
  assert.equal(report.decoys.length, 20);
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0]);
});

test('every catch display includes friction and the threshold curve carries friction points', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  const catchKpi = report.kpis.find((kpi) => kpi.label === 'Takeovers caught');
  assert.match(catchKpi.context, /friction points/);
  assert.match(report.curve.title, /friction/i);
  assert.match(report.curve.xLabel, /friction/i);
  assert.ok(report.curve.points.every((point) => Number.isFinite(point.frictionCost)));
  for (let index = 1; index < report.curve.points.length; index++) assert.ok(report.curve.points[index].frictionCost <= report.curve.points[index - 1].frictionCost);
});

test('a blanket block catches attacks but exposes large legitimate friction', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(byId.get(item.id), { action: 'BLOCK_SESSION', method: 'NOT_NEEDED', frictionJustified: 0.95 }) }) });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Takeovers caught').value, '100%');
  assert.equal(report.friction.challengedLegitimate, 246);
  assert.equal(report.friction.points, 1968);
});

test('the signal matrix is diagonal for a perfect run', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });
  for (const row of matrix.rows) for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
});

