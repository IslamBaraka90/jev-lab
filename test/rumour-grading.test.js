import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/rumour-grading/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The pair this demo lives or dies on: fourteen coordinated pushes and twelve claims that spread just
// as fast organically. Reach and speed cannot tell them apart, so the wording has to.

const dataset = await loadDataset('rumour-grading');
const labels = await loadLabels('rumour-grading');
const context = { ...demoContext(dataset), labels };
const label = (id) => labels.find((entry) => entry.claimId === id);
const item = (id) => dataset.items.find((entry) => entry.id === id);
// The figures that do not fit the KPI strip sit under it, in the same shape.
const kpi = (report, name) => [...report.kpis, ...report.alsoMeasured].find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ reliability = 3, corroborated = false, coordinated = false, checkable = false, disposition = 'WATCH' }) => ({
  source_reliability: { type: 'score', score: reliability, confidence: 0.7, legend: {}, probabilities: {} },
  corroborated: { type: 'noul', noul: corroborated ? 0.9 : 0.1 },
  coordinated_push: { type: 'noul', noul: coordinated ? 0.9 : 0.1 },
  checkable: { type: 'noul', noul: checkable ? 0.9 : 0.1 },
  disposition: { type: 'choice', choice: disposition, confidence: 0.75, probabilities: { [disposition]: 0.75 } },
});

test('two hundred and forty claims, planted as the brief says', () => {
  assert.equal(dataset.items.length, 240);
  const outcomes = {};
  const spreads = {};
  for (const entry of labels) {
    outcomes[entry.outcome] = (outcomes[entry.outcome] ?? 0) + 1;
    spreads[entry.spread] = (spreads[entry.spread] ?? 0) + 1;
  }
  assert.deepEqual(outcomes, { CONFIRMED: 22, DENIED: 38, UNRESOLVED: 180 });
  assert.equal(spreads.COORDINATED, 14);
  assert.equal(spreads.VIRAL, 12);
  assert.equal(labels.filter((entry) => entry.checkable).length, 9);
});

test('coordination is detectable from the wording and nothing else', () => {
  const values = (spread, field) => labels.filter((entry) => entry.spread === spread).map((entry) => item(entry.claimId)[field]);
  const pushes = values('COORDINATED', 'wordingSharedPercent');
  const viral = values('VIRAL', 'wordingSharedPercent');

  // The wording separates cleanly.
  assert.ok(Math.min(...pushes) > Math.max(...viral), 'shared wording must tell the two apart on its own');

  // Reach and speed do not, which is the point of having the organic group at all.
  const overlap = (left, right) => Math.min(...left) <= Math.max(...right) && Math.min(...right) <= Math.max(...left);
  assert.ok(overlap(values('COORDINATED', 'accountsRepeatingIt'), values('VIRAL', 'accountsRepeatingIt')), 'reach must overlap');
  assert.ok(overlap(values('COORDINATED', 'minutesForThoseRepeats'), values('VIRAL', 'minutesForThoseRepeats')), 'speed must overlap');
});

test('coordination does not decide the outcome', () => {
  const pushes = labels.filter((entry) => entry.coordinated);
  assert.ok(pushes.some((entry) => entry.outcome === 'CONFIRMED'), 'a pushed claim can still be true');
  assert.ok(pushes.filter((entry) => entry.outcome === 'DENIED').length >= 8, 'and mostly is not');
});

test('a cited document is really there, and nowhere else', () => {
  for (const entry of labels) {
    const claim = item(entry.claimId);
    assert.equal(Boolean(claim.citedDocument), entry.checkable, `${entry.claimId} disagrees with its label about citing anything`);
  }
});

test('the state carries the evidence and never the outcome', () => {
  const state = demo.buildState(item(labels.find((entry) => entry.outcome === 'CONFIRMED').claimId), context);
  assert.ok(state.how_it_spread.percent_of_wording_they_share >= 0);
  assert.ok(state.source.claims_made_before > 0);

  const serialised = JSON.stringify(state);
  for (const planted of ['CONFIRMED', 'DENIED', 'UNRESOLVED', 'COORDINATED', 'VIRAL']) {
    assert.equal(serialised.includes(planted), false, `the state must not carry ${planted}`);
  }
});

test('grading everything right reads as right', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const row = label(entry.id);
      return { answers: answerFor({
        reliability: row.outcome === 'CONFIRMED' ? 5 : row.outcome === 'DENIED' ? 1 : 3,
        coordinated: row.coordinated,
        checkable: row.checkable,
        disposition: row.outcome === 'CONFIRMED' ? 'ACT_WORTHY' : row.outcome === 'DENIED' ? 'IGNORE' : 'WATCH',
      }) };
    },
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Confirmed claims ignored').value, '0 of 22');
  assert.equal(kpi(report, 'Denied claims called act-worthy').value, '0 of 38');
  assert.equal(kpi(report, 'Coordinated pushes caught').value, '14 of 14');
  assert.equal(kpi(report, 'Organic spread called organised').value, '0 of 12');
  assert.equal(kpi(report, 'Checkable claims spotted').value, '9 of 9');
  assert.equal(kpi(report, 'Reliability gap, true against false').value, '4.0');
});

test('the expensive miss is reported on its own', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ disposition: 'IGNORE', reliability: 1 }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Confirmed claims ignored').value, '22 of 22');
  assert.equal(kpi(report, 'Confirmed claims ignored').tone, 'warn');
  assert.equal(check(report, 'ignored').count, 22);
  assert.ok(report.findings.some((line) => /expensive error/.test(line)));
});

test('trusting a falsehood is reported separately from ignoring a truth', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ disposition: 'ACT_WORTHY', reliability: 6 }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Confirmed claims ignored').value, '0 of 22');
  assert.equal(kpi(report, 'Denied claims called act-worthy').value, '38 of 38');
  assert.equal(check(report, 'trusted').count, 38);
  assert.ok(report.findings.some((line) => /never resolved either way were graded act-worthy/.test(line)));
});

test('calling every fast-spreading claim organised is caught', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ coordinated: entry.accountsRepeatingIt >= 26 }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Coordinated pushes caught').value, '14 of 14');
  assert.equal(kpi(report, 'Organic spread called organised').value, '12 of 12');
  assert.equal(kpi(report, 'Organic spread called organised').tone, 'warn');
  assert.ok(report.findings.some((line) => /graded much alike/.test(line)));
});

test('a disposition nobody used is called out', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ disposition: 'WATCH' }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Sent to somebody to check').value, '0 of 240');
  assert.ok(report.findings.some((line) => /went unused across all 240 claims/.test(line)));
});

test('the cost of checking is reported against what the checks found', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ disposition: 'VERIFY' }) }) });
  const report = demo.report(results, context);
  const sent = kpi(report, 'Sent to somebody to check');

  assert.equal(sent.value, '240 of 240');
  assert.equal(sent.tone, 'warn');
  assert.match(sent.context, /22 of those turned out true and 38 turned out false/);
  assert.ok(report.findings.some((line) => /turned out to be false/.test(line)));
});

test('the calibration curve is built on the resolved claims only', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ reliability: label(entry.id).outcome === 'CONFIRMED' ? 6 : 0 }) }),
  });
  const { curve } = demo.report(results, context);

  assert.equal(curve.points[0].reviewed, 60, 'a hundred and eighty never resolved and are not in it');
  assert.equal(curve.points.at(-1).rate, 1);
  assert.ok(curve.points[0].rate < curve.points.at(-1).rate);
});
