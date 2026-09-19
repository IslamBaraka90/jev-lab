import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/aml-alert-triage/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// A queue cut is meaningless without the catch rate beside it, so every test here holds the two
// together. The thirty spikes with an explanation already in the file are the other half of the bar.

const dataset = await loadDataset('aml-alert-triage');
const labels = await loadLabels('aml-alert-triage');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.alertId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ typology, disposition, suspicion, explained = false, missing = 'NONE' }) => ({
  typology: { type: 'choice', choice: typology, confidence: 0.8, probabilities: { [typology]: 0.8 } },
  activity_explained: { type: 'noul', noul: explained ? 0.9 : 0.1 },
  suspicion: { type: 'score', score: suspicion, confidence: 0.7, legend: {}, probabilities: {} },
  disposition: { type: 'choice', choice: disposition, confidence: 0.85, probabilities: { [disposition]: 0.85 } },
  information_missing: { type: 'choice', choice: missing, confidence: 0.6, probabilities: { [missing]: 0.6 } },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    typology: label.typology,
    disposition: label.truePositive ? 'ESCALATE' : 'CLOSE',
    suspicion: label.truePositive ? 5.5 : 0.5,
    explained: !label.truePositive,
    missing: label.truePositive ? 'SOURCE_OF_FUNDS' : 'NONE',
  }) };
};

test('the queue is three hundred alerts with twelve worth working and thirty explained spikes', () => {
  assert.equal(dataset.items.length, 300);
  assert.equal(labels.filter((label) => label.truePositive).length, 12);
  assert.equal(ofKind('explained in the file').length, 30);
  assert.equal(ofKind('everyday').length, 258);
  assert.equal(new Set(labels.filter((label) => label.truePositive).map((label) => label.typology)).size, 4);
  assert.equal(new Set(ofKind('explained in the file').map((label) => label.look)).size, 4);
});

test('the explained spikes look as loud as the real ones', () => {
  const spikes = ofKind('explained in the file').map((label) => item(label.alertId));
  const real = labels.filter((label) => label.truePositive).map((label) => item(label.alertId));
  const overExpected = (entry) => entry.creditTotal90Days > entry.expectedMonthlyTurnover * 3;

  assert.ok(spikes.filter(overExpected).length >= 20, 'most spikes are far above the expected turnover');
  assert.ok(real.filter(overExpected).length >= 4, 'and so are several of the planted ones');
  assert.ok(spikes.every((entry) => entry.relationshipNote.length > 40), 'every spike carries its explanation');
});

test('the state carries the file and the ninety days, and never the answer', () => {
  const structuring = item(labels.find((label) => label.typology === 'STRUCTURING').alertId);
  const state = demo.buildState(structuring, context);

  assert.equal(state.bank.cash_reporting_threshold, 3_000);
  assert.ok(state.alert.triggering_payments.length >= 8);
  assert.ok(state.alert.triggering_payments.every((payment) => payment.amount < 3_000));
  assert.equal(state.last_ninety_days.share_in_cash_percent, structuring.cashSharePercent);

  const serialised = JSON.stringify(state);
  for (const value of ['STRUCTURING', 'truePositive', 'worth an analyst', 'explained in the file']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('the demo never says more than close, monitor or escalate', () => {
  const words = JSON.stringify(demo.questions).toLowerCase();
  assert.equal(/suspicious activity report|\bsar\b|file a report/.test(words), false);
  assert.match(context.wording, /nothing here is a suspicious activity report/);
  assert.match(context.note, /Illustrative synthetic data/);
});

test('a perfect run cuts the queue to the twelve and says so with the catch rate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Queue after triage').value, '12 of 300');
  assert.match(kpi(report, 'Queue after triage').context, /96% cut, keeping 12 of the 12/);
  assert.equal(kpi(report, 'Worth working, kept').value, '12 of 12');
  assert.equal(kpi(report, 'Explained spikes closed').value, '30 of 30');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
  assert.ok(report.note.includes('Illustrative synthetic data'), 'the caveat travels with the report');
});

test('keeping everything is not a triage, and the report says that in the same breath', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ typology: 'LAYERING', disposition: 'ESCALATE', suspicion: 4 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Queue after triage').value, '300 of 300');
  assert.match(kpi(report, 'Queue after triage').context, /0% cut/);
  assert.equal(report.checks.find((check) => check.id === 'explained').count, 30);
  assert.equal(report.checks.find((check) => check.id === 'everyday').count, 258);
});

test('closing everything loses all twelve, and the finding names them', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ typology: 'NONE', disposition: 'CLOSE', suspicion: 0.4, explained: true }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Worth working, kept').value, '0 of 12');
  assert.ok(report.findings.some((line) => /were closed/.test(line)));
  assert.equal(report.curve.points[0].reviewed, 300, 'everything is above a suspicion of zero');
});

test('the suspicion bar trades queue size against what is left in it', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 12);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points.at(-1).caught, 0, 'nothing is scored a certain six');
  assert.equal(matrix.rows.length, 6);
});
