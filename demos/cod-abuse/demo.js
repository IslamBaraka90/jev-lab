// Repeat non-fulfilment abuse: read a customer's complete order history, distinguish a repeated
// pattern from an explainable bad streak, and choose the least restrictive safe access lane.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['SERIAL_REFUSER', 'SERIAL_RETURNER', 'ADDRESS_HOPPER', 'PROMO_ABUSER', 'NORMAL'];
const RESTRICTIONS = ['ALLOW', 'PREPAY_ONLY', 'BLOCK_COD'];
const round = (value) => Number(value.toFixed(2));
const SEVERITY_LEVELS = ['None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Extreme'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase()).replace(/\bcod\b/i, 'COD');
const wholeMoney = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
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
  const matrix = confusion(graded, intended);

  return {
    note: `Pattern and restriction are graded independently across ${graded.length} customer histories.`,
    findings: [...repeatedMistake(graded, intended), ...honestFindings(graded, intended, matrix)],
    kpis: headline(graded, patternRight, restrictionRight, restricted, intended, economics, context.currency),
    distributionTitle: 'Access lanes chosen',
    distribution: restrictionMix(graded),
    baselines: baselines(graded, patternRight, intended),
    matrix,
    curve: coverage(graded, intended),
    byPlantedGroup: plantedGroups(graded, intended),
    checks: checks(graded, intended),
    topItemsTitle: 'Histories with the most failed orders',
    topItems: worstHistories(graded, context.currency),
    innocents: innocentOutcomes(graded, intended),
    economics,
    metrics: metrics(graded, patternRight, restricted, intended, matrix),
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

const isAbusive = (label) => label.restriction !== 'ALLOW';

/** Mean recall over the planted patterns, so 144 normal histories cannot carry the number. */
function macroRecall(matrix) {
  const classes = (matrixStats(matrix)?.classes ?? []).filter((entry) => entry.support > 0);
  if (!classes.length) return null;
  return classes.reduce((total, entry) => total + entry.recall, 0) / classes.length;
}

function headline(graded, patternRight, restrictionRight, restricted, intended, economics, currency) {
  const wronglyRestricted = restricted.filter((result) => !isAbusive(intended.get(result.item.id)));
  const abusive = graded.filter((result) => isAbusive(intended.get(result.item.id)));
  const abusiveRestricted = abusive.filter((result) => result.evaluation.restricted);
  const innocents = graded.filter((result) => intended.get(result.item.id).kind === 'innocent');
  const innocentsAllowed = innocents.filter((result) => !result.evaluation.restricted);
  const normal = graded.filter((result) => intended.get(result.item.id).pattern === 'NORMAL');
  const recall = macroRecall(confusion(graded, intended));
  return [
    { label: 'Pattern accuracy', value: share(patternRight.length, graded.length), context: `${patternRight.length} of ${graded.length} histories · ${normal.length} are normal, so answering normal every time scores ${share(normal.length, graded.length)} · mean recall over the ${PATTERNS.length} patterns ${recall === null ? '—' : share(Math.round(recall * 1000), 1000)}` },
    { label: 'Restriction accuracy', value: share(restrictionRight.length, graded.length), context: `${wronglyRestricted.length} customers wrongly restricted`, tone: wronglyRestricted.length ? 'warn' : 'good' },
    { label: 'Abusers restricted', value: `${abusiveRestricted.length} of ${abusive.length}`, context: `${restricted.length - wronglyRestricted.length} of the ${restricted.length} customers restricted were abusive (${share(restricted.length - wronglyRestricted.length, restricted.length)})`, tone: abusiveRestricted.length === abusive.length ? 'good' : 'warn' },
    { label: 'Innocents left alone', value: `${innocentsAllowed.length} of ${innocents.length}`, context: 'explainable bad streaks: a courier outage, or a wrong address later reshipped', tone: innocentsAllowed.length === innocents.length ? 'good' : 'warn' },
    { label: 'Shipping cost avoided', value: wholeMoney(economics.shippingSaved, currency), context: `past refused cash-on-delivery parcels of the ${restricted.length} customers restricted, at the average shipping cost · it looks back, and ${wronglyRestricted.length} of those customers were wrongly restricted` },
  ];
}

const historyCounts = (item) => ({ ...customerStats(item), orders: item.orders.length, accounts: item.accountIds.length });

/** The rule: three accounts on one phone is a hopper if parcels were refused, else a promo abuser; otherwise refusals, or returns, on at least three orders and half the history. */
function rulePattern(item) {
  const counts = historyCounts(item);
  if (counts.accounts >= 3) return counts.refusedCod >= 2 ? 'ADDRESS_HOPPER' : 'PROMO_ABUSER';
  if (counts.refusedCod >= 3 && counts.refusedCod * 2 >= counts.orders) return 'SERIAL_REFUSER';
  if (counts.returned >= 3 && counts.returned * 2 >= counts.orders) return 'SERIAL_RETURNER';
  return 'NORMAL';
}

function ruleAgreement(graded, intended) {
  return graded.filter((result) => rulePattern(result.item) === intended.get(result.item.id).pattern).length;
}

function baselines(graded, patternRight, intended) {
  if (!graded.length) return undefined;
  const normal = graded.filter((result) => intended.get(result.item.id).pattern === 'NORMAL');
  return [
    { label: 'Jev', detail: 'planted pattern named', value: patternRight.length / graded.length, model: true },
    { label: 'Rule: count accounts, refusals and returns', detail: 'three accounts on one phone, or failures on at least three orders and half the history', value: ruleAgreement(graded, intended) / graded.length },
    { label: 'Always the commonest pattern', detail: 'normal', value: normal.length / graded.length },
  ];
}

function metrics(graded, patternRight, restricted, intended, matrix) {
  if (!graded.length) return undefined;
  const abusive = graded.filter((result) => isAbusive(intended.get(result.item.id)));
  const rightlyRestricted = restricted.filter((result) => isAbusive(intended.get(result.item.id)));
  const namedButAllowed = graded.filter((result) => result.evaluation.pattern !== 'NORMAL' && !result.evaluation.restricted);
  return {
    headline: { label: 'Pattern accuracy', value: patternRight.length / graded.length, n: graded.length },
    accuracy: patternRight.length / graded.length,
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    macroRecall: macroRecall(matrix),
    precision: restricted.length ? rightlyRestricted.length / restricted.length : null,
    recall: abusive.length ? rightlyRestricted.length / abusive.length : null,
    contradictionRate: namedButAllowed.length / graded.length,
  };
}

/** One row per planted group: how many were named right and how many got the intended lane. */
function plantedGroups(graded, intended) {
  const groupOf = (label) => (label.kind === 'abuse' ? readable(label.pattern) : label.kind === 'innocent' ? 'explainable bad streak' : 'ordinary');
  const names = [...new Set(graded.map((result) => groupOf(intended.get(result.item.id))))];
  return names.map((group) => {
    const members = graded.filter((result) => groupOf(intended.get(result.item.id)) === group);
    return {
      group,
      customers: members.length,
      namedRight: members.filter((result) => result.evaluation.pattern === intended.get(result.item.id).pattern).length,
      laneRight: members.filter((result) => result.evaluation.restriction === intended.get(result.item.id).restriction).length,
    };
  });
}

function honestFindings(graded, intended, matrix) {
  const lines = [];
  const right = graded.filter((result) => result.evaluation.pattern === intended.get(result.item.id).pattern).length;
  const recall = macroRecall(matrix);
  const missedClasses = (matrixStats(matrix)?.classes ?? []).filter((entry) => entry.support > 0 && entry.recall === 0);
  if (missedClasses.length) lines.push(`Accuracy hides a whole pattern: ${missedClasses.map((entry) => `${entry.label} was named on 0 of ${entry.support}`).join(', ')}. Mean recall over the patterns is ${share(Math.round(recall * 1000), 1000)} against ${share(right, graded.length)} accuracy, because most histories are normal.`);

  const namedButAllowed = graded.filter((result) => result.evaluation.pattern !== 'NORMAL' && !result.evaluation.restricted);
  if (namedButAllowed.length) {
    const names = [...new Set(namedButAllowed.map((result) => readable(result.evaluation.pattern)))];
    lines.push(`${namedButAllowed.length} customers were named ${names.join(' or ')} and left on normal access. The restriction question speaks only of fulfilment cost, which promotion abuse does not have, so the label's lane is a house rule the state never gives.`);
  }

  const ruleRight = ruleAgreement(graded, intended);
  if (ruleRight > right) lines.push(`A rule that counts accounts, refusals and returns names ${ruleRight} of ${graded.length} patterns, against the model's ${right}. The planted groups do not overlap, so this file rewards counting more than judgement.`);
  return lines;
}

function checks(graded, intended) {
  const abuse = PATTERNS.filter((pattern) => pattern !== 'NORMAL').map((pattern) => {
    const group = graded.filter((result) => intended.get(result.item.id).pattern === pattern);
    const wrong = group.filter((result) => result.evaluation.pattern !== pattern || result.evaluation.restriction !== intended.get(result.item.id).restriction);
    return { id: pattern.toLowerCase(), label: `${sentence(pattern)} pattern or lane wrong`, detail: `${group.length - wrong.length} of ${group.length} named and restricted correctly.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
  const innocents = graded.filter((result) => intended.get(result.item.id).kind === 'innocent');
  const restricted = innocents.filter((result) => result.evaluation.restriction !== 'ALLOW');
  return [...abuse, { id: 'innocents', label: 'Explainable bad streaks restricted', detail: `${innocents.length - restricted.length} of ${innocents.length} innocents kept normal access.`, count: restricted.length, of: innocents.length, items: restricted.map((result) => result.item.id) }];
}

function restrictionMix(graded) {
  return RESTRICTIONS.map((restriction) => ({
    label: sentence(restriction),
    count: graded.filter((result) => result.evaluation.restriction === restriction).length,
  })).filter((entry) => entry.count);
}

function confusion(graded, intended) {
  return {
    title: 'Planted pattern against the one named',
    rowLabel: 'the pattern that was planted',
    columnLabel: 'the pattern the model named',
    columns: PATTERNS.map(sentence),
    rows: PATTERNS.map((actual) => ({
      label: sentence(actual),
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
  return { title: 'Severity threshold', xLabel: 'Customers restricted', yLabel: 'Abuse patterns caught', rateLabel: 'Share restricted who were abusive', of: abuseCount, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
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

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${SEVERITY_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;
const LANE_WORDS = { ALLOW: 'Keep normal access', PREPAY_ONLY: 'Prepay only', BLOCK_COD: 'Block cash on delivery' };
const INTENT_TONE = { DELIBERATE: 'bad', CARELESS: 'warn', CIRCUMSTANTIAL: undefined };

function historyLine(item) {
  const counts = historyCounts(item);
  const accounts = counts.accounts === 1 ? 'one account' : `${counts.accounts} accounts on one phone`;
  return `${counts.refusedCod} refused cash-on-delivery parcels and ${counts.returned} returns in ${counts.orders} orders, across ${accounts}.`;
}

function verdict(result, context) {
  const { evaluation, answers, item } = result;
  const named = evaluation.pattern !== 'NORMAL';
  const spent = customerStats(item).refusedCod * (context?.averageShippingCost ?? 0);
  const courier = answers.courier_at_fault.noul;
  return {
    eyebrow: 'The access this customer gets on the next order',
    headline: `${LANE_WORDS[evaluation.restriction]} · ${named ? readable(evaluation.pattern) : 'no abuse pattern'}`,
    detail: historyLine(item),
    facts: [
      { label: 'Pattern', value: `${sentence(evaluation.pattern)} · ${percentOf(evaluation.patternConfidence)}${named && !evaluation.restricted ? ' · left on normal access' : ''}`, tone: named ? 'bad' : undefined },
      { label: 'Confidence in the lane', value: percentOf(answers.restriction.confidence), tone: answers.restriction.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Intent', value: `${sentence(evaluation.intent)} · ${percentOf(answers.intent.confidence)}`, tone: INTENT_TONE[evaluation.intent] },
      { label: 'Severity', value: levelOf(evaluation.severity), tone: evaluation.severity >= 3 ? 'bad' : evaluation.severity >= 2 ? 'warn' : 'good' },
      { label: 'Courier at fault', value: `${evaluation.courierAtFault ? 'Yes' : 'No'} · ${percentOf(Math.max(courier, 1 - courier))}`, tone: evaluation.courierAtFault ? 'good' : undefined },
      { label: 'Shipping already spent on refusals', value: money(spent, context?.currency), tone: spent > 0 ? 'warn' : undefined },
    ],
  };
}

function gradeNote(result, label) {
  const lane = result.evaluation.restriction === label.restriction ? `the lane, ${readable(label.restriction)}, is the intended one` : `the intended lane was ${readable(label.restriction)} and the model chose ${readable(result.evaluation.restriction)}`;
  if (label.kind === 'abuse') return `Planted as ${readable(label.pattern)}; ${lane}.`;
  if (label.kind === 'innocent') return `Planted as an explainable bad streak (${label.courierAtFault ? 'a documented courier outage' : 'a wrong address, later reshipped'}); ${lane}.`;
  return result.evaluation.restricted ? `An ordinary history; ${lane}.` : undefined;
}

const grade = {
  labelId: (label) => label.customerId,
  // Right means what the headline counts: the planted pattern was named. The lane is in the note.
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.pattern === label.pattern,
      expected: label.pattern,
      got: result.evaluation.pattern,
      note: gradeNote(result, label),
      confidence: result.answers.pattern.confidence,
    };
  },
};

const present = {
  number: 112,
  problem: {
    headline: 'A refused cash-on-delivery parcel costs the shop its shipping. A few customers refuse most of theirs, and some only had a bad week.',
    stat: '180',
    statLabel: 'customer histories, 36 of them abusive',
  },
  hero: {
    item: 'C-0001',
    caption: 'Eleven of fourteen cash-on-delivery parcels refused, $137.50 of shipping spent for nothing. Named a serial refuser, deliberate, severity 5.5 of 6: block cash on delivery.',
  },
  answers: {
    caption: 'The pattern and the access lane are separate answers, so a right name with a wrong lane shows up as exactly that.',
    reveal: ['pattern', 'intent', 'restriction', 'severity', 'courier_at_fault'],
  },
  miss: {
    item: 'C-0097',
    caption: 'Four accounts and six addresses on one phone. The lane is right, block cash on delivery, but the name is serial refuser at 40%. All 7 address hoppers went the same way.',
  },
  proof: {
    kpis: ['Pattern accuracy', 'Abusers restricted', 'Innocents left alone'],
    chart: 'baselines',
    closing: '30 of 36 abusers restricted and 8 of 10 innocents left alone; 30 of the 32 customers restricted were abusive.',
  },
};

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
  stage: {
    hide: ['currency', 'reshippedFromOrderId'],
    labels: {
      accountIds: 'Accounts on this phone',
      accountId: 'Account',
      date: 'Ordered',
      value: 'Order value',
      paymentMethod: 'Paid by',
      deliveryOutcome: 'Outcome',
      courierAttempts: 'Courier attempts',
      reasonCode: 'Reason code',
      addressUsed: 'Delivered to',
      promotion: 'Promotion',
      refundIssued: 'Refunded',
    },
    highlight: ['phone', 'deliveryOutcome', 'reasonCode'],
  },
  grade,
  verdict,
  present,
  caveat: 'A count of accounts, refusals and returns names all 180 planted patterns, and the courier-fault answer can be read from a COURIER_OUTAGE reason code in the state, so this run measures reading more than judgement. A harder dataset is planned.',
  explain: {
    data: 'scripts/generate/cod-abuse.js#demo:data',
    state: 'demos/cod-abuse/demo.js#demo:state',
    questions: 'demos/cod-abuse/demo.js#demo:questions',
    evaluate: 'demos/cod-abuse/demo.js#demo:evaluate',
  },
};
