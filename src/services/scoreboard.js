// Scoring a recorded run without the browser: the same evaluate, grade and report code the page
// uses, reduced to one row per demo. The scoreboard page, the run history and the gates in
// `npm run check` all read what this produces, so a number on the site is a number CI has seen.

import { createHash } from 'node:crypto';
import { agreement, matrixStats, reliability } from '../../demos/lib/metrics.js';
import { loadDataset, loadLabels } from './dataset.js';
import { demoContext, fixtureAnswers, loadFixtures } from './demo-runner.js';
import { humaniseKey, humaniseValue } from '../../web/src/lib/humanise.js';

const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 12);
const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

/** Everything a demo's recorded run evaluates to: results, grades and the report. */
export async function evaluateRun(demo) {
  const dataset = await loadDataset(demo.id);
  const context = demoContext(dataset);
  const labels = await loadLabels(demo.id).catch(() => []);
  const fixtures = await loadFixtures(demo.id);

  const results = [];
  for (const item of dataset.items) {
    const answers = fixtureAnswers(fixtures, demo.questions, item.id);
    if (answers) results.push({ item, answers, evaluation: demo.evaluate(answers, item, context) });
  }

  const grades = [];
  if (demo.grade?.judge) {
    const idOf = demo.grade.labelId ?? ((label) => label.id ?? label.itemId);
    const byId = Array.isArray(labels) ? new Map(labels.map((label) => [idOf(label), label])) : new Map(Object.entries(labels ?? {}));
    for (const result of results) {
      const grade = demo.grade.judge(result, byId.get(result.item.id) ?? null, { ...context, labels });
      if (grade) grades.push({ id: result.item.id, ...grade });
    }
  }

  const report = results.length ? demo.report(results, { ...context, labels }) : null;
  return { dataset, context, fixtures, results, grades, report };
}

/**
 * One scoreboard row. `dataset` and `questions` are content hashes: two runs are only comparable when
 * both match, because a changed dataset or a reworded question is a different test.
 */
export async function scoreDemo(demo) {
  const run = await evaluateRun(demo);
  const { dataset, fixtures, results, grades, report } = run;
  const stats = report?.matrix ? matrixStats(report.matrix) : null;
  const graded = agreement(grades);
  const calibration = reliability(grades);
  const headlineKpi = report?.kpis?.[0] ?? null;

  const metrics = {
    agreement: round(graded.share),
    accuracy: round(stats?.accuracy),
    macroF1: round(stats?.macroF1),
    majorityBaseline: round(stats?.majorityBaseline),
    calibrationError: round(calibration?.ece),
    ...Object.fromEntries(Object.entries(report?.metrics ?? {}).filter(([key]) => key !== 'headline').map(([key, value]) => [key, round(value)])),
  };

  const gates = Object.entries(demo.gates ?? {}).map(([metric, rule]) => {
    const value = metrics[metric];
    const passed = Number.isFinite(value) && (rule.min === undefined || value >= rule.min) && (rule.max === undefined || value <= rule.max);
    return { metric, ...rule, value: value ?? null, passed };
  });

  return {
    id: demo.id,
    title: demo.title,
    domain: demo.domain,
    number: demo.present?.number ?? null,
    dataClass: demo.dataClass,
    run: { model: fixtures.model ?? null, recordedAt: fixtures.recordedAt ?? null, dataset: hash(dataset.items), questions: hash(demo.questions) },
    items: dataset.items.length,
    answered: results.length,
    graded: graded.graded,
    right: graded.right,
    interval: graded.graded ? { low: round(graded.interval.low), high: round(graded.interval.high) } : null,
    headline: report?.metrics?.headline
      ? { label: report.metrics.headline.label, value: round(report.metrics.headline.value), display: headlineKpi?.value ?? null, context: headlineKpi?.context ?? null }
      : headlineKpi
        ? { label: headlineKpi.label, value: null, display: String(headlineKpi.value), context: headlineKpi.context ?? null }
        : null,
    baselines: (report?.baselines ?? []).map((row) => ({ label: row.label, value: round(row.value), model: Boolean(row.model) })),
    metrics,
    gates,
    passed: gates.every((gate) => gate.passed),
    finding: report?.findings?.[0] ?? null,
    caveat: demo.caveat ?? null,
    showcase: showcaseOf(demo, run),
  };
}

/** The key two rows must share to be the same test on the same model run. */
export const runKey = (row) => `${row.run.model}|${row.run.recordedAt}|${row.run.dataset}|${row.run.questions}`;

/** One answer in a few words: the option, the rubric level, or yes and no, with how sure it was. */
function summariseAnswer(key, answer, question) {
  const title = question?.title ?? humaniseKey(key);
  if (answer.type === 'choice') return { title, type: 'choice', text: humaniseValue(answer.choice), share: round(answer.probabilities?.[answer.choice] ?? answer.confidence ?? 0, 3) };
  if (answer.type === 'score') {
    const top = Object.keys(answer.legend ?? {}).length - 1;
    return { title, type: 'score', text: `${answer.legend?.[Math.round(answer.score)] ?? answer.score.toFixed(1)} · ${answer.score.toFixed(1)} of ${top}`, share: round(top ? answer.score / top : 0, 3) };
  }
  return { title, type: 'yes / no', text: answer.noul >= 0.5 ? 'Yes' : 'No', share: round(answer.noul, 3) };
}

/**
 * One real item with its answers and the decision they made, small enough for the home page to carry
 * without loading a dataset. It is the demo's own hero item where it names one.
 */
function showcaseOf(demo, { context, results, grades }) {
  const wanted = demo.present?.hero?.item;
  const right = grades.find((grade) => grade.agree)?.id;
  const result = results.find((entry) => entry.item.id === wanted) ?? results.find((entry) => entry.item.id === right) ?? results[0];
  if (!result) return null;
  const keys = (demo.present?.answers?.reveal?.length ? demo.present.answers.reveal : Object.keys(demo.questions)).slice(0, 4);
  const verdict = demo.verdict?.(result, context) ?? null;
  const grade = grades.find((entry) => entry.id === result.item.id) ?? null;
  return {
    item: result.item.id,
    label: demo.itemLabel?.(result.item) ?? result.item.id,
    caption: demo.present?.hero?.caption ?? null,
    answers: keys.filter((key) => result.answers[key]).map((key) => summariseAnswer(key, result.answers[key], demo.questions[key])),
    verdict: verdict?.headline ?? result.evaluation?.label ?? null,
    agree: grade ? grade.agree : null,
  };
}
