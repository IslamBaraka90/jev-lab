import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/goal-screening/demo.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// This demo has no ground truth, so the tests protect the two things that stand in for it: the numbers
// are the real ones, and the report grades consistency rather than pretending to grade correctness.

const dataset = await loadDataset('goal-screening');
const context = demoContext(dataset);
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ fit, disqualifier, shortlist, evidence = 4, sufficient = true }) => ({
  fit_to_goal: { type: 'score', score: fit, confidence: 0.75, legend: {}, probabilities: {} },
  disqualifier: { type: 'choice', choice: disqualifier, confidence: 0.8, probabilities: { [disqualifier]: 0.8 } },
  shortlist: { type: 'noul', noul: shortlist ? 0.9 : 0.1 },
  evidence_strength: { type: 'score', score: evidence, confidence: 0.7, legend: {}, probabilities: {} },
  data_sufficient: { type: 'noul', noul: sufficient ? 0.9 : 0.1 },
});

test('sixteen companies against six goals, with no labels at all', () => {
  assert.equal(dataset.items.length, 96);
  assert.equal(new Set(dataset.items.map((entry) => entry.symbol)).size, 16);
  assert.equal(new Set(dataset.items.map((entry) => entry.goalId)).size, 6);
  assert.equal(demo.labels, undefined, 'no ground truth is claimed');
  assert.match(context.note, /no ground truth/);
});

test('the numbers are the real ones', () => {
  const jpm = dataset.items.find((entry) => entry.symbol === 'JPM');
  assert.ok(jpm.revenue > 50_000_000_000);
  assert.ok(jpm.statementYears >= 3);
  assert.ok(jpm.volatilityPercent > 5 && jpm.volatilityPercent < 90);
  assert.match(jpm.priceAsOf, /^\d{4}-\d{2}-\d{2}$/);

  // Funds and commodities have prices and no statements, which is a question this demo asks about.
  const gld = dataset.items.find((entry) => entry.symbol === 'GLD');
  assert.equal(gld.statementYears, 0);
  assert.equal(gld.revenue, null);
  assert.ok(gld.volatilityPercent > 0);
});

test('the state carries one company and one brief, never the others', () => {
  const state = demo.buildState(item('JPM-income-now'), context);
  assert.match(state.goal, /income now/);
  assert.equal(state.company.symbol, 'JPM');
  const serialised = JSON.stringify(state);
  for (const symbol of ['NVDA', 'MSFT', 'GLD', 'SPY']) {
    assert.equal(serialised.includes(symbol), false, `the state must not mention ${symbol}`);
  }
});

test('a reading that never changes with the brief is reported as a failure', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ fit: 4, disqualifier: 'NONE', shortlist: true }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Companies read differently by goal').value, '0 of 16');
  assert.ok(report.findings.some((line) => /has not been read/.test(line)));
});

test('a reading that moves with the brief passes that check', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({
      fit: entry.goalId === 'income-now' ? 5.5 : entry.goalId === 'preserve' ? 1.5 : 3,
      disqualifier: 'NONE',
      shortlist: entry.goalId === 'income-now',
    }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Companies read differently by goal').value, '16 of 16');
  assert.equal(kpi(report, 'Shortlisted').value, '16 of 96');
});

test('a disqualifier with no number behind it is counted', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ fit: 2, disqualifier: 'LEVERAGE', shortlist: false }) }),
  });
  const report = demo.report(results, context);

  assert.ok(report.checks.find((check) => check.id === 'leverage').count > 30, 'most of these companies are not heavily indebted');
  assert.ok(report.findings.some((line) => /the file does not support/.test(line)));
});

test('claiming the data is sufficient where there are no statements is counted', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ fit: 3, disqualifier: 'NONE', shortlist: false, sufficient: true }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Missing statements admitted').value, '0 of 24', 'four instruments have no statements at all');
  assert.equal(report.checks.find((check) => check.id === 'no-statements').count, 24);
});

test('the shortlist matrix is the output somebody wanted', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ fit: 4, disqualifier: 'NONE', shortlist: entry.symbol === 'KO' }) }),
  });
  const { matrix } = demo.report(results, context);

  assert.equal(matrix.rows.length, 16);
  assert.equal(matrix.columns.length, 6);
  const ko = matrix.rows.find((row) => row.label === 'KO');
  assert.equal(ko.cells.every((cell) => cell.count === 1), true);
});
