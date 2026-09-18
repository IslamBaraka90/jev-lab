// A tiny ledger that exercises the demo runtime end to end: twelve journal lines, five documents and
// two planted problems. It is the fixture the foundation tests run against, not a catalog demo; the
// real ledger demo is PRP 101.

import { createRandom } from './lib/random.js';
import { merchantName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1000;

const ACCOUNTS = [
  { code: '5100', name: 'Office supplies', type: 'expense', normalBalance: 'debit' },
  { code: '5200', name: 'Software subscriptions', type: 'expense', normalBalance: 'debit' },
  { code: '1500', name: 'Equipment', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts payable', type: 'liability', normalBalance: 'credit' },
  { code: '1000', name: 'Bank', type: 'asset', normalBalance: 'credit' },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const period = { from: '2026-04-01', to: '2026-04-30' };
  const items = [];
  const labels = [];
  let line = 0;

  // Five ordinary purchase documents: one expense line paid from the bank.
  for (let document = 1; document <= 5; document++) {
    const account = random.pick(ACCOUNTS.slice(0, 3));
    const value = amount(random, { min: 40, max: 1800 });
    const day = random.day(period.from, period.to);
    const supplier = merchantName(random);
    const documentId = `DOC-${String(document).padStart(3, '0')}`;

    items.push(entry(++line, documentId, day, account, { debit: value, credit: 0 }, `${supplier} invoice`, supplier));
    items.push(entry(++line, documentId, day, ACCOUNTS[4], { debit: 0, credit: value }, `Payment to ${supplier}`, supplier));
  }

  // Problem 1: the second document is posted twice, same amount, same day.
  const duplicated = items.filter((item) => item.documentId === 'DOC-002');
  for (const original of duplicated) {
    const copy = { ...original, id: `L-${String(++line).padStart(4, '0')}`, documentId: 'DOC-006', reference: `${original.reference}-B` };
    items.push(copy);
    labels.push({ lineId: copy.id, issue: 'DUPLICATE_POSTING', note: `Repeats ${original.id} from DOC-002` });
  }

  // Problem 2: an expense posted on the wrong side, so its document does not balance.
  const reversed = entry(++line, 'DOC-007', '2026-04-22', ACCOUNTS[0], { debit: 0, credit: 240 }, 'Stationery order', merchantName(random));
  items.push(reversed);
  labels.push({ lineId: reversed.id, issue: 'REVERSED_SIGN', note: 'Expense posted as a credit' });

  return {
    dataset: {
      id: '__example__',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/example.js',
      context: { entity: 'Demo Trading Ltd', currency: 'USD', period, accounts: ACCOUNTS },
      items,
    },
    labels,
  };
}

function entry(line, documentId, date, account, amounts, memo, counterparty) {
  return {
    id: `L-${String(line).padStart(4, '0')}`,
    documentId,
    date,
    account: account.code,
    accountName: account.name,
    accountType: account.type,
    normalBalance: account.normalBalance,
    debit: round(amounts.debit),
    credit: round(amounts.credit),
    currency: 'USD',
    memo,
    counterparty,
    reference: `${documentId}-${line}`,
  };
}
