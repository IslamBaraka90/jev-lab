// Two hundred and forty claims, graded before anybody knows which ones were true. Twenty-two were
// later confirmed, thirty-eight later denied, and a hundred and eighty never resolved — which is what
// rumours mostly do, and a demo that quietly drops them would be flattering itself.
//
// The hard pair here: fourteen coordinated pushes, and twelve claims that travelled just as far and
// just as fast because people repeated them in their own words. Accounts and timing cannot tell those
// apart. Only the shared wording can.

import { choice, noul, score } from '../lib/questions.js';

const DISPOSITIONS = ['IGNORE', 'WATCH', 'VERIFY', 'ACT_WORTHY'];
const OUTCOMES = ['CONFIRMED', 'DENIED', 'UNRESOLVED'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

// #region demo:state
/** The claim, who made it, how often they have been right, and how it spread. No outcome. */
function buildState(item, context) {
  return {
    task: 'Grade this claim before anybody knows whether it is true: how good is the source, is anyone else independently saying it, does the spread look organised, and what would you do about it.',
    claim: item.claim,
    about: { company: item.company, ticker: item.ticker, sector: item.sector },
    source: {
      kind: item.sourceDescription,
      handle: item.sourceHandle,
      claims_made_before: item.claimsMadeBefore,
      of_those_later_confirmed: item.laterConfirmed,
      of_those_later_denied: item.laterDenied,
    },
    posted_at: item.postedAt,
    how_it_spread: {
      other_accounts_repeating_it: item.accountsRepeatingIt,
      minutes_those_took: item.minutesForThoseRepeats,
      percent_of_wording_they_share: item.wordingSharedPercent,
      independent_sources_saying_it: item.independentSourcesSayingIt,
    },
    document_cited: item.citedDocument,
    what_the_company_has_confirmed_lately: item.companyRecentNews,
    how_to_read_the_spread: context.howToRead,
  };
}
// #endregion

// #region demo:questions
const questions = {
  source_reliability: score('How much weight does this source carry?', [
    'Untrustworthy', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Authoritative',
  ]),
  corroborated: noul('Is anyone else independently saying this?', {
    yes: 'Somebody who did not get it from this post is saying the same thing.',
    no: 'Every version of this traces back to the one claim.',
  }),
  coordinated_push: noul('Does the spread look organised?', {
    yes: 'Too many accounts, too close together, using too much of the same wording to be a crowd.',
    no: 'However far it travelled, it travelled in people’s own words.',
  }),
  checkable: noul('Does it cite something that could be checked?', {
    yes: 'It points at a document somebody could go and read.',
    no: 'There is nothing here to verify against.',
  }),
  disposition: choice('What would you do with this?', {
    IGNORE: 'Nothing. It is not worth the attention.',
    WATCH: 'Note it and see whether it comes back with more behind it.',
    VERIFY: 'Send somebody to check the thing it points at.',
    ACT_WORTHY: 'There is enough here to act on before it is confirmed.',
  }),
};
// #endregion

// #region demo:evaluate
/** One grading of one claim, made before the outcome exists. */
function evaluate(answers, item) {
  return {
    reliability: answers.source_reliability.score,
    corroborated: answers.corroborated.noul >= 0.5,
    coordinated: answers.coordinated_push.noul >= 0.5,
    coordinationStrength: answers.coordinated_push.noul,
    checkable: answers.checkable.noul >= 0.5,
    disposition: answers.disposition.choice,
    confidence: answers.disposition.confidence,
    label: `${item.id} · ${item.ticker} · ${readable(answers.disposition.choice)} · source ${answers.source_reliability.score.toFixed(1)} of 6`,
  };
}
// #endregion

// #region demo:report
/** Both errors, kept apart: the truths that were ignored and the falsehoods that were acted on. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.claimId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const of = (field, value) => graded.filter((result) => byItem.get(result.item.id)[field] === value);

  return {
    note: `Two hundred and forty claims. ${of('outcome', 'CONFIRMED').length} were later confirmed, ${of('outcome', 'DENIED').length} later denied, and ${of('outcome', 'UNRESOLVED').length} never resolved. ${context.note ?? ''}`,
    findings: findings(graded, byItem, of),
    kpis: kpis(graded, byItem, of),
    baselines: baselines(graded, byItem),
    metrics: metrics(graded, byItem),
    distribution: distribution(graded),
    distributionTitle: 'What was done with each claim',
    matrix: dispositionMatrix(graded, byItem),
    curve: calibration(graded, byItem),
    alsoMeasured: alsoMeasured(graded, byItem, of),
    checks: checks(graded, byItem, of),
    topItems: topItems(graded, byItem),
    topItemsTitle: 'The claims that travelled fast, miscalled ones first',
  };
}
// #endregion

const PUSH_WORDING = 60;
const PUSH_ACCOUNTS = 20;

/** The rule: a push is twenty or more accounts sharing sixty per cent or more of the wording. */
function looksLikePush(item) {
  return item.wordingSharedPercent >= PUSH_WORDING && item.accountsRepeatingIt >= PUSH_ACCOUNTS;
}

const spreadReadRight = (result, label) => result.evaluation.coordinated === Boolean(label.coordinated);
const sentOn = (result) => ['VERIFY', 'ACT_WORTHY'].includes(result.evaluation.disposition);

/** How the coordination answer scores over every claim, for the model or for any other way of calling it. */
function spreadScore(graded, byItem, call) {
  const pushes = graded.filter((result) => byItem.get(result.item.id).coordinated);
  const crowds = graded.filter((result) => byItem.get(result.item.id).spread === 'VIRAL');
  const flagged = graded.filter(call);
  const caught = pushes.filter(call);
  return {
    right: graded.filter((result) => call(result) === Boolean(byItem.get(result.item.id).coordinated)).length,
    caught: caught.length,
    pushes: pushes.length,
    crowdsFlagged: crowds.filter(call).length,
    crowds: crowds.length,
    precision: flagged.length ? caught.length / flagged.length : null,
    recall: pushes.length ? caught.length / pushes.length : null,
  };
}

function kpis(graded, byItem, of) {
  const confirmed = of('outcome', 'CONFIRMED');
  const denied = of('outcome', 'DENIED');
  const spread = spreadScore(graded, byItem, (result) => result.evaluation.coordinated);
  const gap = average(confirmed.map((result) => result.evaluation.reliability)) - average(denied.map((result) => result.evaluation.reliability));
  const sent = graded.filter(sentOn);
  const sentTrue = sent.filter((result) => byItem.get(result.item.id).outcome === 'CONFIRMED');
  const wasted = sent.filter((result) => byItem.get(result.item.id).outcome === 'DENIED');

  return [
    { label: 'Spread read correctly', value: `${spread.right} of ${graded.length}`, context: 'organised or not, against how each claim was planted', tone: spread.right >= graded.length * 0.95 ? 'good' : 'warn' },
    { label: 'Coordinated pushes caught', value: `${spread.caught} of ${spread.pushes}`, context: 'many accounts, the same sentence, inside half an hour', tone: spread.pushes && spread.caught >= spread.pushes * 0.7 ? 'good' : 'warn' },
    { label: 'Organic spread called organised', value: `${spread.crowdsFlagged} of ${spread.crowds}`, context: 'just as many accounts, just as fast, in their own words', tone: spread.crowdsFlagged > spread.crowds / 4 ? 'warn' : 'good' },
    { label: 'Sent to somebody to check', value: `${sent.length} of ${graded.length}`, context: `${sentTrue.length} of those turned out true and ${wasted.length} turned out false, against ${confirmed.length} true and ${denied.length} false in the whole feed`, tone: sent.length > graded.length / 2 ? 'warn' : undefined },
    { label: 'Reliability gap, true against false', value: gap.toFixed(1), context: 'how much more weight the confirmed claims’ sources were given', tone: gap > 0.5 ? 'good' : 'warn' },
  ];
}

/** The figures that do not fit the strip. A zero here can mean the option was never chosen, and the
 *  context says so when that is the case. */
function alsoMeasured(graded, byItem, of) {
  const confirmed = of('outcome', 'CONFIRMED');
  const denied = of('outcome', 'DENIED');
  const chose = (value) => graded.filter((result) => result.evaluation.disposition === value).length;
  const ignoredTruths = confirmed.filter((result) => result.evaluation.disposition === 'IGNORE');
  const trustedLies = denied.filter((result) => result.evaluation.disposition === 'ACT_WORTHY');
  const citing = graded.filter((result) => byItem.get(result.item.id).checkable);
  const withSources = graded.filter((result) => result.item.independentSourcesSayingIt > 0);
  const warn = (failed) => (failed ? { tone: 'warn' } : {});

  return [
    { label: 'Confirmed claims ignored', value: `${ignoredTruths.length} of ${confirmed.length}`, context: `true, and waved away before anybody looked; ignore was chosen for ${chose('IGNORE')} of ${graded.length} claims, so a low count here says little`, ...warn(ignoredTruths.length > confirmed.length / 5) },
    { label: 'Denied claims called act-worthy', value: `${trustedLies.length} of ${denied.length}`, context: `false, and graded good enough to act on; act-worthy was chosen for ${chose('ACT_WORTHY')} of ${graded.length} claims`, ...warn(trustedLies.length > 0) },
    { label: 'Checkable claims spotted', value: `${citing.filter((result) => result.evaluation.checkable).length} of ${citing.length}`, context: 'a named document somebody could go and read; the state says whether one is cited' },
    { label: 'Corroboration spotted', value: `${withSources.filter((result) => result.evaluation.corroborated).length} of ${withSources.length}`, context: 'claims with at least one independent source; the state carries that count' },
  ];
}

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  const model = spreadScore(graded, byItem, (result) => result.evaluation.coordinated);
  const rule = spreadScore(graded, byItem, (result) => looksLikePush(result.item));
  const never = spreadScore(graded, byItem, () => false);
  const row = (score) => ({ value: score.right / graded.length, display: `${score.right} of ${graded.length}` });
  const detail = (score) => `${score.caught} of ${score.pushes} pushes caught, ${score.crowdsFlagged} of ${score.crowds} organic crowds flagged`;

  return [
    { label: 'Jev', detail: detail(model), model: true, ...row(model) },
    { label: `Rule: ${PUSH_ACCOUNTS} or more accounts sharing ${PUSH_WORDING}% of the wording`, detail: detail(rule), ...row(rule) },
    { label: 'Never call it organised', detail: 'the commonest answer', ...row(never) },
  ];
}

function metrics(graded, byItem) {
  if (!graded.length) return undefined;
  const spread = spreadScore(graded, byItem, (result) => result.evaluation.coordinated);
  const resolved = graded.filter((result) => byItem.get(result.item.id).outcome !== 'UNRESOLVED');
  const isTrue = (result) => byItem.get(result.item.id).outcome === 'CONFIRMED';
  const sentResolved = resolved.filter(sentOn);

  return {
    headline: { label: 'Spread read correctly', value: spread.right / graded.length, n: graded.length },
    accuracy: spread.right / graded.length,
    precision: spread.precision,
    recall: spread.recall,
    sentForCheckingRate: graded.filter(sentOn).length / graded.length,
    sentForCheckingTrueShare: sentResolved.length ? sentResolved.filter(isTrue).length / sentResolved.length : null,
    resolvedTrueShare: resolved.length ? resolved.filter(isTrue).length / resolved.length : null,
    maxReliabilityUsed: Math.max(...graded.map((result) => result.evaluation.reliability)),
  };
}

function checks(graded, byItem, of) {
  const confirmed = of('outcome', 'CONFIRMED');
  const denied = of('outcome', 'DENIED');
  const pushes = of('spread', 'COORDINATED');
  const viral = of('spread', 'VIRAL');
  const citing = graded.filter((result) => byItem.get(result.item.id).checkable);

  const missedPushes = pushes.filter((result) => !result.evaluation.coordinated);
  const ignoredTruths = confirmed.filter((result) => result.evaluation.disposition === 'IGNORE');
  const trustedLies = denied.filter(sentOn);
  const missedDocuments = citing.filter((result) => !result.evaluation.checkable);
  const phantomDocuments = graded.filter((result) => !byItem.get(result.item.id).checkable && result.evaluation.checkable);
  const verifying = graded.filter((result) => result.evaluation.disposition === 'VERIFY');
  const nothingToCheck = verifying.filter((result) => !result.evaluation.checkable);

  return [
    { id: 'ignored', label: 'True claim ignored', detail: 'Later confirmed, and the disposition was to do nothing.', count: ignoredTruths.length, of: confirmed.length, items: ignoredTruths.slice(0, 20).map((result) => result.item.id) },
    { id: 'trusted', label: 'False claim sent for verifying or acting on', detail: 'Later denied, and somebody would have spent time on it.', count: trustedLies.length, of: denied.length, items: trustedLies.slice(0, 20).map((result) => result.item.id) },
    { id: 'pushes', label: 'Coordinated push missed', detail: 'Over eighty per cent shared wording across dozens of accounts in under an hour.', count: missedPushes.length, of: pushes.length, items: missedPushes.slice(0, 20).map((result) => result.item.id) },
    { id: 'viral', label: 'Organic spread mistaken for a push', detail: 'The same reach and speed, under a third of the wording shared.', count: viral.filter((result) => result.evaluation.coordinated).length, of: viral.length, items: viral.filter((result) => result.evaluation.coordinated).slice(0, 20).map((result) => result.item.id) },
    { id: 'documents', label: 'Cited document not noticed', detail: 'The claim names a document and the answer said there was nothing to check.', count: missedDocuments.length, of: citing.length, items: missedDocuments.slice(0, 20).map((result) => result.item.id) },
    { id: 'phantom', label: 'Something checkable claimed where nothing is cited', detail: 'No document is named anywhere in the claim.', count: phantomDocuments.length, of: graded.length - citing.length, items: phantomDocuments.slice(0, 20).map((result) => result.item.id) },
    { id: 'nothing-to-check', label: 'Sent to verify with nothing to check', detail: 'The disposition sends somebody to check what the claim points at, and the same reading said it points at nothing.', count: nothingToCheck.length, of: verifying.length, items: nothingToCheck.slice(0, 20).map((result) => result.item.id) },
  ];
}

function distribution(graded) {
  return DISPOSITIONS
    .map((value) => ({ label: sentence(value), count: graded.filter((result) => result.evaluation.disposition === value).length, tone: value === 'IGNORE' ? 'good' : value === 'ACT_WORTHY' ? 'warn' : undefined }))
    .filter((entry) => entry.count);
}

function dispositionMatrix(graded, byItem) {
  return {
    title: 'What was done with it against what it turned out to be',
    rowLabel: 'what the claim turned out to be',
    columnLabel: 'what the model would do with it',
    columns: DISPOSITIONS.map(sentence),
    rows: OUTCOMES.map((outcome) => ({
      label: sentence(outcome),
      cells: DISPOSITIONS.map((disposition) => ({
        predicted: disposition,
        count: graded.filter((result) => byItem.get(result.item.id).outcome === outcome && result.evaluation.disposition === disposition).length,
        diagonal: (outcome === 'CONFIRMED' && disposition === 'ACT_WORTHY') || (outcome === 'DENIED' && disposition === 'IGNORE'),
      })),
    })),
  };
}

/** Of the claims that resolved, does a higher reliability score really mean a better chance of true? */
function calibration(graded, byItem) {
  const resolved = graded.filter((result) => byItem.get(result.item.id).outcome !== 'UNRESOLVED');
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = resolved.filter((result) => result.evaluation.reliability >= bar);
    const true_ = at.filter((result) => byItem.get(result.item.id).outcome === 'CONFIRMED');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: true_.length, rate: at.length ? Number((true_.length / at.length).toFixed(3)) : null };
  });
  // Open on the highest bar anything cleared, since the top of the scale may be empty.
  const highestUsed = points.reduce((last, point, index) => (point.reviewed ? index : last), 0);
  return {
    title: 'Source reliability against what turned out to be true',
    xLabel: 'Resolved claims graded this reliable or above',
    yLabel: 'Of those, the ones later confirmed',
    rateLabel: 'Share confirmed',
    of: resolved.filter((result) => byItem.get(result.item.id).outcome === 'CONFIRMED').length,
    thresholdFormat: 'level',
    levels: 6,
    defaultIndex: Math.min(highestUsed, 3),
    points,
  };
}

function findings(graded, byItem, of) {
  const lines = [];
  const pushes = of('spread', 'COORDINATED');
  const viral = of('spread', 'VIRAL');
  if (pushes.length && viral.length) {
    const caught = pushes.filter((result) => result.evaluation.coordinated).length;
    const wrong = viral.filter((result) => result.evaluation.coordinated).length;
    lines.push(caught / pushes.length - wrong / viral.length > 0.4
      ? `${caught} of ${pushes.length} coordinated pushes were caught while only ${wrong} of ${viral.length} organic ones were mistaken for them. Reach and speed are the same in both groups, so the shared wording is what did it.`
      : `Coordinated pushes and claims that merely travelled were graded much alike — ${caught} of ${pushes.length} against ${wrong} of ${viral.length}. The wording similarity is on the page and is the only thing that separates them.`);

    const model = spreadScore(graded, byItem, (result) => result.evaluation.coordinated);
    const rule = spreadScore(graded, byItem, (result) => looksLikePush(result.item));
    if (rule.right >= model.right) lines.push(`A rule on two numbers in the state, ${PUSH_ACCOUNTS} or more accounts sharing ${PUSH_WORDING} per cent of the wording, catches ${rule.caught} of ${rule.pushes} pushes and flags ${rule.crowdsFlagged} of ${rule.crowds} organic crowds. That is ${rule.right > model.right ? 'better than' : 'level with'} the model, because the wording share is handed over as a figure rather than as the posts themselves.`);
  }

  const ignoredTruths = of('outcome', 'CONFIRMED').filter((result) => result.evaluation.disposition === 'IGNORE');
  if (ignoredTruths.length) lines.push(`${ignoredTruths.length} claims that turned out to be true were marked ignore. That is the expensive error here, and it is the one nobody sees at the time.`);

  const unresolved = of('outcome', 'UNRESOLVED');
  const actedOnAir = unresolved.filter((result) => result.evaluation.disposition === 'ACT_WORTHY');
  if (actedOnAir.length) lines.push(`${actedOnAir.length} of ${unresolved.length} claims that never resolved either way were graded act-worthy. Nothing proves those wrong, and that is exactly the problem with them.`);

  const used = new Set(graded.map((result) => result.evaluation.disposition));
  const unused = DISPOSITIONS.filter((value) => !used.has(value));
  if (unused.length) lines.push(`${sentence(unused.map(readable).join(' and '))} went unused across all ${graded.length} claims. Everything landed in the middle, so read the reliability score and the checkable answer rather than the disposition — those are where this run put its judgement.`);

  const sent = graded.filter(sentOn);
  const wasted = sent.filter((result) => byItem.get(result.item.id).outcome === 'DENIED');
  if (wasted.length) lines.push(`${wasted.length} of the ${sent.length} claims sent for checking turned out to be false. Nobody knew that at the time, and that is what a verification budget is for — but it is the number to put against the cost of the team.`);

  const sentOf = (outcome) => `${of('outcome', outcome).filter(sentOn).length} of ${of('outcome', outcome).length}`;
  const sentShare = (outcome) => (of('outcome', outcome).length ? of('outcome', outcome).filter(sentOn).length / of('outcome', outcome).length : 0);
  if (sent.length && sent.length < graded.length && Math.abs(sentShare('CONFIRMED') - sentShare('DENIED')) < 0.15) {
    lines.push(`Sending a claim for checking did not pick out the true ones: ${sentOf('CONFIRMED')} later confirmed claims were sent, against ${sentOf('DENIED')} later denied and ${sentOf('UNRESOLVED')} never resolved. The queue is close to a random half of the feed.`);
  }

  const strength = average(of('spread', 'COORDINATED').map((result) => result.evaluation.coordinationStrength)) - average(of('spread', 'VIRAL').map((result) => result.evaluation.coordinationStrength));
  if (Math.abs(strength) > 0.1) lines.push(`The strength behind the coordination answer separates the two groups by ${strength.toFixed(2)}, which is a cleaner signal than the yes-or-no it gets turned into.`);

  const top = graded.length ? Math.max(...graded.map((result) => result.evaluation.reliability)) : 0;
  if (graded.length && top < 4) lines.push(`No source was graded above ${top.toFixed(1)} of 6, so the top of the reliability curve is empty. Read the gap between groups rather than the level.`);
  return lines;
}

function topItems(graded, byItem) {
  const labelOf = (result) => byItem.get(result.item.id);
  const fast = graded.filter((result) => labelOf(result).spread !== 'QUIET');
  const miscalled = fast.filter((result) => !spreadReadRight(result, labelOf(result)));
  const rest = fast
    .filter((result) => spreadReadRight(result, labelOf(result)))
    .sort((left, right) => right.evaluation.coordinationStrength - left.evaluation.coordinationStrength);

  return [...miscalled, ...rest].slice(0, 10).map((result) => ({
    id: result.item.id,
    label: `${result.item.id} · ${result.item.ticker} · ${result.item.accountsRepeatingIt} accounts, ${result.item.wordingSharedPercent}% shared wording · ${result.evaluation.coordinated ? 'called organised' : 'called organic'}`,
    value: `${labelOf(result).spread === 'COORDINATED' ? 'push' : 'crowd'} · ${readable(labelOf(result).outcome)}`,
  }));
}

const HOW_IT_ENDED = {
  CONFIRMED: 'The claim was later confirmed.',
  DENIED: 'The claim was later denied.',
  UNRESOLVED: 'The claim never resolved either way.',
};

// #region demo:grade
/** Right means the organised-or-not answer matches how the spread was planted. The outcome of the
 *  claim is quoted in the note and not graded: a pushed claim can still be true. */
const grade = {
  labelId: (label) => label.claimId,
  judge: (result, label) => {
    if (!label) return null;
    const { item } = result;
    const spread = `${item.accountsRepeatingIt} accounts in ${item.minutesForThoseRepeats} minutes sharing ${item.wordingSharedPercent}% of the wording`;
    const planted = {
      COORDINATED: `Planted as a coordinated push: ${spread}. `,
      VIRAL: `Planted as an organic crowd: ${spread}. `,
    }[label.spread] ?? '';
    const strength = result.evaluation.coordinationStrength;
    return {
      agree: spreadReadRight(result, label),
      expected: label.coordinated ? 'organised' : 'not organised',
      got: result.evaluation.coordinated ? 'organised' : 'not organised',
      note: `${planted}${HOW_IT_ENDED[label.outcome] ?? ''}`.trim(),
      confidence: Math.max(strength, 1 - strength),
    };
  },
};
// #endregion

const RELIABILITY_LEVELS = ['Untrustworthy', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Authoritative'];
const yesNo = (answer) => `${answer.noul >= 0.5 ? 'Yes' : 'No'} · ${Math.round(answer.noul * 100)}%`;

// #region demo:verdict
function verdict(result) {
  const { answers, evaluation } = result;
  const level = RELIABILITY_LEVELS[Math.round(evaluation.reliability)];
  return {
    eyebrow: 'Graded before anybody knew whether it was true',
    headline: `${sentence(evaluation.disposition)} · spread looks ${evaluation.coordinated ? 'organised' : 'organic'}`,
    detail: evaluation.disposition === 'VERIFY' && !evaluation.checkable ? 'Sent for checking although the same reading found nothing cited to check.' : undefined,
    facts: [
      { label: 'Spread looks organised', value: yesNo(answers.coordinated_push), tone: evaluation.coordinated ? 'bad' : 'good' },
      { label: 'Weight the source carries', value: `${level} · ${evaluation.reliability.toFixed(1)} of 6`, tone: evaluation.reliability < 1.5 ? 'bad' : evaluation.reliability >= 3.5 ? 'good' : undefined },
      { label: 'Somebody independent is saying it', value: yesNo(answers.corroborated), tone: evaluation.corroborated ? 'good' : 'warn' },
      { label: 'Cites something checkable', value: yesNo(answers.checkable), tone: evaluation.checkable ? 'good' : undefined },
      { label: 'Confidence in the disposition', value: `${Math.round(evaluation.confidence * 100)}%` },
    ],
  };
}
// #endregion

const stage = {
  hide: ['sourceType'],
  labels: {
    sourceDescription: 'Source',
    sourceHandle: 'Handle',
    claimsMadeBefore: 'Claims this source made before',
    laterConfirmed: 'Of those, later confirmed',
    laterDenied: 'Of those, later denied',
    postedAt: 'Posted',
    accountsRepeatingIt: 'Accounts repeating it',
    minutesForThoseRepeats: 'Minutes those repeats took',
    wordingSharedPercent: 'Wording the repeats share (%)',
    independentSourcesSayingIt: 'Independent sources saying it',
    citedDocument: 'Document cited',
    companyRecentNews: 'What the company has confirmed lately',
  },
  highlight: ['wordingSharedPercent', 'accountsRepeatingIt', 'minutesForThoseRepeats', 'independentSourcesSayingIt'],
};

const CAVEAT = 'The share of wording that separates a push from a crowd is handed to the model as a number, so a two-line rule on it scores 240 of 240; this run measures reading that figure, and only sixty of the claims ever resolved.';

const present = {
  number: 175,
  problem: {
    headline: 'A claim repeated by forty accounts in twenty minutes is either a crowd or a campaign, and reach and speed look the same in both.',
    stat: '240',
    statLabel: 'claims graded before anybody knew which were true',
  },
  hero: {
    item: 'RM-0016',
    caption: 'A rights issue rumour from a newsletter with 14 of 46 earlier claims confirmed. 33 accounts repeated it in 18 minutes with 95% of the wording shared, and nobody independent. Called organised at 87%; later denied.',
  },
  answers: {
    caption: 'Source weight 0.7 of 6, nobody independent, nothing cited, spread organised. The disposition still says verify, which is where this run is weakest.',
    reveal: ['coordinated_push', 'source_reliability', 'corroborated', 'checkable', 'disposition'],
  },
  miss: {
    item: 'RM-0008',
    caption: 'The same reach, 43 accounts in 38 minutes, but only 31% of the wording shared. Called organised at 55%: the one organic crowd of twelve it got wrong.',
  },
  proof: {
    kpis: ['Coordinated pushes caught', 'Organic spread called organised', 'Sent to somebody to check'],
    chart: 'baselines',
    closing: '14 of 14 pushes caught with 1 of 12 crowds flagged, and a two-line rule on the same numbers gets 14 of 14 with none.',
  },
};

export default {
  id: 'rumour-grading',
  title: 'Rumour grading',
  domain: 'news',
  value: 'Grade a claim before acting on it: how good the source is, whether anybody independent is saying it, and whether the spread was organised.',
  tags: ['news', 'evidence', 'coordination', 'text'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.ticker} · ${item.claim}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/rumour-grading.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage,
  grade,
  verdict,
  present,
  caveat: CAVEAT,
  explain: {
    data: 'scripts/generate/rumour-grading.js#demo:data',
    state: 'demos/rumour-grading/demo.js#demo:state',
    questions: 'demos/rumour-grading/demo.js#demo:questions',
    evaluate: 'demos/rumour-grading/demo.js#demo:evaluate',
  },
};
