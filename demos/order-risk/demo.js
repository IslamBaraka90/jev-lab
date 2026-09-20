// Order risk at checkout: three hundred orders, one decision each, and the two costs that pull against
// each other — fraud let through, and good customers turned away. Nine orders are fraud and twelve are
// perfectly good orders that look worse than the fraud does, which is where the decision is actually made.

import { wilson } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['CARD_TESTING', 'RESHIPPER', 'ACCOUNT_TAKEOVER', 'FIRST_PARTY_MISUSE', 'NONE'];
const DECISIONS = ['APPROVE', 'REVIEW', 'DECLINE'];
const YES = 0.5;
const RISK_LEVELS = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain'];
const NUMBER_WORDS = { five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50 };

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);
const sum = (results) => results.reduce((total, result) => total + result.item.total, 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** What the payments team has when the order lands: the basket, the account, the card and the signals. */
function buildState(item, context) {
  return {
    task: 'Decide whether to approve this checkout, send it to a person, or decline it, and say which pattern it fits.',
    store: {
      name: context.store, sells: context.sells, currency: context.currency,
      average_order_value: context.averageOrderValue,
      median_checkout_seconds: context.medianCheckoutSeconds,
      share_shipped_abroad_percent: context.shareShippedAbroadPercent,
      chargeback_rate_percent: context.chargebackRatePercent,
      review_capacity: context.reviewCapacity,
    },
    order: {
      placed_at: item.placedAt, total: item.total, item_count: item.itemCount, basket: item.basket,
      checkout_seconds: item.checkoutSeconds, coupon: item.coupon, gift_message: item.giftMessage,
    },
    customer: {
      tenure_days: item.customerTenureDays, prior_orders: item.priorOrders, prior_refunds: item.priorRefunds,
      prior_chargebacks: item.priorChargebacks, lifetime_value: item.lifetimeValue,
      account_changed_hours_ago: item.accountChangedHoursAgo,
    },
    payment: { card: item.card, bin_country: item.binCountry },
    device: {
      id: item.deviceId, first_seen_on_this_order: item.deviceIsNew,
      orders_from_this_device_today: item.ordersFromThisDeviceToday,
      different_cards_on_this_device_last_24h: item.deviceDistinctCards,
    },
    addresses: {
      connection_country: item.connectionCountry,
      billing: { name: item.billingName, city: item.billingCity, country: item.billingCountry },
      shipping: { line1: item.shippingLine1, city: item.shippingCity, country: item.shippingCountry },
      shipping_address_is_new: item.newShippingAddress,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  decision: choice('What should happen to this checkout?', {
    APPROVE: 'Let it through now. Nothing here is worth a person’s time.',
    REVIEW: 'Hold it for a person. It could go either way and the basket is worth the minutes.',
    DECLINE: 'Refuse it. The order should not ship.',
  }),
  fraud_pattern: choice('Which pattern does this order fit, if any?', {
    CARD_TESTING: 'Small baskets from one device, trying card after card to find live numbers.',
    RESHIPPER: 'Goods sent to a forwarding address, usually first order, high value, countries disagreeing.',
    ACCOUNT_TAKEOVER: 'A real customer’s account used by someone else: new device, new address, changed details.',
    FIRST_PARTY_MISUSE: 'The genuine account holder ordering, with a history of disputing what they received.',
    NONE: 'An ordinary order, however unusual it looks at first glance.',
  }),
  risk: score('How likely is it that this order ends in a loss?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  address_consistent: noul('Do the billing, shipping, card and connection details tell one consistent story?', {
    yes: 'The addresses, card country and connection fit a real person shopping normally.',
    no: 'At least one of them does not belong with the others.',
  }),
  step_up_would_help: noul('Would asking this shopper to confirm their identity settle it?', {
    yes: 'A one-time code or a bank check would separate a good order from a bad one here.',
    no: 'It would not settle anything: either the order is plainly fine, or the account itself is the problem.',
  }),
};
// #endregion

// #region demo:evaluate
/** Turns five answers into what happens to the order, and what that costs if it is wrong. */
function evaluate(answers, item) {
  const decision = answers.decision.choice;

  return {
    decision,
    pattern: answers.fraud_pattern.choice,
    risk: answers.risk.score,
    stopped: decision !== 'APPROVE',
    declined: decision === 'DECLINE',
    reviewed: decision === 'REVIEW',
    addressConsistent: answers.address_consistent.noul >= YES,
    stepUpWouldHelp: answers.step_up_would_help.noul >= YES,
    confidence: answers.decision.confidence,
    value: item.total,
    label: `${item.id} · ${readable(decision)} · ${money(item.total)}`,
  };
}
// #endregion

// #region demo:report
/** Grades both costs at once: the fraud that got through, and the good orders that were turned away. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.orderId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const fraud = graded.filter((result) => byItem.get(result.item.id).fraud);
  const good = graded.filter((result) => !byItem.get(result.item.id).fraud);
  const stopped = fraud.filter((result) => result.evaluation.stopped);
  const named = fraud.filter((result) => result.evaluation.pattern === byItem.get(result.item.id).pattern);
  const falseDeclines = good.filter((result) => result.evaluation.declined);

  return {
    note: `${results.length} orders, ${labels.filter((label) => label.fraud).length} of them fraud and ${labels.filter((label) => label.kind === 'decoy').length} good orders built to look worse than the fraud. ${context.fraudRateNote ?? ''}`,
    findings: findings(graded, byItem, good),
    kpis: kpis({ fraud, stopped, named, falseDeclines, graded, byItem, context }),
    distributionTitle: 'Decisions made',
    distribution: distribution(results),
    baselines: baselines(graded, byItem),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, fraud),
    checks: checks(graded, byItem, labels),
    topItemsTitle: 'Largest orders stopped',
    topItems: topItems(results, byItem),
    metrics: metrics(graded, byItem, fraud, stopped),
  };
}
// #endregion

/** The days the queue is spread over: the period the store states, else first order to last. */
function daysCovered(results, context) {
  const stated = String(context?.period ?? '').match(/^(\d+) to (\d+) /);
  if (stated) return Number(stated[2]) - Number(stated[1]) + 1;
  const days = results.map((result) => Date.parse(result.item.placedAt.slice(0, 10)));
  if (!days.length) return 1;
  return Math.round((Math.max(...days) - Math.min(...days)) / 86_400_000) + 1;
}

/** The team's daily limit, read out of the sentence the store gives the model. Null when it names none. */
function dailyReviewLimit(context) {
  const text = String(context?.reviewCapacity ?? '').toLowerCase();
  const digits = text.match(/\d+/);
  if (digits) return Number(digits[0]);
  const word = Object.keys(NUMBER_WORDS).find((name) => text.includes(name));
  return word ? NUMBER_WORDS[word] : null;
}

const percentRange = (interval) => `${Math.round(interval.low * 100)}% to ${Math.round(interval.high * 100)}%`;

function kpis({ fraud, stopped, named, falseDeclines, graded, byItem, context }) {
  const reviewed = graded.filter((result) => result.evaluation.reviewed);
  const approved = graded.filter((result) => !result.evaluation.stopped);
  const allStopped = graded.filter((result) => result.evaluation.stopped);
  const stoppedGood = allStopped.filter((result) => !byItem.get(result.item.id).fraud);
  const reviewedGood = reviewed.filter((result) => !byItem.get(result.item.id).fraud);
  const perDay = Math.round(reviewed.length / daysCovered(graded, context));
  const limit = dailyReviewLimit(context);
  const overLimit = limit !== null && perDay > limit;
  const mostlyNeedless = reviewedGood.length > reviewed.length / 2;
  return [
    { label: 'Fraud stopped', value: `${stopped.length} of ${fraud.length}`, context: `declined or held for a person · ${money(sum(stopped))} of ${money(sum(fraud))} · with ${fraud.length} frauds the 95% interval is ${percentRange(wilson(stopped.length, fraud.length))}`, tone: stopped.length === fraud.length ? 'good' : 'warn' },
    { label: 'Stopped orders that were fraud', value: share(allStopped.length - stoppedGood.length, allStopped.length), context: `${allStopped.length - stoppedGood.length} of ${allStopped.length} stopped · ${money(sum(stoppedGood))} of good orders declined or waiting`, tone: stoppedGood.length > allStopped.length / 2 ? 'warn' : 'good' },
    { label: 'Good orders declined', value: falseDeclines.length, context: `${money(sum(falseDeclines))} of basket value turned away`, tone: falseDeclines.length ? 'warn' : 'good' },
    { label: 'Sent to a person', value: `${reviewed.length}`, context: `${perDay} a day${limit === null ? '' : ` against a limit of about ${limit}`} · ${reviewedGood.length} of them did not need it · ${money(sum(reviewedGood))} held, against ${money(sum(approved))} approved unseen`, tone: overLimit || mostlyNeedless ? 'warn' : 'good' },
    { label: 'Pattern named right', value: `${named.length} of ${fraud.length}`, context: 'the reason attached to the order' },
  ];
}

/** The rule: two earlier chargebacks; three cards on one device; new device, new address and details changed inside 48 hours; or a first order over £800 shipped outside the billing country. */
function ruleStops(item) {
  const repeatDisputer = item.priorChargebacks >= 2;
  const cardTesting = item.deviceDistinctCards >= 3;
  const takeover = item.deviceIsNew && item.newShippingAddress && item.accountChangedHoursAgo !== null && item.accountChangedHoursAgo < 48;
  const reshipper = item.priorOrders === 0 && item.total > 800 && item.shippingCountry !== item.billingCountry;
  return repeatDisputer || cardTesting || takeover || reshipper;
}

/** Right, order by order: a fraud is stopped and a good order goes through without a person. */
const handledRight = (stoppedIt, label) => Boolean(stoppedIt) === label.fraud;

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const count = (stops) => graded.filter((result) => handledRight(stops(result), byItem.get(result.item.id))).length;
  const fraud = graded.filter((result) => byItem.get(result.item.id).fraud);
  return [
    { label: 'Jev', detail: 'orders handled right: fraud stopped, good orders approved without a person', value: count((result) => result.evaluation.stopped) / graded.length, model: true },
    { label: 'Rule: four conjunctions of fields', detail: 'chargebacks, cards per device, a changed account on a new device, a large first order shipped abroad', value: count((result) => ruleStops(result.item)) / graded.length },
    { label: 'Approve everything', detail: `the commonest answer; lets all ${fraud.length} frauds through, ${money(sum(fraud))}`, value: count(() => false) / graded.length },
  ];
}

function metrics(graded, byItem, fraud, stopped) {
  if (!fraud.length) return undefined;
  const allStopped = graded.filter((result) => result.evaluation.stopped);
  const right = graded.filter((result) => handledRight(result.evaluation.stopped, byItem.get(result.item.id)));
  const namedButApproved = graded.filter((result) => result.evaluation.pattern !== 'NONE' && !result.evaluation.stopped);
  return {
    headline: { label: 'Fraud stopped', value: stopped.length / fraud.length, n: fraud.length },
    accuracy: right.length / graded.length,
    precision: allStopped.length ? stopped.length / allStopped.length : null,
    recall: stopped.length / fraud.length,
    contradictionRate: namedButApproved.length / graded.length,
    automationRate: graded.filter((result) => !result.evaluation.reviewed).length / graded.length,
  };
}

function checks(graded, byItem, labels) {
  const rows = PATTERNS.filter((pattern) => pattern !== 'NONE').map((pattern) => {
    const group = labels.filter((label) => label.pattern === pattern);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.orderId);
      return !result || !result.evaluation.stopped || result.evaluation.pattern !== pattern;
    });
    return { id: pattern.toLowerCase(), label: `${sentence(pattern)} not caught`, detail: questions.fraud_pattern.criteria[pattern], count: missed.length, of: group.length, items: missed.map((label) => label.orderId) };
  });

  const decoys = labels.filter((label) => label.kind === 'decoy');
  const stoppedDecoys = decoys.filter((label) => graded.some((result) => result.item.id === label.orderId && result.evaluation.stopped));
  const ordinary = graded.filter((result) => byItem.get(result.item.id).kind === 'ordinary');
  const stoppedOrdinary = ordinary.filter((result) => result.evaluation.stopped);
  // This one needs no labels: an order cannot both fit a fraud pattern and be waved through.
  const approved = graded.filter((result) => !result.evaluation.stopped);
  const namedButApproved = approved.filter((result) => result.evaluation.pattern !== 'NONE');
  return [
    ...rows,
    { id: 'decoys', label: 'Good orders that look bad, stopped anyway', detail: 'Gifts sent abroad, a known customer on a new phone, a company’s first order, a customer connecting from another country.', count: stoppedDecoys.length, of: decoys.length, items: stoppedDecoys.map((label) => label.orderId) },
    { id: 'ordinary', label: 'Ordinary orders stopped', detail: 'Everything else in the week: nothing about these orders asks for a second look.', count: stoppedOrdinary.length, of: ordinary.length, items: stoppedOrdinary.slice(0, 20).map((result) => result.item.id) },
    { id: 'named-but-approved', label: 'Approved with a fraud pattern named', detail: 'The pattern answer names a fraud and the decision lets the order through. The two answers are typed separately and nothing makes them agree.', count: namedButApproved.length, of: approved.length, items: namedButApproved.slice(0, 20).map((result) => result.item.id) },
  ];
}

const DECISION_TONE = { APPROVE: 'good', REVIEW: 'warn', DECLINE: 'bad' };

function distribution(results) {
  return DECISIONS
    .map((decision) => ({ label: sentence(decision), count: results.filter((result) => result.evaluation.decision === decision).length, tone: DECISION_TONE[decision] }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Pattern named against what was planted',
    rowLabel: 'the pattern that was planted',
    columnLabel: 'the pattern the model named',
    columns: PATTERNS.map(sentence),
    rows: PATTERNS.map((actual) => ({
      label: sentence(actual),
      cells: PATTERNS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).pattern === actual && result.evaluation.pattern === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, fraud) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const queue = graded.filter((result) => result.evaluation.risk >= bar && result.evaluation.stopped);
    const real = queue.filter((result) => byItem.get(result.item.id).fraud);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: queue.length, caught: real.length, rate: queue.length ? Number((real.length / queue.length).toFixed(3)) : null };
  });
  return { title: 'Where the line sits: workload against fraud caught', xLabel: 'Orders stopped at this risk or above', yLabel: 'Fraudulent orders among them', rateLabel: 'Share of the stopped orders that are fraud', of: fraud.length, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
}

function findings(graded, byItem, good) {
  const lines = [];
  const decoys = good.filter((result) => byItem.get(result.item.id).kind === 'decoy');
  const stoppedDecoys = decoys.filter((result) => result.evaluation.stopped);
  if (stoppedDecoys.length >= 2) {
    const looks = [...new Set(stoppedDecoys.map((result) => byItem.get(result.item.id).look))];
    lines.push(`${stoppedDecoys.length} of the ${decoys.length} good orders built to look bad were stopped, ${looks.length === 1 ? 'all of them the same kind' : `across ${looks.length} kinds`}: ${looks.join(', ')}. That is the cost of the threshold, and it is paid by real customers.`);
  }

  const wrong = graded.filter((result) => byItem.get(result.item.id).fraud && result.evaluation.pattern !== byItem.get(result.item.id).pattern);
  const groups = new Map();
  for (const result of wrong) {
    const key = `${byItem.get(result.item.id).pattern}|${result.evaluation.pattern}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const worst = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  if (worst && worst[1].length >= 2) {
    const [actual, predicted] = worst[0].split('|');
    lines.push(`${worst[1].length} of ${wrong.length} misnamed patterns are the same swap: ${readable(actual)} called ${readable(predicted)}. The order was still stopped in each case, so this costs a wrong reason on the ticket rather than a loss.`);
  }

  const missed = graded.filter((result) => byItem.get(result.item.id).fraud && !result.evaluation.stopped);
  if (missed.length) lines.push(`${missed.length} fraudulent ${missed.length === 1 ? 'order' : 'orders'} went straight through, worth ${money(sum(missed))}: ${missed.map((result) => result.item.id).join(', ')}.`);

  const stopped = graded.filter((result) => result.evaluation.stopped);
  const stoppedGood = stopped.filter((result) => !byItem.get(result.item.id).fraud);
  const approved = graded.filter((result) => !result.evaluation.stopped);
  if (stoppedGood.length > stopped.length / 2) lines.push(`Only ${stopped.length - stoppedGood.length} of the ${stopped.length} stopped orders were fraud (${share(stopped.length - stoppedGood.length, stopped.length)}). ${money(sum(stoppedGood))} of good orders were declined or left waiting for a person, against ${money(sum(approved))} approved without one.`);

  const namedOnGood = good.filter((result) => result.evaluation.pattern !== 'NONE');
  const namedButApproved = namedOnGood.filter((result) => !result.evaluation.stopped);
  if (namedOnGood.length) lines.push(`${namedOnGood.length} good orders were given a fraud pattern, and ${namedButApproved.length} of those were approved all the same: a fraud reason on a ticket that went through.`);

  const right = (stops) => graded.filter((result) => handledRight(stops(result), byItem.get(result.item.id))).length;
  const modelRight = right((result) => result.evaluation.stopped);
  const ruleRight = right((result) => ruleStops(result.item));
  if (ruleRight > modelRight) lines.push(`Four lines of rules over fields in the state handle ${ruleRight} of ${graded.length} orders right, against the model's ${modelRight}. No single field separates the fraud, but pairs of fields do, so this file does not yet ask for a judgement a filter cannot make.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => result.evaluation.stopped)
    .sort((left, right) => right.item.total - left.item.total || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.has(result.item.id) ? (byItem.get(result.item.id).fraud ? ' · fraud' : ' · good order') : ''}`,
      value: money(result.item.total),
    }));
}

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${RISK_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;
const yesNo = (answer) => `${answer.noul >= YES ? 'Yes' : 'No'} · ${percentOf(Math.max(answer.noul, 1 - answer.noul))}`;

const riskTone = (risk) => (risk >= 3 ? 'bad' : risk >= 2 ? 'warn' : 'good');

/** The pattern as the ticket would carry it. A fraud pattern on an approved order contradicts the decision. */
function patternText(evaluation, confidence) {
  if (evaluation.pattern === 'NONE') return `No pattern · ${percentOf(confidence)}`;
  return `${sentence(evaluation.pattern)} · ${percentOf(confidence)}${evaluation.stopped ? '' : ' · on an approved order'}`;
}

function verdictDetail(evaluation, currency) {
  const value = money(evaluation.value, currency);
  if (evaluation.declined) return `${value} kept from shipping.`;
  if (evaluation.reviewed) return `${value} waits for a person.`;
  return `${value} goes through now.`;
}

function verdict(result, context) {
  const { evaluation, answers, item } = result;
  const pattern = evaluation.pattern === 'NONE' ? 'no pattern named' : readable(evaluation.pattern);
  const average = context?.averageOrderValue;
  const against = average ? ` · ${(item.total / average).toFixed(1)} times the shop's average` : '';
  return {
    eyebrow: 'What happens to this checkout',
    headline: `${sentence(evaluation.decision)} · ${pattern}`,
    detail: verdictDetail(evaluation, context?.currency),
    facts: [
      { label: 'Risk of a loss', value: levelOf(evaluation.risk), tone: riskTone(evaluation.risk) },
      { label: 'Confidence in the decision', value: percentOf(evaluation.confidence), tone: evaluation.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Pattern', value: patternText(evaluation, answers.fraud_pattern.confidence), tone: evaluation.pattern === 'NONE' ? undefined : 'bad' },
      { label: 'Addresses tell one story', value: yesNo(answers.address_consistent), tone: evaluation.addressConsistent ? 'good' : 'bad' },
      { label: 'An identity check would settle it', value: yesNo(answers.step_up_would_help) },
      { label: 'Order value', value: `${money(item.total, context?.currency)}${against}` },
    ],
  };
}

function gradeNote(result, label) {
  if (label.fraud) {
    const named = result.evaluation.pattern === label.pattern ? '' : ` The pattern named was ${readable(result.evaluation.pattern)}.`;
    return `Planted as fraud: ${readable(label.pattern)}.${named}`;
  }
  const held = result.evaluation.declined ? ' It was declined.' : result.evaluation.reviewed ? ' It was held for a person it did not need.' : '';
  if (label.kind === 'decoy') return `Planted as a good order that looks bad: ${label.look}.${held}`;
  return held ? `An ordinary good order.${held}` : undefined;
}

const grade = {
  labelId: (label) => label.orderId,
  // Right means a fraud was stopped, or a good order went through without a person.
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: handledRight(result.evaluation.stopped, label),
      expected: label.fraud ? 'stopped' : 'approved',
      got: readable(result.evaluation.decision),
      note: gradeNote(result, label),
      confidence: result.answers.decision.confidence,
    };
  },
};

const present = {
  number: 111,
  problem: {
    headline: 'Every checkout is approved, held or declined. Stop the fraud and good customers get held with it.',
    stat: '300',
    statLabel: 'orders in one week, 9 of them fraud',
  },
  hero: {
    item: 'ORD-0001',
    caption: 'A first order of £1,400: billed in Britain, card issued in France, shipped to a logistics unit in Brazil. Declined as a reshipper, at 37% confidence in the decision.',
  },
  answers: {
    caption: 'Five typed answers: the decision, the pattern it fits, a risk level, and two yes-or-no checks on the addresses and on whether an identity check would settle it.',
    reveal: ['decision', 'fraud_pattern', 'risk', 'address_consistent', 'step_up_would_help'],
  },
  miss: {
    item: 'ORD-0255',
    caption: 'A company placing its first order, £6,590, nothing mismatched and a purchase order number in the coupon field. It was held for a person: one of 79 good orders stopped.',
  },
  proof: {
    kpis: ['Fraud stopped', 'Stopped orders that were fraud', 'Good orders declined'],
    chart: 'baselines',
    closing: '£10,172 of fraud stopped and no good order declined, while £56,480 of good orders waited for a person. Four lines of rules stop the same nine and hold nothing.',
  },
};

export default {
  id: 'order-risk',
  title: 'Order risk at checkout',
  domain: 'orders',
  value: 'Approve, review or decline a checkout in one call, with the reason attached to the order.',
  tags: ['fraud', 'checkout', 'ecommerce', 'payments'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${money(item.total)} · ${item.itemCount} item${item.itemCount === 1 ? '' : 's'}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/order-risk.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage: {
    hide: ['deviceId', 'card', 'sku'],
    labels: {
      placedAt: 'Placed',
      total: 'Order total',
      itemCount: 'Items',
      customerTenureDays: 'Customer for (days)',
      priorOrders: 'Earlier orders',
      priorRefunds: 'Earlier refunds',
      priorChargebacks: 'Earlier chargebacks',
      lifetimeValue: 'Lifetime value',
      accountChangedHoursAgo: 'Account details changed (hours ago)',
      connectionCountry: 'Connecting from',
      billingCountry: 'Billing country',
      shippingCountry: 'Shipping country',
      binCountry: 'Card issued in',
      newShippingAddress: 'New shipping address',
      shippingLine1: 'Shipping address',
      deviceIsNew: 'First order from this device',
      ordersFromThisDeviceToday: 'Orders from this device today',
      deviceDistinctCards: 'Cards used on this device, last 24 hours',
      checkoutSeconds: 'Checkout time (seconds)',
      coupon: 'Coupon or purchase order',
      giftMessage: 'Gift message',
    },
    highlight: ['binCountry', 'shippingCountry', 'deviceDistinctCards', 'accountChangedHoursAgo'],
  },
  grade,
  verdict,
  present,
  caveat: 'Four lines of rules over fields in the state separate all nine frauds from the 291 good orders, so this file does not yet test a judgement a filter cannot make, and nine frauds are too few for a rate. A harder dataset is planned.',
  explain: {
    data: 'scripts/generate/order-risk.js#demo:data',
    state: 'demos/order-risk/demo.js#demo:state',
    questions: 'demos/order-risk/demo.js#demo:questions',
    evaluate: 'demos/order-risk/demo.js#demo:evaluate',
  },
};
