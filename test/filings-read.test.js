import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/filings-read/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// This one is graded on two things that average away if you let them: a new risk near the top against
// the same risk buried, and numbers that beat while the language gets worse.

const dataset = await loadDataset('filings-read');
const labels = await loadLabels('filings-read');
const context = { ...demoContext(dataset), labels };
const label = (id) => labels.find((entry) => entry.documentId === id);
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, name) => report.kpis.find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ guidance = 'NOT_MENTIONED', tone = 3, newRisk = false, insider = false, agree = true }) => ({
  guidance_change: { type: 'choice', choice: guidance, confidence: 0.8, probabilities: { [guidance]: 0.8 } },
  tone_shift: { type: 'score', score: tone, confidence: 0.7, legend: {}, probabilities: {} },
  new_risk_factor: { type: 'noul', noul: newRisk ? 0.9 : 0.1 },
  insider_transaction_significant: { type: 'noul', noul: insider ? 0.9 : 0.1 },
  numbers_and_tone_agree: { type: 'noul', noul: agree ? 0.9 : 0.1 },
});

test('ninety documents, planted as the brief says', () => {
  assert.equal(dataset.items.length, 90);
  const kinds = {};
  const guidance = {};
  for (const entry of labels) {
    kinds[entry.kind] = (kinds[entry.kind] ?? 0) + 1;
    guidance[entry.guidance] = (guidance[entry.guidance] ?? 0) + 1;
  }
  assert.deepEqual(kinds, { RESULTS: 30, RISKS: 30, CALL: 30 });
  assert.deepEqual(guidance, { RAISED: 18, CUT: 14, MAINTAINED: 22, WITHDRAWN: 6, NOT_MENTIONED: 30 });
  assert.equal(labels.filter((entry) => entry.beatButWorse).length, 12);
  assert.equal(labels.filter((entry) => entry.newRisk === 'BURIED').length, 9);
  assert.equal(labels.filter((entry) => entry.insider === 'SIGNIFICANT').length, 3);
  assert.equal(labels.filter((entry) => entry.insider === 'ROUTINE').length, 2);
});

test('a buried new risk really is buried, and really is new', () => {
  const lines = (text) => text.split('\n').filter((line) => /^\d+\./.test(line)).map((line) => line.replace(/^\d+\.\s*/, ''));

  for (const entry of labels.filter((row) => row.newRisk !== 'NONE')) {
    const document = item(entry.documentId);
    const now = lines(document.text);
    const before = lines(document.priorPeriod);
    const fresh = now.filter((line) => !before.includes(line));

    assert.equal(fresh.length, 1, `${entry.documentId} should carry exactly one new risk`);
    const at = now.indexOf(fresh[0]) / now.length;
    if (entry.newRisk === 'BURIED') assert.ok(at >= 0.55, `${entry.documentId} is at ${at.toFixed(2)} of the way down, which is not buried`);
    else assert.ok(at <= 0.2, `${entry.documentId} should be near the top`);
  }
});

test('a risk section with nothing new really has nothing new', () => {
  const lines = (text) => text.split('\n').filter((line) => /^\d+\./.test(line)).map((line) => line.replace(/^\d+\.\s*/, ''));
  for (const entry of labels.filter((row) => row.kind === 'RISKS' && row.newRisk === 'NONE')) {
    const document = item(entry.documentId);
    assert.deepEqual(lines(document.text), lines(document.priorPeriod), `${entry.documentId} should be the same list twice`);
  }
});

test('the beat-but-worse documents really do beat', () => {
  for (const entry of labels.filter((row) => row.beatButWorse)) {
    const text = item(entry.documentId).text;
    const [, revenue, prior] = text.match(/Revenue of ([\d.]+) million, against ([\d.]+) million/);
    assert.ok(Number(revenue) > Number(prior), `${entry.documentId} should have grown`);
    assert.match(text, /order book at the period end was lower/);
  }
});

test('a guidance range never contradicts the sentence around it', () => {
  const figure = (text) => {
    const match = text.match(/between ([\d,]+) and ([\d,]+) million/);
    return match ? Number(match[2].replace(/,/g, '')) : null;
  };

  for (const entry of labels.filter((row) => ['RAISED', 'CUT'].includes(row.guidance))) {
    const document = item(entry.documentId);
    const now = figure(document.text);
    const was = document.priorPeriod ? figure(document.priorPeriod) : null;
    if (now === null || was === null) continue;
    if (entry.guidance === 'RAISED') assert.ok(now > was, `${entry.documentId} says raised and prints a lower range`);
    else assert.ok(now < was, `${entry.documentId} says cut and prints a higher range`);
  }
});

test('nothing real is named, and no label reaches the state', () => {
  const serialised = JSON.stringify(dataset);
  for (const name of ['Apple', 'Nvidia', 'Microsoft', 'Pfizer', 'Tesco']) assert.equal(serialised.includes(name), false);
  assert.match(context.note, /invented/);

  const state = demo.buildState(item(labels.find((row) => row.newRisk === 'BURIED').documentId), context);
  for (const planted of ['BURIED', 'OBVIOUS', 'SIGNIFICANT', 'beatButWorse']) {
    assert.equal(JSON.stringify(state).includes(planted), false, `the state must not carry ${planted}`);
  }
});

test('reading every document correctly scores as correct', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const row = label(entry.id);
      return { answers: answerFor({ guidance: row.guidance, tone: row.toneShift, newRisk: row.newRisk !== 'NONE', insider: row.insider === 'SIGNIFICANT', agree: !row.beatButWorse }) };
    },
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Guidance read correctly').value, '90 of 90');
  assert.equal(kpi(report, 'New risk found, buried').value, '9 of 9');
  assert.equal(kpi(report, 'Numbers beat, tone dropped').value, '12 of 12');
  assert.equal(kpi(report, 'Insider sale that mattered').value, '3 of 3');
  assert.equal(kpi(report, 'Tone off by').value, '0.00 points');
  assert.equal(check(report, 'buried').count, 0);
});

test('the buried risks are scored apart from the obvious ones', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ newRisk: label(entry.id).newRisk === 'OBVIOUS' }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'New risk found, near the top').value, '8 of 8');
  assert.equal(kpi(report, 'New risk found, buried').value, '0 of 9');
  assert.equal(check(report, 'buried').count, 9);
  assert.ok(report.findings.some((line) => /Position in the list is doing work/.test(line)));
});

test('claiming a new risk where the list is unchanged is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ newRisk: true }) }) });
  const report = demo.report(results, context);

  assert.equal(check(report, 'phantom').count, 13, 'the risk sections with nothing new in them');
  assert.ok(report.findings.some((line) => /read as different/.test(line)));
});

test('a withdrawal read as a cut is called out', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ guidance: label(entry.id).guidance === 'WITHDRAWN' ? 'CUT' : label(entry.id).guidance }) }),
  });
  const report = demo.report(results, context);

  assert.equal(check(report, 'withdrawn').count, 6);
  assert.ok(report.findings.some((line) => /withdrawals were read as cuts/.test(line)));
  assert.equal(report.matrix.rows.find((row) => row.label === 'Withdrawn').cells.find((cell) => cell.predicted === 'CUT').count, 6);
});

test('the strength behind an insider answer is reported, not just the yes', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const row = label(entry.id);
      const answers = answerFor({ insider: row.insider !== 'NONE' });
      if (row.insider === 'ROUTINE') answers.insider_transaction_significant.noul = 0.55;
      return { answers };
    },
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'How hard it leaned on that').value, '0.90 against 0.55');
  assert.equal(kpi(report, 'How hard it leaned on that').tone, 'good');
  assert.ok(report.findings.some((line) => /a yes-or-no question throws that away/.test(line)));
});

test('the page says what a document costs to read', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({}) }) });
  const report = demo.report(results, context);
  const cost = kpi(report, 'What a document costs');

  assert.match(cost.value, /^[\d,]+ characters$/);
  assert.ok(Number(cost.value.replace(/[^\d]/g, '')) > 1000, 'a filing is not a tweet');
  assert.match(cost.context, /the longest is/);
});
