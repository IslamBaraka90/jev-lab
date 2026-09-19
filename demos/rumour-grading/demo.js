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
    distribution: distribution(graded),
    matrix: dispositionMatrix(graded, byItem),
    curve: calibration(graded, byItem),
    checks: checks(graded, byItem, of),
    topItems: topItems(graded, byItem),
  };
}
// #endregion

function kpis(graded, byItem, of) {
  const confirmed = of('outcome', 'CONFIRMED');
  const denied = of('outcome', 'DENIED');
  const ignoredTruths = confirmed.filter((result) => result.evaluation.disposition === 'IGNORE');
  const trustedLies = denied.filter((result) => result.evaluation.disposition === 'ACT_WORTHY');
  const pushes = of('spread', 'COORDINATED');
  const viral = of('spread', 'VIRAL');
  const caughtPushes = pushes.filter((result) => result.evaluation.coordinated);
  const falsePushes = viral.filter((result) => result.evaluation.coordinated);
  const citing = graded.filter((result) => byItem.get(result.item.id).checkable);
  const gap = average(confirmed.map((result) => result.evaluation.reliability)) - average(denied.map((result) => result.evaluation.reliability));
  const sent = graded.filter((result) => ['VERIFY', 'ACT_WORTHY'].includes(result.evaluation.disposition));
  const wasted = sent.filter((result) => byItem.get(result.item.id).outcome === 'DENIED');

  return [
    { label: 'Sent to somebody to check', value: `${sent.length} of ${graded.length}`, context: `${sent.filter((result) => byItem.get(result.item.id).outcome === 'CONFIRMED').length} of those turned out true and ${wasted.length} turned out false`, tone: sent.length > graded.length / 2 ? 'warn' : 'good' },
    { label: 'Confirmed claims ignored', value: `${ignoredTruths.length} of ${confirmed.length}`, context: 'true, and waved away before anybody looked', tone: ignoredTruths.length > confirmed.length / 5 ? 'warn' : 'good' },
    { label: 'Denied claims called act-worthy', value: `${trustedLies.length} of ${denied.length}`, context: 'false, and graded good enough to act on', tone: trustedLies.length ? 'warn' : 'good' },
    { label: 'Coordinated pushes caught', value: `${caughtPushes.length} of ${pushes.length}`, context: 'many accounts, the same sentence, inside half an hour', tone: pushes.length && caughtPushes.length >= pushes.length * 0.7 ? 'good' : 'warn' },
    { label: 'Organic spread called organised', value: `${falsePushes.length} of ${viral.length}`, context: 'just as many accounts, just as fast, in their own words', tone: falsePushes.length > viral.length / 4 ? 'warn' : 'good' },
    { label: 'Reliability gap, true against false', value: gap.toFixed(1), context: 'how much more weight the confirmed claims’ sources were given', tone: gap > 0.5 ? 'good' : 'warn' },
    { label: 'Checkable claims spotted', value: `${citing.filter((result) => result.evaluation.checkable).length} of ${citing.length}`, context: 'a named document somebody could go and read' },
  ];
}

function checks(graded, byItem, of) {
  const confirmed = of('outcome', 'CONFIRMED');
  const denied = of('outcome', 'DENIED');
  const pushes = of('spread', 'COORDINATED');
  const viral = of('spread', 'VIRAL');
  const citing = graded.filter((result) => byItem.get(result.item.id).checkable);

  const missedPushes = pushes.filter((result) => !result.evaluation.coordinated);
  const ignoredTruths = confirmed.filter((result) => result.evaluation.disposition === 'IGNORE');
  const trustedLies = denied.filter((result) => ['ACT_WORTHY', 'VERIFY'].includes(result.evaluation.disposition));
  const missedDocuments = citing.filter((result) => !result.evaluation.checkable);
  const phantomDocuments = graded.filter((result) => !byItem.get(result.item.id).checkable && result.evaluation.checkable);

  return [
    { id: 'ignored', label: 'True claim ignored', detail: 'Later confirmed, and the disposition was to do nothing.', count: ignoredTruths.length, of: confirmed.length, items: ignoredTruths.slice(0, 20).map((result) => result.item.id) },
    { id: 'trusted', label: 'False claim sent for verifying or acting on', detail: 'Later denied, and somebody would have spent time on it.', count: trustedLies.length, of: denied.length, items: trustedLies.slice(0, 20).map((result) => result.item.id) },
    { id: 'pushes', label: 'Coordinated push missed', detail: 'Over eighty per cent shared wording across dozens of accounts in under an hour.', count: missedPushes.length, of: pushes.length, items: missedPushes.slice(0, 20).map((result) => result.item.id) },
    { id: 'viral', label: 'Organic spread mistaken for a push', detail: 'The same reach and speed, under a third of the wording shared.', count: viral.filter((result) => result.evaluation.coordinated).length, of: viral.length, items: viral.filter((result) => result.evaluation.coordinated).slice(0, 20).map((result) => result.item.id) },
    { id: 'documents', label: 'Cited document not noticed', detail: 'The claim names a document and the answer said there was nothing to check.', count: missedDocuments.length, of: citing.length, items: missedDocuments.slice(0, 20).map((result) => result.item.id) },
    { id: 'phantom', label: 'Something checkable claimed where nothing is cited', detail: 'No document is named anywhere in the claim.', count: phantomDocuments.length, of: graded.length - citing.length, items: phantomDocuments.slice(0, 20).map((result) => result.item.id) },
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
  return { title: 'Source reliability against what turned out to be true', xLabel: 'Resolved claims graded this reliable or above', yLabel: 'Of those, the ones later confirmed', rateLabel: 'Share confirmed', of: resolved.filter((result) => byItem.get(result.item.id).outcome === 'CONFIRMED').length, points };
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
  }

  const ignoredTruths = of('outcome', 'CONFIRMED').filter((result) => result.evaluation.disposition === 'IGNORE');
  if (ignoredTruths.length) lines.push(`${ignoredTruths.length} claims that turned out to be true were marked ignore. That is the expensive error here, and it is the one nobody sees at the time.`);

  const unresolved = of('outcome', 'UNRESOLVED');
  const actedOnAir = unresolved.filter((result) => result.evaluation.disposition === 'ACT_WORTHY');
  if (actedOnAir.length) lines.push(`${actedOnAir.length} of ${unresolved.length} claims that never resolved either way were graded act-worthy. Nothing proves those wrong, and that is exactly the problem with them.`);

  const used = new Set(graded.map((result) => result.evaluation.disposition));
  const unused = DISPOSITIONS.filter((value) => !used.has(value));
  if (unused.length) lines.push(`${unused.map(readable).join(' and ')} went unused across all ${graded.length} claims. Everything landed in the middle, so read the reliability score and the checkable answer rather than the disposition — those are where this run put its judgement.`);

  const sent = graded.filter((result) => ['VERIFY', 'ACT_WORTHY'].includes(result.evaluation.disposition));
  const wasted = sent.filter((result) => byItem.get(result.item.id).outcome === 'DENIED');
  if (wasted.length) lines.push(`${wasted.length} of the ${sent.length} claims sent for checking turned out to be false. Nobody knew that at the time, and that is what a verification budget is for — but it is the number to put against the cost of the team.`);

  const strength = average(of('spread', 'COORDINATED').map((result) => result.evaluation.coordinationStrength)) - average(of('spread', 'VIRAL').map((result) => result.evaluation.coordinationStrength));
  if (Math.abs(strength) > 0.1) lines.push(`The strength behind the coordination answer separates the two groups by ${strength.toFixed(2)}, which is a cleaner signal than the yes-or-no it gets turned into.`);
  return lines;
}

function topItems(graded, byItem) {
  const rank = { ACT_WORTHY: 3, VERIFY: 2, WATCH: 1, IGNORE: 0 };
  return [...graded]
    .sort((left, right) => rank[right.evaluation.disposition] - rank[left.evaluation.disposition] || right.evaluation.reliability - left.evaluation.reliability)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: result.evaluation.label,
      value: readable(byItem.get(result.item.id).outcome),
    }));
}

export default {
  id: 'rumour-grading',
  title: 'Rumour grading',
  domain: 'news',
  value: 'Grade a claim before acting on it: how good the source is, whether anybody independent is saying it, and whether the spread was organised.',
  tags: ['news', 'evidence', 'coordination', 'text'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.ticker} · ${item.sourceDescription}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/rumour-grading.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/rumour-grading.js#demo:data',
    state: 'demos/rumour-grading/demo.js#demo:state',
    questions: 'demos/rumour-grading/demo.js#demo:questions',
    evaluate: 'demos/rumour-grading/demo.js#demo:evaluate',
  },
};
