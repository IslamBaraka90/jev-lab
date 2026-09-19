// Four hundred alerts as a rules engine left them: each one fired by a named rule with a known
// historical precision, and ordered by that rule's score. Sixteen are real fraud and half of those sit
// low in the queue, where nobody gets to them. Twenty-five are loud alerts on transactions the
// cardholder's own history explains. The rule ordering is stored with the data so the comparison is
// reproducible; the labels live in data/synthetic/card-fraud-triage.labels.json.

import { createRandom } from './lib/random.js';
import { cardMask, cityName, merchantName, personName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1121;

/** The rules, what they are worth historically, and the band of scores they fire at. */
export const RULES = [
  { id: 'VELOCITY', name: 'Four or more authorisations on one card within an hour', precision: 6, score: [72, 94] },
  { id: 'HIGH_AMOUNT', name: 'Amount more than five times this card’s average', precision: 9, score: [64, 90] },
  { id: 'NEW_DEVICE', name: 'First authorisation from a device this card has not used', precision: 3, score: [55, 78] },
  { id: 'FOREIGN_BIN', name: 'Card issued in a different country to the merchant', precision: 2, score: [40, 66] },
  { id: 'NIGHT_TIME', name: 'Authorisation between one and five in the morning', precision: 4, score: [22, 48] },
  { id: 'MCC_RISK', name: 'Merchant category with elevated historical loss', precision: 7, score: [18, 44] },
];

const RULE_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]));
const QUIET_RULES = ['NIGHT_TIME', 'MCC_RISK', 'FOREIGN_BIN'];
const LOUD_RULES = ['VELOCITY', 'HIGH_AMOUNT', 'NEW_DEVICE'];

const CATEGORIES = ['Grocery', 'Fuel', 'Restaurant', 'Clothing', 'Electronics', 'Pharmacy', 'Transport', 'Streaming', 'Home', 'Hotel', 'Airline', 'Gift cards', 'Jewellery', 'Gaming'];
const HOME = 'GB';

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  const fraudPlan = [
    ...Array.from({ length: 5 }, (_, index) => ({ type: 'STOLEN_CARD', quiet: index >= 2 })),
    ...Array.from({ length: 4 }, (_, index) => ({ type: 'CARD_TESTING', quiet: index >= 2 })),
    ...Array.from({ length: 3 }, (_, index) => ({ type: 'ACCOUNT_TAKEOVER', quiet: index >= 2 })),
    ...Array.from({ length: 2 }, (_, index) => ({ type: 'FRIENDLY_FRAUD', quiet: index >= 1 })),
    ...Array.from({ length: 2 }, () => ({ type: 'MERCHANT_COLLUSION', quiet: true })),
  ];
  for (const plan of fraudPlan) add(fraudAlert(random, plan), { fraud: true, type: plan.type, kind: 'fraud', quiet: plan.quiet });

  const decoyPlan = [
    ...Array.from({ length: 8 }, () => 'holiday abroad'),
    ...Array.from({ length: 6 }, () => 'wedding spending'),
    ...Array.from({ length: 6 }, () => 'a planned big purchase'),
    ...Array.from({ length: 5 }, () => 'renewals on one day'),
  ];
  for (const look of decoyPlan) add(decoyAlert(random, look), { fraud: false, type: 'NONE', kind: 'loud false alarm', look });

  for (let index = 0; index < 359; index++) add(ordinaryAlert(random), { fraud: false, type: 'NONE', kind: 'ordinary' });

  // The queue as the engine leaves it: highest rule score first, ties broken by the alert's own time.
  items.sort((left, right) => right.ruleScore - left.ruleScore || left.firedAt.localeCompare(right.firedAt) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `ALT-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).alertId = id;
    item.id = id;
    item.ruleRank = index + 1;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'card-fraud-triage',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/card-fraud-triage.js',
      context: {
        issuer: 'Marlow Bank',
        currency: 'GBP',
        period: 'Alerts raised on 14 August 2026',
        rules: RULES.map((rule) => ({ id: rule.id, name: rule.name, historicalPrecisionPercent: rule.precision })),
        analystHour: 'One analyst has an hour before the card network cut-off, which is about fifty alerts.',
        note: 'The queue as stored is the rules engine’s own ordering, highest rule score first. The score itself is not shown to the model.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One alert: the rule that fired, the transaction, and what this card has been doing lately. */
function alert(random, { ruleId, amountValue, category, country, hour, history, tenureYears, usualCountries, monthlyAverage, newDevice = false, sameMerchantCount = 1, declinesBefore = 0, loud = false }) {
  const rule = RULE_BY_ID[ruleId];
  const floor = loud ? Math.round(rule.score[0] + (rule.score[1] - rule.score[0]) * 0.8) : rule.score[0];
  return {
    key: `${ruleId}-${random.int(100_000, 999_999)}`,
    id: null,
    firedAt: `2026-08-14T${String(hour).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}:00Z`,
    rule: rule.name,
    ruleId,
    rulePrecisionPercent: rule.precision,
    ruleScore: random.int(floor, rule.score[1]),
    ruleRank: null,
    amount: amountValue,
    merchant: merchantName(random),
    merchantCategory: category,
    merchantCountry: country,
    card: cardMask(random),
    cardholder: personName(random),
    customerTenureYears: tenureYears,
    usualCountries,
    averageMonthlySpend: monthlyAverage,
    typicalTransaction: round(monthlyAverage / random.int(12, 30)),
    newDevice,
    authorisationsAtThisMerchantBefore: sameMerchantCount - 1,
    declinesInLastDay: declinesBefore,
    recentTransactions: history,
  };
}
// #endregion

/**
 * The last ten authorisations on the card, oldest first, one line each: the context an analyst reads
 * before anything else. Lines rather than objects because that is how a statement reads, and because
 * four hundred cards of history has to stay inside the dataset budget.
 */
function historyOf(random, { countries = [HOME], categories = CATEGORIES, typical, count = 10, extra = [] } = {}) {
  const line = ({ day, amount: value, category, country }) => `${day} · ${value.toFixed(2)} · ${category} · ${country}`;
  const lines = Array.from({ length: count - extra.length }, () => ({
    day: `08-${String(random.int(1, 13)).padStart(2, '0')}`,
    amount: round(Math.max(3, random.normal(typical, typical * 0.55, { min: 2 }))),
    category: random.pick(categories),
    country: random.weighted(countries.map((country, index) => [country, index === 0 ? 80 : 20])),
  }));
  return [...lines, ...extra].sort((left, right) => left.day.localeCompare(right.day)).map(line);
}

function fraudAlert(random, { type, quiet }) {
  const ruleId = random.pick(quiet ? QUIET_RULES : LOUD_RULES);
  const monthlyAverage = amount(random, { min: 600, max: 3_200 });
  const typical = round(monthlyAverage / 22);
  const build = {
    STOLEN_CARD: () => ({
      amountValue: amount(random, { min: 180, max: 1_400 }),
      category: random.pick(['Electronics', 'Gift cards', 'Jewellery']),
      country: random.pick([HOME, 'IE', 'PL']),
      hour: random.int(1, 5),
      newDevice: true,
      history: historyOf(random, { typical, categories: ['Grocery', 'Fuel', 'Restaurant', 'Pharmacy', 'Transport'] }),
    }),
    CARD_TESTING: () => ({
      amountValue: round(random.float(0.9, 4.5)),
      category: random.pick(['Streaming', 'Gaming', 'Gift cards']),
      country: random.pick([HOME, 'US']),
      hour: random.int(1, 4),
      newDevice: true,
      declinesBefore: random.int(3, 9),
      history: historyOf(random, { typical, categories: ['Grocery', 'Fuel', 'Home'] }),
    }),
    ACCOUNT_TAKEOVER: () => ({
      amountValue: amount(random, { min: 220, max: 1_900 }),
      category: random.pick(['Electronics', 'Gift cards', 'Airline']),
      country: HOME,
      hour: random.int(2, 6),
      newDevice: true,
      history: historyOf(random, { typical, categories: ['Grocery', 'Restaurant', 'Streaming', 'Transport'] }),
    }),
    FRIENDLY_FRAUD: () => ({
      amountValue: amount(random, { min: 90, max: 700 }),
      category: random.pick(['Electronics', 'Clothing', 'Gaming']),
      country: HOME,
      hour: random.int(10, 22),
      history: historyOf(random, { typical, categories: ['Gaming', 'Clothing', 'Streaming', 'Restaurant'] }),
      sameMerchantCount: random.int(3, 6),
    }),
    MERCHANT_COLLUSION: () => ({
      amountValue: amount(random, { min: 240, max: 900 }),
      category: 'Gift cards',
      country: HOME,
      hour: random.int(9, 20),
      history: historyOf(random, { typical, categories: ['Grocery', 'Fuel', 'Restaurant'] }),
      sameMerchantCount: random.int(2, 4),
    }),
  }[type]();

  return alert(random, { ruleId, tenureYears: random.int(2, 18), usualCountries: [HOME], monthlyAverage, loud: !quiet, ...build });
}

/** Loud alerts on transactions the card's own history explains, if anyone reads it. */
function decoyAlert(random, look) {
  const monthlyAverage = amount(random, { min: 900, max: 4_000 });
  const typical = round(monthlyAverage / 20);
  const abroad = random.pick(['ES', 'IT', 'GR', 'PT', 'FR']);

  if (look === 'holiday abroad') {
    return alert(random, {
      loud: true, ruleId: 'FOREIGN_BIN', amountValue: amount(random, { min: 40, max: 320 }), category: random.pick(['Restaurant', 'Hotel', 'Transport']),
      country: abroad, hour: random.int(11, 23), tenureYears: random.int(4, 22), usualCountries: [HOME, abroad], monthlyAverage,
      history: historyOf(random, { typical, countries: [abroad, HOME], categories: ['Restaurant', 'Hotel', 'Transport', 'Grocery'], extra: [
        { day: '08-11', amount: amount(random, { min: 180, max: 900 }), category: 'Airline', country: HOME },
        { day: '08-12', amount: round(typical * 1.4), category: 'Restaurant', country: abroad },
      ] }),
    });
  }
  if (look === 'wedding spending') {
    return alert(random, {
      loud: true, ruleId: 'HIGH_AMOUNT', amountValue: amount(random, { min: 700, max: 2_600 }), category: random.pick(['Clothing', 'Jewellery', 'Hotel']),
      country: HOME, hour: random.int(10, 19), tenureYears: random.int(6, 25), usualCountries: [HOME], monthlyAverage,
      history: historyOf(random, { typical, categories: ['Clothing', 'Restaurant', 'Home', 'Grocery'], extra: [
        { day: '08-09', amount: amount(random, { min: 300, max: 1_100 }), category: 'Hotel', country: HOME },
        { day: '08-10', amount: amount(random, { min: 200, max: 800 }), category: 'Clothing', country: HOME },
      ] }),
    });
  }
  if (look === 'a planned big purchase') {
    return alert(random, {
      loud: true, ruleId: 'HIGH_AMOUNT', amountValue: amount(random, { min: 900, max: 2_400 }), category: 'Electronics',
      country: HOME, hour: random.int(12, 20), tenureYears: random.int(5, 20), usualCountries: [HOME], monthlyAverage,
      sameMerchantCount: random.int(2, 5),
      history: historyOf(random, { typical, categories: ['Grocery', 'Electronics', 'Home', 'Transport'], extra: [
        { day: '08-13', amount: round(random.float(1, 3)), category: 'Electronics', country: HOME },
      ] }),
    });
  }
  return alert(random, {
    loud: true, ruleId: 'VELOCITY', amountValue: round(random.float(6, 22)), category: 'Streaming',
    country: HOME, hour: random.int(6, 9), tenureYears: random.int(3, 16), usualCountries: [HOME], monthlyAverage,
    history: historyOf(random, { typical, categories: ['Streaming', 'Grocery', 'Transport'], extra: Array.from({ length: 4 }, () => ({
      day: '08-14', amount: round(random.float(5, 18)), category: 'Streaming', country: HOME,
    })) }),
  });
}

/** The rest of the queue: alerts that fired on nothing much. */
function ordinaryAlert(random) {
  const monthlyAverage = amount(random, { min: 300, max: 3_500 });
  const typical = round(monthlyAverage / 22);
  const foreign = random.bool(0.14);
  const country = foreign ? random.pick(['IE', 'FR', 'ES', 'US', 'DE']) : HOME;
  return alert(random, {
    ruleId: random.pick(RULES).id,
    amountValue: amount(random, { min: 4, max: 340 }),
    category: random.pick(CATEGORIES),
    country,
    hour: random.int(0, 23),
    tenureYears: random.int(1, 24),
    usualCountries: foreign ? [HOME, country] : [HOME],
    monthlyAverage,
    newDevice: random.bool(0.2),
    sameMerchantCount: random.weighted([[1, 55], [2, 25], [4, 20]]),
    history: historyOf(random, { typical, countries: foreign ? [HOME, country] : [HOME] }),
  });
}
