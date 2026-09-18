import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_DEMOS, DEMOS, DOMAIN_BY_ID, demoCard, findDemo } from '../demos/index.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, loadFixtures, runDemo } from '../src/services/demo-runner.js';

// Every demo answers to the same contract, so the runtime, the recorder and the report can treat them
// all the same way. A new demo either passes this file or does not ship.

const QUESTION_TYPES = new Set(['choice', 'score', 'noul']);

test('the registry is consistent', () => {
  for (const demo of ALL_DEMOS) {
    assert.equal(findDemo(demo.id), demo);
    assert.ok(DOMAIN_BY_ID[demo.domain], `${demo.id} is in unknown domain "${demo.domain}"`);
    assert.ok(demo.value?.length > 10, `${demo.id} needs a value line`);
    assert.ok(['synthetic', 'cached-real', 'mixed'].includes(demo.dataClass), `${demo.id} has no data class`);
    assert.equal(typeof demo.buildState, 'function');
    assert.equal(typeof demo.evaluate, 'function');
    assert.equal(typeof demo.report, 'function');
  }
  assert.ok(DEMOS.every((demo) => !demo.hidden), 'hidden demos must stay out of the catalog');
  assert.equal(new Set(ALL_DEMOS.map((demo) => demo.id)).size, ALL_DEMOS.length, 'demo ids must be unique');
});

test('catalog cards need no dataset', () => {
  for (const demo of ALL_DEMOS) {
    const card = demoCard(demo);
    assert.equal(card.id, demo.id);
    assert.ok(card.questionCount > 0);
    assert.ok(card.domainTitle);
  }
});

test('questions are typed, described and explained', () => {
  for (const demo of ALL_DEMOS) {
    for (const [name, question] of Object.entries(demo.questions)) {
      assert.ok(QUESTION_TYPES.has(question.type), `${demo.id}.${name} has type "${question.type}"`);
      assert.ok(question.instructions?.length > 10, `${demo.id}.${name} needs instructions`);
      if (question.type === 'choice') assert.ok(Object.keys(question.criteria).length >= 2, `${demo.id}.${name} needs options`);
      if (question.type === 'score') assert.ok(question.criteria.length >= 2, `${demo.id}.${name} needs a rubric`);
    }
    for (const key of ['data', 'state', 'questions', 'evaluate']) {
      assert.ok(demo.explain?.[key], `${demo.id} must explain its ${key}`);
    }
  }
});

test('each demo has a dataset, and every item has a recorded answer', async () => {
  for (const demo of ALL_DEMOS) {
    const dataset = await loadDataset(demo.id);
    assert.equal(dataset.id, demo.id);

    const fixtures = await loadFixtures(demo.id);
    const missing = dataset.items.filter((item) => !fixtures.answers?.[item.id]).map((item) => item.id);
    assert.deepEqual(missing, [], `${demo.id} has no recorded answer for ${missing.slice(0, 3).join(', ')}`);

    for (const [itemId, answers] of Object.entries(fixtures.answers)) {
      assert.ok(dataset.items.some((item) => item.id === itemId), `${demo.id} has an answer for unknown item ${itemId}`);
      assert.deepEqual(Object.keys(answers).sort(), Object.keys(demo.questions).sort(), `${demo.id} answer for ${itemId} does not match its questions`);
    }
  }
});

test('a state never carries the ground truth, and never changes the item', async () => {
  for (const demo of ALL_DEMOS) {
    const dataset = await loadDataset(demo.id);
    const context = demoContext(dataset);
    const labels = await loadLabels(demo.id).catch(() => null);
    const plantedValues = new Set((Array.isArray(labels) ? labels : Object.values(labels ?? {})).flatMap((label) => Object.values(label ?? {}).filter((value) => typeof value === 'string')));

    for (const item of dataset.items.slice(0, 5)) {
      const before = JSON.stringify(item);
      const state = demo.buildState(item, context);
      assert.equal(JSON.stringify(item), before, `${demo.id} mutated its item`);
      assert.deepEqual(demo.buildState(item, context), state, `${demo.id}.buildState is not pure`);

      const serialised = JSON.stringify(state);
      for (const value of plantedValues) {
        if (value.length < 8 || dataset.items.some((entry) => JSON.stringify(entry).includes(value))) continue;
        assert.ok(!serialised.includes(value), `${demo.id} leaked the planted value "${value}" into its state`);
      }
    }
  }
});

test('recorded answers run through evaluate and report', async () => {
  for (const demo of ALL_DEMOS) {
    const dataset = await loadDataset(demo.id);
    const fixtures = await loadFixtures(demo.id);
    const labels = await loadLabels(demo.id).catch(() => []);

    const { results, context } = await runDemo(demo, {
      dataset,
      ask: ({ item }) => ({ answers: fixtures.answers[item.id], model: fixtures.model }),
    });

    assert.equal(results.length, dataset.items.length);
    for (const result of results) assert.equal(typeof result.evaluation, 'object');

    const report = demo.report(results, { ...context, labels });
    assert.ok(Array.isArray(report.kpis) && report.kpis.length > 0, `${demo.id} report needs KPIs`);
    for (const kpi of report.kpis) assert.ok(kpi.label && kpi.value !== undefined, `${demo.id} KPI is incomplete`);
  }
});
