// A hundred and twenty invented company-years, each with three years of statements and the notes that
// came with them. Forty-seven carry a planted pattern; ten of those forty-seven have a plain business
// reason for it written into the notes and nowhere else, so excusing them takes reading rather than
// arithmetic. The other seventy-three are clean. Labels go to
// data/synthetic/accounting-flags.labels.json, outside the demo folder.
//
// Every company here is fictional. The statements are built from sector-typical shapes so that each
// planted pattern is visible in the numbers, not just asserted in a note.

import { createRandom } from './lib/random.js';
import { LISTS } from './lib/names.js';

export const SEED = 1165;

/** What normal looks like in each sector, and what the state publishes as the comparison. */
export const SECTORS = [
  { id: 'retail', name: 'Retail', dso: 12, dio: 74, grossMarginPercent: 32, opexPercent: 26, capitalisedPercent: 3 },
  { id: 'software', name: 'Software', dso: 56, dio: 0, grossMarginPercent: 78, opexPercent: 62, capitalisedPercent: 9 },
  { id: 'industrial', name: 'Industrial', dso: 48, dio: 86, grossMarginPercent: 29, opexPercent: 19, capitalisedPercent: 4 },
  { id: 'healthcare', name: 'Healthcare', dso: 52, dio: 58, grossMarginPercent: 55, opexPercent: 42, capitalisedPercent: 7 },
  { id: 'construction', name: 'Construction', dso: 68, dio: 34, grossMarginPercent: 18, opexPercent: 11, capitalisedPercent: 2 },
  { id: 'media', name: 'Media', dso: 45, dio: 9, grossMarginPercent: 48, opexPercent: 37, capitalisedPercent: 11 },
];

const AUDITORS = ['Halbury Audit', 'Kestrel Assurance', 'Marlow & Co', 'Saltmarsh Partners', 'Beacon Audit LLP'];

const PLAN = [
  ['RECEIVABLES', 12, 3],
  ['INVENTORY', 9, 2],
  ['REVENUE_TIMING', 8, 2],
  ['CAPITALISED_COSTS', 7, 1],
  ['RELATED_PARTY', 6, 1],
  ['RESTATEMENT', 5, 1],
  ['NONE', 73, 0],
];

const SERIOUSNESS = { RECEIVABLES: 4, INVENTORY: 3, REVENUE_TIMING: 5, CAPITALISED_COSTS: 4, RELATED_PARTY: 4, RESTATEMENT: 5, NONE: 0 };

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const names = uniqueNames(random, 120);
  const rows = [];
  for (const [flag, count, decoys] of PLAN) {
    for (let index = 0; index < count; index++) rows.push({ flag, decoy: index < decoys });
  }

  const shuffled = random.shuffle(rows);
  const items = [];
  const labels = [];

  shuffled.forEach((row, index) => {
    const id = random.id('AF', index + 1);
    const second = secondFlag(random, row);
    items.push(companyYear(random, { id, name: names[index], ...row, second }));
    labels.push({
      companyYearId: id,
      flag: row.flag,
      decoy: row.decoy,
      seriousness: row.decoy ? 1 : SERIOUSNESS[row.flag],
      secondFlag: second ?? 'NONE',
    });
  });

  return {
    dataset: {
      id: 'accounting-flags',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/accounting-flags.js',
      context: {
        currency: 'USD',
        unit: 'thousands',
        years: ['two years ago', 'last year', 'the year being reviewed'],
        sectorNorms: SECTORS.map(({ id, name, dso, dio, grossMarginPercent }) => ({ sector: name, id, typicalDaysSalesOutstanding: dso, typicalDaysInventory: dio, typicalGrossMarginPercent: grossMarginPercent })),
        note: 'Invented companies and invented statements. Where a pattern has an innocent explanation it is written in the notes and nowhere else, which is the point of the exercise.',
      },
      items,
    },
    labels,
  };
}

/** A second pattern on some of the flagged years, so that naming one flag is not the whole job. Only
 *  patterns that leave the revenue line alone: an inventory build and a revenue pull-forward pull it
 *  in opposite directions, and a company carrying both shows neither. */
function secondFlag(random, row) {
  if (row.flag === 'NONE' || row.decoy || !random.bool(0.35)) return null;
  const others = ['RECEIVABLES', 'CAPITALISED_COSTS'].filter((flag) => flag !== row.flag);
  return random.pick(others);
}

/** One hundred and twenty distinct invented names, drawn from the shared word list. */
function uniqueNames(random, count) {
  const suffixes = ['Holdings', 'Group', 'Industries', 'Technologies', 'Resources', 'Partners', 'Corporation'];
  const all = LISTS.MERCHANT_WORDS.flatMap((word) => suffixes.map((suffix) => `${word} ${suffix}`));
  return random.shuffle(all).slice(0, count);
}

// #region demo:data
/** One company-year: three years of statements, the notes filed with them, and who signed them off. */
function companyYear(random, plan) {
  // An inventory build cannot be planted on a business that holds no stock, so those sectors are out.
  const holdsStock = (entry) => entry.dio >= 30;
  const sector = random.pick([plan.flag, plan.second].includes('INVENTORY') ? SECTORS.filter(holdsStock) : SECTORS);
  const shape = baseline(random, sector);
  const wobble = [0, 1, 2].map(() => ordinaryYear(random));
  const years = [0, 1, 2].map((offset) => statement(shape, wobble, offset, offset === 2 ? plan : {}));

  return {
    id: plan.id,
    company: plan.name,
    sector: sector.name,
    sectorId: sector.id,
    fiscalYearEnd: years[2].fiscalYearEnd,
    yearsOnFile: years.length,
    statements: years,
    notes: disclosures(random, plan, years),
    auditor: plan.flag === 'RESTATEMENT' && !plan.decoy ? random.pick(AUDITORS) : shape.auditor,
    auditorHistory: plan.flag === 'RESTATEMENT' && !plan.decoy
      ? [`${shape.auditor} signed the two earlier years`, 'a new firm was appointed for the year under review']
      : [`${shape.auditor} has signed all three years`],
  };
}

// #endregion

/** How much a perfectly ordinary year differs from the plan. Without this every clean company is a
 *  geometric progression, and a demo cannot claim a false-alarm rate on data that never wobbles. */
function ordinaryYear(random) {
  return {
    growth: random.float(0.82, 1.18, 3),
    dso: random.float(0.94, 1.06, 3),
    dio: random.float(0.92, 1.08, 3),
    conversion: random.float(0.92, 1.08, 3),
    margin: random.float(0.97, 1.03, 3),
  };
}

/** The unremarkable company this one starts as, before any pattern is planted on the last year. */
function baseline(random, sector) {
  return {
    revenue: random.int(42_000, 880_000),
    growth: random.float(0.02, 0.14, 3),
    grossMarginPercent: sector.grossMarginPercent + random.float(-4, 4, 1),
    opexPercent: sector.opexPercent + random.float(-3, 3, 1),
    dso: sector.dso + random.int(-5, 5),
    dio: sector.dio ? sector.dio + random.int(-8, 8) : 0,
    capitalisedPercent: sector.capitalisedPercent + random.float(-1.5, 1.5, 1),
    cashConversion: random.float(0.95, 1.25, 2),
    auditor: random.pick(AUDITORS),
  };
}

/** One year of statements: the shape, a year of ordinary wobble, and any pattern planted on the last one. */
function statement(shape, wobble, offset, plan) {
  const flags = [plan.flag, plan.second].filter(Boolean);
  const has = (name) => flags.includes(name);
  const noise = wobble[offset];
  const compound = wobble.slice(0, offset).reduce((factor, year) => factor * (1 + shape.growth * year.growth), 1);
  const revenue = Math.round(shape.revenue * compound * (has('INVENTORY') ? declining(shape) : 1) * (has('REVENUE_TIMING') ? 1.16 : 1));
  const grossProfit = Math.round(revenue * ((shape.grossMarginPercent * noise.margin) / 100));
  const costOfSales = revenue - grossProfit;
  const opex = Math.round(revenue * (shape.opexPercent / 100));
  const capitalisedPercent = has('CAPITALISED_COSTS') ? shape.capitalisedPercent + 17 : shape.capitalisedPercent;
  const capitalised = Math.round(opex * (capitalisedPercent / 100));
  const operatingIncome = grossProfit - opex + capitalised;
  const netIncome = Math.round(operatingIncome * 0.74);

  const dso = shape.dso * noise.dso * (has('RECEIVABLES') ? 1.85 : 1);
  const dio = shape.dio * noise.dio * (has('INVENTORY') ? 1.7 : 1);
  const receivables = Math.round((revenue * dso) / 365);
  const inventory = Math.round((costOfSales * dio) / 365);
  const conversion = has('REVENUE_TIMING') ? 0.28 : shape.cashConversion * noise.conversion;

  return {
    fiscalYearEnd: `${2023 + offset}-12-31`,
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses: opex,
    costsCapitalised: capitalised,
    operatingIncome,
    netIncome,
    tradeReceivables: receivables,
    inventory,
    tradePayables: Math.round((costOfSales * 44) / 365),
    cash: Math.round(revenue * 0.11),
    operatingCashFlow: Math.round(netIncome * conversion),
  };
}

/** Turns a year of growth into a year of decline, which is what makes an inventory build a question. */
const declining = (shape) => 0.93 / (1 + shape.growth);

/** The notes, in the words a filing uses. The only place an innocent explanation ever appears. */
function disclosures(random, plan, years) {
  const lines = [
    'The accounting policies are unchanged from the previous year unless stated below.',
    `Revenue is recognised when control passes to the customer. Standard terms are ${random.pick([30, 45, 60])} days.`,
  ];

  const last = years[2];
  if (plan.flag === 'RELATED_PARTY') {
    const share = random.int(28, 45);
    lines.push(`${share} per cent of revenue in the year was to ${random.pick(LISTS.MERCHANT_WORDS)} Trading, an entity in which a director holds a controlling interest.`);
    if (plan.decoy) lines.push('The supply agreement predates the director’s appointment, is at the published list price, and was approved by the independent members of the board.');
  }
  if (plan.flag === 'RESTATEMENT' && !plan.decoy) {
    lines.push(`The comparative figures for the earlier year have been restated to correct the timing of ${random.pick(['rebate accruals', 'licence revenue', 'supplier credits'])}, reducing that year’s profit by ${random.int(3, 11)} per cent.`);
  }
  if (plan.flag === 'RESTATEMENT' && plan.decoy) {
    lines.push('The comparative figures have been re-presented to adopt the revised disclosure standard that applies from this year. Profit, net assets and the audit opinion for that year are unchanged, and the same firm continues in office.');
  }
  if (plan.flag === 'RECEIVABLES' && plan.decoy) {
    lines.push('The company moved to a distributor model in the second half. The two distributors are on 90-day terms against 30 days for the direct business they replaced, and the balance was settled in full after the year end.');
  }
  if (plan.flag === 'INVENTORY' && plan.decoy) {
    lines.push('Stock at the year end includes a build for the spring range, which ships in the first quarter against firm orders already placed.');
  }
  if (plan.flag === 'REVENUE_TIMING' && plan.decoy) {
    lines.push(`A single licence of ${Math.round(last.revenue * 0.09)} was signed in the final month of the year and invoiced after the year end on the customer’s normal terms.`);
  }
  if (plan.flag === 'CAPITALISED_COSTS' && plan.decoy) {
    lines.push('The platform rebuild reached technical feasibility in March. Costs from that date are capitalised under the policy applied to every earlier project.');
  }

  lines.push(random.pick([
    'There are no contingent liabilities requiring disclosure.',
    'The company has a revolving facility, undrawn at the year end.',
    'No dividends were declared in the year.',
    'Employee numbers rose in line with activity.',
  ]));
  return random.shuffle(lines);
}
