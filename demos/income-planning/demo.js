// Income and cash planning: Jev sees every expected payment, every commitment and the account's cash
// rule. Annual insufficiency and poor timing remain separate outcomes in both grading and reporting.

import { choice, noul, score } from '../lib/questions.js';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PROBLEMS = ['SHORTFALL', 'TIMING', 'CASH_DRAG', 'NONE'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const percent = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Check whether portfolio income and existing cash cover commitments when due. Distinguish annual insufficiency from income that arrives too late, and do not call a covered monthly gap a timing problem.',
    policy: { interpretation: context.interpretation, sale_rule: item.saleRule, note: context.researchOnly },
    account: { starting_cash_usd: item.startingCash, annual_income_usd: item.annualIncome, annual_commitments_usd: item.annualCommitments, average_monthly_commitment_usd: item.averageMonthlyCommitment, cash_months_at_start: item.cashMonthsAtStart, six_month_cash_drag_threshold_usd: Math.round(item.averageMonthlyCommitment * 6), minimum_projected_cash_usd: item.minimumProjectedCash },
    holdings_and_payment_reliability: item.holdings,
    dated_commitments: item.commitments,
    twelve_month_calendar: item.calendar.map((entry) => ({ month: entry.month, expected_income_usd: entry.income, commitments_usd: entry.commitment, monthly_gap_usd: entry.gap, projected_cash_after_month_usd: entry.projectedCash })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  coverage: score('How well are the next twelve months covered?', ['None', 'Severe shortfall', 'Shortfall', 'Tight', 'Adequate', 'Comfortable', 'Ample']),
  problem: choice('What is the account’s main cash-planning problem?', {
    SHORTFALL: 'Annual income plus usable cash is insufficient for the commitments.',
    TIMING: 'Annual income is enough, but projected cash falls below zero before that income arrives.',
    CASH_DRAG: 'The plan works but cash above six months of commitments remains idle.',
    NONE: 'Income and a proportionate cash buffer cover the schedule without a sale.',
  }),
  worst_month: choice('Which month has the worst actionable gap? For SHORTFALL or TIMING choose the month with the most negative monthly_gap_usd, not a later month with the lowest accumulated cash. CASH_DRAG and NONE must answer NONE.', { ...Object.fromEntries(MONTHS.map((month) => [month, `${month}, if it has the most negative monthly income-minus-commitment gap.`])), NONE: 'No actionable gap month: use this for CASH_DRAG and NONE.' }),
  sell_needed: noul('Must something be sold to meet a dated commitment under the stated rule?', { yes: 'Income and permitted cash do not cover a dated commitment.', no: 'No sale is required.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  const worst = [...item.calendar].sort((left, right) => left.gap - right.gap)[0];
  return {
    coverage: answers.coverage.score,
    problem: answers.problem.choice,
    worstMonth: answers.worst_month.choice,
    sellNeeded: answers.sell_needed.noul >= 0.5,
    confidence: answers.problem.confidence,
    worstGap: worst.gap,
    label: `${item.id} · ${title(answers.problem.choice)} · ${answers.worst_month.choice} · ${answers.coverage.score.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byItem = new Map((context.labels ?? []).map((label) => [label.accountId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const problemCorrect = graded.filter((result) => result.evaluation.problem === byItem.get(result.item.id).issue);
  const monthCorrect = graded.filter((result) => result.evaluation.worstMonth === byItem.get(result.item.id).worstMonth);
  const coverageCorrect = graded.filter((result) => coverageMatches(result.evaluation.coverage, byItem.get(result.item.id).issue));
  const cashDrag = graded.filter((result) => byItem.get(result.item.id).issue === 'CASH_DRAG');
  const cashDragFound = cashDrag.filter((result) => result.evaluation.problem === 'CASH_DRAG');
  const needsAction = graded.filter((result) => ['SHORTFALL', 'TIMING'].includes(byItem.get(result.item.id).issue));
  return {
    note: `Forty synthetic accounts: nine annual shortfalls, six timing-only gaps, five idle-cash cases and twenty with no issue. ${context.researchOnly ?? ''}`,
    findings: findings(graded, byItem),
    kpis: [
      { label: 'Coverage accuracy', value: `${coverageCorrect.length} of ${graded.length}`, context: 'score band checked against the planted issue', tone: coverageCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Problem named exactly', value: `${problemCorrect.length} of ${graded.length}`, context: percent(problemCorrect.length, graded.length), tone: problemCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Worst-month accuracy', value: `${monthCorrect.length} of ${graded.length}`, context: 'exactly against the labelled month or NONE', tone: monthCorrect.length === graded.length ? 'good' : 'warn' },
      { label: 'Cash drag identified', value: `${cashDragFound.length} of ${cashDrag.length}`, context: 'kept separate from shortfall and timing', tone: cashDragFound.length === cashDrag.length ? 'good' : 'warn' },
    ],
    distribution: PROBLEMS.map((problem) => ({ label: title(problem), count: graded.filter((result) => result.evaluation.problem === problem).length })).filter((entry) => entry.count),
    matrix: problemMatrix(graded, byItem),
    checks: [
      issueCheck('shortfall', 'Annual shortfalls missed', 'SHORTFALL', graded, byItem),
      issueCheck('timing', 'Timing-only gaps missed', 'TIMING', graded, byItem),
      issueCheck('cash-drag', 'Idle-cash cases missed', 'CASH_DRAG', graded, byItem),
      { id: 'month', label: 'Worst month wrong', detail: 'Exact month from the largest visible monthly gap; NONE for accounts without an actionable gap.', count: graded.length - monthCorrect.length, of: graded.length, items: graded.filter((result) => result.evaluation.worstMonth !== byItem.get(result.item.id).worstMonth).map((result) => result.item.id) },
    ],
    topItems: [...needsAction].sort((left, right) => left.evaluation.worstGap - right.evaluation.worstGap).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: money(result.evaluation.worstGap) })),
  };
}
// #endregion

function coverageMatches(scoreValue, issue) {
  if (issue === 'SHORTFALL') return scoreValue < 3;
  if (issue === 'TIMING') return scoreValue >= 2 && scoreValue < 4.5;
  if (issue === 'CASH_DRAG') return scoreValue >= 4;
  return scoreValue >= 3.5;
}

function issueCheck(id, label, issue, graded, byItem) {
  const cohort = graded.filter((result) => byItem.get(result.item.id).issue === issue);
  const missed = cohort.filter((result) => result.evaluation.problem !== issue);
  return { id, label, detail: questions.problem.criteria[issue], count: missed.length, of: cohort.length, items: missed.map((result) => result.item.id) };
}

function problemMatrix(graded, byItem) {
  return { title: 'Planted cash-planning issue against the issue Jev named', columns: PROBLEMS.map(title), rows: PROBLEMS.map((actual) => ({ label: title(actual), cells: PROBLEMS.map((predicted) => ({ predicted, count: graded.filter((result) => byItem.get(result.item.id).issue === actual && result.evaluation.problem === predicted).length, diagonal: actual === predicted })) })) };
}

function findings(graded, byItem) {
  const lines = [];
  const timingAsShortfall = graded.filter((result) => byItem.get(result.item.id).issue === 'TIMING' && result.evaluation.problem === 'SHORTFALL');
  if (timingAsShortfall.length) lines.push(`${timingAsShortfall.length} accounts with enough annual income were called shortfalls. Their problem is when the income lands, not how much arrives.`);
  const fineRaised = graded.filter((result) => byItem.get(result.item.id).issue === 'NONE' && result.evaluation.problem !== 'NONE');
  if (fineRaised.length) lines.push(`${fineRaised.length} adequately buffered accounts were given a problem they do not have.`);
  return lines;
}

export default {
  id: 'income-planning', title: 'Income and cash planning', domain: 'portfolio', status: 'pending-recording',
  value: 'Check whether the income a portfolio produces actually lands when the money is needed.',
  tags: ['portfolio', 'income', 'cash', 'calendar'], dataClass: 'synthetic', readMinutes: 4, view: 'calendar',
  itemLabel: (item) => `${item.id} · ${money(item.annualIncome)} income · ${money(item.annualCommitments)} commitments`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/income-planning.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/income-planning.js#demo:data', state: 'demos/income-planning/demo.js#demo:state', questions: 'demos/income-planning/demo.js#demo:questions', evaluate: 'demos/income-planning/demo.js#demo:evaluate' },
};
