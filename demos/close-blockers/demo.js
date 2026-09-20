// Close blockers: sixty trial balance accounts on working day four, and the question a controller
// actually asks on that day — what is still stopping the close, how bad is each one, and whose desk
// does it belong on. Six of the accounts look alarming and are fully supported, which is the part a
// movement threshold on its own always gets wrong.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

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
      ? `${item.account} ${item.name} · ${blocker === 'NONE' ? 'held with no blocker named' : readable(blocker)} · ${owner}`
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
  const caught = graded.filter((result) => byItem.get(result.item.id).kind === 'blocker' && named(result, byItem.get(result.item.id)) && result.evaluation.blocks);
  const cleared = results.filter((result) => !result.evaluation.blocks);
  const missed = cleared.filter((result) => byItem.get(result.item.id)?.kind === 'blocker');
  const matrix = confusion(graded, byItem);
  const comparison = alternatives(graded, byItem, caught.length);

  return {
    note: `Sixty accounts on working day four: ${planted.length} of them genuinely block the close and ${decoys.length} only look as if they do. ${severityGap(graded, byItem)} Labels never enter the model state.`,
    findings: [...findings(graded, byItem, decoys), ...comparison.findings],
    kpis: kpis({ graded, caught, planted, decoys, cleared, missed, byItem, total: results.length }),
    baselines: comparison.baselines,
    metrics: metrics(graded, byItem, caught.length, planted.length, matrix),
    distribution: distribution(results),
    distributionTitle: 'Where the held accounts land, by team',
    matrix,
    curve: coverage(graded, byItem, planted),
    checks: checks(graded, byItem, planted, decoys),
    topItemsTitle: 'The board, most severe first',
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

/** A blocker is only caught when it is held back and named for the right reason. */
function named(result, label) {
  return Boolean(label) && result.evaluation.blocker === label.blocker;
}

/** The whole decision for one account: the blocker named, and held or left alone as it should be. */
function decidedRight(result, label) {
  return named(result, label) && result.evaluation.blocks === (label.kind === 'blocker');
}

/** The rules baseline: hold any account whose movement is outside the range the controller expects. */
function ruleBlocks(item) {
  return item.movement > item.expectedMovementHigh || item.movement < item.expectedMovementLow;
}

const ratio = (part, whole) => (whole ? part / whole : 0);

/** The model beside the movement rule and beside holding nothing, scored on real blockers held. */
function alternatives(graded, byItem, modelCaught) {
  const ofKind = (kind) => graded.filter((result) => byItem.get(result.item.id).kind === kind);
  const blockers = ofKind('blocker');
  const decoys = ofKind('decoy');
  const ruleCaught = blockers.filter((result) => ruleBlocks(result.item)).length;
  const ruleDecoys = decoys.filter((result) => ruleBlocks(result.item)).length;
  const modelDecoys = decoys.filter((result) => result.evaluation.blocks).length;
  const baselines = [
    { label: 'Jev', detail: `real blockers held and named; also holds ${modelDecoys} of the ${decoys.length} supported accounts`, value: ratio(modelCaught, blockers.length), display: `${modelCaught} of ${blockers.length}`, model: true },
    { label: 'Rule: movement outside the expected range', detail: `real blockers held, with no reason given; also holds ${ruleDecoys} of the ${decoys.length} supported accounts`, value: ratio(ruleCaught, blockers.length), display: `${ruleCaught} of ${blockers.length}` },
    { label: 'Hold nothing', detail: 'the commonest answer: every account is ready', value: 0, display: `0 of ${blockers.length}` },
  ];
  const findings = ruleCaught >= modelCaught && ruleDecoys <= modelDecoys && blockers.length > 0 && (ruleCaught > modelCaught || ruleDecoys < modelDecoys)
    ? [`A movement rule holds ${ruleCaught} of the ${blockers.length} real blockers and ${ruleDecoys} of the ${decoys.length} supported accounts, which is better than the model's ${modelCaught} and ${modelDecoys}.`]
    : [];
  return { baselines, findings };
}

function metrics(graded, byItem, caught, plantedCount, matrix) {
  const right = graded.filter((result) => decidedRight(result, byItem.get(result.item.id)));
  const held = graded.filter((result) => result.evaluation.blocks);
  const realHeld = held.filter((result) => byItem.get(result.item.id).kind === 'blocker');
  const unnamed = held.filter((result) => result.evaluation.blocker === 'NONE');
  return {
    headline: { label: 'Blockers found', value: ratio(caught, plantedCount), n: plantedCount },
    accuracy: ratio(right.length, graded.length),
    macroF1: matrixStats(matrix)?.macroF1 ?? null,
    precision: held.length ? realHeld.length / held.length : null,
    recall: ratio(caught, plantedCount),
    contradictionRate: ratio(unnamed.length, graded.length),
  };
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
  const topFive = ranked(graded).slice(0, 5);
  const topFiveReal = topFive.filter((result) => byItem.get(result.item.id).kind === 'blocker').length;

  return [
    { label: 'Blockers found', value: `${caught.length} of ${planted.length}`, context: 'held back and named for the right reason', tone: caught.length === planted.length ? 'good' : 'warn' },
    { label: 'Supported accounts left alone', value: `${leftAlone.length} of ${decoys.length}`, context: 'big movements that carry their paperwork', tone: leftAlone.length === decoys.length ? 'good' : 'warn' },
    { label: 'Owner agreement', value: share(rightOwner.length, blockers.length), context: `${rightOwner.length} of ${blockers.length} blockers sent to the right team` },
    { label: 'Close readiness', value: share(cleared.length, total), context: missed.length ? `${missed.length} cleared accounts still hold a real blocker` : 'no real blocker was cleared', tone: missed.length ? 'warn' : 'good' },
    { label: 'Readiness after the top five', value: share(cleared.length + topFive.length, total), context: `if the five it ranked most severe were worked today; ${topFiveReal} of them are real blockers` },
  ];
}

function checks(graded, byItem, planted, decoys) {
  const rows = BLOCKER_TYPES.filter((type) => type !== 'NONE').map((type) => {
    const group = planted.filter((label) => label.blocker === type);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.accountId);
      return !result || !result.evaluation.blocks || result.evaluation.blocker !== type;
    });
    return { id: type.toLowerCase(), label: `${sentence(type)} blockers missed`, detail: questions.blocker_type.criteria[type], count: missed.length, of: group.length, items: missed.map((label) => label.accountId) };
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
    rowLabel: 'the blocker that was planted',
    columnLabel: 'the blocker the model named',
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
  return { title: 'Severity bar, workload and how much of the queue is real', xLabel: 'Accounts a person opens', yLabel: 'Real blockers in the queue', rateLabel: 'Share of the queue that is real', of: planted.length, thresholdFormat: 'level', levels: 6, defaultIndex: 0, points };
}

function findings(graded, byItem, decoys) {
  const lines = [];
  const flagged = decoys.filter((label) => graded.some((result) => result.item.id === label.accountId && result.evaluation.blocks));
  const unnamed = graded.filter((result) => result.evaluation.blocks && result.evaluation.blocker === 'NONE');
  if (unnamed.length) lines.push(`${unnamed.length} accounts were held with no blocker named, which is two answers contradicting each other: ${unnamed.map((result) => result.item.account).join(', ')}.`);
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
    label: `${result.evaluation.label} · ${boardTag(result, byItem.get(result.item.id))}`,
    value: money(result.item.movement, currency),
  }));
}

/** What the labels say about an account the model put on the board. */
function boardTag(result, label) {
  if (!label) return 'not graded';
  if (label.kind === 'decoy') return 'supported, should not be here';
  if (label.kind === 'clean') return 'ordinary, should not be here';
  return named(result, label) ? 'agrees' : `planted as ${readable(label.blocker)}`;
}

const SEVERITY_LEVELS = ['None', 'Cosmetic', 'Minor', 'Notable', 'Material', 'Serious', 'Critical'];
const percentOf = (value) => `${Math.round(value * 100)}%`;

function gradeNote(label) {
  if (label.kind === 'blocker') return `Planted as a blocker: ${readable(label.blocker)}, for ${label.expectedOwner}.`;
  if (label.kind === 'decoy') return 'Planted as a supported account: the movement looks alarming and the note says where the paperwork is.';
  return undefined;
}

/** Right means the blocker named and the account held or left alone as planted. The owner is graded apart. */
function judge(result, label) {
  if (!label) return null;
  const side = (blocks) => (blocks ? 'hold' : 'leave alone');
  return {
    agree: decidedRight(result, label),
    expected: `${side(label.kind === 'blocker')} · ${readable(label.blocker)}`,
    got: `${side(result.evaluation.blocks)} · ${readable(result.evaluation.blocker)}`,
    note: gradeNote(label),
    confidence: result.evaluation.confidence,
  };
}

/** The line this account gets on the close board, or the reason it stays off it. */
function verdict(result, context) {
  const { evaluation, item, answers } = result;
  const movement = money(item.movement, context?.currency);
  const held = evaluation.blocks;
  const reason = evaluation.blocker === 'NONE' ? 'no blocker named' : readable(evaluation.blocker);
  return {
    eyebrow: `Working day ${context?.workingDay ?? '–'} of ${context?.deadlineWorkingDay ?? '–'}`,
    headline: held ? `Blocks the close · ${reason} · ${evaluation.owner}` : 'Ready to close',
    detail: `Movement of ${movement} against an expected range of ${money(item.expectedMovementLow, context?.currency)} to ${money(item.expectedMovementHigh, context?.currency)}.`,
    facts: [
      { label: 'Blocker', value: `${sentence(evaluation.blocker)} · ${percentOf(evaluation.confidence)}`, tone: evaluation.blocker === 'NONE' ? (held ? 'warn' : 'good') : 'bad' },
      { label: 'Has to be worked before close', value: `${held ? 'Yes' : 'No'} · ${percentOf(evaluation.probability)}`, tone: held ? 'bad' : 'good' },
      { label: 'Severity', value: `${SEVERITY_LEVELS[Math.round(evaluation.severity)]} · ${evaluation.severity.toFixed(1)} of 6`, tone: evaluation.severity >= 3.5 ? 'bad' : evaluation.severity >= 1.5 ? 'warn' : undefined },
      { label: 'Owner', value: `${evaluation.owner} · ${percentOf(answers.owner.confidence)}` },
      { label: 'Movement outside the expected range', value: evaluation.outsideExpected ? 'Yes' : 'No', tone: evaluation.outsideExpected ? 'warn' : undefined },
    ],
  };
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
  itemLabel: (item) => `${item.account} · ${item.name}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/close-blockers.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'Every ordinary account here moves inside its expected range with a stock note, and every blocker note says plainly what is wrong, so only the six supported accounts and the four quiet blockers test judgement; a harder dataset is planned.',
  stage: {
    hide: ['account', 'name'],
    labels: {
      priorBalance: 'Balance last month',
      expectedMovementLow: 'Expected movement, low',
      expectedMovementHigh: 'Expected movement, high',
      openItems: 'Open reconciling items',
      preparerNote: "Preparer's note",
    },
    highlight: ['movement', 'reconciliation', 'openItems'],
  },
  grade: {
    labelId: (label) => label.accountId,
    judge,
  },
  verdict,
  present: {
    number: 105,
    problem: {
      headline: 'Working day four of six. What is still stopping the close, and whose desk is it on?',
      stat: '60',
      statLabel: 'trial balance accounts',
    },
    hero: {
      item: 'TB-2700',
      caption: 'The legal accrual moved £8,542, inside its expected range, so a movement rule passes it. The note says the firm worked all month and has not billed, and the model holds it as a missing accrual.',
    },
    answers: {
      caption: 'Four typed answers make one line on the close board: what kind of blocker, whether it holds the close, how serious, and which team.',
      reveal: ['blocker_type', 'blocks_close', 'severity', 'owner'],
    },
    miss: {
      item: 'TB-2720',
      caption: 'A £100,307 provision release with the board minute on file. The model named no blocker and held it anyway, one of 3 supported accounts it sent to the board.',
    },
    proof: {
      kpis: ['Blockers found', 'Supported accounts left alone', 'Close readiness'],
      chart: 'baselines',
      closing: '13 of 13 real blockers held, against 9 of 13 for a movement rule, which also holds 5 of the 6 supported accounts to the model\'s 3.',
    },
  },
  explain: {
    data: 'scripts/generate/close-blockers.js#demo:data',
    state: 'demos/close-blockers/demo.js#demo:state',
    questions: 'demos/close-blockers/demo.js#demo:questions',
    evaluate: 'demos/close-blockers/demo.js#demo:evaluate',
  },
};
