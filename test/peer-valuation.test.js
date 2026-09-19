import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/peer-valuation/demo.js';
import { valuationMultiples } from '../src/services/ratios.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('peer-valuation');
const context = demoContext(dataset);
const answer = ({ item }) => ({ answers: { best_value: { type: 'choice', choice: item.members[0], confidence: 0.8, probabilities: {} }, premium_justified: { type: 'noul', noul: 0.7 }, discount_reason: { type: 'choice', choice: 'GROWTH', confidence: 0.7, probabilities: {} }, confidence_in_ranking: { type: 'score', score: 4, confidence: 0.8, probabilities: {} }, comparable_set: { type: 'noul', noul: item.loose ? 0.1 : 0.9 } } });

test('four named sets and the deliberately loose set are retained', () => {
  assert.equal(dataset.items.length, 4);
  assert.ok(dataset.items.every((item) => item.peers.length >= 4 && item.peers.length <= 5));
  assert.deepEqual(dataset.items.filter((item) => item.loose).map((item) => item.id), ['PV-ENERGY']);
});

test('state has raw prices and statements but no multiple or ranking', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.deepEqual(state.peer_set_members, item.members);
    const sent = JSON.stringify(state);
    for (const forbidden of ['priceToEarnings', 'priceToBook', 'priceToFreeCashFlow', 'enterpriseValueProxy', 'computedBest', 'ranking']) assert.equal(sent.includes(forbidden), false);
  }
});

test('computed multiples cover operating peers and retain unavailable bank cash flow', () => {
  const tech = dataset.items.find((item) => item.id === 'PV-TECH');
  assert.equal(valuationMultiples(tech.peers.find((peer) => peer.symbol === 'GOOGL')).complete, true);
  assert.equal(valuationMultiples(tech.peers.find((peer) => peer.symbol === 'AAPL')).complete, true);
});

test('every model pick is shown beside all three computed cheapest peers', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.peerSets.length, 4);
  assert.ok(report.peerSets.every((set) => set.modelPick && set.computedBest && set.cheapestPe && set.cheapestPb && Object.hasOwn(set, 'cheapestPfcf')));
  assert.equal(report.peerSets.find((set) => set.id === 'PV-BANKS').cheapestPfcf, null);
  assert.equal(report.kpis.find((entry) => entry.label === 'Picks inside set').value, '4 of 4');
  assert.equal(report.kpis.find((entry) => entry.label === 'Loose set rejected').value, 'Yes');
});

test('a cross-set pick stays visible as invalid', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  results[0].evaluation.bestValue = 'JPM';
  results[0].evaluation.validPick = false;
  const report = demo.report(results, context);
  assert.equal(report.kpis.find((entry) => entry.label === 'Picks inside set').value, '3 of 4');
});
