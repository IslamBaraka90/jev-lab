import { choice, noul, score } from '../lib/questions.js';

const SYMPTOMS = ['PARAMETER_CLIFF', 'FEW_TRADES', 'LOOK_AHEAD', 'SURVIVORSHIP', 'COSTS_OMITTED', 'NONE'];
const sentence = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';

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
  const falseDoubt = honest.filter((result) => result.evaluation.trust < 4 || result.evaluation.risk >= 3);
  const overTrusted = problems.filter((result) => result.evaluation.trust >= 4);
  const gallery = [...graded].sort((left, right) => left.evaluation.trust - right.evaluation.trust || right.evaluation.risk - left.evaluation.risk || left.item.id.localeCompare(right.item.id));
  return {
    note: `${graded.length} synthetic reports generated with seed 1184. The answer key stays outside the demo folder; it is joined only after all recorded answers are complete. ${context.note ?? ''}`,
    findings: [
      `${correct.length} of ${graded.length} reports had their planted main symptom named exactly.`,
      `${falseDoubt.length} of ${honest.length} honest, deliberately modest backtests were doubted below fair trust or graded at least moderate risk.`,
      `${overTrusted.length} of ${problems.length} flawed reports still received fair-or-higher trust.`,
    ],
    kpis: [
      { label: 'Symptom accuracy', value: pct(correct.length, graded.length), context: `${correct.length} exact calls of ${graded.length}`, tone: correct.length >= graded.length * 0.75 ? 'good' : 'warn' },
      { label: 'Honest false-doubt rate', value: pct(falseDoubt.length, honest.length), context: `${falseDoubt.length} of ${honest.length} honest reports`, tone: falseDoubt.length <= honest.length * 0.2 ? 'good' : 'warn' },
      { label: 'Flawed reports over-trusted', value: pct(overTrusted.length, problems.length), context: `${overTrusted.length} of ${problems.length} given trust 4–6`, tone: overTrusted.length ? 'warn' : 'good' },
      { label: 'Forward tests proposed', value: `${graded.filter((result) => result.evaluation.forward).length} of ${graded.length}`, context: 'a forward test is not the same as believing the backtest' },
    ],
    distribution: SYMPTOMS.map((symptom) => ({ label: sentence(symptom), count: graded.filter((result) => result.evaluation.symptom === symptom).length, tone: symptom === 'NONE' ? 'good' : 'warn' })).filter((entry) => entry.count),
    matrix: symptomMatrix(graded, byItem),
    overfitGallery: { title: 'All curves, worst trust first', rows: gallery.map((result) => ({ id: result.item.id, trust: result.evaluation.trust, risk: result.evaluation.risk, symptom: result.evaluation.symptom, planted: byItem.get(result.item.id), curve: result.item.equityCurve })) },
    checks: [
      { id: 'wrong-symptom', label: 'Main symptom misidentified', detail: 'Exact planted class against the single symptom named.', count: graded.length - correct.length, of: graded.length, items: graded.filter((result) => result.evaluation.symptom !== byItem.get(result.item.id)).map((result) => result.item.id) },
      { id: 'false-doubt', label: 'Honest backtest wrongly doubted', detail: 'Honest report below fair trust or at moderate-or-higher risk.', count: falseDoubt.length, of: honest.length, items: falseDoubt.map((result) => result.item.id) },
      { id: 'over-trusted', label: 'Flawed backtest trusted', detail: 'A planted failure still received trust of four or more.', count: overTrusted.length, of: problems.length, items: overTrusted.map((result) => result.item.id) },
    ],
    topItems: gallery.slice(0, 14).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${sentence(byItem.get(result.item.id))} planted` })),
  };
}
// #endregion

function symptomMatrix(graded, byItem) {
  return {
    title: 'Planted credibility problem against Jev’s main symptom',
    columns: SYMPTOMS.map(sentence),
    rows: SYMPTOMS.map((actual) => ({ label: sentence(actual), cells: SYMPTOMS.map((predicted) => { const items = graded.filter((result) => byItem.get(result.item.id) === actual && result.evaluation.symptom === predicted).map((result) => result.item.id); return { predicted, count: items.length, diagonal: actual === predicted, items }; }) })),
  };
}

export default {
  id: 'overfit-review', title: 'Overfit review', domain: 'strategy',
  value: 'Look at a backtest report the way a sceptic would, and say how much of it to believe.',
  tags: ['strategy', 'backtest', 'overfitting', 'research'], dataClass: 'synthetic', readMinutes: 5, view: 'curve', status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.strategy.name} · ${item.tradeCount} trades`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), labels: () => import('../../data/synthetic/overfit-review.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/overfit-review.js', state: 'demos/overfit-review/demo.js#demo:state', questions: 'demos/overfit-review/demo.js#demo:questions', evaluate: 'demos/overfit-review/demo.js#demo:evaluate' },
};
