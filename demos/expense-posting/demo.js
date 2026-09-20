// Expense posting: put each uncategorised charge in the right account, and automate only the share you
// can defend. The intended account is planted outside this folder and used only to grade the run.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

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
  const matrix = confusion(graded, intended, accounts);
  const comparison = alternatives(graded, intended, correct, accounts);

  return {
    note: `Graded against the account each expense was meant for. At ${Math.round(AUTO_THRESHOLD * 100)}% confidence, ${auto.length} of ${graded.length} post without a person.`,
    findings: [...confusions(graded, intended, accounts), ...comparison.findings],
    kpis: headline(graded, auto, correct),
    baselines: comparison.baselines,
    metrics: metrics(graded, auto, correct, matrix),
    distribution: chosenAccounts(graded, accounts),
    distributionTitle: 'Accounts posted to',
    matrix,
    curve: coverage(graded, intended),
    checks: KINDS.map((kind) => difficulty(kind, graded, intended, correct)),
    topItemsTitle: 'Least clear charges',
    topItems: leastClear(graded),
  };
}
// #endregion

// 399 of 400 is not 100%. A rate only shows as a whole number when it really is one.
const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};
const ratio = (part, whole) => (whole ? part / whole : 0);
const gross = (results) => results.reduce((sum, result) => sum + Math.abs(result.item.amount), 0);
const wholeAmount = (value, currency) => `${Math.round(value).toLocaleString('en-US')} ${currency}`;

/** The numbers at the top: how much was right, how much went through alone, and what was held back. */
function headline(graded, auto, correct) {
  const right = graded.filter(correct);
  const autoRight = auto.filter(correct);
  const held = graded.filter((result) => !result.evaluation.autoPost);
  const heldWrong = held.filter((result) => !correct(result));
  const currency = graded[0]?.item.currency ?? '';

  return [
    { label: 'Accuracy', value: share(right.length, graded.length), context: `${right.length} of ${graded.length} in the intended account` },
    { label: 'Posted automatically', value: share(auto.length, graded.length), context: `${auto.length} at ${Math.round(AUTO_THRESHOLD * 100)}% confidence or more, ${wholeAmount(gross(auto), currency)} of ${wholeAmount(gross(graded), currency)} by value` },
    {
      label: 'Accuracy when automatic',
      value: share(autoRight.length, auto.length),
      tone: autoRight.length === auto.length ? 'good' : 'warn',
      context: `${auto.length - autoRight.length} wrong postings would go through`,
    },
    { label: 'Held for a person', value: held.length, context: `${heldWrong.length} of them would have been posted to the wrong account` },
    { label: 'Expenses posted', value: graded.length },
  ];
}

function metrics(graded, auto, correct, matrix) {
  const right = graded.filter(correct);
  return {
    headline: { label: 'Accuracy', value: ratio(right.length, graded.length), n: graded.length },
    accuracy: ratio(right.length, graded.length),
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    automationRate: ratio(auto.length, graded.length),
    automationPrecision: auto.length ? auto.filter(correct).length / auto.length : null,
  };
}

/** The rules baseline: post to whatever account this vendor's most recent earlier charge went to. */
function lastAccount(item) {
  const earlier = [...item.priorPostings].sort((left, right) => left.date.localeCompare(right.date));
  return earlier.at(-1)?.account ?? null;
}

/** The model beside the lookup and beside one account for everything. A first-time vendor beats the lookup. */
function alternatives(graded, intended, correct, accounts) {
  const withHistory = graded.filter((result) => result.item.priorPostings.length > 0);
  const lookupRight = withHistory.filter((result) => lastAccount(result.item) === intended.get(result.item.id).account);
  const modelRight = graded.filter(correct);

  const counts = new Map();
  for (const result of graded) {
    const account = intended.get(result.item.id).account;
    counts.set(account, (counts.get(account) ?? 0) + 1);
  }
  const [commonest, commonestCount] = [...counts].sort((left, right) => right[1] - left[1])[0] ?? [null, 0];
  const name = accounts.find((account) => account.code === commonest)?.name ?? commonest ?? 'none';

  const baselines = [
    { label: 'Jev', detail: 'posted to the intended account', value: ratio(modelRight.length, graded.length), model: true },
    { label: "Rule: copy the vendor's last account", detail: `${lookupRight.length} of the ${withHistory.length} charges with a history, and none of the ${graded.length - withHistory.length} from a first-time vendor`, value: ratio(lookupRight.length, graded.length) },
    { label: 'Always the commonest account', detail: name.toLowerCase(), value: ratio(commonestCount, graded.length) },
  ];
  const findings = lookupRight.length > modelRight.length
    ? [`Copying the vendor's last account forward is right on ${lookupRight.length} of ${graded.length}, which beats the model's ${modelRight.length}. The vendor history in the state is doing the work.`]
    : [];
  return { baselines, findings };
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
    rowLabel: 'the account each charge was meant for',
    columnLabel: 'the account the model posted it to',
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
  // Tenths are built from whole numbers, so the 70% bar is exactly the 0.7 that evaluate() uses.
  const points = Array.from({ length: 10 }, (_, step) => {
    const threshold = step / 10;
    const auto = graded.filter((result) => result.evaluation.confidence >= threshold);
    const right = auto.filter((result) => intended.get(result.item.id).account === result.evaluation.account);
    return { threshold, reviewed: auto.length, caught: right.length, rate: auto.length ? right.length / auto.length : null };
  });
  return { title: 'Confidence threshold', xLabel: 'Expenses posted automatically', yLabel: 'Correct among them', rateLabel: 'Accuracy', of: graded.length, defaultIndex: Math.round(AUTO_THRESHOLD * 10), points };
}

const CLARITY_LEVELS = ['Unreadable', 'Very unclear', 'Unclear', 'Workable', 'Clear', 'Very clear', 'Unambiguous'];
const VAT_TREATMENTS = { STANDARD: 'Standard-rated', ZERO_RATED: 'Zero-rated', EXEMPT: 'Exempt', OUT_OF_SCOPE: 'Out of scope' };
const percentOf = (value) => `${Math.round(value * 100)}%`;

const GRADE_NOTES = {
  ambiguous: 'This vendor sells into two accounts, so the memo has to decide.',
  'no-memo': 'The charge arrived with no description: only the vendor and its history say where it belongs.',
  refund: 'A refund, which belongs in the account the original charge went to.',
};

/** Right means the intended account, the same test the report's accuracy uses. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: label.account === result.evaluation.account,
    expected: label.account,
    got: result.evaluation.account,
    note: GRADE_NOTES[label.kind],
    confidence: result.evaluation.confidence,
  };
}

/** The second most likely account, which is what a reviewer wants to see on a held charge. */
function runnerUp(answer, context) {
  const [option, probability] = Object.entries(answer.probabilities ?? {})
    .filter(([key]) => key !== answer.choice)
    .sort((left, right) => right[1] - left[1])[0] ?? [];
  if (!option || probability < 0.05) return null;
  const code = option.replace('ACCOUNT_', '');
  return `${code} ${accountName(context, code)} · ${percentOf(probability)}`;
}

/** The decision card: the posting, and whether it goes through without a person. */
function verdict(result, context) {
  const { evaluation, item, answers } = result;
  const second = runnerUp(answers.account, context);
  const needsReceipt = Math.abs(item.amount) > context.receiptThreshold;
  const facts = [
    { label: 'Account', value: `${evaluation.account} ${evaluation.accountName} · ${percentOf(evaluation.confidence)}`, tone: evaluation.autoPost ? 'good' : 'warn' },
    { label: 'How clear the charge is', value: `${CLARITY_LEVELS[Math.round(evaluation.clarity)]} · ${evaluation.clarity.toFixed(1)} of 6`, tone: evaluation.clarity < 3 ? 'warn' : undefined },
    { label: 'Receipt needed', value: `${evaluation.receiptRequired ? 'Yes' : 'No'} · ${percentOf(answers.receipt_required.noul)}`, tone: evaluation.receiptRequired === needsReceipt ? undefined : 'bad' },
    { label: 'VAT', value: `${VAT_TREATMENTS[evaluation.vat]} · ${percentOf(answers.vat_treatment.confidence)}` },
  ];
  if (second) facts.splice(1, 0, { label: 'Runner-up', value: second });

  return {
    eyebrow: 'The posting this charge becomes',
    headline: `${evaluation.autoPost ? 'Post' : 'Hold for review'} · ${money(item)} → ${evaluation.account} ${evaluation.accountName}`,
    detail: evaluation.autoPost
      ? `Confidence is at or above the ${percentOf(AUTO_THRESHOLD)} bar, so it posts without a person.`
      : `Confidence is below the ${percentOf(AUTO_THRESHOLD)} bar, so a person chooses the account.`,
    facts,
  };
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
  caveat: 'Most charges here come from a vendor that only ever posts to one account, and the state shows where that vendor went before, so this run mostly measures lookup; a harder dataset with misleading histories is planned.',
  stage: {
    hide: ['reference', 'currency', 'isRefund'],
    labels: { priorPostings: 'This vendor before', paymentMethod: 'Paid by', description: 'Memo on the charge' },
    highlight: ['vendor', 'description', 'amount'],
  },
  grade: {
    labelId: (label) => label.expenseId,
    judge,
  },
  verdict,
  present: {
    number: 103,
    problem: {
      headline: 'A quarter of card and bank charges, twelve accounts, and nobody has categorised any of them.',
      stat: '400',
      statLabel: 'uncategorised charges',
    },
    hero: {
      item: 'E-0077',
      caption: 'Copperline Media, 1,776.53 AED, no description at all. One earlier charge went to marketing, and the model posts it there while scoring the charge itself as unclear.',
    },
    answers: {
      caption: 'The account comes with a confidence, and only postings at 70% or more go through without a person.',
      reveal: ['account', 'posting_clarity', 'receipt_required'],
    },
    miss: {
      item: 'E-0334',
      caption: 'Packing tape and boxes, 50.00 AED. The label says office supplies; the model said shipping at 54%, under the bar, so a person sees it before it posts.',
    },
    proof: {
      kpis: ['Accuracy', 'Posted automatically', 'Accuracy when automatic'],
      chart: 'baselines',
      closing: '399 of 400 in the right account, against 332 for copying the vendor forward; the one error was held back for a person.',
    },
  },
  explain: {
    data: 'scripts/generate/expense-posting.js#demo:data',
    state: 'demos/expense-posting/demo.js#demo:state',
    questions: 'demos/expense-posting/demo.js#demo:questions',
    evaluate: 'demos/expense-posting/demo.js#demo:evaluate',
  },
};
