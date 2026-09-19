import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/execution-quality/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The cost of each fill is arithmetic the demo does itself, so the state never carries it. What the
// tests protect is that each cause is visible in the record and that the clean fills really are clean.

const dataset = await loadDataset('execution-quality');
const labels = await loadLabels('execution-quality');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.fillId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const withCause = (cause) => labels.filter((label) => label.cause === cause).map((label) => item(label.fillId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ quality, cause, fix, avoidable = true, worth = true }) => ({
  fill_quality: { type: 'score', score: quality, confidence: 0.75, legend: {}, probabilities: {} },
  cause: { type: 'choice', choice: cause, confidence: 0.85, probabilities: { [cause]: 0.85 } },
  avoidable: { type: 'noul', noul: avoidable ? 0.9 : 0.1 },
  fix: { type: 'choice', choice: fix, confidence: 0.8, probabilities: { [fix]: 0.8 } },
  worth_chasing: { type: 'noul', noul: worth ? 0.9 : 0.1 },
});

const RIGHT_FIX = { GAP: 'LIMIT_ORDER', CHASE: 'EARLIER_ORDER', SIZE: 'SMALLER_SIZE', SPREAD: 'AVOID_SESSION', CLEAN: 'NONE' };
const perfect = ({ item: entry }) => {
  const cause = planted.get(entry.id).cause;
  return { answers: answerFor({ quality: cause === 'CLEAN' ? 5.5 : 1.5, cause, fix: RIGHT_FIX[cause] }) };
};

test('two hundred and sixty fills with four causes and a clean majority', () => {
  assert.equal(dataset.items.length, 260);
  assert.equal(withCause('GAP').length, 40);
  assert.equal(withCause('CHASE').length, 35);
  assert.equal(withCause('SPREAD').length, 30);
  assert.equal(withCause('SIZE').length, 25);
  assert.equal(withCause('CLEAN').length, 130);
});

test('each cause is visible in the order record', () => {
  assert.ok(withCause('CHASE').every((entry) => entry.barsBetweenSignalAndFill >= 2));
  assert.ok(withCause('GAP').every((entry) => entry.orderType === 'MARKET_ON_OPEN'));
  assert.ok(withCause('SPREAD').every((entry) => entry.session === 'open' || entry.session === 'close'));
  assert.ok(withCause('SIZE').every((entry) => entry.sizeUsd >= 3_000_000));
  assert.ok(withCause('CLEAN').every((entry) => entry.barsBetweenSignalAndFill === 0 && entry.sizeUsd < 3_000_000));
});

test('the planted costs separate cleanly from the clean fills', () => {
  const cost = (cause) => labels.filter((label) => label.cause === cause).map((label) => label.costBps);
  assert.ok(Math.max(...cost('CLEAN')) < Math.min(...cost('SPREAD')));
  assert.ok(Math.min(...cost('GAP')) > 20);
});

test('the state gives the bars and the size, and never the cost', () => {
  const state = demo.buildState(item(withCause('SIZE')[0].id), context);
  assert.ok(state.daily_bars.length === 20);
  assert.ok(state.order.this_order_as_share_of_average_daily_volume_percent > 0);
  const serialised = JSON.stringify(state);
  for (const value of ['costBps', 'cost_bps', '"cause"', 'CLEAN']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('the demo works out the cost itself, from the two prices', () => {
  const entry = item(withCause('GAP')[0].id);
  const evaluation = demo.evaluate(answerFor({ quality: 1, cause: 'GAP', fix: 'LIMIT_ORDER' }), entry);
  assert.equal(evaluation.costBps, planted.get(entry.id).costBps);
  assert.ok(evaluation.costUsd > 0);
});

test('a perfect run names every cause and the fix that follows from it', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Cause named exactly').value, '260 of 260');
  assert.equal(kpi(report, 'Clean fills called clean').value, '130 of 130');
  assert.equal(kpi(report, 'The fix that matches the cause').value, '130 of 130');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
});

test('a fix that does not follow from the cause is called out', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ quality: 2, cause: planted.get(entry.id).cause, fix: 'SMALLER_SIZE' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /the only part anybody acts on/.test(line)));
  assert.notEqual(kpi(report, 'The fix that matches the cause').value, '130 of 130');
});

test('a grade that ignores the money is caught', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ quality: 1, cause: 'SPREAD', fix: 'AVOID_SESSION' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /The grade is not tracking the money/.test(line)));
  assert.equal(report.checks.find((check) => check.id === 'clean').count, 130);
});
