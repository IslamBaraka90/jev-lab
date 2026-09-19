// A trial balance on working day four of the close: sixty accounts, each with its movement against
// last month, the range the controller expects, the reconciliation status and whatever the preparer
// scribbled in the note field. Thirteen accounts genuinely block the close and six only look as if
// they do. What is planted goes to data/synthetic/close-blockers.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';

export const SEED = 1105;

/** The chart, in trial balance order. `base` is the size the account usually sits at. */
const ACCOUNTS = [
  { code: '1000', name: 'Cash at bank – main GBP', category: 'Asset', base: 842_000 },
  { code: '1010', name: 'Cash at bank – EUR', category: 'Asset', base: 310_000 },
  { code: '1020', name: 'Cash at bank – USD', category: 'Asset', base: 186_000 },
  { code: '1030', name: 'Petty cash', category: 'Asset', base: 2_400 },
  { code: '1100', name: 'Trade receivables', category: 'Asset', base: 1_240_000 },
  { code: '1110', name: 'Receivables – credit notes pending', category: 'Asset', base: -48_000 },
  { code: '1120', name: 'Allowance for doubtful debts', category: 'Asset', base: -96_000 },
  { code: '1200', name: 'Accrued income', category: 'Asset', base: 172_000 },
  { code: '1210', name: 'Accrued income – rebates', category: 'Asset', base: 41_000 },
  { code: '1300', name: 'Prepayments – insurance', category: 'Asset', base: 88_000 },
  { code: '1310', name: 'Prepayments – software licences', category: 'Asset', base: 64_000 },
  { code: '1320', name: 'Prepayments – rent', category: 'Asset', base: 75_000 },
  { code: '1330', name: 'Prepayments – marketing', category: 'Asset', base: 22_000 },
  { code: '1400', name: 'Inventory – finished goods', category: 'Asset', base: 612_000 },
  { code: '1410', name: 'Inventory – raw materials', category: 'Asset', base: 288_000 },
  { code: '1420', name: 'Goods received not invoiced', category: 'Asset', base: 134_000 },
  { code: '1430', name: 'Inventory provision', category: 'Asset', base: -52_000 },
  { code: '1500', name: 'Fixed assets – equipment', category: 'Asset', base: 1_460_000 },
  { code: '1510', name: 'Accumulated depreciation', category: 'Asset', base: -718_000 },
  { code: '1520', name: 'Fixed assets – fixtures', category: 'Asset', base: 196_000 },
  { code: '1600', name: 'Intercompany receivable – Ireland', category: 'Asset', base: 264_000 },
  { code: '1610', name: 'Intercompany receivable – Germany', category: 'Asset', base: 158_000 },
  { code: '1620', name: 'Intercompany receivable – US', category: 'Asset', base: 92_000 },
  { code: '1700', name: 'VAT receivable', category: 'Asset', base: 74_000 },
  { code: '1710', name: 'VAT – reverse charge control', category: 'Asset', base: 12_000 },
  { code: '1800', name: 'Deposits held', category: 'Asset', base: 46_000 },
  { code: '2000', name: 'Trade payables', category: 'Liability', base: -684_000 },
  { code: '2010', name: 'Payables – disputed invoices', category: 'Liability', base: -58_000 },
  { code: '2020', name: 'Payables – GRNI clearing', category: 'Liability', base: -126_000 },
  { code: '2100', name: 'Accrued expenses – professional fees', category: 'Liability', base: -74_000 },
  { code: '2110', name: 'Accrued expenses – utilities', category: 'Liability', base: -31_000 },
  { code: '2120', name: 'Accrued expenses – audit', category: 'Liability', base: -68_000 },
  { code: '2130', name: 'Accrued expenses – marketing', category: 'Liability', base: -44_000 },
  { code: '2140', name: 'Accrued expenses – freight', category: 'Liability', base: -27_000 },
  { code: '2200', name: 'Accrued payroll', category: 'Liability', base: -318_000 },
  { code: '2210', name: 'Bonus accrual', category: 'Liability', base: -210_000 },
  { code: '2220', name: 'Holiday pay accrual', category: 'Liability', base: -96_000 },
  { code: '2300', name: 'VAT payable', category: 'Liability', base: -242_000 },
  { code: '2310', name: 'PAYE and social security', category: 'Liability', base: -164_000 },
  { code: '2320', name: 'Corporation tax payable', category: 'Liability', base: -286_000 },
  { code: '2330', name: 'Withholding tax payable', category: 'Liability', base: -38_000 },
  { code: '2340', name: 'VAT – overseas registrations', category: 'Liability', base: -54_000 },
  { code: '2400', name: 'Deferred revenue – annual plans', category: 'Liability', base: -910_000 },
  { code: '2410', name: 'Deferred revenue – services', category: 'Liability', base: -232_000 },
  { code: '2420', name: 'Deferred revenue – setup fees', category: 'Liability', base: -78_000 },
  { code: '2500', name: 'Intercompany payable – Ireland', category: 'Liability', base: -198_000 },
  { code: '2510', name: 'Intercompany payable – Germany', category: 'Liability', base: -122_000 },
  { code: '2520', name: 'Intercompany payable – US', category: 'Liability', base: -66_000 },
  { code: '2600', name: 'Bank loan – current portion', category: 'Liability', base: -240_000 },
  { code: '2610', name: 'Bank loan – non-current', category: 'Liability', base: -960_000 },
  { code: '2700', name: 'Provisions – legal', category: 'Liability', base: -180_000 },
  { code: '2710', name: 'Provisions – warranty', category: 'Liability', base: -64_000 },
  { code: '2720', name: 'Provisions – restructuring', category: 'Liability', base: -112_000 },
  { code: '2800', name: 'Credit cards payable', category: 'Liability', base: -36_000 },
  { code: '2900', name: 'Suspense account', category: 'Liability', base: -4_000 },
  { code: '2910', name: 'Payroll clearing', category: 'Liability', base: -8_000 },
  { code: '2920', name: 'Bank clearing', category: 'Liability', base: -14_000 },
  { code: '3000', name: 'Share capital', category: 'Equity', base: -500_000 },
  { code: '3100', name: 'Retained earnings', category: 'Equity', base: -1_820_000 },
  { code: '3200', name: 'FX translation reserve', category: 'Equity', base: -74_000 },
];

/**
 * The thirteen accounts that stop the close, written the way the preparer would leave them.
 * `owner` is who has to fix it, which is the account's usual team except where the blocker itself
 * decides: an unsupported journal is the controller's, a missing invoice is payables', and a
 * revaluation is treasury's whoever owns the balance.
 */
const BLOCKERS = [
  { account: '2920', blocker: 'UNRECONCILED', owner: 'TREASURY', swing: 'high', openItems: 21,
    note: 'Not done. The bank feed dropped from the 12th to the 15th and I have not rebuilt it, so 21 items are still sitting unmatched. I will get to it after the payment run.' },
  { account: '1100', blocker: 'UNRECONCILED', owner: 'AR', swing: 'none', openItems: 34,
    note: 'Aged debt report does not agree to the control account, out by about 41k. 34 items unapplied since the cash posting ran twice on the 8th. Needs a proper look, not a plug.' },
  { account: '2800', blocker: 'UNRECONCILED', owner: 'AP', swing: 'high', openItems: 12,
    note: 'Card statements for two of the three cards are not in yet, so 12 charges have no receipt and nothing is matched. Chased the cardholders twice.' },
  { account: '2910', blocker: 'UNRECONCILED', owner: 'CONTROLLER', swing: 'none', openItems: 9,
    note: 'Clearing account should be nil at month end and it is not. Nine entries left from the August payroll rerun, I cannot tell which side they belong to without the bureau file.' },
  { account: '2120', blocker: 'MISSING_ACCRUAL', owner: 'AP', swing: 'empty', openItems: 0,
    note: 'No accrual booked for the audit. Fieldwork finished on the 22nd, last year the fee was 61k and nothing has been posted this month.' },
  { account: '2140', blocker: 'MISSING_ACCRUAL', owner: 'AP', swing: 'empty', openItems: 0,
    note: 'Freight for the August shipments is not in. The forwarder invoices in arrears and we normally accrue around 24k, I did not get the numbers in time.' },
  { account: '2700', blocker: 'MISSING_ACCRUAL', owner: 'AP', swing: 'none', openItems: 0,
    note: 'The firm handling the supplier claim has worked all month and has not billed. Nothing accrued for it. Provision here is the old estimate from June, untouched.' },
  { account: '2500', blocker: 'INTERCOMPANY', owner: 'TREASURY', swing: 'high', openItems: 0,
    note: 'Does not agree with Dublin. They show 38k more than we do, probably the July recharge posted on both sides. Emailed their controller on Tuesday, no answer yet.' },
  { account: '1610', blocker: 'INTERCOMPANY', owner: 'TREASURY', swing: 'high', openItems: 0,
    note: 'Out against Munich by 22k. Their balance moved after our cut-off, so one of us is a month behind. Cannot close this until we agree whose entry is right.' },
  { account: '1010', blocker: 'FX_REVALUATION', owner: 'TREASURY', swing: 'none', openItems: 0,
    note: 'Still sitting at the June rate. The revaluation run did not pick this account up again and the euro has moved a long way since, so the sterling figure is wrong.' },
  { account: '1200', blocker: 'FX_REVALUATION', owner: 'TREASURY', swing: 'high', openItems: 0,
    note: 'Half of this is the euro contract billed in advance and it has never been revalued. Balance is in a mix of currencies at the rate each entry went in at.' },
  { account: '2300', blocker: 'UNSUPPORTED_JOURNAL', owner: 'CONTROLLER', amount: 52_000, openItems: 0,
    note: 'Journal 4471 for 52k posted on the last day of the month with no description and nothing attached. It is not one of mine and the return does not explain it.' },
  { account: '1400', blocker: 'UNSUPPORTED_JOURNAL', owner: 'CONTROLLER', amount: -63_000, openItems: 0,
    note: 'There is a manual write-down of 63k in here from journal 4488. No approval in the folder and the stock count sheets do not show a loss anywhere near that.' },
];

/** Six accounts that look wrong at a glance and are not. Every one of them has its paperwork. */
const DECOYS = [
  { account: '2210', factor: 0.8, openItems: 0,
    note: 'Yes it is up 80%. That is the retention pool the board approved in June, first month it has been accrued in full. Approval and the calculation are both in the close folder.' },
  { account: '1300', swing: 'high', openItems: 0,
    note: 'Same jump as every August, the annual insurance renewal lands this month and releases over the next twelve. Schedule is attached and agrees to the penny.' },
  { account: '1310', swing: 'empty', openItems: 0,
    note: 'Nearly nil now because the three-year licence prepayment finished releasing in August. Amortisation schedule is attached, nothing left to carry.' },
  { account: '2320', swing: 'empty', openItems: 0,
    note: 'Down by almost the whole balance because we paid the instalment on the 14th. Receipt from the bank is in the folder and the figure agrees to the tax computation.' },
  { account: '2720', swing: 'empty', openItems: 0,
    note: 'Restructuring provision released. The last of the redundancies were paid in August and the board minute closing the programme is filed with the papers.' },
  { account: '1420', swing: 'none', openItems: 6,
    note: 'Six items still open but they are all September receipts that arrived before the cut-off, total 3.1k, well under materiality. Agreed with the controller to leave them.' },
];

const CLEAN_NOTES = [
  'Reconciled, no open items.',
  'Agrees to the supporting schedule.',
  'Tied back to the sub-ledger, no difference.',
  'Nil movement, nothing to explain.',
  'Rec reviewed and signed off.',
  'Agrees to the statement.',
  'Checked against last month, as expected.',
  '',
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const planted = new Map([...BLOCKERS.map((entry) => [entry.account, entry]), ...DECOYS.map((entry) => [entry.account, { ...entry, blocker: 'NONE', decoy: true }])]);
  const items = [];
  const labels = [];

  for (const account of ACCOUNTS) {
    const plan = planted.get(account.code);
    const item = trialBalanceLine(random, account, plan);
    items.push(item);
    labels.push({
      accountId: item.id,
      account: account.code,
      blocker: plan?.blocker ?? 'NONE',
      expectedOwner: plan?.owner ?? defaultOwner(account),
      kind: plan ? (plan.decoy ? 'decoy' : 'blocker') : 'clean',
      note: plan?.decoy ? 'Looks alarming, is fully supported' : undefined,
    });
  }

  return {
    dataset: {
      id: 'close-blockers',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/close-blockers.js',
      context: {
        entity: 'Calder Works Ltd',
        period: 'August 2026',
        priorPeriod: 'July 2026',
        currency: 'GBP',
        closeDate: '2026-09-08',
        workingDay: 4,
        deadlineWorkingDay: 6,
        materiality: 25_000,
        comparison: 'Balance and movement against July 2026, with the movement range the controller expects for this account.',
        subsidiaries: ['Calder Works Ireland', 'Calder Works GmbH', 'Calder Works Inc'],
        // The teams and what they cover live in the owner question's options, not here: they are the
        // answer set, and a state is never allowed to carry the answer.
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One trial balance line: where it sits, how it moved, and what the preparer wrote about it. */
function trialBalanceLine(random, account, plan) {
  const prior = round(account.base * random.float(0.94, 1.06, 4));
  const expected = expectedRange(account);
  const movement = movementFor(random, expected, plan, prior);
  const openItems = plan?.openItems ?? (random.bool(0.12) ? random.int(1, 4) : 0);

  return {
    id: `TB-${account.code}`,
    account: account.code,
    name: account.name,
    category: account.category,
    balance: round(prior + movement),
    priorBalance: prior,
    movement,
    expectedMovementLow: expected.low,
    expectedMovementHigh: expected.high,
    reconciliation: reconciliationStatus(random, plan, openItems),
    openItems,
    preparerNote: plan?.note ?? random.pick(CLEAN_NOTES),
  };
}

/** How much this account normally moves in a month, as a band around zero. */
function expectedRange(account) {
  const size = Math.max(4_000, Math.round((Math.abs(account.base) * 0.08) / 1_000) * 1_000);
  return { low: -size, high: size };
}
// #endregion

/**
 * How the account moved. Most accounts drift inside the band the controller expects. A planted one
 * can move well outside it, empty out altogether, grow by a stated share, or move by exactly the
 * amount its note talks about, so the note and the numbers can never disagree on camera.
 */
function movementFor(random, expected, plan, prior) {
  if (plan?.amount !== undefined) return plan.amount;
  if (plan?.factor !== undefined) return round(prior * plan.factor);
  if (plan?.swing === 'empty') return round(-prior * random.float(0.78, 0.96, 3));
  if (plan?.swing === 'high') return round(expected.high * random.float(1.8, 4.2, 3));
  if (plan?.swing === 'low') return round(expected.low * random.float(1.8, 4.2, 3));
  return round(random.float(expected.low * 0.75, expected.high * 0.75));
}

function reconciliationStatus(random, plan, openItems) {
  if (plan?.blocker === 'UNRECONCILED') return openItems > 15 ? 'Not reconciled this month' : `Partly reconciled, ${openItems} items open`;
  if (openItems) return `Reconciled, ${openItems} items open`;
  return `Reconciled ${random.int(1, 4)} September`;
}

/**
 * Who looks after the account day to day, used as the expected owner wherever the blocker itself does
 * not decide. Derived from the account, not stored on it, so the state cannot hand the answer over.
 */
function defaultOwner(account) {
  if (/payroll|bonus|holiday pay/i.test(account.name)) return 'CONTROLLER';
  if (/VAT|tax|PAYE|withholding/i.test(account.name)) return 'TAX';
  if (/intercompany|bank|cash|loan|deposits|FX|clearing/i.test(account.name)) return 'TREASURY';
  if (/receivable|accrued income|deferred revenue|doubtful/i.test(account.name)) return 'AR';
  if (/payable|accrued expenses|goods received|GRNI|credit cards/i.test(account.name)) return 'AP';
  return 'CONTROLLER';
}
