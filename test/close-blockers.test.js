import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/close-blockers/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Two things decide whether this demo is worth anything: the six supported accounts have to survive
// the run without being flagged, and the report has to say who owns each blocker, not just that one
// exists. Both are graded against labels that never reach the model.

const dataset = await loadDataset('close-blockers');
const labels = await loadLabels('close-blockers');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.accountId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const outsideExpected = (entry) => entry.movement > entry.expectedMovementHigh || entry.movement < entry.expectedMovementLow;
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label).value;

const answerFor = (blocker, { blocks, severity, owner }) => ({
  blocker_type: { type: 'choice', choice: blocker, confidence: 0.9, probabilities: { [blocker]: 0.9 } },
  blocks_close: { type: 'noul', noul: blocks ? 0.95 : 0.05 },
  severity: { type: 'score', score: severity, confidence: 0.7, legend: {}, probabilities: {} },
  owner: { type: 'choice', choice: owner, confidence: 0.8, probabilities: { [owner]: 0.8 } },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  const blocks = label.kind === 'blocker';
  return { answers: answerFor(label.blocker, { blocks, severity: blocks ? 4.5 : 0.5, owner: label.expectedOwner }) };
};

test('the dataset plants thirteen blockers, six decoys and the rest ordinary', () => {
  assert.equal(dataset.items.length, 60);
  assert.equal(ofKind('blocker').length, 13);
  assert.equal(ofKind('decoy').length, 6);
  assert.equal(ofKind('clean').length, 41);

  const byType = (type) => labels.filter((label) => label.blocker === type).length;
  assert.deepEqual([byType('UNRECONCILED'), byType('MISSING_ACCRUAL'), byType('INTERCOMPANY'), byType('FX_REVALUATION'), byType('UNSUPPORTED_JOURNAL')], [4, 3, 2, 2, 2]);
  assert.equal(new Set(labels.map((label) => label.expectedOwner)).size, 5, 'every team owns something');
});

test('an unusual movement is not the same thing as a blocker', () => {
  const unusual = dataset.items.filter(outsideExpected);
  const real = unusual.filter((entry) => planted.get(entry.id).kind === 'blocker');

  assert.equal(unusual.length, 14);
  assert.equal(real.length, 9, 'a movement threshold alone would be right nine times in fourteen');
  assert.ok(ofKind('blocker').some((label) => !outsideExpected(item(label.accountId))), 'some blockers move normally and only the note gives them away');
});

test('the state carries the account, the calendar and the note, and no answer', () => {
  const state = demo.buildState(item('TB-2920'), context);

  assert.equal(state.account.code, '2920');
  assert.equal(state.account.expected_movement.high, item('TB-2920').expectedMovementHigh);
  assert.match(state.account.preparer_note, /bank feed/);
  assert.equal(state.close.deadline_working_day, 6);
  assert.equal(state.close.materiality, 25_000);

  // The teams live in the owner question's options, never in the state, and no label text appears.
  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('TREASURY'), false);
  assert.equal(serialised.includes('UNRECONCILED'), false);
  assert.equal(serialised.includes('blocker'), false);
});

test('an account with no note says so rather than showing an empty field', () => {
  const blank = dataset.items.find((entry) => entry.preparerNote === '');
  assert.ok(blank, 'the file should contain accounts nobody wrote a note for');
  assert.equal(demo.buildState(blank, context).account.preparer_note, '(the preparer left no note)');
});

test('a perfect run finds every blocker, leaves the supported accounts alone, and says so honestly', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Blockers found'), '13 of 13');
  assert.equal(kpi(report, 'Supported accounts left alone'), '6 of 6');
  assert.equal(kpi(report, 'Owner agreement'), '100%');
  assert.equal(kpi(report, 'Close readiness'), '78.3%', '47 of 60 accounts are ready, and that is not 78%');
  assert.equal(kpi(report, 'Readiness after the top five'), '86.7%');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(report.findings, [], 'nothing to explain when every account was read right');
});

test('flagging every unusual movement fails on the supported accounts', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor(outsideExpected(entry) ? 'UNRECONCILED' : 'NONE', { blocks: outsideExpected(entry), severity: outsideExpected(entry) ? 4 : 0, owner: 'CONTROLLER' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'decoys').count, 5, 'five of the six supported accounts move outside their range');
  assert.equal(report.checks.find((check) => check.id === 'false-blocks').count, 0, 'ordinary accounts move as expected');
  assert.ok(report.findings.some((line) => /supported accounts/.test(line)), 'the report names the supported accounts it flagged');
  assert.notEqual(kpi(report, 'Blockers found'), '13 of 13');
});

test('an account held back but called NONE is not a blocker the model found', async () => {
  // What the recorded run actually did on three of the supported accounts: name the blocker type
  // right, and still say the close cannot go ahead. That is not a catch, and it must not count as one.
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = planted.get(entry.id);
      const blocks = label.kind !== 'clean';
      return { answers: answerFor(label.blocker, { blocks, severity: blocks ? 4 : 0.5, owner: label.expectedOwner }) };
    },
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Blockers found'), '13 of 13', 'the six supported accounts are not blockers, whatever was said about them');
  assert.equal(kpi(report, 'Supported accounts left alone'), '0 of 6');
  assert.equal(report.checks.find((check) => check.id === 'decoys').count, 6);
});

test('the severity bar trades workload against how much of the queue is real', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = planted.get(entry.id);
      const blocks = label.kind !== 'clean';
      return { answers: answerFor(label.blocker, { blocks, severity: label.kind === 'blocker' ? 5 : 2, owner: label.expectedOwner }) };
    },
  });
  const { curve } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 13);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed, 'a higher bar opens fewer accounts');
  }
  assert.equal(curve.points[0].reviewed, 19);
  assert.ok(curve.points[3].rate > curve.points[0].rate, 'raising the bar drops the supported accounts out of the queue first');
  assert.equal(curve.points.at(-1).rate, null, 'an empty queue has no rate, and is not reported as zero');
});

test('the owner lanes account for every blocked item', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  const blocked = results.filter((result) => result.evaluation.blocks).length;
  const lanes = report.distribution.filter((entry) => entry.label !== 'Cleared');

  assert.equal(lanes.reduce((sum, entry) => sum + entry.count, 0), blocked);
  assert.equal(report.distribution.find((entry) => entry.label === 'Cleared').count, 60 - blocked);
  assert.equal(report.topItems.length, 10);
});

test('the confusion matrix covers every blocker type and stays on the diagonal when correct', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 6);
  assert.equal(matrix.columns.length, 6);
  for (const row of matrix.rows) {
    for (const cell of row.cells) if (!cell.diagonal) assert.equal(cell.count, 0);
  }
});
