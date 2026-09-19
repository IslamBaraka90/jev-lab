import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/golden-cross-review/demo.js';
import { crossovers, movingAverage } from '../src/strategies/golden-cross.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// No labels here: the price is the answer. So the tests guard the two things that would make the
// answer a lie — a bar from after the cross reaching the state, and the two equity curves being
// computed on different trades or different costs.

const dataset = await loadDataset('golden-cross-review');
const context = demoContext(dataset);
const kpi = (report, name) => report.kpis.find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);
const close = (line) => Number(String(line).split(' ')[4]);

const answerFor = ({ valid = true, context: read = 'ESTABLISHED_TREND', quality = 3, decision = 'TAKE', stop = 'BELOW_SWING_LOW' }) => ({
  valid_signal: { type: 'noul', noul: valid ? 0.9 : 0.1 },
  context: { type: 'choice', choice: read, confidence: 0.7, probabilities: { [read]: 0.7 } },
  signal_quality: { type: 'score', score: quality, confidence: 0.7, legend: {}, probabilities: {} },
  decision: { type: 'choice', choice: decision, confidence: 0.8, probabilities: { [decision]: 0.8 } },
  stop_placement: { type: 'choice', choice: stop, confidence: 0.6, probabilities: { [stop]: 0.6 } },
});

test('every cross in the file is one the rule really found', () => {
  assert.ok(dataset.items.length >= 60, 'six years of cached bars across sixteen symbols');
  assert.equal(demo.labels, undefined, 'the price is the ground truth, so there is nothing to label');

  const bars = dataset.items[0].chart.bars.map((line) => ({ close: close(line) }));
  assert.ok(bars.length > 0);

  // Re-derive one cross from scratch: the fifty crosses above the two hundred on that exact bar.
  for (const item of dataset.items.slice(0, 8)) {
    assert.ok(item.fastMa > item.slowMa, `${item.id} should be a cross upwards`);
    assert.ok(item.gapPercent > 0);
    assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.chart.bars[item.chart.markIndex].startsWith(item.date), true, `${item.id} marks the wrong bar`);
  }
});

test('the detector is the whole rule and takes no fitted parameters', () => {
  const bars = Array.from({ length: 400 }, (_, index) => ({ date: `d${index}`, close: index < 250 ? 100 - index * 0.1 : 75 + (index - 250) * 0.9 }));
  const found = crossovers(bars);

  assert.equal(found.length, 1, 'one turn, one cross');
  const fast = movingAverage(bars, 50);
  const slow = movingAverage(bars, 200);
  const at = found[0].index;
  assert.ok(fast[at - 1] <= slow[at - 1] && fast[at] > slow[at], 'the cross bar is the bar it crossed on');
});

test('no bar after the cross reaches the state', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    const shown = state.daily_bars_up_to_and_including_the_cross;

    assert.equal(shown.length, item.chart.markIndex + 1);
    assert.equal(shown.at(-1).startsWith(item.date), true);
    for (const later of item.chart.bars.slice(item.chart.markIndex + 1)) {
      assert.equal(JSON.stringify(state).includes(later), false, `${item.id} leaked a bar from after the cross`);
    }
  }
});

test('the two curves are the same trades, the same bars and the same costs', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ decision: item.symbol === 'SPY' ? 'TAKE' : 'SKIP' }) }),
  });
  const report = demo.report(results, context);
  const { points } = report.equityCurve;

  assert.equal(points.length, dataset.items.length, 'both curves step through every cross');
  assert.equal(points.filter((point) => point.flagged).length, dataset.items.filter((item) => item.symbol === 'SPY').length);

  // The filtered curve only moves on the trades it took; everywhere else it holds its value.
  for (let index = 1; index < points.length; index++) {
    if (!points[index].flagged) assert.equal(points[index].compare, points[index - 1].compare, `the filtered curve moved on a trade it skipped at ${points[index].label}`);
  }
});

test('taking everything makes both curves identical', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ decision: 'TAKE' }) }) });
  const report = demo.report(results, context);

  for (const point of report.equityCurve.points) assert.equal(point.value, point.compare);
  assert.equal(kpi(report, 'What the filter was worth').value, '0.00%');
  assert.equal(kpi(report, 'Crosses skipped').value, `0 of ${dataset.items.length}`);
});

test('skipping everything is reported rather than scored as a win', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ decision: 'SKIP', stop: 'NONE' }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Taking only the kept ones').value, '0.00%');
  assert.ok(report.findings.some((line) => /cannot lose money and cannot make any either/.test(line)));
  assert.equal(check(report, 'no-stop').count, 0, 'a skip with no stop is not a missing stop');
});

test('the outcome is computed from the bars, not from anything stored', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({}) }) });
  const report = demo.report(results, context);

  const first = dataset.items[0];
  const bars = first.chart.bars.map(close);
  const expected = ((bars.at(-1) - bars[first.chart.markIndex]) / bars[first.chart.markIndex]) * 100 - 0.1;
  const point = report.equityCurve.points.find((entry) => entry.id === first.id);

  assert.equal(point.pattern.endsWith('%'), true);
  // Printed to two decimals against a value rounded to three, so compare within a hundredth.
  assert.ok(Math.abs(Number(point.pattern.match(/(-?\d+\.\d+)%/)[1]) - expected) < 0.01, 'the printed outcome must be the one the bars give');
  assert.equal(Object.keys(first).includes('forwardReturnPercent'), false, 'the answer is not stored on the item');
});

test('a stop named for a trade that is not being taken is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ decision: 'SKIP', stop: 'ATR_BASED' }) }) });
  const report = demo.report(results, context);

  assert.equal(check(report, 'stop-on-skip').count, dataset.items.length);
});

test('the score is compared with the decision at the scale midpoint, not a fitted one', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => {
      const bars = item.chart.bars.map(close);
      const up = bars.at(-1) > bars[item.chart.markIndex];
      // Score the winners well and take everything: the score should then beat the decision.
      return { answers: answerFor({ quality: up ? 5 : 1, decision: 'TAKE' }) };
    },
  });
  const report = demo.report(results, context);
  const filtered = kpi(report, 'Filtering on the score instead');

  assert.match(filtered.context, /graded 3 or better/);
  assert.equal(filtered.tone, 'good');
  assert.ok(report.findings.some((line) => /not one chosen by looking at these results/.test(line)));
});

test('the quality curve is built from what the trades did', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => {
      const bars = item.chart.bars.map(close);
      const up = bars.at(-1) > bars[item.chart.markIndex];
      return { answers: answerFor({ quality: up ? 6 : 0 }) };
    },
  });
  const { curve } = demo.report(results, context);

  assert.equal(curve.points.at(-1).rate, 1, 'everything graded six made money');
  assert.ok(curve.points[0].rate < 1);
});
