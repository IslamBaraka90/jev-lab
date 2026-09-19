import assert from 'node:assert/strict';
import { test } from 'node:test';
import demo from '../demos/merchant-onboarding/demo.js';
import { loadDataset, loadLabels } from '../src/services/dataset.js';
import { demoContext, runDemo } from '../src/services/demo-runner.js';

// Underwriting is graded on both sides at once: the merchants that went bad and were taken anyway, and
// the good ones that were refused. The reserve is graded in money, against what the bad ones cost.

const dataset = await loadDataset('merchant-onboarding');
const labels = await loadLabels('merchant-onboarding');
const context = demoContext(dataset);
const planted = new Map(labels.map((label) => [label.applicationId, label]));
const item = (id) => dataset.items.find((entry) => entry.id === id);
const ofKind = (kind) => labels.filter((label) => label.kind === kind);
const kpi = (report, label) => report.kpis.find((entry) => entry.label === label);

const answerFor = ({ tier, decision, reserve, prohibited = false, doubt = 0.5 }) => ({
  risk_tier: { type: 'choice', choice: tier, confidence: 0.85, probabilities: { [tier]: 0.85 } },
  prohibited_match: { type: 'noul', noul: prohibited ? 0.95 : 0.05 },
  document_doubt: { type: 'score', score: doubt, confidence: 0.7, legend: {}, probabilities: {} },
  reserve: { type: 'choice', choice: reserve, confidence: 0.8, probabilities: { [reserve]: 0.8 } },
  decision: { type: 'choice', choice: decision, confidence: 0.86, probabilities: { [decision]: 0.86 } },
});

const perfect = ({ item: entry }) => {
  const label = planted.get(entry.id);
  const bad = label.outcome !== 'GOOD';
  return { answers: answerFor({
    tier: label.outcome === 'PROHIBITED' ? 'PROHIBITED' : bad ? 'HIGH' : 'LOW',
    decision: bad ? 'DECLINE' : 'APPROVE',
    reserve: bad ? 'ROLLING_HOLD' : 'NONE',
    prohibited: label.outcome === 'PROHIBITED',
    doubt: label.outcome === 'FRAUD' ? 6 : 0.5,
  }) };
};

test('the dataset plants four fates and one set of look-alikes', () => {
  assert.equal(dataset.items.length, 140);
  assert.equal(ofKind('went bad later').length, 11);
  assert.equal(ofKind('prohibited from the start').length, 6);
  assert.equal(ofKind('documents do not hold up').length, 5);
  assert.equal(ofKind('looks risky, turned out fine').length, 9);
  assert.equal(labels.filter((label) => label.outcome === 'GOOD').length, 118);
  assert.ok(ofKind('went bad later').every((label) => label.chargebacksLater > 0), 'each bad merchant carries what it cost');
});

test('a thin file is not the same thing as a forged one', () => {
  const forged = ofKind('documents do not hold up').map((label) => item(label.applicationId));
  const ordinary = ofKind('ordinary').map((label) => item(label.applicationId));

  assert.ok(forged.every((entry) => entry.documents.some((document) => /does not|expired|mail forwarding|not add up/.test(document.note))));
  assert.ok(ordinary.some((entry) => entry.documentsClear < 4), 'ordinary files have scruffy documents too');
  assert.ok(ordinary.every((entry) => entry.documents.every((document) => !/does not exist|expired/.test(document.note))));
});

test('the state carries the rules and the file, and never the outcome', () => {
  const state = demo.buildState(item(ofKind('went bad later')[0].applicationId), context);

  assert.equal(state.acquirer.does_not_accept.length, 5);
  assert.equal(state.documents.length, 4);
  assert.ok(state.application.expected_monthly_volume > 0);
  assert.ok(state.website_excerpt.length > 40);

  const serialised = JSON.stringify(state);
  for (const value of ['CHARGEBACK_HEAVY', 'PROHIBITED', 'chargebacksLater', 'went bad later', 'looks risky']) {
    assert.equal(serialised.includes(value), false, `the state must not contain ${value}`);
  }
});

test('the reserve is money, and a decline holds none of it', () => {
  const entry = item('APP-001');
  const ten = demo.evaluate(answerFor({ tier: 'MEDIUM', decision: 'APPROVE', reserve: 'TEN_PERCENT' }), entry);
  const rolling = demo.evaluate(answerFor({ tier: 'HIGH', decision: 'REVIEW', reserve: 'ROLLING_HOLD' }), entry);
  const declined = demo.evaluate(answerFor({ tier: 'HIGH', decision: 'DECLINE', reserve: 'TWENTY_PERCENT' }), entry);

  assert.equal(ten.reserveHeld, Math.round(entry.expectedMonthlyVolume * 0.1));
  assert.equal(rolling.reserveHeld, Math.round(entry.expectedMonthlyVolume * 0.3));
  assert.equal(declined.reserveHeld, 0);
});

test('a perfect run refuses what cannot be priced and boards every good merchant', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Never-acceptable merchants approved').value, '0 of 11', 'the six prohibited and the five forged files');
  assert.equal(kpi(report, 'Good merchants declined').value, '0 of 118');
  assert.equal(kpi(report, 'Prohibited called exactly').value, '6 of 6');
  assert.equal(kpi(report, 'Under-reserved').value, '0 of 0', 'nothing that went bad got past the decline');
  assert.deepEqual(report.checks.map((check) => check.count), [0, 0, 0, 0, 0]);
  assert.deepEqual(report.findings, []);
});

test('taking a merchant that goes bad is judged by the reserve, not by the refusal', async () => {
  // Board all eleven: with a rolling hold the file is covered, with nothing held it is not.
  const run = (reserve) => runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => {
      const label = planted.get(entry.id);
      const never = ['PROHIBITED', 'FRAUD'].includes(label.outcome);
      return { answers: answerFor({ tier: never ? 'PROHIBITED' : 'MEDIUM', decision: never ? 'DECLINE' : 'APPROVE', reserve: label.outcome === 'CHARGEBACK_HEAVY' ? reserve : 'NONE' }) };
    },
  });

  const covered = demo.report((await run('ROLLING_HOLD')).results, { ...context, labels });
  const bare = demo.report((await run('NONE')).results, { ...context, labels });
  const under = (report) => report.checks.find((check) => check.id === 'went-bad-later').count;

  // A rolling hold does not cover every one of them — the worst cost more than a third of a month —
  // but across the eleven it holds back more than they took, which is what a reserve is for.
  assert.ok(under(covered) < 6 && under(covered) > 0, `${under(covered)} of eleven still short`);
  assert.equal(Number.parseFloat(kpi(covered, 'Reserve against what was not refused').value) >= 100, true);
  assert.ok(covered.findings.some((line) => /Underwriting is pricing, not refusing/.test(line)));

  assert.equal(under(bare), 11);
  assert.equal(kpi(bare, 'Under-reserved').value, '11 of 11');
  assert.match(kpi(bare, 'Under-reserved').context, /more went out than was held/);
});

test('boarding everyone shows the cost in money, not just in counts', async () => {
  const { results } = await runDemo(demo, {
    dataset,
    ask: () => ({ answers: answerFor({ tier: 'LOW', decision: 'APPROVE', reserve: 'NONE' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(kpi(report, 'Never-acceptable merchants approved').value, '11 of 11');
  assert.equal(kpi(report, 'Reserve against what was not refused').value, '0%');
  assert.ok(report.findings.some((line) => /no reserve makes acceptable were not refused/.test(line)));
  assert.ok(report.findings.some((line) => /cover 0%/.test(line)));
});

test('refusing every uncomfortable category is reported as its own failure', async () => {
  const uneasy = ['Travel', 'Supplements', 'Dropshipping', 'Crypto adjacent', 'Adult adjacent', 'Gambling adjacent'];
  const { results } = await runDemo(demo, {
    dataset,
    ask: ({ item: entry }) => ({ answers: answerFor({ tier: 'HIGH', decision: uneasy.includes(entry.category) ? 'DECLINE' : 'APPROVE', reserve: 'NONE' }) }),
  });
  const report = demo.report(results, { ...context, labels });

  assert.equal(report.checks.find((check) => check.id === 'looks-risky-turned-out-fine').count, 9, 'all nine look-alikes are in those categories');
  assert.ok(Number(kpi(report, 'Good merchants declined').value.split(' ')[0]) > 9);
  assert.ok(report.findings.some((line) => /answers the objection in its own file/.test(line)));
});

test('document doubt is graded against the files that really were forged', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { curve } = demo.report(results, { ...context, labels });

  assert.equal(curve.of, 5);
  for (let index = 1; index < curve.points.length; index++) {
    assert.ok(curve.points[index].reviewed <= curve.points[index - 1].reviewed);
  }
  assert.equal(curve.points.at(-1).caught, 5, 'at certain-forgery the five forged files are all that is left');
  assert.equal(curve.points.at(-1).rate, 1);
});

test('the matrix puts four fates against three decisions', async () => {
  const { results } = await runDemo(demo, { dataset, ask: perfect });
  const { matrix } = demo.report(results, { ...context, labels });

  assert.equal(matrix.rows.length, 4);
  assert.equal(matrix.columns.length, 3);
  const good = matrix.rows.find((row) => row.label === 'Good');
  assert.equal(good.cells.find((cell) => cell.predicted === 'APPROVE').count, 118);
});
