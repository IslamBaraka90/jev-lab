import { matrixStats } from '../lib/metrics.js';
import { choice, noul, rubricOf, score } from '../lib/questions.js';

const SYMPTOMS = ['PARAMETER_CLIFF', 'FEW_TRADES', 'LOOK_AHEAD', 'SURVIVORSHIP', 'COSTS_OMITTED', 'NONE'];
const sentence = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Review this backtest as a sceptical research lead. Identify the main credibility problem, decide how much to trust, and say whether a clean forward test is still worthwhile.',
    scale_note: context.scale,
    strategy_and_selected_parameters: item.strategy,
    research_period: item.period,
    equity_curve: item.equityCurve,
    trades: { count: item.tradeCount, return_distribution: item.tradeReturnDistribution },
    parameter_sensitivity_grid: item.parameterGrid,
    costs_as_stated: item.costAssumptions,
    universe_as_stated: item.universe,
    signal_and_fill_timing_as_stated: item.signalAndExecution,
    ...(item.validation ? { untouched_validation_as_stated: item.validation } : {}),
    note: 'The grid, curve, population, costs and event timing are evidence. No credibility verdict is supplied.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  overfit_risk: score('How high is the risk that this reported edge is not real?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain']),
  symptom: choice('What is the main credibility symptom?', Object.fromEntries(SYMPTOMS.map((value) => [value, sentence(value)]))),
  trust: score('How much of this result should be trusted?', ['None', 'Very little', 'Little', 'Some', 'Fair', 'High', 'Full']),
  worth_forward_testing: noul('Is the idea still worth a clean forward test?', { yes: 'There is enough here to test prospectively under corrected rules.', no: 'The report offers too little credible evidence to justify it.' }),
  curve_too_smooth: noul('Is the equity curve implausibly smooth for the stated strategy?', { yes: 'Its path itself is a warning sign.', no: 'The path has plausible variation; any problem lies elsewhere.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    risk: answers.overfit_risk.score,
    symptom: answers.symptom.choice,
    trust: answers.trust.score,
    forward: answers.worth_forward_testing.noul >= 0.5,
    tooSmooth: answers.curve_too_smooth.noul >= 0.5,
    confidence: answers.symptom.confidence,
    label: `${item.id} · ${sentence(answers.symptom.choice)} · trust ${answers.trust.score.toFixed(1)} of 6`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const byItem = new Map((context.labels ?? []).map((label) => [label.backtestId, label.kind]));
  const graded = results.filter((result) => result.evaluation && byItem.has(result.item.id));
  const honest = graded.filter((result) => byItem.get(result.item.id) === 'NONE');
  const problems = graded.filter((result) => byItem.get(result.item.id) !== 'NONE');
  const correct = graded.filter((result) => result.evaluation.symptom === byItem.get(result.item.id));
  const falseDoubt = honest.filter((result) => result.evaluation.symptom !== 'NONE' || result.evaluation.trust < 2 || result.evaluation.risk >= 5);
  const overTrusted = problems.filter((result) => result.evaluation.trust >= 4);
  const tally = { graded, honest, problems, correct, falseDoubt, overTrusted };
  const gallery = [...graded].sort((left, right) => left.evaluation.trust - right.evaluation.trust || right.evaluation.risk - left.evaluation.risk || left.item.id.localeCompare(right.item.id));
  return {
    note: `${graded.length} synthetic reports generated with seed 1184. The answer key stays outside the demo folder; it is joined only after all recorded answers are complete. ${context.note ?? ''}`,
    findings: findings(tally, byItem),
    kpis: kpis(tally),
    baselines: baselines(graded, byItem),
    metrics: metrics(tally, symptomMatrix(graded, byItem)),
    distributionTitle: 'Main symptom named',
    distribution: SYMPTOMS.map((symptom) => ({ label: sentence(symptom), count: graded.filter((result) => result.evaluation.symptom === symptom).length, tone: symptom === 'NONE' ? 'good' : 'warn' })).filter((entry) => entry.count),
    matrix: symptomMatrix(graded, byItem),
    overfitGallery: { title: 'All curves, worst trust first', rows: gallery.map((result) => ({ id: result.item.id, trust: result.evaluation.trust, risk: result.evaluation.risk, symptom: result.evaluation.symptom, planted: byItem.get(result.item.id), curve: result.item.equityCurve })) },
    checks: [
      { id: 'wrong-symptom', label: 'Main symptom misidentified', detail: 'Exact planted class against the single symptom named.', count: graded.length - correct.length, of: graded.length, items: graded.filter((result) => result.evaluation.symptom !== byItem.get(result.item.id)).map((result) => result.item.id) },
      { id: 'false-doubt', label: 'Honest backtest wrongly doubted', detail: 'Honest report assigned a flaw, risk of five or more, or trust below two.', count: falseDoubt.length, of: honest.length, items: falseDoubt.map((result) => result.item.id) },
      { id: 'over-trusted', label: 'Flawed backtest trusted', detail: 'A planted failure still received trust of four or more.', count: overTrusted.length, of: problems.length, items: overTrusted.map((result) => result.item.id) },
    ],
    topItemsTitle: 'Misread reports first, then the least trusted',
    topItems: worthOpening(graded, byItem, gallery),
  };
}
// #endregion

const TRUST_LEVELS = rubricOf(questions.trust);
const RISK_LEVELS = rubricOf(questions.overfit_risk);
const level = (names, value) => `${names[Math.round(value)]} · ${value.toFixed(1)} of 6`;

/**
 * Rule: read the stated fields in order. A fill lag of zero is look-ahead, zero commission is omitted
 * costs, a universe that is not point-in-time is survivorship, under thirty trades is too few, no
 * validation block is a parameter cliff, and anything else is honest.
 */
function ruleSymptom(item) {
  if (item.signalAndExecution?.lagBars === 0) return 'LOOK_AHEAD';
  if (item.costAssumptions?.commissionBasisPoints === 0) return 'COSTS_OMITTED';
  if (item.universe?.pointInTime === false) return 'SURVIVORSHIP';
  if (item.tradeCount < 30) return 'FEW_TRADES';
  if (!item.validation) return 'PARAMETER_CLIFF';
  return 'NONE';
}

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const right = (pick) => graded.filter((result) => pick(result) === byItem.get(result.item.id)).length;
  const model = right((result) => result.evaluation.symptom);
  const rule = right((result) => ruleSymptom(result.item));
  const honest = right(() => 'NONE');
  return [
    { label: 'Jev', detail: `planted symptom named exactly, ${model} of ${graded.length}`, value: model / graded.length, model: true },
    { label: 'Rule: read five stated fields in order', detail: `six lines over fields in the state, no curve and no grid, ${rule} of ${graded.length}`, value: rule / graded.length },
    { label: 'Always none', detail: `the commonest class, ${honest} of ${graded.length}`, value: honest / graded.length },
  ];
}

function metrics(tally, matrix) {
  const { graded, correct, honest, falseDoubt } = tally;
  const stats = matrixStats(matrix);
  return {
    headline: { label: 'Symptom accuracy', value: graded.length ? correct.length / graded.length : 0, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    contradictionRate: honest.length ? falseDoubt.length / honest.length : null,
  };
}

function kpis(tally) {
  const { graded, honest, problems, correct, falseDoubt, overTrusted } = tally;
  const trusts = (list) => list.map((result) => result.evaluation.trust);
  const separated = honest.length > 0 && problems.length > 0 && Math.max(...trusts(problems)) < Math.min(...trusts(honest));
  const forward = graded.filter((result) => result.evaluation.forward).length;
  const smoothHonest = honest.filter((result) => result.evaluation.tooSmooth).length;
  const highestTrust = graded.length ? Math.max(...trusts(graded)) : 0;
  return [
    { label: 'Symptom accuracy', value: pct(correct.length, graded.length), context: `${correct.length} exact calls of ${graded.length}; a six-line rule over the stated fields is scored beside it below`, tone: correct.length >= graded.length * 0.75 ? 'good' : 'warn' },
    { label: 'Honest false-doubt rate', value: pct(falseDoubt.length, honest.length), context: `${falseDoubt.length} of ${honest.length} honest reports`, tone: falseDoubt.length <= honest.length * 0.2 ? 'good' : 'warn' },
    { label: 'Average trust · honest vs flawed', value: `${average(trusts(honest)).toFixed(2)} vs ${average(trusts(problems)).toFixed(2)}`, context: separated ? `no overlap: the most trusted flawed report (${Math.max(...trusts(problems)).toFixed(2)}) sits below the least trusted honest one (${Math.min(...trusts(honest)).toFixed(2)})` : 'same 0–6 trust rubric, joined to the planted class after answering', tone: separated ? 'good' : undefined },
    { label: 'Flawed reports over-trusted', value: pct(overTrusted.length, problems.length), context: `${overTrusted.length} of ${problems.length} given trust 4–6; the highest trust given to anything was ${highestTrust.toFixed(2)}, so this bar was never in reach`, tone: overTrusted.length ? 'warn' : undefined },
    { label: 'Forward tests proposed', value: `${forward} of ${graded.length}`, context: `and ${smoothHonest} of ${honest.length} honest, deliberately noisy curves were called implausibly smooth: an answer that never changes says nothing about any one report`, tone: graded.length > 0 && forward === graded.length ? 'warn' : undefined },
  ];
}

function findings(tally, byItem) {
  const { graded, honest, problems, correct, falseDoubt, overTrusted } = tally;
  const ruleRight = graded.filter((result) => ruleSymptom(result.item) === byItem.get(result.item.id)).length;
  const forward = graded.filter((result) => result.evaluation.forward).length;
  const lines = [
    `${correct.length} of ${graded.length} reports had their planted main symptom named exactly.`,
    `${falseDoubt.length} of ${honest.length} honest, deliberately modest backtests were assigned a flaw, very-high risk, or less-than-little trust.`,
    `${overTrusted.length} of ${problems.length} flawed reports still received fair-or-higher trust.`,
  ];
  if (graded.length && ruleRight >= correct.length) lines.push(`A six-line rule that reads five stated fields in order names ${ruleRight} of ${graded.length}, ${ruleRight > correct.length ? 'more than' : 'as many as'} the model. Every planted flaw is written into a single field and only the honest reports carry a validation block, so this set measures reading the report and not judging it.`);
  if (graded.length && forward === graded.length) lines.push(`A forward test was proposed for all ${graded.length} reports, flawed or not.`);
  return lines;
}

/** The reports a reader should open: every misread one first, then the ones trusted least. */
function worthOpening(graded, byItem, gallery) {
  const wrong = graded.filter((result) => result.evaluation.symptom !== byItem.get(result.item.id));
  const rest = gallery.filter((result) => !wrong.includes(result));
  return [...wrong, ...rest].slice(0, 14).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${sentence(byItem.get(result.item.id))} planted` }));
}

// The one stated field that bears on each symptom, shown beside the call it supports.
const EVIDENCE = {
  LOOK_AHEAD: (item) => ({ label: 'Fill lag as stated', value: `${item.signalAndExecution.lagBars} bars · ${item.signalAndExecution.fillAssumption.toLowerCase()}`, tone: item.signalAndExecution.lagBars === 0 ? 'bad' : undefined }),
  COSTS_OMITTED: (item) => ({ label: 'Commission as stated', value: `${item.costAssumptions.commissionBasisPoints} basis points`, tone: item.costAssumptions.commissionBasisPoints === 0 ? 'bad' : undefined }),
  SURVIVORSHIP: (item) => ({ label: 'Universe point-in-time', value: item.universe.pointInTime ? 'Yes' : 'No', tone: item.universe.pointInTime ? undefined : 'bad' }),
  FEW_TRADES: (item) => ({ label: 'Trades behind the curve', value: String(item.tradeCount), tone: item.tradeCount < 30 ? 'bad' : undefined }),
  PARAMETER_CLIFF: (item) => ({ label: 'Untouched validation', value: item.validation ? 'Stated' : 'None stated', tone: item.validation ? undefined : 'warn' }),
  NONE: (item) => ({ label: 'Untouched validation', value: item.validation ? `Sharpe ${item.validation.developmentSharpe} in development, ${item.validation.holdoutSharpe} held out` : 'None stated', tone: item.validation ? 'good' : 'warn' }),
};

function judge(result, label) {
  if (!label || !result.evaluation) return null;
  const agree = result.evaluation.symptom === label.kind;
  const planted = label.kind === 'NONE' ? 'an honest control with a held-out period' : `a planted ${sentence(label.kind).toLowerCase()}`;
  return {
    agree,
    expected: label.kind,
    got: result.evaluation.symptom,
    note: `This report is ${planted}.${agree ? '' : ' Only the symptom named is graded here, not trust or risk.'}`,
    confidence: result.evaluation.confidence,
  };
}

function verdict(result) {
  const { evaluation, item, answers } = result;
  const clean = evaluation.symptom === 'NONE';
  return {
    eyebrow: 'The sceptic’s read of this backtest',
    headline: `${clean ? 'No main flaw named' : sentence(evaluation.symptom)} · trust ${evaluation.trust.toFixed(1)} of 6`,
    facts: [
      { label: 'Main symptom', value: `${sentence(evaluation.symptom)} · ${Math.round(evaluation.confidence * 100)}%`, tone: clean ? 'good' : 'bad' },
      EVIDENCE[evaluation.symptom](item),
      { label: 'Trust in the result', value: level(TRUST_LEVELS, evaluation.trust), tone: evaluation.trust < 2.5 ? 'warn' : undefined },
      { label: 'Risk the edge is not real', value: level(RISK_LEVELS, evaluation.risk), tone: evaluation.risk >= 4 ? 'warn' : undefined },
      { label: 'Worth a clean forward test', value: `${evaluation.forward ? 'Yes' : 'No'} · ${Math.round(answers.worth_forward_testing.noul * 100)}%` },
    ],
  };
}

const PRESENT = {
  number: 184,
  problem: {
    headline: 'Every backtest that reaches a research lead looks good. The job is to say what is wrong with it.',
    stat: '140',
    statLabel: 'backtest reports, 74 with a planted flaw and 66 honest',
  },
  hero: {
    item: 'OR-0005',
    caption: 'An earnings-drift backtest that turned $100,000 into $313,921 over 212 trades. The report states a fill lag of zero bars; the model named look-ahead and gave it trust 1.7 of 6.',
  },
  answers: {
    caption: 'The symptom, trust and risk carry the read. The forward-test answer was yes for all 140 reports, so it says nothing about this one.',
    reveal: ['symptom', 'trust', 'overfit_risk', 'worth_forward_testing'],
  },
  miss: {
    item: 'OR-0044',
    caption: 'An honest momentum backtest with a flat parameter plateau and a held-out period. The model called it a parameter cliff at 36% confidence: one of two misses, both doubting a clean report.',
  },
  proof: {
    kpis: ['Symptom accuracy', 'Honest false-doubt rate', 'Average trust · honest vs flawed'],
    chart: 'baselines',
    closing: '138 of 140, on a set where a six-line rule over the stated fields scores 140 of 140.',
  },
};

function symptomMatrix(graded, byItem) {
  return {
    title: 'Planted credibility problem against Jev’s main symptom',
    rowLabel: 'the problem planted in the report',
    columnLabel: 'the main symptom the model named',
    columns: SYMPTOMS.map(sentence),
    rows: SYMPTOMS.map((actual) => ({ label: sentence(actual), cells: SYMPTOMS.map((predicted) => { const items = graded.filter((result) => byItem.get(result.item.id) === actual && result.evaluation.symptom === predicted).map((result) => result.item.id); return { predicted, count: items.length, diagonal: actual === predicted, items }; }) })),
  };
}

export default {
  id: 'overfit-review', title: 'Overfit review', domain: 'strategy',
  value: 'Look at a backtest report the way a sceptic would, and say how much of it to believe.',
  tags: ['strategy', 'backtest', 'overfitting', 'research'], dataClass: 'synthetic', readMinutes: 5, view: 'curve',
  itemLabel: (item) => `${item.id} · ${item.strategy.name} · ${item.tradeCount} trades`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/overfit-review.labels.json'),
  buildState, questions, evaluate, report,
  caveat: 'The labels can be read from the shape of the state: only honest reports carry a validation block and every flaw is written into one stated field, so a six-line rule scores 140 of 140. This run measures reading a report, not judging one; a harder set is planned.',
  grade: { labelId: (label) => label.backtestId, judge }, verdict, present: PRESENT,
  explain: { data: 'scripts/generate/overfit-review.js', state: 'demos/overfit-review/demo.js#demo:state', questions: 'demos/overfit-review/demo.js#demo:questions', evaluate: 'demos/overfit-review/demo.js#demo:evaluate' },
};
