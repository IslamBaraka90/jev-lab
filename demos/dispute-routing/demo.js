// Dispute and refund routing: the tool-call episode. Five typed answers become one backend call with
// its arguments filled in — the action, the money, the reason code — and the demo renders that call
// instead of making it. The question set is the tool schema; there is no prose contract anywhere.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const ACTIONS = ['REFUND_NOW', 'REQUEST_EVIDENCE', 'ESCALATE', 'DENY'];
const BANDS = ['NONE', 'PARTIAL_25', 'PARTIAL_50', 'FULL', 'FULL_PLUS_SHIPPING'];
const REASONS = ['NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DUPLICATE', 'SUBSCRIPTION', 'DAMAGE', 'NO_FAULT_FOUND'];
const AUTOMATE_AT = 4;
const AUTOMATION_LEVELS = ['Never', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Always'];

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
    call: { endpoint: ENDPOINTS[action].replace('{id}', item.id), body: bodies[action] },
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
  const matrix = confusion(graded, byItem);
  const policy = context.policy ?? {};

  return {
    note: `${results.length} disputes, graded against the merchant's own policy. ${context.note ?? ''}`,
    findings: findings(graded, byItem, policy),
    kpis: kpis(graded, actions, whole, byItem),
    distributionTitle: 'Actions chosen',
    distribution: distribution(results),
    baselines: baselines(graded, actions, byItem, policy),
    matrix,
    curve: coverage(graded, byItem),
    refundMoney: refundMoney(graded, byItem),
    checks: checks(graded, byItem, labels),
    topItemsTitle: 'Largest refunds',
    topItems: topItems(results),
    metrics: metrics(graded, actions, whole, matrix),
  };
}
// #endregion

function paid(results) {
  return results.reduce((total, result) => total + result.evaluation.amount, 0);
}

/** What the policy itself would pay on this dispute: the labelled band, and only when the label refunds. */
function policyAmount(label, item) {
  return label.correctAction === 'REFUND_NOW' ? refundAmount(label.refundBand, item) : 0;
}

/** The refund tile's small print. Refunds the policy refuses are named even when they carry no money. */
function refundContext(refunds, wrongRefunds) {
  if (!wrongRefunds.length) return `${refunds.length} refunds · none against policy`;
  const wrongMoney = paid(wrongRefunds);
  if (wrongMoney === 0) return `${refunds.length} refunds · ${wrongRefunds.length} of them on disputes the policy refuses, all for ${money(0)}`;
  return `${refunds.length} refunds · ${money(wrongMoney)} of it against policy`;
}

function kpis(graded, actions, whole, byItem) {
  const refunds = graded.filter((result) => result.evaluation.action === 'REFUND_NOW');
  const wrongRefunds = refunds.filter((result) => byItem.get(result.item.id).correctAction !== 'REFUND_NOW');
  const automatic = graded.filter((result) => result.evaluation.automation >= AUTOMATE_AT);
  const automaticActions = automatic.filter((result) => actions.includes(result));
  const automaticWhole = automatic.filter((result) => whole.includes(result));
  const bandsRight = graded.filter((result) => byItem.get(result.item.id).refundBand === result.evaluation.band);
  const reasonsRight = graded.filter((result) => byItem.get(result.item.id).reasonCode === result.evaluation.reason);
  return [
    { label: 'Action agrees with policy', value: share(actions.length, graded.length), context: `${actions.length} of ${graded.length} disputes` },
    { label: 'Whole call correct', value: share(whole.length, graded.length), context: `action, band and reason code all three · band right on ${bandsRight.length}, reason code on ${reasonsRight.length}` },
    { label: 'Refunded', value: money(paid(refunds)), context: refundContext(refunds, wrongRefunds), tone: wrongRefunds.length ? 'warn' : 'good' },
    { label: 'Would send unseen', value: `${automatic.length}`, context: `at ${AUTOMATE_AT} of 6 or higher · action right on ${share(automaticActions.length, automatic.length)} of them, every argument right on ${share(automaticWhole.length, automatic.length)}` },
    { label: 'Needs a person', value: graded.filter((result) => result.evaluation.action === 'ESCALATE' || result.evaluation.automation < AUTOMATE_AT).length, context: 'escalated, or below the bar for sending unseen' },
  ];
}

/** The rule: over the limit goes to a person; past the window, or a repeat claim with proof, is refused; damage with no photo is asked for; the rest is refunded. */
function ruleAction(item, policy) {
  if (item.orderTotal > policy.autoRefundLimit) return 'ESCALATE';
  if (item.daysSinceDelivery !== null && item.daysSinceDelivery > policy.returnWindowDays) return 'DENY';
  if (item.claim === 'NOT_RECEIVED' && item.deliveryProof && item.priorNotReceived >= policy.repeatNotReceivedLimit) return 'DENY';
  if (item.claim === 'DAMAGE' && !item.photoAttached) return 'REQUEST_EVIDENCE';
  return 'REFUND_NOW';
}

function ruleAgreement(graded, byItem, policy) {
  return graded.filter((result) => ruleAction(result.item, policy) === byItem.get(result.item.id).correctAction).length;
}

function commonestAction(graded, byItem) {
  const counts = ACTIONS.map((action) => ({ action, count: graded.filter((result) => byItem.get(result.item.id).correctAction === action).length }));
  return counts.sort((left, right) => right.count - left.count)[0];
}

function baselines(graded, actions, byItem, policy) {
  if (!graded.length) return undefined;
  const commonest = commonestAction(graded, byItem);
  return [
    { label: 'Jev', detail: 'action agrees with policy', value: actions.length / graded.length, model: true },
    { label: 'Rule: four policy numbers, else refund', detail: 'the limit, the window, a repeat claim with proof, a missing photo; it never reads the message', value: ruleAgreement(graded, byItem, policy) / graded.length },
    { label: 'Always the commonest action', detail: readable(commonest.action), value: commonest.count / graded.length },
  ];
}

/** A call contradicts itself when it refunds nothing, or refunds while its own policy answer says no. */
function contradictsItself(result) {
  const refund = result.evaluation.action === 'REFUND_NOW';
  return refund && (result.evaluation.amount === 0 || !result.evaluation.policyAllows);
}

function metrics(graded, actions, whole, matrix) {
  if (!graded.length) return undefined;
  const automatic = graded.filter((result) => result.evaluation.automation >= AUTOMATE_AT);
  const automaticWhole = automatic.filter((result) => whole.includes(result));
  return {
    headline: { label: 'Action agrees with policy', value: actions.length / graded.length, n: graded.length },
    accuracy: actions.length / graded.length,
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    wholeCallAccuracy: whole.length / graded.length,
    contradictionRate: graded.filter(contradictsItself).length / graded.length,
    automationRate: automatic.length / graded.length,
    automationPrecision: automatic.length ? automaticWhole.length / automatic.length : null,
  };
}

/** The money in the calls against the money the policy gives, dispute by dispute. */
function refundMoney(graded, byItem) {
  let policyRefundTotal = 0;
  let overpaidAmount = 0;
  let underpaidAmount = 0;
  for (const result of graded) {
    const owed = policyAmount(byItem.get(result.item.id), result.item);
    policyRefundTotal += owed;
    if (result.evaluation.amount > owed) overpaidAmount += result.evaluation.amount - owed;
    else underpaidAmount += owed - result.evaluation.amount;
  }
  return { policyRefundTotal: round(policyRefundTotal), callsRefundTotal: round(paid(graded)), overpaidAmount: round(overpaidAmount), underpaidAmount: round(underpaidAmount) };
}

function checks(graded, byItem, labels) {
  const kinds = [...new Set(labels.map((label) => label.kind))];
  const rows = kinds.map((kind) => {
    const group = labels.filter((label) => label.kind === kind);
    const wrong = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.disputeId);
      return !result || result.evaluation.action !== label.correctAction;
    });
    return { id: kind.replaceAll(' ', '-'), label: `${sentence(kind)}: wrong action`, detail: DETAIL[kind] ?? '', count: wrong.length, of: group.length, items: wrong.slice(0, 20).map((label) => label.disputeId) };
  });

  // This one needs no labels: a refund call carrying no money contradicts itself, whatever the policy says.
  const refunds = graded.filter((result) => result.evaluation.action === 'REFUND_NOW');
  const empty = refunds.filter((result) => result.evaluation.amount === 0);
  const againstOwnAnswer = refunds.filter((result) => !result.evaluation.policyAllows);
  return [
    ...rows,
    { id: 'empty-refunds', label: 'Refund calls that refund nothing', detail: 'The action says refund and the band says none, so the backend would be sent a refund for zero. The two answers are typed separately and nothing makes them agree.', count: empty.length, of: refunds.length, items: empty.slice(0, 20).map((result) => result.item.id) },
    { id: 'refund-against-own-answer', label: 'Refund calls where the policy answer says no', detail: 'The action says refund while the same run answered that the policy does not allow one. Holding these back needs no labels either.', count: againstOwnAnswer.length, of: refunds.length, items: againstOwnAnswer.slice(0, 20).map((result) => result.item.id) },
  ];
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
    .map((action) => ({ label: sentence(action), count: results.filter((result) => result.evaluation.action === action).length }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Action chosen against the action the policy gives',
    rowLabel: 'the action the policy gives',
    columnLabel: 'the action the model chose',
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
  return { title: 'How much of the queue can be sent unseen', xLabel: 'Calls sent without a person', yLabel: 'Of those, calls the policy agrees with', rateLabel: 'Share of the automatic calls that are right', of: graded.length, thresholdFormat: 'level', levels: 6, defaultIndex: AUTOMATE_AT, points };
}

function findings(graded, byItem, policy) {
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
  const differentMoney = bandOnly.filter((result) => refundAmount(byItem.get(result.item.id).refundBand, result.item) !== result.evaluation.amount);
  if (bandOnly.length >= 3) lines.push(`${bandOnly.length} calls take the right action with a different band on it, and ${differentMoney.length} of those change what the customer is actually paid — the rest name the same money two ways, because a full refund and a full refund plus shipping are the same call when no shipping was charged.`);

  const overpaid = graded.filter((result) => result.evaluation.amount > 0 && byItem.get(result.item.id).correctAction !== 'REFUND_NOW');
  if (overpaid.length) lines.push(`${overpaid.length} refunds worth ${money(paid(overpaid))} would have gone out against the policy.`);

  const { overpaidAmount, underpaidAmount } = refundMoney(graded, byItem);
  const owedNothing = graded.filter((result) => result.evaluation.action === 'REFUND_NOW' && result.evaluation.amount === 0 && policyAmount(byItem.get(result.item.id), result.item) > 0);
  if (underpaidAmount > overpaidAmount) lines.push(`Against the policy's own amounts the calls pay ${money(underpaidAmount)} too little and ${money(overpaidAmount)} too much. The larger error is not generosity: ${owedNothing.length} customers the policy refunds got a refund call with no money in it.`);

  const refusedButRefunded = wrong.filter((result) => byItem.get(result.item.id).correctAction === 'DENY' && result.evaluation.action === 'REFUND_NOW');
  const heldByOwnAnswers = refusedButRefunded.filter(contradictsItself);
  if (refusedButRefunded.length) lines.push(`${refusedButRefunded.length} disputes the policy refuses were answered refund now, and ${heldByOwnAnswers.length} of those calls contradict themselves: no money in the band, or the policy answer says no. Holding back self-contradicting calls would stop ${heldByOwnAnswers.length} of the ${wrong.length} wrong actions with no labels.`);

  const denials = graded.filter((result) => byItem.get(result.item.id).correctAction === 'DENY');
  const denied = denials.filter((result) => result.evaluation.action === 'DENY');
  if (denials.length && denied.length / denials.length < 0.8) lines.push(`Refusing is the weakest action: ${denied.length} of the ${denials.length} disputes the policy refuses were refused (${share(denied.length, denials.length)}).`);

  const ruleRight = ruleAgreement(graded, byItem, policy);
  const modelRight = graded.length - wrong.length;
  if (ruleRight > modelRight) lines.push(`A five-line rule over four policy numbers picks the policy's action on ${ruleRight} of ${graded.length} disputes (${share(ruleRight, graded.length)}), more than the model's ${modelRight}. The rule cannot fill the band or the reason code, and it never reads the message.`);
  return lines;
}

function topItems(results) {
  return [...results]
    .filter((result) => result.evaluation.amount > 0)
    .sort((left, right) => right.evaluation.amount - left.evaluation.amount || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.evaluation.label} · ${readable(result.evaluation.reason)}`, value: money(result.evaluation.amount) }));
}

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${AUTOMATION_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;

/** Whether the yes-or-no policy answer sits with the action chosen. Only a refund needs a yes. */
function policyTone(evaluation) {
  if (evaluation.action === 'REFUND_NOW') return evaluation.policyAllows ? 'good' : 'bad';
  if (evaluation.action === 'DENY' && evaluation.policyAllows) return 'warn';
  return undefined;
}

function verdictDetail(evaluation) {
  if (evaluation.action === 'REFUND_NOW' && evaluation.amount === 0) return 'The action says refund and the band says none, so the call carries no money.';
  if (evaluation.action === 'REFUND_NOW') return `${sentence(evaluation.band)} band, reason code ${readable(evaluation.reason)}.`;
  if (evaluation.action === 'REQUEST_EVIDENCE') return 'Asks the customer for a photograph, due in seven days; nothing is refunded yet.';
  if (evaluation.action === 'ESCALATE') return 'Goes to the manual-review queue; nothing is refunded by this call.';
  return `Refused, with reason code ${readable(evaluation.reason)}, and the customer is told.`;
}

function verdict(result, context) {
  const { evaluation, answers } = result;
  const refund = evaluation.action === 'REFUND_NOW';
  const automatic = evaluation.automation >= AUTOMATE_AT;
  const emptyRefund = refund && evaluation.amount === 0;
  return {
    eyebrow: 'The call this dispute becomes',
    headline: refund ? `Refund now · ${money(evaluation.amount, context?.currency)}` : sentence(evaluation.action),
    detail: verdictDetail(evaluation),
    facts: [
      { label: 'Confidence in the action', value: percentOf(evaluation.confidence), tone: evaluation.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Confidence in the band', value: emptyRefund ? `${percentOf(answers.refund_band.confidence)} · none, on a refund` : percentOf(answers.refund_band.confidence), tone: emptyRefund ? 'bad' : answers.refund_band.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Confidence in the reason code', value: percentOf(answers.reason_code.confidence), tone: answers.reason_code.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Policy allows a refund', value: `${evaluation.policyAllows ? 'Yes' : 'No'} · ${percentOf(Math.max(answers.policy_allows.noul, 1 - answers.policy_allows.noul))}`, tone: policyTone(evaluation) },
      { label: 'Safe to send unseen', value: `${levelOf(evaluation.automation)}${automatic ? '' : ' · goes to a person'}`, tone: automatic ? 'good' : undefined },
    ],
  };
}

const KIND_NOTES = {
  'friendly fraud': 'Planted as friendly fraud: signed for, and the customer has claimed not-received at least twice before.',
  'genuine non-delivery': 'Planted as a genuine non-delivery: the courier stopped scanning past the waiting period.',
  'duplicate charge': 'Planted as a duplicate charge: one order, two payments.',
  'policy expired': 'Planted as a fair complaint that arrived after the 30-day window closed.',
  'needs one photo': 'Planted as damage with no photograph: the policy asks before it decides.',
};

/** What else differs once the action is settled: the band in money, then the reason code. */
function argumentNote(result, label, currency) {
  const parts = [];
  if (label.refundBand !== result.evaluation.band) {
    parts.push(`Band differs: the policy gives ${readable(label.refundBand)} (${money(policyAmount(label, result.item), currency)}), the call carries ${money(result.evaluation.amount, currency)}.`);
  }
  if (label.reasonCode !== result.evaluation.reason) parts.push(`Reason code differs: the policy gives ${readable(label.reasonCode)}.`);
  return parts.join(' ');
}

const grade = {
  labelId: (label) => label.disputeId,
  // Right means what the headline counts: the action is the one the policy gives.
  judge: (result, label, context) => {
    if (!label) return null;
    const agree = result.evaluation.action === label.correctAction;
    const notes = [KIND_NOTES[label.kind], agree ? argumentNote(result, label, context?.currency) : ''].filter(Boolean);
    return {
      agree,
      expected: label.correctAction,
      got: result.evaluation.action,
      note: notes.length ? notes.join(' ') : undefined,
      confidence: result.answers.action.confidence,
    };
  },
};

const present = {
  number: 113,
  problem: {
    headline: 'Every dispute ends in a backend call. Someone has to choose the action, the amount and the reason code.',
    stat: '220',
    statLabel: 'disputes in the queue',
  },
  hero: {
    item: 'DSP-0001',
    caption: 'The parcel last scanned 14 days ago and the policy treats it as lost after 10. The call refunds £134.50: the £129.55 order and the £4.95 shipping.',
  },
  answers: {
    caption: 'Five typed answers become one call. The band sets the money, and the last answer says whether the call could go out unseen.',
    reveal: ['action', 'refund_band', 'reason_code', 'policy_allows', 'confidence_to_automate'],
  },
  miss: {
    item: 'DSP-0003',
    caption: 'No cancellation is on record, so the policy refuses. The action says refund, the band says none and the policy answer says no: a refund call for £0.00, one of 27.',
  },
  proof: {
    kpis: ['Action agrees with policy', 'Whole call correct', 'Would send unseen'],
    chart: 'curve',
    closing: '90% of calls pick the right action and 57% fill every argument right. At 4 of 6, 97 calls clear the bar and the action is right on all 97.',
  },
};

export default {
  id: 'dispute-routing',
  title: 'Dispute and refund routing',
  domain: 'orders',
  value: 'Turn a dispute queue into backend calls: the action, the money and the reason code, typed.',
  tags: ['disputes', 'refunds', 'tool calls', 'ecommerce'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${readable(item.claim)} · ${money(item.orderTotal)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/dispute-routing.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage: {
    hide: ['orderId', 'openedAt'],
    labels: {
      claim: 'Claim',
      orderTotal: 'Order total',
      shippingPaid: 'Shipping paid',
      daysSinceDelivery: 'Days since delivery (window is 30)',
      daysSinceLastScan: 'Days since last courier scan (lost after 10)',
      trackingStatus: 'Courier status',
      deliveryProof: 'Proof of delivery',
      photoAttached: 'Photograph attached',
      priorDisputes: 'Earlier disputes',
      priorNotReceived: 'Earlier not-received claims',
      customerSince: 'Customer since',
      wantsToKeep: 'Wants to keep the item',
      cosmetic: 'Marks are cosmetic only',
      cancelledOnRecord: 'Cancellation on record',
      duplicateChargeId: 'Second charge reference',
      message: 'What the customer wrote',
    },
    highlight: ['claim', 'orderTotal', 'daysSinceDelivery', 'daysSinceLastScan'],
  },
  grade,
  verdict,
  present,
  caveat: 'The right action here is a fixed reading of numbers in the state, and a five-line rule over those numbers scores higher than the model on the action; the 171 everyday disputes are templated. The band, the reason code and the self-contradicting calls are where this run is informative.',
  explain: {
    data: 'scripts/generate/dispute-routing.js#demo:data',
    state: 'demos/dispute-routing/demo.js#demo:state',
    questions: 'demos/dispute-routing/demo.js#demo:questions',
    evaluate: 'demos/dispute-routing/demo.js#demo:evaluate',
  },
};
