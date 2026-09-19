import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/income-planning/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('income-planning');
const labels = await loadLabels('income-planning');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.accountId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const cohort = (issue) => labels.filter((label) => label.issue === issue).map((label) => item(label.accountId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);
const scoreFor = { SHORTFALL: 2, TIMING: 3, CASH_DRAG: 5, NONE: 4.5 };
const answerFor = (label) => ({ coverage: { type: 'score', score: scoreFor[label.issue], confidence: 0.8, probabilities: {} }, problem: { type: 'choice', choice: label.issue, confidence: 0.9, probabilities: { [label.issue]: 0.9 } }, worst_month: { type: 'choice', choice: label.worstMonth, confidence: 0.9, probabilities: { [label.worstMonth]: 0.9 } }, sell_needed: { type: 'noul', noul: label.sellNeeded ? 0.9 : 0.1 } });
const perfect = ({ item: entry }) => ({ answers: answerFor(planted.get(entry.id)) });

test('dataset plants the exact four account cohorts', () => {
  assert.equal(dataset.items.length, 40);
  assert.equal(cohort('SHORTFALL').length, 9);
  assert.equal(cohort('TIMING').length, 6);
  assert.equal(cohort('CASH_DRAG').length, 5);
  assert.equal(cohort('NONE').length, 20);
});

test('timing is annual coverage that arrives after the worst month, while shortfall is insufficient', () => {
  assert.ok(cohort('TIMING').every((entry) => entry.annualIncome >= entry.annualCommitments && entry.minimumProjectedCash < 0));
  assert.ok(cohort('SHORTFALL').every((entry) => entry.annualIncome + entry.startingCash < entry.annualCommitments && entry.minimumProjectedCash < 0));
  assert.ok(cohort('CASH_DRAG').every((entry) => entry.cashMonthsAtStart > 6 && entry.annualIncome >= entry.annualCommitments && entry.minimumProjectedCash > 0));
  assert.ok(cohort('NONE').every((entry) => entry.minimumProjectedCash >= 0 && entry.cashMonthsAtStart <= 6));
});

test('worst-month labels are the exact largest monthly gaps', () => {
  for (const label of labels.filter((entry) => ['SHORTFALL', 'TIMING'].includes(entry.issue))) {
    const account = item(label.accountId);
    const worst = [...account.calendar].sort((left, right) => left.gap - right.gap)[0];
    assert.equal(label.worstMonth, worst.month);
  }
  assert.ok(labels.filter((entry) => ['CASH_DRAG', 'NONE'].includes(entry.issue)).every((entry) => entry.worstMonth === 'NONE'));
});

test('state sends both series, reliability and rules without labels', () => {
  const state = demo.buildState(dataset.items[0], context);
  assert.equal(state.twelve_month_calendar.length, 12);
  assert.ok(state.holdings_and_payment_reliability.every((holding) => holding.reliability && holding.schedule.length));
  assert.equal(state.account.cash_months_at_start, dataset.items[0].cashMonthsAtStart);
  assert.equal(state.account.minimum_projected_cash_usd, dataset.items[0].minimumProjectedCash);
  assert.match(state.policy.sale_rule, /Selling is allowed/);
  assert.equal(JSON.stringify(state).includes('worstMonth'), false);
});

test('perfect answers keep problem, timing and worst-month grading separate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(kpi(report, 'Coverage accuracy').value, '40 of 40');
  assert.equal(kpi(report, 'Problem named exactly').value, '40 of 40');
  assert.equal(kpi(report, 'Worst-month accuracy').value, '40 of 40');
  assert.equal(kpi(report, 'Cash drag identified').value, '5 of 5');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0]);
  assert.equal(report.topItems.length, 15);
});

test('calling timing a shortfall is reported as the wrong kind of gap', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item: entry }) => {
    const label = planted.get(entry.id);
    return { answers: label.issue === 'TIMING' ? { ...answerFor(label), problem: { type: 'choice', choice: 'SHORTFALL', confidence: 0.9, probabilities: { SHORTFALL: 0.9 } } } : answerFor(label) };
  } });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.checks.find((check) => check.id === 'timing').count, 6);
  assert.ok(report.findings.some((line) => /enough annual income/.test(line)));
});
