// Close blockers: sixty trial balance accounts on working day four, and the question a controller
// actually asks on that day — what is still stopping the close, how bad is each one, and whose desk
// does it belong on. Six of the accounts look alarming and are fully supported, which is the part a
// movement threshold on its own always gets wrong.

import { choice, noul, score } from '../lib/questions.js';

const BLOCK_PROBABILITY = 0.5;
const BLOCKER_TYPES = ['UNRECONCILED', 'MISSING_ACCRUAL', 'INTERCOMPANY', 'FX_REVALUATION', 'UNSUPPORTED_JOURNAL', 'NONE'];
const OWNERS = ['AP', 'AR', 'TREASURY', 'TAX', 'CONTROLLER'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** One account as the close pack shows it: the numbers, the status, the note, and the calendar. */
function buildState(item, context) {
  return {
    task: 'Decide whether this account blocks the month-end close, what kind of problem it is, and which team has to clear it.',
    close: {
      entity: context.entity,
      period: context.period,
      currency: context.currency,
      working_day: context.workingDay,
      deadline_working_day: context.deadlineWorkingDay,
      materiality: context.materiality,
      group_companies: context.subsidiaries,
    },
    comparison: context.comparison,
    account: {
      code: item.account,
      name: item.name,
      category: item.category,
      balance: item.balance,
      prior_balance: item.priorBalance,
      movement: item.movement,
      expected_movement: { low: item.expectedMovementLow, high: item.expectedMovementHigh },
      reconciliation: item.reconciliation,
      open_items: item.openItems,
      preparer_note: item.preparerNote || '(the preparer left no note)',
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  blocker_type: choice('What is stopping this account from being closed?', {
    UNRECONCILED: 'The account has not been reconciled, or the reconciliation does not agree.',
    MISSING_ACCRUAL: 'Goods or services were received in the period with nothing booked for them.',
    INTERCOMPANY: 'The balance does not agree with the matching balance in a group company.',
    FX_REVALUATION: 'A foreign currency balance has not been revalued at the period-end rate.',
    UNSUPPORTED_JOURNAL: 'A manual entry sits in the account with no approval or backup behind it.',
    NONE: 'Nothing here stops the close, however unusual the movement looks.',
  }),
  blocks_close: noul('Does this account have to be worked on before the books can be closed?', {
    yes: 'The close cannot be signed off while this account is in this state.',
    no: 'The account is ready, or its difference is explained, supported and immaterial.',
  }),
  severity: score('How serious is this account for the close?', [
    'None', 'Cosmetic', 'Minor', 'Notable', 'Material', 'Serious', 'Critical',
  ]),
  owner: choice('Which team has to clear this account?', {
    AP: 'Accounts payable: supplier invoices, goods received not invoiced, expense accruals, card statements.',
    AR: 'Accounts receivable: customer balances, cash application, credit notes, accrued and deferred revenue.',
    TREASURY: 'Treasury: bank and cash, loans, foreign exchange and revaluation, intercompany balances.',
    TAX: 'Tax: VAT, payroll taxes, corporation tax and withholding.',
    CONTROLLER: 'Financial control: manual journals, provisions, payroll and inventory accounting, anything unsupported.',
  }),
};
// #endregion

// #region demo:evaluate
/** Turns four answers into the line this account gets on the close board. */
function evaluate(answers, item, context) {
  const blocker = answers.blocker_type.choice;
  const probability = answers.blocks_close.noul;
  const blocks = probability >= BLOCK_PROBABILITY;
  const owner = answers.owner.choice;

  return {
    blocker,
    blocks,
    owner,
    severity: answers.severity.score,
    probability,
    confidence: answers.blocker_type.confidence,
    outsideExpected: item.movement > item.expectedMovementHigh || item.movement < item.expectedMovementLow,
    material: Math.abs(item.movement) >= (context.materiality ?? 0),
    label: blocks
      ? `${item.account} ${item.name} · ${readable(blocker)} · ${owner}`
      : `${item.account} ${item.name} · cleared`,
  };
}
// #endregion

// #region demo:report
/** Grades the board against what was planted: what blocks, what was left alone, and who owns it. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.accountId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const planted = labels.filter((label) => label.kind === 'blocker');
  const decoys = labels.filter((label) => label.kind === 'decoy');
  const caught = graded.filter((result) => named(result, byItem.get(result.item.id)) && result.evaluation.blocks);
  const cleared = results.filter((result) => !result.evaluation.blocks);
  const missed = cleared.filter((result) => byItem.get(result.item.id)?.kind === 'blocker');

  return {
    note: `Sixty accounts on working day four: ${planted.length} of them genuinely block the close and ${decoys.length} only look as if they do. ${severityGap(graded, byItem)} Labels never enter the model state.`,
    findings: findings(graded, byItem, decoys),
    kpis: kpis({ graded, caught, planted, decoys, cleared, missed, byItem, total: results.length }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, planted),
    checks: checks(graded, byItem, planted, decoys),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

/** A blocker is only caught when it is held back and named for the right reason. */
function named(result, label) {
  return Boolean(label) && result.evaluation.blocker === label.blocker;
}

function ranked(results) {
  return [...results]
    .filter((result) => result.evaluation.blocks)
    .sort((left, right) => right.evaluation.severity - left.evaluation.severity
      || Math.abs(right.item.movement) - Math.abs(left.item.movement)
      || left.item.id.localeCompare(right.item.id));
}

function severityGap(graded, byItem) {
  const on = (kind) => graded.filter((result) => byItem.get(result.item.id).kind === kind).map((result) => result.evaluation.severity);
  const blockers = mean(on('blocker'));
  const supported = mean(on('decoy'));
  return `Severity averaged ${blockers.toFixed(1)} of 6 on the planted blockers and ${supported.toFixed(1)} on the supported ones.`;
}

function kpis({ graded, caught, planted, decoys, cleared, missed, byItem, total }) {
  const leftAlone = decoys.filter((label) => graded.some((result) => result.item.id === label.accountId && !result.evaluation.blocks));
  const blockers = graded.filter((result) => byItem.get(result.item.id).kind === 'blocker');
  const rightOwner = blockers.filter((result) => result.evaluation.owner === byItem.get(result.item.id).expectedOwner);
  const topFive = ranked(graded).slice(0, 5).length;

  return [
    { label: 'Blockers found', value: `${caught.length} of ${planted.length}`, context: 'held back and named for the right reason', tone: caught.length === planted.length ? 'good' : 'warn' },
    { label: 'Supported accounts left alone', value: `${leftAlone.length} of ${decoys.length}`, context: 'big movements that carry their paperwork', tone: leftAlone.length === decoys.length ? 'good' : 'warn' },
    { label: 'Owner agreement', value: share(rightOwner.length, blockers.length), context: `${rightOwner.length} of ${blockers.length} blockers sent to the right team` },
    { label: 'Close readiness', value: share(cleared.length, total), context: missed.length ? `${missed.length} cleared accounts still hold a real blocker` : 'no real blocker was cleared', tone: missed.length ? 'warn' : 'good' },
    { label: 'Readiness after the top five', value: share(cleared.length + topFive, total), context: 'if the five it ranked most severe were fixed today' },
  ];
}

function checks(graded, byItem, planted, decoys) {
  const rows = BLOCKER_TYPES.filter((type) => type !== 'NONE').map((type) => {
    const group = planted.filter((label) => label.blocker === type);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.accountId);
      return !result || !result.evaluation.blocks || result.evaluation.blocker !== type;
    });
    return { id: type.toLowerCase(), label: `${sentence(type)} not caught`, detail: questions.blocker_type.criteria[type], count: missed.length, of: group.length, items: missed.map((label) => label.accountId) };
  });

  const flagged = decoys.filter((label) => graded.some((result) => result.item.id === label.accountId && result.evaluation.blocks));
  const falseBlocks = graded.filter((result) => byItem.get(result.item.id).kind === 'clean' && result.evaluation.blocks);
  return [
    ...rows,
    { id: 'decoys', label: 'Supported accounts called blockers', detail: 'Six accounts move far more than expected and every one of them has its paperwork.', count: flagged.length, of: decoys.length, items: flagged.map((label) => label.accountId) },
    { id: 'false-blocks', label: 'Ordinary accounts called blockers', detail: 'An account with a normal movement and a clean reconciliation should not reach the board.', count: falseBlocks.length, of: graded.filter((result) => byItem.get(result.item.id).kind === 'clean').length, items: falseBlocks.map((result) => result.item.id) },
  ];
}

/** The owner lanes: where the blocked accounts land, which is how the close is actually worked. */
function distribution(results) {
  const blocked = results.filter((result) => result.evaluation.blocks);
  return [
    ...OWNERS.map((owner) => ({ label: owner, count: blocked.filter((result) => result.evaluation.owner === owner).length, tone: 'warn' })),
    { label: 'Cleared', count: results.length - blocked.length, tone: 'good' },
  ].filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Blocker called against what was planted',
    columns: BLOCKER_TYPES.map(sentence),
    rows: BLOCKER_TYPES.map((actual) => ({
      label: sentence(actual),
      cells: BLOCKER_TYPES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).blocker === actual && result.evaluation.blocker === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, planted) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const queue = graded.filter((result) => result.evaluation.blocks && result.evaluation.severity >= bar);
    const real = queue.filter((result) => byItem.get(result.item.id).kind === 'blocker');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: queue.length, caught: real.length, rate: queue.length ? Number((real.length / queue.length).toFixed(3)) : null };
  });
  return { title: 'Severity bar, workload and how much of the queue is real', xLabel: 'Accounts a person opens', yLabel: 'Real blockers in the queue', rateLabel: 'Share of the queue that is real', of: planted.length, points };
}

function findings(graded, byItem, decoys) {
  const lines = [];
  const flagged = decoys.filter((label) => graded.some((result) => result.item.id === label.accountId && result.evaluation.blocks));
  if (flagged.length >= 2) lines.push(`${flagged.length} of the ${decoys.length} supported accounts were sent to the board anyway: ${flagged.map((label) => label.account).join(', ')}. Every one of them says in the note where the paperwork is, so this is a reading failure, not a judgement call.`);

  const wrong = graded.filter((result) => byItem.get(result.item.id).kind === 'blocker' && !named(result, byItem.get(result.item.id)));
  const groups = new Map();
  for (const result of wrong) {
    const key = `${byItem.get(result.item.id).blocker}|${result.evaluation.blocker}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const worst = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  if (worst && worst[1].length >= 3) {
    const [actual, predicted] = worst[0].split('|');
    lines.push(`${worst[1].length} of ${wrong.length} misread blockers are the same swap: ${readable(actual)} called ${readable(predicted)}. That is one boundary to settle, not ${worst[1].length} separate mistakes.`);
  }

  const misowned = graded.filter((result) => byItem.get(result.item.id).kind === 'blocker' && result.evaluation.owner !== byItem.get(result.item.id).expectedOwner);
  if (misowned.length >= 3) lines.push(`${misowned.length} blockers went to the wrong team. The ones worth checking are where the blocker decides the owner rather than the account: an unsupported journal is the controller's wherever it sits, and a revaluation is treasury's.`);

  return lines;
}

function topItems(results, byItem, currency) {
  return ranked(results).slice(0, 10).map((result) => ({
    id: result.item.id,
    label: `${result.evaluation.label}${named(result, byItem.get(result.item.id)) ? ' · agrees' : ''}`,
    value: money(result.item.movement, currency),
  }));
}

export default {
  id: 'close-blockers',
  title: 'Close blockers',
  domain: 'books',
  value: 'Turn a trial balance into a ranked list of what is stopping the close, and who has to fix it.',
  tags: ['month end', 'close', 'trial balance', 'controls'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  status: 'pending-recording',
  itemLabel: (item) => `${item.account} · ${item.name}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/close-blockers.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/close-blockers.js#demo:data',
    state: 'demos/close-blockers/demo.js#demo:state',
    questions: 'demos/close-blockers/demo.js#demo:questions',
    evaluate: 'demos/close-blockers/demo.js#demo:evaluate',
  },
};
