// Three hundred checkouts at an invented electronics and fashion store, one busy August week. Nine of
// them are fraud, in four patterns that each need more than one field to see, and twelve are perfectly
// good orders that look terrible. Everything else is ordinary trade. What is planted goes to
// data/synthetic/order-risk.labels.json, outside the demo folder, so no state builder can read it.

import { createRandom } from './lib/random.js';
import { cardMask, cityName, merchantName, personName, streetAddress } from './lib/names.js';
import { amount, round, unitPrice } from './lib/money.js';

export const SEED = 1111;

const WEEK = { from: '2026-08-10', to: '2026-08-16' };

const CATALOGUE = [
  { sku: 'EL-1120', name: 'Wireless earbuds', category: 'Electronics', price: [39, 180] },
  { sku: 'EL-2240', name: 'Mechanical keyboard', category: 'Electronics', price: [60, 210] },
  { sku: 'EL-3310', name: '27-inch monitor', category: 'Electronics', price: [180, 520] },
  { sku: 'EL-4180', name: 'Laptop, 14-inch', category: 'Electronics', price: [720, 1850] },
  { sku: 'EL-5090', name: 'Phone, flagship', category: 'Electronics', price: [640, 1240] },
  { sku: 'EL-6010', name: 'USB-C cable', category: 'Electronics', price: [6, 19] },
  { sku: 'EL-6020', name: 'Phone case', category: 'Electronics', price: [8, 28] },
  { sku: 'EL-6030', name: 'Screen protector', category: 'Electronics', price: [5, 14] },
  { sku: 'FA-1010', name: 'Cotton shirt', category: 'Fashion', price: [28, 75] },
  { sku: 'FA-2020', name: 'Wool coat', category: 'Fashion', price: [120, 340] },
  { sku: 'FA-3030', name: 'Trainers', category: 'Fashion', price: [55, 190] },
  { sku: 'FA-4040', name: 'Leather bag', category: 'Fashion', price: [90, 420] },
  { sku: 'FA-5050', name: 'Socks, three pack', category: 'Fashion', price: [7, 16] },
];

const SMALL = CATALOGUE.filter((line) => line.price[1] <= 30);
const BIG = CATALOGUE.filter((line) => line.price[0] >= 180);
const HOME = 'GB';
const NEAR = ['IE', 'FR', 'DE', 'NL', 'ES', 'IT'];
const FAR = ['RU', 'NG', 'UA', 'ID', 'BR', 'TR'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label }); };

  for (let index = 0; index < 279; index++) add(...ordinary(random));
  cardTesting(random, add);
  for (let index = 0; index < 2; index++) add(...reshipper(random));
  for (let index = 0; index < 2; index++) add(...accountTakeover(random));
  for (let index = 0; index < 2; index++) add(...firstPartyMisuse(random));
  for (let index = 0; index < 3; index++) add(...giftAbroad(random));
  for (let index = 0; index < 3; index++) add(...knownCustomerNewDevice(random));
  for (let index = 0; index < 3; index++) add(...corporateFirstOrder(random));
  for (let index = 0; index < 3; index++) add(...customerAwayFromHome(random));

  items.sort((left, right) => left.placedAt.localeCompare(right.placedAt) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `ORD-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).orderId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;
  reorder(items);

  return {
    dataset: {
      id: 'order-risk',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/order-risk.js',
      context: {
        store: 'Northgate Supply Co',
        sells: 'Electronics and fashion, mostly to the United Kingdom',
        currency: 'GBP',
        period: '10 to 16 August 2026',
        averageOrderValue: 118,
        medianCheckoutSeconds: 205,
        shareShippedAbroadPercent: 7,
        chargebackRatePercent: 0.4,
        reviewCapacity: 'The team can open about twenty orders a day by hand; everything else is approved or declined on the spot.',
        fraudRateNote: 'This file carries far more fraud than a real shop: nine orders in three hundred. A real week is nearer three in a thousand.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One checkout, with the signals a payments team actually has when the order lands. */
function order(random, { placedAt, basket, tenureDays, priorOrders, priorChargebacks = 0, priorRefunds = 0, connectionCountry = HOME, billingCountry = HOME, shippingCountry = HOME, binCountry = billingCountry, newShippingAddress = false, deviceIsNew = false, ordersFromThisDeviceToday = 1, deviceDistinctCards = 1, accountChangedHoursAgo = null, checkoutSeconds, coupon = null, giftMessage = false, shippingLine1, billingName }) {
  const total = round(basket.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  return {
    key: `${placedAt}-${random.int(100_000, 999_999)}`,
    id: null,
    placedAt,
    total,
    itemCount: basket.reduce((sum, line) => sum + line.quantity, 0),
    customerTenureDays: tenureDays,
    priorOrders,
    priorChargebacks,
    connectionCountry,
    billingCountry,
    shippingCountry,
    newShippingAddress,
    ordersFromThisDeviceToday,
    checkoutSeconds,
    basket,
    priorRefunds,
    lifetimeValue: round(priorOrders * random.float(38, 210)),
    accountChangedHoursAgo,
    card: cardMask(random),
    binCountry,
    deviceId: `DEV-${random.int(100_000, 999_999)}`,
    deviceIsNew,
    deviceDistinctCards,
    billingName: billingName ?? personName(random),
    billingCity: cityName(random),
    shippingCity: cityName(random),
    shippingLine1: shippingLine1 ?? streetAddress(random),
    coupon,
    giftMessage,
  };
}
// #endregion

/** Keeps the twelve fields the queue card shows in front of the detail the state panel carries. */
function reorder(items) {
  const front = ['id', 'placedAt', 'total', 'itemCount', 'customerTenureDays', 'priorOrders', 'priorChargebacks', 'connectionCountry', 'billingCountry', 'shippingCountry', 'newShippingAddress', 'ordersFromThisDeviceToday', 'checkoutSeconds'];
  items.forEach((item, index) => {
    const ordered = {};
    for (const key of front) ordered[key] = item[key];
    for (const key of Object.keys(item)) if (!(key in ordered)) ordered[key] = item[key];
    items[index] = ordered;
  });
}

function basketOf(random, lines, { quantity = [1, 2] } = {}) {
  return lines.map((line) => ({ sku: line.sku, name: line.name, category: line.category, quantity: random.int(quantity[0], quantity[1]), unitPrice: unitPrice(random, { min: line.price[0], max: line.price[1] }) }));
}

function when(random, { night = false } = {}) {
  const day = random.day(WEEK.from, WEEK.to);
  const hour = night ? random.int(1, 4) : random.weighted([[random.int(9, 17), 70], [random.int(18, 22), 25], [random.int(0, 8), 5]]);
  return `${day}T${String(hour).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}:00Z`;
}

/** Ordinary trade: a known-looking customer, a sensible basket, everything in one country. */
function ordinary(random) {
  const returning = random.bool(0.62);
  const tenureDays = returning ? random.int(60, 2_100) : random.int(0, 20);
  const priorOrders = returning ? random.int(2, 34) : random.int(0, 1);
  const abroad = random.bool(0.06);
  const country = abroad ? random.pick(NEAR) : HOME;
  const basket = basketOf(random, random.sample(CATALOGUE.filter((line) => line.price[0] < 180), random.int(1, 3)));

  return [order(random, {
    placedAt: when(random),
    basket,
    tenureDays,
    priorOrders,
    priorRefunds: random.bool(0.18) ? random.int(1, 2) : 0,
    priorChargebacks: returning && random.bool(0.05) ? 1 : 0,
    connectionCountry: country,
    billingCountry: country,
    shippingCountry: country,
    newShippingAddress: random.bool(0.1),
    deviceIsNew: random.bool(0.14),
    ordersFromThisDeviceToday: random.bool(0.08) ? 2 : 1,
    accountChangedHoursAgo: random.bool(0.05) ? random.int(6, 700) : null,
    checkoutSeconds: random.int(70, 460),
    coupon: random.bool(0.14) ? `AUG${random.int(10, 25)}` : null,
    giftMessage: random.bool(0.04),
  }), { fraud: false, pattern: 'NONE', kind: 'ordinary' }];
}

/** Card testing: one device, one night, small baskets, a different card every time. */
function cardTesting(random, add) {
  const deviceId = `DEV-${random.int(100_000, 999_999)}`;
  const day = random.day(WEEK.from, WEEK.to);
  for (let index = 0; index < 3; index++) {
    const item = order(random, {
      placedAt: `${day}T0${random.int(1, 3)}:${String(random.int(10, 59)).padStart(2, '0')}:00Z`,
      basket: basketOf(random, random.sample(SMALL, 1), { quantity: [1, 1] }),
      tenureDays: 0,
      priorOrders: 0,
      newShippingAddress: true,
      deviceIsNew: index === 0,
      ordersFromThisDeviceToday: 4 + index,
      deviceDistinctCards: 4 + index,
      checkoutSeconds: random.int(16, 44),
    });
    item.deviceId = deviceId;
    add(item, { fraud: true, pattern: 'CARD_TESTING', kind: 'fraud' });
  }
}

/** Reshipper: expensive electronics, a first order, and three countries that do not agree. */
function reshipper(random) {
  const shippingCountry = random.pick(FAR);
  return [order(random, {
    placedAt: when(random, { night: true }),
    basket: basketOf(random, random.sample(BIG, random.int(1, 2)), { quantity: [1, 1] }),
    tenureDays: random.int(0, 2),
    priorOrders: 0,
    connectionCountry: random.pick(FAR),
    billingCountry: HOME,
    shippingCountry,
    binCountry: random.pick(NEAR),
    newShippingAddress: true,
    deviceIsNew: true,
    checkoutSeconds: random.int(38, 96),
    shippingLine1: `Unit ${random.int(100, 940)}, ${merchantName(random).split(' ')[0]} Logistics Park`,
  }), { fraud: true, pattern: 'RESHIPPER', kind: 'fraud' }];
}

/** Account takeover: a good customer, a new device, a new address, and a basket unlike any before. */
function accountTakeover(random) {
  const priorOrders = random.int(12, 30);
  return [order(random, {
    placedAt: when(random, { night: true }),
    basket: basketOf(random, random.sample(BIG, 2), { quantity: [1, 1] }),
    tenureDays: random.int(700, 1_400),
    priorOrders,
    newShippingAddress: true,
    deviceIsNew: true,
    accountChangedHoursAgo: random.int(1, 6),
    checkoutSeconds: random.int(28, 70),
  }), { fraud: true, pattern: 'ACCOUNT_TAKEOVER', kind: 'fraud' }];
}

/** First-party misuse: everything checks out, and this account has disputed its own orders before. */
function firstPartyMisuse(random) {
  return [order(random, {
    placedAt: when(random),
    basket: basketOf(random, random.sample(BIG, 1), { quantity: [1, 2] }),
    tenureDays: random.int(400, 900),
    priorOrders: random.int(6, 14),
    priorChargebacks: 2,
    priorRefunds: random.int(5, 8),
    checkoutSeconds: random.int(120, 380),
  }), { fraud: true, pattern: 'FIRST_PARTY_MISUSE', kind: 'fraud' }];
}

/** A present sent abroad by a customer who has shopped here for years. */
function giftAbroad(random) {
  return [order(random, {
    placedAt: when(random),
    basket: basketOf(random, random.sample(CATALOGUE.filter((line) => line.price[0] >= 39 && line.price[1] <= 420), random.int(1, 2))),
    tenureDays: random.int(500, 1_800),
    priorOrders: random.int(8, 25),
    shippingCountry: random.pick(NEAR),
    newShippingAddress: true,
    checkoutSeconds: random.int(150, 420),
    giftMessage: random.bool(0.66),
  }), { fraud: false, pattern: 'NONE', kind: 'decoy', look: 'gift abroad' }];
}

/** The same customer, the same address, a phone they have never used here before. */
function knownCustomerNewDevice(random) {
  return [order(random, {
    placedAt: when(random),
    basket: basketOf(random, random.sample(CATALOGUE, random.int(1, 3))),
    tenureDays: random.int(600, 2_000),
    priorOrders: random.int(10, 40),
    deviceIsNew: true,
    checkoutSeconds: random.int(180, 520),
  }), { fraud: false, pattern: 'NONE', kind: 'decoy', look: 'new device' }];
}

/** A business buying kit for an office: first order, big total, and every detail filled in carefully. */
function corporateFirstOrder(random) {
  return [order(random, {
    placedAt: when(random),
    basket: basketOf(random, random.sample(BIG, random.int(2, 3)), { quantity: [2, 4] }),
    tenureDays: random.int(0, 1),
    priorOrders: 0,
    checkoutSeconds: random.int(260, 620),
    coupon: `PO-${random.int(40_000, 99_999)}`,
    billingName: `${merchantName(random).split(' ')[0]} ${random.pick(['Interiors', 'Systems', 'Studios', 'Partners'])} Ltd`,
  }), { fraud: false, pattern: 'NONE', kind: 'decoy', look: 'company first order' }];
}

/** A regular customer ordering to their own home while the connection says somewhere else. */
function customerAwayFromHome(random) {
  return [order(random, {
    placedAt: when(random),
    basket: basketOf(random, random.sample(CATALOGUE.filter((line) => line.price[0] >= 39 && line.price[0] < 180), random.int(1, 2))),
    tenureDays: random.int(300, 1_500),
    priorOrders: random.int(5, 20),
    connectionCountry: random.pick([...NEAR, ...FAR]),
    checkoutSeconds: random.int(120, 400),
  }), { fraud: false, pattern: 'NONE', kind: 'decoy', look: 'connecting from abroad' }];
}
