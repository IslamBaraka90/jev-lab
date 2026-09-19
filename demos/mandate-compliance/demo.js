// Mandate compliance: two hundred and forty checks, one policy rule against one portfolio. The rule is
// given in the words it was written in, with its tolerance and the policy's own definitions, and the
// number it asks about. Nothing is precomputed — no pass, no fail, no flag.

import { choice, noul, score } from '../lib/questions.js';

const KINDS = ['SINGLE_NAME', 'SECTOR', 'CREDIT_QUALITY', 'LIQUIDITY', 'LEVERAGE', 'PROHIBITED', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** One rule, one portfolio, one number, and the definitions that decide what the number means. */
function buildState(item, context) {
  return {
    task: 'Decide whether this portfolio breaches this rule on this date, and say what kind of breach it is.',
    policy: {
      manager: context.manager,
      measurement_date: context.measurementDate,
      definitions: context.definitions,
      note: context.note,
    },
    portfolio: { id: item.portfolioId, name: item.portfolioName, mandate: item.mandate },
    rule: {
      reference: item.ruleId,
      as_written: item.rule,
      limit: item.limit,
      limit_unit: item.limitUnit,
      the_limit_is_a_minimum: item.limitIsAFloor,
      tolerance: item.tolerance,
      what_is_measured: item.whatIsMeasured,
    },
    measurement: {
      value: item.measuredValue,
      unit: item.limitUnit,
      note: item.measurementNote,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  breach: noul('Does this portfolio breach this rule on the measurement date?', {
    yes: 'The number is on the wrong side of the limit, beyond any tolerance the rule allows.',
    no: 'The rule is met, or the difference is inside the tolerance the policy itself gives.',
  }),
  breach_kind: choice('What kind of rule is at issue?', {
    SINGLE_NAME: 'A limit on how much may sit in one issuer.',
    SECTOR: 'A limit on a sector, a country or a market.',
    CREDIT_QUALITY: 'A limit on credit rating or on how much may be rated below something.',
    LIQUIDITY: 'A limit on cash, on sellability, or on how much of an instrument is held.',
    LEVERAGE: 'A limit on gross exposure, borrowing or derivatives.',
    PROHIBITED: 'A rule that forbids something outright.',
    NONE: 'Nothing is at issue: the rule is met with room to spare.',
  }),
  severity: score('If it is a breach, how serious is it?', [
    'None', 'Technical', 'Minor', 'Notable', 'Material', 'Serious', 'Critical',
  ]),
  interpretation_dependent: noul('Does the answer depend on how the rule is read?', {
    yes: 'Two careful people reading this policy could reach different answers on this check.',
    no: 'The rule and the number decide it between them.',
  }),
};
// #endregion

// #region demo:evaluate
/** One line of the compliance report: breached or not, what kind, and how much it matters. */
function evaluate(answers, item) {
  const breach = answers.breach.noul >= 0.5;

  return {
    breach,
    kind: answers.breach_kind.choice,
    severity: answers.severity.score,
    interpretation: answers.interpretation_dependent.noul >= 0.5,
    confidence: answers.breach.noul >= 0.5 ? answers.breach.noul : 1 - answers.breach.noul,
    distanceFromLimit: Math.round((item.measuredValue - item.limit) * 100) / 100,
    label: `${item.id} · ${breach ? 'breach' : 'met'} · ${item.whatIsMeasured} ${item.measuredValue}${item.limitUnit === '%' ? '%' : ` ${item.limitUnit}`} against ${item.limit}`,
  };
}
// #endregion

// #region demo:report
/** Breaches, near misses and the eight that depend on a reading, each counted on its own. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.checkId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const breaches = graded.filter((result) => byItem.get(result.item.id).breach);
  const caught = breaches.filter((result) => result.evaluation.breach);
  const clean = graded.filter((result) => !byItem.get(result.item.id).breach);

  return {
    note: `Two hundred and forty checks: ${breaches.length} breaches, ${labels.filter((label) => label.kind === 'near miss').length} inside tolerance, and ${labels.filter((label) => label.kind === 'depends how you read it').length} that turn on how the rule is read. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis({ graded, breaches, caught, clean, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, breaches),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

function kpis({ graded, breaches, caught, clean, byItem }) {
  const falseBreaches = clean.filter((result) => result.evaluation.breach);
  const nearMisses = graded.filter((result) => byItem.get(result.item.id).kind === 'near miss');
  const nearMissesCalled = nearMisses.filter((result) => result.evaluation.breach);
  const awkward = graded.filter((result) => byItem.get(result.item.id).kind === 'depends how you read it');
  const awkwardFlagged = awkward.filter((result) => result.evaluation.interpretation);
  const kindRight = caught.filter((result) => result.evaluation.kind === byItem.get(result.item.id).ruleKind);

  return [
    { label: 'Breaches found', value: `${caught.length} of ${breaches.length}`, context: 'on the wrong side of the limit, beyond any tolerance', tone: caught.length === breaches.length ? 'good' : 'warn' },
    { label: 'Checks called a breach wrongly', value: `${falseBreaches.length} of ${clean.length}`, context: `${nearMissesCalled.length} of them are the ones sitting inside the tolerance`, tone: falseBreaches.length ? 'warn' : 'good' },
    { label: 'Rule kind named', value: `${kindRight.length} of ${caught.length}`, context: 'single name, sector, credit, liquidity, leverage or prohibited' },
    { label: 'Reading-dependent checks flagged', value: `${awkwardFlagged.length} of ${awkward.length}`, context: 'the ones where two careful people could disagree', tone: awkwardFlagged.length === awkward.length ? 'good' : 'warn' },
    { label: 'Report a compliance officer reads', value: `${graded.filter((result) => result.evaluation.breach).length} lines`, context: `out of ${graded.length} checks run` },
  ];
}

function checks(graded, byItem, labels) {
  const rows = ['SINGLE_NAME', 'SECTOR', 'CREDIT_QUALITY', 'LIQUIDITY', 'LEVERAGE', 'PROHIBITED'].map((kind) => {
    const group = labels.filter((label) => label.breach && label.ruleKind === kind);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.checkId);
      return !result || !result.evaluation.breach;
    });
    return { id: kind.toLowerCase().replaceAll('_', '-'), label: `${sentence(kind)} breaches missed`, detail: questions.breach_kind.criteria[kind], count: missed.length, of: group.length, items: missed.map((label) => label.checkId) };
  }).filter((row) => row.of > 0);

  const near = labels.filter((label) => label.kind === 'near miss');
  const calledNear = near.filter((label) => graded.some((result) => result.item.id === label.checkId && result.evaluation.breach));
  const awkward = labels.filter((label) => label.kind === 'depends how you read it');
  const missedAwkward = awkward.filter((label) => !graded.some((result) => result.item.id === label.checkId && result.evaluation.interpretation));
  return [
    ...rows,
    { id: 'near-miss', label: 'Inside tolerance, called a breach', detail: 'Thirty checks sitting inside the tolerance the policy itself allows.', count: calledNear.length, of: near.length, items: calledNear.map((label) => label.checkId) },
    { id: 'reading', label: 'Reading-dependent checks not flagged as such', detail: 'Eight checks where the policy’s own definitions do not settle the answer.', count: missedAwkward.length, of: awkward.length, items: missedAwkward.map((label) => label.checkId) },
  ];
}

function distribution(results) {
  return KINDS
    .map((kind) => ({ label: sentence(kind), count: results.filter((result) => result.evaluation.kind === kind).length, tone: kind === 'NONE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  const rows = ['SINGLE_NAME', 'SECTOR', 'CREDIT_QUALITY', 'LIQUIDITY', 'LEVERAGE', 'PROHIBITED'];
  return {
    title: 'Rule kind named against the rule that was checked',
    columns: rows.map(sentence),
    rows: rows.map((actual) => ({
      label: sentence(actual),
      cells: rows.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).ruleKind === actual && result.evaluation.kind === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, breaches) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const raised = graded.filter((result) => result.evaluation.severity >= bar && result.evaluation.breach);
    const real = raised.filter((result) => byItem.get(result.item.id).breach);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: raised.length, caught: real.length, rate: raised.length ? Number((real.length / raised.length).toFixed(3)) : null };
  });
  return { title: 'Severity and the report it produces', xLabel: 'Breaches reported at this severity or above', yLabel: 'Real breaches among them', rateLabel: 'Share of the reported lines that are real', of: breaches.length, points };
}

function findings(graded, byItem) {
  const lines = [];
  const missed = graded.filter((result) => byItem.get(result.item.id).breach && !result.evaluation.breach);
  if (missed.length) lines.push(`${missed.length} ${missed.length === 1 ? 'breach' : 'breaches'} did not make the report: ${missed.map((result) => result.item.id).join(', ')}.`);

  const near = graded.filter((result) => byItem.get(result.item.id).kind === 'near miss' && result.evaluation.breach);
  if (near.length >= 2) lines.push(`${near.length} checks inside the policy's own tolerance were written up as breaches. A tolerance a compliance report ignores is not a tolerance.`);

  const awkward = graded.filter((result) => byItem.get(result.item.id).kind === 'depends how you read it');
  const flagged = awkward.filter((result) => result.evaluation.interpretation);
  if (awkward.length) lines.push(`${flagged.length} of the ${awkward.length} checks that turn on a reading were marked as such. Those are the lines a compliance officer needs to see first, whichever way they were answered.`);

  const confident = graded.filter((result) => byItem.get(result.item.id).kind === 'depends how you read it' && !result.evaluation.interpretation);
  if (confident.length >= 3) lines.push(`${confident.length} of them were answered as if the policy settled it. The policy does not: the definitions are silent on exactly the point at issue.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => result.evaluation.breach)
    .sort((left, right) => right.evaluation.severity - left.evaluation.severity || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.breach ? '' : ` · ${byItem.get(result.item.id)?.kind}`}`,
      value: `${result.evaluation.severity.toFixed(1)} of 6`,
    }));
}

export default {
  id: 'mandate-compliance',
  title: 'Mandate compliance',
  domain: 'portfolio',
  value: 'Run a portfolio against its investment policy and list every breach, with how it happened.',
  tags: ['compliance', 'policy', 'portfolio', 'rules'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.portfolioId} · ${item.ruleId} · ${item.whatIsMeasured}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/mandate-compliance.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/mandate-compliance.js#demo:data',
    state: 'demos/mandate-compliance/demo.js#demo:state',
    questions: 'demos/mandate-compliance/demo.js#demo:questions',
    evaluate: 'demos/mandate-compliance/demo.js#demo:evaluate',
  },
};
