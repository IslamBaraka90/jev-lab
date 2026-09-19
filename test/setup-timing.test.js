import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/setup-timing/demo.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('setup-timing');
const context = demoContext(dataset);
const answer = ({ item }) => ({ answers: { timing_favourable: { type: 'noul', noul: item.typicalPastSlotReturnPercent * (item.direction === 'LONG' ? 1 : -1) > 0 ? 0.8 : 0.2 }, best_slot: { type: 'choice', choice: item.calendar.weekday === 'MONDAY' ? 'MONDAY' : item.calendar.weekday === 'FRIDAY' ? 'FRIDAY' : item.calendar.monthPhase === 'START' ? 'MONTH_START' : item.calendar.monthPhase === 'END' ? 'MONTH_END' : 'MIDWEEK', confidence: 0.7, probabilities: {} }, direction_bias: { type: 'choice', choice: item.direction, confidence: 0.8, probabilities: {} }, expected_hold: { type: 'choice', choice: 'FOUR_TO_FIVE', confidence: 0.7, probabilities: {} }, setup_quality: { type: 'score', score: 3.5, confidence: 0.7, probabilities: {} } } });

test('480 real setup instances cover every instrument, setup and direction', () => {
  assert.equal(dataset.items.length, 480);
  assert.deepEqual([...new Set(dataset.items.map((item) => item.symbol))].sort(), ['BTC-USD', 'JPM', 'NVDA', 'SPY']);
  assert.deepEqual([...new Set(dataset.items.map((item) => item.setup))].sort(), ['PULLBACK', 'RANGE_BREAK']);
  assert.deepEqual([...new Set(dataset.items.map((item) => item.direction))].sort(), ['LONG', 'SHORT']);
});

test('state ends at setup and excludes all forward outcomes', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.equal(state.candles_oldest_to_setup_bar.at(-1).date, item.setupDate);
    const sent = JSON.stringify(state);
    for (const key of ['outcome', 'signedReturnsPercent', 'bestHold', 'realisedFiveBarReturnPercent']) assert.equal(sent.includes(key), false);
  }
});

test('Bitcoin includes weekend instances while exchange-traded instruments do not', () => {
  const weekend = new Set(['SATURDAY', 'SUNDAY']);
  assert.ok(dataset.items.some((item) => item.symbol === 'BTC-USD' && weekend.has(item.calendar.weekday)));
  assert.ok(dataset.items.filter((item) => item.symbol !== 'BTC-USD').every((item) => !weekend.has(item.calendar.weekday)));
});

test('report separates long and short and marks every small cell insufficient', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.deepEqual(report.timingGrid.directionRows.map((row) => row.direction), ['LONG', 'SHORT']);
  assert.ok(report.timingGrid.cells.filter((cell) => cell.count < 20).every((cell) => !cell.sufficient));
  assert.match(report.note, /No intraday/i);
});

test('forward return is revealed only by the report', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.kpis.find((entry) => entry.label === 'Real setup instances').value, '480');
  assert.ok(report.topItems.every((entry) => entry.value.endsWith('%')));
});
