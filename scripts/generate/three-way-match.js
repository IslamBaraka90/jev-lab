// One hundred and fifty purchase-order, receipt and supplier-invoice packets. The documents carry
// the evidence; planted mismatch labels are written separately and never enter the model state.

import { addDays, createRandom } from './lib/random.js';
import { merchantName } from './lib/names.js';
import { percentOf, round, unitPrice } from './lib/money.js';

export const SEED = 1104;

const TAX_RATE = 5;
const PRICE_TOLERANCE = 2;
const QUANTITY_TOLERANCE = 1;
const START_DAY = '2026-07-01';
const CURRENCIES = ['USD'];
const INCOTERMS = ['DAP', 'FCA', 'CPT', 'EXW'];
const PAYMENT_TERMS = ['NET_15', 'NET_30', 'NET_45'];
const PRODUCTS = [
  ['CAB-14', 'Shielded network cable'],
  ['FLT-22', 'Air intake filter'],
  ['GLV-08', 'Protective work gloves'],
  ['LBL-40', 'Thermal shipping labels'],
  ['MNT-12', 'Monitor mounting arm'],
  ['PCK-25', 'Reinforced packing carton'],
  ['SNS-16', 'Warehouse temperature sensor'],
  ['TON-04', 'Black laser toner'],
  ['UPS-10', 'Battery backup unit'],
  ['WIP-30', 'Industrial cleaning wipes'],
];
const PROBLEM_COUNTS = {
  PRICE: 9,
  QUANTITY: 7,
  TAX: 5,
  CURRENCY: 4,
  DUPLICATE: 3,
  PARTIAL_DELIVERY: 6,
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const suppliers = buildSuppliers(random);
  const plan = buildPlan(random);
  const histories = new Map();
  const occurrences = new Map();
  const items = [];
  const labels = [];

  for (let index = 0; index < plan.length; index++) {
    const kind = plan[index];
    const supplier = suppliers[index % suppliers.length];
    const previous = histories.get(supplier.name) ?? [];
    const occurrence = occurrences.get(kind) ?? 0;
    occurrences.set(kind, occurrence + 1);
    const packet = kind === 'DUPLICATE' ? duplicatePacket(previous.at(-1), index) : freshPacket(random, supplier, index);
    applyDifference(packet, kind, occurrence, random);

    const item = {
      id: `P-${String(index + 1).padStart(4, '0')}`,
      supplier: supplier.name,
      paymentTerms: supplier.paymentTerms,
      purchaseOrder: packet.purchaseOrder,
      goodsReceipt: packet.goodsReceipt,
      invoice: packet.invoice,
      supplierHistory: previous.slice(-2).map(historyCopy),
    };
    const mismatch = kind === 'WITHIN_TOLERANCE' || kind === 'CLEAN' ? 'NONE' : kind;
    items.push(item);
    labels.push({
      packetId: item.id,
      mismatch,
      amountAtRisk: riskFromDocuments(item, mismatch),
      kind: kind === 'WITHIN_TOLERANCE' ? 'within-tolerance' : kind === 'CLEAN' ? 'clean' : 'problem',
    });
    histories.set(supplier.name, [...previous, item]);
  }

  return {
    dataset: {
      id: 'three-way-match',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/three-way-match.js',
      context: {
        entity: 'Harbour Systems Ltd',
        reportingCurrency: 'USD',
        taxRatePercent: TAX_RATE,
        tolerances: { pricePercent: PRICE_TOLERANCE, quantityUnits: QUANTITY_TOLERANCE },
        supplierCount: suppliers.length,
      },
      items,
    },
    labels,
  };
}

function buildPlan(random) {
  const kinds = [];
  for (const [kind, count] of Object.entries(PROBLEM_COUNTS)) {
    if (kind !== 'DUPLICATE') kinds.push(...Array(count).fill(kind));
  }
  kinds.push(...Array(8).fill('WITHIN_TOLERANCE'), ...Array(108).fill('CLEAN'));
  const shuffled = random.shuffle(kinds);
  const duplicateAt = new Set([98, 123, 148]);
  const plan = Array.from({ length: 150 }, (_, index) => (duplicateAt.has(index) ? 'DUPLICATE' : shuffled.shift()));
  // Each duplicate repeats the immediately preceding packet for its round-robin supplier. Keep that
  // source packet clean so the duplicate is the only mismatch in the repeated documents.
  for (const sourceIndex of [58, 83, 108]) {
    if (plan[sourceIndex] === 'CLEAN') continue;
    const cleanIndex = plan.findIndex((kind, index) => kind === 'CLEAN' && ![58, 83, 108].includes(index));
    [plan[sourceIndex], plan[cleanIndex]] = [plan[cleanIndex], plan[sourceIndex]];
  }
  return plan;
}

function buildSuppliers(random) {
  const names = new Set();
  while (names.size < 40) names.add(merchantName(random));
  return [...names].sort().map((name) => ({
    name,
    paymentTerms: random.pick(PAYMENT_TERMS),
  }));
}

// #region demo:data
/** Builds the three source documents before a planted difference is applied. */
function freshPacket(random, supplier, index) {
  const [itemCode, description] = random.pick(PRODUCTS);
  const ordered = random.int(12, 120);
  const price = unitPrice(random, { min: 18, max: 420 });
  const freight = random.pick([0, 0, 25, 50, 75]);
  const poDate = addDays(START_DAY, index);
  const receiptDate = addDays(poDate, random.int(2, 8));
  const invoiceDate = addDays(receiptDate, random.int(0, 3));
  const currency = random.pick(CURRENCIES);
  const stem = String(index + 1).padStart(4, '0');
  const line = { itemCode, description, quantity: ordered, unitPrice: price };
  const invoiceLine = { itemCode, description, quantityBilled: ordered, unitPrice: price };
  const invoice = {
    id: `INV-${stem}`,
    date: invoiceDate,
    purchaseOrderId: `PO-${stem}`,
    goodsReceiptId: `GR-${stem}`,
    currency,
    lines: [invoiceLine],
    freight,
  };
  recalculate(invoice);
  return {
    purchaseOrder: { id: `PO-${stem}`, date: poDate, supplier: supplier.name, currency, incoterm: random.pick(INCOTERMS), lines: [line] },
    goodsReceipt: { id: `GR-${stem}`, purchaseOrderId: `PO-${stem}`, date: receiptDate, lines: [{ itemCode, quantityReceived: ordered, condition: 'accepted' }] },
    invoice,
  };
}
// #endregion

function applyDifference(packet, kind, occurrence, random) {
  const poLine = packet.purchaseOrder.lines[0];
  const receiptLine = packet.goodsReceipt.lines[0];
  const invoiceLine = packet.invoice.lines[0];
  if (kind === 'PRICE') invoiceLine.unitPrice = round(poLine.unitPrice * (1 + (occurrence === 0 ? 3 : random.float(2.6, 7.5, 1)) / 100));
  if (kind === 'QUANTITY') invoiceLine.quantityBilled = poLine.quantity + random.int(2, 7);
  if (kind === 'TAX') packet.invoice.taxOverride = round(percentOf(invoiceLine.quantityBilled * invoiceLine.unitPrice, TAX_RATE) + random.float(18, 190, 2));
  if (kind === 'CURRENCY') packet.invoice.currency = random.pick(['EUR', 'GBP', 'AED']);
  if (kind === 'PARTIAL_DELIVERY') receiptLine.quantityReceived = Math.max(1, poLine.quantity - random.int(2, Math.min(10, poLine.quantity - 1)));
  if (kind === 'WITHIN_TOLERANCE') {
    if (occurrence < 4) invoiceLine.unitPrice = round(poLine.unitPrice * (1 + (occurrence === 0 ? 1.4 : random.float(0.4, 1.9, 1)) / 100));
    else invoiceLine.quantityBilled = poLine.quantity + 1;
  }
  if (kind !== 'DUPLICATE') recalculate(packet.invoice);
}

function recalculate(invoice) {
  invoice.subtotal = round(invoice.lines.reduce((sum, line) => sum + line.quantityBilled * line.unitPrice, 0));
  invoice.tax = invoice.taxOverride ?? percentOf(invoice.subtotal, TAX_RATE);
  delete invoice.taxOverride;
  invoice.total = round(invoice.subtotal + invoice.tax + invoice.freight);
}

function duplicatePacket(source, index) {
  if (!source) throw new Error(`Duplicate packet at ${index} has no supplier history`);
  return structuredClone({ purchaseOrder: source.purchaseOrder, goodsReceipt: source.goodsReceipt, invoice: source.invoice });
}

function historyCopy(item) {
  return structuredClone({
    packetId: item.id,
    purchaseOrder: item.purchaseOrder,
    goodsReceipt: item.goodsReceipt,
    invoice: item.invoice,
  });
}

function riskFromDocuments(item, mismatch) {
  const po = item.purchaseOrder.lines[0];
  const receipt = item.goodsReceipt.lines[0];
  const invoice = item.invoice;
  const billed = invoice.lines[0];
  const withTax = (value) => round(value + percentOf(value, TAX_RATE));
  if (mismatch === 'PRICE') return withTax(Math.max(0, (billed.unitPrice - po.unitPrice) * billed.quantityBilled));
  if (mismatch === 'QUANTITY') return withTax(Math.max(0, billed.quantityBilled - po.quantity) * po.unitPrice);
  if (mismatch === 'TAX') return round(Math.abs(invoice.tax - percentOf(invoice.subtotal, TAX_RATE)));
  if (mismatch === 'CURRENCY' || mismatch === 'DUPLICATE') return invoice.total;
  if (mismatch === 'PARTIAL_DELIVERY') return withTax(Math.max(0, billed.quantityBilled - receipt.quantityReceived) * po.unitPrice);
  return 0;
}
