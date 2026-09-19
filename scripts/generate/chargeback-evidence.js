// One hundred and twenty illustrative chargeback packets. Evidence lives in the packet while the
// expected outcome, decisive missing document and operating lane are written to separate labels.

import { addDays, createRandom } from './lib/random.js';
import { amount, round } from './lib/money.js';
import { merchantName, personName } from './lib/names.js';

export const SEED = 1114;

const AS_OF = '2026-09-19';
const DOCUMENTS = ['DELIVERY_PROOF', 'AVS_CVV', 'TERMS_ACCEPTANCE', 'COMMS_LOG', 'REFUND_PROOF'];
const REASONS = ['FRAUD', 'PRODUCT_NOT_RECEIVED', 'PRODUCT_UNACCEPTABLE', 'SUBSCRIPTION_CANCELLED', 'DUPLICATE'];
const REASON_FOR_DOCUMENT = {
  DELIVERY_PROOF: 'PRODUCT_NOT_RECEIVED',
  AVS_CVV: 'FRAUD',
  TERMS_ACCEPTANCE: 'SUBSCRIPTION_CANCELLED',
  COMMS_LOG: 'PRODUCT_UNACCEPTABLE',
  REFUND_PROOF: 'DUPLICATE',
};
const REQUIREMENTS = {
  FRAUD: {
    claim: 'Cardholder says they did not authorise the purchase.',
    decisive: ['AVS_CVV'],
    supporting: ['TERMS_ACCEPTANCE', 'COMMS_LOG'],
    note: 'Illustrative rule: matched verification plus device or customer evidence supports authorisation.',
  },
  PRODUCT_NOT_RECEIVED: {
    claim: 'Cardholder says the order never arrived.',
    decisive: ['DELIVERY_PROOF'],
    supporting: ['COMMS_LOG'],
    note: 'Illustrative rule: dated tracking and delivery confirmation tied to the supplied address are required.',
  },
  PRODUCT_UNACCEPTABLE: {
    claim: 'Cardholder says the product was materially different or defective.',
    decisive: ['COMMS_LOG'],
    supporting: ['DELIVERY_PROOF', 'REFUND_PROOF'],
    note: 'Illustrative rule: the merchant should show the complaint, offered remedy and return or refund handling.',
  },
  SUBSCRIPTION_CANCELLED: {
    claim: 'Cardholder says a recurring payment continued after cancellation.',
    decisive: ['TERMS_ACCEPTANCE'],
    supporting: ['COMMS_LOG', 'REFUND_PROOF'],
    note: 'Illustrative rule: accepted renewal terms and a dated cancellation trail determine the response.',
  },
  DUPLICATE: {
    claim: 'Cardholder says the same order was charged twice.',
    decisive: ['REFUND_PROOF'],
    supporting: ['COMMS_LOG', 'AVS_CVV'],
    note: 'Illustrative rule: separate orders or a completed reversal must explain the second ledger entry.',
  },
};

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const plan = random.shuffle([
    ...Array(22).fill('STRONG'),
    ...Array(31).fill('ONE_DOCUMENT_AWAY'),
    ...Array(19).fill('HOPELESS'),
    ...Array(48).fill('MIXED'),
  ]);
  const occurrences = new Map();
  const items = [];
  const labels = [];

  for (let index = 0; index < plan.length; index++) {
    const kind = plan[index];
    const occurrence = occurrences.get(kind) ?? 0;
    occurrences.set(kind, occurrence + 1);
    const built = buildPacket(random, index, kind, occurrence);
    items.push(built.item);
    labels.push(built.label);
  }

  return {
    dataset: {
      id: 'chargeback-evidence',
      class: 'synthetic',
      generatedAt: AS_OF,
      seed,
      source: 'scripts/generate/chargeback-evidence.js',
      context: {
        asOf: AS_OF,
        currency: 'USD',
        documentCollectionDays: 3,
        networkRequirements: REQUIREMENTS,
        requirementsNotice: 'Illustrative training policy; card-network and acquirer rules differ in production.',
      },
      items,
    },
    labels,
  };
}

function buildPacket(random, index, kind, occurrence) {
  const missingDocument = kind === 'ONE_DOCUMENT_AWAY' ? DOCUMENTS[occurrence % DOCUMENTS.length] : null;
  const reasonCode = missingDocument ? REASON_FOR_DOCUMENT[missingDocument] : random.pick(REASONS);
  const mixedWin = kind === 'MIXED' && occurrence < 24;
  const outcome = kind === 'STRONG' || mixedWin ? 'WIN' : 'LOSS';
  const daysRemaining = kind === 'ONE_DOCUMENT_AWAY' ? random.int(4, 14) : random.int(0, 18);
  const deadlineRisk = daysRemaining < 3;
  const documents = makeDocuments(random, index);

  if (kind === 'STRONG') setPresence(documents, DOCUMENTS, true);
  if (kind === 'ONE_DOCUMENT_AWAY') {
    setPresence(documents, DOCUMENTS, true);
    setPresence(documents, [missingDocument], false);
  }
  if (kind === 'HOPELESS') {
    setPresence(documents, DOCUMENTS, false);
    setPresence(documents, random.sample(DOCUMENTS, random.int(0, 1)), true);
  }
  if (kind === 'MIXED') {
    const required = [...REQUIREMENTS[reasonCode].decisive, ...REQUIREMENTS[reasonCode].supporting];
    setPresence(documents, DOCUMENTS, false);
    if (mixedWin) setPresence(documents, [...required, ...random.sample(DOCUMENTS, 2)], true);
    else setPresence(documents, random.sample(DOCUMENTS.filter((document) => !required.includes(document)), 2), true);
  }

  const decisiveMissing = missingDocument ?? firstMissing(reasonCode, documents);
  const nextStep = kind === 'ONE_DOCUMENT_AWAY'
    ? 'GATHER_MORE'
    : outcome === 'WIN'
      ? 'SUBMIT'
      : kind === 'MIXED' && !deadlineRisk && decisiveMissing
        ? 'GATHER_MORE'
        : 'ACCEPT_LOSS';
  const packetId = `CB-${String(index + 1).padStart(4, '0')}`;
  const orderDate = random.day('2026-05-01', '2026-08-20');
  const openedAt = addDays(AS_OF, -random.int(3, 24));
  const disputeAmount = amount(random, { min: 24, max: 2400, skew: 1.8 });

  // #region demo:data
  const item = {
    id: packetId,
    order: {
      id: `ORD-${String(index + 1).padStart(5, '0')}`,
      placedAt: `${orderDate}T${String(random.int(8, 22)).padStart(2, '0')}:15:00Z`,
      merchant: merchantName(random),
      customer: personName(random),
      amount: disputeAmount,
      currency: 'USD',
      paymentMethod: random.pick(['VISA_CREDIT', 'MASTERCARD_DEBIT', 'VISA_DEBIT']),
      billingCountry: random.pick(['AE', 'EG', 'GB', 'US']),
      shippingCountry: random.pick(['AE', 'EG', 'GB', 'US']),
    },
    dispute: {
      reasonCode,
      customerClaim: REQUIREMENTS[reasonCode].claim,
      openedAt,
      responseDeadline: addDays(AS_OF, daysRemaining),
      amount: disputeAmount,
      currency: 'USD',
    },
    evidence: documents,
    transactionSignals: {
      deviceMatchesPriorOrders: random.bool(kind === 'STRONG' ? 0.9 : 0.55),
      ipCountryMatchesBilling: random.bool(kind === 'STRONG' ? 0.92 : 0.62),
      priorSuccessfulOrders: random.int(0, 18),
      priorChargebacks: random.int(0, kind === 'HOPELESS' ? 3 : 1),
    },
  };
  // #endregion

  return {
    item,
    label: {
      packetId,
      outcome,
      missingDocument: decisiveMissing ?? 'NONE',
      nextStep,
      deadlineRisk,
      kind: kind.toLowerCase().replaceAll('_', '-'),
      flipsWithDocument: kind === 'ONE_DOCUMENT_AWAY',
    },
  };
}

function makeDocuments(random, index) {
  const stem = String(index + 1).padStart(4, '0');
  return {
    AVS_CVV: { present: false, avsResult: 'MATCH', cvvResult: 'MATCH', checkedAt: `2026-07-${String((index % 27) + 1).padStart(2, '0')}T12:10:00Z` },
    DELIVERY_PROOF: { present: false, trackingNumber: `TRK-${stem}`, deliveredAt: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T14:20:00Z`, signedBy: personName(random), gpsAddressMatch: true },
    TERMS_ACCEPTANCE: { present: false, acceptedAt: `2026-06-${String((index % 27) + 1).padStart(2, '0')}T09:30:00Z`, version: '2026.2', sourceIp: `198.51.100.${(index % 200) + 1}` },
    COMMS_LOG: { present: false, messages: [{ at: '2026-08-22T10:00:00Z', channel: 'EMAIL', summary: 'Merchant offered troubleshooting, return or delivery follow-up.' }] },
    REFUND_PROOF: { present: false, status: 'PROCESSED', amount: round(random.float(20, 700, 2)), processedAt: '2026-09-02T11:45:00Z', acquirerReference: `ARN-${stem}` },
  };
}

function setPresence(documents, names, present) {
  for (const name of names) documents[name].present = present;
}

function firstMissing(reasonCode, documents) {
  const ordered = [...REQUIREMENTS[reasonCode].decisive, ...REQUIREMENTS[reasonCode].supporting];
  return ordered.find((document) => !documents[document].present) ?? null;
}
