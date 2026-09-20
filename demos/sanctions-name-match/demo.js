// Sanctions name matching against a fictional list: compare complete records, defer thin evidence,
// and grade identity, disposition and the field that actually settles the candidate.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const EVIDENCE = ['DATE_OF_BIRTH', 'NATIONALITY', 'ADDRESS', 'IDENTIFIER', 'NAME_FORM_ONLY', 'INSUFFICIENT'];
const DISPOSITIONS = ['CLEAR', 'REVIEW', 'CONFIRM'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';
// Confirming a true match is the job, so only the undecided lane is a warning.
const DISPOSITION_TONES = { CLEAR: 'good', REVIEW: 'warn', CONFIRM: undefined };
// Where the same-person answer is read for the curve's opening position.
const IDENTITY_CUTS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const SUGGESTED_CUT = 0.7;

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

  const groups = { graded, sufficient, insufficient, trueMatches, falseMatches, correctIdentity, kept, cleared, deferred, evidenceRight };

  return {
    note: `${graded.length} candidates against a wholly fictional list. Illustrative only; never a screening decision.`,
    findings: findings(groups, intended),
    kpis: kpis(groups, intended),
    baselines: baselines(graded, intended),
    metrics: metrics(groups, intended),
    distribution: DISPOSITIONS.map((value) => ({ label: sentence(value), count: graded.filter((result) => result.evaluation.disposition === value).length, tone: DISPOSITION_TONES[value] })),
    distributionTitle: 'What happens to each hit',
    matrix: identityMatrix(graded, intended),
    curve: identityCurve(sufficient, intended),
    checks: causeChecks(graded, intended),
    topItems: worthOpening(graded, intended),
    topItemsTitle: 'False confirms, missed deferrals, then the closest calls',
    insufficient: { correct: deferred.length, total: insufficient.length },
  };
}
// #endregion

const settledAsPlanted = (result, intended) => result.evaluation.disposition === intended.get(result.item.id).expectedDisposition;

/** Sufficient records where the same-person answer, read at `cut`, disagrees with the planted identity. */
function identityErrorsAt(sufficient, intended, cut) {
  return sufficient.filter((result) => (result.evaluation.sameEntityProbability >= cut) !== intended.get(result.item.id).sameEntity);
}

function kpis(groups, intended) {
  const { graded, sufficient, trueMatches, falseMatches, correctIdentity, kept, cleared, deferred, insufficient } = groups;
  const settled = graded.filter((result) => settledAsPlanted(result, intended));
  const held = falseMatches.filter((result) => result.evaluation.disposition === 'REVIEW');
  const falseConfirms = falseMatches.filter((result) => result.evaluation.disposition === 'CONFIRM');
  const errorsAtHalf = identityErrorsAt(sufficient, intended, 0.5).length;
  return [
    { label: 'Hits settled as planted', value: share(settled.length, graded.length), context: `${settled.length} of ${graded.length}: confirm, clear or defer, whichever the record supports`, tone: settled.length === graded.length ? 'good' : settled.length * 2 >= graded.length ? 'warn' : 'bad' },
    { label: 'True matches kept', value: share(kept.length, trueMatches.length), context: `${kept.length} of ${trueMatches.length}`, tone: kept.length === trueMatches.length ? 'good' : 'bad' },
    { label: 'False positives cleared', value: share(cleared.length, falseMatches.length), context: `${cleared.length} of ${falseMatches.length} · ${held.length} held for review, ${falseConfirms.length} confirmed`, tone: cleared.length === falseMatches.length ? 'good' : 'warn' },
    { label: 'Identity accuracy', value: share(correctIdentity.length + deferred.length, graded.length), context: `${correctIdentity.length} same-person answers right at a 0.5 cut, ${errorsAtHalf} wrong, plus ${deferred.length} of ${insufficient.length} correct deferrals · counts a hit as right even when it was not cleared` },
    { label: `Identity errors at a ${SUGGESTED_CUT} cut`, value: `${identityErrorsAt(sufficient, intended, SUGGESTED_CUT).length} of ${sufficient.length}`, context: `against ${errorsAtHalf} at 0.5 · the same answers, read at a higher bar`, tone: identityErrorsAt(sufficient, intended, SUGGESTED_CUT).length ? 'warn' : 'good' },
  ];
}

// The rule: confirm when the customer's identifier fragment is on the list entry, defer when the customer has none, otherwise clear.
function ruleDisposition(item) {
  const fragment = item.customer.identifierFragment;
  if (!fragment) return 'REVIEW';
  return (item.listEntry.identifierFragments ?? []).includes(fragment) ? 'CONFIRM' : 'CLEAR';
}

function baselines(graded, intended) {
  if (!graded.length) return undefined;
  const rightShare = (pick) => graded.filter((result) => pick(result) === intended.get(result.item.id).expectedDisposition).length / graded.length;
  const trueMatches = graded.filter((result) => intended.get(result.item.id).expectedDisposition === 'CONFIRM').length;
  return [
    { label: 'Jev', detail: 'disposition agrees with the planted one', value: rightShare((result) => result.evaluation.disposition), model: true },
    { label: 'Rule: compare the identifier fragment', detail: 'confirm on a matching fragment, defer when there is none, otherwise clear', value: rightShare((result) => ruleDisposition(result.item)) },
    { label: 'Always clear', detail: `the commonest disposition; loses all ${trueMatches} true matches`, value: rightShare(() => 'CLEAR') },
  ];
}

function metrics(groups, intended) {
  const { graded, trueMatches, falseMatches, kept, cleared } = groups;
  const settled = graded.filter((result) => settledAsPlanted(result, intended));
  const confirmed = graded.filter((result) => result.evaluation.disposition === 'CONFIRM');
  const decided = graded.filter((result) => result.evaluation.disposition !== 'REVIEW');
  return {
    headline: { label: 'Hits settled as planted', value: graded.length ? settled.length / graded.length : 0, n: graded.length },
    accuracy: graded.length ? settled.length / graded.length : null,
    macroF1: matrixStats(identityMatrix(graded, intended))?.macroF1 ?? null,
    precision: confirmed.length ? kept.length / confirmed.length : null,
    recall: trueMatches.length ? kept.length / trueMatches.length : null,
    automationRate: graded.length ? decided.length / graded.length : null,
    automationPrecision: decided.length ? decided.filter((result) => settledAsPlanted(result, intended)).length / decided.length : null,
    falsePositivesCleared: falseMatches.length ? cleared.length / falseMatches.length : null,
  };
}

function findings(groups, intended) {
  const { graded, sufficient, falseMatches, evidenceRight } = groups;
  const lines = [];
  const review = graded.filter((result) => result.evaluation.disposition === 'REVIEW');
  const wantsMore = graded.filter((result) => result.evaluation.needsMoreData);
  if (review.length * 2 >= graded.length) lines.push(`${review.length} of ${graded.length} hits were held for review and ${wantsMore.length} were said to need more data. The model keeps every true match and declines to decide most of the rest, so the analyst's desk barely shrinks.`);

  const falseConfirms = falseMatches.filter((result) => result.evaluation.disposition === 'CONFIRM');
  if (falseConfirms.length) lines.push(`${falseConfirms.length} different ${falseConfirms.length === 1 ? 'person was' : 'people were'} confirmed as the listed one: ${falseConfirms.map((result) => result.item.id).join(', ')}. A false confirm freezes an innocent customer.`);

  const atHalf = identityErrorsAt(sufficient, intended, 0.5).length;
  const atSuggested = identityErrorsAt(sufficient, intended, SUGGESTED_CUT).length;
  if (atHalf > atSuggested) lines.push(`Read at 0.5, the same-person answer is wrong on ${atHalf} of ${sufficient.length} records; read at ${SUGGESTED_CUT}, on ${atSuggested}. The misses sit just above 0.5 while the true matches answer far higher, so this is where the bar is set, not a misreading of the records.`);

  const ruleRight = graded.filter((result) => ruleDisposition(result.item) === intended.get(result.item.id).expectedDisposition);
  const modelRight = graded.filter((result) => settledAsPlanted(result, intended));
  if (graded.length >= 10 && ruleRight.length > modelRight.length) lines.push(`Comparing one field, the identifier fragment, settles ${ruleRight.length} of ${graded.length} hits as planted; the model settles ${modelRight.length}. In this dataset that field gives the identity away.`);

  const swap = commonestEvidenceSwap(graded, intended);
  if (swap && swap.count >= 10) lines.push(`The deciding field was named on ${evidenceRight.length} of ${graded.length}. The commonest slip, ${swap.count} times: planted ${readable(swap.planted)}, called ${readable(swap.called)}.`);
  return lines;
}

function commonestEvidenceSwap(graded, intended) {
  const counts = new Map();
  for (const result of graded) {
    const planted = intended.get(result.item.id).decidingField;
    const called = result.evaluation.decidingEvidence;
    if (planted !== called) counts.set(`${planted}>${called}`, (counts.get(`${planted}>${called}`) ?? 0) + 1);
  }
  const top = [...counts].sort((left, right) => right[1] - left[1])[0];
  if (!top) return null;
  const [planted, called] = top[0].split('>');
  return { planted, called, count: top[1] };
}

/** How many hits stay "possibly the same person" as the bar on the same-person answer moves. */
function identityCurve(sufficient, intended) {
  const trueMatches = sufficient.filter((result) => intended.get(result.item.id).sameEntity).length;
  const points = IDENTITY_CUTS.map((cut) => {
    const called = sufficient.filter((result) => result.evaluation.sameEntityProbability >= cut);
    const caught = called.filter((result) => intended.get(result.item.id).sameEntity).length;
    return { threshold: cut, reviewed: called.length, caught, rate: called.length ? Number((caught / called.length).toFixed(3)) : null };
  });
  return { title: 'Where the same-person answer is read', xLabel: 'Hits called the same person', yLabel: 'True matches among them', rateLabel: 'Share of those that really are', of: trueMatches, points, defaultIndex: IDENTITY_CUTS.indexOf(SUGGESTED_CUT) };
}

/** The false confirms, then thin records that were not deferred, then the different people scored closest to a match. */
function worthOpening(graded, intended) {
  const rank = (result) => {
    const label = intended.get(result.item.id);
    if (!label.sameEntity && result.evaluation.disposition === 'CONFIRM') return 0;
    if (label.decidingField === 'INSUFFICIENT' && result.evaluation.decidingEvidence !== 'INSUFFICIENT') return 1;
    return label.sameEntity ? 3 : 2;
  };
  return [...graded]
    .filter((result) => rank(result) < 3)
    .sort((left, right) => rank(left) - rank(right) || right.evaluation.sameEntityProbability - left.evaluation.sameEntityProbability)
    .slice(0, 12)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.id} · ${result.item.customer.name} · ${readable(result.evaluation.disposition)} · planted ${readable(intended.get(result.item.id).cause)}`,
      value: `same person ${result.evaluation.sameEntityProbability.toFixed(2)}`,
    }));
}

function predictedClass(result) {
  if (result.evaluation.decidingEvidence === 'INSUFFICIENT' || result.evaluation.disposition === 'REVIEW') return 'INSUFFICIENT';
  return result.evaluation.predictedSame ? 'SAME' : 'DIFFERENT';
}

function identityMatrix(graded, intended) {
  const classes = ['SAME', 'DIFFERENT', 'INSUFFICIENT'];
  const actualClass = (label) => label.decidingField === 'INSUFFICIENT' ? 'INSUFFICIENT' : label.sameEntity ? 'SAME' : 'DIFFERENT';
  return {
    title: 'Identity outcome: planted against called',
    rowLabel: 'what was planted',
    columnLabel: 'what the model called, with review counted as insufficient',
    columns: classes.map(readable),
    rows: classes.map((actual) => ({ label: readable(actual), cells: classes.map((predicted) => ({ predicted, count: graded.filter((result) => actualClass(intended.get(result.item.id)) === actual && predictedClass(result) === predicted).length, diagonal: actual === predicted })) })),
  };
}

function causeChecks(graded, intended) {
  const causes = ['TRANSLITERATION', 'COMMON_SURNAME', 'FATHER_SON', 'DOB_ONE_DIGIT', 'CITY_COUNTRY', 'INSUFFICIENT'];
  const names = {
    TRANSLITERATION: 'Transliterated names called the same person',
    COMMON_SURNAME: 'Common surnames called the same person',
    FATHER_SON: 'Fathers and sons called the same person',
    DOB_ONE_DIGIT: 'Dates of birth one digit apart called the same person',
    CITY_COUNTRY: 'Same city, different country, called the same person',
    INSUFFICIENT: 'Thin records not deferred as insufficient',
  };
  return causes.map((cause) => {
    const group = graded.filter((result) => intended.get(result.item.id).cause === cause);
    const wrong = group.filter((result) => {
      const label = intended.get(result.item.id);
      if (cause === 'INSUFFICIENT') {
        return result.evaluation.decidingEvidence !== 'INSUFFICIENT' || result.evaluation.disposition !== 'REVIEW';
      }
      return result.evaluation.predictedSame !== label.sameEntity;
    });
    return { id: cause.toLowerCase(), label: names[cause], detail: cause === 'INSUFFICIENT' ? 'Right only when the deciding field is insufficient and the hit is held for review.' : 'The same-person answer read at 0.5.', count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
}

const strengthName = (value) => questions.match_strength.criteria[Math.max(0, Math.min(6, Math.round(value)))];
const joined = (values) => (values?.length ? values.join(', ') : null);
const addressLine = (address) => (address ? [address.line1, address.city, address.country].filter(Boolean).join(', ') : null);

/** The five identity fields side by side, customer against list entry, then why the engine raised the hit. */
function comparisonRows(item) {
  const { customer, listEntry, screeningEngine } = item;
  const otherNames = (listEntry.aliases ?? []).filter((alias) => alias !== listEntry.primaryName);
  return [
    { label: 'Name', left: customer.name, right: otherNames.length ? `${listEntry.primaryName} · also ${otherNames.join(', ')}` : listEntry.primaryName },
    { label: 'Date of birth', left: customer.dateOfBirth, right: joined(listEntry.datesOfBirth) },
    { label: 'Nationality', left: customer.nationality, right: joined(listEntry.nationalities) },
    { label: 'Address', left: addressLine(customer.address), right: joined((listEntry.addresses ?? []).map(addressLine)) },
    { label: 'Identifier fragment', left: customer.identifierFragment, right: joined(listEntry.identifierFragments) },
    { label: 'Why the engine raised it', left: `fuzzy name score ${screeningEngine.fuzzyNameScore.toFixed(2)}`, right: screeningEngine.generatedCandidateBecause },
    { label: 'List programme (fictional)', left: null, right: listEntry.program },
  ];
}

const CAUSE_NOTES = {
  TRUE_MATCH: 'Planted as a true match.',
  TRANSLITERATION: 'Planted as a different person whose name transliterates the same way.',
  COMMON_SURNAME: 'Planted as a different person with a common surname.',
  FATHER_SON: 'Planted as a father and son: same name, a generation apart.',
  DOB_ONE_DIGIT: 'Planted as a different person whose date of birth is one digit away.',
  CITY_COUNTRY: 'Planted as a different person in the same city of a different country.',
  CLEAR_FALSE: 'Planted as a plainly different person.',
  INSUFFICIENT: 'Planted as a thin record: the fields that would settle it are missing.',
};

// Right means the disposition the record supports, which is what "Hits settled as planted" counts.
const grade = {
  labelId: (label) => label.pairId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.disposition === label.expectedDisposition,
      expected: label.expectedDisposition,
      got: result.evaluation.disposition,
      note: `${CAUSE_NOTES[label.cause] ?? ''} Settled by: ${readable(label.decidingField)}.`.trim(),
      confidence: result.answers.disposition.confidence,
    };
  },
};

function verdict(result) {
  const { answers, evaluation } = result;
  const probability = evaluation.sameEntityProbability;
  return {
    eyebrow: 'What happens to this hit',
    headline: `${sentence(evaluation.disposition)} · ${evaluation.predictedSame ? 'same person' : 'different person'} ${probability.toFixed(2)}`,
    detail: 'Fictional list and fictional people. Never a screening decision.',
    facts: [
      { label: 'Same person', value: `${Math.round(probability * 100)}%`, tone: probability >= SUGGESTED_CUT ? 'bad' : probability >= 0.4 ? 'warn' : 'good' },
      { label: 'Match strength', value: `${strengthName(evaluation.matchStrength)} · ${evaluation.matchStrength.toFixed(1)} of 6` },
      { label: 'Field that settles it', value: readable(evaluation.decidingEvidence) },
      { label: 'Needs more identity data', value: `${evaluation.needsMoreData ? 'Yes' : 'No'} · ${Math.round(Math.max(answers.needs_more_data.noul, 1 - answers.needs_more_data.noul) * 100)}%`, tone: evaluation.needsMoreData ? 'warn' : 'good' },
      { label: 'Confidence in the disposition', value: `${Math.round(answers.disposition.confidence * 100)}%` },
    ],
  };
}

const stage = {
  hide: ['notice', 'fictional'],
  labels: { listEntry: 'List entry (fictional)', primaryName: 'Primary name', dateOfBirth: 'Date of birth', datesOfBirth: 'Dates of birth', identifierFragment: 'Identifier fragment', identifierFragments: 'Identifier fragments', fuzzyNameScore: 'Fuzzy name score', generatedCandidateBecause: 'Why the engine raised it' },
  highlight: ['dateOfBirth', 'nationality', 'identifierFragment'],
};

const present = {
  number: 124,
  problem: {
    headline: 'A fuzzy name engine raised 200 hits against a fictional list. Someone has to say which are the listed person and clear the rest with a reason.',
    stat: '200',
    statLabel: 'hits, 18 of them true matches',
  },
  hero: {
    item: 'SNC-0004',
    caption: 'Nabeel Farouk against Nabil Farouk: the alias, the date of birth, the address and the identifier all agree. Same person 0.95, confirm.',
  },
  answers: {
    caption: 'Same person or not, the field that settles it, and what happens to the hit.',
    reveal: ['same_entity', 'deciding_evidence', 'disposition'],
  },
  miss: {
    item: 'SNC-0007',
    caption: 'Lina Hedded is Moroccan and the listed Lina Haddad is Jordanian. The model named nationality as the deciding field, put same person at 0.47, and still confirmed the hit.',
  },
  proof: {
    kpis: ['True matches kept', 'False positives cleared', 'Identity errors at a 0.7 cut'],
    chart: 'curve',
    closing: '18 of 18 true matches kept, and 29 of 170 false hits cleared: 152 of the 200 are still on an analyst’s desk.',
  },
};

export default {
  id: 'sanctions-name-match',
  title: 'Sanctions name matching',
  domain: 'fraud',
  value: 'Decide whether a screening hit is the same person, and say which piece of evidence settled it.',
  caveat: 'Fictional watchlist and fictional people. Illustrative identity matching only—never a screening decision. Every true match shares its identifier fragment with the list entry and no false one does, so one field gives the identity away; a harder dataset is planned.',
  tags: ['fraud', 'sanctions', 'identity', 'screening', 'compliance'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'comparison',
  pairKeys: ['customer', 'listEntry'],
  comparisonRows,
  stage,
  itemLabel: (item) => `${item.id} · ${item.customer.name} ↔ ${item.listEntry.primaryName}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/sanctions-name-match.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/sanctions-name-match.js#demo:data',
    state: 'demos/sanctions-name-match/demo.js#demo:state',
    questions: 'demos/sanctions-name-match/demo.js#demo:questions',
    evaluate: 'demos/sanctions-name-match/demo.js#demo:evaluate',
  },
};
