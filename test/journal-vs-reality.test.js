import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/journal-vs-reality/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Every drift has to be findable by reading the note against the record — no label, no hint — and the
// honest majority has to survive being read, or a journal stops being worth keeping.

const dataset = await loadDataset('journal-vs-reality');
const labels = await loadLabels('journal-vs-reality');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.entryId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const withDrift = (drift) => labels.filter((label) => label.drift === drift).map((label) => item(label.entryId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ matches, drift, honesty, after = false, rule = true }) => ({
  note_matches_trade: { type: 'noul', noul: matches ? 0.9 : 0.1 },
  drift_type: { type: 'choice', choice: drift, confidence: 0.85, probabilities: { [drift]: 0.85 } },
  note_honesty: { type: 'score', score: honesty, confidence: 0.7, legend: {}, probabilities: {} },
  written_after_the_fact: { type: 'noul', noul: after ? 0.9 : 0.1 },
  rule_followed: { type: 'noul', noul: rule ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const drift = planted.get(entry.id).drift;
  return { answers: answerFor({ matches: drift === 'NONE', drift, honesty: drift === 'NONE' ? 5.5 : 1.5, after: drift === 'RATIONALISATION' }) };
};

test('two hundred entries with five kinds of drift planted', () => {
  assert.equal(dataset.items.length, 200);
  assert.equal(withDrift('SIZE').length, 22);
  assert.equal(withDrift('ENTRY').length, 18);
  assert.equal(withDrift('EXIT').length, 14);
  assert.equal(withDrift('INSTRUMENT').length, 11);
  assert.equal(withDrift('RATIONALISATION').length, 9);
  assert.equal(withDrift('NONE').length, 126);
});

test('every drift is visible by reading the note against the record', () => {
  for (const entry of withDrift('SIZE')) {
    assert.match(entry.note, /starter/i);
    assert.equal(entry.sizeLabel, 'full', 'the note says starter and the record says full');
  }
  for (const entry of withDrift('ENTRY')) {
    assert.match(entry.note, /waited for the pullback/i);
    assert.match(entry.filledAt, /without waiting/);
  }
  for (const entry of withDrift('EXIT')) {
    assert.match(entry.note, /took profit at the target/i);
    assert.notEqual(entry.exitPrice, entry.plannedTarget);
  }
  for (const entry of withDrift('INSTRUMENT')) {
    assert.equal(entry.note.startsWith(entry.symbol), false, 'the note names another instrument');
  }
  for (const entry of withDrift('RATIONALISATION')) {
    assert.equal(entry.noteWrittenAt, 'two days later');
    assert.match(entry.note, /had decided in advance|always to/);
  }
});

test('the honest notes agree with their records', () => {
  for (const entry of withDrift('NONE')) {
    assert.equal(entry.noteWrittenAt, 'the same evening');
    assert.match(entry.filledAt, /the level in the plan/);
    assert.ok(entry.note.includes(String(entry.entryPrice)) || entry.note.includes(entry.setup));
  }
});

test('the state gives the note and the record and never the answer', () => {
  const state = demo.buildState(item(withDrift('SIZE')[0].id), context);
  assert.ok(state.journal_note.length > 40);
  assert.equal(state.trader.rules.length, 4);
  assert.equal(state.trade_record.size_against_a_full_position, 'full');
  const serialised = JSON.stringify(state);
  for (const value of ['RATIONALISATION', '"drift"', 'INSTRUMENT']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('a perfect run catches every drift and leaves the honest notes alone', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Drifting notes caught').value, '74 of 74');
  assert.equal(kpi(report, 'Drift named exactly').value, '74 of 74');
  assert.equal(kpi(report, 'Honest notes doubted').value, '0 of 126');
  assert.equal(kpi(report, 'Written after the outcome').value, '9 of 9');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
});

test('doubting everything is reported as its own failure', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ matches: false, drift: 'SIZE', honesty: 1 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'honest').count, 126);
  assert.ok(report.findings.some((line) => /stops being written/.test(line)));
});

test('believing everything loses all seventy-four', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ matches: true, drift: 'NONE', honesty: 5 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Drifting notes caught').value, '0 of 74');
  assert.ok(report.findings.some((line) => /were read as accurate/.test(line)));
});

test('the honesty score sorts the least accurate notes to the top', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix, topItems } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 74);
  assert.equal(curve.points[2].rate, 1, 'at two of six or below only the drifting notes are there');
  assert.equal(matrix.rows.length, 6);
  assert.equal(topItems.length, 10);
});
