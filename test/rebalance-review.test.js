import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/rebalance-review/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The rebalancer's trades are right on paper. What the tests protect is the other half: that each
// planted problem is visible in the state, and that the order list at the end is really an order list.

const dataset = await loadDataset('rebalance-review');
const labels = await loadLabels('rebalance-review');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.tradeId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const withIssue = (issue) => labels.filter((label) => label.issue === issue).map((label) => item(label.tradeId));
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ verdict, issue, band = 'AS_PROPOSED', risk = 1, signOff = false }) => ({
  verdict: { type: 'choice', choice: verdict, confidence: 0.85, probabilities: { [verdict]: 0.85 } },
  size_band: { type: 'choice', choice: band, confidence: 0.8, probabilities: { [band]: 0.8 } },
  issue: { type: 'choice', choice: issue, confidence: 0.8, probabilities: { [issue]: 0.8 } },
  execution_risk: { type: 'score', score: risk, confidence: 0.7, legend: {}, probabilities: {} },
  needs_pm_sign_off: { type: 'noul', noul: signOff ? 0.9 : 0.1 },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  return { answers: answerFor({
    verdict: label.verdict,
    issue: label.issue,
    band: label.issue === 'LIQUIDITY' ? 'SPLIT_OVER_DAYS' : 'AS_PROPOSED',
    risk: label.issue === 'NONE' ? 0.5 : 4,
    signOff: label.issue === 'MANDATE_CONFLICT',
  }) };
};

test('two hundred trades, forty-seven of them carrying something', () => {
  assert.equal(dataset.items.length, 200);
  assert.equal(withIssue('LIQUIDITY').length, 14);
  assert.equal(withIssue('TAX_LOT').length, 11);
  assert.equal(withIssue('CROSSING').length, 9);
  assert.equal(withIssue('TOO_SMALL').length, 7);
  assert.equal(withIssue('MANDATE_CONFLICT').length, 6);
  assert.equal(withIssue('NONE').length, 153);
});

test('each problem is visible in the trade, against the rule that names it', () => {
  const ordinary = withIssue('NONE');
  assert.ok(Math.min(...withIssue('LIQUIDITY').map((entry) => entry.shareOfAverageVolumePercent)) > Math.max(...ordinary.map((entry) => entry.shareOfAverageVolumePercent)));
  assert.ok(withIssue('TOO_SMALL').every((entry) => entry.valueUsd < 250_000));
  assert.ok(ordinary.every((entry) => entry.valueUsd >= 250_000));
  assert.ok(withIssue('TAX_LOT').every((entry) => entry.accountTaxable && entry.recentTradesInThisName.some((trade) => trade.daysAgo < 30 && trade.side === 'BUY')));
  assert.ok(withIssue('CROSSING').every((entry) => entry.sameNameOtherAccountToday?.sameDay && entry.sameNameOtherAccountToday.side !== entry.side));
  assert.ok(withIssue('MANDATE_CONFLICT').every((entry) => /do not trim/.test(entry.mandateNote ?? '')));
});

test('the state carries the mandate and the history, and never the verdict', () => {
  const state = demo.buildState(item(labels.find((label) => label.issue === 'MANDATE_CONFLICT').tradeId), context);

  assert.match(state.account.mandate, /do not trim/);
  assert.equal(state.desk.rules.length, 5);
  assert.ok(state.liquidity.this_trade_as_share_of_that_percent >= 0);

  const serialised = JSON.stringify(state);
  for (const value of ['MANDATE_CONFLICT', 'TAX_LOT', 'CROSSING', '"verdict"']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('a perfect run stops every problem and lets the rest through', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Problem trades stopped').value, '47 of 47');
  assert.equal(kpi(report, 'Problem named exactly').value, '47 of 47');
  assert.equal(kpi(report, 'Verdict agrees').value, '100%');
  assert.equal(kpi(report, 'Good trades stopped').value, '0 of 153');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0, 0]);
});

test('an oversized trade that is only refused is not a review', async () => {
  const { results } = await runDemo(demo, { dataset, ask: ({ item: entry }) => {
    const label = planted.get(entry.id);
    return { answers: answerFor({ verdict: label.verdict, issue: label.issue, band: 'AS_PROPOSED' }) };
  } });
  const report = demo.report(results, { ...context, labels });

  assert.ok(report.findings.some((line) => /0 of the 14 oversized trades were given a smaller size/.test(line)));
});

test('approving everything puts the rejects in the order list', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ verdict: 'APPROVE', issue: 'NONE' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Problem trades stopped').value, '0 of 47');
  assert.match(kpi(report, 'Order list').context, /that should not be there/);
  assert.ok(report.findings.some((line) => /were approved as they stood/.test(line)));
});

test('refusing everything is reported as the cost of a rebalance that never happens', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ verdict: 'REJECT', issue: 'LIQUIDITY', risk: 5 }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'clean').count, 153);
  assert.ok(report.findings.some((line) => /drift policy with extra steps/.test(line)));
});

test('the distance from approve sorts the trades that have something wrong towards the top', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve, matrix } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 47);
  assert.equal(curve.points[4].rate, 1, 'at a bar of 75% only the problem trades are left');
  assert.equal(matrix.rows.length, 4, 'one row per verdict, the thing the headline grades');
});
