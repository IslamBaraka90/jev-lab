// Delivery exceptions: infer fault from raw tracking, address and contact evidence, then choose the
// next parcel action without hiding genuine uncertainty or the operating cost of failed attempts.

import { choice, noul, score } from '../lib/questions.js';

const FAULTS = ['ADDRESS_QUALITY', 'CUSTOMER_UNAVAILABLE', 'COURIER', 'CUSTOMER_REFUSAL', 'UNCLEAR'];
const ACTIONS = ['RETRY', 'REROUTE_PICKUP', 'CONTACT_CUSTOMER', 'RETURN_TO_SENDER'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';
const round = (value) => Number(value.toFixed(2));

// #region demo:state
/** All shipment evidence and operating rules, including cost per attempt; no fault label or score. */
function buildState(item, context) {
  return {
    task: 'Explain this delivery exception and choose the safest next action for the parcel.',
    review: { as_of: context.asOf, delivery_window: context.deliveryWindow },
    shipment_id: item.id,
    order_id: item.orderId,
    customer: item.customer,
    shipment: item.shipment,
    address: item.address,
    tracking_events: item.trackingEvents,
    customer_contact_log: item.contactLog,
    courier_service_notes: item.courierServiceNotes,
    same_address_history: item.sameAddressHistory,
    operating_context: item.operatingContext,
  };
}
// #endregion

// #region demo:questions
const questions = {
  fault: choice('What is the best-supported primary cause of this failed or delayed delivery?', {
    ADDRESS_QUALITY: 'The supplied address is incomplete, contradictory or not precise enough to deliver.',
    CUSTOMER_UNAVAILABLE: 'Credible attempts were made but the customer could not be reached or was absent.',
    COURIER: 'The tracking trail shows a misroute, invalid attempt scan or other courier-side failure.',
    CUSTOMER_REFUSAL: 'The recipient explicitly refused the parcel, including a cash-on-delivery refusal.',
    UNCLEAR: 'The evidence does not support assigning primary fault to one party.',
  }),
  address_quality: score('How usable is the supplied address for another doorstep attempt?', [
    'Unusable', 'Very poor', 'Poor', 'Workable', 'Good', 'Very good', 'Precise',
  ]),
  next_action: choice('What should happen to the parcel next?', {
    RETRY: 'Arrange another credible courier attempt at the supplied address.',
    REROUTE_PICKUP: 'Send the parcel to a verified pickup point.',
    CONTACT_CUSTOMER: 'Pause and obtain address or availability information from the customer.',
    RETURN_TO_SENDER: 'End delivery attempts and return the parcel.',
  }),
  preventable: noul('Could a better address-validation or customer-contact rule have prevented this exception?', {
    yes: 'An address or contact control could reasonably have prevented the failed attempt.',
    no: 'The evidence points to courier failure, refusal or irreducible uncertainty.',
  }),
};
// #endregion

// #region demo:evaluate
/** Converts four typed answers into queue fields and the avoidable attempt cost shown in the report. */
function evaluate(answers, item) {
  const fault = answers.fault.choice;
  const preventable = answers.preventable.noul >= 0.5;
  const avoidableCost = preventable ? round(item.shipment.failedAttempts * item.shipment.costPerAttempt) : 0;
  return {
    flagged: fault !== 'UNCLEAR',
    fault,
    addressQuality: answers.address_quality.score,
    nextAction: answers.next_action.choice,
    preventable,
    preventableProbability: answers.preventable.noul,
    avoidableCost,
    label: `${item.id}: ${readable(fault)} · ${readable(answers.next_action.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Grades fault and action, exposes unclear calls and ranks courier-side evidence without smoothing. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.shipmentId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const faultRight = graded.filter((result) => result.evaluation.fault === intended.get(result.item.id).fault);
  const actionRight = graded.filter((result) => result.evaluation.nextAction === intended.get(result.item.id).bestAction);
  const preventableRight = graded.filter((result) => result.evaluation.preventable === intended.get(result.item.id).preventable);
  const avoidableCost = round(graded.reduce((sum, result) => sum + result.evaluation.avoidableCost, 0));

  return {
    note: `${graded.length} exceptions graded. Attempt cost is visible in every state; planted labels are not.`,
    findings: repeatedMistake(graded, intended),
    kpis: headline(graded, faultRight, actionRight, preventableRight, avoidableCost, intended, context.currency),
    distribution: faultDistribution(graded),
    matrix: faultMatrix(graded, intended),
    curve: addressThreshold(graded, intended),
    checks: cohortChecks(graded, intended),
    topItems: worstAddresses(graded, context.currency),
    courierRanking: courierRanking(graded),
    money: { avoidableCost, allFailedAttemptCost: round(graded.reduce((sum, result) => sum + result.item.shipment.failedAttempts * result.item.shipment.costPerAttempt, 0)) },
    unclear: { predicted: graded.filter((result) => result.evaluation.fault === 'UNCLEAR').length, planted: graded.filter((result) => intended.get(result.item.id).fault === 'UNCLEAR').length },
  };
}
// #endregion

function headline(graded, faultRight, actionRight, preventableRight, avoidableCost, intended, currency) {
  const predictedUnclear = graded.filter((result) => result.evaluation.fault === 'UNCLEAR').length;
  const plantedUnclear = graded.filter((result) => intended.get(result.item.id).fault === 'UNCLEAR').length;
  return [
    { label: 'Fault accuracy', value: share(faultRight.length, graded.length), context: `${faultRight.length} of ${graded.length} shipments` },
    { label: 'Next-action accuracy', value: share(actionRight.length, graded.length), context: `${actionRight.length} of ${graded.length} parcel actions` },
    { label: 'Unclear calls', value: `${predictedUnclear} of ${graded.length}`, context: `${plantedUnclear} genuinely unclear cases`, tone: Math.abs(predictedUnclear - plantedUnclear) > 5 ? 'warn' : 'good' },
    { label: 'Avoidable attempt cost', value: money(avoidableCost, currency), context: `${share(preventableRight.length, graded.length)} preventability agreement`, tone: avoidableCost ? 'warn' : 'good' },
  ];
}

function faultDistribution(graded) {
  return FAULTS.map((fault) => ({ label: readable(fault), count: graded.filter((result) => result.evaluation.fault === fault).length, tone: fault === 'UNCLEAR' ? 'neutral' : 'warn' })).filter((entry) => entry.count);
}

function faultMatrix(graded, intended) {
  return {
    title: 'Planted fault against the one assigned',
    columns: FAULTS.map(readable),
    rows: FAULTS.map((actual) => ({ label: readable(actual), cells: FAULTS.map((predicted) => ({ predicted, count: graded.filter((result) => intended.get(result.item.id).fault === actual && result.evaluation.fault === predicted).length, diagonal: actual === predicted })) })),
  };
}

function addressThreshold(graded, intended) {
  const addressCount = graded.filter((result) => intended.get(result.item.id).fault === 'ADDRESS_QUALITY').length;
  const points = Array.from({ length: 7 }, (_, score) => {
    const reviewed = graded.filter((result) => result.evaluation.addressQuality <= score);
    const caught = reviewed.filter((result) => intended.get(result.item.id).fault === 'ADDRESS_QUALITY').length;
    return { threshold: score / 6, reviewed: reviewed.length, caught, rate: reviewed.length ? caught / reviewed.length : null };
  });
  return { title: 'Address-quality review threshold', xLabel: 'Shipments reviewed', yLabel: 'Address faults caught', rateLabel: 'Share reviewed with planted address fault', of: addressCount, points };
}

function cohortChecks(graded, intended) {
  const plantedKinds = ['address-quality', 'customer-unavailable', 'courier', 'customer-refusal', 'unclear'];
  const checks = plantedKinds.map((kind) => {
    const group = graded.filter((result) => intended.get(result.item.id).kind === kind);
    const wrong = group.filter((result) => result.evaluation.fault !== intended.get(result.item.id).fault || result.evaluation.nextAction !== intended.get(result.item.id).bestAction);
    return { id: kind, label: `${readable(kind)} cases with fault or action wrong`, detail: `${group.length - wrong.length} of ${group.length} assigned correctly.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
  const never = graded.filter((result) => intended.get(result.item.id).neverAttemptedScan);
  const missed = never.filter((result) => result.evaluation.fault !== 'COURIER');
  return [...checks, { id: 'never-attempted', label: 'Depot attempt scans not assigned to courier', detail: `${never.length - missed.length} of ${never.length} invalid scans caught from raw events.`, count: missed.length, of: never.length, items: missed.map((result) => result.item.id) }];
}

function courierRanking(graded) {
  const groups = new Map();
  for (const result of graded.filter((entry) => entry.evaluation.fault === 'COURIER')) {
    const courier = result.item.shipment.courier;
    const entry = groups.get(courier) ?? { courier, failures: 0, unexplainedScans: 0 };
    entry.failures += 1;
    entry.unexplainedScans += result.item.trackingEvents.filter((event) => event.status === 'DELIVERY_ATTEMPTED' && (event.gpsDistanceFromAddressKm ?? 0) > 2).length;
    groups.set(courier, entry);
  }
  return [...groups.values()].sort((left, right) => right.failures - left.failures || right.unexplainedScans - left.unexplainedScans);
}

function worstAddresses(graded, currency) {
  return [...graded].sort((left, right) => left.evaluation.addressQuality - right.evaluation.addressQuality || right.evaluation.avoidableCost - left.evaluation.avoidableCost).slice(0, 10).map((result) => ({ id: result.item.id, label: `${result.item.address.line1}, ${result.item.address.city} · ${readable(result.evaluation.nextAction)}`, value: `${result.evaluation.addressQuality.toFixed(1)}/6 · ${money(result.evaluation.avoidableCost, currency)}` }));
}

function repeatedMistake(graded, intended) {
  const wrong = graded.filter((result) => result.evaluation.fault !== intended.get(result.item.id).fault);
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const key = `${intended.get(result.item.id).fault}→${result.evaluation.fault}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...groups].sort((left, right) => right[1] - left[1])[0];
  if (count < 3) return [];
  return [`${count} of ${wrong.length} fault errors repeat one swap: ${readable(pair.split('→')[0])} called ${readable(pair.split('→')[1])}.`];
}

export default {
  id: 'delivery-exceptions',
  title: 'Delivery exceptions',
  domain: 'orders',
  value: 'Work out who caused a failed delivery, and what to do with the parcel next.',
  tags: ['orders', 'delivery', 'couriers', 'addresses'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.shipment.courier} · ${item.address.city}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/delivery-exceptions.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/delivery-exceptions.js#demo:data',
    state: 'demos/delivery-exceptions/demo.js#demo:state',
    questions: 'demos/delivery-exceptions/demo.js#demo:questions',
    evaluate: 'demos/delivery-exceptions/demo.js#demo:evaluate',
  },
};
