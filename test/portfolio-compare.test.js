import assert from 'node:assert/strict';
import test from 'node:test';
import demo from '../demos/portfolio-compare/demo.js';
import { generate, SEED } from '../scripts/generate/portfolio-compare.js';

const { dataset, labels } = generate(SEED);
const answer = (label) => ({
  better_fit: { choice: label.betterFit, confidence: 0.95 },
  biggest_difference: { choice: label.reason, confidence: 0.9 },
  decisiveness: { score: label.kind === 'close' ? 1 : 5, confidence: 0.9 },
  goal_constraint_breached: { noul: label.kind === 'close' ? 0.1 : 0.9 },
  one_change_would_flip_it: { noul: label.kind === 'close' ? 0.9 : 0.2 },
});

test('dataset contains twelve ordinary decisions, four close calls and two return traps', () => {
  assert.equal(dataset.items.length, 18);
  assert.equal(labels.filter((label) => label.kind === 'decisive').length, 12);
  assert.equal(labels.filter((label) => label.kind === 'close').length, 4);
  assert.equal(labels.filter((label) => label.trap).length, 2);
});

test('every holding carries cached market measurements and aligned comparison rows', () => {
  for (const item of dataset.items) {
    assert.equal(item.portfolioA.holdings.length, item.portfolioB.holdings.length);
    for (const holding of [...item.portfolioA.holdings, ...item.portfolioB.holdings]) {
      assert.ok(holding.sector);
      assert.ok(holding.currency);
      assert.ok(Number.isFinite(holding.twelveMonthReturnPercent));
      assert.ok(Number.isFinite(holding.volatilityPercent));
      assert.ok(Number.isFinite(holding.drawdownPercent));
    }
    assert.equal(demo.comparisonRows(item).filter((row) => row.label.startsWith('Holding ')).length, 5);
  }
});

test('the state carries explicit goal constraints and both complete portfolios without a label', () => {
  const state = demo.buildState(dataset.items[0], dataset.context);
  assert.deepEqual(state.portfolio_a, dataset.items[0].portfolioA);
  assert.deepEqual(state.portfolio_b, dataset.items[0].portfolioB);
  assert.ok(Object.keys(state.goal.constraints).length >= 3);
  assert.equal(JSON.stringify(state).includes(labels[0].betterFit), false);
});

test('too close is correct for the four close calls and wrong for every other pair', () => {
  const results = dataset.items.map((item, index) => ({ item, evaluation: demo.evaluate(answer(labels[index]), item) }));
  const report = demo.report(results, { ...dataset.context, labels });
  assert.equal(report.kpis[0].value, '18 of 18');
  assert.equal(report.kpis[1].value, '4 of 4');
  assert.equal(report.kpis[2].value, '2 of 2');
  assert.equal(report.kpis[3].value, '0');

  const falseClose = results.map((result, index) => labels[index].kind === 'close' ? result : { ...result, evaluation: { ...result.evaluation, pick: 'TOO_CLOSE' } });
  assert.equal(demo.report(falseClose, { ...dataset.context, labels }).kpis[3].value, '14');
});

test('the two traps give the higher-return side a goal-breaking drawdown', () => {
  const traps = labels.map((label, index) => ({ label, item: dataset.items[index] })).filter(({ label }) => label.trap);
  for (const { label, item } of traps) {
    const winner = label.betterFit === 'PORTFOLIO_A' ? item.portfolioA : item.portfolioB;
    const loser = label.betterFit === 'PORTFOLIO_A' ? item.portfolioB : item.portfolioA;
    assert.ok(loser.summary.twelveMonthReturnPercent > winner.summary.twelveMonthReturnPercent);
    assert.ok(Math.abs(loser.summary.drawdownPercent) > item.goal.constraints.maximum_drawdown_percent);
  }
});

test('the difference matrix covers every pair once', () => {
  const results = dataset.items.map((item, index) => ({ item, evaluation: demo.evaluate(answer(labels[index]), item) }));
  const matrix = demo.report(results, { ...dataset.context, labels }).matrix;
  assert.equal(matrix.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0), 18);
});
