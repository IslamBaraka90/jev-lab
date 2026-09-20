// Accounting red flags on statements where the answer is known. Forty-seven of the hundred and twenty
// company-years carry a planted pattern and seventy-three are clean, so this demo can say plainly how
// often the pattern was found and how often a clean year was accused of something.
//
// Ten of the flagged years have an innocent explanation written into the notes and nowhere else. Those
// are the interesting ones: the arithmetic still shows the pattern, and only reading the note excuses
// it. The report keeps "found the flag" and "excused the decoy" apart, because they are different
// skills and a demo that adds them together is hiding which one failed.

import { choice, noul, score } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

const FLAGS = ['RECEIVABLES', 'INVENTORY', 'REVENUE_TIMING', 'CAPITALISED_COSTS', 'RELATED_PARTY', 'RESTATEMENT', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());

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

  const groups = { graded, planted, clean, decoys, byItem };
  const matrix = confusion(graded, byItem);

  return {
    note: `A hundred and twenty company-years. ${planted.length} carry a planted pattern, ${decoys.length} of those have an innocent explanation in the notes, and ${clean.length} are clean. ${context.note ?? ''}`,
    findings: findings(groups),
    kpis: kpis(groups),
    otherFigures: otherFigures(groups),
    distribution: distribution(results),
    distributionTitle: 'Patterns named',
    baselines: baselines(groups),
    matrix,
    curve: coverage(groups),
    yearsByPatternProbability: probabilityCuts(groups),
    decoysExplanationFoundAgainstHeld: decoyGrid(decoys),
    metrics: metrics(groups, matrix),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
    topItemsTitle: 'Scored most serious',
  };
}
// #endregion

const named = (result, byItem) => result.evaluation.flag === byItem.get(result.item.id).flag;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const unexplained = (planted, byItem) => planted.filter((result) => !byItem.get(result.item.id).decoy);

/** How likely the answer made it that something is there: everything not given to "nothing to see". */
const patternProbability = (result) => 1 - (result.answers.flag.probabilities?.NONE ?? 0);

/** The chance a planted year is ranked above a clean one by `scoreOf`, ties counted as half. 0.5 is a coin. */
function rankingAuc(positives, negatives, scoreOf) {
  if (!positives.length || !negatives.length) return null;
  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (scoreOf(positive) > scoreOf(negative)) wins += 1;
      else if (scoreOf(positive) === scoreOf(negative)) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

/** What holding every year answered at `bar` or above would cost and catch. */
function heldAt(bar, { graded, planted, clean, byItem }) {
  const held = graded.filter((result) => result.answers.investigate.noul >= bar);
  const real = unexplained(planted, byItem);
  return { held: held.length, real: held.filter((result) => real.includes(result)).length, clean: held.filter((result) => clean.includes(result)).length };
}

const STRICTER_BAR = 0.7;

function kpis(groups) {
  const { graded, planted, clean, decoys, byItem } = groups;
  const exact = graded.filter((result) => named(result, byItem));
  const found = planted.filter((result) => named(result, byItem));
  const read = decoys.filter((result) => result.evaluation.explained);
  const real = unexplained(planted, byItem);
  const held = clean.filter((result) => result.evaluation.investigate);
  const raised = real.filter((result) => result.evaluation.investigate);
  const stricter = heldAt(STRICTER_BAR, groups);
  const auc = rankingAuc(planted, clean, patternProbability);

  return [
    { label: 'Years read as planted', value: `${exact.length} of ${graded.length}`, context: `the planted pattern named, or "none" for a clean year; answering "none" every time scores ${clean.length}`, tone: exact.length > clean.length ? 'good' : 'warn' },
    { label: 'Planted years ranked above clean', value: auc === null ? '–' : auc.toFixed(3), context: 'the chance a planted year is given more probability of a pattern than a clean one; 0.5 is a coin, 1 is perfect', tone: auc !== null && auc >= 0.9 ? 'good' : 'warn' },
    { label: 'Clean years held up', value: `${held.length} of ${clean.length}`, context: `at the 50% line, with ${raised.length} of ${real.length} real patterns; at 70% it is ${stricter.clean} clean years and ${stricter.real} real patterns`, tone: held.length > clean.length / 4 ? 'warn' : 'good' },
    { label: 'Patterns named correctly', value: `${found.length} of ${planted.length}`, context: 'the planted pattern, named as the strongest one', tone: found.length >= planted.length * 0.8 ? 'good' : 'warn' },
    { label: 'Decoy explanation found', value: `${read.length} of ${decoys.length}`, context: 'the reason is in the notes, in prose, and it was read', tone: read.length >= decoys.length * 0.6 ? 'good' : 'warn' },
  ];
}

/** The figures that are worth having and not worth a headline tile. */
function otherFigures({ graded, planted, clean, decoys, byItem }) {
  const falseAlarms = clean.filter((result) => result.evaluation.flag !== 'NONE');
  const excused = decoys.filter((result) => result.evaluation.explained && !result.evaluation.investigate);
  const real = unexplained(planted, byItem);
  const raised = real.filter((result) => result.evaluation.investigate);
  const heldInAll = graded.filter((result) => result.evaluation.investigate);
  const withSecond = graded.filter((result) => byItem.get(result.item.id).secondFlag !== 'NONE');
  const secondFound = withSecond.filter((result) => result.evaluation.second === byItem.get(result.item.id).secondFlag);
  const repeated = graded.filter((result) => result.evaluation.second === result.evaluation.flag && result.evaluation.flag !== 'NONE');
  const gap = average(real.map((result) => result.evaluation.severity)) - average(decoys.map((result) => result.evaluation.severity));
  const ranking = average(real.map((result) => result.evaluation.severity)) - average(clean.map((result) => result.evaluation.severity));

  return [
    { label: 'Clean years accused', value: `${falseAlarms.length} of ${clean.length}`, context: 'a pattern named where nothing was planted' },
    { label: 'Real patterns sent on', value: `${raised.length} of ${real.length}`, context: `planted patterns with no explanation, held for review; ${heldInAll.length} years were held in all` },
    { label: 'Decoys let through', value: `${excused.length} of ${decoys.length}`, context: 'explanation found, and the year signed off without review' },
    { label: 'Second pattern found', value: `${secondFound.length} of ${withSecond.length}`, context: `company-years carrying two planted patterns; the second answer repeats the first in ${repeated.length} of ${graded.length} years` },
    { label: 'Severity gap, planted against clean', value: ranking.toFixed(1), context: 'how much more serious a planted year was scored than a clean one' },
    { label: 'Severity gap, real against excused', value: gap.toFixed(1), context: 'how much more serious the unexplained ones were scored' },
  ];
}

const growth = (now, before) => (before ? (now - before) / Math.abs(before) : 0);

/**
 * Rule: a changed auditor is a restatement; cash under half of profit is revenue timing; then the first
 * of inventory, receivables and capitalised costs to outgrow revenue by a wide margin; otherwise none.
 */
function ruleFlag(item) {
  const prior = item.statements.at(-2);
  const latest = item.statements.at(-1);
  if (!prior || !latest) return 'NONE';
  const revenue = growth(latest.revenue, prior.revenue);
  if (item.auditorHistory.length > 1) return 'RESTATEMENT';
  if (latest.operatingCashFlow < latest.netIncome * 0.5) return 'REVENUE_TIMING';
  if (growth(latest.inventory, prior.inventory) - revenue > 0.3) return 'INVENTORY';
  if (growth(latest.tradeReceivables, prior.tradeReceivables) - revenue > 0.5) return 'RECEIVABLES';
  if (growth(latest.costsCapitalised, prior.costsCapitalised) > 1) return 'CAPITALISED_COSTS';
  return 'NONE';
}

function baselines({ graded, clean, byItem }) {
  if (!graded.length) return undefined;
  const exact = graded.filter((result) => named(result, byItem));
  const byRule = graded.filter((result) => ruleFlag(result.item) === byItem.get(result.item.id).flag);
  const row = (count) => ({ value: count / graded.length, display: `${count} of ${graded.length}` });
  return [
    { label: 'Jev', detail: 'the pattern named matches the one planted, or "none" on a clean year', model: true, ...row(exact.length) },
    { label: 'Rule: the line that outgrew revenue', detail: 'five comparisons over the statements and the auditor history; it never reads a note', ...row(byRule.length) },
    { label: 'Always say nothing to see', detail: 'the commonest label', ...row(clean.length) },
  ];
}

function metrics(groups, matrix) {
  const { graded, planted, clean, byItem } = groups;
  if (!graded.length) return undefined;
  const stats = matrixStats(matrix);
  const exact = graded.filter((result) => named(result, byItem)).length;
  const real = unexplained(planted, byItem);
  const atHalf = heldAt(0.5, groups);
  return {
    headline: { label: 'Years read as planted', value: exact / graded.length, n: graded.length },
    accuracy: exact / graded.length,
    macroF1: stats?.macroF1 ?? null,
    rankingAuc: rankingAuc(planted, clean, patternProbability),
    precision: atHalf.held ? atHalf.real / atHalf.held : null,
    recall: real.length ? atHalf.real / real.length : null,
  };
}

/** The ranking the flag answer already carries, cut at a few probabilities. */
function probabilityCuts({ graded, planted, clean }) {
  if (!graded.length) return undefined;
  return [0.5, 0.7, 0.9, 0.95, 0.99].map((bar) => {
    const selected = graded.filter((result) => patternProbability(result) >= bar);
    return {
      probabilityOfAPattern: `${Math.round(bar * 100)}% or more`,
      yearsSelected: selected.length,
      cleanAmongThem: selected.filter((result) => clean.includes(result)).length,
      plantedAmongThem: selected.filter((result) => planted.includes(result)).length,
    };
  });
}

/** Two questions about each decoy, shown together so neither count hides the other. */
function decoyGrid(decoys) {
  if (!decoys.length) return undefined;
  const count = (explained, held) => decoys.filter((result) => result.evaluation.explained === explained && result.evaluation.investigate === held).length;
  return {
    explanationFoundAndSignedOff: count(true, false),
    explanationFoundAndHeldAnyway: count(true, true),
    explanationMissedAndSignedOff: count(false, false),
    explanationMissedAndHeld: count(false, true),
  };
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
    rowLabel: 'the pattern planted',
    columnLabel: 'the pattern the model named',
    columns: FLAGS.map(sentence),
    rows: FLAGS.map((actual) => ({
      label: sentence(actual),
      cells: FLAGS.map((predicted) => {
        const cell = graded.filter((result) => byItem.get(result.item.id).flag === actual && result.evaluation.flag === predicted);
        return { predicted, count: cell.length, diagonal: actual === predicted, items: cell.slice(0, 20).map((result) => result.item.id) };
      }),
    })),
  };
}

/** Where to cut the hold-for-review answer. The ceiling is the unexplained patterns, which are what a hold is for. */
function coverage(groups) {
  const real = unexplained(groups.planted, groups.byItem);
  const points = [0.5, 0.6, 0.7, 0.8, 0.9].map((threshold) => {
    const at = heldAt(threshold, groups);
    return { threshold, reviewed: at.held, caught: at.real, rate: at.held ? Number((at.real / at.held).toFixed(3)) : null };
  });
  return {
    title: 'Holding years for review, by how sure the answer has to be',
    xLabel: 'Company-years held for review',
    yLabel: 'Years with an unexplained pattern',
    rateLabel: 'Share of held years that have one',
    of: real.length,
    defaultIndex: 2,
    points,
  };
}

function findings(groups) {
  const { graded, planted, clean, decoys, byItem } = groups;
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
    if (gap > 0.8) lines.push(`The ranking is better than the decision: a planted year scores ${gap.toFixed(1)} points more serious than a clean one, so sorting by severity works even where the yes-or-no does not. Move the bar on the curve below rather than reading the count at 50%.`);
  }

  const atHalf = heldAt(0.5, groups);
  const stricter = heldAt(STRICTER_BAR, groups);
  const real = unexplained(planted, byItem);
  if (stricter.clean < atHalf.clean && stricter.real > 0) {
    lines.push(`Holding only the years answered at 70% or more means ${stricter.held} reviews instead of ${atHalf.held}, ${stricter.clean} clean years held instead of ${atHalf.clean}, and ${stricter.real} of ${real.length} real patterns still caught. The answer carries the information; the 50% line is the wrong place to cut it.`);
  }

  const auc = rankingAuc(planted, clean, patternProbability);
  const sure = probabilityCuts(groups)?.find((cut) => cut.probabilityOfAPattern.startsWith('95'));
  if (auc !== null && auc >= 0.9 && sure?.yearsSelected) {
    lines.push(`The named pattern looks like a failure and the probabilities behind it do not: ranked by the probability of any pattern, a planted year comes ahead of a clean one ${(auc * 100).toFixed(1)}% of the time, and the ${sure.yearsSelected} years at 95% or more include ${sure.plantedAmongThem} planted ones. These cuts were chosen on the same years they are scored on.`);
  }

  if (graded.length) {
    const exact = graded.filter((result) => named(result, byItem)).length;
    const byRule = graded.filter((result) => ruleFlag(result.item) === byItem.get(result.item.id).flag).length;
    if (byRule > exact) lines.push(`A rule beats the model at naming: ${byRule} of ${graded.length} against ${exact}, and answering "none" every time scores ${clean.length}. Each planted pattern moves one line far outside anything a clean year does, so five comparisons find most of them. The rule cannot read a note, which is the part of this job that needs a reader.`);
  }

  const repeated = graded.filter((result) => result.evaluation.second === result.evaluation.flag && result.evaluation.flag !== 'NONE');
  if (repeated.length > graded.length / 2) lines.push(`The second-pattern answer repeats the first in ${repeated.length} of ${graded.length} years. The question invites it, so "second pattern found" says little in this run.`);
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

const asPercent = (value) => `${Math.round(value * 100)}%`;
const yesNo = (value) => (value >= 0.5 ? `Yes · ${asPercent(value)}` : `No · ${asPercent(1 - value)}`);

function plantedNote(label) {
  if (label.flag === 'NONE') return 'Nothing was planted in this year.';
  const second = label.secondFlag !== 'NONE' ? `, with ${readable(label.secondFlag)} underneath` : '';
  if (label.decoy) return `Planted as ${readable(label.flag)} with an innocent explanation in the notes: the numbers show the pattern and only the note excuses it.`;
  return `Planted as ${readable(label.flag)}${second}, seriousness ${label.seriousness} of 5.`;
}

/** Right means the pattern named is the one planted, or "none" on a clean year: the report's first number. */
const grade = {
  labelId: (label) => label.companyYearId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.flag === label.flag,
      expected: label.flag,
      got: result.evaluation.flag,
      note: plantedNote(label),
      confidence: result.answers.flag.confidence,
    };
  },
};

function verdict(result) {
  const { answers, evaluation } = result;
  const nothing = evaluation.flag === 'NONE';
  const foundAndHeld = evaluation.explained && evaluation.investigate;
  const second = evaluation.second === 'NONE' ? 'None' : evaluation.second === evaluation.flag ? 'Repeats the first' : sentence(evaluation.second);

  return {
    eyebrow: 'What happens to this year',
    headline: `${evaluation.investigate ? 'Held for review' : 'Signed off'} · ${nothing ? 'nothing to see' : readable(evaluation.flag)}`,
    detail: foundAndHeld ? 'The note that explains the pattern was found, and the year was held anyway.' : undefined,
    facts: [
      { label: 'Strongest pattern', value: `${nothing ? 'None' : sentence(evaluation.flag)} · ${asPercent(evaluation.confidence)}`, tone: nothing ? 'good' : 'warn' },
      { label: 'Probability of any pattern', value: asPercent(patternProbability(result)) },
      { label: 'How serious', value: `${answers.severity.legend?.[Math.round(evaluation.severity)] ?? 'Score'} · ${evaluation.severity.toFixed(1)} of 6`, tone: evaluation.severity >= 4 ? 'bad' : undefined },
      { label: 'The notes explain it', value: yesNo(answers.business_explanation_exists.noul), tone: evaluation.explained ? 'good' : undefined },
      { label: 'Hold the sign-off', value: yesNo(answers.investigate.noul), tone: evaluation.investigate ? 'warn' : 'good' },
      { label: 'Second pattern', value: second },
    ],
  };
}

const stage = {
  hide: ['sectorId', 'yearsOnFile'],
  labels: {
    fiscalYearEnd: 'Year end',
    statements: 'Three years as filed',
    notes: 'Notes to the accounts',
    auditorHistory: 'Auditor history',
    costOfSales: 'Cost of sales',
    costsCapitalised: 'Costs capitalised',
    tradeReceivables: 'Trade receivables',
    tradePayables: 'Trade payables',
    operatingCashFlow: 'Operating cash flow',
  },
  highlight: ['tradeReceivables', 'inventory', 'costsCapitalised', 'operatingCashFlow'],
};

const present = {
  number: 165,
  problem: {
    headline: 'A reviewer signs off company-years one at a time. Most are fine, a few are not, and some that look wrong are explained in a note.',
    stat: '120',
    statLabel: 'company-years: 47 with a planted pattern, 10 of those explained',
  },
  hero: {
    item: 'AF-0027',
    caption: 'Beacon Holdings: inventory up 55% in a year when revenue fell 7%. Named as an inventory build, scored 4.5 of 6 and held for review at 91%.',
  },
  answers: {
    caption: 'The pattern, how serious it is, whether a note explains it, and whether to hold the sign-off. Each comes back with a probability.',
    reveal: ['flag', 'severity', 'business_explanation_exists', 'investigate'],
  },
  miss: {
    item: 'AF-0085',
    caption: 'Marlow Resources changed auditor and restated an earlier year. The model named capitalised costs at 93%: the restatement is only in the notes and the auditor history.',
  },
  proof: {
    kpis: ['Years read as planted', 'Planted years ranked above clean', 'Clean years held up'],
    chart: 'curve',
    closing: 'Hold the years answered at 70% or more: 52 of 120 reviewed, 34 of 37 real patterns caught, 9 clean years held instead of 51.',
  },
};

export default {
  id: 'accounting-flags',
  title: 'Accounting red flags',
  domain: 'screening',
  value: 'Find the statement patterns that deserve a second look, and tell them apart from the ones the notes already explain.',
  tags: ['screening', 'statements', 'forensic', 'text'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  caveat: 'Every planted pattern here moves one line far outside anything a clean year does, so a five-comparison rule names 111 of 120; the run says more about where to set the bar than about reading, and a subtler dataset is planned.',
  stage,
  grade,
  verdict,
  present,
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
