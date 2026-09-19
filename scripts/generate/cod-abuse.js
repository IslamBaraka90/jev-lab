// Repeat non-fulfilment abuse across compact customer histories. Labels are written separately so
// the model must distinguish repeated behaviour from one explainable courier or address incident.

import { addDays, createRandom } from './lib/random.js';
import { cityName, personName, streetAddress } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1112;

const PERIOD = { from: '2025-01-01', to: '2026-06-30' };
const OUTAGE_DAYS = Array.from({ length: 7 }, (_, index) => addDays('2026-01-12', index));
const AVERAGE_SHIPPING_COST = 12.5;
const REASON_CODES = {
  DELIVERED: 'Parcel accepted by the customer.',
  CUSTOMER_REFUSED: 'Customer explicitly refused the parcel at the door.',
  CUSTOMER_UNREACHABLE: 'Courier could not reach the customer after repeated attempts.',
  ADDRESS_INCORRECT: 'The supplied address was incomplete or wrong.',
  COURIER_OUTAGE: 'Delivery failed during a documented courier network outage.',
  CHANGE_OF_MIND: 'Delivered goods were returned inside the returns window.',
  DAMAGED_IN_TRANSIT: 'Delivered goods were returned because the parcel was damaged.',
};

const PLAN = [
  ...Array(14).fill('SERIAL_REFUSER'),
  ...Array(9).fill('SERIAL_RETURNER'),
  ...Array(7).fill('ADDRESS_HOPPER'),
  ...Array(6).fill('PROMO_ABUSER'),
  ...Array(5).fill('INNOCENT_OUTAGE'),
  ...Array(5).fill('INNOCENT_ADDRESS'),
  ...Array(134).fill('NORMAL'),
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const occurrences = new Map();
  const items = random.shuffle(PLAN).map((kind, index) => {
    const occurrence = occurrences.get(kind) ?? 0;
    occurrences.set(kind, occurrence + 1);
    return customer(random, kind, occurrence, index);
  });
  const labels = items.map((item) => labelFor(item));
  const allOrders = items.flatMap((item) => item.orders);
  const refusalCount = allOrders.filter((order) => order.deliveryOutcome === 'REFUSED').length;
  const returnCount = allOrders.filter((order) => order.deliveryOutcome === 'RETURNED').length;

  for (const item of items) delete item.kind;
  return {
    dataset: {
      id: 'cod-abuse',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/cod-abuse.js',
      context: {
        store: 'Harbour Market',
        period: PERIOD,
        currency: 'USD',
        averageShippingCost: AVERAGE_SHIPPING_COST,
        baselines: {
          refusalRate: round(refusalCount / allOrders.length, 4),
          returnRate: round(returnCount / allOrders.length, 4),
        },
        courierOutageDays: OUTAGE_DAYS,
        reasonCodes: REASON_CODES,
      },
      items,
    },
    labels,
  };
}

function labelFor(item) {
  const pattern = item.kind.startsWith('INNOCENT_') || item.kind === 'NORMAL' ? 'NORMAL' : item.kind;
  const restriction = {
    SERIAL_REFUSER: 'BLOCK_COD',
    SERIAL_RETURNER: 'PREPAY_ONLY',
    ADDRESS_HOPPER: 'BLOCK_COD',
    PROMO_ABUSER: 'PREPAY_ONLY',
    NORMAL: 'ALLOW',
  }[pattern];
  return {
    customerId: item.id,
    pattern,
    restriction,
    kind: item.kind.startsWith('INNOCENT_') ? 'innocent' : pattern === 'NORMAL' ? 'normal' : 'abuse',
    intent: pattern === 'NORMAL' ? 'CIRCUMSTANTIAL' : 'DELIBERATE',
    courierAtFault: item.kind === 'INNOCENT_OUTAGE',
  };
}

function customer(random, kind, occurrence, index) {
  const id = `C-${String(index + 1).padStart(4, '0')}`;
  const addresses = buildAddresses(random, kind);
  const phone = `+971 50 000 ${String(1000 + index).slice(-4)}`;
  const orderCount = countFor(random, kind, occurrence);
  const orders = Array.from({ length: orderCount }, (_, orderIndex) => baseOrder(random, id, orderIndex, addresses));
  applyPattern(random, orders, kind, occurrence, addresses);
  finaliseOrders(orders, id);
  return {
    id,
    name: personName(random),
    phone,
    accountIds: [...new Set(orders.map((order) => order.accountId))],
    orders,
    kind,
  };
}

function countFor(random, kind, occurrence) {
  if (kind === 'SERIAL_REFUSER' && occurrence === 0) return 14;
  if (kind === 'SERIAL_REFUSER') return random.int(10, 18);
  if (kind === 'SERIAL_RETURNER') return random.int(10, 16);
  if (kind === 'ADDRESS_HOPPER') return random.int(9, 15);
  if (kind === 'PROMO_ABUSER') return random.int(6, 10);
  if (kind.startsWith('INNOCENT_')) return random.int(8, 12);
  return random.int(4, 10);
}

function buildAddresses(random, kind) {
  const count = kind === 'ADDRESS_HOPPER' ? 6 : kind === 'PROMO_ABUSER' ? 3 : 2;
  return Array.from({ length: count }, () => `${streetAddress(random)}, ${cityName(random)}`);
}

// #region demo:data
/** One order row in a customer's history; behaviour is planted only after the neutral row exists. */
function baseOrder(random, customerId, index, addresses) {
  const accountId = `A-${customerId.slice(2)}-01`;
  return {
    id: null,
    accountId,
    date: random.day(PERIOD.from, PERIOD.to),
    value: amount(random, { min: 18, max: 780 }),
    currency: 'USD',
    paymentMethod: random.weighted([['CASH_ON_DELIVERY', 62], ['CARD', 38]]),
    deliveryOutcome: 'DELIVERED',
    courierAttempts: 1,
    reasonCode: 'DELIVERED',
    addressUsed: random.pick(addresses.slice(0, 2)),
    promotion: index === 0 ? 'WELCOME15' : null,
    refundIssued: false,
    reshippedFromOrderId: null,
  };
}
// #endregion

function applyPattern(random, orders, kind, occurrence, addresses) {
  if (kind === 'SERIAL_REFUSER') {
    const failures = occurrence === 0 ? 11 : Math.ceil(orders.length * random.float(0.62, 0.82, 2));
    for (const order of random.sample(orders, failures)) refuse(order, 'CUSTOMER_REFUSED', 2);
  } else if (kind === 'SERIAL_RETURNER') {
    for (const order of random.sample(orders, Math.ceil(orders.length * 0.65))) returned(order);
  } else if (kind === 'ADDRESS_HOPPER') {
    orders.forEach((order, index) => {
      order.accountId = `A-HOP-${String(occurrence + 1).padStart(2, '0')}-${String((index % 4) + 1).padStart(2, '0')}`;
      order.addressUsed = addresses[index % addresses.length];
      if (index % 3 === 0) refuse(order, 'CUSTOMER_UNREACHABLE', 3);
    });
  } else if (kind === 'PROMO_ABUSER') {
    orders.forEach((order, index) => {
      order.accountId = `A-PRO-${String(occurrence + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      order.promotion = 'WELCOME50';
      order.addressUsed = addresses[index % addresses.length];
    });
  } else if (kind === 'INNOCENT_OUTAGE') {
    orders.slice(0, 3).forEach((order, index) => {
      order.date = OUTAGE_DAYS[index + 1];
      refuse(order, 'COURIER_OUTAGE', 3);
    });
  } else if (kind === 'INNOCENT_ADDRESS') {
    orders.slice(0, 2).forEach((order, index) => {
      order.date = addDays('2025-09-10', index * 2);
      order.addressUsed = addresses[0];
      order.reshipGroup = index;
      order.reshipRole = 'failed';
      refuse(order, 'ADDRESS_INCORRECT', 2);
    });
    orders.slice(2, 4).forEach((order, index) => {
      order.date = addDays('2025-09-11', index * 2);
      order.addressUsed = addresses[1];
      order.deliveryOutcome = 'RESHIPPED_DELIVERED';
      order.reasonCode = 'DELIVERED';
      order.reshipGroup = index;
      order.reshipRole = 'success';
    });
  } else if (orders.length > 6 && random.bool(0.3)) {
    const order = random.pick(orders);
    if (random.bool()) refuse(order, 'CUSTOMER_UNREACHABLE', 2);
    else returned(order, 'DAMAGED_IN_TRANSIT');
  }
}

function refuse(order, reasonCode, attempts) {
  order.paymentMethod = 'CASH_ON_DELIVERY';
  order.deliveryOutcome = 'REFUSED';
  order.courierAttempts = attempts;
  order.reasonCode = reasonCode;
  order.refundIssued = false;
}

function returned(order, reasonCode = 'CHANGE_OF_MIND') {
  order.paymentMethod = 'CARD';
  order.deliveryOutcome = 'RETURNED';
  order.courierAttempts = 1;
  order.reasonCode = reasonCode;
  order.refundIssued = true;
}

function finaliseOrders(orders, customerId) {
  orders.sort((left, right) => left.date.localeCompare(right.date));
  orders.forEach((order, index) => {
    order.id = `O-${customerId.slice(2)}-${String(index + 1).padStart(2, '0')}`;
  });
  const failedByGroup = new Map(orders.filter((order) => order.reshipRole === 'failed').map((order) => [order.reshipGroup, order.id]));
  for (const order of orders) {
    if (order.reshipRole === 'success') order.reshippedFromOrderId = failedByGroup.get(order.reshipGroup);
    delete order.reshipGroup;
    delete order.reshipRole;
  }
}
