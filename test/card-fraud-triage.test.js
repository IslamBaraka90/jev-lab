import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/card-fraud-triage/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The claim this demo makes is a comparison, so the tests protect the comparison: the rule ordering is
// fixed in the data, the model never sees it, and the report counts fraud in the same fifty alerts.

const dataset = await loadDataset('card-fraud-triage');
const labels = await loadLabels('card-fraud-triage');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.alertId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);
const rank = (label) => item(label.alertId).ruleRank;

const answerFor = ({ likelihood, type, action, explained = false, contact = false }) => ({
  fraud_likelihood: { type: 'score', score: likelihood, confidence: 0.75, legend: {}, probabilities: {} },
  fraud_type: { type: 'choice', choice: type, confidence: 0.8, probabilities: { [type]: 0.8 } },
  action: { type: 'choice', choice: action, confidence: 0.85, probabilities: { [action]: 0.85 } },
  explains_itself: { type: 'noul', noul: explained ? 0.9 : 0.1 },
  contact_customer: { type: 'noul', noul: contact ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    likelihood: label.fraud ? 6 : 0.5,
    type: label.type,
    action: label.fraud ? 'BLOCK' : 'CLOSE_ALERT',
    explained: !label.fraud,
  }) };
};

test('the queue is four hundred alerts with sixteen frauds and twenty-five loud false alarms', () => {
  assert.equal(dataset.items.length, 400);
  assert.equal(labels.filter((label) => label.fraud).length, 16);
  assert.equal(labels.filter((label) => label.kind === 'loud false alarm').length, 25);
  assert.equal(labels.filter((label) => label.kind === 'ordinary').length, 359);
  assert.equal(new Set(labels.filter((label) => label.fraud).map((label) => label.type)).size, 5);
});

test('the rules engine ordering is stored, and it buries half the fraud', () => {
  const ranks = dataset.items.map((entry) => entry.ruleRank);
  assert.deepEqual(ranks, [...ranks].sort((left, right) => left - right), 'the file is in rule order');
  assert.equal(new Set(ranks).size, 400);
  for (let index = 1; index < dataset.items.length; index++) {
    assert.ok(dataset.items[index].ruleScore <= dataset.items[index - 1].ruleScore, 'highest rule score first');
  }

  const fraud = labels.filter((label) => label.fraud);
  const reachable = fraud.filter((label) => rank(label) <= 50);
  assert.ok(reachable.length >= 4 && reachable.length <= 8, `${reachable.length} frauds in the first fifty`);
  assert.ok(fraud.filter((label) => label.quiet).every((label) => rank(label) > 150), 'the quiet ones are out of reach');
});

test('the state gives the rule and what it is worth, and never the score or the rank', () => {
  const entry = item(labels.find((label) => label.fraud && label.quiet).alertId);
  const state = demo.buildState(entry, context);

  assert.match(state.alert.this_rule_is_right_about, /% of the alerts it raises/);
  assert.equal(state.last_ten_authorisations.length, 10);
  assert.match(state.last_ten_authorisations[0], /^\d\d-\d\d · \d/);
  assert.equal(state.cardholder.average_monthly_spend, entry.averageMonthlySpend);

  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('ruleScore'), false);
  assert.equal(serialised.includes('ruleRank'), false);
  assert.equal(serialised.includes(`"${entry.ruleScore}"`), false);
  for (const value of ['STOLEN_CARD', 'CARD_TESTING', 'loud false alarm', 'holiday abroad']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('reading every alert puts every fraud in the hour the analyst has', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  const inRuleHour = Number(kpi(report, 'Fraud in the first 50, rule order').value.split(' ')[0]);

  assert.equal(kpi(report, 'Fraud in the first 50, model order').value, '16 of 16');
  assert.ok(inRuleHour < 16, 'the rule queue does not');
  assert.ok(Number(kpi(report, 'Alerts to the same catch').value) <= inRuleHour, 'the same catch comes far sooner');
  assert.equal(kpi(report, 'Loud false alarms let go').value, '25 of 25');
  assert.equal(kpi(report, 'Cards blocked without fraud').value, 0);
  assert.ok(report.findings.some((line) => /moved into the first 50/.test(line)), 'the report names the alerts that moved up');
});

test('acting on everything loud finds the fraud and buries the analyst', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ likelihood: entry.ruleScore > 70 ? 5 : 1, type: 'STOLEN_CARD', action: entry.ruleScore > 70 ? 'BLOCK' : 'CLOSE_ALERT' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.checks.find((check) => check.id === 'decoys').count > 10, 'the loud false alarms are exactly what a loud rule catches');
  assert.ok(Number(kpi(report, 'Cards blocked without fraud').value) > 50, 'and a great many good cards go with them');
  assert.ok(report.checks.find((check) => check.id === 'quiet').count > 0, 'while the quiet fraud is still sitting there');
});

test('the curve walks the model ordering and counts what has been found', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 16);
  assert.equal(curve.points.at(-1).reviewed, 400);
  assert.equal(curve.points.at(-1).caught, 16);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].caught >= curve.points[index - 1].caught, 'opening more alerts never finds less');
    assert.ok(curve.points[index].reviewed > curve.points[index - 1].reviewed);
  }
  assert.ok(curve.points[0].rate > curve.points.at(-1).rate, 'the top of the ordering is denser than the bottom');
});

test('the matrix covers every fraud type, and the top of the list shows where each alert came from', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.matrix.rows.length, 6);
  for (const row of report.matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
  assert.equal(report.topItems.length, 10);
  assert.ok(report.topItems.every((entry) => /was #\d+ in the rule queue/.test(entry.label)));
});
