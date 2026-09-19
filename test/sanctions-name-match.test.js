import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/sanctions-name-match/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('sanctions-name-match');
const labels = await loadLabels('sanctions-name-match');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.pairId, label]));

function answersFor(label) {
  const insufficient = label.decidingField === 'INSUFFICIENT';
  const disposition = label.expectedDisposition;
  return {
    same_entity: { type: 'noul', noul: insufficient ? 0.5 : label.sameEntity ? 0.95 : 0.05 },
    deciding_evidence: { type: 'choice', choice: label.decidingField, confidence: 0.9, probabilities: { [label.decidingField]: 0.9 } },
    match_strength: { type: 'score', score: insufficient ? 3 : label.sameEntity ? 5.5 : 1.5, confidence: 0.9, probabilities: {} },
    disposition: { type: 'choice', choice: disposition, confidence: 0.9, probabilities: { [disposition]: 0.9 } },
    needs_more_data: { type: 'noul', noul: insufficient ? 0.95 : 0.05 },
  };
}

const perfect = ({ item }) => ({ answers: answersFor(byId.get(item.id)) });

test('dataset has 200 fictional candidates, 18 true matches and 12 insufficient records', () => {
  assert.equal(dataset.items.length, 200);
  assert.equal(labels.length, 200);
  assert.equal(labels.filter((label) => label.sameEntity).length, 18);
  assert.equal(labels.filter((label) => label.decidingField === 'INSUFFICIENT').length, 12);
  assert.ok(dataset.items.every((item) => item.notice.includes('FICTIONAL WATCHLIST')));
  assert.ok(dataset.items.every((item) => item.listEntry.fictional));
  assert.ok(dataset.items.every((item) => item.listEntry.program.startsWith('DEMO PROGRAM')));
});

test('state sends both complete records, the engine score and policy without labels', () => {
  const item = dataset.items[0];
  const state = demo.buildState(item, context);
  assert.deepEqual(state.candidate_pair, item);
  assert.ok(state.matching_rules.requiredToConfirm);
  assert.match(state.fictional_notice, /fictional/i);
  assert.equal(state.sameEntity, undefined);
  assert.equal(state.decidingField, undefined);
});

test('perfect answers clear false positives, keep true matches and honour insufficient cases', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Identity accuracy').value, '100%');
  assert.equal(report.kpis.find((entry) => entry.label === 'True matches kept').value, '100%');
  assert.equal(report.kpis.find((entry) => entry.label === 'False positives cleared').value, '100%');
  assert.deepEqual(report.insufficient, { correct: 12, total: 12 });
  assert.ok(report.checks.every((check) => check.count === 0));
});

test('an insufficient record is correct only when Jev defers it explicitly', async () => {
  const target = labels.find((label) => label.decidingField === 'INSUFFICIENT');
  const item = dataset.items.find((entry) => entry.id === target.pairId);
  const wrong = answersFor(target);
  wrong.deciding_evidence.choice = 'NAME_FORM_ONLY';
  const { results } = await runDemo(demo, { dataset: { ...dataset, items: [item] }, ask: () => ({ answers: wrong }) });
  const report = demo.report(results, { ...context, labels: [target] });
  assert.deepEqual(report.insufficient, { correct: 0, total: 1 });
  assert.equal(report.kpis.find((entry) => entry.label === 'Identity accuracy').value, '0%');
  assert.equal(report.checks.find((entry) => entry.id === 'insufficient').count, 1);
});

test('the identity matrix is diagonal for a perfect run', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });
  for (const row of matrix.rows) for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
});
