import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/trade-feature-analysis/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('trade-feature-analysis');
const labels = await loadLabels('trade-feature-analysis');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.tradeId, label]));
const rate = (rows) => rows.filter((entry) => planted.get(entry.id).outcome === 'WIN').length / rows.length;
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);
const answer = ({ item }) => { const label = planted.get(item.id); const good = label.topThirdClose && !label.extendedEntry; return { answers: { setup_type: { type: 'choice', choice: item.setupType, confidence: 0.9, probabilities: { [item.setupType]: 0.9 } }, entry_quality: { type: 'score', score: good ? 5 : label.extendedEntry ? 2 : 4, confidence: 0.8, probabilities: {} }, context: { type: 'choice', choice: item.contextEvidence, confidence: 0.8, probabilities: { [item.contextEvidence]: 0.8 } }, extended_entry: { type: 'noul', noul: label.extendedEntry ? 0.9 : 0.1 }, would_take_again: { type: 'noul', noul: good ? 0.9 : 0.1 } } }; };

test('dataset contains 300 trades across all four setup families and twelve symbols', () => {
  assert.equal(dataset.items.length, 300);
  assert.equal(new Set(dataset.items.map((item) => item.symbol)).size, 12);
  assert.deepEqual(new Set(dataset.items.map((item) => item.setupType)), new Set(['BREAKOUT', 'PULLBACK', 'REVERSAL', 'RANGE_FADE']));
});

test('the two planted entry features separate outcomes better than chance', () => {
  const extended = dataset.items.filter((item) => planted.get(item.id).extendedEntry);
  const notExtended = dataset.items.filter((item) => !planted.get(item.id).extendedEntry);
  const top = dataset.items.filter((item) => planted.get(item.id).topThirdClose);
  const rest = dataset.items.filter((item) => !planted.get(item.id).topThirdClose);
  assert.ok(rate(notExtended) - rate(extended) > 0.25);
  assert.ok(rate(top) - rate(rest) > 0.2);
});

test('weekday, round-number price and symbol remain controls', () => {
  const groupedGap = (read) => { const groups = Map.groupBy(dataset.items, read); const rates = [...groups.values()].filter((group) => group.length >= 3).map(rate); return Math.max(...rates) - Math.min(...rates); };
  const round = dataset.items.filter((item) => item.roundNumber);
  const notRound = dataset.items.filter((item) => !item.roundNumber);
  assert.ok(groupedGap((item) => item.dayOfWeek) < 0.12);
  assert.ok(groupedGap((item) => item.symbol) < 0.16);
  assert.ok(Math.abs(rate(round) - rate(notRound)) < 0.16);
});

test('state stops at entry and never carries outcome or planted labels', () => {
  const state = demo.buildState(dataset.items[0], context);
  assert.equal(state.candles_through_entry_only.length, 35);
  assert.equal(JSON.stringify(state).includes('outcome'), true, 'task may say outcome is withheld');
  assert.equal(JSON.stringify(state).includes('WIN'), false);
  assert.equal(JSON.stringify(state).includes('LOSS'), false);
  assert.equal(JSON.stringify(state).includes('plantedEdgeFeature'), false);
});

test('report states whether would-take-again beats the actual base rate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, { ...context, labels });
  assert.match(kpi(report, 'Would-take-again win rate').context, /percentage points versus base/);
  assert.equal(report.analysisRows.length, 3);
  assert.equal(report.checks.length, 5);
  assert.match(report.checks[0].label, /Reveal/);
});

test('outcomes are revealed only through the report labels', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  assert.ok(results.every((result) => !JSON.stringify(result.state).includes(planted.get(result.item.id).outcome)));
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.matrix.rows.length, 4);
  assert.equal(report.matrix.rows.reduce((sum, row) => sum + row.cells.reduce((cellSum, cell) => cellSum + cell.count, 0), 0), 300);
});
