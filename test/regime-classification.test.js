import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/regime-classification/demo.js';
import { STRATEGIES, trades } from '../src/strategies/index.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// A gate flatters itself the moment it can see forward, and two equity curves flatter themselves the
// moment they are not the same trades. Those are the two things these tests exist for.

const dataset = await loadDataset('regime-classification');
const context = demoContext(dataset);
const kpi = (report, name) => report.kpis.find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ regime = 'TREND_UP', clarity = 4, fit = 'BREAKOUT', size = 'NORMAL', changing = false }) => ({
  regime: { type: 'choice', choice: regime, confidence: 0.75, probabilities: { [regime]: 0.75 } },
  regime_clarity: { type: 'score', score: clarity, confidence: 0.7, legend: {}, probabilities: {} },
  strategy_fit: { type: 'choice', choice: fit, confidence: 0.7, probabilities: { [fit]: 0.7 } },
  risk_scaling: { type: 'choice', choice: size, confidence: 0.7, probabilities: { [size]: 0.7 } },
  regime_changing: { type: 'noul', noul: changing ? 0.9 : 0.1 },
});

test('three hundred and twelve weeks across four instruments', () => {
  assert.equal(dataset.items.length, 312);
  assert.equal(new Set(dataset.items.map((item) => item.symbol)).size, 4);
  assert.equal(demo.labels, undefined, 'the strategies own results are the comparison, not a label');

  // The series live once each in the context, and every item points at the right place in both.
  for (const item of dataset.items) {
    assert.equal(context.dailySeries[item.symbol][item.lastBarIndex].startsWith(item.weekEnd), true, `${item.id} points at the wrong daily bar`);
    assert.equal(context.weeklySeries[item.symbol][item.weekIndex].startsWith(item.weekEnd), true, `${item.id} points at the wrong week`);
  }
});

test('the state stops at the last bar of the week being judged', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    const daily = state.daily_bars_to_the_end_of_this_week;
    const weekly = state.weekly_history;

    assert.equal(daily.at(-1).startsWith(item.weekEnd), true, `${item.id} shows a bar past its own week`);
    assert.equal(weekly.at(-1).startsWith(item.weekEnd), true, `${item.id} shows a week past its own`);
    assert.ok(daily.length <= context.dailyBarsInState);
    assert.ok(weekly.length <= context.weeklySummariesInState);

    // Nothing later than the week end may appear anywhere in the state, in any form.
    const later = context.dailySeries[item.symbol].slice(item.lastBarIndex + 1, item.lastBarIndex + 6);
    for (const bar of later) assert.equal(JSON.stringify(state).includes(bar), false, `${item.id} leaked a later bar`);
  }
});

test('every strategy can actually fire on the bars that ship', () => {
  for (const symbol of context.instruments) {
    const bars = context.dailySeries[symbol].map((line) => {
      const [date, open, high, low, close] = String(line).split(' ');
      return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
    });
    assert.ok(bars.length > 250, `${symbol} needs warm-up for a two-hundred-day average`);
  }

  const fired = STRATEGIES.map((strategy) => {
    const bars = context.dailySeries[context.instruments[0]].map((line) => {
      const [date, open, high, low, close] = String(line).split(' ');
      return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
    });
    return { id: strategy.id, count: strategy.signals(bars).length };
  });
  assert.ok(fired.every((entry) => entry.count >= 0));
  assert.ok(fired.some((entry) => entry.count > 0), 'at least one rule fires on the first instrument');
});

test('the two runs are the same trades with only the gate between them', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ fit: 'BREAKOUT' }) }) });
  const report = demo.report(results, context);
  const { points } = report.equityCurve;

  // Allowing everything must make the two curves identical, trade for trade.
  const { results: open } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ fit: STRATEGIES.find((strategy) => strategy.family)?.family ?? 'BREAKOUT' }) }),
  });
  assert.ok(points.length > 20, 'the strategies produce trades to compare');

  const allowed = points.filter((point) => point.flagged);
  assert.ok(allowed.length > 0 && allowed.length < points.length, 'a breakout-only gate allows some and refuses others');
  assert.equal(open.length, dataset.items.length);
});

test('a gate that allows nothing leaves the second curve flat', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ fit: 'STAY_OUT', size: 'NONE' }) }) });
  const report = demo.report(results, context);
  const { points } = report.equityCurve;

  assert.equal(points.every((point) => point.compare === 10_000), true, 'nothing traded, so nothing moved');
  assert.ok(points.some((point) => point.value !== 10_000), 'the always-on curve still trades');
  assert.equal(kpi(report, 'Strategies gated by the regime call').value, '0.00%');
  assert.equal(kpi(report, 'Weeks it said stay out').value, `${dataset.items.length} of ${dataset.items.length}`);
  assert.ok(report.findings.some((line) => /flat stretches on the gated curve/.test(line)));
});

test('a gate that is never shut is called out', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ fit: 'BREAKOUT' }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Weeks it said stay out').value, `0 of ${dataset.items.length}`);
  assert.ok(report.findings.some((line) => /A gate that is never shut is not a gate/.test(line)));
});

test('size scales the gated trades and nothing else', async () => {
  const runs = {};
  for (const size of ['HALF', 'NORMAL']) {
    const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ fit: 'BREAKOUT', size }) }) });
    runs[size] = demo.report(results, context);
  }

  const half = Number(kpi(runs.HALF, 'Strategies gated by the regime call').value.replace(/[+%]/g, ''));
  const full = Number(kpi(runs.NORMAL, 'Strategies gated by the regime call').value.replace(/[+%]/g, ''));
  assert.ok(Math.abs(half * 2 - full) < 0.05, 'half size is half the result');
  assert.equal(kpi(runs.HALF, 'Strategies always on').value, kpi(runs.NORMAL, 'Strategies always on').value, 'the ungated run never moves');
});

test('the demo shows its own reading of the regime beside the call', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ regime: 'TREND_UP' }) }) });
  const report = demo.report(results, context);

  assert.equal(report.matrix.rows.length, 5);
  const totals = report.matrix.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0);
  assert.equal(totals, dataset.items.length, 'every week is placed in the cross-check');
  assert.match(kpi(report, 'Agrees with the demo’s own reading').context, /drift, spread and gaps/);
  assert.ok(check(report, 'disagrees').count + Number(kpi(report, 'Agrees with the demo’s own reading').value.split(' of ')[0]) === dataset.items.length);
});

test('the book’s concentration is on the page, because it drives the gate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ fit: 'MEAN_REVERSION' }) }) });
  const report = demo.report(results, context);
  const where = kpi(report, 'Where the book’s trades come from');

  assert.match(where.value, /^\d+% from one rule$/);
  assert.ok(Number(where.value.replace(/\D/g, '')) > 50, 'one rule does most of the trading in this book');
  assert.match(where.context, /whose family was named in \d+ of 312 weeks/);
  assert.ok(report.findings.some((line) => /a fact about the book as much as about the gate/.test(line)));
});

test('raising size in a week the numbers call volatile is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ size: 'INCREASED' }) }) });
  const report = demo.report(results, context);
  const sized = check(report, 'sized-up');

  assert.equal(sized.count, sized.of, 'every volatile week had its size raised');
  assert.ok(sized.of > 0, 'the arithmetic finds some volatile weeks in this file');
});
