// Ninety documents: results releases, risk-factor sections and call excerpts, all invented. What is
// planted is what a reader is supposed to pull out — guidance moved or held, tone against the numbers,
// a risk that was not in last quarter's list, a share sale mentioned once in passing.
//
// The two things this demo separates on purpose: a new risk at the top of a list against one buried
// two thirds of the way down, and numbers that beat against a tone that drops anyway. Both are easy
// to get right on average and easy to miss where it counts.

import { matrixStats } from '../lib/metrics.js';
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
  const matrix = guidanceMatrix(graded, byItem);

  return {
    note: `Ninety invented documents: thirty results releases, thirty risk sections and thirty call excerpts. ${context.note ?? ''}`,
    findings: findings(graded, byItem, of),
    kpis: kpis(graded, byItem, of),
    baselines: baselines(graded, byItem),
    metrics: metrics(graded, byItem, matrix),
    distribution: distribution(graded),
    distributionTitle: 'Guidance calls made',
    matrix,
    curve: toneGapCurve(graded, byItem),
    alsoMeasured: alsoMeasured(graded, byItem, of),
    checks: checks(graded, byItem, of, labels),
    topItems: topItems(graded, byItem),
    topItemsTitle: 'Missed gaps between numbers and tone first, then the furthest tone shifts',
  };
}
// #endregion

const labelled = (byItem) => (result) => byItem.get(result.item.id);

/** The new-risk answer over every document, not only the risk sections. A results release or a call
 *  excerpt has no list to compare, and a yes there is a false alarm. */
function newRiskScore(graded, byItem) {
  const labelOf = labelled(byItem);
  const called = graded.filter((result) => result.evaluation.newRisk);
  const real = graded.filter((result) => labelOf(result).newRisk !== 'NONE');
  const right = called.filter((result) => labelOf(result).newRisk !== 'NONE');
  return { called: called.length, real: real.length, right: right.length, falseAlarms: called.filter((result) => labelOf(result).newRisk === 'NONE') };
}

function kpis(graded, byItem, of) {
  const labelOf = labelled(byItem);
  const rightGuidance = graded.filter((result) => result.evaluation.guidance === labelOf(result).guidance);
  const buried = of('newRisk', 'BURIED');
  const risk = newRiskScore(graded, byItem);
  const beats = graded.filter((result) => labelOf(result).beatButWorse);
  const spottedGap = beats.filter((result) => !result.evaluation.agree);
  const flaggedGap = graded.filter((result) => !result.evaluation.agree);
  const significant = of('insider', 'SIGNIFICANT');
  const routine = of('insider', 'ROUTINE');
  const lean = (group) => average(group.map((result) => result.evaluation.insiderStrength));

  return [
    { label: 'Guidance read correctly', value: `${rightGuidance.length} of ${graded.length}`, context: 'raised, maintained, cut, withdrawn or never mentioned', tone: rightGuidance.length >= graded.length * 0.8 ? 'good' : 'warn' },
    { label: 'New risk found, buried', value: `${buried.filter((result) => result.evaluation.newRisk).length} of ${buried.length}`, context: 'two thirds of the way down a list of fifteen or more', tone: buried.length && buried.filter((result) => result.evaluation.newRisk).length >= buried.length * 0.6 ? 'good' : 'warn' },
    { label: 'New risk calls that were right', value: `${risk.right} of ${risk.called}`, context: 'over all ninety documents; a yes on a results release or a call, which carry no list, is a false alarm', tone: risk.called && risk.right >= risk.called * 0.8 ? 'good' : 'warn' },
    { label: 'Numbers beat, tone dropped', value: `${spottedGap.length} of ${beats.length}`, context: `documents where the figures improved and the language did not; ${flaggedGap.length - spottedGap.length} ordinary documents were flagged the same way`, tone: beats.length && spottedGap.length >= beats.length * 0.6 ? 'good' : 'warn' },
    { label: 'How hard it leaned on that', value: `${lean(significant).toFixed(2)} against ${lean(routine).toFixed(2)}`, context: `insider sales: the strength behind the ${significant.length} that mattered against the ${routine.length} routine ones, too few to be more than an illustration`, tone: lean(significant) - lean(routine) > 0.15 ? 'good' : 'warn' },
  ];
}

/** The figures that do not fit the strip. */
function alsoMeasured(graded, byItem, of) {
  const labelOf = labelled(byItem);
  const moved = graded.filter((result) => ['RAISED', 'CUT', 'WITHDRAWN'].includes(labelOf(result).guidance));
  const movedRight = moved.filter((result) => result.evaluation.guidance === labelOf(result).guidance);
  const obvious = of('newRisk', 'OBVIOUS');
  const significant = of('insider', 'SIGNIFICANT');
  const routine = of('insider', 'ROUTINE');
  const toneError = average(graded.map((result) => Math.abs(result.evaluation.tone - labelOf(result).toneShift)));
  // The brief asks for this one on the page: long documents are what a token budget is spent on.
  const chars = graded.map((result) => JSON.stringify(result.state ?? {}).length);
  const longest = Math.max(0, ...chars);

  return [
    { label: 'Guidance that moved, caught', value: `${movedRight.length} of ${moved.length}`, context: 'the documents where the outlook was raised, cut or withdrawn' },
    { label: 'New risk found, near the top', value: `${obvious.filter((result) => result.evaluation.newRisk).length} of ${obvious.length}`, context: 'the same kind of risk, in the first three lines' },
    { label: 'Insider sale that mattered', value: `${significant.filter((result) => result.evaluation.insider).length} of ${significant.length}`, context: `${routine.filter((result) => result.evaluation.insider).length} of ${routine.length} routine ones were called significant too` },
    { label: 'Tone off by', value: `${toneError.toFixed(2)} points`, context: 'average distance from the planted shift, on a seven-point scale; the planted shift follows from the guidance, so this partly repeats the first number' },
    { label: 'What a document costs', value: `${Math.round(average(chars)).toLocaleString('en-GB')} characters`, context: `the average state sent for one document; the longest is ${longest.toLocaleString('en-GB')}` },
  ];
}

/** The rule: the stock verb decides. Withdrawn; reaffirms or unchanged; reduced or lowered; increased or raised; otherwise not mentioned. */
function keywordGuidance(text) {
  if (/withdrawn/i.test(text)) return 'WITHDRAWN';
  if (/reaffirms the guidance|guidance is unchanged/i.test(text)) return 'MAINTAINED';
  if (/guidance is reduced|has lowered its/i.test(text)) return 'CUT';
  if (/guidance is increased|has raised the/i.test(text)) return 'RAISED';
  return 'NOT_MENTIONED';
}

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const labelOf = labelled(byItem);
  const right = (pick) => graded.filter((result) => pick(result) === labelOf(result).guidance).length;
  const counts = GUIDANCE.map((value) => ({ value, count: graded.filter((result) => labelOf(result).guidance === value).length }));
  const commonest = counts.sort((a, b) => b.count - a.count)[0];
  const row = (count) => ({ value: count / graded.length, display: `${count} of ${graded.length}` });

  return [
    { label: 'Jev', detail: 'guidance read as the document states it', model: true, ...row(right((result) => result.evaluation.guidance)) },
    { label: 'Rule: look for the stock verb', detail: 'withdrawn, reaffirms or unchanged, reduced or lowered, increased or raised; otherwise not mentioned', ...row(right((result) => keywordGuidance(result.item.text))) },
    { label: 'Always the commonest answer', detail: readable(commonest.value), ...row(commonest.count) },
  ];
}

function metrics(graded, byItem, matrix) {
  if (!graded.length) return undefined;
  const labelOf = labelled(byItem);
  const stats = matrixStats(matrix);
  const risk = newRiskScore(graded, byItem);
  const beats = graded.filter((result) => labelOf(result).beatButWorse);
  const flaggedGap = graded.filter((result) => !result.evaluation.agree);
  const spottedGap = beats.filter((result) => !result.evaluation.agree);
  const rightGuidance = graded.filter((result) => result.evaluation.guidance === labelOf(result).guidance);

  return {
    headline: { label: 'Guidance read correctly', value: rightGuidance.length / graded.length, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    newRiskPrecision: risk.called ? risk.right / risk.called : null,
    newRiskRecall: risk.real ? risk.right / risk.real : null,
    toneGapPrecision: flaggedGap.length ? spottedGap.length / flaggedGap.length : null,
    toneGapRecall: beats.length ? spottedGap.length / beats.length : null,
    toneMeanAbsoluteError: average(graded.map((result) => Math.abs(result.evaluation.tone - labelOf(result).toneShift))),
  };
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
  const unchanged = of('newRisk', 'NONE');
  const noNewRisk = unchanged.filter((result) => result.evaluation.newRisk && result.item.kind === 'RISKS');
  const elsewhere = unchanged.filter((result) => result.item.kind !== 'RISKS');
  const phantomElsewhere = elsewhere.filter((result) => result.evaluation.newRisk);
  const beatsMissed = graded.filter((result) => byItem.get(result.item.id).beatButWorse && result.evaluation.agree);
  const ordinary = graded.filter((result) => !byItem.get(result.item.id).beatButWorse);
  const ordinaryFlagged = ordinary.filter((result) => !result.evaluation.agree);

  return byGuidance.concat([
    { id: 'buried', label: 'Buried new risk walked past', detail: 'A risk that is not in the previous list, sitting two thirds of the way down.', count: buriedMissed.length, of: of('newRisk', 'BURIED').length, items: buriedMissed.slice(0, 20).map((result) => result.item.id) },
    { id: 'phantom', label: 'New risk claimed where the list is unchanged', detail: 'Risk sections whose every line was in the previous filing.', count: noNewRisk.length, of: unchanged.filter((result) => result.item.kind === 'RISKS').length, items: noNewRisk.slice(0, 20).map((result) => result.item.id) },
    { id: 'phantom-elsewhere', label: 'New risk claimed in a document that has no risk list', detail: 'Results releases and call excerpts with nothing planted; the question has no list to compare there, and the answer was still yes.', count: phantomElsewhere.length, of: elsewhere.length, items: phantomElsewhere.slice(0, 20).map((result) => result.item.id) },
    { id: 'beats', label: 'Numbers beat and the tone dropped, read as agreeing', detail: 'Revenue and margin up, language down, order book down.', count: beatsMissed.length, of: graded.filter((result) => byItem.get(result.item.id).beatButWorse).length, items: beatsMissed.slice(0, 20).map((result) => result.item.id) },
    { id: 'gap-on-nothing', label: 'Ordinary document read as numbers against tone', detail: 'Nothing planted, and the answer said the figures and the language disagree.', count: ordinaryFlagged.length, of: ordinary.length, items: ordinaryFlagged.slice(0, 20).map((result) => result.item.id) },
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
    rowLabel: 'what the document does to guidance',
    columnLabel: 'what the model read',
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

const GAP_BARS = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];

/** Where to call "numbers and language disagree". The answer is a probability that they agree, and
 *  several of the planted gaps sit within a few points of a half, so the bar matters. */
function toneGapCurve(graded, byItem) {
  const planted = graded.filter((result) => byItem.get(result.item.id).beatButWorse);
  const points = GAP_BARS.map((bar) => {
    const flagged = graded.filter((result) => result.answers.numbers_and_tone_agree.noul < bar);
    const caught = flagged.filter((result) => byItem.get(result.item.id).beatButWorse);
    return { threshold: bar, reviewed: flagged.length, caught: caught.length, rate: flagged.length ? Number((caught.length / flagged.length).toFixed(3)) : null };
  });
  return {
    title: 'Flagging a gap between the numbers and the tone',
    xLabel: 'Documents flagged when the agreement answer is below this',
    yLabel: 'Planted gaps among them',
    rateLabel: 'Share of flags that were planted',
    of: planted.length,
    defaultIndex: GAP_BARS.indexOf(0.5),
    points,
  };
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

  const risk = newRiskScore(graded, byItem);
  const elsewhere = risk.falseAlarms.filter((result) => result.item.kind !== 'RISKS');
  if (elsewhere.length >= 3) lines.push(`The new-risk answer was yes on ${risk.called} documents and ${risk.right} of them carry a new risk. ${elsewhere.length} of the false alarms are results releases and call excerpts, which have no risk list to compare, so ask this question only of risk sections.`);

  const beats = graded.filter((result) => byItem.get(result.item.id).beatButWorse);
  const missedGap = beats.filter((result) => result.evaluation.agree);
  if (missedGap.length) {
    const closest = missedGap.map((result) => result.answers.numbers_and_tone_agree.noul);
    lines.push(`${missedGap.length} of ${beats.length} documents where the numbers beat and the language got worse were read as telling one consistent story. Their agreement answers run from ${Math.round(Math.min(...closest) * 100)}% to ${Math.round(Math.max(...closest) * 100)}%, so where the bar sits decides most of them.`);
  }

  const byRule = graded.filter((result) => keywordGuidance(result.item.text) === byItem.get(result.item.id).guidance).length;
  const byModel = graded.filter((result) => result.evaluation.guidance === byItem.get(result.item.id).guidance).length;
  if (graded.length && byRule >= byModel) lines.push(`Looking for the stock verb reads guidance correctly on ${byRule} of ${graded.length} documents, against ${byModel} for the model. Guidance here is always stated in one of eight stock sentences, so this part of the run measures reading.`);

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
  const missedGap = (result) => byItem.get(result.item.id).beatButWorse && result.evaluation.agree;
  const row = (result) => ({
    id: result.item.id,
    label: `${result.evaluation.label}${missedGap(result) ? ' · numbers beat, tone dropped, read as agreeing' : ''}`,
    value: `tone ${result.evaluation.tone.toFixed(1)} of 6`,
  });
  const furthest = graded
    .filter((result) => !missedGap(result))
    .sort((left, right) => Math.abs(right.evaluation.tone - 3) - Math.abs(left.evaluation.tone - 3) || right.evaluation.confidence - left.evaluation.confidence);
  return [...graded.filter(missedGap), ...furthest].slice(0, 10).map(row);
}

function plantedIn(label) {
  const parts = [];
  if (label.beatButWorse) parts.push('numbers that beat with a tone that dropped');
  if (label.newRisk === 'BURIED') parts.push('a new risk buried two thirds of the way down the list');
  if (label.newRisk === 'OBVIOUS') parts.push('a new risk in the first three lines');
  if (label.insider === 'SIGNIFICANT') parts.push('a large share sale mentioned in passing');
  if (label.insider === 'ROUTINE') parts.push('a routine, pre-arranged share sale');
  return parts.length ? `Also planted here: ${parts.join('; ')}.` : undefined;
}

/** Right means the guidance call matches the document. The other plants are named in the note so
 *  the reader can check them against the answers beside it. */
const grade = {
  labelId: (label) => label.documentId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.guidance === label.guidance,
      expected: label.guidance,
      got: result.evaluation.guidance,
      note: plantedIn(label),
      confidence: result.answers.guidance_change.confidence,
    };
  },
};

const TONE_LEVELS = ['Much worse', 'Worse', 'Slightly worse', 'Unchanged', 'Slightly better', 'Better', 'Much better'];
const GUIDANCE_TONES = { RAISED: 'good', CUT: 'bad', WITHDRAWN: 'bad' };
const yesNo = (answer) => `${answer.noul >= 0.5 ? 'Yes' : 'No'} · ${Math.round(answer.noul * 100)}%`;

function verdict(result) {
  const { answers, evaluation } = result;
  const toneLevel = TONE_LEVELS[Math.round(evaluation.tone)];
  const flags = [];
  if (!evaluation.agree) flags.push('numbers and language disagree');
  if (evaluation.newRisk) flags.push('new risk');
  if (evaluation.insider) flags.push('insider transaction');
  return {
    eyebrow: 'What this document changes',
    headline: `Guidance ${readable(evaluation.guidance)} · tone ${toneLevel.toLowerCase()}`,
    detail: flags.length ? `Worth opening for: ${flags.join(', ')}.` : 'Nothing flagged beyond the guidance and the tone.',
    facts: [
      { label: 'Guidance', value: `${sentence(evaluation.guidance)} · ${Math.round(answers.guidance_change.confidence * 100)}%`, tone: GUIDANCE_TONES[evaluation.guidance] },
      { label: 'Tone since the period before', value: `${toneLevel} · ${evaluation.tone.toFixed(1)} of 6`, tone: evaluation.tone < 2.5 ? 'warn' : evaluation.tone > 3.5 ? 'good' : undefined },
      { label: 'Numbers and language agree', value: yesNo(answers.numbers_and_tone_agree), tone: evaluation.agree ? undefined : 'warn' },
      { label: 'Risk that was not there last time', value: yesNo(answers.new_risk_factor), tone: evaluation.newRisk ? 'warn' : undefined },
      { label: 'Insider transaction worth noticing', value: yesNo(answers.insider_transaction_significant), tone: evaluation.insider ? 'warn' : undefined },
    ],
  };
}

const CAVEAT = 'Guidance is always stated in one of eight stock sentences, so a keyword rule also reads it on 90 of 90; the harder questions rest on twelve planted tone gaps and five share sales, which is too few to set a bar on.';

const present = {
  number: 173,
  problem: {
    headline: 'Revenue is up, margin is up, and the chief executive says he is more cautious. A skim reads the numbers and misses the sentence.',
    stat: '90',
    statLabel: 'results releases, risk sections and call excerpts',
  },
  hero: {
    item: 'FD-0001',
    caption: 'Revenue of 431.3 million against 388.2, margin up, guidance reaffirmed. The tone was read as worse, 1.4 of 6, and the numbers and the language as disagreeing, at 35% agreement.',
  },
  answers: {
    caption: 'Five answers per document. Guidance is the easy one; whether the figures and the language tell the same story is the one that matters here.',
    reveal: ['guidance_change', 'tone_shift', 'numbers_and_tone_agree', 'new_risk_factor'],
  },
  miss: {
    item: 'FD-0047',
    caption: 'The same plant, numbers up and language down, read as one consistent story at 61% agreement. It is one of 4 of the 12 gaps missed, and three of those sit within two points of the bar.',
  },
  proof: {
    kpis: ['Numbers beat, tone dropped', 'New risk calls that were right', 'Guidance read correctly'],
    chart: 'curve',
    closing: '8 of 12 gaps between the numbers and the tone were caught, and only 17 of the 47 new-risk calls were right.',
  },
};

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
  grade,
  verdict,
  present,
  caveat: CAVEAT,
  explain: {
    data: 'scripts/generate/filings-read.js#demo:data',
    state: 'demos/filings-read/demo.js#demo:state',
    questions: 'demos/filings-read/demo.js#demo:questions',
    evaluate: 'demos/filings-read/demo.js#demo:evaluate',
  },
};
