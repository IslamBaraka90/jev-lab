// One month of a small company's general ledger, with eleven problems planted on purpose and the rest
// of it ordinary. The planted list goes to data/synthetic/ledger-integrity.labels.json, outside the
// demo folder, so nothing in demos/ can read it into a state.

import { createRandom, addDays, nextWorkday } from './lib/random.js';
import { merchantName, personName } from './lib/names.js';
import { amount, percentOf, round } from './lib/money.js';

export const SEED = 1101;

const PERIOD = { from: '2026-05-01', to: '2026-05-31' };
const CURRENCY = 'USD';
const VAT_RATE = 5;

const ACCOUNTS = [
  { code: '1000', name: 'Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Prepayments', type: 'asset', normalBalance: 'debit' },
  { code: '1500', name: 'Equipment', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts payable', type: 'liability', normalBalance: 'credit' },
  { code: '2200', name: 'VAT payable', type: 'liability', normalBalance: 'credit' },
  { code: '4000', name: 'Revenue', type: 'income', normalBalance: 'credit' },
  { code: '5100', name: 'Office supplies', type: 'expense', normalBalance: 'debit' },
  { code: '5200', name: 'Software subscriptions', type: 'expense', normalBalance: 'debit' },
  { code: '5300', name: 'Salaries', type: 'expense', normalBalance: 'debit' },
  { code: '5400', name: 'Rent', type: 'expense', normalBalance: 'debit' },
  { code: '5500', name: 'Travel', type: 'expense', normalBalance: 'debit' },
  { code: '5600', name: 'Professional fees', type: 'expense', normalBalance: 'debit' },
  { code: '6000', name: 'Bank charges', type: 'expense', normalBalance: 'debit' },
  { code: '7000', name: 'Owner draws', type: 'equity', normalBalance: 'debit' },
];

const account = (code) => ACCOUNTS.find((entry) => entry.code === code);
const EXPENSE_CODES = ['5100', '5200', '5400', '5500', '5600'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const entity = `${merchantName(random)} Ltd`;
  const clerks = Array.from({ length: 4 }, () => personName(random));
  const suppliers = Array.from({ length: 22 }, () => merchantName(random));
  const customers = Array.from({ length: 14 }, () => merchantName(random));

  const state = { random, clerks, suppliers, customers, lines: [], documents: 0 };
  const labels = [];

  // Ordinary month: purchases and their payments, sales and their receipts, payroll, rent and fees.
  for (let i = 0; i < 68; i++) purchase(state);
  for (let i = 0; i < 46; i++) payment(state);
  for (let i = 0; i < 41; i++) sale(state);
  for (let i = 0; i < 26; i++) receipt(state);
  for (let i = 0; i < 4; i++) payroll(state);
  monthly(state, '5400', 'Office rent for May');
  for (let i = 0; i < 6; i++) bankCharge(state);

  plant(state, labels);

  // Documents are entered through the month, so the file reads in posting order.
  state.lines.sort((a, b) => a.postedAt.localeCompare(b.postedAt) || a.id.localeCompare(b.id));
  state.lines.forEach((line, index) => {
    line.id = `L-${String(index + 1).padStart(4, '0')}`;
  });
  for (const label of labels) label.lineId = state.lines.find((line) => line.key === label.key).id;
  for (const line of state.lines) delete line.key;

  return {
    dataset: {
      id: 'ledger-integrity',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/ledger-integrity.js',
      context: { entity, currency: CURRENCY, period: PERIOD, vatRatePercent: VAT_RATE, accounts: ACCOUNTS, clerks },
      items: state.lines,
    },
    labels,
  };
}

// #region demo:data
/** One posting: a document of two or three lines that balances, in the period, entered by a clerk. */
function document(state, { date, memo, lines }) {
  const { random } = state;
  const id = `DOC-${String(++state.documents).padStart(4, '0')}`;
  const postedAt = random.timeOnDay(nextWorkday(date));
  const postedBy = random.pick(state.clerks);

  for (const [index, line] of lines.entries()) {
    state.lines.push({
      key: `${id}-${index + 1}`,
      id: `${id}-${index + 1}`,
      documentId: id,
      date,
      account: line.code,
      accountName: account(line.code).name,
      accountType: account(line.code).type,
      normalBalance: account(line.code).normalBalance,
      debit: round(line.debit ?? 0),
      credit: round(line.credit ?? 0),
      currency: CURRENCY,
      memo: line.memo ?? memo,
      counterparty: line.counterparty ?? null,
      reference: `${id}/${index + 1}`,
      postedBy,
      postedAt,
    });
  }
  return id;
}
// #endregion

function purchase(state) {
  const { random } = state;
  const supplier = random.pick(state.suppliers);
  const code = random.weighted([['5200', 26], ['5100', 22], ['5500', 18], ['5600', 14], ['1500', 8], ['5400', 6], ['1200', 6]]);
  const net = amount(random, { min: 45, max: 4200 });
  const vat = percentOf(net, VAT_RATE);
  const date = random.day(PERIOD.from, PERIOD.to);

  document(state, {
    date,
    memo: `${supplier} invoice`,
    lines: [
      { code, debit: net, counterparty: supplier },
      { code: '2200', debit: vat, memo: `VAT on ${supplier} invoice` },
      { code: '2000', credit: round(net + vat), counterparty: supplier, memo: `${supplier} payable` },
    ],
  });
}

function payment(state) {
  const { random } = state;
  const supplier = random.pick(state.suppliers);
  const value = amount(random, { min: 120, max: 5200, roundTo: 'natural' });
  const date = random.day(PERIOD.from, PERIOD.to);

  document(state, {
    date,
    memo: `Payment to ${supplier}`,
    lines: [
      { code: '2000', debit: value, counterparty: supplier },
      { code: '1000', credit: value, counterparty: supplier },
    ],
  });
}

function sale(state) {
  const { random } = state;
  const customer = random.pick(state.customers);
  const net = amount(random, { min: 300, max: 12_000, skew: 2 });
  const vat = percentOf(net, VAT_RATE);
  const date = random.day(PERIOD.from, PERIOD.to);

  document(state, {
    date,
    memo: `Invoice to ${customer}`,
    lines: [
      { code: '1100', debit: round(net + vat), counterparty: customer },
      { code: '4000', credit: net, counterparty: customer },
      { code: '2200', credit: vat, memo: `VAT on invoice to ${customer}` },
    ],
  });
}

function receipt(state) {
  const { random } = state;
  const customer = random.pick(state.customers);
  const value = amount(random, { min: 400, max: 11_000, skew: 2 });
  const date = random.day(PERIOD.from, PERIOD.to);

  document(state, {
    date,
    memo: `Receipt from ${customer}`,
    lines: [
      { code: '1000', debit: value, counterparty: customer },
      { code: '1100', credit: value, counterparty: customer },
    ],
  });
}

function payroll(state) {
  const { random } = state;
  const value = amount(random, { min: 8000, max: 14_000, skew: 1.2, roundTo: 'hundred' });
  document(state, {
    date: random.day('2026-05-25', PERIOD.to),
    memo: 'Payroll for May',
    lines: [
      { code: '5300', debit: value },
      { code: '1000', credit: value },
    ],
  });
}

function monthly(state, code, memo) {
  const value = amount(state.random, { min: 4500, max: 6500, roundTo: 'hundred' });
  document(state, { date: '2026-05-01', memo, lines: [{ code, debit: value }, { code: '1000', credit: value }] });
}

function bankCharge(state) {
  const value = state.random.float(6, 48, 2);
  document(state, {
    date: state.random.day(PERIOD.from, PERIOD.to),
    memo: 'Bank charges',
    lines: [{ code: '6000', debit: value }, { code: '1000', credit: value }],
  });
}

/**
 * The eleven problems a reviewer is meant to find, plus three lines that look wrong and are not.
 * Every affected line is labelled; a problem that spans two lines carries one problem id.
 */
function plant(state, labels) {
  const { random } = state;
  const mark = (line, issue, problemId, note) => {
    labels.push({ key: line.key, problemId, issue, note });
    return line;
  };
  const documentsOf = (id) => state.lines.filter((line) => line.documentId === id);
  const pickDocument = (test) => {
    const ids = [...new Set(state.lines.filter(test).map((line) => line.documentId))];
    return documentsOf(random.pick(ids));
  };

  // 1-2. Two payments posted a second time, days later, with a new document number.
  for (let index = 1; index <= 2; index++) {
    const original = pickDocument((line) => line.memo.startsWith('Payment to') && line.debit > 400);
    const copyDate = addDays(original[0].date, random.int(2, 6));
    const id = document(state, {
      date: copyDate > PERIOD.to ? original[0].date : copyDate,
      memo: original[0].memo,
      lines: original.map((line) => ({ code: line.account, debit: line.debit, credit: line.credit, counterparty: line.counterparty, memo: line.memo })),
    });
    for (const line of documentsOf(id)) mark(line, 'DUPLICATE_POSTING', `dup-${index}`, `Repeats ${original[0].documentId}, same supplier and amount`);
  }

  // 3-4. Two expenses posted on the wrong side, so their documents no longer balance.
  for (let index = 1; index <= 2; index++) {
    const line = random.pick(state.lines.filter((entry) => EXPENSE_CODES.includes(entry.account) && entry.debit > 100 && !labels.some((label) => label.key === entry.key)));
    line.credit = line.debit;
    line.debit = 0;
    mark(line, 'REVERSED_SIGN', `sign-${index}`, 'Expense posted as a credit; the document no longer balances');
  }

  // 5-6. Two documents lose their bank side, so nothing pays for them.
  for (let index = 1; index <= 2; index++) {
    const lines = pickDocument((line) => line.memo.startsWith('Receipt from'));
    const orphan = lines.find((line) => line.account === '1100');
    const bankLine = lines.find((line) => line.account === '1000');
    state.lines.splice(state.lines.indexOf(bankLine), 1);
    mark(orphan, 'MISSING_COUNTER_ENTRY', `orphan-${index}`, 'The bank side of this receipt was never posted');
  }

  // 7-8. Two invoices dated outside the month they were posted in.
  for (const [index, day] of ['2026-04-27', '2026-06-03'].entries()) {
    const line = random.pick(state.lines.filter((entry) => entry.account === '5200' && !labels.some((label) => label.key === entry.key)));
    for (const sibling of state.lines.filter((entry) => entry.documentId === line.documentId)) sibling.date = day;
    mark(line, 'PERIOD_CUTOFF', `cutoff-${index + 1}`, `Dated ${day}, outside the May period it was posted in`);
  }

  // 9-11. Three postings in the wrong account: capex as supplies, a draw as salary, rent as travel.
  const misclassified = [
    { from: '5100', to: '1500', memo: 'Laptop and docking station', note: 'Equipment bought outright, posted to office supplies' },
    { from: '5300', to: '7000', memo: 'Transfer to owner', note: 'Owner draw posted as salary expense' },
    { from: '5500', to: '5400', memo: 'Office rent, second floor', note: 'Rent posted as travel' },
  ];
  misclassified.forEach((change, index) => {
    const line = random.pick(state.lines.filter((entry) => entry.account === change.from && !labels.some((label) => label.key === entry.key)));
    line.memo = change.memo;
    if (line.counterparty && change.to === '7000') line.counterparty = null;
    mark(line, 'MISCLASSIFIED_ACCOUNT', `class-${index + 1}`, change.note);
  });

  // Three lines that look wrong to a rule and are perfectly correct: a reversal, a round payment and a
  // prepayment. They carry no label, and notes.md names them so the demo can show them.
  const reversal = pickDocument((line) => line.memo.startsWith('Invoice to'));
  document(state, {
    date: addDays(reversal[0].date, 2),
    memo: `Credit note reversing ${reversal[0].documentId}`,
    lines: reversal.map((line) => ({ code: line.account, debit: line.credit, credit: line.debit, counterparty: line.counterparty, memo: `Reversal: ${line.memo}` })),
  });
  document(state, {
    date: '2026-05-18',
    memo: 'Payment to landlord, agreed round figure',
    lines: [{ code: '2000', debit: 25_000 }, { code: '1000', credit: 25_000 }],
  });
  document(state, {
    date: '2026-05-06',
    memo: 'Annual insurance paid in advance',
    lines: [{ code: '1200', debit: 18_000, counterparty: 'Continental Insurance' }, { code: '1000', credit: 18_000 }],
  });
}
