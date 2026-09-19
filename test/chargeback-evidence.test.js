import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/chargeback-evidence/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('chargeback-evidence');
const labels = await loadLabels('chargeback-evidence');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.packetId, label]));
const ofKind = (kind) => labels.filter((label) => label.kind === kind);

function answersFor(label, overrides = {}) {
  const outcome = overrides.outcome ?? label.outcome;
  const missingDocument = overrides.missingDocument ?? label.missingDocument;
  const nextStep = overrides.nextStep ?? label.nextStep;
  return {
    win_likelihood: { type: 'score', score: overrides.score ?? (outcome === 'WIN' ? 5 : label.kind === 'hopeless' ? 0.5 : 2), confidence: 0.9, probabilities: {}, legend: {} },
    missing_document: { type: 'choice', choice: missingDocument, confidence: 0.9, probabilities: { [missingDocument]: 0.9 } },
    next_step: { type: 'choice', choice: nextStep, confidence: 0.9, probabilities: { [nextStep]: 0.9 } },
    deadline_risk: { type: 'noul', noul: overrides.deadlineRisk ?? (label.deadlineRisk ? 0.95 : 0.05) },
  };
}

const perfect = ({ item }) => ({ answers: answersFor(byId.get(item.id)) });

test('dataset has the exact planted packet cohorts and five reason codes', () => {
  assert.equal(dataset.items.length, 120);
  assert.equal(labels.length, 120);
  assert.equal(ofKind('strong').length, 22);
  assert.equal(ofKind('one-document-away').length, 31);
  assert.equal(ofKind('hopeless').length, 19);
  assert.equal(ofKind('mixed').length, 48);
  assert.deepEqual(new Set(dataset.items.map((item) => item.dispute.reasonCode)), new Set(['FRAUD', 'PRODUCT_NOT_RECEIVED', 'PRODUCT_UNACCEPTABLE', 'SUBSCRIPTION_CANCELLED', 'DUPLICATE']));
});

test('every one-document-away packet has exactly one absent document and can still gather it', () => {
  for (const label of ofKind('one-document-away')) {
    const item = dataset.items.find((entry) => entry.id === label.packetId);
    assert.equal(Object.values(item.evidence).filter((document) => !document.present).length, 1);
    assert.equal(item.evidence[label.missingDocument].present, false);
    assert.equal(label.nextStep, 'GATHER_MORE');
    assert.equal(label.flipsWithDocument, true);
    assert.ok(Date.parse(item.dispute.responseDeadline) - Date.parse(dataset.context.asOf) >= 3 * 86_400_000);
  }
});

test('state includes the raw packet, illustrative rule and enough dates to derive deadline risk', () => {
  const item = dataset.items[0];
  const state = demo.buildState(item, context);
  assert.equal(state.reason_code, item.dispute.reasonCode);
  assert.match(state.policy_notice, /illustrative/i);
  assert.equal(state.review_clock.as_of, dataset.context.asOf);
  assert.equal(state.review_clock.response_deadline, item.dispute.responseDeadline);
  assert.equal(state.review_clock.typical_document_collection_days, 3);
  assert.ok(state.reason_requirements.decisive.length);
  assert.equal(state.outcome, undefined);
  assert.equal(state.missingDocument, undefined);
});

test('a perfect run separates outcome, document and next-step grading', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Outcome accuracy').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Missing-document accuracy').value, '100%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Next-step accuracy').value, '100%');
  assert.ok(report.money.gatherMore > 0);
  assert.equal(report.flips.length, 31);
  assert.ok(report.flips.every((entry) => entry.gathered));
});

test('wrong document names do not reduce a correct outcome score', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(byId.get(item.id), { missingDocument: 'NONE' }) }) });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Outcome accuracy').value, '100%');
  assert.notEqual(report.kpis.find((kpi) => kpi.label === 'Missing-document accuracy').value, '100%');
});

test('reliability curve bins every packet once and reports observed wins', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });
  assert.equal(curve.points.reduce((sum, point) => sum + point.reviewed, 0), 120);
  assert.equal(curve.points.reduce((sum, point) => sum + point.caught, 0), labels.filter((label) => label.outcome === 'WIN').length);
});

test('deadline risk is derived consistently from the visible dates', () => {
  for (const label of labels) {
    const item = dataset.items.find((entry) => entry.id === label.packetId);
    const remaining = (Date.parse(item.dispute.responseDeadline) - Date.parse(dataset.context.asOf)) / 86_400_000;
    assert.equal(label.deadlineRisk, remaining < dataset.context.documentCollectionDays);
  }
});

