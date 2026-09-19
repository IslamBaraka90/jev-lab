import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/news-impact/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The two things worth protecting here: no bar after the headline day may reach the state, and no
// real company may be named anywhere in it.

const dataset = await loadDataset('news-impact');
const labels = await loadLabels('news-impact');
const context = { ...demoContext(dataset), labels };
const label = (id) => labels.find((entry) => entry.headlineId === id);
const kpi = (report, name) => report.kpis.find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ materiality = 2, direction = 'NEUTRAL', horizon = 'DAYS', priced = false, tradeable = false }) => ({
  materiality: { type: 'score', score: materiality, confidence: 0.7, legend: {}, probabilities: {} },
  direction: { type: 'choice', choice: direction, confidence: 0.75, probabilities: { [direction]: 0.75 } },
  horizon: { type: 'choice', choice: horizon, confidence: 0.6, probabilities: { [horizon]: 0.6 } },
  already_priced: { type: 'noul', noul: priced ? 0.9 : 0.1 },
  tradeable_now: { type: 'noul', noul: tradeable ? 0.9 : 0.1 },
});

test('three hundred headlines, planted as the brief says', () => {
  assert.equal(dataset.items.length, 300);
  assert.equal(labels.length, 300);
  const counts = {};
  for (const entry of labels) counts[entry.group] = (counts[entry.group] ?? 0) + 1;
  assert.deepEqual(counts, { MOVED: 40, NOTHING: 40, ROUTINE: 220 });
});

test('the planted groups really did and really did not move', () => {
  for (const entry of labels.filter((row) => row.group === 'MOVED')) {
    assert.ok(Math.abs(entry.actualMovePct) >= 6, `${entry.headlineId} should sit in front of a real move`);
  }
  for (const entry of labels.filter((row) => row.group === 'NOTHING')) {
    assert.ok(Math.abs(entry.actualMovePct) <= 1, `${entry.headlineId} should sit in front of nothing`);
  }
});

test('no real company is named anywhere', () => {
  const serialised = JSON.stringify(dataset);
  for (const name of ['NVDA', 'MSFT', 'AAPL', 'Apple', 'Nvidia', 'Microsoft', 'JPMorgan', 'Walmart', 'Chevron']) {
    assert.equal(serialised.includes(name), false, `${name} must not appear: the headlines are invented`);
  }
  assert.match(context.note, /invented/);
});

test('the state stops at the headline day', () => {
  for (const item of dataset.items.slice(0, 40)) {
    const state = demo.buildState(item, context);
    const bars = state.daily_bars_up_to_and_including_today;
    assert.equal(bars.length, item.chart.markIndex + 1);
    assert.equal(bars.at(-1).startsWith(item.date), true, `${item.id} should end on its own headline day`);

    // Everything after the mark is on the page and in the report, and must not be in the state.
    for (const later of item.chart.bars.slice(item.chart.markIndex + 1)) {
      assert.equal(JSON.stringify(state).includes(later), false, `${item.id} leaked a bar from after the headline`);
    }
  }
});

test('the prior headlines are the ones that really came before', () => {
  const withPriors = dataset.items.filter((item) => item.priorHeadlines.length === 3).slice(0, 20);
  assert.ok(withPriors.length >= 10, 'most issuers accumulate a history');

  for (const item of withPriors) {
    const earlier = dataset.items.filter((other) => other.ticker === item.ticker && other.date < item.date);
    for (const line of item.priorHeadlines) {
      const [date] = line.split(' · ');
      const match = earlier.find((other) => other.date === date);
      assert.ok(match, `${item.id} cites a headline on ${date} that does not exist`);
      assert.equal(line.endsWith(match.headline), true, `${item.id} cites ${date} with the wrong text`);
    }
  }
});

test('grading the real moves high and the duds low shows as a gap', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ materiality: label(item.id).group === 'MOVED' ? 5 : 2 }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Materiality gap, real move against none').value, '3.0');
  assert.equal(kpi(report, 'Materiality gap, real move against none').tone, 'good');
  assert.equal(check(report, 'missed').count, 0);
  assert.equal(check(report, 'over').count, 0, 'the duds all scored below the average of the two sets');
  assert.equal(kpi(report, 'Big news told from small').tone, 'good');
  assert.ok(report.findings.some((line) => /Whatever separated them was in the chart/.test(line)));
});

test('grading both sets the same is reported as the demo working', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ materiality: 5 }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Materiality gap, real move against none').value, '0.0');
  assert.equal(kpi(report, 'Big news told from small').value, '0.0', 'grading everything alike separates nothing');
  assert.equal(check(report, 'over').count, 40, 'and every dud sits on the average rather than below it');
  assert.ok(report.findings.some((line) => /the text does not know what happens next/.test(line)));
});

test('direction is only graded where the move means something', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ direction: label(item.id).actualMovePct >= 0 ? 'POSITIVE' : 'NEGATIVE' }) }),
  });
  const report = demo.report(results, context);
  const [right, of] = kpi(report, 'Right when it called one').value.split(' of ').map(Number);

  assert.equal(right, of);
  assert.ok(of < 300 && of > 40, 'the flat ones are left out and the rest are not');
  assert.equal(check(report, 'wrong-way').count, 0);
});

test('declining to call a direction is not counted as calling it wrong', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ direction: 'NEUTRAL' }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Direction called at all').value.startsWith('0 of '), true);
  assert.equal(kpi(report, 'Right when it called one').value, '0 of 0');
  assert.equal(check(report, 'wrong-way').count, 0, 'a neutral read is not a wrong read');
  assert.ok(report.findings.some((line) => /no directional read at all/.test(line)));
});

test('the calibration curve rises when materiality tracks the outcome', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ materiality: Math.abs(label(item.id).actualMovePct) >= 4 ? 6 : 1 }) }),
  });
  const { curve } = demo.report(results, context);

  assert.equal(curve.points.length, 7);
  assert.ok(curve.points[0].rate < curve.points.at(-1).rate, 'a sharper filter should mean a better hit rate');
  assert.equal(curve.points.at(-1).rate, 1);
});

test('pre-news drift is checked against the bars before the headline', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item }) => ({ answers: answerFor({ priced: Math.abs(label(item.id).priorDriftPct) >= 3 }) }),
  });
  const report = demo.report(results, context);
  const [spotted, of] = kpi(report, 'Pre-news drift noticed').value.split(' of ').map(Number);

  assert.equal(spotted, of);
  assert.ok(of >= 20, 'plenty of these charts had already moved');
});

test('acting on everything is reported against the base rate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ tradeable: true }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Acted on').value.startsWith('300 of 300'), true);
  assert.equal(kpi(report, 'Hit rate when acting').tone, 'warn', 'acting on everything cannot beat acting on everything');
});
