import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/fundamental-read/demo.js';
import { computedRatios } from '../src/services/ratios.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('fundamental-read');
const context = demoContext(dataset);
const answer = ({ item }) => { const ratio = computedRatios(item); const gap = ratio.statementGap; return { answers: { quality: { type: 'score', score: ratio.complete ? 4.5 : 0, confidence: 0.8, probabilities: {} }, leverage_risk: { type: 'score', score: ratio.leverageScore ?? 0, confidence: 0.8, probabilities: {} }, earnings_quality: { type: 'choice', choice: ratio.earningsQuality ?? 'MIXED', confidence: 0.9, probabilities: { [ratio.earningsQuality ?? 'MIXED']: 0.9 } }, direction: { type: 'choice', choice: ratio.direction ?? 'STABLE', confidence: 0.9, probabilities: { [ratio.direction ?? 'STABLE']: 0.9 } }, capex_discipline: { type: 'noul', noul: ratio.capexDiscipline ? 0.95 : 0.05 }, statement_gap: { type: 'choice', choice: gap, confidence: 0.95, probabilities: { [gap]: 0.95 } } } }; };

test('all sixteen cached symbols remain, with four years where statements exist', () => {
  assert.equal(dataset.items.length, 16);
  assert.equal(new Set(dataset.items.map((item) => item.symbol)).size, 16);
  assert.equal(dataset.items.filter((item) => item.annualStatements.length === 4).length, 12);
  assert.equal(dataset.items.filter((item) => item.annualStatements.length === 0).length, 4);
  assert.ok(dataset.items.filter((item) => item.annualStatements.length).every((item) => item.annualStatements.every((year, index) => index === 0 || item.annualStatements[index - 1].fiscalYearEnd < year.fiscalYearEnd)));
});

test('computed ratios and gaps are produced by the one shared module', () => {
  const complete = dataset.items.find((item) => item.symbol === 'AAPL');
  const missing = dataset.items.find((item) => item.symbol === 'SPY');
  const ratio = computedRatios(complete);
  assert.equal(ratio.complete, true);
  assert.ok(Number.isFinite(ratio.debtToEquity));
  assert.ok(Number.isFinite(ratio.cashConversion));
  assert.ok(['CASH_BACKED', 'MIXED', 'ACCRUAL_HEAVY'].includes(ratio.earningsQuality));
  assert.deepEqual(computedRatios(missing), { statementGap: 'SHORT_HISTORY', complete: false });
  assert.equal(demo.explain.data, 'src/services/ratios.js#demo:data');
});

test('state sends raw statements and coverage, never computed ratios', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.equal(state.annual_statements_oldest_to_newest.length, item.annualStatements.length);
    const text = JSON.stringify(state);
    for (const key of ['debtToEquity', 'netDebtToEbitdaProxy', 'cashConversion', 'marginTrendPoints', 'leverageScore']) assert.equal(text.includes(key), false);
  }
});

test('report shows every model/computed pair and marks disagreements', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.qualityGrid.points.length, 16);
  assert.equal(report.ratioRows.length, 16);
  assert.equal(report.ratioRows.filter((row) => row.disagree).length, 0);
  const complete = dataset.items.filter((item) => computedRatios(item).complete).length;
  assert.equal(
    report.kpis.find((entry) => entry.label === 'Earnings-quality agreement').value,
    `${complete} of ${complete}`,
  );
  assert.equal(report.kpis.find((entry) => entry.label === 'Statement gaps exact').value, '16 of 16');
});

test('a model disagreement preserves both answers and is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const target = results.find((result) => computedRatios(result.item).complete);
  target.evaluation.earningsQuality = target.evaluation.earningsQuality === 'CASH_BACKED' ? 'ACCRUAL_HEAVY' : 'CASH_BACKED';
  const report = demo.report(results, context);
  const row = report.ratioRows.find((entry) => entry.id === target.item.id);
  assert.equal(row.disagree, true);
  assert.notEqual(row.modelEarnings, row.computedEarnings);
  assert.equal(report.checks.find((entry) => entry.id === 'earnings').count, 1);
});
