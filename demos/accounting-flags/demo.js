// Accounting red flags on statements where the answer is known. Forty-seven of the hundred and twenty
// company-years carry a planted pattern and seventy-three are clean, so this demo can say plainly how
// often the pattern was found and how often a clean year was accused of something.
//
// Ten of the flagged years have an innocent explanation written into the notes and nowhere else. Those
// are the interesting ones: the arithmetic still shows the pattern, and only reading the note excuses
// it. The report keeps "found the flag" and "excused the decoy" apart, because they are different
// skills and a demo that adds them together is hiding which one failed.

import { choice, noul, score } from '../lib/questions.js';

const FLAGS = ['RECEIVABLES', 'INVENTORY', 'REVENUE_TIMING', 'CAPITALISED_COSTS', 'RELATED_PARTY', 'RESTATEMENT', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

// #region demo:state
/** Three years as filed, the notes as written, and what normal looks like in this sector. */
function buildState(item, context) {
  const norms = context.sectorNorms.find((entry) => entry.id === item.sectorId);
  return {
    task: 'Read these three years and say which pattern, if any, deserves a second look before this year is signed off.',
    company: { name: item.company, sector: item.sector, year_under_review: item.fiscalYearEnd },
    amounts_in: `${context.currency}, ${context.unit}`,
    statements: item.statements,
    notes_to_the_accounts: item.notes,
    auditor: item.auditor,
    auditor_history: item.auditorHistory,
    what_is_normal_for_this_sector: norms,
    reviewing_standard: 'Most years are unremarkable and are signed off without comment. Hold one up only where the pattern is strong enough that somebody relying on these numbers would be misled.',
    note: 'The notes are the only place a reason for something in the numbers will ever appear.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  flag: choice('What is the strongest pattern in these statements?', {
    RECEIVABLES: 'Receivables are growing much faster than the revenue behind them.',
    INVENTORY: 'Stock is building while sales fall.',
    REVENUE_TIMING: 'Revenue is being recognised well ahead of the cash.',
    CAPITALISED_COSTS: 'Costs that used to run through the profit and loss are suddenly on the balance sheet.',
    RELATED_PARTY: 'A material share of revenue is with a party connected to the company.',
    RESTATEMENT: 'An earlier year has been restated, or the auditor has changed.',
    NONE: 'Nothing here needs a second look.',
  }),
  severity: score('How serious is it?', ['None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Critical']),
  business_explanation_exists: noul('Do the notes explain the pattern?', {
    yes: 'A note gives a business reason that accounts for what the numbers do.',
    no: 'Nothing in the notes explains it.',
  }),
  second_flag: choice('Is there a second pattern underneath the first?', {
    RECEIVABLES: 'Receivables are also running ahead of revenue.',
    INVENTORY: 'Stock is also building against the sales trend.',
    REVENUE_TIMING: 'The cash is also lagging the reported profit.',
    CAPITALISED_COSTS: 'Capitalised costs have also jumped.',
    RELATED_PARTY: 'There is also a connected-party concentration.',
    RESTATEMENT: 'There is also a restatement or an auditor change.',
    NONE: 'There is only the one.',
  }),
  investigate: noul('Should this year be held up for review before it is signed off?', {
    yes: 'The pattern is strong enough that somebody relying on these numbers would be misled. Hold the sign-off.',
    no: 'Worth noting, or nothing at all, but not worth holding up the accounts for.',
  }),
};
// #endregion

// #region demo:evaluate
/** One company-year's reading: the pattern named, how serious, and whether the notes were believed. */
function evaluate(answers, item) {
  const flag = answers.flag.choice;
  return {
    flag,
    severity: answers.severity.score,
    explained: answers.business_explanation_exists.noul >= 0.5,
    second: answers.second_flag.choice,
    investigate: answers.investigate.noul >= 0.5,
    confidence: answers.flag.confidence,
    label: `${item.id} · ${item.company} · ${flag === 'NONE' ? 'nothing to see' : readable(flag)}`,
  };
}
// #endregion

// #region demo:report
/** Two scores kept apart: the patterns found, and the innocent ones let through. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.companyYearId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const planted = graded.filter((result) => byItem.get(result.item.id).flag !== 'NONE');
  const clean = graded.filter((result) => byItem.get(result.item.id).flag === 'NONE');
  const decoys = graded.filter((result) => byItem.get(result.item.id).decoy);

  return {
    note: `A hundred and twenty company-years. ${planted.length} carry a planted pattern, ${decoys.length} of those have an innocent explanation in the notes, and ${clean.length} are clean. ${context.note ?? ''}`,
    findings: findings({ graded, planted, clean, decoys, byItem }),
    kpis: kpis({ graded, planted, clean, decoys, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, planted),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

const named = (result, byItem) => result.evaluation.flag === byItem.get(result.item.id).flag;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function kpis({ graded, planted, clean, decoys, byItem }) {
  const found = planted.filter((result) => named(result, byItem));
  const falseAlarms = clean.filter((result) => result.evaluation.flag !== 'NONE');
  const read = decoys.filter((result) => result.evaluation.explained);
  const excused = read.filter((result) => !result.evaluation.investigate);
  const real = planted.filter((result) => !byItem.get(result.item.id).decoy);
  const raised = real.filter((result) => result.evaluation.investigate);
  const withSecond = graded.filter((result) => byItem.get(result.item.id).secondFlag !== 'NONE');
  const secondFound = withSecond.filter((result) => result.evaluation.second === byItem.get(result.item.id).secondFlag);
  const gap = average(real.map((result) => result.evaluation.severity)) - average(decoys.map((result) => result.evaluation.severity));
  const ranking = average(real.map((result) => result.evaluation.severity)) - average(clean.map((result) => result.evaluation.severity));
  const held = clean.filter((result) => result.evaluation.investigate);

  return [
    { label: 'Patterns named correctly', value: `${found.length} of ${planted.length}`, context: 'the planted pattern, named as the strongest one', tone: found.length >= planted.length * 0.8 ? 'good' : 'warn' },
    { label: 'Clean years accused', value: `${falseAlarms.length} of ${clean.length}`, context: 'a pattern named where nothing was planted', tone: falseAlarms.length > clean.length / 10 ? 'warn' : 'good' },
    { label: 'Clean years held up', value: `${held.length} of ${clean.length}`, context: 'sign-off stopped on a year with nothing planted in it', tone: held.length > clean.length / 4 ? 'warn' : 'good' },
    { label: 'Severity gap, planted against clean', value: ranking.toFixed(1), context: 'how much more serious a planted year was scored than a clean one', tone: ranking > 1 ? 'good' : 'warn' },
    { label: 'Decoy explanation found', value: `${read.length} of ${decoys.length}`, context: 'the reason is in the notes, in prose, and it was read', tone: read.length >= decoys.length * 0.6 ? 'good' : 'warn' },
    { label: 'Decoys let through', value: `${excused.length} of ${decoys.length}`, context: 'explanation found, and the year signed off without review' },
    { label: 'Real patterns sent on', value: `${raised.length} of ${real.length}`, context: 'planted patterns with no explanation, raised for somebody to look at' },
    { label: 'Second pattern found', value: `${secondFound.length} of ${withSecond.length}`, context: 'company-years carrying two planted patterns at once' },
    { label: 'Severity gap, real against excused', value: gap.toFixed(1), context: 'how much more serious the unexplained ones were scored', tone: gap > 1 ? 'good' : 'warn' },
  ];
}

function checks(graded, byItem, labels) {
  const byFlag = FLAGS.filter((flag) => flag !== 'NONE').map((flag) => {
    const group = labels.filter((label) => label.flag === flag);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.companyYearId);
      return !result || result.evaluation.flag !== flag;
    });
    return { id: flag.toLowerCase(), label: `${sentence(flag)} not named`, detail: questions.flag.criteria[flag], count: missed.length, of: group.length, items: missed.slice(0, 20).map((label) => label.companyYearId) };
  });

  const decoys = graded.filter((result) => byItem.get(result.item.id).decoy);
  const notExcused = decoys.filter((result) => result.evaluation.investigate);
  const clean = graded.filter((result) => byItem.get(result.item.id).flag === 'NONE');
  const accused = clean.filter((result) => result.evaluation.flag !== 'NONE');

  return byFlag.concat([
    { id: 'decoys', label: 'Explained patterns sent on anyway', detail: 'Ten company-years where a note gives a business reason for what the numbers do.', count: notExcused.length, of: decoys.length, items: notExcused.slice(0, 20).map((result) => result.item.id) },
    { id: 'clean', label: 'Clean years accused of a pattern', detail: 'Seventy-three company-years with nothing planted in them.', count: accused.length, of: clean.length, items: accused.slice(0, 20).map((result) => result.item.id) },
  ]);
}

function distribution(results) {
  return FLAGS
    .map((flag) => ({ label: sentence(flag), count: results.filter((result) => result.evaluation.flag === flag).length, tone: flag === 'NONE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Pattern named against the pattern planted',
    columns: FLAGS.map(sentence),
    rows: FLAGS.map((actual) => ({
      label: sentence(actual),
      cells: FLAGS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).flag === actual && result.evaluation.flag === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, planted) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const reviewed = graded.filter((result) => result.evaluation.severity >= bar);
    const real = reviewed.filter((result) => byItem.get(result.item.id).flag !== 'NONE' && !byItem.get(result.item.id).decoy);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: reviewed.length, caught: real.length, rate: reviewed.length ? Number((real.length / reviewed.length).toFixed(3)) : null };
  });
  return { title: 'Reading the most serious years first', xLabel: 'Company-years at this severity or above', yLabel: 'Years with an unexplained pattern', rateLabel: 'Share of them that do', of: planted.length, points };
}

function findings({ graded, planted, clean, decoys, byItem }) {
  const lines = [];
  const missed = planted.filter((result) => result.evaluation.flag === 'NONE');
  if (missed.length) {
    const kinds = [...new Set(missed.map((result) => readable(byItem.get(result.item.id).flag)))];
    lines.push(`${missed.length} company-years with a planted pattern were read as clean: ${kinds.join(', ')}.`);
  }

  const confused = planted.filter((result) => result.evaluation.flag !== 'NONE' && !named(result, byItem));
  if (confused.length) {
    const pairs = [...new Set(confused.map((result) => `${readable(byItem.get(result.item.id).flag)} read as ${readable(result.evaluation.flag)}`))];
    lines.push(`${confused.length} patterns were spotted but named as something else: ${pairs.slice(0, 3).join('; ')}.`);
  }

  const stubborn = decoys.filter((result) => !result.evaluation.explained);
  if (stubborn.length) lines.push(`${stubborn.length} of ${decoys.length} decoys were read as having no explanation in the notes. The explanation is there, in prose, and the arithmetic alone will not find it.`);

  const cautious = decoys.filter((result) => result.evaluation.explained && result.evaluation.investigate);
  if (cautious.length) lines.push(`${cautious.length} decoys had their explanation found and were sent for review anyway. Whether that is a failure depends on whether you want the note believed or verified, and this demo does not decide that for you.`);

  const accused = clean.filter((result) => result.evaluation.investigate);
  const gap = average(planted.filter((result) => !byItem.get(result.item.id).decoy).map((result) => result.evaluation.severity)) - average(clean.map((result) => result.evaluation.severity));
  if (accused.length >= 5) {
    lines.push(`${accused.length} of ${clean.length} clean years were held up for review. That is the cost side of this, and it is paid in hours.`);
    if (gap > 0.8) lines.push(`The ranking is better than the decision: a planted year scores ${gap.toFixed(1)} points more serious than a clean one, so sorting by severity works even where the yes-or-no does not. Read the curve above rather than the accusation count.`);
  }
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .sort((left, right) => right.evaluation.severity - left.evaluation.severity || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id) && named(result, byItem) ? ' · agrees' : ''}`,
      value: `${result.evaluation.severity.toFixed(1)} of 6`,
    }));
}

export default {
  id: 'accounting-flags',
  title: 'Accounting red flags',
  domain: 'screening',
  value: 'Find the statement patterns that deserve a second look, and tell them apart from the ones the notes already explain.',
  tags: ['screening', 'statements', 'forensic', 'text'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.company} · ${item.sector}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/accounting-flags.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/accounting-flags.js#demo:data',
    state: 'demos/accounting-flags/demo.js#demo:state',
    questions: 'demos/accounting-flags/demo.js#demo:questions',
    evaluate: 'demos/accounting-flags/demo.js#demo:evaluate',
  },
};
