// Dispute and refund routing: the tool-call episode. Five typed answers become one backend call with
// its arguments filled in — the action, the money, the reason code — and the demo renders that call
// instead of making it. The question set is the tool schema; there is no prose contract anywhere.

import { choice, noul, score } from '../lib/questions.js';

const ACTIONS = ['REFUND_NOW', 'REQUEST_EVIDENCE', 'ESCALATE', 'DENY'];
const BANDS = ['NONE', 'PARTIAL_25', 'PARTIAL_50', 'FULL', 'FULL_PLUS_SHIPPING'];
const REASONS = ['NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DUPLICATE', 'SUBSCRIPTION', 'DAMAGE', 'NO_FAULT_FOUND'];
const AUTOMATE_AT = 4;

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value ?? 0);
const round = (value) => Number(value.toFixed(2));

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

/** What each refund band is worth on this order. The band is an answer; the money is arithmetic. */
function refundAmount(band, item) {
  if (band === 'PARTIAL_25') return round(item.orderTotal * 0.25);
  if (band === 'PARTIAL_50') return round(item.orderTotal * 0.5);
  if (band === 'FULL') return round(item.orderTotal);
  if (band === 'FULL_PLUS_SHIPPING') return round(item.orderTotal + item.shippingPaid);
  return 0;
}

// #region demo:state
/** The dispute as the queue holds it: what was said, what was shipped, what was claimed before. */
function buildState(item, context) {
  return {
    task: 'Route this dispute: choose the action, the refund band and the reason code. The action is not carried out.',
    merchant: { name: context.merchant, sells: context.sells, currency: context.currency },
    refund_policy: { rules: context.policyInWords, numbers: context.policy },
    dispute: {
      opened: item.openedAt,
      claim_category: item.claim,
      customer_message: item.message,
      photo_attached: item.photoAttached,
      customer_wants_to_keep_the_item: item.wantsToKeep,
      marks_are_cosmetic_only: item.cosmetic,
    },
    order: {
      reference: item.orderId,
      total: item.orderTotal,
      shipping_paid: item.shippingPaid,
      days_since_order: item.daysSinceOrder,
      days_since_delivery: item.daysSinceDelivery,
      second_charge_reference: item.duplicateChargeId,
      cancellation_on_record: item.cancelledOnRecord,
    },
    courier: {
      status: item.trackingStatus,
      proof_of_delivery: item.deliveryProof,
      days_since_last_scan: item.daysSinceLastScan,
    },
    customer_history: {
      shopping_here_since: item.customerSince,
      disputes_before_this_one: item.priorDisputes,
      of_those_not_received: item.priorNotReceived,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  action: choice('What should happen to this dispute?', {
    REFUND_NOW: 'Refund the customer straight away, at the band chosen below.',
    REQUEST_EVIDENCE: 'Ask the customer for the one thing the policy needs before deciding.',
    ESCALATE: 'Send it to a person, because the policy says this one is not decided automatically.',
    DENY: 'Refuse the claim and tell the customer why.',
  }),
  refund_band: choice('How much of this order goes back?', {
    NONE: 'Nothing is refunded by this call.',
    PARTIAL_25: 'A quarter of the order value, for marks that do not affect using the item.',
    PARTIAL_50: 'Half the order value, where the customer keeps a faulty item.',
    FULL: 'The full order value, without the shipping charge.',
    FULL_PLUS_SHIPPING: 'The full order value and the shipping charge, where the shop or its courier is at fault.',
  }),
  reason_code: choice('Which reason code goes on the call?', {
    NOT_RECEIVED: 'The goods never arrived.',
    NOT_AS_DESCRIBED: 'The goods arrived and are not what was sold.',
    DUPLICATE: 'The same order was charged more than once.',
    SUBSCRIPTION: 'A renewal was taken after the customer cancelled.',
    DAMAGE: 'The goods arrived broken.',
    NO_FAULT_FOUND: 'The evidence does not support the claim.',
  }),
  policy_allows: noul('Does the written policy allow a refund on this dispute today?', {
    yes: 'The claim is inside the window and the evidence the policy asks for is here.',
    no: 'The window has passed, the evidence is missing, or the policy refuses this claim.',
  }),
  confidence_to_automate: score('How safely could this call be made without a person seeing it?', [
    'Never', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Always',
  ]),
};
// #endregion

// #region demo:evaluate
/** Five answers in, one backend call out. Nothing is sent: the call is rendered and graded. */
function evaluate(answers, item, context) {
  const action = answers.action.choice;
  const band = answers.refund_band.choice;
  const reason = answers.reason_code.choice;
  const amount = action === 'REFUND_NOW' ? refundAmount(band, item) : 0;
  const bodies = {
    REFUND_NOW: { dispute_id: item.id, order_id: item.orderId, amount, currency: context.currency, band, reason_code: reason },
    REQUEST_EVIDENCE: { dispute_id: item.id, evidence: 'PHOTOGRAPH_OF_ITEM', due_in_days: 7, reason_code: reason },
    ESCALATE: { dispute_id: item.id, queue: 'manual-review', order_total: item.orderTotal, reason_code: reason },
    DENY: { dispute_id: item.id, reason_code: reason, notify_customer: true },
  };

  return {
    action,
    band,
    reason,
    amount,
    policyAllows: answers.policy_allows.noul >= 0.5,
    automation: answers.confidence_to_automate.score,
    confidence: answers.action.confidence,
    label: `${item.id} · ${readable(action)}${amount ? ` · ${money(amount, context.currency)}` : ''}`,
    call: { endpoint: ENDPOINTS[action], body: bodies[action] },
  };
}

const ENDPOINTS = {
  REFUND_NOW: 'POST /v1/disputes/{id}/refund',
  REQUEST_EVIDENCE: 'POST /v1/disputes/{id}/evidence-request',
  ESCALATE: 'POST /v1/disputes/{id}/escalate',
  DENY: 'POST /v1/disputes/{id}/decline',
};
// #endregion

// #region demo:report
/** Grades the call, not the prose: the action, the band and the reason code each stand on their own. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.disputeId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const right = (result, field, answer) => byItem.get(result.item.id)[field] === result.evaluation[answer];
  const actions = graded.filter((result) => right(result, 'correctAction', 'action'));
  const whole = graded.filter((result) => right(result, 'correctAction', 'action') && right(result, 'refundBand', 'band') && right(result, 'reasonCode', 'reason'));

  return {
    note: `Two hundred and twenty disputes, graded against the merchant's own policy. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis(graded, actions, whole, byItem),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results),
  };
}
// #endregion

function paid(results) {
  return results.reduce((total, result) => total + result.evaluation.amount, 0);
}

function kpis(graded, actions, whole, byItem) {
  const refunds = graded.filter((result) => result.evaluation.action === 'REFUND_NOW');
  const wrongRefunds = refunds.filter((result) => byItem.get(result.item.id).correctAction !== 'REFUND_NOW');
  const automatic = graded.filter((result) => result.evaluation.automation >= AUTOMATE_AT);
  const automaticWhole = automatic.filter((result) => whole.includes(result));
  return [
    { label: 'Action agrees with policy', value: share(actions.length, graded.length), context: `${actions.length} of ${graded.length} disputes` },
    { label: 'Whole call correct', value: share(whole.length, graded.length), context: 'action, band and reason code all three' },
    { label: 'Refunded', value: money(paid(refunds)), context: `${refunds.length} refunds${wrongRefunds.length ? ` · ${money(paid(wrongRefunds))} of it against policy` : ' · none against policy'}`, tone: wrongRefunds.length ? 'warn' : 'good' },
    { label: 'Safe to send unseen', value: `${automatic.length}`, context: `at ${AUTOMATE_AT} of 6 or higher · ${share(automaticWhole.length, automatic.length)} of those calls fully correct` },
    { label: 'Needs a person', value: graded.filter((result) => result.evaluation.action === 'ESCALATE' || result.evaluation.automation < AUTOMATE_AT).length, context: 'escalated, or not safe to send unseen' },
  ];
}

function checks(graded, byItem, labels) {
  const kinds = [...new Set(labels.map((label) => label.kind))];
  return kinds.map((kind) => {
    const group = labels.filter((label) => label.kind === kind);
    const wrong = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.disputeId);
      return !result || result.evaluation.action !== label.correctAction;
    });
    return { id: kind.replaceAll(' ', '-'), label: `${sentence(kind)}: wrong action`, detail: DETAIL[kind] ?? '', count: wrong.length, of: group.length, items: wrong.slice(0, 20).map((label) => label.disputeId) };
  });
}

const DETAIL = {
  'friendly fraud': 'Not-received claims with proof of delivery, from customers who have claimed this before.',
  'genuine non-delivery': 'The courier stopped scanning well past the waiting period in the policy.',
  'duplicate charge': 'One order, two payments, a minute apart.',
  'policy expired': 'A fair complaint that arrived after the window closed; the policy says refuse with a reason.',
  'needs one photo': 'Damage claimed with nothing attached. The policy asks for the photograph first.',
  everyday: 'The rest of the queue: ordinary claims with the evidence you would expect.',
};

function distribution(results) {
  return ACTIONS
    .map((action) => ({ label: sentence(action), count: results.filter((result) => result.evaluation.action === action).length, tone: action === 'REFUND_NOW' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Action chosen against the action the policy gives',
    columns: ACTIONS.map(sentence),
    rows: ACTIONS.map((actual) => ({
      label: sentence(actual),
      cells: ACTIONS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).correctAction === actual && result.evaluation.action === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem) {
  const correct = (result) => byItem.get(result.item.id).correctAction === result.evaluation.action;
  const points = Array.from({ length: 7 }, (_, bar) => {
    const automatic = graded.filter((result) => result.evaluation.automation >= bar);
    const good = automatic.filter(correct);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: automatic.length, caught: good.length, rate: automatic.length ? Number((good.length / automatic.length).toFixed(3)) : null };
  });
  return { title: 'How much of the queue can be sent unseen', xLabel: 'Calls sent without a person', yLabel: 'Of those, calls the policy agrees with', rateLabel: 'Share of the automatic calls that are right', of: graded.length, points };
}

function findings(graded, byItem) {
  const lines = [];
  const wrong = graded.filter((result) => byItem.get(result.item.id).correctAction !== result.evaluation.action);
  const groups = new Map();
  for (const result of wrong) {
    const key = `${byItem.get(result.item.id).correctAction}|${result.evaluation.action}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const worst = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  if (worst && worst[1].length >= 3) {
    const [actual, predicted] = worst[0].split('|');
    lines.push(`${worst[1].length} of ${wrong.length} wrong actions are the same swap: ${readable(actual)} answered as ${readable(predicted)}. One rule to settle, not ${worst[1].length} separate mistakes.`);
  }

  const bandOnly = graded.filter((result) => byItem.get(result.item.id).correctAction === result.evaluation.action && byItem.get(result.item.id).refundBand !== result.evaluation.band);
  if (bandOnly.length >= 3) lines.push(`${bandOnly.length} calls take the right action with the wrong amount attached. The action is the easy half; the arguments are where the money is.`);

  const overpaid = graded.filter((result) => result.evaluation.amount > 0 && byItem.get(result.item.id).correctAction !== 'REFUND_NOW');
  if (overpaid.length) lines.push(`${overpaid.length} refunds worth ${money(paid(overpaid))} would have gone out against the policy.`);
  return lines;
}

function topItems(results) {
  return [...results]
    .filter((result) => result.evaluation.amount > 0)
    .sort((left, right) => right.evaluation.amount - left.evaluation.amount || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.evaluation.label} · ${readable(result.evaluation.reason)}`, value: money(result.evaluation.amount) }));
}

export default {
  id: 'dispute-routing',
  title: 'Dispute and refund routing',
  domain: 'orders',
  value: 'Turn a dispute queue into backend calls: the action, the money and the reason code, typed.',
  tags: ['disputes', 'refunds', 'tool calls', 'ecommerce'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'queue',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${readable(item.claim)} · ${money(item.orderTotal)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/dispute-routing.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/dispute-routing.js#demo:data',
    state: 'demos/dispute-routing/demo.js#demo:state',
    questions: 'demos/dispute-routing/demo.js#demo:questions',
    evaluate: 'demos/dispute-routing/demo.js#demo:evaluate',
  },
};
