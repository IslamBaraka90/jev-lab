// Sanctions name matching against a fictional list: compare complete records, defer thin evidence,
// and grade identity, disposition and the field that actually settles the candidate.

import { choice, noul, score } from '../lib/questions.js';

const EVIDENCE = ['DATE_OF_BIRTH', 'NATIONALITY', 'ADDRESS', 'IDENTIFIER', 'NAME_FORM_ONLY', 'INSUFFICIENT'];
const DISPOSITIONS = ['CLEAR', 'REVIEW', 'CONFIRM'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';

// #region demo:state
/** Sends both complete records, the engine score and the fictional matching policy; never the label. */
function buildState(item, context) {
  return {
    task: 'Compare the two identity records and choose a defensible screening disposition.',
    fictional_notice: context.fictionalNotice,
    matching_rules: context.matchingRules,
    candidate_pair: item,
  };
}
// #endregion

// #region demo:questions
const questions = {
  same_entity: noul('Are the customer and the fictional list entry the same person?', { yes: 'The available fields support one identity.', no: 'The records are different people.' }),
  deciding_evidence: choice('Which field should settle this candidate?', {
    DATE_OF_BIRTH: 'The date or age difference is decisive.', NATIONALITY: 'Nationality or country evidence is decisive.', ADDRESS: 'The address evidence is decisive.',
    IDENTIFIER: 'An identifier fragment confirms or contradicts identity.', NAME_FORM_ONLY: 'Only the spelling or transliteration supports the hit.', INSUFFICIENT: 'Material fields are missing, so the candidate cannot be settled.',
  }),
  match_strength: score('How strong is the identity match?', ['No resemblance', 'Weak', 'Possible', 'Likely', 'Strong', 'Very strong', 'Identical']),
  disposition: choice('What should happen to this fictional screening candidate?', {
    CLEAR: 'Clear the false positive.', REVIEW: 'Hold for more identity evidence.', CONFIRM: 'Keep the candidate as a confirmed identity match.',
  }),
  needs_more_data: noul('Is more identity data needed before this candidate can be settled?', { yes: 'The current record is materially incomplete.', no: 'The visible evidence is sufficient.' }),
};
// #endregion

// #region demo:evaluate
/** Turns the five answers into one identity call while preserving an explicit insufficient outcome. */
function evaluate(answers, item) {
  const probability = answers.same_entity.noul;
  const disposition = answers.disposition.choice;
  return {
    flagged: disposition !== 'CLEAR',
    sameEntityProbability: probability,
    predictedSame: probability >= 0.5,
    decidingEvidence: answers.deciding_evidence.choice,
    matchStrength: answers.match_strength.score,
    disposition,
    needsMoreData: answers.needs_more_data.noul >= 0.5,
    label: `${item.id}: ${readable(disposition)} · ${probability >= 0.5 ? 'same identity' : 'different identity'}`,
  };
}
// #endregion

// #region demo:report
/** Grades true matches, false positives and legitimate deferrals without turning uncertainty into an error. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.pairId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const sufficient = graded.filter((result) => intended.get(result.item.id).decidingField !== 'INSUFFICIENT');
  const insufficient = graded.filter((result) => intended.get(result.item.id).decidingField === 'INSUFFICIENT');
  const trueMatches = sufficient.filter((result) => intended.get(result.item.id).sameEntity);
  const falseMatches = sufficient.filter((result) => !intended.get(result.item.id).sameEntity);
  const correctIdentity = sufficient.filter((result) => result.evaluation.predictedSame === intended.get(result.item.id).sameEntity);
  const kept = trueMatches.filter((result) => result.evaluation.disposition === 'CONFIRM');
  const cleared = falseMatches.filter((result) => result.evaluation.disposition === 'CLEAR');
  const deferred = insufficient.filter((result) => result.evaluation.decidingEvidence === 'INSUFFICIENT' && result.evaluation.disposition === 'REVIEW');
  const evidenceRight = graded.filter((result) => result.evaluation.decidingEvidence === intended.get(result.item.id).decidingField);

  return {
    note: `${graded.length} candidates against a wholly fictional list. Illustrative only; never a screening decision.`,
    kpis: [
      { label: 'Identity accuracy', value: share(correctIdentity.length + deferred.length, graded.length), context: `${correctIdentity.length} sufficient calls plus ${deferred.length} correct deferrals` },
      { label: 'True matches kept', value: share(kept.length, trueMatches.length), context: `${kept.length} of ${trueMatches.length}`, tone: kept.length === trueMatches.length ? 'good' : 'warn' },
      { label: 'False positives cleared', value: share(cleared.length, falseMatches.length), context: `${cleared.length} of ${falseMatches.length}` },
      { label: 'Deciding evidence', value: share(evidenceRight.length, graded.length), context: `${evidenceRight.length} of ${graded.length} fields` },
    ],
    distribution: DISPOSITIONS.map((value) => ({ label: value, count: graded.filter((result) => result.evaluation.disposition === value).length, tone: value === 'CLEAR' ? 'good' : value === 'REVIEW' ? 'warn' : 'bad' })),
    matrix: identityMatrix(graded, intended),
    checks: causeChecks(graded, intended),
    topItems: graded.filter((result) => result.evaluation.needsMoreData).slice(0, 12).map((result) => ({ id: result.item.id, label: `${result.item.customer.name} · more data requested`, value: readable(result.evaluation.decidingEvidence) })),
    insufficient: { correct: deferred.length, total: insufficient.length },
  };
}
// #endregion

function predictedClass(result) {
  if (result.evaluation.decidingEvidence === 'INSUFFICIENT' || result.evaluation.disposition === 'REVIEW') return 'INSUFFICIENT';
  return result.evaluation.predictedSame ? 'SAME' : 'DIFFERENT';
}

function identityMatrix(graded, intended) {
  const classes = ['SAME', 'DIFFERENT', 'INSUFFICIENT'];
  const actualClass = (label) => label.decidingField === 'INSUFFICIENT' ? 'INSUFFICIENT' : label.sameEntity ? 'SAME' : 'DIFFERENT';
  return {
    title: 'Identity outcome: planted against called',
    columns: classes.map(readable),
    rows: classes.map((actual) => ({ label: readable(actual), cells: classes.map((predicted) => ({ predicted, count: graded.filter((result) => actualClass(intended.get(result.item.id)) === actual && predictedClass(result) === predicted).length, diagonal: actual === predicted })) })),
  };
}

function causeChecks(graded, intended) {
  const causes = ['TRANSLITERATION', 'COMMON_SURNAME', 'FATHER_SON', 'DOB_ONE_DIGIT', 'CITY_COUNTRY', 'INSUFFICIENT'];
  return causes.map((cause) => {
    const group = graded.filter((result) => intended.get(result.item.id).cause === cause);
    const wrong = group.filter((result) => {
      const label = intended.get(result.item.id);
      if (cause === 'INSUFFICIENT') return predictedClass(result) !== 'INSUFFICIENT';
      return result.evaluation.predictedSame !== label.sameEntity;
    });
    return { id: cause.toLowerCase(), label: `${readable(cause)} candidates mishandled`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
}

export default {
  id: 'sanctions-name-match',
  title: 'Sanctions name matching',
  domain: 'fraud',
  value: 'Decide whether a screening hit is the same person, and say which piece of evidence settled it.',
  caveat: 'Fictional watchlist and fictional people. Illustrative identity matching only—never a screening decision.',
  tags: ['fraud', 'sanctions', 'identity', 'screening', 'compliance'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'comparison',
  pairKeys: ['customer', 'listEntry'],
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.customer.name} ↔ ${item.listEntry.primaryName}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/sanctions-name-match.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/sanctions-name-match.js#demo:data',
    state: 'demos/sanctions-name-match/demo.js#demo:state',
    questions: 'demos/sanctions-name-match/demo.js#demo:questions',
    evaluate: 'demos/sanctions-name-match/demo.js#demo:evaluate',
  },
};
