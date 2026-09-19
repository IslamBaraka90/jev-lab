// Ninety documents from twelve invented companies: thirty results releases, thirty risk-factor
// sections and thirty call excerpts. Everything — the companies, the people, the numbers, the words —
// is written for this demo. No real filing is copied, quoted or paraphrased.
//
// The planted content is what makes it gradeable: guidance raised, cut, maintained or withdrawn;
// twelve documents where the numbers beat and the tone drops anyway; new risk factors, some of them
// obvious and some buried two thirds of the way down a list nobody reads; and five insider
// transactions mentioned in passing, three of which matter. Labels go to
// data/synthetic/filings-read.labels.json.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { LISTS } from './lib/names.js';

export const SEED = 1173;

const COMPANIES = [
  { ticker: 'KSTL', name: 'Kestrel Technologies', sector: 'Semiconductors' },
  { ticker: 'NRWD', name: 'Northwind Systems', sector: 'Enterprise software' },
  { ticker: 'LNTN', name: 'Lantern Devices', sector: 'Consumer hardware' },
  { ticker: 'MRDN', name: 'Meridian Financial', sector: 'Specialty lending' },
  { ticker: 'QRRY', name: 'Quarry Petroleum', sector: 'Oil and gas' },
  { ticker: 'ORCH', name: 'Orchard Beverages', sector: 'Soft drinks' },
  { ticker: 'CDRH', name: 'Cedar Household', sector: 'Household goods' },
  { ticker: 'BCNM', name: 'Beacon Medical', sector: 'Medical devices' },
  { ticker: 'TNBR', name: 'Tinbridge Retail', sector: 'General retail' },
  { ticker: 'FLCN', name: 'Falcon Logistics', sector: 'Freight' },
  { ticker: 'PNFD', name: 'Pinefield Materials', sector: 'Building materials' },
  { ticker: 'MRLW', name: 'Marlow Studios', sector: 'Media production' },
];

/** Eighteen raises, fourteen cuts, twenty-two maintained, six withdrawn, thirty never mentioned. */
const GUIDANCE_PLAN = [['RAISED', 18], ['CUT', 14], ['MAINTAINED', 22], ['WITHDRAWN', 6], ['NOT_MENTIONED', 30]];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const kinds = [...Array(30).fill('RESULTS'), ...Array(30).fill('RISKS'), ...Array(30).fill('CALL')];
  const guidance = random.shuffle(GUIDANCE_PLAN.flatMap(([value, count]) => Array(count).fill(value)));

  // A risk-factor section never carries guidance, so the two plans are dealt out together.
  const rows = random.shuffle(kinds).map((kind, index) => ({ kind, guidance: kind === 'RISKS' ? 'NOT_MENTIONED' : guidance[index] }));
  rebalance(rows, guidance);
  plant(random, rows);

  const items = [];
  const labels = [];
  rows.forEach((row, index) => {
    const id = random.id('FD', index + 1);
    const company = COMPANIES[index % COMPANIES.length];
    const built = document(random, { ...row, id, company, quarter: `Q${(index % 4) + 1} ${2025 + Math.floor((index % 8) / 4)}` });
    items.push(built.item);
    labels.push({ documentId: id, ...built.label });
  });

  return {
    dataset: {
      id: 'filings-read',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/filings-read.js',
      context: {
        companies: COMPANIES,
        documentKinds: { RESULTS: 'A quarterly results release with the prior quarter beside it.', RISKS: 'A risk-factor section, with the previous filing’s list beside it.', CALL: 'An excerpt from an analyst call.' },
        note: 'Every company, person, number and sentence here is invented for this demo. No real filing or transcript is copied, quoted or paraphrased, and nothing on this page is a statement about any real company.',
      },
      items,
    },
    labels,
  };
}

/** Guidance that landed on a risk section has to be dealt somewhere else, or the counts drift. */
function rebalance(rows, guidance) {
  const wanted = guidance.filter((value) => value !== 'NOT_MENTIONED');
  const placed = rows.filter((row) => row.guidance !== 'NOT_MENTIONED').map((row) => row.guidance);
  const missing = [...wanted];
  for (const value of placed) missing.splice(missing.indexOf(value), 1);

  for (const value of missing) {
    const spare = rows.find((row) => row.kind !== 'RISKS' && row.guidance === 'NOT_MENTIONED');
    if (spare) spare.guidance = value;
  }
}

/** The rest of what is planted: tone, new risks, the beat-but-worse dozen, and five insider lines. */
function plant(random, rows) {
  const byGuidance = { RAISED: 5, CUT: 2, WITHDRAWN: 1, MAINTAINED: 3, NOT_MENTIONED: 3 };
  for (const row of rows) row.tone = byGuidance[row.guidance];

  const releases = rows.filter((row) => row.kind === 'RESULTS');
  for (const row of random.sample(releases, 12)) {
    row.beatButWorse = true;
    row.tone = 2;
  }

  const risks = rows.filter((row) => row.kind === 'RISKS');
  const withNew = random.sample(risks, 17);
  for (const row of withNew.slice(0, 9)) row.newRisk = 'BURIED';
  for (const row of withNew.slice(9)) row.newRisk = 'OBVIOUS';

  const mentions = random.sample(rows.filter((row) => row.kind !== 'RISKS'), 5);
  mentions.forEach((row, index) => { row.insider = index < 3 ? 'SIGNIFICANT' : 'ROUTINE'; });
}

// #region demo:data
/** One document, the period before it where that makes sense, and the label kept out of both. */
function document(random, plan) {
  const written = plan.kind === 'RESULTS' ? release(random, plan) : plan.kind === 'RISKS' ? risks(random, plan) : call(random, plan);

  return {
    item: {
      id: plan.id,
      ticker: plan.company.ticker,
      company: plan.company.name,
      sector: plan.company.sector,
      kind: plan.kind,
      quarter: plan.quarter,
      publishedOn: written.date,
      title: written.title,
      text: written.text,
      priorPeriod: written.prior ?? null,
      words: written.text.split(/\s+/).length,
    },
    label: {
      guidance: plan.guidance,
      toneShift: plan.tone,
      newRisk: plan.newRisk ?? 'NONE',
      insider: plan.insider ?? 'NONE',
      beatButWorse: Boolean(plan.beatButWorse),
      kind: plan.kind,
    },
  };
}
// #endregion

const money = (random, low, high) => round(random.float(low, high, 1), 1);

const GUIDANCE_LINES = {
  RAISED: ['The board now expects full-year revenue at the upper end of the range given in February, and has raised the operating margin range by half a point.', 'Full-year revenue guidance is increased to between {low} and {high} million from the range given at the interim.'],
  CUT: ['Full-year revenue guidance is reduced to between {low} and {high} million. The board expects the second half to be weaker than previously indicated.', 'The board has lowered its full-year operating margin range by a point and a half and no longer expects to reach the upper end of its revenue range.'],
  MAINTAINED: ['Full-year guidance is unchanged at between {low} and {high} million.', 'The board reaffirms the guidance given in February and expects to finish the year within the range then indicated.'],
  WITHDRAWN: ['The board has withdrawn its full-year guidance and will not reinstate it before the next interim statement.', 'In view of the matters described below, full-year guidance is withdrawn with immediate effect.'],
  NOT_MENTIONED: [],
};

const TONE_LINES = {
  1: ['We are not in a position to say when conditions will settle, and we are planning the business on the assumption that they do not.', 'This has been a difficult period and the next one will be harder.'],
  2: ['Trading conditions in the second half have been more difficult than we expected, and we are planning on that continuing.', 'We are taking a more cautious view of the coming period than we were three months ago.', 'The quarter was delivered against a background that deteriorated as it went on.'],
  3: ['Trading was broadly in line with our plan and we expect conditions to remain much as they are.', 'The period was unremarkable and the business performed as we set out that it would.'],
  4: ['Demand strengthened through the quarter and the momentum has carried into the current period.', 'We are more confident about the second half than we were at the interim.'],
  5: ['This was the strongest quarter the business has had, and the pipeline behind it is stronger still.', 'Every part of the business grew, and we are raising what we expect of the year as a result.'],
};

/** A quarterly release: the numbers, a quote, and whatever the board decided to say about the year. */
function release(random, plan) {
  const revenue = money(random, 180, 940);
  const beat = plan.beatButWorse || plan.guidance === 'RAISED' || random.bool(0.4);
  const prior = round(revenue / (beat ? random.float(1.06, 1.18, 3) : random.float(0.96, 1.04, 3)), 1);
  const margin = money(random, 8, 29);
  const priorMargin = round(margin - (beat ? random.float(0.2, 2.1, 1) : random.float(-1.8, 0.4, 1)), 1);
  // The new range is moved off the old one, never computed from this quarter's revenue. Doing the
  // latter let a "reduced to" sentence print numbers above the range it claimed to reduce.
  const wasLow = prior * 3.8;
  const wasHigh = prior * 4.2;
  const factor = { RAISED: random.float(1.04, 1.09, 3), CUT: random.float(0.9, 0.96, 3), MAINTAINED: 1, WITHDRAWN: 1, NOT_MENTIONED: 1 }[plan.guidance];
  const guidanceLine = plan.guidance === 'NOT_MENTIONED' ? '' : random.pick(GUIDANCE_LINES[plan.guidance]).replace('{low}', thousands(wasLow * factor)).replace('{high}', thousands(wasHigh * factor));

  const text = [
    `${plan.company.name} (${plan.company.ticker}) announces results for ${plan.quarter}.`,
    `Revenue of ${revenue} million, against ${prior} million in the comparable quarter. Operating margin of ${margin} per cent, against ${priorMargin} per cent.`,
    `Chief executive ${person(random)} said: "${random.pick(TONE_LINES[plan.tone])}"`,
    plan.beatButWorse ? 'The quarter benefited from timing on two large orders that will not repeat, and the order book at the period end was lower than at the same point last year.' : '',
    guidanceLine,
    insiderLine(random, plan),
    'This release contains forward-looking statements which are subject to the risks set out in the annual report.',
  ].filter(Boolean).join('\n\n');

  return {
    date: `2026-0${random.int(1, 9)}-${String(random.int(10, 28))}`,
    title: `${plan.quarter} results`,
    text,
    prior: `Previous quarter: revenue ${prior} million, operating margin ${priorMargin} per cent. Guidance then: full-year revenue between ${thousands(wasLow)} and ${thousands(wasHigh)} million.`,
  };
}

const RISK_POOL = [
  'Demand for our products is cyclical and a downturn would reduce revenue.',
  'We depend on a small number of customers for a material share of revenue.',
  'Our supply chain includes single-source components.',
  'Foreign exchange movements affect reported results.',
  'We are subject to product liability claims.',
  'Changes in tax law in the jurisdictions where we operate could increase our tax charge.',
  'We may fail to attract and retain skilled staff.',
  'Our facilities are exposed to interruption from severe weather.',
  'We hold personal data and are subject to data protection regulation.',
  'Competition may increase and reduce our pricing power.',
  'Our borrowings are subject to covenants which, if breached, could accelerate repayment.',
  'Acquisitions may not deliver the benefits expected of them.',
  'Intellectual property claims may be brought against us.',
  'Energy and freight costs are volatile.',
  'We rely on third parties for parts of our distribution.',
  'Our insurance may not cover all losses.',
  'Pension obligations may require additional funding.',
  'Environmental regulation may require unplanned capital expenditure.',
];

const NEW_RISKS = [
  'A regulator in one of our principal markets has opened a review of pricing practices across our industry, and the outcome may require changes to how we contract with distributors.',
  'Our largest customer has given notice that it intends to dual-source from the next contract year, which would reduce volumes from the second half.',
  'A dispute with a former joint venture partner has been referred to arbitration, and an adverse award could be material.',
  'One of our two production sites has been served with an improvement notice which, if not discharged, could suspend output at that site.',
  'We have identified a control weakness in the reconciliation of inventory at two locations and are remediating it.',
];

/** A risk-factor section, with the previous filing's list beside it so "new" is checkable. */
function risks(random, plan) {
  const count = random.int(12, 17);
  const carried = random.sample(RISK_POOL, count);
  const list = [...carried];

  if (plan.newRisk) {
    const fresh = random.pick(NEW_RISKS);
    // Measured against the length after the insertion, which is the list a reader actually sees.
    const at = plan.newRisk === 'BURIED' ? Math.round((list.length + 1) * random.float(0.62, 0.82, 2)) : random.int(0, 2);
    list.splice(at, 0, fresh);
  }

  return {
    date: `2026-0${random.int(1, 9)}-${String(random.int(10, 28))}`,
    title: 'Principal risks and uncertainties',
    text: `${plan.company.name} (${plan.company.ticker}) — principal risks and uncertainties, ${plan.quarter}.\n\n${list.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}`,
    prior: `The same section in the previous filing listed ${carried.length} risks:\n${carried.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}`,
  };
}

const QUESTIONS = [
  'Can you talk about what you are seeing in the order book since the quarter closed?',
  'How should we think about the margin bridge into the second half?',
  'Is the pricing you took earlier in the year sticking?',
  'What would have to happen for you to come in at the top of the range?',
  'Has anything changed in how your largest customers are behaving?',
];

/** A call excerpt: three exchanges, and whatever management let slip in the answers. */
function call(random, plan) {
  const guidanceLine = plan.guidance === 'NOT_MENTIONED' ? '' : random.pick(GUIDANCE_LINES[plan.guidance]).replace('{low}', thousands(random.int(700, 1200))).replace('{high}', thousands(random.int(1300, 1800)));
  const chosen = random.sample(QUESTIONS, 3);
  const answers = [random.pick(TONE_LINES[plan.tone]), guidanceLine || random.pick(TONE_LINES[plan.tone]), insiderLine(random, plan) || random.pick(TONE_LINES[3])];

  const text = [
    `${plan.company.name} (${plan.company.ticker}) — ${plan.quarter} results call, excerpt.`,
    ...chosen.map((question, index) => `Analyst: ${question}\n\n${index === 0 ? 'Chief executive' : 'Finance director'}: ${answers[index]}`),
  ].join('\n\n');

  return { date: `2026-0${random.int(1, 9)}-${String(random.int(10, 28))}`, title: `${plan.quarter} call excerpt`, text };
}

/** Insider dealing mentioned the way it really is: one sentence, in the middle of something else. */
function insiderLine(random, plan) {
  if (!plan.insider) return '';
  const who = random.pick(['the chief financial officer', 'the chief operating officer', 'the chair']);
  const shares = random.int(40, 620) * 1_000;
  if (plan.insider === 'ROUTINE') return `As previously notified, ${who} sold ${shares.toLocaleString('en-GB')} shares during the period under a plan entered into last year, representing under a tenth of their holding.`;
  return `${who.replace(/^the /, 'The ')} disposed of ${shares.toLocaleString('en-GB')} shares in the days before this announcement, being ${random.int(52, 80)} per cent of their holding. The disposal was not made under a pre-arranged plan.`;
}

const thousands = (value) => Math.round(value).toLocaleString('en-GB');

const person = (random) => `${random.pick(LISTS.FIRST_NAMES)} ${random.pick(LISTS.LAST_NAMES)}`;
