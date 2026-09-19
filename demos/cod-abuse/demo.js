// Repeat non-fulfilment abuse: read a customer's complete order history, distinguish a repeated
// pattern from an explainable bad streak, and choose the least restrictive safe access lane.

import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['SERIAL_REFUSER', 'SERIAL_RETURNER', 'ADDRESS_HOPPER', 'PROMO_ABUSER', 'NORMAL'];
const RESTRICTIONS = ['ALLOW', 'PREPAY_ONLY', 'BLOCK_COD'];
const round = (value) => Number(value.toFixed(2));
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
const share = (part, whole) => {
  if (!whole) return '—';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** Raw history plus the store evidence needed to excuse an outage; no behaviour rate is supplied. */
function buildState(item, context) {
  return {
    task: 'Decide whether this customer shows repeat non-fulfilment abuse before the next order ships.',
    customer: {
      id: item.id,
      name: item.name,
      phone: item.phone,
      account_ids: item.accountIds,
    },
    store_baselines: {
      average_refusal_rate: context.baselines.refusalRate,
      average_return_rate: context.baselines.returnRate,
      average_shipping_cost: context.averageShippingCost,
      currency: context.currency,
    },
    courier_outage_days: context.courierOutageDays,
    delivery_reason_codes: context.reasonCodes,
    order_history: item.orders.map((order) => ({
      ...order,
    })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  pattern: choice('Which behaviour pattern best explains this customer history?', {
    SERIAL_REFUSER: 'Repeated cash-on-delivery parcels are refused or never accepted.',
    SERIAL_RETURNER: 'Orders are repeatedly accepted and then returned inside the window.',
    ADDRESS_HOPPER: 'The same phone uses several accounts and many delivery addresses.',
    PROMO_ABUSER: 'First-order promotions repeat across multiple linked accounts.',
    NORMAL: 'The history is ordinary or its bad streak has a documented circumstantial cause.',
  }),
  intent: choice('What most likely explains the behaviour shown in the history?', {
    DELIBERATE: 'The repeated pattern appears intentional and benefits the customer.',
    CARELESS: 'The customer repeatedly creates avoidable failures without clear abuse.',
    CIRCUMSTANTIAL: 'An outage, address correction or isolated event explains the failures.',
  }),
  restriction: choice('What access should this customer have on the next order?', {
    ALLOW: 'Keep normal access, including cash on delivery.',
    PREPAY_ONLY: 'Allow ordering only after payment is collected in advance.',
    BLOCK_COD: 'Block cash on delivery because repeated fulfilment cost is likely.',
  }),
  severity: score('How severe is the repeat non-fulfilment or linked-account behaviour?', [
    'None',
    'Slight',
    'Mild',
    'Notable',
    'Serious',
    'Severe',
    'Extreme',
  ]),
  courier_at_fault: noul('Is the courier or a documented courier outage the main cause of the failed deliveries?', {
    yes: 'The failure dates and reason codes align with courier evidence.',
    no: 'The pattern is attributable to the customer or is not a delivery failure.',
  }),
};
// #endregion

// #region demo:evaluate
/** The lane shown for one customer, kept separate from the model's named behaviour pattern. */
function evaluate(answers, item) {
  const pattern = answers.pattern.choice;
  const restriction = answers.restriction.choice;
  return {
    flagged: restriction !== 'ALLOW',
    pattern,
    patternConfidence: answers.pattern.confidence,
    intent: answers.intent.choice,
    restriction,
    restricted: restriction !== 'ALLOW',
    severity: answers.severity.score,
    courierAtFault: answers.courier_at_fault.noul >= 0.5,
    courierAtFaultProbability: answers.courier_at_fault.noul,
    label: `${item.id}: ${readable(restriction)} · ${readable(pattern)}`,
  };
}
// #endregion

// #region demo:report
/** Pattern accuracy and lane accuracy stay separate, with both saved cost and restricted value. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.customerId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const patternRight = graded.filter((result) => result.evaluation.pattern === intended.get(result.item.id).pattern);
  const restrictionRight = graded.filter((result) => result.evaluation.restriction === intended.get(result.item.id).restriction);
  const restricted = graded.filter((result) => result.evaluation.restricted);
  const economics = moneyImpact(restricted, context.averageShippingCost);

  return {
    note: `Pattern and restriction are graded independently across ${graded.length} customer histories.`,
    findings: repeatedMistake(graded, intended),
    kpis: headline(graded, patternRight, restrictionRight, restricted, intended, economics, context.currency),
    distribution: restrictionMix(graded),
    matrix: confusion(graded, intended),
    curve: coverage(graded, intended),
    checks: checks(graded, intended),
    topItems: worstHistories(graded, context.currency),
    innocents: innocentOutcomes(graded, intended),
    economics,
  };
}
// #endregion

function customerStats(item) {
  const refusedCod = item.orders.filter((order) => order.paymentMethod === 'CASH_ON_DELIVERY' && order.deliveryOutcome === 'REFUSED');
  const returned = item.orders.filter((order) => order.deliveryOutcome === 'RETURNED');
  const good = item.orders.filter((order) => ['DELIVERED', 'RESHIPPED_DELIVERED'].includes(order.deliveryOutcome) && !order.refundIssued);
  return {
    refusedCod: refusedCod.length,
    returned: returned.length,
    failed: refusedCod.length + returned.length,
    goodValue: round(good.reduce((sum, order) => sum + order.value, 0)),
  };
}

function moneyImpact(restricted, averageShippingCost) {
  const shippingSaved = round(restricted.reduce((sum, result) => sum + customerStats(result.item).refusedCod * averageShippingCost, 0));
  const goodValueRestricted = round(restricted.reduce((sum, result) => sum + customerStats(result.item).goodValue, 0));
  return { shippingSaved, goodValueRestricted };
}

function headline(graded, patternRight, restrictionRight, restricted, intended, economics, currency) {
  const wronglyRestricted = restricted.filter((result) => intended.get(result.item.id).restriction === 'ALLOW');
  return [
    { label: 'Pattern accuracy', value: share(patternRight.length, graded.length), context: `${patternRight.length} of ${graded.length} histories` },
    { label: 'Restriction accuracy', value: share(restrictionRight.length, graded.length), context: `${wronglyRestricted.length} customers wrongly restricted`, tone: wronglyRestricted.length ? 'warn' : 'good' },
    { label: 'Shipping cost avoided', value: money(economics.shippingSaved, currency), context: `${restricted.length} customers restricted`, tone: 'good' },
    { label: 'Good value restricted', value: money(economics.goodValueRestricted, currency), context: 'Past accepted, non-refunded order value behind restricted lanes', tone: economics.goodValueRestricted ? 'warn' : 'good' },
  ];
}

function checks(graded, intended) {
  const abuse = PATTERNS.filter((pattern) => pattern !== 'NORMAL').map((pattern) => {
    const group = graded.filter((result) => intended.get(result.item.id).pattern === pattern);
    const wrong = group.filter((result) => result.evaluation.pattern !== pattern || result.evaluation.restriction !== intended.get(result.item.id).restriction);
    return { id: pattern.toLowerCase(), label: `${readable(pattern)} pattern or lane wrong`, detail: `${group.length - wrong.length} of ${group.length} named and restricted correctly.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
  const innocents = graded.filter((result) => intended.get(result.item.id).kind === 'innocent');
  const restricted = innocents.filter((result) => result.evaluation.restriction !== 'ALLOW');
  return [...abuse, { id: 'innocents', label: 'Explainable bad streaks restricted', detail: `${innocents.length - restricted.length} of ${innocents.length} innocents kept normal access.`, count: restricted.length, of: innocents.length, items: restricted.map((result) => result.item.id) }];
}

function restrictionMix(graded) {
  return RESTRICTIONS.map((restriction) => ({
    label: readable(restriction),
    count: graded.filter((result) => result.evaluation.restriction === restriction).length,
    tone: restriction === 'ALLOW' ? 'good' : 'warn',
  })).filter((entry) => entry.count);
}

function confusion(graded, intended) {
  return {
    title: 'Planted pattern against the one named',
    columns: PATTERNS.map(readable),
    rows: PATTERNS.map((actual) => ({
      label: readable(actual),
      cells: PATTERNS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => intended.get(result.item.id).pattern === actual && result.evaluation.pattern === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, intended) {
  const abuseCount = graded.filter((result) => intended.get(result.item.id).pattern !== 'NORMAL').length;
  const points = Array.from({ length: 7 }, (_, severity) => {
    const restricted = graded.filter((result) => result.evaluation.severity >= severity);
    const caught = restricted.filter((result) => intended.get(result.item.id).pattern !== 'NORMAL').length;
    return { threshold: severity / 6, reviewed: restricted.length, caught, rate: restricted.length ? caught / restricted.length : null };
  });
  return { title: 'Severity threshold', xLabel: 'Customers restricted', yLabel: 'Abuse patterns caught', rateLabel: 'Share restricted who were abusive', of: abuseCount, points };
}

function repeatedMistake(graded, intended) {
  const wrong = graded.filter((result) => result.evaluation.pattern !== intended.get(result.item.id).pattern);
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const key = `${intended.get(result.item.id).pattern}→${result.evaluation.pattern}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...groups].sort((left, right) => right[1] - left[1])[0];
  if (count < 3 || count < wrong.length * 0.3) return [];
  const [actual, predicted] = pair.split('→');
  return [`${count} of ${wrong.length} pattern errors repeat one swap: ${readable(actual)} called ${readable(predicted)}.`];
}

function worstHistories(graded, currency) {
  return [...graded]
    .sort((left, right) => customerStats(right.item).failed - customerStats(left.item).failed || right.evaluation.severity - left.evaluation.severity)
    .slice(0, 10)
    .map((result) => {
      const stats = customerStats(result.item);
      return { id: result.item.id, label: `${result.item.name} · ${result.evaluation.label}`, value: `${stats.failed} failed · ${money(stats.goodValue, currency)} good` };
    });
}

function innocentOutcomes(graded, intended) {
  return graded
    .filter((result) => intended.get(result.item.id).kind === 'innocent')
    .map((result) => ({ id: result.item.id, restriction: result.evaluation.restriction, keptAccess: result.evaluation.restriction === 'ALLOW', courierAtFault: result.evaluation.courierAtFault }));
}

export default {
  id: 'cod-abuse',
  title: 'Repeat non-fulfilment abuse',
  domain: 'orders',
  value: 'Spot customers who order on delivery and never take the parcel before the next one ships.',
  tags: ['orders', 'cash on delivery', 'returns', 'customer risk'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.name} · ${item.orders.length} orders`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/cod-abuse.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/cod-abuse.js#demo:data',
    state: 'demos/cod-abuse/demo.js#demo:state',
    questions: 'demos/cod-abuse/demo.js#demo:questions',
    evaluate: 'demos/cod-abuse/demo.js#demo:evaluate',
  },
};
