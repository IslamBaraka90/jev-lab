// A hundred and forty merchant applications waiting for underwriting, with what an acquirer actually
// sees: the company, what it says it will sell, how much it expects to process, the website copy, and
// the documents with the checker's notes. Eleven of these merchants went on to produce heavy
// chargebacks, six should never have been taken at all, five sent documents that do not hold up, and
// nine look bad on paper and were perfectly fine. Those outcomes live in
// data/synthetic/merchant-onboarding.labels.json, outside the demo folder — the application cannot see
// its own future.

import { createRandom } from './lib/random.js';
import { merchantName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1115;

export const PROHIBITED_RULES = [
  'Any health claim that a product treats, cures or prevents a condition.',
  'Betting, casino or lottery services without a licence number on the application.',
  'Adult content sold directly to consumers, including subscription sites.',
  'Investment or trading products promising a return.',
  'Sale of prescription medicines, weapons, or goods that infringe a trademark.',
];

const CATEGORY_RULES = [
  'Travel, dropshipping and anything delivered more than fourteen days after payment carries delivery risk and is not approved without a reserve.',
  'A company trading for less than six months is capped at a medium tier whatever its category.',
  'Expected monthly volume more than twenty times the average of the category is treated as unexplained until the merchant explains it.',
  'A bank account in a country the business does not trade in is a decline unless the documents explain it.',
];

const WEBSITE = {
  ok: [
    'Family-run since {year}. Everything is stocked in our {city} unit and posted the same day, tracked, with a thirty-day return on anything unopened. Our phone number is on every page.',
    'We make {goods} to order in the United Kingdom. Lead time is five to seven working days and we email a photo before anything ships.',
    'Straightforward {goods} at sensible prices. Free returns for thirty days, a real address at the bottom of this page, and a support line answered by us.',
  ],
  thin: [
    'Premium {goods} at unbeatable prices. Worldwide shipping 25-40 days. All sales are final. Contact us through the form.',
    'The best {goods} on the internet. Order now, limited stock! Delivery 30-45 days. No refunds after dispatch.',
    'Trending {goods}, shipped direct from our partners. Please allow up to six weeks. Returns are not accepted on sale items, which is most items.',
  ],
  claims: [
    'Our {goods} formula reverses joint damage and cures inflammation in fourteen days. Doctors will not tell you this.',
    'Clinically proven to treat anxiety and prevent migraines without medication. Stop your prescription today.',
  ],
  betting: [
    'Place your bets on tonight’s fixtures. Instant payouts, no verification needed, new players get a hundred free spins.',
    'Daily jackpots and live casino tables. Deposit in seconds and start playing, no documents required.',
  ],
  adult: [
    'Live cams, 18+, subscription from nine pounds a month. Discreet billing under a neutral name on your statement.',
  ],
  returns: [
    'Guaranteed monthly returns of eight per cent on your capital. Our trading desk has never had a losing month.',
  ],
};

const GOODS = ['kitchenware', 'running shoes', 'phone accessories', 'garden tools', 'skincare', 'stationery', 'camping gear', 'lighting', 'pet supplies'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 11; index++) {
    const item = chargebackHeavy(random);
    // What this merchant went on to cost, so a reserve can be judged against the money it had to cover.
    add(item, { outcome: 'CHARGEBACK_HEAVY', kind: 'went bad later', chargebacksLater: round(item.expectedMonthlyVolume * random.float(0.04, 0.14) * 3) });
  }
  for (let index = 0; index < 6; index++) add(prohibited(random), { outcome: 'PROHIBITED', kind: 'prohibited from the start' });
  for (let index = 0; index < 5; index++) add(forgedDocuments(random), { outcome: 'FRAUD', kind: 'documents do not hold up' });
  for (let index = 0; index < 9; index++) add(looksBadIsFine(random), { outcome: 'GOOD', kind: 'looks risky, turned out fine' });
  for (let index = 0; index < 109; index++) add(ordinary(random), { outcome: 'GOOD', kind: 'ordinary' });

  items.sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `APP-${String(index + 1).padStart(3, '0')}`;
    labels.find((label) => label.key === item.key).applicationId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'merchant-onboarding',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/merchant-onboarding.js',
      context: {
        acquirer: 'Kestrel Payments',
        currency: 'GBP',
        period: 'Applications received in August 2026',
        prohibitedActivities: PROHIBITED_RULES,
        categoryRules: CATEGORY_RULES,
        volumeBands: { small: 'under 20,000 a month', medium: '20,000 to 100,000', large: 'over 100,000' },
        documentChecklist: ['Certificate of incorporation', 'Director identity document', 'Bank statement in the trading name', 'Proof of trading address'],
        reserveGuidance: 'A reserve holds that share of one month’s settlement against future chargebacks. A rolling hold keeps a tenth of every settlement for ninety days, which builds to about a third of a month.',
        note: 'The category rules here are illustrative and are not any acquirer’s real policy.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One application, as the underwriting queue holds it. Nothing here says how it turned out. */
function application(random, { category, monthsRegistered, directors, volume, ticket, website, refundPolicy, deliveryDays, bankCountry = 'GB', nameMismatch = false, documents, previousProcessor = 'None declared', declaredChargebacks = 0, directorHistory = 'Nothing adverse found' }) {
  const trading = `${merchantName(random).split(' ')[0]} ${random.pick(['Supply', 'Goods', 'Trading', 'Retail', 'Group', 'Direct'])}`;
  return {
    key: `${trading}-${random.int(100_000, 999_999)}`,
    id: null,
    submittedAt: random.day('2026-08-01', '2026-08-31'),
    legalName: nameMismatch ? `${merchantName(random).split(' ')[0]} Holdings Ltd` : `${trading} Ltd`,
    tradingName: trading,
    nameMismatch,
    category,
    monthsRegistered,
    directors,
    directorHistory,
    expectedMonthlyVolume: volume,
    averageTicket: ticket,
    deliveryPromiseDays: deliveryDays,
    tradingCountry: 'GB',
    bankCountry,
    previousProcessor,
    declaredChargebackRatePercent: declaredChargebacks,
    documentsClear: documents.filter((document) => document.note === 'Clear').length,
    documentsExpected: documents.length,
    websiteExcerpt: website,
    refundPolicy,
    documents,
  };
}
// #endregion

const docs = (random, { problem = null } = {}) => {
  const list = [
    { name: 'Certificate of incorporation', note: 'Clear' },
    { name: 'Director identity document', note: 'Clear' },
    { name: 'Bank statement in the trading name', note: 'Clear' },
    { name: 'Proof of trading address', note: 'Clear' },
  ];
  if (problem) list[problem.index].note = problem.note;
  else if (random.bool(0.18)) list[random.int(0, 3)].note = random.pick(['Low resolution scan, readable', 'Dated four months ago', 'Corner of the page cut off']);
  return list;
};

const fill = (random, template) => template
  .replace('{goods}', random.pick(GOODS))
  .replace('{city}', random.pick(['Stoke', 'Norwich', 'Perth', 'Exeter', 'Hull']))
  .replace('{year}', random.int(1998, 2019));

/** Long delivery promises, no returns, a young company and a volume expectation to match. */
function chargebackHeavy(random) {
  const volume = amount(random, { min: 60_000, max: 340_000, roundTo: 'natural' });
  return application(random, {
    category: random.pick(['Dropshipping', 'Digital goods', 'Travel']),
    monthsRegistered: random.int(1, 7),
    directors: 1,
    volume,
    ticket: amount(random, { min: 60, max: 420 }),
    website: fill(random, random.pick(WEBSITE.thin)),
    refundPolicy: 'All sales are final once the order is placed. Delivery times are estimates and delays are not grounds for a refund.',
    deliveryDays: random.int(25, 45),
    documents: docs(random),
    previousProcessor: random.pick(['None declared', 'Left after a chargeback review', 'None declared']),
    nameMismatch: random.bool(0.4),
  });
}

/** Whatever the form says, the website sells something the acquirer does not accept. */
function prohibited(random) {
  const kind = random.pick(['claims', 'betting', 'adult', 'returns']);
  const category = { claims: 'Supplements', betting: 'Gambling adjacent', adult: 'Adult adjacent', returns: 'Crypto adjacent' }[kind];
  return application(random, {
    category,
    monthsRegistered: random.int(2, 40),
    directors: random.int(1, 2),
    volume: amount(random, { min: 15_000, max: 180_000, roundTo: 'natural' }),
    ticket: amount(random, { min: 20, max: 160 }),
    website: fill(random, random.pick(WEBSITE[kind])),
    refundPolicy: random.pick(['Refunds at our discretion within seven days.', 'No refunds once the service has been accessed.']),
    deliveryDays: random.int(1, 10),
    documents: docs(random),
  });
}

/** The paperwork is the problem: names that do not match, dates that cannot be right. */
function forgedDocuments(random) {
  const problem = random.pick([
    { index: 2, note: 'Account name does not match the applicant, and the balance column does not add up' },
    { index: 0, note: 'Company number does not exist on the register' },
    { index: 1, note: 'Identity document expired in 2023 and the photograph looks reused from another file' },
    { index: 3, note: 'Utility bill address is a mail forwarding office, and the issuer logo is the wrong shape' },
  ]);
  return application(random, {
    category: random.pick(['Retail', 'Digital goods', 'Dropshipping']),
    monthsRegistered: random.int(1, 14),
    directors: 1,
    volume: amount(random, { min: 40_000, max: 200_000, roundTo: 'natural' }),
    ticket: amount(random, { min: 40, max: 300 }),
    website: fill(random, random.pick([...WEBSITE.thin, ...WEBSITE.ok])),
    refundPolicy: 'Returns accepted within fourteen days.',
    deliveryDays: random.int(3, 20),
    documents: docs(random, { problem }),
    nameMismatch: true,
    directorHistory: random.pick(['Sole director was named on two companies dissolved in the last three years', 'Nothing adverse found']),
  });
}

/** A category that reads badly with a business behind it that does not. */
function looksBadIsFine(random) {
  const story = random.pick([
    { category: 'Travel', months: random.int(90, 260), website: 'Independent travel agent since {year}, bonded and licensed. Balances are taken sixty days before departure and held in a client account.', policy: 'Cancellations follow the bonding scheme terms, in writing, with a full schedule on the site.' },
    { category: 'Crypto adjacent', months: random.int(40, 120), website: 'We sell hardware wallets and security keys. We do not take deposits, hold funds, or offer any investment product.', policy: 'Thirty-day returns on unopened devices.' },
    { category: 'Supplements', months: random.int(30, 150), website: 'Vitamins and protein powders, labelled to UK food standards. We make no medical claims and our labels say so.', policy: 'Unopened tubs returnable for thirty days.' },
    { category: 'Dropshipping', months: random.int(24, 90), website: 'Our partners hold stock in {city} and ship within five working days, tracked, with our phone number on the docket.', policy: 'Thirty-day returns, we pay the postage.' },
  ]);
  return application(random, {
    category: story.category,
    monthsRegistered: story.months,
    directors: random.int(1, 3),
    volume: amount(random, { min: 25_000, max: 190_000, roundTo: 'natural' }),
    ticket: amount(random, { min: 45, max: 900 }),
    website: fill(random, story.website),
    refundPolicy: story.policy,
    deliveryDays: story.category === 'Travel' ? random.int(20, 60) : random.int(2, 7),
    documents: docs(random),
    previousProcessor: random.pick(['Moving from another acquirer on price', 'None declared']),
    declaredChargebacks: round(random.float(0.05, 0.35), 2),
  });
}

/** The everyday queue: small shops and services with paperwork in order. */
function ordinary(random) {
  return application(random, {
    category: random.weighted([['Retail', 40], ['Professional services', 26], ['Digital goods', 18], ['Travel', 6], ['Supplements', 5], ['Dropshipping', 5]]),
    monthsRegistered: random.int(4, 260),
    directors: random.int(1, 3),
    volume: amount(random, { min: 4_000, max: 120_000, roundTo: 'natural' }),
    ticket: amount(random, { min: 12, max: 340 }),
    website: fill(random, random.pick(WEBSITE.ok)),
    refundPolicy: random.pick(['Thirty-day returns, refund to the original card.', 'Fourteen-day returns on unused goods.', 'Refunds within thirty days, postage paid by us on faulty items.']),
    deliveryDays: random.int(1, 12),
    documents: docs(random),
    declaredChargebacks: random.bool(0.3) ? round(random.float(0.02, 0.4), 2) : 0,
    nameMismatch: random.bool(0.12),
  });
}
