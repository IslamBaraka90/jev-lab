import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/mixer-tracing/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The desk's rules are written into the state, so each answer can be checked against a rule somebody
// wrote down: three hops to act, an exchange breaks the chain, a bridge does not, amounts must add up.

const dataset = await loadDataset('mixer-tracing');
const labels = await loadLabels('mixer-tracing');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.traceId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ tainted, hops, broken = false, exposure, action }) => ({
  tainted_funds: { type: 'noul', noul: tainted ? 0.95 : 0.05 },
  hops_to_source: { type: 'choice', choice: hops, confidence: 0.8, probabilities: { [hops]: 0.8 } },
  chain_broken_by_exchange: { type: 'noul', noul: broken ? 0.9 : 0.1 },
  exposure: { type: 'score', score: exposure, confidence: 0.7, legend: {}, probabilities: {} },
  action: { type: 'choice', choice: action, confidence: 0.85, probabilities: { [action]: 0.85 } },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    tainted: label.tainted,
    hops: label.hops,
    broken: label.breaker,
    exposure: label.tainted ? (label.hops === 'ONE' ? 6 : 4.5) : 0.5,
    action: label.tainted ? 'FREEZE_PENDING_REVIEW' : 'CLEAR',
  }) };
};

test('the file plants each kind of path the rules have something to say about', () => {
  assert.equal(dataset.items.length, 90);
  assert.equal(ofKind('one hop from a mixer').length, 12);
  assert.equal(ofKind('two or three hops away').length, 14);
  assert.equal(ofKind('an exchange broke the chain').length, 9);
  assert.equal(ofKind('the amounts do not add up').length, 8);
  assert.equal(ofKind('nothing found').length, 47);
  assert.equal(labels.filter((label) => label.tainted).length, 34);
});

test('a broken chain really does have an exchange between the subject and the source', () => {
  for (const label of ofKind('an exchange broke the chain')) {
    const hops = item(label.traceId).paths[0].hops;
    const exchange = hops.findIndex((hop) => hop.entity?.startsWith('EXCHANGE'));
    const mixer = hops.findIndex((hop) => hop.entity === 'MIXER_A');
    assert.ok(exchange >= 0 && mixer >= 0 && exchange < mixer, `${label.traceId} needs the exchange nearer the subject than the mixer`);
  }
});

test('a leaking path shows a hop holding less than it passed on', () => {
  // Walking backwards from what reached the subject, every hop should hold at least as much as the
  // one after it. A leaking path has a hop somewhere holding less than it went on to pass.
  const walk = (label) => {
    const path = item(label.traceId).paths[0];
    return [path.amount, ...path.hops.map((hop) => hop.amount)];
  };
  for (const label of ofKind('the amounts do not add up')) {
    const amounts = walk(label);
    assert.ok(amounts.some((value, index) => index > 0 && value < amounts[index - 1]), `${label.traceId} should break the arithmetic somewhere`);
  }
  for (const label of ofKind('two or three hops away')) {
    const amounts = walk(label);
    assert.ok(amounts.every((value, index) => index === 0 || value >= amounts[index - 1]), 'an ordinary path never loses money walking backwards');
  }
});

test('the state carries the rules and the path, and never the verdict', () => {
  const state = demo.buildState(item(ofKind('one hop from a mixer')[0].traceId), context);

  assert.equal(state.desk.rules.length, 4);
  assert.ok(state.funding_paths[0].hops_back.length >= 1);
  assert.ok(state.funding_paths[0].hops_back.some((hop) => hop.entity === 'MIXER_A'));

  const serialised = JSON.stringify(state);
  for (const value of ['tainted', 'breaker', 'one hop from a mixer', 'the amounts do not add up']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('every trace carries a graph the shared view can draw', () => {
  for (const entry of dataset.items.slice(0, 15)) {
    assert.equal(entry.graph.focus, entry.subject);
    assert.ok(entry.graph.nodes.length >= 2);
    assert.ok(entry.graph.edges.every((edge) => typeof edge.weight === 'number'));
  }
});

test('a perfect run finds the taint, applies the exchange rule, and clears the rest', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Tainted funds found').value, '34 of 34');
  assert.equal(kpi(report, 'Clean traces called tainted').value, '0 of 56');
  assert.equal(kpi(report, 'Hops back, exactly right').value, '100%');
  assert.equal(kpi(report, 'The exchange rule applied').value, '9 of 9');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
});

test('treating every path as tainted breaks the exchange rule, and the report says so', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ tainted: entry.entitiesSeen.length > 0, hops: 'TWO', exposure: 4, action: 'FREEZE_PENDING_REVIEW' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /the rule being read rather than applied/.test(line)));
  assert.equal(kpi(report, 'The exchange rule applied').value, '0 of 9');
  assert.ok(Number(kpi(report, 'Clean traces called tainted').value.split(' ')[0]) > 0);
});

test('the exposure bar holds fewer traces and a denser set of them', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 34);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points[4].rate, 1, 'at an exposure of four only the tainted traces are left');
  assert.equal(matrix.rows.length, 5);
});
