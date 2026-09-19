// Twelve invented portfolios run against twenty policy rules each: two hundred and forty checks, one
// rule against one portfolio. Twenty-six are breaches. Thirty sit just inside the tolerance, which is
// where a checklist tool cries wolf. Eight breach only if you read the rule one way, which is where
// compliance actually lives. Labels go to data/synthetic/mandate-compliance.labels.json.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';

export const SEED = 1145;

const PORTFOLIOS = [
  { id: 'P-ALPHA', name: 'Alpha Pension Scheme', mandate: 'Global equities, long only' },
  { id: 'P-BETA', name: 'Beta Charitable Trust', mandate: 'Income, UK and Europe' },
  { id: 'P-GAMMA', name: 'Gamma Insurance General Account', mandate: 'Investment grade credit' },
  { id: 'P-DELTA', name: 'Delta Family Office', mandate: 'Multi-asset, unconstrained' },
  { id: 'P-EPSILON', name: 'Epsilon University Endowment', mandate: 'Long horizon, total return' },
  { id: 'P-ZETA', name: 'Zeta Local Authority Fund', mandate: 'Liability matching' },
  { id: 'P-ETA', name: 'Eta Corporate Reserve', mandate: 'Capital preservation' },
  { id: 'P-THETA', name: 'Theta Growth Mandate', mandate: 'Concentrated growth equities' },
  { id: 'P-IOTA', name: 'Iota Balanced Fund', mandate: 'Balanced, retail' },
  { id: 'P-KAPPA', name: 'Kappa Sovereign Sleeve', mandate: 'Government bonds and cash' },
  { id: 'P-LAMBDA', name: 'Lambda Absolute Return', mandate: 'Absolute return, derivatives permitted' },
  { id: 'P-MU', name: 'Mu Ethical Fund', mandate: 'Screened equities' },
];

/** The policy, in the words a policy is written in, with the tolerance each rule carries. */
export const RULES = [
  { id: 'R01', kind: 'SINGLE_NAME', text: 'No single issuer may exceed 8% of the portfolio at any measurement date.', limit: 8, unit: '%', tolerance: 0.25, measure: 'largest single issuer' },
  { id: 'R02', kind: 'SINGLE_NAME', text: 'No single issuer may exceed 10% on a look-through basis, treating a parent and its subsidiaries as one issuer.', limit: 10, unit: '%', tolerance: 0.25, measure: 'largest issuer, looked through' },
  { id: 'R03', kind: 'SINGLE_NAME', text: 'The five largest holdings together may not exceed 35%.', limit: 35, unit: '%', tolerance: 0.5, measure: 'top five holdings' },
  { id: 'R04', kind: 'SECTOR', text: 'No sector may exceed 25% of the portfolio.', limit: 25, unit: '%', tolerance: 0.5, measure: 'largest sector' },
  { id: 'R05', kind: 'SECTOR', text: 'Financials may not exceed 30%, counting banks, insurers and asset managers together.', limit: 30, unit: '%', tolerance: 0.5, measure: 'financials' },
  { id: 'R06', kind: 'SECTOR', text: 'Exposure to any one country outside the home market may not exceed 20%.', limit: 20, unit: '%', tolerance: 0.5, measure: 'largest foreign country' },
  { id: 'R07', kind: 'CREDIT_QUALITY', text: 'The average credit rating of the bond sleeve must be A- or better.', limit: 7, unit: 'notches below AAA', tolerance: 0.25, measure: 'average rating' },
  { id: 'R08', kind: 'CREDIT_QUALITY', text: 'No more than 5% may be held in bonds rated below investment grade.', limit: 5, unit: '%', tolerance: 0.25, measure: 'sub-investment grade' },
  { id: 'R09', kind: 'CREDIT_QUALITY', text: 'Unrated issues may not exceed 2%.', limit: 2, unit: '%', tolerance: 0.1, measure: 'unrated' },
  { id: 'R10', kind: 'LIQUIDITY', text: 'At least 80% of the portfolio must be sellable within five business days at normal volumes.', limit: 80, unit: '%', tolerance: 1, measure: 'sellable in five days', floor: true },
  { id: 'R11', kind: 'LIQUIDITY', text: 'Cash and cash equivalents must be at least 2% and no more than 15%.', limit: 15, unit: '%', tolerance: 0.5, measure: 'cash and equivalents' },
  { id: 'R12', kind: 'LIQUIDITY', text: 'No holding may represent more than three days of its own average trading volume.', limit: 3, unit: 'days', tolerance: 0.2, measure: 'largest position in days of volume' },
  { id: 'R13', kind: 'LEVERAGE', text: 'Gross exposure may not exceed 100% of net asset value.', limit: 100, unit: '%', tolerance: 1, measure: 'gross exposure' },
  { id: 'R14', kind: 'LEVERAGE', text: 'Borrowing for investment purposes is not permitted; settlement overdrafts are not borrowing.', limit: 0, unit: '%', tolerance: 0.1, measure: 'borrowing' },
  { id: 'R15', kind: 'LEVERAGE', text: 'Derivative exposure may not exceed 10% of net asset value, measured by notional.', limit: 10, unit: '%', tolerance: 0.5, measure: 'derivative notional' },
  { id: 'R16', kind: 'PROHIBITED', text: 'Tobacco, controversial weapons and thermal coal are prohibited.', limit: 0, unit: '%', tolerance: 0, measure: 'prohibited holdings' },
  { id: 'R17', kind: 'PROHIBITED', text: 'Unlisted securities are prohibited without written consent.', limit: 0, unit: '%', tolerance: 0, measure: 'unlisted holdings' },
  { id: 'R18', kind: 'PROHIBITED', text: 'Commodities may not be held directly.', limit: 0, unit: '%', tolerance: 0, measure: 'direct commodities' },
  { id: 'R19', kind: 'SECTOR', text: 'Emerging markets may not exceed 15%.', limit: 15, unit: '%', tolerance: 0.5, measure: 'emerging markets' },
  { id: 'R20', kind: 'SINGLE_NAME', text: 'No holding in a company where the manager holds more than 5% of the issued share capital.', limit: 5, unit: '%', tolerance: 0.1, measure: 'largest stake in an issuer' },
];

export const DEFINITIONS = {
  cash: 'Cash means deposits and money market funds with daily dealing. Government bills under three months count as cash.',
  lookThrough: 'Look-through means a parent and any company it controls count as one issuer, including holdings reached through funds.',
  measurement: 'Everything is measured at market value on the measurement date, after trades settle.',
  ratings: 'Where two agencies disagree, the lower rating applies. Notches are counted from AAA: A- is seven notches.',
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];

  // Each portfolio gets every rule. What is planted is which of those checks is a breach, which sits
  // just inside the tolerance, and which depends on how the rule is read.
  const plan = new Map();
  const cells = PORTFOLIOS.flatMap((portfolio) => RULES.map((rule) => `${portfolio.id}|${rule.id}`));
  for (const cell of random.sample(cells, 26)) plan.set(cell, 'breach');
  // A rule that forbids something outright has no tolerance, so nothing can sit just inside it.
  const withTolerance = cells.filter((entry) => !plan.has(entry) && RULES.find((rule) => rule.id === entry.split('|')[1]).tolerance > 0);
  for (const cell of random.sample(withTolerance, 30)) plan.set(cell, 'near miss');
  const interpretable = cells.filter((entry) => !plan.has(entry) && ['R02', 'R11', 'R14', 'R16'].includes(entry.split('|')[1]));
  for (const cell of random.sample(interpretable, 8)) plan.set(cell, 'depends how you read it');

  for (const portfolio of PORTFOLIOS) {
    for (const rule of RULES) {
      const kind = plan.get(`${portfolio.id}|${rule.id}`) ?? 'clear pass';
      const item = check(random, { portfolio, rule, kind });
      items.push(item);
      labels.push({ checkId: item.id, breach: kind === 'breach', kind, ruleKind: rule.kind });
    }
  }

  return {
    dataset: {
      id: 'mandate-compliance',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/mandate-compliance.js',
      context: {
        manager: 'Ravenhill Advisers',
        measurementDate: '2026-08-31',
        definitions: DEFINITIONS,
        portfolios: PORTFOLIOS,
        note: 'Invented portfolios and an invented policy. The rules are written the way policies are written, which is the point of the demo.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One check: one rule, one portfolio, and the numbers that rule asks about. */
function check(random, { portfolio, rule, kind }) {
  const { measured, note } = measurement(random, rule, kind);
  return {
    id: `${portfolio.id}-${rule.id}`,
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    mandate: portfolio.mandate,
    ruleId: rule.id,
    ruleKind: rule.kind,
    rule: rule.text,
    limit: rule.limit,
    limitUnit: rule.unit,
    limitIsAFloor: Boolean(rule.floor),
    tolerance: rule.tolerance,
    whatIsMeasured: rule.measure,
    measuredValue: measured,
    measurementNote: note,
  };
}
// #endregion

/**
 * The number this check is about. A breach is over the limit; a near miss is inside the tolerance on
 * the wrong side of nothing; and the awkward ones are exactly at the limit with a note that decides it.
 */
function measurement(random, rule, kind) {
  const floor = Boolean(rule.floor);
  const over = (amount) => round(floor ? rule.limit - amount : rule.limit + amount, 2);
  const under = (amount) => round(floor ? rule.limit + amount : rule.limit - amount, 2);

  if (kind === 'breach') {
    return { measured: over(Math.max(rule.tolerance * 2, rule.limit * random.float(0.06, 0.35, 3)) + random.float(0.1, 1.2, 2)), note: null };
  }
  if (kind === 'near miss') {
    return { measured: under(random.float(0.02, Math.max(0.05, rule.tolerance), 3)), note: 'Inside the tolerance the policy allows.' };
  }
  if (kind === 'depends how you read it') {
    return { measured: over(random.float(0.4, 2.4, 2)), note: LOOSE[rule.id] };
  }
  return { measured: under(Math.max(rule.tolerance * 3, rule.limit * random.float(0.12, 0.6, 3))), note: null };
}

/** The sentence that makes an apparent breach a question rather than an answer. */
const LOOSE = {
  R02: 'Two of these holdings are separately listed subsidiaries of the same parent. Counted apart they are inside the limit; looked through they are not.',
  R11: 'The figure includes a money market fund with daily dealing and a government bill maturing in six weeks. The definitions count the first as cash and are silent on the second.',
  R14: 'The overdraft was a settlement timing difference on the measurement date and cleared the next morning. The policy says settlement overdrafts are not borrowing.',
  R16: 'The holding is a diversified industrial group with a small tobacco distribution arm, below 5% of its revenue. The prohibition does not say whether revenue share matters.',
};
