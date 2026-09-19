import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/dividend-safety/demo.js';
import { dividendRatios } from '../src/services/ratios.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('dividend-safety');
const context = demoContext(dataset);
const answer = ({ item }) => { const ratio = dividendRatios(item); return { answers: { safety: { type: 'score', score: ratio.complete ? ratio.safetyScore : 0, confidence: 0.8, probabilities: {} }, first_to_break: { type: 'choice', choice: ratio.complete ? ratio.firstToBreak : 'NONE', confidence: 0.9, probabilities: {} }, cut_risk_12m: { type: 'choice', choice: ratio.complete && ratio.safetyScore < 3 ? 'HIGH' : 'LOW', confidence: 0.8, probabilities: {} }, growth_sustainable: { type: 'noul', noul: ratio.complete && ratio.payoutOnFcf < 0.8 ? 0.9 : 0.1 }, payout_funded_by_debt: { type: 'noul', noul: ratio.debtFunded ? 0.9 : 0.1 } } }; };

test('all symbols remain and twelve have four annual histories', () => {
  assert.equal(dataset.items.length, 16);
  assert.equal(dataset.items.filter((item) => item.annualStatements.length === 4).length, 12);
  assert.equal(dataset.items.filter((item) => dividendRatios(item).complete).length, 10);
});

test('yield and cover are report-only calculations', () => {
  const item = dataset.items.find((entry) => entry.symbol === 'KO');
  const ratio = dividendRatios(item);
  assert.equal(ratio.complete, true);
  assert.ok(ratio.yieldPercent > 0);
  assert.ok(ratio.payoutOnFcf > 0);
  assert.ok(Array.isArray(ratio.historicalCuts));
  const state = demo.buildState(item, context);
  const sent = JSON.stringify(state);
  for (const key of ['latestPrice', 'yieldPercent', 'payoutOnFcf', 'payoutOnEarnings', 'safetyScore']) assert.equal(sent.includes(key), false);
});

test('the cached four-year histories disclose their natural-cut count', () => {
  const cuts = dataset.items.flatMap((item) => dividendRatios(item).historicalCuts ?? []);
  assert.equal(cuts.length, 0);
});

test('report includes the scatter table alternative and every symbol', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.yieldSafety.points.length, 10);
  assert.equal(report.dividendRows.length, 16);
  assert.equal(report.kpis.find((entry) => entry.label === 'Complete issuer histories').value, '10 of 16');
  assert.match(report.findings[0], /no aggregate dividend cut/i);
});

test('a model/formula disagreement remains visible', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const target = results.find((result) => dividendRatios(result.item).complete);
  target.evaluation.safety = Math.max(0, dividendRatios(target.item).safetyScore - 3);
  const report = demo.report(results, context);
  assert.equal(report.checks.find((entry) => entry.id === 'safety').count, 1);
});
