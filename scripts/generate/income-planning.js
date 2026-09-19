// Forty synthetic income accounts with deterministic payment schedules. Each cohort is constructed
// from the same visible monthly arithmetic used by the labels: annual insufficiency, timing only,
// idle cash, or no issue.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';

export const SEED = 1146;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const RELIABILITY = {
  monthly: 'declared monthly distribution; amount may vary',
  quarterly: 'declared quarterly dividend; amount estimated',
  semiannual: 'contractual coupon; date declared',
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  for (let index = 0; index < 9; index++) add(items, labels, random, 'SHORTFALL', index);
  for (let index = 0; index < 6; index++) add(items, labels, random, 'TIMING', index);
  for (let index = 0; index < 5; index++) add(items, labels, random, 'CASH_DRAG', index);
  for (let index = 0; index < 20; index++) add(items, labels, random, 'NONE', index);
  return {
    dataset: {
      id: 'income-planning', class: 'synthetic', generatedAt: '2026-09-19', seed,
      source: 'scripts/generate/income-planning.js',
      context: {
        currency: 'USD', horizon: 'next twelve calendar months',
        interpretation: 'A shortfall means annual resources are insufficient. Timing means annual income covers commitments but projected cash still falls below zero before income arrives. A negative monthly income-minus-commitment row is not an actionable gap when existing cash keeps projected cash non-negative. For a shortfall or timing problem, worst month means the most negative monthly_gap_usd, not a later month with the lowest accumulated cash. Cash drag means idle cash exceeds six average months of commitments. Cash-drag and no-problem accounts use no worst month.',
        researchOnly: 'Synthetic teaching scenario only. This is not investment, tax or cash-management advice.',
      },
      items,
    },
    labels,
  };
}

function add(items, labels, random, issue, cohortIndex) {
  const id = `IP-${String(items.length + 1).padStart(2, '0')}`;
  const worstIndex = (cohortIndex * 2 + (issue === 'TIMING' ? 1 : 0)) % 10;
  const holdings = holdingsFor(random, issue);
  const income = incomeSchedule(holdings);
  const regular = issue === 'NONE' ? random.int(1_600, 2_100) : random.int(2_700, 3_300);
  const commitments = MONTHS.map(() => regular);
  if (issue === 'SHORTFALL') commitments[worstIndex] += random.int(25_000, 31_000);
  if (issue === 'TIMING') commitments[worstIndex] += random.int(22_000, 27_000);
  const annualIncome = income.reduce((sum, value) => sum + value, 0);
  let annualCommitments = commitments.reduce((sum, value) => sum + value, 0);
  if (issue === 'TIMING' && annualIncome < annualCommitments + 1_000) {
    commitments[worstIndex] -= annualCommitments + 1_000 - annualIncome;
    annualCommitments = commitments.reduce((sum, value) => sum + value, 0);
  }
  let startingCash;
  if (issue === 'SHORTFALL') startingCash = random.int(2_000, 5_000);
  else if (issue === 'TIMING') startingCash = random.int(2_000, 4_500);
  else if (issue === 'CASH_DRAG') startingCash = random.int(125_000, 175_000);
  else startingCash = random.int(6_000, 9_000);
  let cash = startingCash;
  const calendar = MONTHS.map((month, index) => {
    cash += income[index] - commitments[index];
    return { month, income: income[index], commitment: commitments[index], gap: income[index] - commitments[index], projectedCash: round(cash) };
  });
  const worstMonth = issue === 'SHORTFALL' || issue === 'TIMING' ? MONTHS[worstIndex] : 'NONE';
  const averageCommitment = annualCommitments / 12;
  items.push({
    id,
    owner: `Household ${String(items.length + 1).padStart(2, '0')}`,
    startingCash,
    holdings,
    commitments: { regularMonthlyWithdrawal: regular, special: worstMonth === 'NONE' ? [] : [{ month: worstMonth, amount: commitments[worstIndex] - regular, purpose: issue === 'TIMING' ? 'school fee due before the large coupon' : 'property instalment and tax payment' }] },
    annualIncome, annualCommitments, averageMonthlyCommitment: round(averageCommitment),
    cashMonthsAtStart: round(startingCash / averageCommitment, 1),
    minimumProjectedCash: Math.min(...calendar.map((entry) => entry.projectedCash)),
    saleRule: issue === 'CASH_DRAG' ? 'Do not sell; invest only cash not needed within six months.' : 'Selling is allowed only to meet a dated commitment that income and cash cannot cover.',
    calendar,
  });
  labels.push({ accountId: id, issue, worstMonth, sellNeeded: issue === 'SHORTFALL' || issue === 'TIMING' });
}

function holdingsFor(random, issue) {
  const boost = issue === 'TIMING' ? 1.9 : issue === 'CASH_DRAG' ? 1.25 : issue === 'NONE' ? 1.1 : 1;
  return [
    { symbol: 'MONTHLY-INCOME-FUND', kind: 'monthly fund', schedule: [...MONTHS], amountPerPayment: Math.round(random.int(850, 1_150) * boost), reliability: RELIABILITY.monthly },
    { symbol: 'DIVIDEND-EQUITY-BASKET', kind: 'quarterly equity dividends', schedule: ['MAR', 'JUN', 'SEP', 'DEC'], amountPerPayment: Math.round(random.int(2_500, 3_300) * boost), reliability: RELIABILITY.quarterly },
    { symbol: 'INVESTMENT-GRADE-BOND', kind: 'semi-annual coupon', schedule: ['JUN', 'DEC'], amountPerPayment: Math.round(random.int(4_800, 6_200) * boost), reliability: RELIABILITY.semiannual },
  ];
}

// #region demo:data
function incomeSchedule(holdings) {
  return MONTHS.map((month) => holdings.reduce((sum, holding) => sum + (holding.schedule.includes(month) ? holding.amountPerPayment : 0), 0));
}
// #endregion
