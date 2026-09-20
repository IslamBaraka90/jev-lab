// Mandate compliance: two hundred and forty checks, one policy rule against one portfolio. The rule is
// given in the words it was written in, with its tolerance and the policy's own definitions, and the
// number it asks about. Nothing is precomputed — no pass, no fail, no flag.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const ARGUABLE = 'depends how you read it';

const unitWords = (unit) => (unit === '%' ? '%' : ` ${unit}`);

/** How far past the limit the number sits, in the rule's own unit: positive is the wrong side, floor or cap. */
const beyondLimit = (item) => Math.round((item.limitIsAFloor ? item.limit - item.measuredValue : item.measuredValue - item.limit) * 100) / 100;

// The rule: a breach is a number past the limit by more than the tolerance, mirrored for a minimum.
const arithmeticRule = (item) => beyondLimit(item) > item.tolerance;

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
    distanceFromLimit: beyondLimit(item),
    label: `${item.id} · ${breach ? 'breach' : 'met'} · ${item.whatIsMeasured} ${item.measuredValue}${unitWords(item.limitUnit)} against ${item.limit}${unitWords(item.limitUnit)}`,
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
  // The arguable checks have no right answer, so accuracy is counted over the rest.
  const settled = graded.filter((result) => byItem.get(result.item.id).kind !== ARGUABLE);
  const matrix = confusion(settled, byItem);
  const stats = matrixStats(matrix);

  return {
    note: `Two hundred and forty checks: ${breaches.length} breaches, ${labels.filter((label) => label.kind === 'near miss').length} inside tolerance, and ${labels.filter((label) => label.kind === 'depends how you read it').length} that turn on how the rule is read. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis({ graded, breaches, caught, clean, settled, byItem }),
    distribution: distribution(results),
    distributionTitle: 'What the checks became',
    baselines: baselines(settled, byItem, stats),
    metrics: metrics(settled, byItem, stats),
    matrix,
    curve: coverage(graded, byItem, breaches),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
    topItemsTitle: 'The report, most serious first',
  };
}
// #endregion

function kpis({ graded, breaches, caught, clean, settled, byItem }) {
  const kindOf = (result) => byItem.get(result.item.id).kind;
  const right = settled.filter((result) => result.evaluation.breach === byItem.get(result.item.id).breach);
  const settledClean = clean.filter((result) => kindOf(result) !== ARGUABLE);
  const falseBreaches = settledClean.filter((result) => result.evaluation.breach);
  const awkward = graded.filter((result) => kindOf(result) === ARGUABLE);
  const awkwardCalled = awkward.filter((result) => result.evaluation.breach);
  const awkwardFlagged = awkward.filter((result) => result.evaluation.interpretation);
  const flagged = graded.filter((result) => result.evaluation.interpretation);
  const lines = graded.filter((result) => result.evaluation.breach);
  const flagIsPrecise = flagged.length > 0 && awkwardFlagged.length / flagged.length >= 0.5;

  return [
    { label: 'Settled checks right', value: `${right.length} of ${settled.length}`, context: `breach or met, on every check the policy settles · the ${awkward.length} arguable ones are not scored`, tone: right.length === settled.length ? 'good' : 'warn' },
    { label: 'Breaches found', value: `${caught.length} of ${breaches.length}`, context: 'on the wrong side of the limit, beyond any tolerance', tone: caught.length === breaches.length ? 'good' : 'warn' },
    { label: 'Checks called a breach wrongly', value: `${falseBreaches.length} of ${settledClean.length}`, context: `clear passes and checks inside the limit · ${awkwardCalled.length} of the ${awkward.length} arguable checks were also called a breach`, tone: falseBreaches.length ? 'warn' : 'good' },
    { label: 'Reading-dependent checks flagged', value: `${awkwardFlagged.length} of ${awkward.length}`, context: `the flag fired on ${flagged.length} checks in all, so ${share(awkwardFlagged.length, flagged.length)} of its flags are real`, tone: awkwardFlagged.length === awkward.length && flagIsPrecise ? 'good' : 'warn' },
    { label: 'Report a compliance officer reads', value: `${lines.length} lines`, context: `out of ${graded.length} checks run: ${caught.length} breaches, ${awkwardCalled.length} arguable, ${falseBreaches.length} that should not be there` },
  ];
}

function baselines(settled, byItem, stats) {
  const total = settled.length;
  if (!total) return [];
  const count = (hits) => `${hits} of ${total}`;
  const modelRight = settled.filter((result) => result.evaluation.breach === byItem.get(result.item.id).breach).length;
  const ruleRight = settled.filter((result) => arithmeticRule(result.item) === byItem.get(result.item.id).breach).length;
  const majority = Math.round((stats?.majorityBaseline ?? 0) * total);
  return [
    { label: 'Jev', detail: 'breach or met, on the checks the policy settles', value: modelRight / total, display: count(modelRight), model: true },
    { label: 'Rule: past the limit by more than the tolerance', detail: 'one comparison, mirrored for a minimum; it cannot see the arguable checks at all', value: ruleRight / total, display: count(ruleRight) },
    { label: 'Always the commonest answer', detail: (stats?.majorityClass ?? 'met').toLowerCase(), value: majority / total, display: count(majority) },
  ];
}

function metrics(settled, byItem, stats) {
  const breachClass = stats?.classes.find((entry) => entry.label === 'Breach');
  const onTheFence = settled.filter((result) => result.evaluation.confidence < 0.65);
  return {
    headline: { label: 'Settled checks right', value: stats?.accuracy ?? 0, n: settled.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: breachClass?.precision ?? null,
    recall: breachClass?.recall ?? null,
    automationRate: settled.length ? 1 - onTheFence.length / settled.length : null,
  };
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
  const breached = results.filter((result) => result.evaluation.breach);
  const flaggedOnly = results.filter((result) => !result.evaluation.breach && result.evaluation.interpretation);
  return [
    { label: 'Met', count: results.length - breached.length - flaggedOnly.length, tone: 'good' },
    { label: 'Met, but flagged as a matter of reading', count: flaggedOnly.length, tone: 'warn' },
    { label: 'Reported as a breach', count: breached.length, tone: 'bad' },
  ].filter((entry) => entry.count);
}

// Breach against met, over the checks the policy settles. The rule kind is a property of the rule
// text, not a judgement, so it is not what the matrix shows.
function confusion(settled, byItem) {
  const sides = [['Breach', true], ['Met', false]];
  return {
    title: 'Breach or met, against what the numbers and the tolerance say',
    rowLabel: 'what the policy gives',
    columnLabel: 'what the model answered',
    columns: sides.map(([name]) => name),
    rows: sides.map(([name, actual]) => ({
      label: name,
      cells: sides.map(([, predicted]) => ({
        predicted,
        count: settled.filter((result) => byItem.get(result.item.id).breach === actual && result.evaluation.breach === predicted).length,
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
  return { title: 'Severity and the report it produces', xLabel: 'Breaches reported at this severity or above', yLabel: 'Real breaches among them', rateLabel: 'Share of the reported lines that are real', of: breaches.length, points, thresholdFormat: 'level', levels: 6, defaultIndex: 2 };
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

  const everyFlag = graded.filter((result) => result.evaluation.interpretation);
  if (everyFlag.length >= 10 && flagged.length / everyFlag.length < 0.5) lines.push(`The same flag was raised on ${everyFlag.length} checks in all, ${everyFlag.length - flagged.length} of them checks the policy settles. A flag that is right ${share(flagged.length, everyFlag.length)} of the time sends a compliance officer to the wrong lines.`);

  const settled = graded.filter((result) => byItem.get(result.item.id).kind !== ARGUABLE);
  const modelRight = settled.filter((result) => result.evaluation.breach === byItem.get(result.item.id).breach).length;
  const ruleRight = settled.filter((result) => arithmeticRule(result.item) === byItem.get(result.item.id).breach).length;
  if (settled.length && ruleRight >= modelRight) lines.push(`One comparison, past the limit by more than the tolerance, is right on ${ruleRight} of the ${settled.length} settled checks, against ${modelRight} for the model. Anything the model adds over a spreadsheet is in the ${awkward.length} arguable checks, and there its flag is not yet precise enough to lean on.`);

  const shaky = shakiestRule(graded);
  if (shaky && shaky.count >= 3) lines.push(`${shaky.count} of the ${shaky.of} answers on rule ${shaky.ruleId} sit between 35% and 65%, on the decision line. That is the rule to read by hand.`);

  if (graded.length >= 20 && graded.every((result) => result.evaluation.kind === byItem.get(result.item.id).ruleKind)) lines.push(`The rule kind was named right on all ${graded.length} checks, but it restates the rule text rather than judging the portfolio, so it is not counted as a result.`);
  return lines;
}

/** The rule id with the most answers sitting on the decision line. */
function shakiestRule(graded) {
  const byRule = new Map();
  for (const result of graded) {
    const entry = byRule.get(result.item.ruleId) ?? { ruleId: result.item.ruleId, count: 0, of: 0 };
    entry.of += 1;
    if (result.evaluation.confidence < 0.65) entry.count += 1;
    byRule.set(result.item.ruleId, entry);
  }
  return [...byRule.values()].sort((left, right) => right.count - left.count)[0] ?? null;
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

const PLANTED_NOTES = {
  breach: 'Planted as a breach: past the limit by more than the tolerance.',
  'near miss': 'Planted close to the limit but on the compliant side of it.',
  'clear pass': 'Planted as a clear pass, with room to spare.',
};

const level = (question, value) => `${question.criteria[Math.round(value)] ?? '–'} · ${value.toFixed(1)} of ${question.criteria.length - 1}`;
const amount = (value, unit) => `${value}${unitWords(unit)}`;

/** Breach or met against the label. The arguable checks have no right answer and stay ungraded. */
function judge(result, label) {
  if (!label || label.kind === ARGUABLE) return null;
  return {
    agree: result.evaluation.breach === label.breach,
    expected: label.breach ? 'BREACH' : 'MET',
    got: result.evaluation.breach ? 'BREACH' : 'MET',
    note: PLANTED_NOTES[label.kind],
    confidence: result.evaluation.confidence,
  };
}

function verdict(result) {
  const { evaluation, answers, item } = result;
  const beyond = evaluation.distanceFromLimit;
  const position = beyond > 0 ? `${amount(beyond, item.limitUnit)} past the limit` : `${amount(Math.abs(beyond), item.limitUnit)} of headroom`;
  const facts = [
    { label: 'Measured against the limit', value: `${amount(item.measuredValue, item.limitUnit)} against a ${item.limitIsAFloor ? 'minimum' : 'maximum'} of ${amount(item.limit, item.limitUnit)}` },
    { label: 'Where that leaves it', value: `${position} · tolerance ${amount(item.tolerance, item.limitUnit)}`, tone: beyond > item.tolerance ? 'bad' : beyond > 0 ? 'warn' : 'good' },
    { label: 'Breach', value: `${evaluation.breach ? 'Yes' : 'No'} · ${Math.round(evaluation.confidence * 100)}%`, tone: evaluation.confidence < 0.65 ? 'warn' : evaluation.breach ? 'bad' : 'good' },
    { label: 'Depends on how the rule is read', value: `${evaluation.interpretation ? 'Yes' : 'No'} · ${Math.round(Math.max(answers.interpretation_dependent.noul, 1 - answers.interpretation_dependent.noul) * 100)}%`, tone: evaluation.interpretation ? 'warn' : undefined },
  ];
  if (evaluation.breach) facts.splice(3, 0, { label: 'How serious', value: level(questions.severity, evaluation.severity), tone: evaluation.severity >= 3 ? 'bad' : 'warn' });

  return {
    eyebrow: `${item.portfolioName} · rule ${item.ruleId}`,
    headline: evaluation.breach ? `Breach · ${item.whatIsMeasured}` : `Met · ${item.whatIsMeasured}`,
    detail: evaluation.interpretation ? 'Flagged as a matter of reading: a person should see this line whichever way it was answered.' : undefined,
    facts,
  };
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
  caveat: 'All thirty near misses sit on the compliant side of the limit and carry a note saying they are inside tolerance, and a note appears only on near misses and arguable checks, so this run does not show that tolerance was understood; a cohort over the limit but inside tolerance is planned.',
  stage: {
    hide: ['portfolioId', 'ruleKind'],
    labels: {
      portfolioName: 'Portfolio',
      ruleId: 'Rule',
      rule: 'The rule as written',
      limitIsAFloor: 'The limit is a minimum',
      limitUnit: 'Unit',
      whatIsMeasured: 'What is measured',
      measuredValue: 'Measured value',
      measurementNote: 'Note on the measurement',
    },
    highlight: ['measuredValue', 'limit', 'tolerance'],
  },
  grade: { labelId: (label) => label.checkId, judge },
  verdict,
  present: {
    number: 145,
    problem: {
      headline: 'Twelve funds, twenty rules each. Somebody checks every one by hand each month, and most of them are fine.',
      stat: '240',
      statLabel: 'policy checks, 26 of them real breaches',
    },
    hero: {
      item: 'P-ZETA-R07',
      caption: 'The bond sleeve must average A- or better, seven notches below AAA. It measures 9.3 notches, far past a quarter-notch tolerance.',
    },
    answers: {
      caption: 'Breach at 96%, graded material at 4.3 of 6, and not a matter of reading: the rule and the number settle it.',
      reveal: ['breach', 'severity', 'interpretation_dependent'],
    },
    miss: {
      item: 'P-DELTA-R14',
      caption: 'Borrowing is not permitted and the figure is −0.3%, which is no borrowing at all. It was called a breach at 58%; seven answers on this rule sit on the line.',
    },
    proof: {
      kpis: ['Settled checks right', 'Breaches found', 'Reading-dependent checks flagged'],
      chart: 'baselines',
      closing: '240 checks became a 34-line report with all 26 breaches in it; one comparison in a spreadsheet does as well on every check the policy settles.',
    },
  },
  explain: {
    data: 'scripts/generate/mandate-compliance.js#demo:data',
    state: 'demos/mandate-compliance/demo.js#demo:state',
    questions: 'demos/mandate-compliance/demo.js#demo:questions',
    evaluate: 'demos/mandate-compliance/demo.js#demo:evaluate',
  },
};
