// Two hundred and twenty disputes at an invented online shop, each with the customer's own words, the
// order, what the courier recorded, and what this customer has claimed before. The merchant's refund
// policy is a set of numbers, so the right action is a consistent reading of those numbers against
// those facts — which is what makes this gradeable. The answers go to
// data/synthetic/dispute-routing.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { personName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1113;

export const POLICY = {
  returnWindowDays: 30,
  notReceivedWaitDays: 10,
  autoRefundLimit: 300,
  damagePhotoRequired: true,
  keepItPartialPercent: 50,
  cosmeticPartialPercent: 25,
  repeatNotReceivedLimit: 2,
  shippingRefundedWhenMerchantAtFault: true,
};

const GOODS = ['a coffee grinder', 'a wool throw', 'two table lamps', 'a desk chair', 'a cast iron pan', 'a linen duvet set', 'a pair of boots', 'a bluetooth speaker', 'a rug', 'a kettle', 'a bookcase', 'a set of knives'];

const MESSAGES = {
  NOT_RECEIVED: [
    'It has been {days} days and nothing has arrived. The tracking has not moved since the {city} depot. I need {goods} for a birthday on Saturday, can you send another or refund me.',
    'Still no parcel. Nobody has knocked, there is no card, and the neighbours have nothing. Tracking says it is out for delivery but it has said that for {days} days.',
    'My order never turned up. I have checked with everyone in the building. Please can you refund this, I have waited long enough.',
  ],
  NOT_AS_DESCRIBED: [
    'The listing said {goods} in oak. What arrived is a sort of orange pine and the finish is rough along one edge. Photos attached.',
    'This is not what was on the website. The size is nowhere near what the description says and I measured twice before ordering.',
    'It works but the colour is completely different to the picture. I do not really want to post it back, is there something you can do on the price.',
  ],
  DUPLICATE: [
    'I have been charged twice for the same order. Two payments of {total} within a minute of each other on the same card. I only wanted one.',
    'There are two identical charges on my statement for this order. I pressed the button once and the page hung, that is all.',
  ],
  SUBSCRIPTION: [
    'I cancelled this in my account on the {day}th and you have taken another month anyway. I have the confirmation email.',
    'Please stop taking this money. I cancelled before the renewal date and it has gone out again.',
  ],
  DAMAGE: [
    'It arrived smashed. The box had a hole in the corner and the driver was already gone when I opened it.',
    'The parcel was crushed on one side and {goods} inside is cracked. I have not used it.',
  ],
  KEEP_IT: [
    'There is a scratch on the base of {goods}. It does not affect using it and honestly I cannot face posting it back. Is there a partial refund.',
    'One of the legs is marked. I will keep it if you can do something on the price, I do not want to return the whole thing.',
  ],
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, label) => { items.push(item); labels.push({ key: item.key, ...label, ...decide(item) }); };

  for (let index = 0; index < 18; index++) add(friendlyFraud(random), { kind: 'friendly fraud' });
  for (let index = 0; index < 12; index++) add(genuineNonDelivery(random), { kind: 'genuine non-delivery' });
  for (let index = 0; index < 8; index++) add(duplicateCharge(random), { kind: 'duplicate charge' });
  for (let index = 0; index < 6; index++) add(policyExpired(random), { kind: 'policy expired' });
  for (let index = 0; index < 5; index++) add(needsEvidence(random), { kind: 'needs one photo' });
  for (let index = 0; index < 171; index++) add(everydayDispute(random), { kind: 'everyday' });

  items.sort((left, right) => left.openedAt.localeCompare(right.openedAt) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `DSP-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).disputeId = id;
    item.id = id;
  });
  for (const item of items) delete item.key;
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'dispute-routing',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/dispute-routing.js',
      context: {
        merchant: 'Bramble & Co',
        sells: 'Homeware and small electricals, shipped across the United Kingdom',
        currency: 'GBP',
        period: 'August 2026',
        policy: POLICY,
        policyInWords: [
          `Returns and claims are accepted for ${POLICY.returnWindowDays} days after delivery; after that the claim is refused with a reason.`,
          `A parcel is only treated as lost once ${POLICY.notReceivedWaitDays} days have passed since the last courier scan.`,
          `Refunds above ${POLICY.autoRefundLimit} are signed off by a person, whatever the merits.`,
          'A damage claim needs a photograph before anything is refunded.',
          `A customer who keeps a faulty item is offered ${POLICY.keepItPartialPercent}% back, or ${POLICY.cosmeticPartialPercent}% for marks that do not affect use.`,
          `A third not-received claim from the same customer is refused when the courier has proof of delivery.`,
          'Where the shop or its courier is at fault, the shipping charge goes back too.',
        ],
        note: 'Nothing here is acted on. The demo turns a dispute into the call a backend would receive, and stops.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One dispute: the customer's words, the order, what the courier recorded, and their history. */
function dispute(random, { claim, message, orderTotal, shipping, daysSinceOrder, daysSinceDelivery, trackingStatus, deliveryProof = false, daysSinceLastScan = 0, photoAttached = false, wantsToKeep = false, cosmetic = false, priorDisputes = 0, priorNotReceived = 0, cancelledOnRecord = null, duplicateChargeId = null }) {
  const openedAt = random.day('2026-08-01', '2026-08-31');
  return {
    key: `${openedAt}-${random.int(100_000, 999_999)}`,
    id: null,
    openedAt,
    claim,
    orderTotal,
    shippingPaid: shipping,
    daysSinceOrder,
    daysSinceDelivery,
    trackingStatus,
    deliveryProof,
    photoAttached,
    priorDisputes,
    priorNotReceived,
    customerSince: `${random.int(2019, 2026)}`,
    message,
    daysSinceLastScan,
    wantsToKeep,
    cosmetic,
    cancelledOnRecord,
    duplicateChargeId,
    customer: personName(random),
    orderId: `ORD-${random.int(20_000, 99_999)}`,
  };
}
// #endregion

/**
 * The merchant's policy applied to the facts. This is the answer key, and it lives here rather than in
 * the demo so that nothing in the state can reach it. The order of these rules is the policy's own:
 * money over the limit goes to a person before anything else is considered.
 */
function decide(item) {
  const band = (percent) => (percent === 100 ? (item.shippingPaid > 0 ? 'FULL_PLUS_SHIPPING' : 'FULL') : percent === 50 ? 'PARTIAL_50' : 'PARTIAL_25');

  if (item.claim === 'DUPLICATE') return { correctAction: 'REFUND_NOW', refundBand: 'FULL', reasonCode: 'DUPLICATE' };
  if (item.orderTotal > POLICY.autoRefundLimit) return { correctAction: 'ESCALATE', refundBand: 'NONE', reasonCode: reasonFor(item) };
  if (item.daysSinceDelivery !== null && item.daysSinceDelivery > POLICY.returnWindowDays) return { correctAction: 'DENY', refundBand: 'NONE', reasonCode: reasonFor(item) };
  if (item.claim === 'DAMAGE' && !item.photoAttached) return { correctAction: 'REQUEST_EVIDENCE', refundBand: 'NONE', reasonCode: 'DAMAGE' };
  if (item.claim === 'NOT_RECEIVED' && item.deliveryProof && item.priorNotReceived >= POLICY.repeatNotReceivedLimit) return { correctAction: 'DENY', refundBand: 'NONE', reasonCode: 'NO_FAULT_FOUND' };
  if (item.claim === 'NOT_RECEIVED' && item.daysSinceLastScan >= POLICY.notReceivedWaitDays) return { correctAction: 'REFUND_NOW', refundBand: band(100), reasonCode: 'NOT_RECEIVED' };
  if (item.claim === 'SUBSCRIPTION') return item.cancelledOnRecord
    ? { correctAction: 'REFUND_NOW', refundBand: 'FULL', reasonCode: 'SUBSCRIPTION' }
    : { correctAction: 'DENY', refundBand: 'NONE', reasonCode: 'NO_FAULT_FOUND' };
  if (item.claim === 'DAMAGE') return { correctAction: 'REFUND_NOW', refundBand: band(100), reasonCode: 'DAMAGE' };
  if (item.wantsToKeep) return { correctAction: 'REFUND_NOW', refundBand: band(item.cosmetic ? 25 : 50), reasonCode: 'NOT_AS_DESCRIBED' };
  return { correctAction: 'REFUND_NOW', refundBand: 'FULL', reasonCode: 'NOT_AS_DESCRIBED' };
}

const reasonFor = (item) => (item.claim === 'KEEP_IT' ? 'NOT_AS_DESCRIBED' : item.claim);

function fill(random, template, { goods, days, total, city }) {
  return template
    .replace('{goods}', goods ?? random.pick(GOODS))
    .replace('{days}', days ?? random.int(6, 21))
    .replace('{total}', `£${total ?? 0}`)
    .replace('{city}', city ?? random.pick(['Warrington', 'Doncaster', 'Bristol', 'Dunfermline', 'Swindon']))
    .replace('{day}', random.int(2, 26));
}

/** A claim of non-delivery against a courier record that shows it delivered, from a repeat claimer. */
function friendlyFraud(random) {
  const total = amount(random, { min: 25, max: 260 });
  return dispute(random, {
    claim: 'NOT_RECEIVED',
    message: fill(random, random.pick(MESSAGES.NOT_RECEIVED), { total }),
    orderTotal: total,
    shipping: random.pick([0, 3.95, 4.95]),
    daysSinceOrder: random.int(8, 24),
    daysSinceDelivery: random.int(3, 18),
    trackingStatus: `Delivered, signed ${random.pick(['at the door', 'by the resident', 'by a neighbour'])}`,
    deliveryProof: true,
    priorDisputes: random.int(3, 7),
    priorNotReceived: random.int(2, 5),
  });
}

/** A parcel that genuinely stopped moving, well past the waiting period. */
function genuineNonDelivery(random) {
  const total = amount(random, { min: 20, max: 280 });
  const scans = random.int(11, 26);
  return dispute(random, {
    claim: 'NOT_RECEIVED',
    message: fill(random, random.pick(MESSAGES.NOT_RECEIVED), { total, days: scans }),
    orderTotal: total,
    shipping: random.pick([3.95, 4.95, 6.95]),
    daysSinceOrder: scans + random.int(2, 6),
    daysSinceDelivery: null,
    trackingStatus: `In transit, last scan ${scans} days ago`,
    daysSinceLastScan: scans,
    priorDisputes: random.int(0, 1),
    priorNotReceived: 0,
  });
}

/** The same order charged twice within a minute. */
function duplicateCharge(random) {
  const total = amount(random, { min: 15, max: 240 });
  return dispute(random, {
    claim: 'DUPLICATE',
    message: fill(random, random.pick(MESSAGES.DUPLICATE), { total }),
    orderTotal: total,
    shipping: 0,
    daysSinceOrder: random.int(1, 9),
    daysSinceDelivery: random.int(0, 6),
    trackingStatus: 'Delivered',
    deliveryProof: true,
    duplicateChargeId: `PAY-${random.int(500_000, 999_999)}`,
    priorDisputes: random.int(0, 1),
  });
}

/** A fair complaint that arrived months late. */
function policyExpired(random) {
  const days = random.int(38, 140);
  const total = amount(random, { min: 20, max: 250 });
  return dispute(random, {
    claim: random.pick(['NOT_AS_DESCRIBED', 'DAMAGE']),
    message: fill(random, random.pick([...MESSAGES.NOT_AS_DESCRIBED, ...MESSAGES.DAMAGE]), { total }),
    orderTotal: total,
    shipping: random.pick([0, 3.95]),
    daysSinceOrder: days + random.int(2, 5),
    daysSinceDelivery: days,
    trackingStatus: 'Delivered',
    deliveryProof: true,
    photoAttached: random.bool(0.5),
    priorDisputes: random.int(0, 2),
  });
}

/** Damage claimed, nothing attached: the policy says ask for the photograph. */
function needsEvidence(random) {
  const total = amount(random, { min: 18, max: 240 });
  return dispute(random, {
    claim: 'DAMAGE',
    message: fill(random, random.pick(MESSAGES.DAMAGE), { total }),
    orderTotal: total,
    shipping: random.pick([0, 3.95, 4.95]),
    daysSinceOrder: random.int(3, 14),
    daysSinceDelivery: random.int(1, 9),
    trackingStatus: 'Delivered',
    deliveryProof: true,
    photoAttached: false,
    priorDisputes: random.int(0, 2),
  });
}

/** The everyday queue: ordinary claims, inside the window, with the evidence you would expect. */
function everydayDispute(random) {
  const claim = random.weighted([['NOT_AS_DESCRIBED', 34], ['DAMAGE', 22], ['SUBSCRIPTION', 18], ['KEEP_IT', 14], ['NOT_RECEIVED', 12]]);
  const expensive = random.bool(0.12);
  const total = expensive ? amount(random, { min: 305, max: 1_400 }) : amount(random, { min: 12, max: 295 });
  const delivered = claim === 'NOT_RECEIVED' ? null : random.int(1, 26);
  const scans = claim === 'NOT_RECEIVED' ? random.int(11, 20) : 0;

  return dispute(random, {
    claim: claim === 'KEEP_IT' ? 'NOT_AS_DESCRIBED' : claim,
    message: fill(random, random.pick(MESSAGES[claim]), { total }),
    orderTotal: total,
    shipping: random.pick([0, 3.95, 4.95, 6.95]),
    daysSinceOrder: (delivered ?? scans) + random.int(2, 7),
    daysSinceDelivery: delivered,
    trackingStatus: claim === 'NOT_RECEIVED' ? `In transit, last scan ${scans} days ago` : 'Delivered',
    deliveryProof: claim !== 'NOT_RECEIVED',
    daysSinceLastScan: scans,
    photoAttached: claim === 'DAMAGE' ? true : random.bool(0.4),
    wantsToKeep: claim === 'KEEP_IT',
    cosmetic: claim === 'KEEP_IT' && random.bool(0.45),
    cancelledOnRecord: claim === 'SUBSCRIPTION' ? random.bool(0.7) : null,
    priorDisputes: random.weighted([[0, 60], [1, 25], [2, 10], [3, 5]]),
    priorNotReceived: random.bool(0.1) ? 1 : 0,
  });
}
