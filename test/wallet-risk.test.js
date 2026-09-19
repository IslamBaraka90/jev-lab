import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/wallet-risk/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Two things have to be true at once: the money that should not be taken is not taken, and the large
// ordinary wallets are not refused for being large. Both are reported in dollars, not only in counts.

const dataset = await loadDataset('wallet-risk');
const labels = await loadLabels('wallet-risk');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.wallet, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ risk, exposure, decision, direct = false, consistent = true }) => ({
  risk: { type: 'score', score: risk, confidence: 0.75, legend: {}, probabilities: {} },
  main_exposure: { type: 'choice', choice: exposure, confidence: 0.8, probabilities: { [exposure]: 0.8 } },
  decision: { type: 'choice', choice: decision, confidence: 0.85, probabilities: { [decision]: 0.85 } },
  exposure_direct: { type: 'noul', noul: direct ? 0.9 : 0.1 },
  activity_consistent: { type: 'noul', noul: consistent ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    risk: label.riskBand === 'high' ? 5 : label.riskBand === 'medium' ? 2.5 : 0.5,
    exposure: label.riskBand === 'low' ? 'NONE' : label.driver,
    decision: label.riskBand === 'high' ? 'REJECT' : label.riskBand === 'medium' ? 'REVIEW' : 'ACCEPT',
    direct: label.riskBand === 'high',
  }) };
};

test('the file plants eighteen high, twenty-two medium and fourteen that only look bad', () => {
  assert.equal(dataset.items.length, 240);
  assert.equal(labels.filter((label) => label.riskBand === 'high').length, 18);
  assert.equal(labels.filter((label) => label.riskBand === 'medium').length, 22);
  assert.equal(ofKind('looks bad, is not').length, 14);
  assert.deepEqual([...new Set(labels.filter((label) => label.riskBand === 'high').map((label) => label.driver))].sort(), ['GAMBLING', 'MIXER', 'SANCTIONED_ENTITY']);
});

test('every address is invented and says so', () => {
  assert.ok(dataset.items.every((entry) => entry.address.startsWith('0xDEMO')));
  assert.match(context.note, /invented/);
  assert.ok(context.entities.every((entity) => /_[A-F]$|UNKNOWN/.test(entity.label)), 'the entity names are placeholders, not services');
});

test('the decoys are bigger than the high-risk wallets, and clean', () => {
  const decoyList = ofKind('looks bad, is not').map((label) => item(label.wallet));
  const high = labels.filter((label) => label.riskBand === 'high').map((label) => item(label.wallet));

  assert.ok(Math.min(...decoyList.map((entry) => entry.totalReceived)) > Math.max(...high.map((entry) => entry.totalReceived)) / 4, 'the decoys move serious volume');
  assert.ok(decoyList.every((entry) => entry.hopsToFlaggedEntity >= 2), 'and none of them is close to anything flagged');
});

test('the state gives the mix and the distance, and no score', () => {
  const mixer = item(labels.find((label) => label.driver === 'MIXER' && label.riskBand === 'high').wallet);
  const state = demo.buildState(mixer, context);

  assert.equal(state.distance.hops_to_the_nearest_flagged_entity, 0);
  assert.ok(state.counterparty_mix.some((entry) => entry.label === 'MIXER_A'));
  assert.ok(state.deposit_offered > 0);

  const serialised = JSON.stringify(state);
  for (const value of ['riskBand', 'planted high', 'looks bad, is not', '"driver"']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('a perfect run takes no high-risk money and refuses nothing ordinary', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'High-risk money refused or held').value, '18 of 18');
  assert.equal(kpi(report, 'Band agrees with the label').value, '100%');
  assert.match(kpi(report, 'A bar that splits the file').value, /of 6$/, 'a perfect run separates cleanly');
  assert.equal(kpi(report, 'Driver named on the high-risk wallets').value, '18 of 18');
  assert.equal(kpi(report, 'Ordinary wallets refused').value, '0 of 200');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
  assert.deepEqual(report.findings, []);
});

test('refusing the biggest wallets is reported in dollars', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const big = entry.totalReceived > 500_000;
      return { answers: answerFor({ risk: big ? 5 : 1, exposure: big ? 'BRIDGE' : 'NONE', decision: big ? 'REJECT' : 'ACCEPT' }) };
    },
  });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.checks.find((check) => check.id === 'decoys').count >= 8, 'the market makers and relayers go first');
  assert.ok(report.findings.some((line) => /Size is not exposure/.test(line)));
  assert.match(kpi(report, 'Ordinary wallets refused').context, /\$[\d,]+ of ordinary deposits turned away/);
});

test('accepting everything is priced in the money it lets through', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ risk: 0.5, exposure: 'NONE', decision: 'ACCEPT' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'High-risk money refused or held').value, '0 of 18');
  assert.match(kpi(report, 'High-risk money refused or held').context, /would have been taken/);
  assert.ok(report.findings.some((line) => /high-risk deposits were accepted/.test(line)));
});

test('the report says when no single number separates the file', async () => {
  // Every wallet scored the same: there is no bar, and the report must not pretend there is one.
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ risk: 3, exposure: 'NONE', decision: 'REVIEW' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'A bar that splits the file').value, 'none');
  assert.match(kpi(report, 'A bar that splits the file').context, /score at or above the lowest high-risk wallet/);
});

test('the grade bar holds fewer wallets and a denser set of them', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 18);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points[4].rate, 1, 'at a grade of four only the high-risk wallets are left');
  assert.equal(matrix.rows.length, 3);
});
