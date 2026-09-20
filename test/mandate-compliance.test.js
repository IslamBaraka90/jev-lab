import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/mandate-compliance/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// A compliance tool that reports everything is useless, so the near misses and the eight checks that
// turn on a reading are graded as carefully as the breaches themselves.

const dataset = await loadDataset('mandate-compliance');
const labels = await loadLabels('mandate-compliance');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.checkId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ breach, kind, severity, interpretation = false }) => ({
  breach: { type: 'noul', noul: breach ? 0.95 : 0.05 },
  breach_kind: { type: 'choice', choice: kind, confidence: 0.85, probabilities: { [kind]: 0.85 } },
  severity: { type: 'score', score: severity, confidence: 0.7, legend: {}, probabilities: {} },
  interpretation_dependent: { type: 'noul', noul: interpretation ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    breach: label.breach,
    kind: label.breach ? label.ruleKind : 'NONE',
    severity: label.breach ? 4.5 : 0.5,
    interpretation: label.kind === 'depends how you read it',
  }) };
};

test('twelve portfolios against twenty rules, with the awkward cases planted', () => {
  assert.equal(dataset.items.length, 240);
  assert.equal(ofKind('breach').length, 26);
  assert.equal(ofKind('near miss').length, 30);
  assert.equal(ofKind('depends how you read it').length, 8);
  assert.equal(ofKind('clear pass').length, 176);
  assert.equal(new Set(dataset.items.map((entry) => entry.ruleId)).size, 20);
  assert.equal(new Set(dataset.items.map((entry) => entry.portfolioId)).size, 12);
});

test('a breach is over the limit and a near miss is inside the tolerance', () => {
  for (const label of ofKind('breach')) {
    const entry = item(label.checkId);
    const over = entry.limitIsAFloor ? entry.limit - entry.measuredValue : entry.measuredValue - entry.limit;
    assert.ok(over > entry.tolerance, `${entry.id} should be past its tolerance`);
  }
  for (const label of ofKind('near miss')) {
    const entry = item(label.checkId);
    // Rounded to a hundredth, so compare at that precision rather than at floating-point precision.
    const inside = Math.round((entry.limitIsAFloor ? entry.measuredValue - entry.limit : entry.limit - entry.measuredValue) * 100) / 100;
    assert.ok(inside > 0 && inside <= entry.tolerance, `${entry.id} should sit inside the tolerance`);
  }
});

test('the reading-dependent checks come with the sentence that makes them hard', () => {
  for (const label of ofKind('depends how you read it')) {
    const entry = item(label.checkId);
    assert.ok(entry.measurementNote?.length > 60, `${entry.id} needs the note that makes it a question`);
    assert.ok(['R02', 'R11', 'R14', 'R16'].includes(entry.ruleId));
  }
});

test('the state carries the rule, the definitions and the number, and no verdict', () => {
  const state = demo.buildState(item(ofKind('breach')[0].checkId), context);

  assert.ok(state.rule.as_written.length > 30);
  assert.equal(typeof state.measurement.value, 'number');
  assert.ok(state.policy.definitions.lookThrough.length > 40);

  const serialised = JSON.stringify(state);
  for (const value of ['"breach"', 'near miss', 'depends how you read it', 'clear pass']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('a perfect run reports every breach and nothing else', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Breaches found').value, '26 of 26');
  assert.equal(kpi(report, 'Settled checks right').value, '232 of 232');
  assert.equal(kpi(report, 'Checks called a breach wrongly').value, '0 of 206', 'the eight arguable checks are not scored');
  assert.equal(kpi(report, 'Reading-dependent checks flagged').value, '8 of 8');
  assert.equal(kpi(report, 'Report a compliance officer reads').value, '26 lines');
});

test('treating the tolerance as decoration is reported as its own failure', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const over = entry.limitIsAFloor ? entry.measuredValue < entry.limit : entry.measuredValue > entry.limit;
      return { answers: answerFor({ breach: over, kind: over ? entry.ruleKind : 'NONE', severity: over ? 4 : 0.5 }) };
    },
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'near-miss').count, 0, 'a near miss is under the limit, so a bare comparison passes it');
  assert.equal(report.checks.find((check) => check.id === 'reading').count, 8, 'and it never notices that eight of them are arguable');
  assert.ok(report.findings.some((line) => /as if the policy settled it/.test(line)));
});

test('missing breaches are named in the findings', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ breach: false, kind: 'NONE', severity: 0.2 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Breaches found').value, '0 of 26');
  assert.ok(report.findings.some((line) => /did not make the report/.test(line)));
  assert.equal(report.curve.points[0].reviewed, 0);
});

test('severity sorts the report a compliance officer would read', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix, topItems } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 26);
  assert.equal(curve.points[4].caught, 26);
  assert.equal(matrix.rows.length, 2, 'breach against met, the thing the headline grades');
  assert.equal(topItems.length, 10);
});
