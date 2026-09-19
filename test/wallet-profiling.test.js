import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/wallet-profiling/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('wallet-profiling');
const labels = await loadLabels('wallet-profiling');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.wallet, label]));
const monitoringFor = { EXCHANGE: 'CONTINUOUS', MARKET_MAKER: 'PERIODIC', MEV_BOT: 'CONTINUOUS', RETAIL: 'NONE', BRIDGE: 'PERIODIC', SCAM_COLLECTOR: 'CONTINUOUS' };

const answerFor = ({ type, automation, monitoring, clear = true }) => ({
  wallet_type: { type: 'choice', choice: type, confidence: 0.9, probabilities: { [type]: 0.9 } },
  automation: { type: 'score', score: automation, confidence: 0.85, legend: {}, probabilities: {} },
  monitoring_level: { type: 'choice', choice: monitoring, confidence: 0.85, probabilities: { [monitoring]: 0.85 } },
  type_is_clear: { type: 'noul', noul: clear ? 0.9 : 0.1 },
});

const perfect = ({ item }) => {
  const label = planted.get(item.id);
  return { answers: answerFor({ type: label.type, automation: label.automation, monitoring: monitoringFor[label.type], clear: !label.ambiguous }) };
};

test('dataset contains 200 fictional wallets in six types and exactly ten ambiguous cases', () => {
  assert.equal(dataset.items.length, 200);
  assert.equal(labels.length, 200);
  assert.deepEqual([...new Set(labels.map((label) => label.type))].sort(), ['BRIDGE', 'EXCHANGE', 'MARKET_MAKER', 'MEV_BOT', 'RETAIL', 'SCAM_COLLECTOR']);
  assert.equal(labels.filter((label) => label.ambiguous).length, 10);
  assert.ok(dataset.items.every((item) => item.address.startsWith('0xDEMO')));
});

test('the video-beat fingerprints are derivable from raw wallet activity', () => {
  const byType = (type) => labels.filter((label) => label.type === type && !label.ambiguous).map((label) => dataset.items.find((item) => item.id === label.wallet));
  const mev = byType('MEV_BOT');
  const retail = byType('RETAIL');
  const averageHour = (items, hour) => items.reduce((sum, item) => sum + item.hourOfDay[hour].count / item.transactions, 0) / items.length;
  assert.ok(averageHour(retail, 20) > averageHour(retail, 3) * 5, 'retail peaks in the evening');
  assert.ok(averageHour(mev, 20) < averageHour(mev, 3) * 1.8, 'MEV is comparatively flat across the day');
  for (const wallet of byType('SCAM_COLLECTOR')) {
    assert.ok(wallet.inboundTransactions >= 300);
    assert.equal(wallet.outboundTransactions, 1);
  }
});

test('state carries the complete fingerprint and no label or type hint', () => {
  const item = dataset.items[0];
  const state = demo.buildState(item, context);
  assert.equal(state.timing.transactions_by_hour_utc.length, 24);
  assert.equal(state.amounts.distribution.length, 4);
  assert.equal(state.wallet.transactions, item.transactions);
  assert.equal(state.contract_and_sequence_activity.sameBlockShare, item.interactions.sameBlockShare);
  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes(planted.get(item.id).type), false);
  assert.equal(serialised.includes('ambiguousWith'), false);
});

test('a perfect run separates ambiguity, builds drill-down cells and computes fingerprints from data', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });
  assert.equal(report.kpis.find((entry) => entry.label === 'Clear wallet types correct').value, '100%');
  assert.equal(report.kpis.find((entry) => entry.label === 'Ambiguity handled fairly').value, '10 of 10');
  assert.equal(report.matrix.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0), 190);
  assert.ok(report.matrix.rows.flatMap((row) => row.cells).filter((cell) => cell.count).every((cell) => cell.items.length === cell.count));
  assert.equal(report.fingerprints.series.length, 6);
  assert.equal(report.fingerprints.metrics.length, 6);
  const scam = report.fingerprints.series.find((series) => series.id === 'SCAM_COLLECTOR');
  const fresh = scam.values.find((value) => value.key === 'fresh_sources').value;
  assert.ok(fresh > 0.7);
});

test('an unclear answer is accepted for an ambiguous wallet even when it picks the neighbouring type', async () => {
  const target = labels.find((label) => label.ambiguous);
  const { results } = await runDemo(demo, {
    dataset: { ...dataset, items: [dataset.items.find((item) => item.id === target.wallet)] },
    ask: () => ({ answers: answerFor({ type: target.ambiguousWith, automation: target.automation, monitoring: monitoringFor[target.type], clear: false }) }),
  });
  const report = demo.report(results, { ...context, labels: [target] });
  assert.equal(report.kpis.find((entry) => entry.label === 'Ambiguity handled fairly').value, '1 of 1');
  assert.equal(report.checks[0].count, 0);
});

test('forcing every wallet to retail creates populated clickable off-diagonal matrix cells', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ type: 'RETAIL', automation: 1, monitoring: 'NONE', clear: true }) }) });
  const report = demo.report(results, { ...context, labels });
  const exchangeRow = report.matrix.rows.find((row) => row.label === 'Exchange');
  const retailCell = exchangeRow.cells.find((cell) => cell.predicted === 'RETAIL');
  assert.ok(retailCell.count > 0);
  assert.equal(retailCell.items.length, retailCell.count);
});
