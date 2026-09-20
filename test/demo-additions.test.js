import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMOS } from '../demos/index.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, fixtureAnswers, loadFixtures } from '../src/services/demo-runner.js';

// The optional parts of the demo contract (docs/demo-contract-additions.md). A demo may leave any of
// them out; one that supplies them has to supply them properly, because the page trusts them.

const TONES = new Set(['good', 'warn', 'bad', undefined]);
const CHARTS = new Set(['curve', 'matrix', 'baselines', 'distribution', 'calibration']);

async function runOf(demo) {
  const dataset = await loadDataset(demo.id);
  const context = demoContext(dataset);
  const labels = await loadLabels(demo.id).catch(() => []);
  const fixtures = await loadFixtures(demo.id);
  const results = [];
  for (const item of dataset.items) {
    const answers = fixtureAnswers(fixtures, demo.questions, item.id);
    if (answers) results.push({ item, answers, evaluation: demo.evaluate(answers, item, context) });
  }
  return { dataset, context, labels, results };
}

function gradesOf(demo, run) {
  if (!demo.grade?.judge) return new Map();
  const idOf = demo.grade.labelId ?? ((label) => label.id ?? label.itemId);
  const byId = Array.isArray(run.labels) ? new Map(run.labels.map((label) => [idOf(label), label])) : new Map(Object.entries(run.labels ?? {}));
  const grades = new Map();
  for (const result of run.results) {
    const grade = demo.grade.judge(result, byId.get(result.item.id) ?? null, { ...run.context, labels: run.labels });
    if (grade) grades.set(result.item.id, grade);
  }
  return grades;
}

for (const demo of DEMOS) {
  test(`${demo.id}: optional contract fields are well formed`, async () => {
    const run = await runOf(demo);
    const report = demo.report(run.results, { ...run.context, labels: run.labels });
    const itemKeys = new Set(run.dataset.items.flatMap((item) => Object.keys(item)));

    if (demo.stage) {
      for (const key of [...(demo.stage.hide ?? []), ...(demo.stage.highlight ?? [])]) {
        assert.equal(typeof key, 'string', `${demo.id}.stage lists a non-string field`);
      }
      assert.ok((demo.stage.highlight ?? []).length <= 4, `${demo.id}.stage highlights more than four fields`);
      for (const key of demo.stage.highlight ?? []) assert.ok(itemKeys.has(key) || run.dataset.items.some((item) => JSON.stringify(item).includes(`"${key}"`)), `${demo.id}.stage highlights "${key}", which no item has`);
    }

    const grades = gradesOf(demo, run);
    if (demo.grade) {
      assert.equal(typeof demo.grade.judge, 'function', `${demo.id}.grade needs a judge`);
      assert.ok(grades.size > 0, `${demo.id}.grade graded nothing: check labelId`);
      for (const [id, grade] of grades) {
        assert.equal(typeof grade.agree, 'boolean', `${demo.id} grade for ${id} has no boolean agree`);
        if (grade.confidence !== undefined) assert.ok(grade.confidence >= 0 && grade.confidence <= 1, `${demo.id} grade for ${id} has confidence ${grade.confidence}`);
      }
    }

    if (demo.verdict) {
      for (const result of run.results.slice(0, 25)) {
        const verdict = demo.verdict(result, run.context);
        assert.ok(verdict?.headline?.length > 2, `${demo.id}.verdict needs a headline for ${result.item.id}`);
        assert.ok(Array.isArray(verdict.facts) && verdict.facts.length <= 8, `${demo.id}.verdict facts must be a short list`);
        for (const fact of verdict.facts) {
          assert.ok(fact.label && fact.value !== undefined && fact.value !== null, `${demo.id}.verdict has an empty fact`);
          assert.ok(TONES.has(fact.tone), `${demo.id}.verdict uses tone "${fact.tone}"`);
          assert.doesNotMatch(String(fact.value), /undefined|NaN|\[object/, `${demo.id}.verdict fact "${fact.label}" renders as ${fact.value}`);
        }
      }
    }

    if (report.baselines) {
      assert.ok(report.baselines.filter((row) => row.model).length === 1, `${demo.id}.baselines must mark exactly one row as the model`);
      for (const row of report.baselines) assert.ok(row.label && Number.isFinite(row.value), `${demo.id}.baselines has a row without a label or a value`);
    }

    if (report.metrics) {
      assert.ok(report.metrics.headline?.label && Number.isFinite(report.metrics.headline.value), `${demo.id}.metrics needs a headline with a label and a value`);
      for (const [key, value] of Object.entries(report.metrics)) {
        if (key !== 'headline') assert.ok(value === null || Number.isFinite(value), `${demo.id}.metrics.${key} is not a number`);
      }
    }

    if (demo.present) {
      const ids = new Set(run.dataset.items.map((item) => item.id));
      const { problem, hero, answers, miss, proof } = demo.present;
      assert.ok(Number.isInteger(demo.present.number), `${demo.id}.present needs its PRP number`);
      assert.ok(problem?.headline && problem?.stat && problem?.statLabel, `${demo.id}.present.problem is incomplete`);
      assert.ok(ids.has(hero?.item), `${demo.id}.present.hero names item "${hero?.item}", which does not exist`);
      assert.ok(ids.has(miss?.item), `${demo.id}.present.miss names item "${miss?.item}", which does not exist`);
      assert.ok(hero.caption && miss.caption && answers?.caption && proof?.closing, `${demo.id}.present is missing a caption`);
      for (const key of answers.reveal ?? []) assert.ok(demo.questions[key], `${demo.id}.present reveals unknown question "${key}"`);
      assert.ok(CHARTS.has(proof.chart), `${demo.id}.present.proof.chart is "${proof.chart}"`);
      const kpiLabels = new Set((report.kpis ?? []).map((kpi) => kpi.label));
      assert.ok(proof.kpis?.length >= 1 && proof.kpis.length <= 3, `${demo.id}.present.proof needs one to three KPIs`);
      for (const label of proof.kpis) assert.ok(kpiLabels.has(label), `${demo.id}.present.proof names KPI "${label}", which the report does not have`);
      if (proof.chart === 'curve') assert.ok(report.curve, `${demo.id}.present asks for a curve the report does not have`);
      if (proof.chart === 'matrix') assert.ok(report.matrix, `${demo.id}.present asks for a matrix the report does not have`);
      if (proof.chart === 'baselines') assert.ok(report.baselines, `${demo.id}.present asks for baselines the report does not have`);
      if (proof.chart === 'calibration') assert.ok(grades.size >= 10, `${demo.id}.present asks for calibration without per-item grades`);
      if (grades.size) {
        if (grades.has(hero.item)) assert.equal(grades.get(hero.item).agree, true, `${demo.id}.present.hero should be an item the model got right`);
      }
      for (const text of [problem.headline, hero.caption, answers.caption, miss.caption, proof.closing]) {
        assert.doesNotMatch(text, /!|\b(powerful|seamless|leverage|unlock|revolution|game.chang)/i, `${demo.id}.present copy reads as marketing: "${text}"`);
      }
    }
  });
}
