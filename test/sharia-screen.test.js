import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/sharia-screen/demo.js';
import { loadDataset } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// There are no labels here. What stands in for them is arithmetic the demo does itself, so these tests
// mostly check that the arithmetic is right and that the state never contains it.

const dataset = await loadDataset('sharia-screen');
const context = demoContext(dataset);
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);
const check = (report, id) => report.checks.find((entry) => entry.id === id);

const answerFor = ({ activity = true, debt = true, liquid = true, receivables = true, band = 'UNDER_3', verdict = 'PASS', confidence = 0.8 }) => ({
  activity_compliant: { type: 'noul', noul: activity ? 0.9 : 0.1 },
  debt_ratio_pass: { type: 'noul', noul: debt ? 0.9 : 0.1 },
  interest_securities_pass: { type: 'noul', noul: liquid ? 0.9 : 0.1 },
  receivables_pass: { type: 'noul', noul: receivables ? 0.9 : 0.1 },
  impure_income_band: { type: 'choice', choice: band, confidence: 0.8, probabilities: { [band]: 0.8 } },
  verdict: { type: 'choice', choice: verdict, confidence, probabilities: { [verdict]: confidence } },
});

test('sixteen instruments against three rule sets, with no labels', () => {
  assert.equal(dataset.items.length, 48);
  assert.equal(new Set(dataset.items.map((entry) => entry.symbol)).size, 16);
  assert.equal(new Set(dataset.items.map((entry) => entry.standardId)).size, 3);
  assert.equal(demo.labels, undefined, 'no ground truth is claimed about what a business may do');
  assert.match(context.note, /not any standards body/);
});

test('the balance sheet is the real one, on the newest year filed', () => {
  const ko = item('KO-total-assets');
  assert.equal(ko.fiscalYearEnd, '2025-12-31');
  assert.ok(ko.totalAssets > 90_000_000_000);
  assert.ok(ko.totalDebt > 0);

  // These two companies file in January, and the cached years were not in date order until it was fixed.
  for (const symbol of ['NVDA', 'WMT']) {
    assert.equal(item(`${symbol}-house`).fiscalYearEnd, '2026-01-31', `${symbol} should screen on its newest filing`);
  }
});

test('the state carries the lines and the limits, never a ratio', () => {
  const state = demo.buildState(item('KO-house'), context);
  assert.equal(state.rule_set.debt_limit_percent, 25);
  assert.equal(state.balance_sheet.total_debt, item('KO-house').totalDebt);

  const serialised = JSON.stringify(state);
  assert.equal(serialised.includes('pass'), false, 'the state must not hint at the answer');
  assert.equal(/43\.4|ratio_percent/.test(serialised), false, 'the ratios are the work, not the input');
  for (const symbol of ['JPM', 'NVDA', 'SPY']) assert.equal(serialised.includes(symbol), false, `the state must not mention ${symbol}`);
});

test('the demo works out every ratio it asks about', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({}) }) });
  const ko = results.find((result) => result.item.id === 'KO-total-assets').evaluation;

  // Coca-Cola owes 43.4% of its total assets, which is over the 33% limit in this rule set.
  assert.equal(ko.ratios.debt.value, 43.4);
  assert.equal(ko.ratios.debt.limit, 33);
  assert.equal(ko.ratios.debt.pass, false);
  assert.equal(ko.agrees.debt, false, 'the answer said it passed and the arithmetic says it did not');

  // Under the market capitalisation standard the same company clears the same screen comfortably.
  const byMarketCap = results.find((result) => result.item.id === 'KO-market-cap').evaluation;
  assert.equal(byMarketCap.ratios.debt.pass, true);
  assert.equal(byMarketCap.agrees.debt, true);
});

test('a ratio with a missing line is not graded, and claiming it passed is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({}) }) });
  const report = demo.report(results, context);
  const xom = results.find((result) => result.item.id === 'XOM-house').evaluation;

  assert.equal(xom.ratios.debt.value, null, 'no debt line is on file for this one');
  assert.equal(xom.agrees.debt, null, 'a ratio that cannot be computed is not marked right or wrong');
  assert.equal(check(report, 'missing').count, check(report, 'missing').of, 'every missing line was called inside the limit');
  assert.ok(check(report, 'overall').of < 48 * 3, 'the ungradeable calls are left out of the total');
});

test('answering every ratio correctly reads as correct', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const denominator = entry.denominator;
      const within = (line, limit) => (typeof entry[line] === 'number' && denominator ? (entry[line] / denominator) * 100 < entry[limit] : false);
      return { answers: answerFor({
        debt: within('totalDebt', 'debtLimitPercent'),
        liquid: within('cashAndSecurities', 'liquidAssetsLimitPercent'),
        receivables: within('receivables', 'receivablesLimitPercent'),
        verdict: 'NEEDS_REVIEW',
      }) };
    },
  });
  const report = demo.report(results, context);
  const [made, total] = kpi(report, 'Ratio calls that match the arithmetic').value.split(' of ');

  assert.equal(made, total);
  assert.equal(check(report, 'overall').count, 0);
  assert.equal(kpi(report, 'Ratio calls that match the arithmetic').tone, 'good');
});

test('a verdict that contradicts its own screens is counted', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ debt: false, verdict: 'PASS' }) }) });
  const report = demo.report(results, context);

  assert.equal(check(report, 'verdict').count, 48, 'a pass cannot sit beside a failed screen');
  assert.equal(report.metrics.contradictionRate, 1);
});

test('the interest income band is checked against revenue', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ band: 'UNDER_3' }) }) });
  const report = demo.report(results, context);
  const jpm = results.find((result) => result.item.id === 'JPM-house').evaluation;

  assert.equal(jpm.ratios.band, 'OVER_5', 'interest is most of what a bank earns');
  assert.ok(jpm.ratios.impure > 100);
  assert.ok(check(report, 'band').count >= 6, 'the banks and the funds are not under three per cent');
});

test('the activity screen grades only what it can state outright', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ activity: true }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Conventional banks refused').value, '0 of 6', 'JPM and BAC under three rule sets');
  assert.ok(report.findings.some((line) => /12 of 12 screenings of businesses that only touch a prohibited activity/.test(line)));
  assert.ok(report.findings.some((line) => /scholar/.test(line)));
});

test('an activity answer that changes with the rule set is counted', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ activity: entry.standardId !== 'house' }) }),
  });
  const report = demo.report(results, context);

  // The prohibited-activity list is the same words in all three rule sets, so its answer cannot move.
  assert.equal(check(report, 'activity').count, 16);
  assert.equal(kpi(report, 'Same business, same activity answer').value, '0 of 16');
  assert.ok(report.findings.some((line) => /different answer about what the business does/.test(line)));
});

test('an activity answer that holds across the rule sets passes that check', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ activity: false }) }) });
  const report = demo.report(results, context);

  assert.equal(check(report, 'activity').count, 0);
  assert.equal(kpi(report, 'Same business, same activity answer').tone, 'good');
  assert.equal(kpi(report, 'Conventional banks refused').value, '6 of 6');
});

test('the same instrument can land differently under different rule sets', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ verdict: entry.standardId === 'house' ? 'FAIL' : 'PASS', debt: entry.standardId !== 'house' }) }),
  });
  const report = demo.report(results, context);

  assert.equal(report.matrix.rows.length, 3);
  assert.ok(report.findings.some((line) => /different verdict depending on the rule set/.test(line)));
});
