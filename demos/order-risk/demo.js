// Order risk at checkout: three hundred orders, one decision each, and the two costs that pull against
// each other — fraud let through, and good customers turned away. Nine orders are fraud and twelve are
// perfectly good orders that look worse than the fraud does, which is where the decision is actually made.

import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['CARD_TESTING', 'RESHIPPER', 'ACCOUNT_TAKEOVER', 'FIRST_PARTY_MISUSE', 'NONE'];
const DECISIONS = ['APPROVE', 'REVIEW', 'DECLINE'];
const YES = 0.5;

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
    note: `Three hundred orders, ${labels.filter((label) => label.fraud).length} of them fraud and ${labels.filter((label) => label.kind === 'decoy').length} good orders built to look worse than the fraud. ${context.fraudRateNote ?? ''}`,
    findings: findings(graded, byItem, good),
    kpis: kpis({ fraud, stopped, named, falseDeclines, good, graded, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, fraud),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

function kpis({ fraud, stopped, named, falseDeclines, good, graded, byItem }) {
  const reviewed = graded.filter((result) => result.evaluation.reviewed);
  const approved = graded.filter((result) => !result.evaluation.stopped);
  const missedFraud = approved.filter((result) => byItem.get(result.item.id).fraud);
  const reviewedGood = reviewed.filter((result) => !byItem.get(result.item.id).fraud);
  return [
    { label: 'Fraud stopped', value: `${stopped.length} of ${fraud.length}`, context: `declined or held for a person · ${money(sum(stopped))} of ${money(sum(fraud))}`, tone: stopped.length === fraud.length ? 'good' : 'warn' },
    { label: 'Pattern named right', value: `${named.length} of ${fraud.length}`, context: 'the reason attached to the order' },
    { label: 'Good orders declined', value: falseDeclines.length, context: `${money(sum(falseDeclines))} of basket value turned away`, tone: falseDeclines.length ? 'warn' : 'good' },
    { label: 'Sent to a person', value: `${reviewed.length}`, context: `${Math.round(reviewed.length / 7)} a day against a limit of about twenty · ${reviewedGood.length} of them did not need it`, tone: reviewed.length / 7 > 20 ? 'warn' : 'good' },
    { label: 'Approved value', value: money(sum(approved)), context: `${approved.length} orders through without a person${missedFraud.length ? `, ${missedFraud.length} of them fraud worth ${money(sum(missedFraud))}` : ', none of them fraud'}`, tone: missedFraud.length ? 'warn' : 'good' },
  ];
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
  return [
    ...rows,
    { id: 'decoys', label: 'Good orders that look bad, stopped anyway', detail: 'Gifts sent abroad, a known customer on a new phone, a company’s first order, a customer connecting from another country.', count: stoppedDecoys.length, of: decoys.length, items: stoppedDecoys.map((label) => label.orderId) },
    { id: 'ordinary', label: 'Ordinary orders stopped', detail: 'Everything else in the week: nothing about these orders asks for a second look.', count: stoppedOrdinary.length, of: ordinary.length, items: stoppedOrdinary.slice(0, 20).map((result) => result.item.id) },
  ];
}

function distribution(results) {
  return DECISIONS
    .map((decision) => ({ label: sentence(decision), count: results.filter((result) => result.evaluation.decision === decision).length, tone: decision === 'APPROVE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Pattern named against what was planted',
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
  return { title: 'Where the line sits: workload against fraud caught', xLabel: 'Orders stopped at this risk or above', yLabel: 'Fraudulent orders among them', rateLabel: 'Share of the stopped orders that are fraud', of: fraud.length, points };
}

function findings(graded, byItem, good) {
  const lines = [];
  const stoppedDecoys = good.filter((result) => byItem.get(result.item.id).kind === 'decoy' && result.evaluation.stopped);
  if (stoppedDecoys.length >= 2) {
    const looks = [...new Set(stoppedDecoys.map((result) => byItem.get(result.item.id).look))];
    lines.push(`${stoppedDecoys.length} of the twelve good orders built to look bad were stopped, ${looks.length === 1 ? 'all of them the same kind' : `across ${looks.length} kinds`}: ${looks.join(', ')}. That is the cost of the threshold, and it is paid by real customers.`);
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
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => result.evaluation.stopped)
    .sort((left, right) => right.item.total - left.item.total || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.fraud ? ' · fraud' : ''}`,
      value: money(result.item.total),
    }));
}

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
  explain: {
    data: 'scripts/generate/order-risk.js#demo:data',
    state: 'demos/order-risk/demo.js#demo:state',
    questions: 'demos/order-risk/demo.js#demo:questions',
    evaluate: 'demos/order-risk/demo.js#demo:evaluate',
  },
};
