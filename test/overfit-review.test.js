import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/overfit-review/demo.js';
import labels from '../data/synthetic/overfit-review.labels.json' with { type: 'json' };
import { generate } from '../scripts/generate/overfit-review.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('overfit-review');
const context = { ...demoContext(dataset), labels };
const answer = ({ item }) => { const kind = labels.find((label) => label.backtestId === item.id).kind; const flawed = kind !== 'NONE'; return { answers: { overfit_risk: { type: 'score', score: flawed ? 5 : 1, confidence: 0.9, probabilities: {} }, symptom: { type: 'choice', choice: kind, confidence: 0.9, probabilities: {} }, trust: { type: 'score', score: flawed ? 1 : 5, confidence: 0.9, probabilities: {} }, worth_forward_testing: { type: 'noul', noul: 0.8 }, curve_too_smooth: { type: 'noul', noul: ['PARAMETER_CLIFF', 'LOOK_AHEAD'].includes(kind) ? 0.9 : 0.1 } } }; };

test('the 140 labels preserve the exact planted mix', () => {
  assert.equal(dataset.items.length, 140);
  assert.deepEqual(Object.fromEntries([...new Set(labels.map((label) => label.kind))].map((kind) => [kind, labels.filter((label) => label.kind === kind).length])), { PARAMETER_CLIFF: 22, FEW_TRADES: 18, LOOK_AHEAD: 14, SURVIVORSHIP: 11, COSTS_OMITTED: 9, NONE: 66 });
});

test('the state includes the complete evidence and no planted verdict', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.equal(state.parameter_sensitivity_grid.length, 5);
    assert.equal(state.parameter_sensitivity_grid.every((row) => row.cells.length === 5), true);
    assert.equal(state.trades.return_distribution.reduce((sum, bucket) => sum + bucket.trades, 0), item.tradeCount);
    const sent = JSON.stringify(state);
    assert.equal(sent.includes('backtestId'), false);
    assert.equal(sent.includes('PARAMETER_CLIFF'), false);
    assert.equal(sent.includes('COSTS_OMITTED'), false);
  }
});

test('parameter cliffs really collapse one step from the chosen cell', () => {
  const cliffs = dataset.items.filter((item) => labels.find((label) => label.backtestId === item.id).kind === 'PARAMETER_CLIFF');
  for (const item of cliffs) { const center = item.parameterGrid[2].cells[2]; const neighbours = [item.parameterGrid[1].cells[2], item.parameterGrid[3].cells[2], item.parameterGrid[2].cells[1], item.parameterGrid[2].cells[3]]; assert.ok(center.sharpe > 2.8); assert.ok(neighbours.every((cell) => cell.sharpe < 0.5)); }
});

test('honest controls are broad plateaus with an untouched holdout', () => {
  const honest = dataset.items.filter((item) => labels.find((label) => label.backtestId === item.id).kind === 'NONE');
  for (const item of honest) {
    assert.equal(item.validation.holdoutUsedForSelection, false);
    const sharpes = item.parameterGrid.flatMap((row) => row.cells.map((cell) => cell.sharpe));
    assert.ok(Math.max(...sharpes) - Math.min(...sharpes) < 0.2);
  }
});

test('the report exposes false doubt and sorts every curve by trust', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Symptom accuracy').value, '100.0%');
  assert.equal(report.kpis.find((kpi) => kpi.label === 'Honest false-doubt rate').value, '0.0%');
  assert.equal(report.overfitGallery.rows.length, 140);
  assert.ok(report.overfitGallery.rows.every((row, index, rows) => !index || rows[index - 1].trust <= row.trust));
});

test('seed 1184 is deterministic', () => { assert.deepEqual(generate().dataset, generate().dataset); });
