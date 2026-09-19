import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/factor-exposure/demo.js';
import { correlation } from '../scripts/generate/lib/market.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('factor-exposure');
const labels = await loadLabels('factor-exposure');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.portfolioId, label]));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = (label) => ({
  dominant_factor: { type: 'choice', choice: label.dominantFactor, confidence: 0.9, probabilities: { [label.dominantFactor]: 0.9 } },
  unintended_exposure: { type: 'choice', choice: label.unintendedFactor, confidence: 0.85, probabilities: { [label.unintendedFactor]: 0.85 } },
  exposure_strength: { type: 'score', score: label.singleFactorPortfolio ? 5 : 4.5, confidence: 0.8, probabilities: {} },
  belief_matches_holdings: { type: 'noul', noul: label.beliefMatchesHoldings ? 0.9 : 0.1 },
  single_factor_portfolio: { type: 'noul', noul: label.singleFactorPortfolio ? 0.9 : 0.1 },
});

const perfect = ({ item }) => ({ answers: answerFor(planted.get(item.id)) });

test('dataset has thirty portfolios and every dominant factor is represented', () => {
  assert.equal(dataset.items.length, 30);
  assert.deepEqual(new Set(labels.map((label) => label.dominantFactor)), new Set(['MOMENTUM', 'VALUE', 'QUALITY', 'SIZE', 'RATES', 'ENERGY', 'FX']));
  assert.ok(labels.filter((label) => label.unintendedFactor !== 'NONE').length >= 18);
  assert.ok(labels.some((label) => label.beliefMatchesHoldings));
  assert.ok(labels.some((label) => !label.beliefMatchesHoldings));
});

test('co-movement is computed from real cached return history', () => {
  const item = dataset.items[0];
  const holding = item.holdings[0];
  const representatives = context.representatives.MOMENTUM;
  const expected = Number((representatives.reduce((sum, symbol) => sum + correlation(holding.symbol, symbol), 0) / representatives.length).toFixed(3));
  assert.equal(holding.correlations.MOMENTUM, expected);
  assert.match(context.pricesAsOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(context.note, /cached once from Yahoo Finance/);
});

test('state sends the complete portfolio and evidence without labels', () => {
  const state = demo.buildState(dataset.items[0], context);
  assert.equal(state.portfolio.holdings.length, dataset.items[0].holdings.length);
  assert.deepEqual(Object.keys(state.portfolio.co_movement_by_plain_language_factor), ['MOMENTUM', 'VALUE', 'QUALITY', 'SIZE', 'RATES', 'ENERGY', 'FX']);
  assert.equal(JSON.stringify(state).includes('dominantFactor'), false);
  assert.equal(JSON.stringify(state).includes('unintendedFactor'), false);
  assert.match(state.interpretation_note, /not a licensed factor model/);
});

test('a perfect run grades dominant, unintended and belief answers separately', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(kpi(report, 'Dominant factor accuracy').value, '30 of 30');
  assert.equal(kpi(report, 'Unintended factor accuracy').value, '30 of 30');
  assert.equal(kpi(report, 'Belief matches holdings accuracy').value, '30 of 30');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0]);
  assert.equal(report.topItems.length, 5);
});

test('missing second exposures does not erase a correct dominant answer', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item }) => {
    const label = planted.get(item.id);
    return { answers: { ...answerFor(label), unintended_exposure: { type: 'choice', choice: 'NONE', confidence: 0.9, probabilities: { NONE: 0.9 } } } };
  } });
  const report = demo.report(results, { ...context, labels });
  assert.equal(kpi(report, 'Dominant factor accuracy').value, '30 of 30');
  assert.notEqual(kpi(report, 'Unintended factor accuracy').value, '30 of 30');
  assert.ok(report.findings.some((line) => /second exposure/.test(line)));
});

test('the matrix covers all seven dominant factors', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.matrix.rows.length, 7);
  assert.ok(report.matrix.rows.every((row) => row.cells.length === 7));
});
