import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/trader-behaviour/demo.js';
import { computeNorms, estimateHabitCost } from '../scripts/generate/trader-behaviour.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('trader-behaviour');
const labels = await loadLabels('trader-behaviour');
const byId = new Map(labels.map((label) => [label.dayId, label]));
const context = demoContext(dataset);
const answer = ({ item }) => {
  const label = byId.get(item.id);
  const problem = label.pattern !== 'DISCIPLINED';
  return { answers: {
    pattern: { type: 'choice', choice: label.pattern, confidence: 0.96, probabilities: { [label.pattern]: 0.96 } },
    severity: { type: 'score', score: problem ? 5 : 0, confidence: 0.9, probabilities: {} },
    triggered_by_loss: { type: 'noul', noul: ['REVENGE', 'AVERAGING_DOWN'].includes(label.pattern) ? 0.95 : 0.05 },
    size_discipline: { type: 'noul', noul: ['REVENGE', 'AVERAGING_DOWN'].includes(label.pattern) ? 0.05 : 0.95 },
    stop_trading_advised: { type: 'noul', noul: problem ? 0.9 : 0.1 },
  } };
};

test('dataset has the exact six-month cohort and eight disciplined large-loss controls', () => {
  assert.equal(dataset.items.length, 120);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(labels, (label) => label.pattern)).map(([pattern, rows]) => [pattern, rows.length])), { DISCIPLINED: 87, REVENGE: 11, OVERTRADING: 9, EARLY_EXIT: 7, AVERAGING_DOWN: 6 });
  assert.equal(labels.filter((label) => label.goodButLossy).length, 8);
  assert.ok(labels.filter((label) => label.goodButLossy).every((label) => label.pattern === 'DISCIPLINED' && dataset.items.find((item) => item.id === label.dayId).resultUsd < 0));
  assert.ok(dataset.items.every((item) => item.trades.length >= 2 && item.trades.length <= 14));
});

test('every item carries norms computed from its preceding thirty completed days', () => {
  for (let index = 30; index < dataset.items.length; index++) {
    const expected = computeNorms(dataset.items.slice(index - 30, index).map((item) => ({ resultUsd: item.resultUsd, trades: item.trades })));
    assert.deepEqual(dataset.items[index].norms, expected);
  }
  assert.ok(dataset.items.every((item) => item.norms.windowTradingDays === 30));
});

test('each planted process is visible in raw trade arithmetic', () => {
  for (const label of labels) {
    const item = dataset.items.find((entry) => entry.id === label.dayId);
    assert.equal(estimateHabitCost(item, label.pattern), label.costEstimate);
    if (label.pattern === 'REVENGE') assert.ok(item.trades.some((trade, index) => item.trades[index - 1]?.resultUsd < 0 && trade.minutesAfterPreviousExit <= 10 && trade.sizeUsd >= item.norms.medianSizeUsd * 1.8));
    if (label.pattern === 'OVERTRADING') assert.ok(item.trades.length >= item.norms.averageTradesPerDay * 2.5);
    if (label.pattern === 'EARLY_EXIT') assert.ok(item.trades.filter((trade) => trade.resultUsd > 0 && trade.holdingMinutes < item.norms.medianWinningHoldMinutes / 2).length >= 3);
    if (label.pattern === 'AVERAGING_DOWN') assert.ok(item.trades.some((trade, index) => item.trades.slice(0, index).some((prior) => prior.symbol === trade.symbol && prior.resultUsd < 0 && trade.sizeUsd > prior.sizeUsd)));
  }
});

test('state contains the entire sequence and norms, but no planted label', () => {
  const label = labels.find((entry) => entry.pattern === 'REVENGE');
  const item = dataset.items.find((entry) => entry.id === label.dayId);
  const state = demo.buildState(item, context);
  assert.equal(state.trades_in_order.length, item.trades.length);
  assert.equal(state.rolling_30_day_norms.completed_days, 30);
  assert.equal(JSON.stringify(state).includes(label.pattern), false);
  assert.ok(state.trades_in_order.every((trade) => trade.entered_at && trade.size_usd && trade.result_usd !== undefined && trade.holding_minutes));
});

test('report grades patterns, derives costs from trades and exposes both required charts', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Pattern accuracy').value, '120 of 120');
  assert.equal(report.kpis.find((entry) => entry.label === 'Good-but-lossy false alarms').value, '0 of 8');
  assert.equal(report.costs.reduce((sum, entry) => sum + entry.count, 0), 33);
  assert.equal(report.equityCurve.points.length, 120);
  assert.ok(report.sizeScatter.points.length >= 120 * 2);
  assert.equal(report.matrix.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0), 120);
});

test('calling every lossy control a problem produces an eight-of-eight false-alarm rate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item }) => {
    const response = answer({ item });
    if (byId.get(item.id).goodButLossy) response.answers.pattern.choice = 'REVENGE';
    return response;
  } });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Good-but-lossy false alarms').value, '8 of 8');
  assert.equal(report.checks.find((entry) => entry.id === 'lossy-controls').count, 8);
});
