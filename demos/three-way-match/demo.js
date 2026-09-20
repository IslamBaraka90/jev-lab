// Three-way match: compare the purchase order, goods receipt and supplier invoice, then hold only
// the packets whose differences exceed the company's stated matching policy.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

const HOLD_THRESHOLD = 0.5;
const MISMATCHES = ['PRICE', 'QUANTITY', 'TAX', 'CURRENCY', 'DUPLICATE', 'PARTIAL_DELIVERY', 'NONE'];
const PROBLEM_MISMATCHES = MISMATCHES.filter((mismatch) => mismatch !== 'NONE');
const round = (value) => Number(value.toFixed(2));
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
const share = (part, whole) => {
  if (!whole) return '—';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The complete packet, policy and two preceding supplier packets; no variance is precomputed. */
function buildState(item, context) {
  return {
    task: 'Compare the purchase order, goods receipt and supplier invoice before the payment run.',
    company: {
      name: context.entity,
      reporting_currency: context.reportingCurrency,
      tax_rate_percent: context.taxRatePercent,
    },
    supplier: {
      name: item.supplier,
      payment_terms: item.paymentTerms,
      agreed_tolerances: {
        unit_price_percent: context.tolerances.pricePercent,
        quantity_units: context.tolerances.quantityUnits,
      },
    },
    purchase_order: item.purchaseOrder,
    goods_receipt: item.goodsReceipt,
    supplier_invoice: item.invoice,
    previous_supplier_packets: item.supplierHistory.length
      ? item.supplierHistory
      : 'No earlier packet from this supplier.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  mismatch: choice('What is the primary result of matching the invoice to the purchase order and goods receipt?', {
    PRICE: 'The billed unit price exceeds the agreed price tolerance.',
    QUANTITY: 'The quantity billed exceeds the quantity ordered beyond tolerance.',
    TAX: 'The invoice tax does not agree with the stated company tax rate.',
    CURRENCY: 'The invoice currency does not match the purchase order currency.',
    DUPLICATE: 'The invoice repeats an earlier invoice against the same receipt.',
    PARTIAL_DELIVERY: 'The invoice bills the full order although fewer units were received.',
    NONE: 'The documents agree, or every difference is allowed by the stated tolerances.',
  }),
  within_tolerance: noul('Are all document differences absent or inside the stated price and quantity tolerances?', {
    yes: 'The packet can be released under the matching policy.',
    no: 'At least one difference exceeds policy or requires investigation.',
  }),
  overbilling_risk: score('How strong is the risk that paying this invoice would overpay or pay the wrong obligation?', [
    'None',
    'Negligible',
    'Low',
    'Moderate',
    'High',
    'Severe',
    'Certain',
  ]),
  hold_payment: noul('Should accounts payable hold this invoice before the next payment run?', {
    yes: 'Hold payment because the packet contains an unresolved material mismatch.',
    no: 'Release payment because the packet agrees or differs only within tolerance.',
  }),
};
// #endregion

// #region demo:evaluate
/** Turns four typed answers into the hold or release shown in the queue and report. */
function evaluate(answers, item, context) {
  const mismatch = answers.mismatch.choice;
  const withinToleranceProbability = answers.within_tolerance.noul;
  const holdProbability = answers.hold_payment.noul;
  const held = holdProbability >= HOLD_THRESHOLD;
  const amountAtRisk = documentRisk(item, mismatch, context.taxRatePercent);

  return {
    flagged: held,
    mismatch,
    withinTolerance: withinToleranceProbability >= 0.5,
    withinToleranceProbability,
    riskScore: answers.overbilling_risk.score,
    holdProbability,
    held,
    amountAtRisk,
    label: `${item.id}: ${held ? 'hold' : 'release'} · ${readable(mismatch)}`,
  };
}
// #endregion

// #region demo:report
/** Grades the named mismatch and the hold, then totals the money held and missed in the reporting currency. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const labelByItem = new Map(labels.map((label) => [label.packetId, label]));
  const graded = results.filter((result) => labelByItem.has(result.item.id));
  const problems = graded.filter((result) => labelByItem.get(result.item.id).kind === 'problem');
  const heldProblems = problems.filter((result) => result.evaluation.held);
  const falseHolds = graded.filter((result) => labelByItem.get(result.item.id).kind !== 'problem' && result.evaluation.held);
  const exposure = reportingExposure(problems, labelByItem, context);
  const matrix = confusion(graded, labelByItem);
  const comparison = alternatives(graded, labelByItem, context);

  return {
    note: `Graded against ${problems.length} planted mismatches. Labels never enter the model state.${otherCurrencyNote(exposure, context.reportingCurrency)}`,
    findings: [...repeatedMistake(graded, labelByItem), ...toleranceFinding(graded, labelByItem), ...contradictionFinding(graded), ...comparison.findings],
    kpis: headline({ graded, problems, heldProblems, falseHolds, exposure, labelByItem, currency: context.reportingCurrency }),
    baselines: comparison.baselines,
    metrics: metrics(graded, problems, heldProblems, falseHolds, labelByItem, matrix),
    distribution: distribution(graded),
    distributionTitle: 'Mismatches named',
    matrix,
    curve: coverage(graded, labelByItem),
    checks: checks(graded, labelByItem),
    topItemsTitle: `Largest ${context.reportingCurrency ?? ''} amounts at risk`.replace('  ', ' '),
    topItems: topItems(graded, labelByItem, context.reportingCurrency),
    money: { held: exposure.held, released: exposure.released, total: exposure.total },
    exposureByMismatch: exposureByMismatch(problems, labelByItem, context),
    supplierRanking: supplierRanking(problems, labelByItem, context),
  };
}
// #endregion

function documentRisk(item, mismatch, taxRate = 5) {
  const ordered = item.purchaseOrder.lines[0];
  const received = item.goodsReceipt.lines[0];
  const billed = item.invoice.lines[0];
  const withTax = (value) => round(value + (value * taxRate) / 100);
  if (mismatch === 'PRICE') return withTax(Math.max(0, billed.unitPrice - ordered.unitPrice) * billed.quantityBilled);
  if (mismatch === 'QUANTITY') return withTax(Math.max(0, billed.quantityBilled - ordered.quantity) * ordered.unitPrice);
  if (mismatch === 'TAX') return round(Math.abs(item.invoice.tax - (item.invoice.subtotal * taxRate) / 100));
  if (mismatch === 'CURRENCY' || mismatch === 'DUPLICATE') return item.invoice.total;
  if (mismatch === 'PARTIAL_DELIVERY') return withTax(Math.max(0, billed.quantityBilled - received.quantityReceived) * ordered.unitPrice);
  return 0;
}

function agrees(result, label) {
  if (!label) return false;
  if (result.evaluation.mismatch !== label.mismatch) return false;
  if (label.kind === 'problem') return result.evaluation.held && !result.evaluation.withinTolerance;
  if (label.kind === 'within-tolerance') return !result.evaluation.held && result.evaluation.withinTolerance;
  return !result.evaluation.held;
}

const ratio = (part, whole) => (whole ? part / whole : 0);
const sum = (values) => round(values.reduce((total, value) => total + value, 0));
const inReportingCurrency = (result, context) => result.item.invoice.currency === (context.reportingCurrency ?? result.item.invoice.currency);

/**
 * Money at risk, in the reporting currency only. The data carries no exchange rates, so an invoice
 * in another currency cannot be added to these totals; it is counted beside them instead.
 */
function reportingExposure(problems, labelByItem, context) {
  const risk = (result) => documentRisk(result.item, labelByItem.get(result.item.id).mismatch, context.taxRatePercent);
  const comparable = problems.filter((result) => inReportingCurrency(result, context));
  const others = problems.filter((result) => !inReportingCurrency(result, context));
  return {
    held: sum(comparable.filter((result) => result.evaluation.held).map(risk)),
    released: sum(comparable.filter((result) => !result.evaluation.held).map(risk)),
    total: sum(comparable.map(risk)),
    others: others.length,
    othersHeld: others.filter((result) => result.evaluation.held).length,
    otherCurrencies: [...new Set(others.map((result) => result.item.invoice.currency))].sort(),
  };
}

function otherCurrencyNote(exposure, currency) {
  if (!exposure.others) return '';
  return ` Money is totalled in ${currency} only: ${exposure.others} problem invoices billed in ${exposure.otherCurrencies.join(', ')} are left out because the data has no exchange rates, and ${exposure.othersHeld} of them were held.`;
}

function headline({ graded, problems, heldProblems, falseHolds, exposure, labelByItem, currency }) {
  const nonProblems = graded.length - problems.length;
  const right = graded.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const allowed = graded.filter((result) => labelByItem.get(result.item.id).kind === 'within-tolerance');
  const allowedHeld = allowed.filter((result) => result.evaluation.held);
  const holds = heldProblems.length + falseHolds.length;
  const excluded = exposure.others ? `, ${currency} invoices only` : '';
  return [
    { label: 'Packets decided correctly', value: share(right.length, graded.length), context: `${right.length} of ${graded.length}: the right mismatch named and the right hold or release`, tone: right.length === graded.length ? 'good' : 'warn' },
    { label: 'Problems caught', value: share(heldProblems.length, problems.length), context: `${heldProblems.length} of ${problems.length} held`, tone: heldProblems.length === problems.length ? 'good' : 'warn' },
    { label: 'False holds', value: share(falseHolds.length, nonProblems), context: `${falseHolds.length} of ${nonProblems} clean or allowed packets: ${falseHolds.length - allowedHeld.length} of ${nonProblems - allowed.length} exact, ${allowedHeld.length} of ${allowed.length} inside tolerance`, tone: falseHolds.length ? 'warn' : 'good' },
    { label: 'Holds that were real', value: share(heldProblems.length, holds), context: `${heldProblems.length} of ${holds} held packets had a planted problem`, tone: falseHolds.length ? 'warn' : 'good' },
    { label: 'Money at risk held', value: money(exposure.held, currency), context: `${money(exposure.released, currency)} missed of ${money(exposure.total, currency)}${excluded}`, tone: exposure.released ? 'warn' : 'good' },
  ];
}

/** The three answers restate one decision, so they can contradict each other: a named mismatch means outside tolerance means hold. */
function contradicts(result) {
  const named = result.evaluation.mismatch !== 'NONE';
  return named === result.evaluation.withinTolerance || named !== result.evaluation.held;
}

function metrics(graded, problems, heldProblems, falseHolds, labelByItem, matrix) {
  const right = graded.filter((result) => agrees(result, labelByItem.get(result.item.id)));
  const holds = heldProblems.length + falseHolds.length;
  return {
    headline: { label: 'Packets decided correctly', value: ratio(right.length, graded.length), n: graded.length },
    accuracy: ratio(right.length, graded.length),
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    precision: holds ? heldProblems.length / holds : null,
    recall: problems.length ? heldProblems.length / problems.length : null,
    contradictionRate: ratio(graded.filter(contradicts).length, graded.length),
  };
}

/**
 * The rules baseline, from the structured fields alone. Different currencies; an invoice id already in
 * the supplier's history; billed more than received but not more than ordered; billed more than ordered;
 * a unit price above the order's; tax that is not the stated rate. Quantity and price only count beyond
 * the agreed tolerances, and anything else is released.
 */
function ruleMismatch(item, context) {
  const ordered = item.purchaseOrder.lines[0];
  const received = item.goodsReceipt.lines[0];
  const billed = item.invoice.lines[0];
  const { pricePercent, quantityUnits } = context.tolerances;
  if (item.invoice.currency !== item.purchaseOrder.currency) return 'CURRENCY';
  if (item.supplierHistory.some((packet) => packet.invoice?.id === item.invoice.id)) return 'DUPLICATE';
  if (billed.quantityBilled - ordered.quantity > quantityUnits) return 'QUANTITY';
  if (billed.quantityBilled - received.quantityReceived > quantityUnits) return 'PARTIAL_DELIVERY';
  if (((billed.unitPrice - ordered.unitPrice) / ordered.unitPrice) * 100 > pricePercent) return 'PRICE';
  if (Math.abs(item.invoice.tax - (item.invoice.subtotal * context.taxRatePercent) / 100) > 0.01) return 'TAX';
  return 'NONE';
}

/** The model beside the rule and beside releasing everything, all scored as the whole packet decided right. */
function alternatives(graded, labelByItem, context) {
  const labelOf = (result) => labelByItem.get(result.item.id);
  const modelRight = graded.filter((result) => agrees(result, labelOf(result))).length;
  const ruleRight = context.tolerances ? graded.filter((result) => ruleMismatch(result.item, context) === labelOf(result).mismatch).length : 0;
  const releaseRight = graded.filter((result) => labelOf(result).kind !== 'problem').length;
  const baselines = [
    { label: 'Jev', detail: 'right mismatch named, right hold or release', value: ratio(modelRight, graded.length), model: true },
    { label: 'Rule: compare the fields', detail: 'currency, invoice id in history, quantities, unit price and tax, with the stated tolerances; holds whatever it names', value: ratio(ruleRight, graded.length) },
    { label: 'Always release', detail: 'the commonest answer: no mismatch, pay the invoice', value: ratio(releaseRight, graded.length) },
  ];
  const findings = ruleRight > modelRight
    ? [`A short rule over the same structured fields decides ${ruleRight} of ${graded.length} packets correctly; the model decides ${modelRight}. Every mismatch in this dataset can be computed, so here the rule is the better tool.`]
    : [];
  return { baselines, findings };
}

/** The negative controls are the point of the dataset, so their result is said in words, not averaged away. */
function toleranceFinding(graded, labelByItem) {
  const allowed = graded.filter((result) => labelByItem.get(result.item.id).kind === 'within-tolerance');
  const held = allowed.filter((result) => result.evaluation.held);
  if (!held.length) return [];
  return [`${held.length} of the ${allowed.length} packets whose difference is inside the stated tolerance were held anyway. The model sees the difference and does not apply the policy.`];
}

function contradictionFinding(graded) {
  const mixed = graded.filter(contradicts);
  if (!mixed.length) return [];
  return [`${mixed.length} packets got answers that contradict each other (a mismatch named but released, or called outside tolerance and released): ${mixed.map((result) => result.item.id).join(', ')}.`];
}

function checks(graded, labelByItem) {
  const problemChecks = PROBLEM_MISMATCHES.map((mismatch) => difficulty(mismatch, graded, labelByItem));
  const group = graded.filter((result) => labelByItem.get(result.item.id).kind === 'within-tolerance');
  const wrong = group.filter((result) => !agrees(result, labelByItem.get(result.item.id)));
  return [...problemChecks, {
    id: 'within-tolerance',
    label: 'Allowed differences held or misnamed',
    detail: `${group.length - wrong.length} of ${group.length} released as allowed differences.`,
    count: wrong.length,
    of: group.length,
    items: wrong.map((result) => result.item.id),
  }];
}

function difficulty(mismatch, graded, labelByItem) {
  const group = graded.filter((result) => labelByItem.get(result.item.id).mismatch === mismatch);
  const wrong = group.filter((result) => !agrees(result, labelByItem.get(result.item.id)));
  return {
    id: mismatch.toLowerCase(),
    label: `${sentence(mismatch)} mismatches missed`,
    detail: `${group.length - wrong.length} of ${group.length} named and held correctly.`,
    count: wrong.length,
    of: group.length,
    items: wrong.map((result) => result.item.id),
  };
}

function distribution(graded) {
  return MISMATCHES.map((mismatch) => ({
    label: readable(mismatch),
    count: graded.filter((result) => result.evaluation.mismatch === mismatch).length,
    tone: mismatch === 'NONE' ? 'good' : 'warn',
  })).filter((entry) => entry.count);
}

function confusion(graded, labelByItem) {
  return {
    title: 'Planted mismatch against the one named',
    rowLabel: 'the mismatch that was planted',
    columnLabel: 'the mismatch the model named',
    columns: MISMATCHES.map(readable),
    rows: MISMATCHES.map((actual) => ({
      label: readable(actual),
      cells: MISMATCHES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => labelByItem.get(result.item.id).mismatch === actual && result.evaluation.mismatch === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, labelByItem) {
  const problemCount = graded.filter((result) => labelByItem.get(result.item.id).kind === 'problem').length;
  const points = Array.from({ length: 7 }, (_, score) => {
    const held = graded.filter((result) => result.evaluation.riskScore >= score);
    const caught = held.filter((result) => labelByItem.get(result.item.id).kind === 'problem').length;
    return { threshold: score / 6, reviewed: held.length, caught, rate: held.length ? caught / held.length : null };
  });
  return { title: 'Overbilling-risk threshold', xLabel: 'Packets held', yLabel: 'Problems caught', rateLabel: 'Share of holds that were real', of: problemCount, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
}

function repeatedMistake(graded, labelByItem) {
  const wrong = graded.filter((result) => result.evaluation.mismatch !== labelByItem.get(result.item.id).mismatch);
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const key = `${labelByItem.get(result.item.id).mismatch}→${result.evaluation.mismatch}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...groups].sort((a, b) => b[1] - a[1])[0];
  if (count < 3 || count < wrong.length * 0.3) return [];
  const [actual, predicted] = pair.split('→');
  return [`${count} of ${wrong.length} mismatch errors repeat one pattern: ${readable(actual)} called ${readable(predicted)}. Review that boundary as one matching-rule question.`];
}

/** Ranked by amount, so only packets billed in the reporting currency can be in the list. */
function topItems(graded, labelByItem, currency) {
  const risk = (result) => documentRisk(result.item, labelByItem.get(result.item.id).mismatch);
  return [...graded]
    .filter((result) => result.evaluation.held || labelByItem.get(result.item.id).kind === 'problem')
    .filter((result) => result.item.invoice.currency === (currency ?? result.item.invoice.currency))
    .sort((left, right) => risk(right) - risk(left))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.supplier} · ${result.evaluation.label}${agrees(result, labelByItem.get(result.item.id)) ? ' · agrees' : ' · disagrees'}`,
      value: `${money(risk(result), currency)} · risk ${result.evaluation.riskScore.toFixed(1)} of 6`,
    }));
}

/** Count and money per planted mismatch, because the money total alone hides the classes that were missed. */
function exposureByMismatch(problems, labelByItem, context) {
  const comparable = problems.filter((result) => inReportingCurrency(result, context));
  const risk = (result) => documentRisk(result.item, labelByItem.get(result.item.id).mismatch, context.taxRatePercent);
  return PROBLEM_MISMATCHES.map((mismatch) => {
    const group = comparable.filter((result) => labelByItem.get(result.item.id).mismatch === mismatch);
    const held = group.filter((result) => result.evaluation.held);
    return { mismatch: readable(mismatch), problems: group.length, held: held.length, amountHeld: sum(held.map(risk)), amountAtRisk: sum(group.map(risk)) };
  }).filter((row) => row.problems);
}

/** Suppliers by planted exposure in the reporting currency, with how much of it the model held. */
function supplierRanking(problems, labelByItem, context) {
  const groups = new Map();
  for (const result of problems.filter((entry) => inReportingCurrency(entry, context))) {
    const risk = documentRisk(result.item, labelByItem.get(result.item.id).mismatch, context.taxRatePercent);
    const entry = groups.get(result.item.supplier) ?? { supplier: result.item.supplier, problems: 0, held: 0, amountHeld: 0, amountAtRisk: 0 };
    entry.problems += 1;
    entry.held += result.evaluation.held ? 1 : 0;
    entry.amountHeld = round(entry.amountHeld + (result.evaluation.held ? risk : 0));
    entry.amountAtRisk = round(entry.amountAtRisk + risk);
    groups.set(result.item.supplier, entry);
  }
  return [...groups.values()].sort((left, right) => right.amountAtRisk - left.amountAtRisk || left.supplier.localeCompare(right.supplier));
}

const RISK_LEVELS = ['None', 'Negligible', 'Low', 'Moderate', 'High', 'Severe', 'Certain'];
const percentOf = (value) => `${Math.round(value * 100)}%`;
const decision = (held, mismatch) => `${held ? 'hold' : 'release'} · ${readable(mismatch)}`;

/** Right means what the report counts: the mismatch named, and the hold or release that goes with it. */
function judge(result, label, context) {
  if (!label) return null;
  return {
    agree: agrees(result, label),
    expected: decision(label.kind === 'problem', label.mismatch),
    got: decision(result.evaluation.held, result.evaluation.mismatch),
    note: gradeNote(result.item, label, context),
    confidence: result.answers.mismatch.confidence,
  };
}

function gradeNote(item, label, context) {
  if (label.kind === 'within-tolerance') {
    return `A negative control: the difference is inside the ${context.tolerances.pricePercent}% price and ${context.tolerances.quantityUnits}-unit quantity tolerances, so the packet should be released.`;
  }
  if (label.kind !== 'problem') return undefined;
  return `Planted as ${readable(label.mismatch)}: ${money(label.amountAtRisk, item.invoice.currency)} at risk.`;
}

/** The decision card: hold or release, what for, and how much money rides on it in the invoice's own currency. */
function verdict(result) {
  const { evaluation, item, answers } = result;
  const currency = item.invoice.currency;
  const amount = evaluation.amountAtRisk > 0 ? ` · ${money(evaluation.amountAtRisk, currency)}` : '';
  return {
    eyebrow: 'What happens before the payment run',
    headline: `${evaluation.held ? 'Hold' : 'Release'} · ${evaluation.mismatch === 'NONE' ? 'no mismatch' : readable(evaluation.mismatch)}${amount}`,
    detail: `Invoice ${item.invoice.id} from ${item.supplier} for ${money(item.invoice.total, currency)}.`,
    facts: [
      { label: 'Mismatch named', value: `${sentence(evaluation.mismatch)} · ${percentOf(answers.mismatch.confidence)}`, tone: evaluation.mismatch === 'NONE' ? 'good' : 'warn' },
      { label: 'Inside tolerance', value: `${evaluation.withinTolerance ? 'Yes' : 'No'} · ${percentOf(evaluation.withinToleranceProbability)}`, tone: evaluation.withinTolerance ? 'good' : 'bad' },
      { label: 'Overbilling risk', value: `${RISK_LEVELS[Math.round(evaluation.riskScore)]} · ${evaluation.riskScore.toFixed(1)} of 6`, tone: evaluation.riskScore >= 3.5 ? 'bad' : evaluation.riskScore >= 2 ? 'warn' : undefined },
      { label: 'Hold payment', value: `${evaluation.held ? 'Yes' : 'No'} · ${percentOf(evaluation.holdProbability)}`, tone: evaluation.held ? 'warn' : 'good' },
      { label: 'Amount at risk', value: money(evaluation.amountAtRisk, currency), tone: evaluation.amountAtRisk > 0 ? 'bad' : undefined },
    ],
  };
}

export default {
  id: 'three-way-match',
  title: 'Three-way match',
  domain: 'books',
  value: "Catch the invoices that do not agree with the purchase order or goods receipt before payment runs.",
  tags: ['accounts payable', 'invoices', 'procurement', 'controls'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.supplier} · ${money(item.invoice.total, item.invoice.currency)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/three-way-match.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'Every mismatch in this dataset can be computed from structured fields, and a short rule decides all 150 packets correctly; the packets need free-text lines, units of measure and split receipts before this measures judgement.',
  stage: {
    hide: ['incoterm', 'purchaseOrderId', 'goodsReceiptId', 'freight'],
    labels: {
      purchaseOrder: 'Purchase order',
      goodsReceipt: 'Goods receipt',
      invoice: 'Supplier invoice',
      supplierHistory: 'Earlier packets from this supplier',
      paymentTerms: 'Payment terms',
      quantityBilled: 'Qty billed',
      quantityReceived: 'Qty received',
      quantity: 'Qty ordered',
    },
    highlight: ['currency', 'tax', 'total'],
  },
  grade: {
    labelId: (label) => label.packetId,
    judge,
  },
  verdict,
  present: {
    number: 104,
    problem: {
      headline: 'Invoices queued for the payment run, and 34 of them should not be paid as billed.',
      stat: '150',
      statLabel: 'invoice packets to match',
    },
    hero: {
      item: 'P-0001',
      caption: 'Forty units ordered and billed, 34 received. The model names the partial delivery and holds $2,598.94 for goods that never arrived.',
    },
    answers: {
      caption: 'Four typed answers become one decision: what disagrees, whether policy allows it, how risky, and hold or release.',
      reveal: ['mismatch', 'within_tolerance', 'hold_payment'],
    },
    miss: {
      item: 'P-0013',
      caption: 'A price difference inside the 2% tolerance, which policy says to release. The model called it a price mismatch and held it, as it did with all 8 such packets.',
    },
    proof: {
      kpis: ['Packets decided correctly', 'Problems caught', 'False holds'],
      chart: 'baselines',
      closing: '134 of 150 packets decided correctly, against 150 of 150 for a short rule over the same fields.',
    },
  },
  explain: {
    data: 'scripts/generate/three-way-match.js#demo:data',
    state: 'demos/three-way-match/demo.js#demo:state',
    questions: 'demos/three-way-match/demo.js#demo:questions',
    evaluate: 'demos/three-way-match/demo.js#demo:evaluate',
  },
};
