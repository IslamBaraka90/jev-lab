// Two hundred and forty claims about twenty invented companies, none of which exist. The sources are
// invented too, and deliberately not named after any real platform: the demo is about evidence, not
// about anybody's network.
//
// Twenty-two of the claims were later confirmed, thirty-eight later denied, and the rest never
// resolved either way — which is what most rumours do. Fourteen are coordinated pushes: many accounts,
// the same sentence, inside half an hour. Twelve more spread just as fast and just as wide in people's
// own words, and those are the ones that separate a signal from a crowd. Nine cite a document that
// could be checked. Labels go to data/synthetic/rumour-grading.labels.json.

import { createRandom } from './lib/random.js';
import { LISTS } from './lib/names.js';

export const SEED = 1175;

const SOURCE_TYPES = [
  { id: 'SOCIAL', name: 'a social post', baseline: 0.12 },
  { id: 'FORUM', name: 'a forum thread', baseline: 0.1 },
  { id: 'BLOG', name: 'a blog item', baseline: 0.22 },
  { id: 'NEWSLETTER', name: 'a subscriber newsletter', baseline: 0.34 },
  { id: 'FILING_WATCHER', name: 'an account that reads filings', baseline: 0.58 },
];

const CLAIMS = [
  'is in late-stage talks to acquire a competitor, with an announcement expected within the fortnight',
  'will miss its quarterly number and the board already knows',
  'has lost its largest customer and has not disclosed it',
  'is preparing a rights issue at a discount to the current price',
  'has had a second site shut by an inspector',
  'is about to be added to a major index at the next review',
  'has quietly stopped taking orders in its biggest market',
  'will announce a buyback alongside the next results',
  'has a finance director who is leaving and has not told the market',
  'is under investigation by a regulator over its revenue recognition',
  'has signed the contract everyone has been waiting for',
  'will cut its dividend at the full year',
];

const DOCUMENTS = [
  'the interim statement published on the company’s own site, note 14',
  'a planning application lodged with the local authority last month',
  'the supplier list in the annual report, page 62',
  'a tender award notice published by the public buyer',
  'the share register filing made after the board changed',
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const companies = buildCompanies(random);
  const plan = planClaims(random);

  const items = [];
  const labels = [];
  plan.forEach((row, index) => {
    const id = random.id('RM', index + 1);
    const company = companies[index % companies.length];
    items.push(claim(random, { ...row, id, company }));
    labels.push({ claimId: id, outcome: row.outcome, coordinated: row.spread === 'COORDINATED', spread: row.spread, checkable: Boolean(row.cites) });
  });

  return {
    dataset: {
      id: 'rumour-grading',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/rumour-grading.js',
      context: {
        companies: companies.map(({ ticker, name, sector }) => ({ ticker, name, sector })),
        sourceTypes: SOURCE_TYPES.map(({ id, name }) => ({ id, name })),
        howToRead: 'The repeat pattern is the count of other accounts posting the same claim, how long they took, and how much of the wording they share. A claim can travel fast in people’s own words, and that is a different thing from the same sentence forty times.',
        note: 'Every company, account and claim here is invented. No real platform is named, because the question is what the evidence supports rather than where it was posted.',
      },
      items,
    },
    labels,
  };
}

/** Twenty invented issuers, each with a track record the claims can be read against. */
function buildCompanies(random) {
  const suffixes = ['Holdings', 'Group', 'Industries', 'Technologies', 'Resources', 'Partners'];
  const sectors = ['Semiconductors', 'Enterprise software', 'Freight', 'Building materials', 'Specialty lending', 'Medical devices', 'General retail', 'Oil and gas'];
  return random.shuffle(LISTS.MERCHANT_WORDS.flatMap((word) => suffixes.map((suffix) => `${word} ${suffix}`)))
    .slice(0, 20)
    .map((name) => ({
      name,
      ticker: name.slice(0, 4).toUpperCase(),
      sector: random.pick(sectors),
      recentNews: random.pick([
        'Nothing has been announced in the last eight weeks.',
        'A change of auditor was announced three weeks ago and nothing since.',
        'Results were published last month, in line with guidance.',
        'A small bolt-on acquisition was confirmed in the spring.',
        'The chair announced a retirement date at the annual meeting.',
      ]),
    }));
}

/** The plan: what resolved, what was coordinated, what merely travelled, and what cited a document. */
function planClaims(random) {
  const rows = [
    ...Array.from({ length: 22 }, () => ({ outcome: 'CONFIRMED' })),
    ...Array.from({ length: 38 }, () => ({ outcome: 'DENIED' })),
    ...Array.from({ length: 180 }, () => ({ outcome: 'UNRESOLVED' })),
  ];

  const shuffled = random.shuffle(rows);
  for (const row of shuffled) row.spread = 'QUIET';

  // Coordination is not the same as being wrong, so two of the fourteen pushes turned out true.
  const denied = shuffled.filter((row) => row.outcome === 'DENIED');
  const confirmed = shuffled.filter((row) => row.outcome === 'CONFIRMED');
  const unresolved = shuffled.filter((row) => row.outcome === 'UNRESOLVED');
  for (const row of random.sample(denied, 10)) row.spread = 'COORDINATED';
  for (const row of random.sample(confirmed, 2)) row.spread = 'COORDINATED';
  for (const row of random.sample(unresolved, 2)) row.spread = 'COORDINATED';

  // Twelve that travelled just as far and just as fast, in words people chose for themselves.
  for (const row of random.sample(shuffled.filter((entry) => entry.spread === 'QUIET'), 12)) row.spread = 'VIRAL';

  // Nine cite something checkable. Citing a document mostly goes with being right, but not always.
  for (const row of random.sample(confirmed.filter((entry) => entry.spread !== 'COORDINATED'), 7)) row.cites = true;
  for (const row of random.sample(denied.filter((entry) => !entry.cites), 1)) row.cites = true;
  for (const row of random.sample(unresolved.filter((entry) => !entry.cites), 1)) row.cites = true;
  return shuffled;
}

// #region demo:data
/** One claim: who said it, how often they are right, how it travelled, and what it cites. */
function claim(random, plan) {
  const source = sourceFor(random, plan);
  const spread = spreadFor(random, plan.spread);

  return {
    id: plan.id,
    company: plan.company.name,
    ticker: plan.company.ticker,
    sector: plan.company.sector,
    claim: `${plan.company.name} ${random.pick(CLAIMS)}.`,
    sourceType: source.type.id,
    sourceDescription: source.type.name,
    sourceHandle: source.handle,
    claimsMadeBefore: source.total,
    laterConfirmed: source.confirmed,
    laterDenied: source.denied,
    postedAt: `2026-0${random.int(1, 9)}-${String(random.int(10, 28))} ${String(random.int(6, 22)).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}`,
    accountsRepeatingIt: spread.accounts,
    minutesForThoseRepeats: spread.minutes,
    wordingSharedPercent: spread.similarity,
    independentSourcesSayingIt: spread.independent,
    citedDocument: plan.cites ? random.pick(DOCUMENTS) : null,
    companyRecentNews: plan.company.recentNews,
  };
}
// #endregion

/** An account with a history. Good sources are right more often, and the claim is not proof of it. */
function sourceFor(random, plan) {
  const bias = plan.outcome === 'CONFIRMED' ? 0.72 : plan.outcome === 'DENIED' ? 0.25 : 0.5;
  const type = plan.cites
    ? SOURCE_TYPES[4]
    : random.weighted(SOURCE_TYPES.map((entry) => [entry, Math.max(0.05, 1 - Math.abs(entry.baseline - bias) * 2)]));

  const total = random.int(18, 140);
  const rate = Math.min(0.9, Math.max(0.02, type.baseline + random.float(-0.06, 0.06, 3)));
  const confirmed = Math.round(total * rate);
  return { type, handle: `@${random.pick(LISTS.MERCHANT_WORDS).toLowerCase()}_${random.int(100, 999)}`, total, confirmed, denied: Math.round((total - confirmed) * random.float(0.3, 0.7, 2)) };
}

/** How a claim travelled. The three patterns differ in wording, which is the whole test. */
function spreadFor(random, spread) {
  if (spread === 'COORDINATED') {
    return { accounts: random.int(28, 54), minutes: random.int(8, 35), similarity: random.int(84, 97), independent: random.int(0, 1) };
  }
  if (spread === 'VIRAL') {
    return { accounts: random.int(26, 61), minutes: random.int(12, 48), similarity: random.int(9, 31), independent: random.int(1, 4) };
  }
  return { accounts: random.int(0, 11), minutes: random.int(90, 2_400), similarity: random.int(6, 34), independent: random.int(0, 3) };
}
