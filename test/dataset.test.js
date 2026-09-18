import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datasetProblems, datasetSummary, loadDataset, loadLabels } from '../src/services/dataset.js';

const valid = {
  id: 'demo',
  class: 'synthetic',
  generatedAt: '2026-09-19',
  seed: 1,
  source: 'scripts/generate/demo.js',
  items: [{ id: 'A-1' }, { id: 'A-2' }],
};

test('a complete dataset has no problems', () => {
  assert.deepEqual(datasetProblems(valid), []);
});

test('missing and malformed fields are all reported at once', () => {
  const problems = datasetProblems({ ...valid, id: '', class: 'made-up', generatedAt: 'yesterday', seed: undefined });
  assert.equal(problems.length, 4);
  assert.ok(problems.some((problem) => problem.includes('id')));
  assert.ok(problems.some((problem) => problem.includes('class')));
  assert.ok(problems.some((problem) => problem.includes('generatedAt')));
  assert.ok(problems.some((problem) => problem.includes('seed')));
});

test('items need unique ids', () => {
  const problems = datasetProblems({ ...valid, items: [{ id: 'A-1' }, { id: 'A-1' }, {}] });
  assert.ok(problems.some((problem) => problem.includes('A-1 appears more than once')));
  assert.ok(problems.some((problem) => problem.includes('has no id')));
});

test('cached-real data needs no seed but does need a source', () => {
  assert.deepEqual(datasetProblems({ ...valid, class: 'cached-real', seed: undefined }), []);
  assert.ok(datasetProblems({ ...valid, class: 'cached-real', seed: undefined, source: '' }).some((problem) => problem.includes('source')));
});

test('the summary line names the data class', () => {
  assert.match(datasetSummary(valid), /^Synthetic · seed 1 · generated 2026-09-19 · 2 items$/);
  assert.match(datasetSummary({ ...valid, class: 'cached-real', source: 'Yahoo Finance' }), /^Cached · Yahoo Finance/);
});

test('the example dataset loads, validates and has its labels outside the demo folder', async () => {
  const dataset = await loadDataset('__example__');
  assert.equal(dataset.class, 'synthetic');
  assert.ok(dataset.items.length >= 10);

  const labels = await loadLabels('__example__');
  assert.ok(labels.length >= 2);
  for (const label of labels) {
    assert.ok(dataset.items.some((item) => item.id === label.lineId), `${label.lineId} is not in the dataset`);
  }

  const serialised = JSON.stringify(dataset);
  assert.ok(!serialised.includes('DUPLICATE_POSTING'), 'the dataset must not carry the planted answers');
});
