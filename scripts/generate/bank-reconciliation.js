// One synthetic bank account for one month. A strict amount-and-date rule removes the 180 obvious
// pairs; the 60 statement lines left behind are the demo items. Ground truth is returned separately.

import { addDays, createRandom } from './lib/random.js';
import { accountReference, bankName, merchantName } from './lib/names.js';
import { amount, round } from './lib/money.js';

export const SEED = 1102;

const PERIOD = { from: '2026-05-01', to: '2026-05-31' };
const CURRENCY = 'USD';
const GENERATED_AT = '2026-09-19';
const DAY_MS = 24 * 60 * 60 * 1000;

const signed = (entry) => (entry.direction === 'INFLOW' ? entry.amount : -entry.amount);
const daysApart = (left, right) => Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / DAY_MS;
const publicStatement = ({ key, ...line }) => line;
const publicLedger = ({ key, ...entry }) => entry;

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const counterparties = Array.from({ length: 34 }, () => merchantName(random));
  const state = {
    random,
    counterparties,
    statements: [],
    ledger: [],
    labels: [],
    usedAmounts: new Set(),
    statementSequence: 0,
    ledgerSequence: 0,
    referenceSequence: 0,
  };

  ordinaryPairs(state, 180);
  timingDifferences(state, 12);
  bankFees(state, 9);
  fxDifferences(state, 7);
  partialPayments(state, 8);
  duplicateEntries(state, 6);
  missingFromBooks(state, 5);
  messyMatches(state, 13);

  state.statements.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  state.ledger.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  state.statements.forEach((line, index) => {
    line.id = `S-${String(index + 1).padStart(4, '0')}`;
  });
  state.ledger.forEach((entry, index) => {
    entry.id = `B-${String(index + 1).padStart(4, '0')}`;
  });

  const cleared = preClear(state.statements, state.ledger);
  const clearedStatementKeys = new Set(cleared.map((pair) => pair.statement.key));
  const clearedLedgerKeys = new Set(cleared.map((pair) => pair.entry.key));
  const openStatements = state.statements.filter((line) => !clearedStatementKeys.has(line.key));
  const openLedger = state.ledger.filter((entry) => !clearedLedgerKeys.has(entry.key));
  const labelByStatement = new Map(state.labels.map((label) => [label.statementKey, label]));
  const ledgerByKey = new Map(state.ledger.map((entry) => [entry.key, entry]));

  if (state.statements.length !== 240 || state.ledger.length !== 232 || cleared.length !== 180 || openStatements.length !== 60 || openLedger.length !== 52) {
    throw new Error(`Bank reconciliation counts drifted: ${state.statements.length} statements, ${state.ledger.length} ledger entries, ${cleared.length} cleared, ${openStatements.length} open statements, ${openLedger.length} open ledger entries`);
  }

  const items = openStatements.map((statement) => {
    const candidates = rankCandidates(statement, openLedger).slice(0, 5);
    const intendedKey = labelByStatement.get(statement.key)?.matchesEntryKey;
    if (intendedKey && !candidates.some((entry) => entry.key === intendedKey)) {
      throw new Error(`${statement.key}'s intended ledger entry fell outside the deterministic top five`);
    }
    return { id: statement.id, statement: publicStatement(statement), candidates: candidates.map(publicLedger) };
  });

  const labels = state.labels.map(({ statementKey, matchesEntryKey, ...label }) => {
    const statementLineId = state.statements.find((line) => line.key === statementKey).id;
    return {
      statementLineId,
      itemId: statementLineId,
      matchesEntryId: matchesEntryKey ? ledgerByKey.get(matchesEntryKey).id : null,
      ...label,
    };
  });
  const openingBalance = 485_250;
  const statementNet = round(state.statements.reduce((sum, line) => sum + signed(line), 0));
  const ledgerNet = round(state.ledger.reduce((sum, entry) => sum + signed(entry), 0));
  const preClearedNet = round(cleared.reduce((sum, pair) => sum + signed(pair.statement), 0));

  return {
    dataset: {
      id: 'bank-reconciliation',
      class: 'synthetic',
      generatedAt: GENERATED_AT,
      seed,
      source: 'scripts/generate/bank-reconciliation.js',
      context: {
        entity: `${merchantName(random)} Ltd`,
        period: PERIOD,
        currency: CURRENCY,
        bank: { name: bankName(random), accountReference: accountReference(random) },
        referenceFormat: 'DEMO2605-NNNN / free-text remittance reference',
        openingBalance,
        closingBalance: round(openingBalance + statementNet),
        bookClosingBalance: round(openingBalance + ledgerNet),
        statementLineCount: state.statements.length,
        ledgerEntryCount: state.ledger.length,
        preClearedCount: cleared.length,
        preClearedNet,
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** The deterministic short-list: same direction first, then relative amount gap, date gap, and id. */
function rankCandidates(statement, ledgerEntries) {
  const score = (entry) => {
    const directionPenalty = entry.direction === statement.direction ? 0 : 10;
    const amountGap = Math.abs(entry.amount - statement.amount) / Math.max(entry.amount, statement.amount, 1);
    return directionPenalty + amountGap * 2 + daysApart(entry.date, statement.date) * 0.08;
  };
  return [...ledgerEntries].sort((left, right) => score(left) - score(right) || left.id.localeCompare(right.id));
}
// #endregion

/** Only unique, same-direction, exact-amount entries no more than one day apart clear automatically. */
function preClear(statements, ledgerEntries) {
  const possible = new Map(statements.map((line) => [line.key, ledgerEntries.filter((entry) => entry.direction === line.direction && entry.amount === line.amount && daysApart(entry.date, line.date) <= 1)]));
  const claims = new Map();
  for (const entries of possible.values()) for (const entry of entries) claims.set(entry.key, (claims.get(entry.key) ?? 0) + 1);
  return statements.flatMap((line) => {
    const entries = possible.get(line.key);
    return entries.length === 1 && claims.get(entries[0].key) === 1 ? [{ statement: line, entry: entries[0] }] : [];
  });
}

function ordinaryPairs(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.38) ? 'INFLOW' : 'OUTFLOW';
    const value = freshAmount(state, { min: 90, max: 8_500, skew: 2.1 });
    const date = state.random.day(PERIOD.from, PERIOD.to);
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state);
    addStatement(state, { date, direction, amount: value, description: direction === 'INFLOW' ? `Receipt from ${counterparty}` : `Payment to ${counterparty}`, counterparty, reference });
    addLedger(state, { date: state.random.bool(0.72) ? date : addDays(date, state.random.pick([-1, 1])), direction, amount: value, description: direction === 'INFLOW' ? `Customer receipt · ${counterparty}` : `Supplier payment · ${counterparty}`, counterparty, reference, documentId: `JRN-OBV-${String(index).padStart(4, '0')}` });
  }
}

function timingDifferences(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.35) ? 'INFLOW' : 'OUTFLOW';
    const value = freshAmount(state, { min: 450, max: 7_500, skew: 1.8 });
    const date = state.random.day('2026-05-08', '2026-05-24');
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state);
    const statement = addStatement(state, { date, direction, amount: value, description: `${direction === 'INFLOW' ? 'Receipt from' : 'Transfer to'} ${counterparty}`, counterparty, reference });
    const entry = addLedger(state, { date: addDays(date, state.random.pick([-6, -5, 5, 6])), direction, amount: value, description: `Posted on ${direction === 'INFLOW' ? 'receipt' : 'payment'} advice · ${counterparty}`, counterparty, reference, documentId: `JRN-TIM-${String(index).padStart(2, '0')}` });
    label(state, statement, entry, 'TIMING', `timing-${String(index).padStart(2, '0')}`);
  }
}

function bankFees(state, count) {
  for (let index = 1; index <= count; index++) {
    const value = freshAmount(state, { min: 6, max: 75, skew: 1.4 });
    const statement = addStatement(state, { date: state.random.day(PERIOD.from, PERIOD.to), direction: 'OUTFLOW', amount: value, description: state.random.pick(['Monthly account service fee', 'International transfer fee', 'Wire handling charge']), counterparty: null, reference: nextReference(state, 'FEE') });
    label(state, statement, null, 'BANK_FEE', `fee-${String(index).padStart(2, '0')}`);
  }
}

function fxDifferences(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.3) ? 'INFLOW' : 'OUTFLOW';
    const eurAmount = round(state.random.float(650, 6_800, 2));
    const bookedRate = state.random.float(1.06, 1.1, 4);
    const settledRate = round(bookedRate + state.random.pick([-1, 1]) * state.random.float(0.008, 0.025, 4), 4);
    const bookAmount = round(eurAmount * bookedRate);
    const bankAmount = freshAmountNear(state, round(eurAmount * settledRate));
    const date = state.random.day('2026-05-05', '2026-05-27');
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state, 'FX');
    const statement = addStatement(state, { date, direction, amount: bankAmount, description: `EUR settlement · ${counterparty}`, counterparty, reference, transactionCurrency: 'EUR', transactionAmount: eurAmount });
    const entry = addLedger(state, { date, direction, amount: bookAmount, description: `EUR invoice at booking rate · ${counterparty}`, counterparty, reference, documentId: `JRN-FX-${String(index).padStart(2, '0')}`, transactionCurrency: 'EUR', transactionAmount: eurAmount });
    label(state, statement, entry, 'FX_DIFFERENCE', `fx-${String(index).padStart(2, '0')}`);
  }
}

function partialPayments(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.25) ? 'INFLOW' : 'OUTFLOW';
    const booked = freshAmount(state, { min: 4_500, max: 14_000, skew: 1.3 });
    const paid = freshAmountNear(state, round(booked * state.random.float(0.88, 0.96, 3)));
    const date = state.random.day('2026-05-04', '2026-05-28');
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state, 'PART');
    const statement = addStatement(state, { date, direction, amount: paid, description: `Part payment · ${counterparty}`, counterparty, reference });
    const entry = addLedger(state, { date, direction, amount: booked, description: `Open invoice · ${counterparty}`, counterparty, reference, documentId: `JRN-PART-${String(index).padStart(2, '0')}` });
    label(state, statement, entry, 'PARTIAL_PAYMENT', `partial-${String(index).padStart(2, '0')}`);
  }
}

function duplicateEntries(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.25) ? 'INFLOW' : 'OUTFLOW';
    const value = freshAmount(state, { min: 800, max: 7_000, skew: 1.7 });
    const date = state.random.day('2026-05-03', '2026-05-28');
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state, 'DUP');
    const statement = addStatement(state, { date, direction, amount: value, description: `${direction === 'INFLOW' ? 'Receipt from' : 'Payment to'} ${counterparty}`, counterparty, reference });
    const original = addLedger(state, { date, direction, amount: value, description: `Posted transaction · ${counterparty}`, counterparty, reference, documentId: `JRN-DUP-${String(index).padStart(2, '0')}-A` });
    addLedger(state, { date: addDays(date, 1), direction, amount: value, description: `Posted transaction · ${counterparty}`, counterparty, reference, documentId: `JRN-DUP-${String(index).padStart(2, '0')}-B` });
    label(state, statement, original, 'DUPLICATE', `duplicate-${String(index).padStart(2, '0')}`);
  }
}

function missingFromBooks(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.4) ? 'INFLOW' : 'OUTFLOW';
    const value = freshAmount(state, { min: 1_200, max: 11_000, skew: 1.6 });
    const counterparty = state.random.pick(state.counterparties);
    const statement = addStatement(state, { date: state.random.day(PERIOD.from, PERIOD.to), direction, amount: value, description: `${direction === 'INFLOW' ? 'Incoming transfer' : 'Authorised transfer'} · ${counterparty}`, counterparty, reference: nextReference(state, 'MISS') });
    label(state, statement, null, 'MISSING_IN_BOOKS', `missing-${String(index).padStart(2, '0')}`);
  }
}

function messyMatches(state, count) {
  for (let index = 1; index <= count; index++) {
    const direction = state.random.bool(0.4) ? 'INFLOW' : 'OUTFLOW';
    const value = freshAmount(state, { min: 250, max: 8_500, skew: 1.9 });
    const date = state.random.day('2026-05-04', '2026-05-27');
    const counterparty = state.random.pick(state.counterparties);
    const reference = nextReference(state, 'MESSY');
    const statement = addStatement(state, { date, direction, amount: value, description: `Online transfer ${reference.split('-')[1]} · ${counterparty.split(' ')[0]}`, counterparty, reference: reference.replaceAll('-', '') });
    const entry = addLedger(state, { date: addDays(date, state.random.pick([-3, -2, 2, 3])), direction, amount: value, description: `Settlement for ${counterparty}`, counterparty, reference: `BOOK/${reference.slice(-9)}`, documentId: `JRN-MESSY-${String(index).padStart(2, '0')}` });
    label(state, statement, entry, 'MATCHED', `matched-${String(index).padStart(2, '0')}`);
  }
}

function addStatement(state, fields) {
  const key = `statement-${String(++state.statementSequence).padStart(4, '0')}`;
  const line = { key, id: key, currency: CURRENCY, ...fields };
  state.statements.push(line);
  return line;
}

function addLedger(state, fields) {
  const key = `ledger-${String(++state.ledgerSequence).padStart(4, '0')}`;
  const entry = { key, id: key, currency: CURRENCY, ...fields };
  state.ledger.push(entry);
  return entry;
}

function label(state, statement, entry, breakReason, problemId) {
  state.labels.push({ statementKey: statement.key, matchesEntryKey: entry?.key ?? null, breakReason, problemId });
}

function nextReference(state, kind = 'PAY') {
  return `DEMO2605-${String(++state.referenceSequence).padStart(4, '0')}-${kind}`;
}

function freshAmount(state, options) {
  let value;
  do value = amount(state.random, options);
  while (state.usedAmounts.has(value.toFixed(2)));
  state.usedAmounts.add(value.toFixed(2));
  return value;
}

function freshAmountNear(state, wanted) {
  let value = round(wanted);
  while (state.usedAmounts.has(value.toFixed(2))) value = round(value + 0.01);
  state.usedAmounts.add(value.toFixed(2));
  return value;
}
