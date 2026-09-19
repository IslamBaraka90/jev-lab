// Three hundred transaction-monitoring alerts from an invented bank's rule engine, across two hundred
// and ten invented customers. Twelve are worth an analyst's time; thirty are spikes with an ordinary
// explanation sitting in the customer's own file. Everything else is the noise a threshold makes.
// What is planted goes to data/synthetic/aml-alert-triage.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { companyName, merchantName, personName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1123;

const THRESHOLD = 3_000;

export const SCENARIOS = {
  STRUCTURING: 'Several cash credits below the reporting threshold within a few days',
  RAPID_MOVEMENT: 'Funds in and out again within twenty-four hours',
  CORRIDOR: 'Payments to or from a corridor the bank rates as higher risk',
  DORMANT: 'An account with no activity for months, suddenly busy',
  VOLUME: 'Monthly turnover well above what the customer said to expect',
};

const OCCUPATIONS = ['Independent hairdresser', 'Retired', 'Bus driver', 'Nurse', 'Software contractor', 'Teaching assistant', 'Plumber', 'Student', 'Care worker', 'Taxi driver'];
const BUSINESSES = ['Garden centre', 'Corner shop', 'Car repairs', 'Takeaway', 'Nail salon', 'Builders merchant', 'Import and export of textiles', 'Mobile phone accessories', 'Second-hand car sales', 'Wholesale food'];
const CORRIDORS = [
  { route: 'United Kingdom to Ireland', risk: 'low' },
  { route: 'United Kingdom to Germany', risk: 'low' },
  { route: 'United Kingdom to Poland', risk: 'low' },
  { route: 'United Kingdom to United Arab Emirates', risk: 'medium' },
  { route: 'United Kingdom to Turkey', risk: 'medium' },
  { route: 'United Kingdom to Nigeria', risk: 'high' },
  { route: 'United Kingdom to Lebanon', risk: 'high' },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 4; index++) add(structuring(random), { truePositive: true, typology: 'STRUCTURING', kind: 'worth an analyst' });
  for (let index = 0; index < 3; index++) add(muleActivity(random), { truePositive: true, typology: 'MULE_ACTIVITY', kind: 'worth an analyst' });
  for (let index = 0; index < 3; index++) add(tradeBased(random), { truePositive: true, typology: 'TRADE_BASED', kind: 'worth an analyst' });
  for (let index = 0; index < 2; index++) add(thirdParty(random), { truePositive: true, typology: 'THIRD_PARTY_FUNDING', kind: 'worth an analyst' });
  for (const look of explainableList(random)) add(look.item, { truePositive: false, typology: 'NONE', kind: 'explained in the file', look: look.look });
  for (let index = 0; index < 258; index++) add(everyday(random), { truePositive: false, typology: 'NONE', kind: 'everyday' });

  items.sort((left, right) => left.firedAt.localeCompare(right.firedAt) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `AML-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).alertId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'aml-alert-triage',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/aml-alert-triage.js',
      context: {
        bank: 'Wrenfield Bank',
        currency: 'GBP',
        period: 'Alerts raised in August 2026',
        cashReportingThreshold: THRESHOLD,
        scenarios: Object.entries(SCENARIOS).map(([id, description]) => ({ id, description })),
        analystCapacity: 'Two analysts can work about fifty alerts a week properly.',
        wording: 'This demo closes, monitors or escalates an alert. It does not decide whether anything is reported to an authority, and nothing here is a suspicious activity report.',
        note: 'Illustrative synthetic data. Not a substitute for a regulated monitoring system, and not a filing decision.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One alert: the rule that fired, what set it off, and ninety days of the account around it. */
function alert(random, { scenario, triggerCount, triggerTotal, customerType, statedActivity, expectedMonthly, credits, creditTotal, debits, debitTotal, counterparties, cashSharePercent, corridor, onboardingRisk, monthsDormant = 0, priorAlerts = 0, priorOutcome = 'No earlier alerts', relationshipNote, triggering }) {
  return {
    key: `${scenario}-${random.int(100_000, 999_999)}`,
    id: null,
    firedAt: random.day('2026-08-01', '2026-08-31'),
    scenario,
    triggeringPayments: triggerCount,
    triggeringTotal: triggerTotal,
    customerType,
    statedActivity,
    expectedMonthlyTurnover: expectedMonthly,
    creditsIn90Days: credits,
    creditTotal90Days: creditTotal,
    debitsIn90Days: debits,
    debitTotal90Days: debitTotal,
    distinctCounterparties90Days: counterparties,
    cashSharePercent,
    mainCorridor: corridor.route,
    corridorRisk: corridor.risk,
    onboardingRisk,
    monthsDormantBefore: monthsDormant,
    priorAlerts,
    priorOutcome,
    relationshipNote,
    triggeringPaymentList: triggering,
  };
}
// #endregion

const payments = (random, { count, min, max, kind, counterparty }) => Array.from({ length: count }, (_, index) => ({
  day: `08-${String(random.int(1, 28)).padStart(2, '0')}`,
  amount: amount(random, { min, max }),
  kind,
  counterparty: typeof counterparty === 'function' ? counterparty() : counterparty,
})).sort((left, right) => left.day.localeCompare(right.day));

/** Nine or ten cash credits, each a few hundred under the reporting threshold. */
function structuring(random) {
  const count = random.int(8, 11);
  const list = payments(random, { count, min: THRESHOLD - 700, max: THRESHOLD - 90, kind: 'Cash credit', counterparty: 'Branch counter' });
  const cash = round(list.reduce((sum, entry) => sum + entry.amount, 0));
  return alert(random, {
    scenario: SCENARIOS.STRUCTURING,
    triggerCount: count,
    triggerTotal: cash,
    customerType: 'Personal',
    statedActivity: random.pick(['Retired', 'Care worker', 'Teaching assistant']),
    expectedMonthly: amount(random, { min: 1_400, max: 3_200 }),
    credits: count + random.int(2, 6),
    creditTotal: round(cash * random.float(1.05, 1.25)),
    debits: random.int(10, 24),
    debitTotal: round(cash * random.float(0.85, 1.02)),
    counterparties: random.int(4, 9),
    cashSharePercent: random.int(84, 98),
    corridor: CORRIDORS[0],
    onboardingRisk: 'low',
    priorAlerts: random.int(0, 1),
    relationshipNote: 'Counter staff note the customer asks how much can be paid in without paperwork.',
    triggering: list,
  });
}

/** Money from a crowd of individuals, gone again the same day. */
function muleActivity(random) {
  const count = random.int(14, 26);
  const list = payments(random, { count, min: 120, max: 900, kind: 'Faster payment in', counterparty: () => personName(random) });
  const total = round(list.reduce((sum, entry) => sum + entry.amount, 0));
  return alert(random, {
    scenario: SCENARIOS.RAPID_MOVEMENT,
    triggerCount: count,
    triggerTotal: total,
    customerType: 'Personal',
    statedActivity: random.pick(['Student', 'Care worker', 'Bus driver']),
    expectedMonthly: amount(random, { min: 600, max: 1_600 }),
    credits: count + random.int(4, 15),
    creditTotal: round(total * random.float(1.4, 2.2)),
    debits: random.int(18, 40),
    debitTotal: round(total * random.float(1.35, 2.1)),
    counterparties: count + random.int(5, 20),
    cashSharePercent: random.int(2, 14),
    corridor: random.pick(CORRIDORS.slice(0, 4)),
    onboardingRisk: 'low',
    priorAlerts: random.int(0, 2),
    priorOutcome: random.pick(['One earlier alert, closed', 'No earlier alerts']),
    relationshipNote: 'Account opened four months ago. Balance returns to nearly nil within a day of each credit.',
    triggering: list,
  });
}

/** Invoices that do not match the goods, into a corridor the bank watches. */
function tradeBased(random) {
  const count = random.int(3, 6);
  const list = payments(random, { count, min: 18_000, max: 90_000, kind: 'International payment out', counterparty: () => `${companyName(random)} FZE` });
  const total = round(list.reduce((sum, entry) => sum + entry.amount, 0));
  return alert(random, {
    scenario: SCENARIOS.CORRIDOR,
    triggerCount: count,
    triggerTotal: total,
    customerType: 'Business',
    statedActivity: random.pick(['Mobile phone accessories', 'Import and export of textiles', 'Wholesale food']),
    expectedMonthly: amount(random, { min: 25_000, max: 60_000 }),
    credits: random.int(6, 14),
    creditTotal: round(total * random.float(0.9, 1.1)),
    debits: random.int(8, 18),
    debitTotal: round(total * random.float(1, 1.15)),
    counterparties: random.int(3, 7),
    cashSharePercent: random.int(0, 6),
    corridor: random.pick(CORRIDORS.slice(4)),
    onboardingRisk: 'medium',
    priorAlerts: random.int(1, 3),
    priorOutcome: 'Two earlier alerts, both closed with no further action',
    relationshipNote: 'Invoices describe mixed consumer goods at round unit prices, and the weights on the shipping papers do not match the values.',
    triggering: list,
  });
}

/** A personal account funded by a company nobody can connect to the customer. */
function thirdParty(random) {
  const company = `${companyName(random)} Ltd`;
  const list = payments(random, { count: random.int(2, 4), min: 9_000, max: 38_000, kind: 'Payment in', counterparty: company });
  const total = round(list.reduce((sum, entry) => sum + entry.amount, 0));
  return alert(random, {
    scenario: SCENARIOS.VOLUME,
    triggerCount: list.length,
    triggerTotal: total,
    customerType: 'Personal',
    statedActivity: random.pick(['Nurse', 'Plumber', 'Taxi driver']),
    expectedMonthly: amount(random, { min: 1_800, max: 3_400 }),
    credits: random.int(8, 18),
    creditTotal: round(total * random.float(1.02, 1.2)),
    debits: random.int(12, 26),
    debitTotal: round(total * random.float(0.95, 1.05)),
    counterparties: random.int(6, 14),
    cashSharePercent: random.int(3, 18),
    corridor: CORRIDORS[0],
    onboardingRisk: 'low',
    priorAlerts: 0,
    relationshipNote: `${company} is not named anywhere in the customer file, and the money leaves again to two personal accounts within the week.`,
    triggering: list,
  });
}

/** Thirty spikes with an ordinary explanation already sitting in the customer's file. */
function explainableList(random) {
  const kinds = [
    ...Array.from({ length: 8 }, () => 'a property sale'),
    ...Array.from({ length: 8 }, () => 'a bonus or redundancy payment'),
    ...Array.from({ length: 8 }, () => 'a seasonal business'),
    ...Array.from({ length: 6 }, () => 'money collected for a wedding'),
  ];
  return kinds.map((look) => ({ look, item: explainable(random, look) }));
}

function explainable(random, look) {
  if (look === 'a property sale') {
    const total = amount(random, { min: 180_000, max: 520_000 });
    return alert(random, {
      scenario: SCENARIOS.VOLUME, triggerCount: 1, triggerTotal: total, customerType: 'Personal',
      statedActivity: random.pick(OCCUPATIONS), expectedMonthly: amount(random, { min: 1_800, max: 4_200 }),
      credits: random.int(9, 20), creditTotal: round(total * 1.02), debits: random.int(14, 30), debitTotal: round(total * random.float(0.1, 0.3)),
      counterparties: random.int(8, 16), cashSharePercent: random.int(0, 8), corridor: CORRIDORS[0], onboardingRisk: 'low',
      priorAlerts: 0, relationshipNote: 'Single credit from a firm of solicitors, reference matches a house sale. The customer told the branch in June.',
      triggering: [{ day: `08-${random.int(3, 24)}`, amount: total, kind: 'Payment in', counterparty: `${merchantName(random).split(' ')[0]} & Co Solicitors` }],
    });
  }
  if (look === 'a bonus or redundancy payment') {
    const total = amount(random, { min: 12_000, max: 70_000 });
    return alert(random, {
      scenario: SCENARIOS.VOLUME, triggerCount: 1, triggerTotal: total, customerType: 'Personal',
      statedActivity: random.pick(['Software contractor', 'Nurse', 'Bus driver']), expectedMonthly: amount(random, { min: 2_400, max: 6_000 }),
      credits: random.int(6, 14), creditTotal: round(total * 1.3), debits: random.int(10, 26), debitTotal: round(total * random.float(0.2, 0.5)),
      counterparties: random.int(7, 15), cashSharePercent: random.int(0, 6), corridor: CORRIDORS[0], onboardingRisk: 'low',
      priorAlerts: 0, relationshipNote: 'The credit is from the same employer that has paid this salary every month for four years, with the same payroll reference.',
      triggering: [{ day: `08-${random.int(20, 28)}`, amount: total, kind: 'Payment in', counterparty: `${companyName(random)} Payroll` }],
    });
  }
  if (look === 'a seasonal business') {
    const total = amount(random, { min: 40_000, max: 160_000 });
    return alert(random, {
      scenario: SCENARIOS.VOLUME, triggerCount: random.int(20, 60), triggerTotal: total, customerType: 'Business',
      statedActivity: random.pick(['Garden centre', 'Corner shop', 'Takeaway']), expectedMonthly: amount(random, { min: 18_000, max: 45_000 }),
      credits: random.int(120, 400), creditTotal: round(total * 1.1), debits: random.int(60, 180), debitTotal: round(total * 0.9),
      counterparties: random.int(30, 90), cashSharePercent: random.int(30, 62), corridor: CORRIDORS[0], onboardingRisk: 'medium',
      priorAlerts: random.int(1, 3), priorOutcome: 'Alerted in the same month last year and the year before, closed both times',
      relationshipNote: 'Turnover triples every August and falls back in October, the same shape as the last three years on file.',
      triggering: payments(random, { count: 4, min: 900, max: 6_000, kind: 'Card takings', counterparty: 'Card acquirer' }),
    });
  }
  const total = amount(random, { min: 4_000, max: 16_000 });
  return alert(random, {
    scenario: SCENARIOS.RAPID_MOVEMENT, triggerCount: random.int(12, 30), triggerTotal: total, customerType: 'Personal',
    statedActivity: random.pick(OCCUPATIONS), expectedMonthly: amount(random, { min: 1_600, max: 3_600 }),
    credits: random.int(20, 44), creditTotal: round(total * 1.15), debits: random.int(10, 22), debitTotal: round(total * 0.95),
    counterparties: random.int(18, 40), cashSharePercent: random.int(4, 20), corridor: CORRIDORS[0], onboardingRisk: 'low',
    priorAlerts: 0, relationshipNote: 'Many small credits with the same reference from family names, then one payment out to a hotel and one to a caterer.',
    triggering: payments(random, { count: 6, min: 50, max: 800, kind: 'Faster payment in', counterparty: () => personName(random) }),
  });
}

/** The rest of the queue: thresholds doing what thresholds do. */
function everyday(random) {
  const business = random.bool(0.4);
  const expected = business ? amount(random, { min: 12_000, max: 90_000 }) : amount(random, { min: 1_200, max: 5_000 });
  const creditTotal = round(expected * random.float(0.7, 1.6));
  const corridor = random.weighted([[CORRIDORS[0], 40], [CORRIDORS[1], 14], [CORRIDORS[2], 14], [CORRIDORS[3], 12], [CORRIDORS[4], 10], [CORRIDORS[5], 6], [CORRIDORS[6], 4]]);
  const scenario = random.pick(Object.values(SCENARIOS));
  return alert(random, {
    scenario,
    triggerCount: random.int(1, 9),
    triggerTotal: round(creditTotal * random.float(0.08, 0.4)),
    customerType: business ? 'Business' : 'Personal',
    statedActivity: business ? random.pick(BUSINESSES) : random.pick(OCCUPATIONS),
    expectedMonthly: expected,
    credits: random.int(6, business ? 160 : 40),
    creditTotal,
    debits: random.int(8, business ? 120 : 44),
    debitTotal: round(creditTotal * random.float(0.8, 1.05)),
    counterparties: random.int(4, business ? 60 : 22),
    cashSharePercent: business ? random.int(0, 45) : random.int(0, 30),
    corridor,
    onboardingRisk: random.weighted([['low', 72], ['medium', 22], ['high', 6]]),
    monthsDormant: scenario === SCENARIOS.DORMANT ? random.int(6, 26) : 0,
    priorAlerts: random.weighted([[0, 62], [1, 24], [2, 10], [3, 4]]),
    priorOutcome: random.pick(['No earlier alerts', 'One earlier alert, closed', 'Two earlier alerts, both closed']),
    relationshipNote: random.pick([
      'Nothing recorded on the relationship file this year.',
      'Branch knows the customer, no concerns raised.',
      'Account behaves much as it did last year.',
      'Customer updated their address in March, nothing else on file.',
    ]),
    triggering: payments(random, { count: random.int(1, 4), min: 200, max: business ? 9_000 : 2_500, kind: random.pick(['Payment in', 'Payment out', 'Cash credit']), counterparty: () => (business ? companyName(random) : personName(random)) }),
  });
}
