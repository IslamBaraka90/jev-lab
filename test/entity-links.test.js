import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/entity-links/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('entity-links');
const labelRows = await loadLabels('entity-links');
const labels = Object.fromEntries(labelRows.map((label) => [label.pairId, label]));
const context = { ...demoContext(dataset), labels: labelRows };
const answer = ({ item }) => { const label = labels[item.id]; const linked = label.relationship !== 'NONE'; return { answers: { relationship: { type: 'choice', choice: label.relationship, confidence: 0.9, probabilities: {} }, still_active: { type: 'noul', noul: label.active ? 0.95 : 0.05 }, strength: { type: 'score', score: linked ? 4 : 0, confidence: 0.8, probabilities: {} }, contagion_risk: { type: 'noul', noul: label.chainId && label.active ? 0.95 : 0.2 }, evidence_sufficient: { type: 'noul', noul: linked ? 0.95 : 0.05 } } }; };

test('dataset has 90 fictional entities and 400 unique pairs', () => {
  assert.equal(dataset.items.length, 400);
  assert.equal(dataset.context.entities.length, 90);
  assert.equal(new Set(dataset.items.map((item) => [item.left.id, item.right.id].sort().join(':'))).size, 400);
});

test('six chains, twelve coincidences and twenty ended relationships are planted', () => {
  assert.equal(new Set(labelRows.map((label) => label.chainId).filter(Boolean)).size, 6);
  assert.equal(labelRows.filter((label) => label.coincidence).length, 12);
  assert.equal(labelRows.filter((label) => label.relationship !== 'NONE' && !label.active).length, 20);
});

test('state includes all evidence and no label or graph position', () => {
  for (const item of dataset.items.slice(0, 50)) {
    const state = demo.buildState(item, context);
    assert.equal(state.evidence_oldest_to_newest.length, item.evidence.length);
    const sent = JSON.stringify(state);
    for (const key of ['chainId', 'coincidence', 'graph', 'position']) assert.equal(sent.includes(key), false);
  }
});

test('ended links retain relationship credit and perfect answers recover chains', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.kpis.find((entry) => entry.label === 'Relationship accuracy').value, '100.0%');
  assert.equal(report.kpis.find((entry) => entry.label === 'Ended relationships caught').value, '20 of 20');
  assert.equal(report.kpis.find((entry) => entry.label === 'Chains recovered').value, '6 of 6');
});

test('contagion network is unchanged when labels are removed', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const withLabels = demo.report(results, context).entityNetwork;
  const withoutLabels = demo.report(results, { ...context, labels: [] }).entityNetwork;
  assert.deepEqual(withoutLabels, withLabels);
  assert.ok(withLabels.paths.length >= 6);
});
