import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/post-trade-review/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The prices are real, so the tests check that each planted fault is actually visible in the record,
// and that the review is asked to grade the plan rather than the outcome.

const dataset = await loadDataset('post-trade-review');
const labels = await loadLabels('post-trade-review');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.tradeId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const withLesson = (lesson) => labels.filter((label) => label.lesson === lesson).map((label) => item(label.tradeId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ lesson, plan = true, realistic = true, honoured = true, discipline = 4, repeatable = true }) => ({
  plan_complete: { type: 'noul', noul: plan ? 0.9 : 0.1 },
  target_realistic: { type: 'noul', noul: realistic ? 0.9 : 0.1 },
  stop_honoured: { type: 'noul', noul: honoured ? 0.9 : 0.1 },
  exit_discipline: { type: 'score', score: discipline, confidence: 0.7, legend: {}, probabilities: {} },
  lesson: { type: 'choice', choice: lesson, confidence: 0.85, probabilities: { [lesson]: 0.85 } },
  repeatable_setup: { type: 'noul', noul: repeatable ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    lesson: label.lesson,
    plan: label.planComplete,
    realistic: label.lesson !== 'TARGET_TOO_FAR',
    honoured: label.lesson !== 'MOVED_STOP' && label.lesson !== 'NO_STOP',
    discipline: label.lesson === 'PLAN_FOLLOWED' ? 5.5 : 1.5,
  }) };
};

test('two hundred and twenty trades, five planted faults and ninety clean ones', () => {
  assert.equal(dataset.items.length, 220);
  assert.equal(withLesson('NO_STOP').length, 30);
  assert.equal(withLesson('TARGET_TOO_FAR').length, 28);
  assert.equal(withLesson('EXITED_EARLY').length, 26);
  assert.equal(withLesson('MOVED_STOP').length, 24);
  assert.equal(withLesson('CHASED_ENTRY').length, 22);
  assert.equal(withLesson('PLAN_FOLLOWED').length, 90);
});

test('each fault is in the record, not only in the label', () => {
  assert.ok(withLesson('NO_STOP').every((entry) => entry.plannedStop === null));
  assert.ok(withLesson('MOVED_STOP').every((entry) => entry.stopMoves.length > 0));
  assert.ok(withLesson('EXITED_EARLY').every((entry) => entry.exitReason.startsWith('closed by hand')));
  assert.ok(withLesson('CHASED_ENTRY').every((entry) => entry.barsBetweenSignalAndEntry >= 3));
  assert.ok(withLesson('PLAN_FOLLOWED').every((entry) => entry.plannedStop !== null && entry.stopMoves.length === 0 && entry.barsBetweenSignalAndEntry <= 1));

  // The unreachable targets need more of the instrument's own range than the horizon can deliver.
  for (const entry of withLesson('TARGET_TOO_FAR')) {
    const needed = Math.abs(entry.plannedTarget - entry.entryPrice) / entry.entryPrice * 100;
    assert.ok(needed > entry.averageDailyRangePercent * entry.plannedHorizonBars, `${entry.id} target should be out of reach`);
  }
});

test('the bars are real, and stop at the exit', () => {
  for (const entry of dataset.items.slice(0, 30)) {
    assert.ok(entry.chart.bars.length >= 21);
    const [date, open, high, low, close] = entry.chart.bars[0].split(' ');
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number(high) >= Number(low) && Number(high) >= Number(open) && Number(high) >= Number(close));
    assert.equal(entry.chart.bars.length - entry.chart.markIndex <= entry.barsHeld + 2, true, 'no bars after the exit');
  }
  assert.match(context.note, /cached once from Yahoo Finance/);
});

test('the state holds the plan and the bars and never the lesson', () => {
  const state = demo.buildState(item(withLesson('MOVED_STOP')[0].id), context);
  assert.equal(state.what_happened.stop_moves.length, 1);
  assert.ok(state.instrument.daily_bars.length > 20);
  const serialised = JSON.stringify(state);
  for (const value of ['MOVED_STOP', 'planComplete', 'PLAN_FOLLOWED']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('a perfect run names every fault and leaves the well-run trades alone', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Lesson named exactly').value, '130 of 130');
  assert.equal(kpi(report, 'Well-run trades left alone').value, '90 of 90');
  assert.equal(kpi(report, 'Plan completeness read right').value, '100%');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
});

test('a review that grades the result instead of the plan is caught', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ lesson: planted.get(entry.id).lesson, discipline: entry.resultPercent > 0 ? 6 : 1 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /should not care which way the trade went/.test(line)));
  assert.match(kpi(report, 'Discipline on winners against losers').context, /reads the result/);
});

test('calling every trade well-run loses all the lessons', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ lesson: 'PLAN_FOLLOWED', discipline: 5 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Lesson named exactly').value, '0 of 130');
  assert.equal(report.checks.find((check) => check.id === 'no-stop').count, 30);
  assert.equal(report.checks.find((check) => check.id === 'clean').count, 0);
});

test('the discipline score sorts the worst-run trades to the top', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix, topItems } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 130);
  assert.equal(curve.points[2].rate, 1, 'at a discipline of two or below only the faulted trades are there');
  assert.equal(matrix.rows.length, 6);
  assert.equal(topItems.length, 10);
});
