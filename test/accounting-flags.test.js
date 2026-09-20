import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/accounting-flags/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// The point of this demo is that two different things are being measured — finding the pattern and
// excusing the explained one — so most of these tests are about keeping those two apart.

const dataset = await loadDataset('accounting-flags');
const labels = await loadLabels('accounting-flags');
const context = { ...demoContext(dataset), labels };
const label = (id) => labels.find((entry) => entry.companyYearId === id);
const item = (id) => dataset.items.find((entry) => entry.id === id);
const kpi = (report, name) => [...report.kpis, ...report.otherFigures].find((entry) => entry.label === name);
const check = (report, id) => report.checks.find((entry) => entry.id === id);
const firstWith = (predicate) => labels.find(predicate).companyYearId;

const answerFor = ({ flag, severity = 3, explained = false, second = 'NONE', investigate = true }) => ({
  flag: { type: 'choice', choice: flag, confidence: 0.8, probabilities: { [flag]: 0.8 } },
  severity: { type: 'score', score: severity, confidence: 0.7, legend: {}, probabilities: {} },
  business_explanation_exists: { type: 'noul', noul: explained ? 0.9 : 0.1 },
  second_flag: { type: 'choice', choice: second, confidence: 0.6, probabilities: { [second]: 0.6 } },
  investigate: { type: 'noul', noul: investigate ? 0.9 : 0.1 },
});

test('a hundred and twenty company-years, planted as the brief says', () => {
  assert.equal(dataset.items.length, 120);
  assert.equal(labels.length, 120);
  const counts = {};
  for (const entry of labels) counts[entry.flag] = (counts[entry.flag] ?? 0) + 1;
  assert.deepEqual(counts, { RECEIVABLES: 12, INVENTORY: 9, REVENUE_TIMING: 8, CAPITALISED_COSTS: 7, RELATED_PARTY: 6, RESTATEMENT: 5, NONE: 73 });
  assert.equal(labels.filter((entry) => entry.decoy).length, 10);
  assert.equal(new Set(dataset.items.map((entry) => entry.company)).size, 120, 'every company is a different invented name');
});

test('each planted pattern is visible in the numbers', () => {
  const growth = (entry, line) => entry.statements[2][line] / entry.statements[1][line];

  const receivables = item(firstWith((entry) => entry.flag === 'RECEIVABLES' && !entry.decoy));
  assert.ok(growth(receivables, 'tradeReceivables') > 1.5, 'receivables should run well ahead');
  assert.ok(growth(receivables, 'revenue') < 1.2, 'while revenue does not');

  const inventory = item(firstWith((entry) => entry.flag === 'INVENTORY' && !entry.decoy));
  assert.ok(growth(inventory, 'inventory') > 1.4);
  assert.ok(growth(inventory, 'revenue') < 1, 'stock builds while sales fall');

  const timing = item(firstWith((entry) => entry.flag === 'REVENUE_TIMING' && !entry.decoy));
  const last = timing.statements[2];
  assert.ok(last.operatingCashFlow / last.netIncome < 0.5);
  assert.ok(timing.statements[1].operatingCashFlow / timing.statements[1].netIncome > 0.9, 'and it did not use to');

  const capitalised = item(firstWith((entry) => entry.flag === 'CAPITALISED_COSTS' && !entry.decoy));
  assert.ok(growth(capitalised, 'costsCapitalised') > 3);
});

test('the decoy explanation is in the notes and nowhere else', () => {
  for (const entry of labels.filter((row) => row.decoy)) {
    const company = item(entry.companyYearId);
    const prose = company.notes.join(' ');
    const rest = JSON.stringify({ ...company, notes: null });
    assert.ok(company.notes.length >= 4, `${entry.companyYearId} should carry an explanation`);
    assert.equal(/decoy|explained|innocent/i.test(rest), false, 'nothing outside the notes may say so');
    assert.ok(/after the year end|firm orders|technical feasibility|list price|distributor|unchanged, and the same firm/i.test(prose), `${entry.companyYearId} needs a readable reason`);
  }
});

test('the state carries the statements and the notes, never the answer', () => {
  const entry = labels.find((row) => row.flag === 'RECEIVABLES' && row.decoy);
  const state = demo.buildState(item(entry.companyYearId), context);

  assert.equal(state.statements.length, 3);
  assert.ok(state.notes_to_the_accounts.length >= 4);
  assert.ok(state.what_is_normal_for_this_sector.typicalDaysSalesOutstanding > 0);

  const serialised = JSON.stringify(state);
  for (const flag of ['RECEIVABLES', 'REVENUE_TIMING', 'CAPITALISED_COSTS', 'RELATED_PARTY']) {
    assert.equal(serialised.includes(flag), false, `the state must not name ${flag}`);
  }
  assert.equal(/daysSalesOutstanding.*:\s*\d/.test(JSON.stringify(state.statements)), false, 'the ratios are the work, not the input');
});

test('naming every planted pattern reads as found, with no false alarms', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ flag: label(entry.id).flag, second: label(entry.id).secondFlag }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Patterns named correctly').value, '47 of 47');
  assert.equal(kpi(report, 'Clean years accused').value, '0 of 73');
  const withSecond = labels.filter((entry) => entry.secondFlag !== 'NONE').length;
  assert.ok(withSecond >= 8, 'some company-years carry two patterns at once');
  assert.equal(kpi(report, 'Second pattern found').value, `${withSecond} of ${withSecond}`);
  assert.equal(check(report, 'clean').count, 0);
});

test('calling everything clean is counted as missing them all', async () => {
  const { results } = await runDemo(demo, { dataset, ask: () => ({ answers: answerFor({ flag: 'NONE', severity: 0, investigate: false }) }) });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Patterns named correctly').value, '0 of 47');
  assert.equal(kpi(report, 'Patterns named correctly').tone, 'warn');
  assert.ok(report.findings.some((line) => /were read as clean/.test(line)));
  assert.equal(check(report, 'receivables').count, 12);
});

test('excusing the decoys is scored apart from finding the flags', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const row = label(entry.id);
      return { answers: answerFor({ flag: row.flag, explained: row.decoy, investigate: !row.decoy, severity: row.decoy ? 1 : 4 }) };
    },
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Decoy explanation found').value, '10 of 10');
  assert.equal(kpi(report, 'Decoys let through').value, '10 of 10');
  assert.equal(kpi(report, 'Decoy explanation found').tone, 'good');
  assert.equal(kpi(report, 'Real patterns sent on').value, '37 of 37');
  assert.equal(check(report, 'decoys').count, 0);
  assert.equal(kpi(report, 'Severity gap, real against excused').value, '3.0');
});

test('a run that finds every flag but excuses nothing says so', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ flag: label(entry.id).flag, explained: false, investigate: true }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Patterns named correctly').value, '47 of 47');
  assert.equal(kpi(report, 'Decoy explanation found').value, '0 of 10');
  assert.equal(kpi(report, 'Decoys let through').value, '0 of 10');
  assert.equal(check(report, 'decoys').count, 10);
  assert.ok(report.findings.some((line) => /will not find it/.test(line)));
});

test('reading the note but still asking for review is reported as its own thing', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ flag: label(entry.id).flag, explained: label(entry.id).decoy, investigate: true }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Decoy explanation found').value, '10 of 10');
  assert.equal(kpi(report, 'Decoys let through').value, '0 of 10');
  assert.ok(report.findings.some((line) => /sent for review anyway/.test(line)));
});

test('ranking well and deciding badly are reported as different things', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ flag: label(entry.id).flag, severity: label(entry.id).flag === 'NONE' ? 2.5 : 4, investigate: true }) }),
  });
  const report = demo.report(results, context);

  assert.equal(kpi(report, 'Severity gap, planted against clean').value, '1.5');
  assert.equal(kpi(report, 'Clean years held up').value, '73 of 73');
  assert.equal(kpi(report, 'Clean years held up').tone, 'warn');
  assert.ok(report.findings.some((line) => /ranking is better than the decision/.test(line)));
});

test('the confusion matrix separates spotting from naming', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ flag: label(entry.id).flag === 'RECEIVABLES' ? 'REVENUE_TIMING' : label(entry.id).flag }) }),
  });
  const report = demo.report(results, context);

  const row = report.matrix.rows.find((entry) => entry.label === 'Receivables');
  assert.equal(row.cells.find((cell) => cell.predicted === 'REVENUE_TIMING').count, 12);
  assert.ok(report.findings.some((line) => /spotted but named as something else/.test(line)));
});
