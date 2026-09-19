// Ninety documents: results releases, risk-factor sections and call excerpts, all invented. What is
// planted is what a reader is supposed to pull out — guidance moved or held, tone against the numbers,
// a risk that was not in last quarter's list, a share sale mentioned once in passing.
//
// The two things this demo separates on purpose: a new risk at the top of a list against one buried
// two thirds of the way down, and numbers that beat against a tone that drops anyway. Both are easy
// to get right on average and easy to miss where it counts.

import { choice, noul, score } from '../lib/questions.js';

const GUIDANCE = ['RAISED', 'MAINTAINED', 'CUT', 'WITHDRAWN', 'NOT_MENTIONED'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

// #region demo:state
/** The document as filed, and the period before it where there is one. Nothing summarised. */
function buildState(item, context) {
  return {
    task: 'Read this document and say what it changes: the guidance, the tone against the numbers, any risk that was not there last time, and anything disclosed in passing.',
    company: { ticker: item.ticker, name: item.company, sector: item.sector },
    document_kind: context.documentKinds[item.kind],
    published_on: item.publishedOn,
    period: item.quarter,
    title: item.title,
    document: item.text,
    the_period_before: item.priorPeriod,
    note: 'Everything here is invented. Read it as you would read the real thing.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  guidance_change: choice('What happened to guidance in this document?', {
    RAISED: 'The outlook was moved up.',
    MAINTAINED: 'The outlook was repeated unchanged.',
    CUT: 'The outlook was moved down.',
    WITHDRAWN: 'The outlook was taken away and not replaced.',
    NOT_MENTIONED: 'Guidance is not addressed in this document at all.',
  }),
  tone_shift: score('How has the tone moved since the period before?', [
    'Much worse', 'Worse', 'Slightly worse', 'Unchanged', 'Slightly better', 'Better', 'Much better',
  ]),
  new_risk_factor: noul('Is there a risk here that was not there last time?', {
    yes: 'Something in this document is not in the previous period’s list.',
    no: 'Everything here has been disclosed before.',
  }),
  insider_transaction_significant: noul('Is there an insider transaction worth noticing?', {
    yes: 'Somebody inside the company bought or sold, and the size or the timing of it matters.',
    no: 'Either there is none, or it is the routine kind that tells you nothing.',
  }),
  numbers_and_tone_agree: noul('Do the numbers and the language point the same way?', {
    yes: 'What the figures say and what the management says are the same story.',
    no: 'One of them is better than the other, and the gap is the point.',
  }),
};
// #endregion

// #region demo:evaluate
/** One read of one document, before any label is in the room. */
function evaluate(answers, item) {
  return {
    guidance: answers.guidance_change.choice,
    tone: answers.tone_shift.score,
    newRisk: answers.new_risk_factor.noul >= 0.5,
    insider: answers.insider_transaction_significant.noul >= 0.5,
    insiderStrength: answers.insider_transaction_significant.noul,
    agree: answers.numbers_and_tone_agree.noul >= 0.5,
    confidence: answers.guidance_change.confidence,
    label: `${item.id} · ${item.ticker} · ${item.title} · guidance ${readable(answers.guidance_change.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Guidance, tone, the buried risks and the five passing mentions, each scored on its own terms. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.documentId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const of = (field, value) => graded.filter((result) => byItem.get(result.item.id)[field] === value);

  return {
    note: `Ninety invented documents: thirty results releases, thirty risk sections and thirty call excerpts. ${context.note ?? ''}`,
    findings: findings(graded, byItem, of),
    kpis: kpis(graded, byItem, of),
    distribution: distribution(graded),
    matrix: guidanceMatrix(graded, byItem),
    curve: coverage(graded, byItem),
    checks: checks(graded, byItem, of, labels),
    topItems: topItems(graded, byItem),
  };
}
// #endregion

function kpis(graded, byItem, of) {
  const rightGuidance = graded.filter((result) => result.evaluation.guidance === byItem.get(result.item.id).guidance);
  const moved = graded.filter((result) => ['RAISED', 'CUT', 'WITHDRAWN'].includes(byItem.get(result.item.id).guidance));
  const movedRight = moved.filter((result) => result.evaluation.guidance === byItem.get(result.item.id).guidance);
  const buried = of('newRisk', 'BURIED');
  const obvious = of('newRisk', 'OBVIOUS');
  const beats = graded.filter((result) => byItem.get(result.item.id).beatButWorse);
  const spottedGap = beats.filter((result) => !result.evaluation.agree);
  const significant = of('insider', 'SIGNIFICANT');
  const routine = of('insider', 'ROUTINE');
  const toneError = average(graded.map((result) => Math.abs(result.evaluation.tone - byItem.get(result.item.id).toneShift)));
  // The brief asks for this one on the page: long documents are what a token budget is spent on.
  const chars = graded.map((result) => JSON.stringify(result.state ?? {}).length);
  const longest = Math.max(0, ...chars);

  return [
    { label: 'Guidance read correctly', value: `${rightGuidance.length} of ${graded.length}`, context: 'raised, maintained, cut, withdrawn or never mentioned', tone: rightGuidance.length >= graded.length * 0.8 ? 'good' : 'warn' },
    { label: 'Guidance that moved, caught', value: `${movedRight.length} of ${moved.length}`, context: 'the thirty-eight documents where the outlook actually changed' },
    { label: 'New risk found, buried', value: `${buried.filter((result) => result.evaluation.newRisk).length} of ${buried.length}`, context: 'two thirds of the way down a list of fifteen or more', tone: buried.length && buried.filter((result) => result.evaluation.newRisk).length >= buried.length * 0.6 ? 'good' : 'warn' },
    { label: 'New risk found, near the top', value: `${obvious.filter((result) => result.evaluation.newRisk).length} of ${obvious.length}`, context: 'the same kind of risk, in the first three lines' },
    { label: 'Numbers beat, tone dropped', value: `${spottedGap.length} of ${beats.length}`, context: 'documents where the figures improved and the language did not', tone: beats.length && spottedGap.length >= beats.length * 0.6 ? 'good' : 'warn' },
    { label: 'Insider sale that mattered', value: `${significant.filter((result) => result.evaluation.insider).length} of ${significant.length}`, context: `${routine.filter((result) => result.evaluation.insider).length} of ${routine.length} routine ones were called significant too` },
    { label: 'How hard it leaned on that', value: `${average(significant.map((result) => result.evaluation.insiderStrength)).toFixed(2)} against ${average(routine.map((result) => result.evaluation.insiderStrength)).toFixed(2)}`, context: 'the yes-or-no is the same for both; the strength behind it is not', tone: average(significant.map((result) => result.evaluation.insiderStrength)) - average(routine.map((result) => result.evaluation.insiderStrength)) > 0.15 ? 'good' : 'warn' },
    { label: 'Tone off by', value: `${toneError.toFixed(2)} points`, context: 'average distance from the planted shift, on a seven-point scale', tone: toneError < 1 ? 'good' : 'warn' },
    { label: 'What a document costs', value: `${Math.round(average(chars)).toLocaleString('en-GB')} characters`, context: `the average state sent for one document; the longest is ${longest.toLocaleString('en-GB')}` },
  ];
}

function checks(graded, byItem, of, labels) {
  const byGuidance = GUIDANCE.map((value) => {
    const group = labels.filter((label) => label.guidance === value);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.documentId);
      return !result || result.evaluation.guidance !== value;
    });
    return { id: value.toLowerCase(), label: `Guidance ${readable(value)}, read as something else`, detail: questions.guidance_change.criteria[value], count: missed.length, of: group.length, items: missed.slice(0, 20).map((label) => label.documentId) };
  });

  const buriedMissed = of('newRisk', 'BURIED').filter((result) => !result.evaluation.newRisk);
  const noNewRisk = of('newRisk', 'NONE').filter((result) => result.evaluation.newRisk && result.item.kind === 'RISKS');
  const beatsMissed = graded.filter((result) => byItem.get(result.item.id).beatButWorse && result.evaluation.agree);

  return byGuidance.concat([
    { id: 'buried', label: 'Buried new risk walked past', detail: 'A risk that is not in the previous list, sitting two thirds of the way down.', count: buriedMissed.length, of: of('newRisk', 'BURIED').length, items: buriedMissed.slice(0, 20).map((result) => result.item.id) },
    { id: 'phantom', label: 'New risk claimed where the list is unchanged', detail: 'Risk sections whose every line was in the previous filing.', count: noNewRisk.length, of: of('newRisk', 'NONE').filter((result) => result.item.kind === 'RISKS').length, items: noNewRisk.slice(0, 20).map((result) => result.item.id) },
    { id: 'beats', label: 'Numbers beat and the tone dropped, read as agreeing', detail: 'Revenue and margin up, language down, order book down.', count: beatsMissed.length, of: graded.filter((result) => byItem.get(result.item.id).beatButWorse).length, items: beatsMissed.slice(0, 20).map((result) => result.item.id) },
  ]);
}

function distribution(graded) {
  return GUIDANCE
    .map((value) => ({ label: sentence(value), count: graded.filter((result) => result.evaluation.guidance === value).length, tone: value === 'RAISED' ? 'good' : value === 'CUT' || value === 'WITHDRAWN' ? 'warn' : undefined }))
    .filter((entry) => entry.count);
}

function guidanceMatrix(graded, byItem) {
  return {
    title: 'Guidance read against the guidance in the document',
    columns: GUIDANCE.map(sentence),
    rows: GUIDANCE.map((actual) => ({
      label: sentence(actual),
      cells: GUIDANCE.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).guidance === actual && result.evaluation.guidance === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem) {
  const changed = graded.filter((result) => byItem.get(result.item.id).guidance !== 'NOT_MENTIONED' || byItem.get(result.item.id).newRisk !== 'NONE');
  const points = Array.from({ length: 7 }, (_, bar) => {
    const reviewed = graded.filter((result) => Math.abs(result.evaluation.tone - 3) >= bar / 2);
    const real = reviewed.filter((result) => changed.includes(result));
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: reviewed.length, caught: real.length, rate: reviewed.length ? Number((real.length / reviewed.length).toFixed(3)) : null };
  });
  return { title: 'Reading the documents whose tone moved furthest', xLabel: 'Documents this far from unchanged', yLabel: 'Documents that really changed something', rateLabel: 'Share that did', of: changed.length, points };
}

function findings(graded, byItem, of) {
  const lines = [];
  const buried = of('newRisk', 'BURIED');
  const obvious = of('newRisk', 'OBVIOUS');
  const buriedFound = buried.filter((result) => result.evaluation.newRisk).length;
  const obviousFound = obvious.filter((result) => result.evaluation.newRisk).length;
  if (buried.length && obvious.length) {
    const gap = obviousFound / obvious.length - buriedFound / buried.length;
    lines.push(gap > 0.15
      ? `A new risk in the first three lines was found ${Math.round(gap * 100)} points more often than the same kind of risk two thirds of the way down. Position in the list is doing work that the content is not.`
      : `A buried new risk was found about as often as an obvious one — ${buriedFound} of ${buried.length} against ${obviousFound} of ${obvious.length}. Where it sits in the list does not appear to matter.`);
  }

  const beats = graded.filter((result) => byItem.get(result.item.id).beatButWorse);
  const missedGap = beats.filter((result) => result.evaluation.agree);
  if (missedGap.length) lines.push(`${missedGap.length} of ${beats.length} documents where the numbers beat and the language got worse were read as telling one consistent story.`);

  const withdrawn = graded.filter((result) => byItem.get(result.item.id).guidance === 'WITHDRAWN');
  const asCut = withdrawn.filter((result) => result.evaluation.guidance === 'CUT');
  if (asCut.length) lines.push(`${asCut.length} of ${withdrawn.length} withdrawals were read as cuts. A company that stops forecasting is saying something a cut does not.`);

  const phantom = of('newRisk', 'NONE').filter((result) => result.item.kind === 'RISKS' && result.evaluation.newRisk);
  if (phantom.length >= 3) lines.push(`${phantom.length} risk sections with nothing new in them were reported as carrying a new risk. Two identical lists read as different is the failure mode this one is watching for.`);

  const significant = of('insider', 'SIGNIFICANT');
  const routine = of('insider', 'ROUTINE');
  const bothFlagged = routine.length && routine.every((result) => result.evaluation.insider) && significant.every((result) => result.evaluation.insider);
  if (bothFlagged) {
    const gap = average(significant.map((result) => result.evaluation.insiderStrength)) - average(routine.map((result) => result.evaluation.insiderStrength));
    lines.push(`All five share sales were called significant, including the two pre-arranged ones. The strength behind the answer separates them by ${gap.toFixed(2)} — so it does tell them apart, and a yes-or-no question throws that away.`);
  }
  return lines;
}

function topItems(graded, byItem) {
  return [...graded]
    .sort((left, right) => Math.abs(right.evaluation.tone - 3) - Math.abs(left.evaluation.tone - 3) || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${result.evaluation.guidance === byItem.get(result.item.id).guidance ? ' · agrees' : ''}`,
      value: `tone ${result.evaluation.tone.toFixed(1)} of 6`,
    }));
}

export default {
  id: 'filings-read',
  title: 'Filings and calls',
  domain: 'news',
  value: 'Read a filing or a call and pull out what changed: the guidance, the tone against the numbers, the risk that was not there last time.',
  tags: ['news', 'filings', 'text', 'reading'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'document',
  itemLabel: (item) => `${item.id} · ${item.ticker} · ${item.title}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/filings-read.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/filings-read.js#demo:data',
    state: 'demos/filings-read/demo.js#demo:state',
    questions: 'demos/filings-read/demo.js#demo:questions',
    evaluate: 'demos/filings-read/demo.js#demo:evaluate',
  },
};
