import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/portfolio-health/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The weights are invented and the numbers behind them are real, so the tests check both: that each
// portfolio carries the problem it claims, and that the ones built to be healthy carry none of them.

const dataset = await loadDataset('portfolio-health');
const labels = await loadLabels('portfolio-health');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.portfolioId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const withRisk = (risk) => labels.filter((label) => label.plantedRisk === risk).map((label) => item(label.portfolioId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ risk, severity, action, fits = true, nameOnly = false }) => ({
  main_risk: { type: 'choice', choice: risk, confidence: 0.85, probabilities: { [risk]: 0.85 } },
  severity: { type: 'score', score: severity, confidence: 0.7, legend: {}, probabilities: {} },
  action: { type: 'choice', choice: action, confidence: 0.8, probabilities: { [action]: 0.8 } },
  fits_objective: { type: 'noul', noul: fits ? 0.9 : 0.1 },
  diversified_in_name_only: { type: 'noul', noul: nameOnly ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const risk = planted.get(entry.id).plantedRisk;
  return { answers: answerFor({
    risk,
    severity: risk === 'NONE' ? 0.5 : 4.5,
    action: risk === 'NONE' ? 'HOLD' : risk === 'DRIFT' ? 'REBALANCE' : risk === 'CURRENCY' ? 'HEDGE' : 'TRIM',
    fits: risk === 'NONE',
    nameOnly: risk === 'CORRELATION',
  }) };
};

test('twenty-four portfolios, each carrying one problem or none', () => {
  assert.equal(dataset.items.length, 24);
  assert.equal(withRisk('CONCENTRATION').length, 5);
  assert.equal(withRisk('CORRELATION').length, 4);
  assert.equal(withRisk('LIQUIDITY').length, 3);
  assert.equal(withRisk('CURRENCY').length, 4);
  assert.equal(withRisk('DRIFT').length, 3);
  assert.equal(withRisk('NONE').length, 5);
});

test('each planted problem is visible in the numbers, and only there', () => {
  const others = (risk) => labels.filter((label) => label.plantedRisk !== risk).map((label) => item(label.portfolioId));
  const drift = (entry) => Math.abs(entry.currentAllocation.equity - entry.targetAllocation.equity);
  const thinnest = (entry) => Math.max(...entry.holdings.map((holding) => holding.daysOfAverageVolume ?? 0));

  assert.ok(Math.min(...withRisk('CONCENTRATION').map((entry) => entry.largestHoldingPercent)) > Math.max(...others('CONCENTRATION').map((entry) => entry.largestHoldingPercent)));
  assert.ok(Math.min(...withRisk('DRIFT').map(drift)) > Math.max(...others('DRIFT').map(drift)) * 3);
  assert.ok(Math.min(...withRisk('LIQUIDITY').map(thinnest)) > Math.max(...others('LIQUIDITY').map(thinnest)) * 2);
  assert.ok(withRisk('CURRENCY').every((entry) => entry.clientSpendsIn !== 'USD' && entry.heldOutsideTheClientsCurrencyPercent > 80));
  assert.ok(others('CURRENCY').every((entry) => entry.clientSpendsIn === 'USD'));
  assert.ok(Math.min(...withRisk('CORRELATION').map((entry) => entry.pairCorrelations[0].correlation)) > 0.7);
});

test('the healthy portfolios are dull in every direction', () => {
  for (const entry of withRisk('NONE')) {
    assert.ok(entry.largestHoldingPercent < 30);
    assert.ok(Math.abs(entry.currentAllocation.equity - entry.targetAllocation.equity) < 5);
    assert.equal(entry.clientSpendsIn, 'USD');
    assert.ok(Math.max(...entry.holdings.map((holding) => holding.daysOfAverageVolume ?? 0)) < 0.4);
  }
});

test('the real numbers are real', () => {
  const state = demo.buildState(item('PF-01'), context);
  assert.match(context.pricesAsOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(context.note, /cached once from Yahoo Finance/);
  for (const holding of state.holdings) {
    assert.ok(holding.volatility_percent > 3 && holding.volatility_percent < 200, `${holding.symbol} volatility looks wrong`);
    assert.ok(Math.abs(holding.twelve_month_return_percent) < 400);
  }
  assert.equal(JSON.stringify(state).includes('plantedRisk'), false);
});

test('a perfect run names every problem and leaves the healthy ones alone', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Risk named exactly').value, '19 of 19');
  assert.equal(kpi(report, 'Healthy portfolios left alone').value, '5 of 5');
  assert.equal(kpi(report, 'Main risk right').value, '24 of 24');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(report.findings, []);
});

test('naming a problem and holding is called out', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ risk: planted.get(entry.id).plantedRisk === 'NONE' ? 'NONE' : 'CONCENTRATION', severity: 4, action: 'HOLD' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /told to hold/.test(line)));
  assert.equal(kpi(report, 'Something to do').value, '0 of 24');
});

test('calling everything concentrated is graded per planted risk', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ risk: 'CONCENTRATION', severity: 5, action: 'TRIM', fits: false }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'concentration').count, 0);
  assert.equal(report.checks.find((check) => check.id === 'drift').count, 3);
  assert.equal(report.checks.find((check) => check.id === 'healthy').count, 5);
  assert.equal(kpi(report, 'Risk named exactly').value, '5 of 19');
});

test('the severity bar raises fewer portfolios and more of the right ones', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 19);
  assert.equal(curve.points[4].rate, 1, 'at four of six only the portfolios with a problem are raised');
  assert.equal(matrix.rows.length, 6);
});
