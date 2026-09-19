// Expense posting: put each uncategorised charge in the right account, and automate only the share you
// can defend. The intended account is planted outside this folder and used only to grade the run.

import { choice, noul, score } from '../lib/questions.js';

const AUTO_THRESHOLD = 0.7;
const money = (item) => `${item.amount < 0 ? '−' : ''}${Math.abs(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${item.currency}`;

// #region demo:state
/** What the model sees for one expense: the charge, the chart of accounts, and this vendor's history. */
function buildState(item, context) {
  return {
    task: 'Post one card or bank expense to the right account in the chart of accounts.',
    company: {
      name: context.entity,
      country: context.country,
      currency: context.currency,
      vat_rate_percent: context.vatRatePercent,
      receipt_required_above: context.receiptThreshold,
      capitalise_above: context.capitalisationThreshold,
    },
    expense: {
      id: item.id,
      date: item.date,
      vendor: item.vendor,
      description: item.description || '(no description on the transaction)',
      amount: item.amount,
      currency: item.currency,
      payment_method: item.paymentMethod,
      card: item.card,
      reference: item.reference,
      is_refund: item.isRefund,
    },
    vendor_history: item.priorPostings.length
      ? item.priorPostings.map((posting) => `${posting.date}: ${posting.amount} posted to ${posting.account} ${accountName(context, posting.account)}`)
      : 'No earlier charge from this vendor.',
    chart_of_accounts: context.accounts.map((account) => `${account.code} ${account.name}: ${account.definition}`),
  };
}
// #endregion

const accountName = (context, code) => context.accounts.find((account) => account.code === code)?.name ?? code;

// #region demo:questions
const questions = {
  account: choice(
    'Which account should this expense be posted to?',
    Object.fromEntries(
      [
        ['5200', 'Software subscriptions: recurring software, licences and cloud services.'],
        ['5500', 'Travel: flights, hotels, rail and taxis for staff travelling on business.'],
        ['5510', 'Meals and entertainment: hospitality, client meals, team dinners.'],
        ['5100', 'Office supplies: consumables and small items for the office.'],
        ['5700', 'Marketing: advertising, sponsorship, printed promotion, event stands.'],
        ['5600', 'Professional fees: legal, accounting, recruitment, consultancy.'],
        ['6000', 'Bank charges: account fees, card fees, foreign exchange charges.'],
        ['5800', 'Utilities: electricity, water, internet and phone for the premises.'],
        ['1500', 'Hardware: equipment kept over a year and above the capitalisation threshold.'],
        ['5900', 'Training: courses, certifications, conference tickets, books for staff.'],
        ['5300', 'Shipping: couriers, postage and freight.'],
        ['5400', 'Fuel: fuel and mileage for company vehicles.'],
      ].map(([code, definition]) => [`ACCOUNT_${code}`, definition]),
    ),
  ),
  receipt_required: noul('Does this charge need a receipt on file, under the company rule given in the state?'),
  vat_treatment: choice('How should VAT on this charge be treated?', {
    STANDARD: 'Standard-rated: VAT was charged and can be reclaimed.',
    ZERO_RATED: 'Zero-rated supply.',
    EXEMPT: 'Exempt from VAT.',
    OUT_OF_SCOPE: 'Outside the scope of VAT, such as a bank charge or a payment to an unregistered supplier.',
  }),
  posting_clarity: score('How clearly does this charge say where it belongs?', [
    'Unreadable',
    'Very unclear',
    'Unclear',
    'Workable',
    'Clear',
    'Very clear',
    'Unambiguous',
  ]),
};
// #endregion

// #region demo:evaluate
/** The posting the page shows, and whether it is confident enough to go through without a person. */
function evaluate(answers, item, context) {
  const code = answers.account.choice.replace('ACCOUNT_', '');
  const confidence = answers.account.confidence;

  return {
    account: code,
    accountName: accountName(context, code),
    confidence,
    autoPost: confidence >= AUTO_THRESHOLD,
    receiptRequired: answers.receipt_required.noul >= 0.5,
    vat: answers.vat_treatment.choice,
    clarity: answers.posting_clarity.score,
    label: `${item.id}: ${accountName(context, code)}`,
  };
}
// #endregion

const ACCOUNT_CODES = ['5200', '5500', '5510', '5100', '5700', '5600', '6000', '5800', '1500', '5900', '5300', '5400'];
const KINDS = [
  { id: 'clear', label: 'Vendor and memo agree' },
  { id: 'ambiguous', label: 'Vendor sells into two accounts' },
  { id: 'no-memo', label: 'No description at all' },
  { id: 'refund', label: 'Refunds' },
];

// #region demo:report
/** Accuracy against the intended account, and what automation costs at each confidence threshold. */
function report(results, { labels = [], accounts = [] } = {}) {
  const intended = new Map(labels.map((label) => [label.expenseId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const correct = (result) => intended.get(result.item.id).account === result.evaluation.account;
  const auto = graded.filter((result) => result.evaluation.autoPost);

  return {
    note: `Graded against the account each expense was meant for. At ${Math.round(AUTO_THRESHOLD * 100)}% confidence, ${auto.length} of ${graded.length} post without a person.`,
    findings: confusions(graded, intended, accounts),
    kpis: headline(graded, auto, correct),
    distribution: chosenAccounts(graded, accounts),
    matrix: confusion(graded, intended, accounts),
    curve: coverage(graded, intended),
    checks: KINDS.map((kind) => difficulty(kind, graded, intended, correct)),
    topItems: leastClear(graded),
  };
}
// #endregion

/** The four numbers at the top: how much was posted, how much was right, and what that costs. */
function headline(graded, auto, correct) {
  const right = graded.filter(correct);
  const autoRight = auto.filter(correct);
  // 399 of 400 is not 100%. A rate only shows as a whole number when it really is one.
  const share = (part, whole) => {
    if (!whole) return '–';
    const percent = (part / whole) * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
  };

  return [
    { label: 'Expenses posted', value: graded.length },
    { label: 'Accuracy', value: share(right.length, graded.length), context: `${right.length} of ${graded.length} in the intended account` },
    { label: 'Posted automatically', value: share(auto.length, graded.length), context: `${auto.length} at ${Math.round(AUTO_THRESHOLD * 100)}% confidence or more` },
    {
      label: 'Accuracy when automatic',
      value: share(autoRight.length, auto.length),
      tone: autoRight.length === auto.length ? 'good' : 'warn',
      context: `${auto.length - autoRight.length} wrong postings would go through`,
    },
  ];
}

/** Accuracy split by how hard the expense was: clear, ambiguous, memo-free, refund. */
function difficulty(kind, graded, intended, correct) {
  const group = graded.filter((result) => intended.get(result.item.id).kind === kind.id);
  const wrong = group.filter((result) => !correct(result));
  return {
    id: kind.id,
    label: `${kind.label}: wrong postings`,
    detail: `${group.length - wrong.length} of ${group.length} correct.`,
    count: wrong.length,
    of: group.length,
    items: wrong.map((result) => result.item.id),
  };
}

function chosenAccounts(graded, accounts) {
  return ACCOUNT_CODES.map((code) => ({
    label: accounts.find((account) => account.code === code)?.name ?? code,
    count: graded.filter((result) => result.evaluation.account === code).length,
  })).filter((entry) => entry.count > 0);
}

function leastClear(graded) {
  return [...graded]
    .sort((a, b) => a.evaluation.clarity - b.evaluation.clarity)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: `${result.item.vendor} · ${money(result.item)} → ${result.evaluation.accountName}`, value: result.evaluation.clarity.toFixed(1) }));
}

/** The pair of accounts the model mixes up most, which is usually a real overlap rather than a slip. */
function confusions(graded, intended, accounts) {
  const wrong = graded.filter((result) => intended.get(result.item.id).account !== result.evaluation.account);
  if (wrong.length < 4) return [];

  const pairs = new Map();
  for (const result of wrong) {
    const key = `${intended.get(result.item.id).account}→${result.evaluation.account}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...pairs].sort((a, b) => b[1] - a[1])[0];
  const [from, to] = pair.split('→');
  const name = (code) => accounts.find((account) => account.code === code)?.name ?? code;
  return [
    `${count} of the ${wrong.length} wrong postings are the same swap: ${name(from)} posted as ${name(to)}. One repeated pair is a question about where the boundary sits, not a series of separate mistakes.`,
  ];
}

function confusion(graded, intended, accounts) {
  const short = (code) => (accounts.find((account) => account.code === code)?.name ?? code).split(' ')[0];
  return {
    title: 'Intended account against the one chosen',
    columns: ACCOUNT_CODES.map(short),
    rows: ACCOUNT_CODES.map((actual) => ({
      label: short(actual),
      cells: ACCOUNT_CODES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => intended.get(result.item.id).account === actual && result.evaluation.account === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

/** Automation against correctness: how much goes through, and how much of that is right. */
function coverage(graded, intended) {
  const points = [];
  for (let threshold = 0; threshold <= 0.9; threshold += 0.1) {
    const auto = graded.filter((result) => result.evaluation.confidence >= threshold);
    const right = auto.filter((result) => intended.get(result.item.id).account === result.evaluation.account);
    points.push({
      threshold: Number(threshold.toFixed(1)),
      reviewed: auto.length,
      caught: right.length,
      rate: auto.length ? right.length / auto.length : null,
    });
  }
  return { title: 'Confidence threshold', xLabel: 'Expenses posted automatically', yLabel: 'Correct among them', rateLabel: 'Accuracy', of: graded.length, points };
}

export default {
  id: 'expense-posting',
  title: 'Expense posting',
  domain: 'books',
  value: 'Post every uncategorised expense to the right account, and automate only the share you can defend.',
  tags: ['bookkeeping', 'classification', 'automation', 'accounts payable'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.vendor}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/expense-posting.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/expense-posting.js#demo:data',
    state: 'demos/expense-posting/demo.js#demo:state',
    questions: 'demos/expense-posting/demo.js#demo:questions',
    evaluate: 'demos/expense-posting/demo.js#demo:evaluate',
  },
};
