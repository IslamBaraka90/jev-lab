import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/token-screening/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('token-screening');
const labels = await loadLabels('token-screening');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.token, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);

const answerFor = ({ risk, flag, tradeable, honeypot = false, position = 'NORMAL' }) => ({
  rug_likelihood: { type: 'score', score: risk, confidence: 0.85, legend: {}, probabilities: {} },
  red_flag: { type: 'choice', choice: flag, confidence: 0.85, probabilities: { [flag]: 0.85 } },
  tradeable: { type: 'noul', noul: tradeable ? 0.9 : 0.1 },
  honeypot_suspected: { type: 'noul', noul: honeypot ? 0.9 : 0.1 },
  position_limit: { type: 'choice', choice: position, confidence: 0.85, probabilities: { [position]: 0.85 } },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  const fine = label.outcome === 'FINE';
  return { answers: answerFor({ risk: fine ? 1 : 5, flag: label.flag, tradeable: fine, honeypot: label.outcome === 'HONEYPOT', position: fine ? 'NORMAL' : 'NONE' }) };
};

test('dataset plants the exact four outcomes and eighteen decoys', () => {
  assert.equal(dataset.items.length, 160);
  assert.equal(labels.filter((label) => label.outcome === 'RUGGED').length, 14);
  assert.equal(labels.filter((label) => label.outcome === 'HONEYPOT').length, 9);
  assert.equal(labels.filter((label) => label.outcome === 'TAX_TRAP').length, 11);
  assert.equal(labels.filter((label) => label.outcome === 'FINE').length, 126);
  assert.equal(labels.filter((label) => label.decoy).length, 18);
  assert.ok(dataset.items.every((entry) => entry.contractAddress.startsWith('0xDEMO')));
});

test('failed sells are the only reliable honeypot signal', () => {
  const honeypots = labels.filter((label) => label.outcome === 'HONEYPOT').map((label) => item(label.token));
  const rest = labels.filter((label) => label.outcome !== 'HONEYPOT').map((label) => item(label.token));
  assert.ok(honeypots.every((entry) => entry.trading.buys >= 360 && entry.trading.successfulSells <= 3 && entry.trading.failedSellAttempts >= 3));
  assert.ok(rest.every((entry) => entry.trading.failedSellAttempts <= 1));
  assert.ok(honeypots.some((entry) => !entry.contract.blacklistFunction), 'blacklist is not required');
  assert.ok(rest.some((entry) => entry.trading.buySellRatio > 3), 'an imbalanced ratio alone is not reliable');
});

test('verified vesting concentration is distinct from creator concentration in the state', () => {
  const label = labels.find((entry) => entry.decoyKind === 'verified vesting concentration');
  const state = demo.buildState(item(label.token), context);
  assert.ok(state.holder_distribution.top10Share > 0.45);
  assert.ok(state.holder_distribution.vestingContractShare > 0.35);
  assert.equal(state.holder_distribution.vestingContractVerified, true);
  assert.ok(state.holder_distribution.creatorShare < 0.06);
});

test('state sends all present facts and no future outcome', () => {
  const label = labels.find((entry) => entry.outcome === 'RUGGED');
  const state = demo.buildState(item(label.token), context);
  assert.equal(state.contract_facts.mintAuthorityPresent, item(label.token).contract.mintAuthorityPresent);
  assert.equal(state.trading_history.failedSellAttempts, item(label.token).trading.failedSellAttempts);
  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('RUGGED'), false);
  assert.equal(serialised.includes('decoyKind'), false);
});

test('perfect answers get every outcome and every honeypot', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Outcome correct').value, '100%');
  assert.equal(report.kpis.find((entry) => entry.label === 'Honeypots caught').value, '9 of 9');
  assert.equal(report.kpis.find((entry) => entry.label === 'Fine tokens excluded').value, '0 of 126');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0]);
  assert.equal(report.matrix.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0), 160);
});

test('calling vesting concentration dangerous exposes the decoys separately', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item: entry }) => {
    const vesting = entry.holders.vestingContractShare > 0.3;
    return { answers: answerFor({ risk: vesting ? 5 : 1, flag: vesting ? 'HOLDER_CONCENTRATION' : 'NONE', tradeable: !vesting, position: vesting ? 'NONE' : 'NORMAL' }) };
  } });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.checks.find((check) => check.id === 'decoys').count, 9);
  assert.ok(report.findings.some((line) => /verified vesting allocations/.test(line)));
});

test('the likelihood curve exposes good-token loss separately from rug recall', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });
  assert.equal(curve.of, 14);
  assert.equal(curve.points[4].caught, 14);
  assert.equal(curve.points[4].goodLost, 0);
  for (let index = 1; index < curve.points.length; index++) assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
});
