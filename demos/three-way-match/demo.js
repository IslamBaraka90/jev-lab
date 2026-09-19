// Three-way match: compare the purchase order, goods receipt and supplier invoice, then hold only
// the packets whose differences exceed the company's stated matching policy.

import { choice, noul, score } from '../lib/questions.js';

const HOLD_THRESHOLD = 0.5;
const MISMATCHES = ['PRICE', 'QUANTITY', 'TAX', 'CURRENCY', 'DUPLICATE', 'PARTIAL_DELIVERY', 'NONE'];
const PROBLEM_MISMATCHES = MISMATCHES.filter((mismatch) => mismatch !== 'NONE');
const round = (value) => Number(value.toFixed(2));
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
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
/** Grades the named mismatch and hold, then proves every dollar of risk is either held or missed. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const labelByItem = new Map(labels.map((label) => [label.packetId, label]));
  const graded = results.filter((result) => labelByItem.has(result.item.id));
  const problems = graded.filter((result) => labelByItem.get(result.item.id).kind === 'problem');
  const heldProblems = problems.filter((result) => result.evaluation.held);
  const falseHolds = graded.filter((result) => labelByItem.get(result.item.id).kind !== 'problem' && result.evaluation.held);
  const exposure = moneyIdentity(problems, heldProblems, labelByItem, context.taxRatePercent);

  return {
    note: `Graded against ${problems.length} planted mismatches. Labels never enter the model state.`,
    findings: repeatedMistake(graded, labelByItem),
    kpis: headline(graded, problems, heldProblems, falseHolds, exposure, context.reportingCurrency),
    distribution: distribution(graded),
    matrix: confusion(graded, labelByItem),
    curve: coverage(graded, labelByItem),
    checks: checks(graded, labelByItem),
    topItems: topItems(graded, labelByItem, context.reportingCurrency),
    money: exposure,
    supplierRanking: supplierRanking(graded, labelByItem),
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

function moneyIdentity(problems, heldProblems, labelByItem, taxRate) {
  const risk = (result) => documentRisk(result.item, labelByItem.get(result.item.id).mismatch, taxRate);
  const held = round(heldProblems.reduce((sum, result) => sum + risk(result), 0));
  const released = round(problems.filter((result) => !result.evaluation.held).reduce((sum, result) => sum + risk(result), 0));
  const total = round(problems.reduce((sum, result) => sum + risk(result), 0));
  return { held, released, total, difference: round(held + released - total) };
}

function headline(graded, problems, heldProblems, falseHolds, exposure, currency) {
  const nonProblems = graded.length - problems.length;
  return [
    { label: 'Packets reviewed', value: graded.length },
    { label: 'Problems caught', value: share(heldProblems.length, problems.length), context: `${heldProblems.length} of ${problems.length} held`, tone: heldProblems.length === problems.length ? 'good' : 'warn' },
    { label: 'False holds', value: share(falseHolds.length, nonProblems), context: `${falseHolds.length} of ${nonProblems} clean or allowed packets`, tone: falseHolds.length ? 'warn' : 'good' },
    { label: 'Money at risk held', value: money(exposure.held, currency), context: `${money(exposure.released, currency)} missed of ${money(exposure.total, currency)}`, tone: exposure.released ? 'warn' : 'good' },
  ];
}

function checks(graded, labelByItem) {
  const problemChecks = PROBLEM_MISMATCHES.map((mismatch) => difficulty(mismatch, graded, labelByItem));
  const group = graded.filter((result) => labelByItem.get(result.item.id).kind === 'within-tolerance');
  const wrong = group.filter((result) => !agrees(result, labelByItem.get(result.item.id)));
  return [...problemChecks, {
    id: 'within-tolerance',
    label: 'Within-tolerance packets held or misnamed',
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
    label: `${readable(mismatch)} problems not resolved`,
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
  return { title: 'Overbilling-risk threshold', xLabel: 'Packets held', yLabel: 'Problems caught', rateLabel: 'Share of holds that were real', of: problemCount, points };
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

function topItems(graded, labelByItem, currency) {
  return [...graded]
    .filter((result) => result.evaluation.held || labelByItem.get(result.item.id).kind === 'problem')
    .sort((left, right) => documentRisk(right.item, labelByItem.get(right.item.id).mismatch) - documentRisk(left.item, labelByItem.get(left.item.id).mismatch))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.supplier} · ${result.evaluation.label}${agrees(result, labelByItem.get(result.item.id)) ? ' · agrees' : ''}`,
      value: `${money(documentRisk(result.item, labelByItem.get(result.item.id).mismatch), currency)} · risk ${result.evaluation.riskScore.toFixed(1)}`,
    }));
}

function supplierRanking(graded, labelByItem) {
  const groups = new Map();
  for (const result of graded.filter((entry) => labelByItem.get(entry.item.id).kind === 'problem')) {
    const entry = groups.get(result.item.supplier) ?? { supplier: result.item.supplier, problems: 0, amountAtRisk: 0 };
    entry.problems += 1;
    entry.amountAtRisk = round(entry.amountAtRisk + documentRisk(result.item, labelByItem.get(result.item.id).mismatch));
    groups.set(result.item.supplier, entry);
  }
  return [...groups.values()].sort((left, right) => right.amountAtRisk - left.amountAtRisk || left.supplier.localeCompare(right.supplier));
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
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.supplier} · ${money(item.invoice.total, item.invoice.currency)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/three-way-match.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/three-way-match.js#demo:data',
    state: 'demos/three-way-match/demo.js#demo:state',
    questions: 'demos/three-way-match/demo.js#demo:questions',
    evaluate: 'demos/three-way-match/demo.js#demo:evaluate',
  },
};
