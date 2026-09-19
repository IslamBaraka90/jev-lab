import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/strategy-correlation/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The acceptance criterion this file exists for: no correlation, covariance or summary statistic may
// reach the state. If one does, the demo is asking a question it has already answered.

const dataset = await loadDataset('strategy-correlation');
const labels = await loadLabels('strategy-correlation');
const context = { ...demoContext(dataset), labels };
const label = (id) => labels.find((entry) => entry.pairId === id);
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, name) => report.kpis.find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ overlap = 2, diversifying = true, bet = 'DIFFERENT', move = 'KEEP' }) => ({
  overlap: { type: 'score', score: overlap, confidence: 0.75, legend: {}, probabilities: {} },
  diversifying: { type: 'noul', noul: diversifying ? 0.9 : 0.1 },
  same_underlying_bet: { type: 'choice', choice: bet, confidence: 0.7, probabilities: { [bet]: 0.7 } },
  allocation_change: { type: 'choice', choice: move, confidence: 0.7, probabilities: { [move]: 0.7 } },
});

test('sixty pairs, planted as the brief says', () => {
  assert.equal(dataset.items.length, 60);
  const counts = {};
  for (const entry of labels) counts[entry.relation] = (counts[entry.relation] ?? 0) + 1;
  assert.equal(counts.SAME_PARAMETERS, 4);
  assert.equal(counts.SAME_FACTOR, 5);
  assert.equal(counts.INDEPENDENT, 6);
  assert.equal(counts.STRESS_ONLY, 3);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 60);
});

test('the planted relations really look like what they claim', () => {
  for (const entry of labels.filter((row) => row.relation === 'SAME_PARAMETERS')) {
    assert.ok(entry.correlation > 0.7, `${entry.pairId} is the same strategy twice and should correlate`);
  }
  for (const entry of labels.filter((row) => row.relation === 'INDEPENDENT')) {
    assert.ok(Math.abs(entry.correlation) < 0.25, `${entry.pairId} should be independent over the whole period`);
  }
  for (const entry of labels.filter((row) => row.relation === 'STRESS_ONLY')) {
    assert.ok(Math.abs(entry.calmCorrelation) < 0.15, `${entry.pairId} should be flat outside the stress window`);
    assert.ok(entry.stressCorrelation > 0.45, `${entry.pairId} should move together inside it`);
    assert.ok(entry.stressCorrelation - entry.calmCorrelation > 0.4, `${entry.pairId} needs a visible jump`);
  }
});

test('no statistic of any kind reaches the state', () => {
  for (const entry of dataset.items.slice(0, 12)) {
    const state = demo.buildState(entry, context);
    const serialised = JSON.stringify(state);

    for (const word of ['correlat', 'Correlat', 'covarian', 'SAME_FACTOR', 'STRESS_ONLY', 'relation']) {
      assert.equal(serialised.includes(word), false, `${entry.id} leaked "${word}" into its state`);
    }

    // The numbers matter more than the words: no computed figure may appear as a value of its own.
    // A substring check would fire on "0.884" inside a daily result of -12.884, so compare tokens.
    const tokens = new Set(serialised.split(/[^\d.-]+/).filter(Boolean));
    const row = label(entry.id);
    for (const value of [row.correlation, row.stressCorrelation, row.calmCorrelation]) {
      assert.equal(tokens.has(String(value)), false, `${entry.id} leaked the figure ${value}`);
    }
    assert.ok(state.strategy_one.daily_results_basis_points.split(' ').length > 700, 'three years of daily results');
    assert.ok(state.strategy_two.daily_results_basis_points.split(' ').length > 700);
  }
});

test('each series is shipped once and shared by every pair that uses it', () => {
  assert.equal(Object.keys(context.series).length, 12);
  const uses = {};
  for (const entry of dataset.items) {
    uses[entry.leftId] = (uses[entry.leftId] ?? 0) + 1;
    uses[entry.rightId] = (uses[entry.rightId] ?? 0) + 1;
  }
  assert.ok(Math.max(...Object.values(uses)) > 1, 'a strategy appears in several pairs');
  for (const entry of dataset.items.slice(0, 5)) {
    assert.equal(Object.keys(entry.left).includes('dailyResultsBasisPoints'), false, 'the item does not carry a copy');
  }
});

test('the effective number of bets is smaller than the count of strategies', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({}) }) });
  const report = demo.report(results, context);
  const bets = kpi(report, 'Effective number of bets');

  const value = Number(bets.value.split(' of ')[0]);
  assert.ok(value > 1 && value < 12, `a book with any correlation in it holds fewer than twelve bets, got ${value}`);
  assert.match(bets.context, /twelve squared over the sum of every correlation/);
});

test('reading the series correctly separates from reading the words', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ overlap: label(entry.id).correlation >= 0.6 ? 5 : 1 }) }),
  });
  const report = demo.report(results, context);

  const [spotted, strong] = kpi(report, 'Correlated pairs called out').value.split(' of ').map(Number);
  assert.equal(spotted, strong);
  assert.equal(kpi(report, 'Uncorrelated pairs accused').value.startsWith('0 of '), true);
  assert.ok(Number(kpi(report, 'Overlap against the arithmetic').value) > 3);
});

test('grading everything the same shows as no separation at all', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ overlap: 3 }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Overlap against the arithmetic').value, '0.0');
  assert.equal(kpi(report, 'Overlap against the arithmetic').tone, 'warn');
});

test('the stress-only pairs are reported on their own', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ overlap: 1, diversifying: label(entry.id).relation !== 'STRESS_ONLY' }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Stress-only pairs caught').value, '3 of 3');
  assert.equal(check(report, 'stress').count, 0);
  assert.ok(report.findings.some((line) => /Whole-period correlation would have hidden every one/.test(line)));
});

test('missing the stress-only pairs is said plainly', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ overlap: 1, diversifying: true }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Stress-only pairs caught').value, '0 of 3');
  assert.equal(check(report, 'stress').count, 3);
  assert.ok(report.findings.some((line) => /the worst day it has/.test(line)));
});

test('the scatter puts every pair against its computed correlation', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ overlap: 4 }) }) });
  const report = demo.report(results, context);

  assert.equal(report.sizeScatter.points.length, 60);
  assert.equal(report.sizeScatter.points.filter((point) => point.flagged).length, 3, 'the stress pairs are marked');
  for (const point of report.sizeScatter.points) {
    assert.ok(point.norm >= 0 && point.norm <= 1);
    assert.ok(point.value >= 0 && point.value <= 1);
  }
});

test('dropping an independent strategy is counted against the answer', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ move: 'DROP_ONE' }) }) });
  const report = demo.report(results, context);

  assert.ok(report.findings.some((line) => /Dropping a genuinely independent strategy costs more/.test(line)));
  assert.equal(kpi(report, 'Pairs where one should go').value, '60 of 60');
});
