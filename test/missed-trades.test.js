import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import demo from '../demos/missed-trades/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

const dataset = await loadDataset('missed-trades');
const labels = await loadLabels('missed-trades');
const context = demoContext(dataset);
const byId = new Map(labels.map((label) => [label.setupId, label]));
const answer = ({ item }) => {
  const label = byId.get(item.id);
  const reason = label.taken ? 'NOT_SKIPPED' : label.goodReason === 'EARNINGS_NEXT_DAY' ? 'CALENDAR_EVENT' : label.goodReason === 'RISK_LIMIT_USED' ? 'RISK_LIMIT' : label.goodReason === 'GAP_RULE_SPIRIT' ? 'RULE_AMBIGUITY' : item.account.recentState === 'AFTER_LOSSES' ? 'RECENT_LOSSES' : 'ATTENTION';
  return { answers: { qualified: { type: 'noul', noul: 0.98 }, skip_reason: { type: 'choice', choice: reason, confidence: 0.9, probabilities: { [reason]: 0.9 } }, setup_quality: { type: 'score', score: 4.5, confidence: 0.8, probabilities: {} }, should_have_been_taken: { type: 'noul', noul: label.goodReasonToSkip ? 0.05 : 0.95 }, rule_needs_clarifying: { type: 'noul', noul: label.goodReason === 'GAP_RULE_SPIRIT' ? 0.95 : 0.05 } } };
};

test('dataset contains 240 reproducible setup hits across twelve symbols', () => {
  assert.equal(dataset.items.length, 240);
  assert.equal(new Set(dataset.items.map((item) => item.symbol)).size, 12);
  for (const rows of Object.values(Object.groupBy(dataset.items, (item) => item.symbol))) assert.equal(rows.length, 20);
  assert.ok(dataset.items.every((item) => Object.values(item.conditions).every(Boolean)));
});

test('the shared qualifying rule is the compact code-panel artifact', async () => {
  const source = await readFile(new URL('../demos/missed-trades/rule.js', import.meta.url), 'utf8');
  const region = source.split('// #region demo:data')[1].split('// #endregion')[0].trim().split(/\r?\n/);
  assert.ok(region.length < 30, `rule should stay under 30 lines, got ${region.length}`);
  assert.equal(demo.explain.data, 'demos/missed-trades/rule.js#demo:data');
});

test('taken log has exactly 30 justified skips and clusters misses after losses and on Mondays', () => {
  const missed = labels.filter((label) => !label.taken);
  assert.equal(labels.filter((label) => label.goodReasonToSkip).length, 30);
  assert.equal(missed.length, 130);
  const missRate = (items) => items.filter((item) => !byId.get(item.id).taken).length / items.length;
  const mondays = dataset.items.filter((item) => item.weekday === 'Monday');
  assert.ok(missRate(mondays) > missRate(dataset.items.filter((item) => item.weekday !== 'Monday')) + 0.15);
  const after = dataset.items.filter((item) => item.account.recentState === 'AFTER_LOSSES');
  assert.ok(missRate(after) > missRate(dataset.items.filter((item) => item.account.recentState === 'NORMAL')) + 0.15);
});

test('state includes all pre-setup evidence but never a future bar or outcome', () => {
  for (const item of dataset.items) {
    const state = demo.buildState(item, context);
    assert.equal(state.candles_through_setup_only.length, 35);
    assert.ok(state.candles_through_setup_only.every((line) => line.slice(0, 10) <= item.date));
    assert.equal(JSON.stringify(state).includes(byId.get(item.id).outcomeDate), false);
    assert.equal(JSON.stringify(state).includes('forwardReturn'), false);
    assert.equal(state.trade_log.setupWasTaken, byId.get(item.id).taken);
  }
});

test('report excludes good-reason skips from cost and compares all three cohorts', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const report = demo.report(results, { ...context, labels });
  const avoidable = labels.filter((label) => !label.taken && !label.goodReasonToSkip);
  const expected = avoidable.reduce((sum, label) => sum + Math.max(0, label.outcomeUsd), 0);
  assert.equal(report.kpis.find((entry) => entry.label === 'Avoidable miss cost').value, expected.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
  assert.equal(report.kpis.find((entry) => entry.label === 'Good-reason skips honoured').value, '30 of 30');
  assert.equal(report.breakdowns.length, 2);
  assert.equal(report.comparisonTable.columns.length, 3);
});

test('changing outcomes on justified skips cannot change avoidable miss cost', async () => {
  const { results } = await runDemo(demo, { dataset, ask: answer });
  const first = demo.report(results, { ...context, labels });
  const changed = labels.map((label) => label.goodReasonToSkip ? { ...label, outcomeUsd: 999_999 } : label);
  const second = demo.report(results, { ...context, labels: changed });
  assert.equal(first.kpis.find((entry) => entry.label === 'Avoidable miss cost').value, second.kpis.find((entry) => entry.label === 'Avoidable miss cost').value);
});
