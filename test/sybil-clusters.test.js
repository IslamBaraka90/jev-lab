import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/sybil-clusters/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Excluding a real user costs more than excluding a farmed wallet saves, so both sides are graded in
// money. The state counts the crowd and never names it, which is what makes this a judgement.

const dataset = await loadDataset('sybil-clusters');
const labels = await loadLabels('sybil-clusters');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.wallet, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ likelihood, signal, exclude, independent = true }) => ({
  sybil_likelihood: { type: 'score', score: likelihood, confidence: 0.75, legend: {}, probabilities: {} },
  linking_signal: { type: 'choice', choice: signal, confidence: 0.8, probabilities: { [signal]: 0.8 } },
  exclude_from_allocation: { type: 'noul', noul: exclude ? 0.9 : 0.1 },
  independent_user: { type: 'noul', noul: independent ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  const farmed = Boolean(label.clusterId);
  return { answers: answerFor({ likelihood: farmed ? 5.5 : 0.5, signal: label.linkingSignal, exclude: farmed, independent: !farmed }) };
};

test('eight clusters are planted, each around one careless signal', () => {
  assert.equal(dataset.items.length, 150);
  assert.equal(ofKind('farmed').length, 62);
  assert.equal(new Set(labels.filter((label) => label.clusterId).map((label) => label.clusterId)).size, 8);
  assert.equal(ofKind('same exchange, nothing else').length, 12);
  assert.equal(ofKind('read the same guide').length, 6);
  assert.equal(ofKind('independent').length, 70);
});

test('each cluster really does share the trait it is labelled with', () => {
  const field = {
    FUNDING_SOURCE: 'walletsWithTheSameFundingSource',
    CREATION_TIMING: 'walletsWithinTenMinutesOfCreation',
    ACTION_SEQUENCE: 'walletsWithTheSameActionSequence',
    GAS_PATTERN: 'walletsWithTheSameGasPrice',
    WITHDRAWAL_ENDPOINT: 'walletsWithTheSameWithdrawalEndpoint',
  };
  for (const label of labels.filter((entry) => entry.clusterId)) {
    const entry = item(label.wallet);
    const size = labels.filter((other) => other.clusterId === label.clusterId).length;
    assert.ok(entry[field[label.linkingSignal]] >= size, `${label.wallet} should share ${label.linkingSignal} with its cluster`);
  }
});

test('an exchange is not a cluster, and neither is a guide', () => {
  const exchange = ofKind('same exchange, nothing else').map((label) => item(label.wallet));
  const guide = ofKind('read the same guide').map((label) => item(label.wallet));

  assert.ok(exchange.every((entry) => entry.walletsWithTheSameFundingSource > 20), 'the exchange hot wallet funds a crowd');
  assert.ok(exchange.every((entry) => entry.walletsWithTheSameActionSequence <= 2 && entry.walletsWithTheSameGasPrice <= 2), 'and they share nothing else');
  assert.ok(guide.every((entry) => entry.walletsWithTheSameActionSequence >= 6), 'the guide followers match on sequence');
  assert.ok(guide.every((entry) => entry.walletsWithTheSameFundingSource <= 2), 'and on nothing else');
});

test('the state counts the crowd and never names it', () => {
  const farmed = item(labels.find((label) => label.clusterId === 'C1').wallet);
  const state = demo.buildState(farmed, context);

  assert.ok(state.how_many_others_look_like_this.share_its_funding_source >= 9);
  assert.equal(typeof state.how_many_others_look_like_this.were_created_within_ten_minutes, 'number');
  assert.ok(state.wallet.allocation_at_stake > 0);

  const serialised = JSON.stringify(state);
  for (const value of ['clusterId', 'C1', 'linkingSignal', 'read the same guide', 'independent']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
  for (const other of dataset.items.filter((entry) => entry.id !== farmed.id).slice(0, 40)) {
    assert.equal(serialised.includes(other.address), false, 'no other wallet is named');
  }
});

test('a perfect run excludes every cluster and no real user', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Clusters excluded whole').value, '8 of 8');
  assert.equal(kpi(report, 'Farmed wallets excluded').value, '62 of 62');
  assert.equal(kpi(report, 'Real users excluded').value, '0 of 88');
  assert.equal(report.metrics.signalNamedRate, 1, 'the planted signal named on every farmed wallet');
  assert.equal(kpi(report, 'Signals claimed where there are none').value, '0 of 88');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('excluding everyone who shares a funding source takes the allocation from real users', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const crowded = entry.walletsWithTheSameFundingSource > 3;
      return { answers: answerFor({ likelihood: crowded ? 5 : 1, signal: crowded ? 'FUNDING_SOURCE' : 'NONE', exclude: crowded, independent: !crowded }) };
    },
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'same-exchange-nothing-else').count, 12);
  assert.ok(report.findings.some((line) => /real users were excluded/.test(line)));
  assert.match(kpi(report, 'Real users excluded').context, /taken from people who earned it/);
});

test('the likelihood bar trades allocation saved against users turned away', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 62);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points[5].rate, 1, 'at five of six only the farmed wallets are left');
  assert.equal(matrix.rows.length, 6);
});
