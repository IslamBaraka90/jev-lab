import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import demo from '../demos/insider-surveillance/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('insider-surveillance');
const labels = await loadLabels('insider-surveillance');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.tradeId, label]));

function answersFor(label) {
  return {
    suspicion: { type: 'score', score: label.suspicious ? 5.5 : 1, confidence: 0.9, probabilities: {} },
    pattern: { type: 'choice', choice: label.pattern, confidence: 0.9, probabilities: { [label.pattern]: 0.9 } },
    blackout_breach: { type: 'noul', noul: label.blackoutBreach ? 0.95 : 0.05 },
    disposition: { type: 'choice', choice: label.expectedDisposition, confidence: 0.9, probabilities: { [label.expectedDisposition]: 0.9 } },
    explained_by_history: { type: 'noul', noul: label.explainedByHistory ? 0.95 : 0.05 },
  };
}

test('dataset has 180 trades, 40 fictional employees, 9 suspicious cases and 15 lookalikes', () => {
  assert.equal(dataset.items.length, 180);
  assert.equal(new Set(dataset.items.map((item) => item.employee.id)).size, 40);
  assert.ok(dataset.items.every((item) => item.employee.fictional && item.eventCalendar.every((event) => event.fictional)));
  assert.equal(labels.filter((label) => label.suspicious).length, 9);
  assert.equal(labels.filter((label) => label.lookalike === 'SCHEDULED_PURCHASE').length, 8);
  assert.equal(labels.filter((label) => label.lookalike === 'SECTOR_WIDE_MOVE').length, 7);
});

test('first-time trade is three market sessions before a genuine cached gap-up', async () => {
  const label = labels.find((entry) => entry.pattern === 'FIRST_TIME_INSTRUMENT');
  const item = dataset.items.find((entry) => entry.id === label.tradeId);
  const cached = JSON.parse(await readFile(`data/market/candles/${item.trade.symbol}.json`, 'utf8'));
  const tradeIndex = cached.bars.findIndex((bar) => bar.date === label.tradeDate);
  const eventIndex = cached.bars.findIndex((bar) => bar.date === label.eventDate);
  assert.equal(eventIndex - tradeIndex, 3);
  assert.ok(cached.bars[eventIndex].open / cached.bars[eventIndex - 1].close - 1 > 0.05);
  assert.ok(item.employeeHistory.every((trade) => trade.symbol !== item.trade.symbol));
});

test('the colleague cluster is four fictional employees in one symbol and one trading week', () => {
  const clusterLabels = labels.filter((label) => label.pattern === 'CLUSTERED_WITH_COLLEAGUES');
  const clusterItems = clusterLabels.map((label) => dataset.items.find((item) => item.id === label.tradeId));
  assert.equal(clusterItems.length, 4);
  assert.equal(new Set(clusterItems.map((item) => item.employee.id)).size, 4);
  assert.equal(new Set(clusterItems.map((item) => item.trade.symbol)).size, 1);
  assert.ok(clusterItems.every((item) => item.recentColleagueTrades.length === 3));
});

test('state sends every pre-trade bar and never includes a post-trade bar', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.equal(state.market_through_trade_date.candles.length, 60);
    assert.deepEqual(state.market_through_trade_date.candles, item.market.preTradeBars);
    assert.equal(state.market_through_trade_date.candles.at(-1).date, item.trade.tradeDate);
    assert.ok(state.market_through_trade_date.candles.every((bar) => bar.date <= item.trade.tradeDate));
    assert.ok(!state.market_through_trade_date.candles.some((bar) => item.market.outcomeBars.some((future) => future.date === bar.date)));
    assert.equal(state.outcomeBars, undefined);
  }
});

test('blackout labels follow visible access, event materiality, timing and the plan exemption', () => {
  for (const item of dataset.items) {
    const label = byId.get(item.id);
    const event = item.eventCalendar[0];
    const days = (Date.parse(`${event.date}T00:00:00Z`) - Date.parse(`${item.trade.tradeDate}T00:00:00Z`)) / 86_400_000;
    const derived = item.employee.materialAccessSymbols.includes(item.trade.symbol)
      && event.materialToIssuer
      && days >= 0 && days <= 14
      && !item.trade.preClearedPlan;
    assert.equal(label.blackoutBreach, derived, item.id);
  }
});

test('cached bars are copied exactly and outcome returns are derived from them', async () => {
  const item = dataset.items[0];
  const label = byId.get(item.id);
  const cached = JSON.parse(await readFile(`data/market/candles/${item.trade.symbol}.json`, 'utf8'));
  const start = cached.bars.findIndex((bar) => bar.date === item.market.preTradeBars[0].date);
  assert.deepEqual(item.market.preTradeBars, cached.bars.slice(start, start + 60));
  const expected = Number((((item.market.outcomeBars.at(-1).close / item.market.preTradeBars.at(-1).close) - 1) * 100).toFixed(2));
  assert.equal(label.outcomeReturnPercent, expected);
});

test('a perfect run opens all nine planted cases and clears both lookalike cohorts', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item }) => ({ answers: answersFor(byId.get(item.id)) }) });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Suspicious trades opened').value, '9 of 9');
  assert.equal(report.kpis.find((entry) => entry.label === 'Opened-case precision').value, '100%');
  assert.ok(report.checks.every((check) => check.count === 0));
  for (const row of report.matrix.rows) for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
});
