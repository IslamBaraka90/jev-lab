// Four hundred card and bank expenses waiting to be posted to a chart of accounts. Most are obvious
// from the vendor; some are only decidable from the memo, some have no memo at all, and a few are
// refunds. The intended account for each one goes to data/synthetic/expense-posting.labels.json,
// outside the demo folder, so a state builder cannot read it.

import { createRandom } from './lib/random.js';
import { merchantName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1103;

const PERIOD = { from: '2026-04-01', to: '2026-06-30' };

const ACCOUNTS = [
  { code: '5200', name: 'Software subscriptions', definition: 'Recurring software, licences and cloud services.' },
  { code: '5500', name: 'Travel', definition: 'Flights, hotels, rail and taxis for staff travelling on business.' },
  { code: '5510', name: 'Meals and entertainment', definition: 'Hospitality: meals with clients, team dinners, events for guests.' },
  { code: '5100', name: 'Office supplies', definition: 'Consumables and small items for the office: stationery, kitchen, cleaning.' },
  { code: '5700', name: 'Marketing', definition: 'Advertising, sponsorship, printed promotion and event stands.' },
  { code: '5600', name: 'Professional fees', definition: 'Legal, accounting, recruitment and consultancy invoices.' },
  { code: '6000', name: 'Bank charges', definition: 'Account fees, card fees and foreign exchange charges.' },
  { code: '5800', name: 'Utilities', definition: 'Electricity, water, internet and phone for the premises.' },
  { code: '1500', name: 'Hardware', definition: 'Equipment kept for more than a year and over the 500 capitalisation threshold.' },
  { code: '5900', name: 'Training', definition: 'Courses, certifications, conference tickets and books for staff.' },
  { code: '5300', name: 'Shipping', definition: 'Couriers, postage and freight.' },
  { code: '5400', name: 'Fuel', definition: 'Fuel and mileage for company vehicles.' },
];

/** What each account's vendors sell, so memos and amounts fit the account they belong to. */
const KINDS = {
  '5200': { suffix: ['Cloud', 'Software', 'Systems'], memos: ['Monthly subscription, {n} seats', 'Annual licence renewal', 'Team plan, monthly'], range: [18, 900] },
  '5500': { suffix: ['Travel', 'Airways', 'Rail'], memos: ['Return flight for {name}', 'Hotel, {n} nights, {name}', 'Airport transfer'], range: [40, 1800] },
  '5510': { suffix: ['Kitchen', 'Bistro', 'Catering'], memos: ['Client lunch, {n} covers', 'Dinner with {name}', 'Team dinner after release'], range: [25, 900] },
  '5100': { suffix: ['Supplies', 'Stationers', 'Store'], memos: ['Paper and toner', 'Kitchen supplies', 'Desk accessories'], range: [8, 400] },
  '5700': { suffix: ['Media', 'Agency', 'Studios'], memos: ['Campaign, week {n}', 'Sponsored listing', 'Exhibition stand deposit'], range: [120, 6000] },
  '5600': { suffix: ['Partners', 'Legal', 'Advisory'], memos: ['Advice on supplier contract', 'Quarterly bookkeeping', 'Recruitment fee, {name}'], range: [200, 7000] },
  '6000': { suffix: ['Bank', 'Payments'], memos: ['Account maintenance', 'Card scheme fee', 'Foreign exchange charge'], range: [3, 120] },
  '5800': { suffix: ['Energy', 'Utilities', 'Telecom'], memos: ['Electricity, {n} kWh', 'Office broadband', 'Mobile plan, {n} lines'], range: [40, 1400] },
  '1500': { suffix: ['Hardware', 'Computers', 'Electronics'], memos: ['Laptop for {name}', 'Two monitors and a dock', 'Server disk upgrade'], range: [520, 4200] },
  '5900': { suffix: ['Academy', 'Institute', 'Press'], memos: ['Course for {name}', 'Conference ticket', 'Certification exam'], range: [40, 2500] },
  '5300': { suffix: ['Logistics', 'Courier', 'Freight'], memos: ['Courier, {n} parcels', 'Postage top-up', 'Pallet to warehouse'], range: [6, 700] },
  '5400': { suffix: ['Fuels', 'Station', 'Energy'], memos: ['Fuel, van {n}', 'Fuel card, weekly', 'Diesel, long run'], range: [30, 260] },
};

/** Vendors that genuinely sell into two accounts; only the memo says which one a charge belongs to. */
const AMBIGUOUS = [
  { suffix: 'Hotel', accounts: ['5500', '5510'], memos: { '5500': ['Hotel, {n} nights, {name}', 'Room for {name}, client visit'], '5510': ['Dinner in the hotel with {name}', 'Client hospitality, private room'] } },
  { suffix: 'Print', accounts: ['5700', '5100'], memos: { '5700': ['Campaign leaflets, {n} thousand', 'Exhibition banners'], '5100': ['Headed paper and envelopes', 'Printer toner refill'] } },
  { suffix: 'Books', accounts: ['5900', '5100'], memos: { '5900': ['Reference books for the team', 'Certification study pack'], '5100': ['Notebooks and pens', 'Wall planner and folders'] } },
  { suffix: 'Depot', accounts: ['5300', '5100'], memos: { '5300': ['Courier account top-up', 'Overnight delivery, {n} parcels'], '5100': ['Packing tape and boxes', 'Shelving for the store room'] } },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const staff = ['A. Halabi', 'N. Farouk', 'S. Mansour', 'R. Aziz', 'M. Haddad', 'T. Nasser'];
  const vendors = buildVendors(random);
  const items = [];
  const labels = [];

  // 335 ordinary expenses: the vendor says which account, and the memo agrees.
  for (let index = 0; index < 335; index++) ordinary(random, vendors, staff, items, labels);
  // 30 from vendors that sell into two accounts: only the memo decides.
  for (let index = 0; index < 30; index++) ambiguous(random, vendors, staff, items, labels);
  // 20 with no memo at all: the vendor and the amount are all there is.
  for (let index = 0; index < 20; index++) ordinary(random, vendors, staff, items, labels, { memo: '' });
  // 15 refunds, posted back to the account they came from.
  for (let index = 0; index < 15; index++) ordinary(random, vendors, staff, items, labels, { refund: true });

  items.sort((a, b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor));
  items.forEach((item, index) => {
    const id = `E-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).expenseId = id;
    item.id = id;
  });
  attachHistory(items, labels);
  for (const item of items) {
    delete item.key;
    delete item.account;
  }
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'expense-posting',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/expense-posting.js',
      context: {
        entity: 'Harbour Systems Ltd',
        country: 'United Arab Emirates',
        currency: 'AED',
        vatRatePercent: 5,
        receiptThreshold: 200,
        capitalisationThreshold: 500,
        accounts: ACCOUNTS,
        // No vendor-to-account map on purpose: that would hand over the answer for most of the file.
        // What a bookkeeper actually has is where this vendor's last few charges went, and that sits
        // on each expense as priorPostings.
      },
      items,
    },
    labels,
  };
}

/**
 * Where this vendor's earlier charges were posted, up to three, oldest first. A bookkeeping system
 * knows this, so the state may show it; for a vendor that sells into two accounts the history is mixed
 * and settles nothing, which is the point of those thirty lines.
 */
function attachHistory(items, labels) {
  const posted = new Map();
  for (const item of items) {
    const account = labels.find((label) => label.key === item.key).account;
    const history = posted.get(item.vendor) ?? [];
    item.priorPostings = history.slice(-3).map((entry) => ({ ...entry }));
    posted.set(item.vendor, [...history, { date: item.date, amount: item.amount, account }]);
  }
}

/** Three to five vendors per account, plus the vendors that sell into two of them. */
function buildVendors(random) {
  const vendors = [];
  for (const account of ACCOUNTS) {
    const count = random.int(3, 5);
    for (let index = 0; index < count; index++) {
      const base = merchantName(random).split(' ')[0];
      vendors.push({ name: `${base} ${random.pick(KINDS[account.code].suffix)}`, account });
    }
  }
  for (const entry of AMBIGUOUS) {
    for (let index = 0; index < 2; index++) {
      const base = merchantName(random).split(' ')[0];
      vendors.push({ name: `${base} ${entry.suffix}`, ambiguous: entry, account: null });
    }
  }
  return vendors;
}

// #region demo:data
/** One expense: a vendor, a date, an amount, a memo of varying usefulness, and how it was paid. */
function expense(random, { vendor, memo, value, refund = false }) {
  const date = random.day(PERIOD.from, PERIOD.to);
  const method = random.weighted([['card', 72], ['direct debit', 16], ['bank transfer', 12]]);

  return {
    key: `${vendor}-${date}-${value}-${random.int(1000, 9999)}`,
    id: null,
    date,
    vendor,
    description: memo,
    amount: refund ? round(-value) : round(value),
    currency: 'AED',
    paymentMethod: method,
    card: method === 'card' ? `**** ${random.int(1000, 9999)}` : null,
    reference: `TX-${random.int(100_000, 999_999)}`,
    isRefund: refund,
    priorPostings: [],
  };
}
// #endregion

function ordinary(random, vendors, staff, items, labels, { memo, refund = false } = {}) {
  const vendor = random.pick(vendors.filter((entry) => !entry.ambiguous));
  const kind = KINDS[vendor.account.code];
  const text = memo === '' ? '' : fill(random, random.pick(kind.memos), staff);
  const value = amount(random, { min: kind.range[0], max: kind.range[1] });
  const item = expense(random, { vendor: vendor.name, memo: text, value, refund });

  items.push(item);
  labels.push({
    key: item.key,
    account: vendor.account.code,
    kind: refund ? 'refund' : text === '' ? 'no-memo' : 'clear',
    note: refund ? 'A refund goes back to the account the original charge used' : undefined,
  });
}

function ambiguous(random, vendors, staff, items, labels) {
  const vendor = random.pick(vendors.filter((entry) => entry.ambiguous));
  const account = random.pick(vendor.ambiguous.accounts);
  const text = fill(random, random.pick(vendor.ambiguous.memos[account]), staff);
  const range = KINDS[account].range;
  const item = expense(random, { vendor: vendor.name, memo: text, value: amount(random, { min: range[0], max: range[1] }) });

  items.push(item);
  labels.push({ key: item.key, account, kind: 'ambiguous', note: `${vendor.name} sells into ${vendor.ambiguous.accounts.join(' and ')}; the memo decides` });
}

function fill(random, template, staff) {
  return template.replace('{n}', random.int(2, 40)).replace('{name}', random.pick(staff));
}
