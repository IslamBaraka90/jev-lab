import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/event-clustering/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('event-clustering');
const labelRows = await loadLabels('event-clustering');
const labels = Object.fromEntries(labelRows.map((label) => [label.headlineId, label]));
const context = { ...demoContext(dataset), labels: labelRows };
const rank = (item, label) => label.isPrimary ? 'PRIMARY' : item.outletType === 'wire' ? 'WIRE' : item.outletType === 'aggregator' || item.outletType === 'blog' ? 'AGGREGATOR' : 'SECONDARY';
const answer = ({ item }) => { const label = labels[item.id]; return { answers: { same_event: { type: 'noul', noul: label.sameEvent ? 0.95 : 0.05 }, adds_information: { type: 'noul', noul: label.addsInformation ? 0.95 : 0.05 }, source_rank: { type: 'choice', choice: rank(item, label), confidence: 0.9, probabilities: {} }, cluster_confidence: { type: 'score', score: 5, confidence: 0.9, probabilities: {} } } }; };

test('the feed has exactly 380 headlines and 46 planted events', () => {
  assert.equal(dataset.items.length, 380);
  assert.equal(new Set(Object.values(labels).map((label) => label.eventId)).size, 46);
  assert.equal(dataset.context.outlets.length, 22);
});

test('later additions, confirmations and six near-duplicate pairs are present', () => {
  const laterAdds = new Set(dataset.items.filter((item) => labels[item.id].addsInformation && item.candidateCluster).map((item) => labels[item.id].eventId));
  const confirmations = dataset.items.filter((item) => labels[item.id].rumourConfirmation);
  const nearPairs = new Set(Object.values(labels).map((label) => label.nearDuplicatePair).filter(Boolean));
  assert.equal(laterAdds.size, 20);
  assert.equal(confirmations.length, 8);
  assert.equal(nearPairs.size, 6);
});

test('state never carries event labels', () => {
  for (const item of dataset.items.slice(0, 60)) {
    const sent = JSON.stringify(demo.buildState(item, context));
    for (const key of ['eventId', 'addsInformation', 'isPrimary', 'nearDuplicatePair', 'rumourConfirmation']) assert.equal(sent.includes(key), false);
  }
});

test('perfect answers recover 46 clusters and every near duplicate', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, context);
  assert.equal(report.eventClusters.after, 46);
  assert.equal(report.kpis.find((entry) => entry.label === 'Pair precision').value, '100.0%');
  assert.equal(report.kpis.find((entry) => entry.label === 'Near-duplicates apart').value, '6 of 6');
  assert.equal(report.eventClusters.rows.reduce((sum, row) => sum + row.size, 0), 380);
});

test('a near-duplicate merge is called out separately', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const target = results.find((result) => labels[result.item.id].nearDuplicatePair);
  target.evaluation.sameEvent = true;
  const report = demo.report(results, context);
  assert.equal(report.checks.find((entry) => entry.id === 'merge').count, 1);
  assert.equal(report.kpis.find((entry) => entry.label === 'Near-duplicates apart').value, '5 of 6');
});
