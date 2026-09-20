// Delivery exceptions: infer fault from raw tracking, address and contact evidence, then choose the
// next parcel action without hiding genuine uncertainty or the operating cost of failed attempts.

import { wilson } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const FAULTS = ['ADDRESS_QUALITY', 'CUSTOMER_UNAVAILABLE', 'COURIER', 'CUSTOMER_REFUSAL', 'UNCLEAR'];
const ACTIONS = ['RETRY', 'REROUTE_PICKUP', 'CONTACT_CUSTOMER', 'RETURN_TO_SENDER'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';
const round = (value) => Number(value.toFixed(2));
const ADDRESS_LEVELS = ['Unusable', 'Very poor', 'Poor', 'Workable', 'Good', 'Very good', 'Precise'];
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const attemptCost = (item) => round(item.shipment.failedAttempts * item.shipment.costPerAttempt);

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
    findings: [...repeatedMistake(graded, intended), ...honestFindings(graded, intended, context.currency)],
    kpis: headline(graded, { faultRight, actionRight, preventableRight, avoidableCost }, intended, context.currency),
    distributionTitle: 'Faults assigned',
    distribution: faultDistribution(graded),
    baselines: baselines(graded, faultRight, intended),
    matrix: faultMatrix(graded, intended),
    curve: addressThreshold(graded, intended),
    checks: cohortChecks(graded, intended),
    topItemsTitle: 'Least usable addresses',
    topItems: worstAddresses(graded, context.currency),
    courierRanking: courierRanking(graded),
    money: { avoidableCost, labelledAvoidableCost: labelledAvoidable(graded, intended), allFailedAttemptCost: round(graded.reduce((sum, result) => sum + attemptCost(result.item), 0)) },
    metrics: metrics(graded, faultRight, actionRight, intended),
    unclear: { predicted: graded.filter((result) => result.evaluation.fault === 'UNCLEAR').length, planted: graded.filter((result) => intended.get(result.item.id).fault === 'UNCLEAR').length },
  };
}
// #endregion

/** The failed-attempt cost on the shipments the labels call preventable: the reference for the model's figure. */
function labelledAvoidable(graded, intended) {
  return round(graded.filter((result) => intended.get(result.item.id).preventable).reduce((sum, result) => sum + attemptCost(result.item), 0));
}

function headline(graded, { faultRight, actionRight, preventableRight, avoidableCost }, intended, currency) {
  const plantedUnclear = graded.filter((result) => intended.get(result.item.id).fault === 'UNCLEAR');
  const calledUnclear = graded.filter((result) => result.evaluation.fault === 'UNCLEAR');
  const unclearRight = plantedUnclear.filter((result) => result.evaluation.fault === 'UNCLEAR');
  const never = graded.filter((result) => intended.get(result.item.id).neverAttemptedScan);
  const neverCaught = never.filter((result) => result.evaluation.fault === 'COURIER');
  const labelled = labelledAvoidable(graded, intended);
  const gap = labelled ? ` · the model's own preventable answers put it at ${money(avoidableCost, currency)}, ${share(avoidableCost - labelled, labelled)} ${avoidableCost >= labelled ? 'more' : 'less'}` : '';
  return [
    { label: 'Fault accuracy', value: share(faultRight.length, graded.length), context: `${faultRight.length} of ${graded.length} shipments · the driver's reason code on the scan gives the same answer` },
    { label: 'Next-action accuracy', value: share(actionRight.length, graded.length), context: `${actionRight.length} of ${graded.length} parcel actions, against a playbook the state never gives`, tone: actionRight.length === graded.length ? 'good' : 'warn' },
    { label: 'Fake attempt scans caught', value: `${neverCaught.length} of ${never.length}`, context: 'attempts logged away from the address, assigned to the courier from the raw scans', tone: neverCaught.length === never.length ? 'good' : 'warn' },
    { label: 'Unclear cases called unclear', value: `${unclearRight.length} of ${plantedUnclear.length}`, context: `${calledUnclear.length} shipments called unclear in all`, tone: unclearRight.length === plantedUnclear.length && calledUnclear.length === plantedUnclear.length ? 'good' : 'warn' },
    { label: 'Avoidable attempt cost', value: money(labelled, currency), context: `by the labels${gap} · preventability agreement ${share(preventableRight.length, graded.length)}`, tone: avoidableCost === labelled ? undefined : 'warn' },
  ];
}

const REASON_FAULT = { ADDRESS_INCOMPLETE: 'ADDRESS_QUALITY', NO_ANSWER: 'CUSTOMER_UNAVAILABLE', RECIPIENT_REFUSED: 'CUSTOMER_REFUSAL', NO_REASON_RECORDED: 'UNCLEAR' };

/** The rule: read the driver's reason code off the attempt scan; a scan with no reason is the courier's. */
function ruleFault(item) {
  const reason = item.trackingEvents.map((event) => event.reason).find((code) => REASON_FAULT[code]);
  return reason ? REASON_FAULT[reason] : 'COURIER';
}

function ruleAgreement(graded, intended) {
  return graded.filter((result) => ruleFault(result.item) === intended.get(result.item.id).fault).length;
}

function commonestFault(graded, intended) {
  const counts = FAULTS.map((fault) => ({ fault, count: graded.filter((result) => intended.get(result.item.id).fault === fault).length }));
  return counts.sort((left, right) => right.count - left.count)[0];
}

function baselines(graded, faultRight, intended) {
  if (!graded.length) return undefined;
  const commonest = commonestFault(graded, intended);
  return [
    { label: 'Jev', detail: 'planted fault assigned', value: faultRight.length / graded.length, model: true },
    { label: 'Rule: read the reason code', detail: 'a five-row lookup of the driver code on the attempt scan', value: ruleAgreement(graded, intended) / graded.length },
    { label: 'Always the commonest fault', detail: readable(commonest.fault), value: commonest.count / graded.length },
  ];
}

function metrics(graded, faultRight, actionRight, intended) {
  if (!graded.length) return undefined;
  const addressError = graded.reduce((sum, result) => sum + Math.abs(result.evaluation.addressQuality - intended.get(result.item.id).addressQuality), 0) / graded.length;
  const courierButPreventable = graded.filter((result) => result.evaluation.fault === 'COURIER' && result.evaluation.preventable);
  return {
    headline: { label: 'Fault accuracy', value: faultRight.length / graded.length, n: graded.length },
    accuracy: faultRight.length / graded.length,
    nextActionAccuracy: actionRight.length / graded.length,
    addressScoreMeanError: Number.isFinite(addressError) ? round(addressError) : null,
    contradictionRate: courierButPreventable.length / graded.length,
  };
}

function honestFindings(graded, intended, currency) {
  const lines = [];
  const right = graded.filter((result) => result.evaluation.fault === intended.get(result.item.id).fault).length;
  const ruleRight = ruleAgreement(graded, intended);
  if (ruleRight >= right && right > 0) lines.push(`Reading the driver's reason code off the scan assigns ${ruleRight} of ${graded.length} faults, against the model's ${right}. The code is in the state and maps one-to-one onto the planted fault, so this number shows the scans were read, not that a self-serving code was seen through.`);

  const actionWrong = graded.filter((result) => result.evaluation.nextAction !== intended.get(result.item.id).bestAction);
  if (actionWrong.length >= 3) {
    const pairs = new Map();
    for (const result of actionWrong) {
      const key = `${intended.get(result.item.id).bestAction}|${result.evaluation.nextAction}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    const [pair, count] = [...pairs].sort((left, right) => right[1] - left[1])[0];
    const [labelled, chosen] = pair.split('|');
    lines.push(`${actionWrong.length} next actions differ from the label, ${count} of them the same way: ${readable(chosen)} where the label says ${readable(labelled)}. The label follows a fixed action per fault that the state does not contain, so this measures guessing a house playbook.`);
  }

  const labelled = labelledAvoidable(graded, intended);
  const claimed = round(graded.reduce((sum, result) => sum + result.evaluation.avoidableCost, 0));
  const overCalled = graded.filter((result) => result.evaluation.preventable && !intended.get(result.item.id).preventable);
  if (overCalled.length) lines.push(`Preventable was answered yes on ${overCalled.length} shipments the labels call unavoidable, so the model's avoidable cost is ${money(claimed, currency)} against ${money(labelled, currency)} by the labels.`);

  const ranking = courierRanking(graded);
  if (ranking.length >= 2 && ranking[0].intervalLowPercent <= ranking[1].intervalHighPercent) lines.push(`The courier table does not separate the top of the list: ${ranking[0].courier} at ${ranking[0].faultRatePercent}% and ${ranking[1].courier} at ${ranking[1].faultRatePercent}% of shipments handled have overlapping intervals.`);
  return lines;
}

function faultDistribution(graded) {
  return FAULTS.map((fault) => ({ label: sentence(fault), count: graded.filter((result) => result.evaluation.fault === fault).length })).filter((entry) => entry.count);
}

function faultMatrix(graded, intended) {
  return {
    title: 'Planted fault against the one assigned',
    rowLabel: 'the fault that was planted',
    columnLabel: 'the fault the model assigned',
    columns: FAULTS.map(sentence),
    rows: FAULTS.map((actual) => ({ label: sentence(actual), cells: FAULTS.map((predicted) => ({ predicted, count: graded.filter((result) => intended.get(result.item.id).fault === actual && result.evaluation.fault === predicted).length, diagonal: actual === predicted })) })),
  };
}

function addressThreshold(graded, intended) {
  const addressCount = graded.filter((result) => intended.get(result.item.id).fault === 'ADDRESS_QUALITY').length;
  const points = Array.from({ length: 7 }, (_, score) => {
    const reviewed = graded.filter((result) => result.evaluation.addressQuality <= score);
    const caught = reviewed.filter((result) => intended.get(result.item.id).fault === 'ADDRESS_QUALITY').length;
    return { threshold: score / 6, reviewed: reviewed.length, caught, rate: reviewed.length ? caught / reviewed.length : null };
  });
  return { title: 'Address-quality review threshold', xLabel: 'Shipments reviewed', yLabel: 'Address faults caught', rateLabel: 'Share reviewed with planted address fault', of: addressCount, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
}

function cohortChecks(graded, intended) {
  const plantedKinds = ['address-quality', 'customer-unavailable', 'courier', 'customer-refusal', 'unclear'];
  const checks = plantedKinds.map((kind) => {
    const group = graded.filter((result) => intended.get(result.item.id).kind === kind);
    const wrong = group.filter((result) => result.evaluation.fault !== intended.get(result.item.id).fault || result.evaluation.nextAction !== intended.get(result.item.id).bestAction);
    const faultsRight = group.filter((result) => result.evaluation.fault === intended.get(result.item.id).fault).length;
    const actionsRight = group.filter((result) => result.evaluation.nextAction === intended.get(result.item.id).bestAction).length;
    return { id: kind, label: `${sentence(kind.replaceAll('-', ' '))} cases with fault or action wrong`, detail: `Fault right on ${faultsRight} of ${group.length}; next action matches the label on ${actionsRight}.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
  const never = graded.filter((result) => intended.get(result.item.id).neverAttemptedScan);
  const missed = never.filter((result) => result.evaluation.fault !== 'COURIER');
  return [...checks, { id: 'never-attempted', label: 'Depot attempt scans not assigned to courier', detail: `${never.length - missed.length} of ${never.length} invalid scans caught from raw events.`, count: missed.length, of: never.length, items: missed.map((result) => result.item.id) }];
}

const percentNumber = (value) => Number((value * 100).toFixed(1));

/** Couriers by courier-fault exceptions per shipment handled in this file, with a 95% interval on the rate. */
function courierRanking(graded) {
  const groups = new Map();
  for (const result of graded) {
    const courier = result.item.shipment.courier;
    const entry = groups.get(courier) ?? { courier, shipments: 0, failures: 0, unexplainedScans: 0 };
    entry.shipments += 1;
    if (result.evaluation.fault === 'COURIER') {
      entry.failures += 1;
      entry.unexplainedScans += result.item.trackingEvents.filter((event) => event.status === 'DELIVERY_ATTEMPTED' && (event.gpsDistanceFromAddressKm ?? 0) > 2).length;
    }
    groups.set(courier, entry);
  }
  return [...groups.values()]
    .filter((entry) => entry.failures)
    .map((entry) => {
      const interval = wilson(entry.failures, entry.shipments);
      return { ...entry, intervalLowPercent: percentNumber(interval.low), intervalHighPercent: percentNumber(interval.high), faultRatePercent: percentNumber(entry.failures / entry.shipments) };
    })
    .sort((left, right) => right.faultRatePercent - left.faultRatePercent || right.unexplainedScans - left.unexplainedScans);
}

function worstAddresses(graded, currency) {
  return [...graded].sort((left, right) => left.evaluation.addressQuality - right.evaluation.addressQuality || right.evaluation.avoidableCost - left.evaluation.avoidableCost).slice(0, 10).map((result) => ({ id: result.item.id, label: `${result.item.id} · ${result.item.shipment.courier} · ${result.item.address.line1}, ${result.item.address.city} · ${readable(result.evaluation.nextAction)}`, value: `${result.evaluation.addressQuality.toFixed(1)}/6 · ${money(result.evaluation.avoidableCost, currency)}` }));
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

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${ADDRESS_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;

/** The attempt scan that could not have been a visit: logged more than two kilometres from the address. */
function remoteAttempt(item) {
  return item.trackingEvents.find((event) => event.status === 'DELIVERY_ATTEMPTED' && (event.gpsDistanceFromAddressKm ?? 0) > 2);
}

function verdictDetail(item, currency) {
  const remote = remoteAttempt(item);
  if (remote) return `An attempt was logged at ${remote.at.slice(11, 16)} from ${remote.location}, ${remote.gpsDistanceFromAddressKm} km from the address.`;
  const attempts = item.shipment.failedAttempts;
  return `${attempts} failed ${attempts === 1 ? 'attempt' : 'attempts'} so far, ${money(attemptCost(item), currency)} in attempt fees.`;
}

function verdict(result, context) {
  const { evaluation, answers, item } = result;
  const currency = item.shipment.currency ?? context?.currency;
  const preventable = answers.preventable.noul;
  return {
    eyebrow: 'Who caused this exception, and what happens to the parcel',
    headline: `${sentence(evaluation.fault)}${evaluation.fault === 'UNCLEAR' ? '' : ' at fault'} · ${readable(evaluation.nextAction)}`,
    detail: verdictDetail(item, currency),
    facts: [
      { label: 'Confidence in the fault', value: percentOf(answers.fault.confidence), tone: answers.fault.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Confidence in the next action', value: percentOf(answers.next_action.confidence), tone: answers.next_action.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Address usable for another attempt', value: levelOf(evaluation.addressQuality), tone: evaluation.addressQuality >= 3.5 ? 'good' : evaluation.addressQuality >= 2.5 ? 'warn' : 'bad' },
      { label: 'An address or contact rule would have prevented it', value: `${evaluation.preventable ? 'Yes' : 'No'} · ${percentOf(Math.max(preventable, 1 - preventable))}`, tone: evaluation.preventable && evaluation.fault === 'COURIER' ? 'warn' : undefined },
      { label: 'Attempt fees so far', value: `${money(attemptCost(item), currency)} · ${item.shipment.failedAttempts} failed`, tone: item.shipment.failedAttempts ? 'warn' : undefined },
    ],
  };
}

function gradeNote(result, label) {
  const parts = [];
  if (label.neverAttemptedScan) parts.push('Planted with an attempt scan logged away from the address.');
  else if (label.kind !== 'background') parts.push(`Planted as ${readable(label.kind.replaceAll('-', ' '))}.`);
  if (label.bestAction !== result.evaluation.nextAction) parts.push(`The labelled next action is ${readable(label.bestAction)}; the model chose ${readable(result.evaluation.nextAction)}.`);
  return parts.length ? parts.join(' ') : undefined;
}

const grade = {
  labelId: (label) => label.shipmentId,
  // Right means what the headline counts: the planted fault was assigned. The action is in the note.
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.fault === label.fault,
      expected: label.fault,
      got: result.evaluation.fault,
      note: gradeNote(result, label),
      confidence: result.answers.fault.confidence,
    };
  },
};

const present = {
  number: 116,
  problem: {
    headline: 'Every failed delivery costs an attempt fee. Someone has to say who caused it and what happens to the parcel next.',
    stat: '250',
    statLabel: 'delivery exceptions, $4,195 in failed attempts',
  },
  hero: {
    item: 'SHP-0007',
    caption: 'The third scan says delivery attempted at 03:10, from the central depot, 24.6 km from 31 Corniche Road, outside the 09:00 to 21:00 window. Fault: the courier, at 95%.',
  },
  answers: {
    caption: 'Four typed answers: whose fault, how usable the address is, what happens to the parcel, and whether an address or contact rule would have prevented it.',
    reveal: ['fault', 'address_quality', 'next_action', 'preventable'],
  },
  miss: {
    item: 'SHP-0004',
    caption: 'The fault is right, an incomplete address scored 2.1 of 6. The action is where it differs: the label reroutes to a pickup point, the model contacts the customer first. Actions match the label on 46.8%.',
  },
  proof: {
    kpis: ['Fault accuracy', 'Fake attempt scans caught', 'Next-action accuracy'],
    chart: 'baselines',
    closing: '10 of 10 attempt scans logged away from the address were assigned to the courier from the raw events.',
  },
};

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
  stage: {
    hide: ['linkedToDemo', 'orderId', 'currency'],
    labels: {
      trackingEvents: 'Courier scans',
      contactLog: 'Contact log',
      courierServiceNotes: 'Courier service terms',
      sameAddressHistory: 'Earlier deliveries to this address',
      operatingContext: 'On the day',
      at: 'When',
      scanSource: 'Scanned with',
      gpsDistanceFromAddressKm: 'GPS distance from the address (km)',
      serviceLevel: 'Service',
      shippedAt: 'Shipped',
      promisedBy: 'Promised by',
      cashOnDelivery: 'Cash on delivery',
      orderValue: 'Order value',
      failedAttempts: 'Failed attempts',
      costPerAttempt: 'Cost per attempt',
      line1: 'Address',
      accessInstructions: 'Access instructions',
      pickupPointAvailable: 'Pickup point available',
      lastOutcome: 'Last outcome',
    },
    highlight: ['reason', 'gpsDistanceFromAddressKm', 'floor', 'failedAttempts'],
  },
  grade,
  verdict,
  present,
  caveat: 'The driver reason code on each attempt scan maps one-to-one onto the planted fault, so 100% fault accuracy here measures reading, not judgement; a bookkeeping field linking eleven customers to another demo is also in the state, and the next-action label follows a playbook the state never gives. A dataset with noisy reason codes is planned.',
  explain: {
    data: 'scripts/generate/delivery-exceptions.js#demo:data',
    state: 'demos/delivery-exceptions/demo.js#demo:state',
    questions: 'demos/delivery-exceptions/demo.js#demo:questions',
    evaluate: 'demos/delivery-exceptions/demo.js#demo:evaluate',
  },
};
