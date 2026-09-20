// Merchant onboarding risk: underwrite an application from what it says about itself, and set the
// reserve that makes taking it acceptable. The interesting number is not the decline rate — it is the
// money held back against the merchants that went on to cost the acquirer something.

import { choice, noul, score } from '../lib/questions.js';

const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED'];
const DECISIONS = ['APPROVE', 'REVIEW', 'DECLINE'];
const OUTCOMES = ['GOOD', 'CHARGEBACK_HEAVY', 'PROHIBITED', 'FRAUD'];

/** What each reserve holds, as a share of one month's settlement. The rolling hold builds to a third. */
const RESERVE_SHARE = { NONE: 0, FIVE_PERCENT: 0.05, TEN_PERCENT: 0.1, TWENTY_PERCENT: 0.2, ROLLING_HOLD: 0.3 };
const DOUBT_LEVELS = ['None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Certain forgery'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);
const total = (values) => values.reduce((sum, value) => sum + value, 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The application in full, plus the rules it is being read against. Nothing about how it turned out. */
function buildState(item, context) {
  return {
    task: 'Underwrite this application: set a risk tier, say whether it matches a prohibited activity, judge the documents, propose a reserve and decide.',
    acquirer: {
      name: context.acquirer,
      currency: context.currency,
      does_not_accept: context.prohibitedActivities,
      category_rules: context.categoryRules,
      volume_bands: context.volumeBands,
      document_checklist: context.documentChecklist,
      reserve_guidance: context.reserveGuidance,
      note: context.note,
    },
    application: {
      submitted: item.submittedAt,
      legal_name: item.legalName,
      trading_name: item.tradingName,
      names_differ: item.nameMismatch,
      category: item.category,
      months_registered: item.monthsRegistered,
      directors: item.directors,
      director_history: item.directorHistory,
      expected_monthly_volume: item.expectedMonthlyVolume,
      average_ticket: item.averageTicket,
      delivery_promise_days: item.deliveryPromiseDays,
      trading_country: item.tradingCountry,
      bank_account_country: item.bankCountry,
      previous_processor: item.previousProcessor,
      declared_chargeback_rate_percent: item.declaredChargebackRatePercent,
    },
    website_excerpt: item.websiteExcerpt,
    refund_policy: item.refundPolicy,
    documents: item.documents,
  };
}
// #endregion

// #region demo:questions
const questions = {
  risk_tier: choice('What risk tier does this merchant belong in?', {
    LOW: 'An established business selling what it says it sells, delivering quickly, with clean paperwork.',
    MEDIUM: 'Workable, with something to watch: a young company, a longer delivery promise, or a thin file.',
    HIGH: 'Takeable only with money held back: delivery risk, volume that does not fit the business, or a weak file.',
    PROHIBITED: 'The acquirer does not accept this activity at all, whatever the rest of the file looks like.',
  }),
  prohibited_match: noul('Does anything in this application match a line on the list the acquirer does not accept?', {
    yes: 'The website, category or policy matches one of the listed activities.',
    no: 'Nothing here is on that list, however uncomfortable the category sounds.',
  }),
  document_doubt: score('How much doubt do the documents leave?', [
    'None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Certain forgery',
  ]),
  reserve: choice('What reserve should be held against this merchant?', {
    NONE: 'No money held back.',
    FIVE_PERCENT: 'Five per cent of a month’s settlement held.',
    TEN_PERCENT: 'Ten per cent of a month’s settlement held.',
    TWENTY_PERCENT: 'Twenty per cent of a month’s settlement held.',
    ROLLING_HOLD: 'A tenth of every settlement kept for ninety days, which builds to about a third of a month.',
  }),
  decision: choice('What happens to this application?', {
    APPROVE: 'Board the merchant on the terms above.',
    REVIEW: 'Hold it for an underwriter to ask questions before boarding.',
    DECLINE: 'Refuse the application.',
  }),
};
// #endregion

// #region demo:evaluate
/** Turns five answers into the boarding decision and the money it would hold back. */
function evaluate(answers, item) {
  const reserve = answers.reserve.choice;
  const decision = answers.decision.choice;
  const held = decision === 'DECLINE' ? 0 : Math.round(item.expectedMonthlyVolume * RESERVE_SHARE[reserve]);

  return {
    tier: answers.risk_tier.choice,
    decision,
    reserve,
    reserveHeld: held,
    prohibitedMatch: answers.prohibited_match.noul >= 0.5,
    documentDoubt: answers.document_doubt.score,
    approved: decision === 'APPROVE',
    reviewed: decision === 'REVIEW',
    boarded: decision !== 'DECLINE',
    confidence: answers.decision.confidence,
    label: `${item.id} · ${readable(decision)} · ${readable(answers.risk_tier.choice)}${held ? ` · ${money(held)} held` : ''}`,
  };
}
// #endregion

// #region demo:report
/** Both sides, always together: the bad merchants that got through, and the good ones turned away. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.applicationId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const bad = graded.filter((result) => byItem.get(result.item.id).outcome !== 'GOOD');
  const good = graded.filter((result) => byItem.get(result.item.id).outcome === 'GOOD');
  const stopped = bad.filter((result) => !result.evaluation.boarded);
  const goodDeclined = good.filter((result) => !result.evaluation.boarded);

  return {
    note: `${results.length} applications. ${bad.length} of these merchants were a problem — ${labels.filter((label) => label.outcome === 'CHARGEBACK_HEAVY').length} went on to heavy chargebacks, ${labels.filter((label) => label.outcome === 'PROHIBITED').length} were never acceptable, ${labels.filter((label) => label.outcome === 'FRAUD').length} sent documents that do not hold up. ${context.note ?? ''}`,
    findings: [...findings(graded, byItem, good), ...honestFindings(graded, byItem, good)],
    kpis: kpis({ good, goodDeclined, graded, byItem }),
    distributionTitle: 'Risk tiers given',
    distribution: distribution(results),
    baselines: baselines(graded, byItem),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem),
    reserveAgainstLoss: reserveAgainstLoss(graded, byItem),
    checks: checks(graded, byItem, labels),
    topItemsTitle: 'Largest reserves held',
    topItems: topItems(results, byItem),
    metrics: metrics(graded, byItem),
  };
}
// #endregion

/** The money side: what the chargeback-heavy merchants cost, and what was held against them. */
function exposure(graded, byItem) {
  const heavy = graded.filter((result) => byItem.get(result.item.id).outcome === 'CHARGEBACK_HEAVY');
  const boarded = heavy.filter((result) => result.evaluation.boarded);
  const declined = heavy.filter((result) => !result.evaluation.boarded);
  const under = boarded.filter((result) => result.evaluation.reserveHeld < byItem.get(result.item.id).chargebacksLater);
  return {
    under,
    shortfall: Math.round(total(under.map((result) => byItem.get(result.item.id).chargebacksLater - result.evaluation.reserveHeld))),
    // Merchant by merchant: a surplus held on one cannot pay for the gap on another.
    covered: Math.round(total(boarded.map((result) => Math.min(result.evaluation.reserveHeld, byItem.get(result.item.id).chargebacksLater)))),
    avoided: total(declined.map((result) => byItem.get(result.item.id).chargebacksLater)),
    faced: total(boarded.map((result) => byItem.get(result.item.id).chargebacksLater)),
    held: total(boarded.map((result) => result.evaluation.reserveHeld)),
    boarded: boarded.length,
    declined: declined.length,
  };
}

function kpis({ good, goodDeclined, graded, byItem }) {
  const exposed = exposure(graded, byItem);
  const neverAcceptable = graded.filter((result) => ['PROHIBITED', 'FRAUD'].includes(byItem.get(result.item.id).outcome));
  const approvedAnyway = neverAcceptable.filter((result) => result.evaluation.approved);
  const prohibited = graded.filter((result) => byItem.get(result.item.id).outcome === 'PROHIBITED');
  const prohibitedRight = prohibited.filter((result) => result.evaluation.prohibitedMatch && result.evaluation.tier === 'PROHIBITED');
  const wrongProhibited = good.filter((result) => result.evaluation.prohibitedMatch);

  return [
    { label: 'Never-acceptable merchants approved', value: `${approvedAnyway.length} of ${neverAcceptable.length}`, context: 'the prohibited activities and the forged files, which no reserve makes acceptable', tone: approvedAnyway.length ? 'warn' : 'good' },
    { label: 'Good merchants declined', value: `${goodDeclined.length} of ${good.length}`, context: `${money(total(goodDeclined.map((result) => result.item.expectedMonthlyVolume)))} of monthly volume turned away`, tone: goodDeclined.length ? 'warn' : 'good' },
    { label: 'Prohibited called exactly', value: `${prohibitedRight.length} of ${prohibited.length}`, context: wrongProhibited.length ? `${wrongProhibited.length} good merchants also called prohibited` : 'and no good merchant called prohibited', tone: prohibitedRight.length === prohibited.length && !wrongProhibited.length ? 'good' : 'warn' },
    { label: 'Reserve against what was not refused', value: exposed.faced ? share(exposed.held, exposed.faced) : '–', context: `${money(exposed.held)} held against ${money(exposed.faced)} of chargebacks on the ${exposed.boarded} that were not refused, in total${exposed.under.length ? ` · merchant by merchant the holds cover ${share(exposed.covered, exposed.faced)} of it, because one surplus cannot pay another gap` : ''}`, tone: exposed.held >= exposed.faced && !exposed.under.length ? 'good' : 'warn' },
    { label: 'Under-reserved', value: `${exposed.under.length} of ${exposed.boarded}`, context: exposed.shortfall ? `${money(exposed.shortfall)} more went out than was held on those` : 'every one of them was covered', tone: exposed.under.length ? 'warn' : 'good' },
  ];
}

/** Right, file by file, as the checks count it: a good merchant boarded, a bad one refused, or one that went bad held for at least what it cost. */
function handledRight(label, boarded, held) {
  if (label.outcome === 'GOOD') return boarded;
  if (label.outcome === 'CHARGEBACK_HEAVY') return !boarded || held >= label.chargebacksLater;
  return !boarded;
}

/** The rule: refuse when the names differ and a document is not clear; hold a rolling reserve on a company under eighteen months promising delivery in fourteen days or more; board the rest with nothing held. */
function ruleDecision(item) {
  if (item.nameMismatch && item.documentsClear < item.documentsExpected) return { boarded: false, held: 0 };
  const deliveryRisk = item.deliveryPromiseDays >= 14 && item.monthsRegistered < 18;
  return { boarded: true, held: deliveryRisk ? Math.round(item.expectedMonthlyVolume * RESERVE_SHARE.ROLLING_HOLD) : 0 };
}

function countRight(graded, byItem, decide) {
  return graded.filter((result) => {
    const decision = decide(result);
    return handledRight(byItem.get(result.item.id), decision.boarded, decision.held);
  }).length;
}

const modelDecision = (result) => ({ boarded: result.evaluation.boarded, held: result.evaluation.reserveHeld });

function baselines(graded, byItem) {
  if (!graded.length) return undefined;
  return [
    { label: 'Jev', detail: 'files handled right: good boarded, unacceptable refused, later losses covered by the hold', value: countRight(graded, byItem, modelDecision) / graded.length, model: true },
    { label: 'Rule: mismatched names, slow delivery', detail: 'three lines over five fields; it cannot read the website, so it boards every prohibited merchant', value: countRight(graded, byItem, (result) => ruleDecision(result.item)) / graded.length },
    { label: 'Board everyone, hold nothing', detail: 'the commonest outcome is a good merchant', value: countRight(graded, byItem, () => ({ boarded: true, held: 0 })) / graded.length },
  ];
}

function metrics(graded, byItem) {
  if (!graded.length) return undefined;
  const neverAcceptable = graded.filter((result) => ['PROHIBITED', 'FRAUD'].includes(byItem.get(result.item.id).outcome));
  const problems = graded.filter((result) => byItem.get(result.item.id).outcome !== 'GOOD');
  const notApproved = graded.filter((result) => !result.evaluation.approved);
  const problemsNotApproved = problems.filter((result) => !result.evaluation.approved);
  const exposed = exposure(graded, byItem);
  const approvedWithHold = graded.filter((result) => result.evaluation.approved && result.evaluation.reserveHeld > 0);
  return {
    headline: { label: 'Never-acceptable merchants approved', value: neverAcceptable.length ? neverAcceptable.filter((result) => result.evaluation.approved).length / neverAcceptable.length : 0, n: neverAcceptable.length },
    accuracy: countRight(graded, byItem, modelDecision) / graded.length,
    precision: notApproved.length ? problemsNotApproved.length / notApproved.length : null,
    recall: problems.length ? problemsNotApproved.length / problems.length : null,
    lossCoveredShare: exposed.faced ? exposed.covered / exposed.faced : null,
    contradictionRate: approvedWithHold.length / graded.length,
    automationRate: graded.filter((result) => !result.evaluation.reviewed).length / graded.length,
  };
}

/** One row per merchant that went bad: what was held against what it went on to cost. */
function reserveAgainstLoss(graded, byItem) {
  return graded
    .filter((result) => byItem.get(result.item.id).outcome === 'CHARGEBACK_HEAVY')
    .map((result) => {
      const cost = Math.round(byItem.get(result.item.id).chargebacksLater);
      return { id: result.item.id, merchant: result.item.tradingName, reserveHeld: result.evaluation.reserveHeld, chargebacksLaterCost: cost, shortfallAmount: Math.max(0, cost - result.evaluation.reserveHeld) };
    })
    .sort((left, right) => right.shortfallAmount - left.shortfallAmount);
}

function honestFindings(graded, byItem, good) {
  const lines = [];
  const exposed = exposure(graded, byItem);
  if (exposed.under.length) lines.push(`Merchant by merchant the picture is less tidy than the total: ${exposed.boarded - exposed.under.length} of the ${exposed.boarded} that went bad were fully covered, and ${money(exposed.shortfall)} of the ${money(exposed.faced)} they cost (${share(exposed.shortfall, exposed.faced)}) was not held anywhere. A rolling hold is a fixed third of a month, so whether it covers a merchant is set by that constant, not by a priced answer.`);

  const goodHeld = good.filter((result) => result.evaluation.reserveHeld > 0);
  if (goodHeld.length) lines.push(`The caution has a cost too: ${money(total(goodHeld.map((result) => result.evaluation.reserveHeld)))} is held on ${goodHeld.length} merchants that turned out fine.`);

  const reviewed = graded.filter((result) => result.evaluation.reviewed);
  const reviewedGood = reviewed.filter((result) => byItem.get(result.item.id).outcome === 'GOOD');
  if (reviewedGood.length > reviewed.length / 2) lines.push(`${reviewed.length} applications went to an underwriter and ${reviewedGood.length} of them were good merchants. Nothing here charges for a review, so sending a doubtful file to a person can never count against the run.`);

  const approvedWithHold = graded.filter((result) => result.evaluation.approved && result.evaluation.reserveHeld > 0);
  if (approvedWithHold.length) lines.push(`${approvedWithHold.length} applications were approved without a person and given a reserve in the same answer set: ${approvedWithHold.map((result) => result.item.id).join(', ')}.`);
  return lines;
}

function checks(graded, byItem, labels) {
  const kinds = [...new Set(labels.map((label) => label.kind))].filter((kind) => kind !== 'ordinary');
  const rows = kinds.map((kind) => {
    const group = labels.filter((label) => label.kind === kind);
    const wrong = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.applicationId);
      if (!result) return true;
      if (label.outcome === 'GOOD') return !result.evaluation.boarded;
      // Taking a merchant that later went bad is only a mistake if too little was held back against it.
      if (label.outcome === 'CHARGEBACK_HEAVY') return result.evaluation.boarded && result.evaluation.reserveHeld < label.chargebacksLater;
      return result.evaluation.boarded;
    });
    return { id: kind.replaceAll(/[^a-z]+/gi, '-'), label: checkLabel(kind), detail: DETAIL[kind] ?? '', count: wrong.length, of: group.length, items: wrong.map((entry) => entry.applicationId) };
  });

  const ordinary = graded.filter((result) => byItem.get(result.item.id).kind === 'ordinary');
  const declined = ordinary.filter((result) => !result.evaluation.boarded);
  return [...rows, { id: 'ordinary', label: 'Ordinary merchants declined', detail: 'Small shops and services with paperwork in order and nothing to explain.', count: declined.length, of: ordinary.length, items: declined.map((result) => result.item.id) }];
}

const checkLabel = (kind) => ({
  'looks risky, turned out fine': 'Good merchants that look risky, declined',
  'went bad later': 'Went bad later: not refused, and too little held back',
}[kind] ?? `${sentence(kind)}: not refused`);

const DETAIL = {
  'went bad later': 'Long delivery promises, no returns, a young company and a volume expectation to match.',
  'prohibited from the start': 'The website sells something on the list the acquirer does not accept.',
  'documents do not hold up': 'Names that do not match, a company number that does not exist, an expired identity document.',
  'looks risky, turned out fine': 'A bonded travel agent, a hardware wallet shop, a supplements seller making no claims, a dropshipper who ships in five days.',
};

const TIER_TONE = { LOW: 'good', MEDIUM: undefined, HIGH: 'warn', PROHIBITED: 'bad' };

function distribution(results) {
  return TIERS
    .map((tier) => ({ label: sentence(tier), count: results.filter((result) => result.evaluation.tier === tier).length, tone: TIER_TONE[tier] }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'What happened to the application against how the merchant turned out',
    rowLabel: 'how the merchant turned out',
    columnLabel: 'what happened to the application',
    columns: DECISIONS.map(sentence),
    rows: OUTCOMES.map((outcome) => ({
      label: sentence(outcome),
      cells: DECISIONS.map((decision) => ({
        predicted: decision,
        count: graded.filter((result) => byItem.get(result.item.id).outcome === outcome && result.evaluation.decision === decision).length,
        diagonal: (outcome === 'GOOD') === (decision === 'APPROVE'),
      })),
    })),
  };
}

function coverage(graded, byItem) {
  const forged = graded.filter((result) => byItem.get(result.item.id).outcome === 'FRAUD');
  const points = Array.from({ length: 7 }, (_, bar) => {
    const doubted = graded.filter((result) => result.evaluation.documentDoubt >= bar);
    const real = doubted.filter((result) => byItem.get(result.item.id).outcome === 'FRAUD');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: doubted.length, caught: real.length, rate: doubted.length ? Number((real.length / doubted.length).toFixed(3)) : null };
  });
  return { title: 'Document doubt against the files that really were forged', xLabel: 'Applications doubted at this level or above', yLabel: 'Forged files among them', rateLabel: 'Share of the doubted files that were forged', of: forged.length, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
}

function findings(graded, byItem, good) {
  const lines = [];
  const decoys = good.filter((result) => byItem.get(result.item.id).kind === 'looks risky, turned out fine');
  const declinedDecoys = decoys.filter((result) => !result.evaluation.boarded);
  if (declinedDecoys.length >= 2) lines.push(`${declinedDecoys.length} of the ${decoys.length} merchants that look risky and were fine got refused: ${declinedDecoys.map((result) => `${result.item.id} (${result.item.category.toLowerCase()})`).join(', ')}. Every one of them answers the objection in its own file.`);

  const neverAcceptable = graded.filter((result) => ['PROHIBITED', 'FRAUD'].includes(byItem.get(result.item.id).outcome) && result.evaluation.boarded);
  if (neverAcceptable.length) {
    const kinds = neverAcceptable.map((result) => readable(byItem.get(result.item.id).outcome));
    lines.push(`${neverAcceptable.length} ${neverAcceptable.length === 1 ? 'merchant' : 'merchants'} no reserve makes acceptable were not refused: ${[...new Set(kinds)].join(', ')}. ${neverAcceptable.map((result) => result.item.id).join(', ')}.`);
  }

  const exposed = exposure(graded, byItem);
  if (exposed.faced) {
    lines.push(exposed.held >= exposed.faced
      ? `The merchants that went bad were boarded, and the reserves set on them cover ${share(exposed.held, exposed.faced)} of what they went on to cost: ${money(exposed.held)} held against ${money(exposed.faced)}. Underwriting is pricing, not refusing.`
      : `The reserves set against the boarded bad merchants cover ${share(exposed.held, exposed.faced)} of what they went on to cost: ${money(exposed.held)} held against ${money(exposed.faced)}.`);
  }
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => result.evaluation.reserveHeld > 0)
    .sort((left, right) => right.evaluation.reserveHeld - left.evaluation.reserveHeld || left.item.id.localeCompare(right.item.id))
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.id} · ${result.item.tradingName} · ${result.item.category.toLowerCase()} · ${readable(result.evaluation.reserve)}${byItem.get(result.item.id)?.outcome === 'CHARGEBACK_HEAVY' ? ' · went bad' : ''}`,
      value: money(result.evaluation.reserveHeld),
    }));
}

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${DOUBT_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;

function reserveText(evaluation, item, currency) {
  if (!evaluation.boarded) return 'Nothing held: not boarded';
  if (!evaluation.reserveHeld) return 'No reserve';
  return `${sentence(evaluation.reserve)} · ${money(evaluation.reserveHeld, currency)} of ${money(item.expectedMonthlyVolume, currency)} a month`;
}

function verdict(result, context) {
  const { evaluation, answers, item } = result;
  const currency = context?.currency;
  const held = evaluation.reserveHeld ? ` · ${money(evaluation.reserveHeld, currency)} held` : '';
  const prohibited = answers.prohibited_match.noul;
  const approvedWithHold = evaluation.approved && evaluation.reserveHeld > 0;
  return {
    eyebrow: 'What happens to this application',
    headline: `${sentence(evaluation.decision)} · ${readable(evaluation.tier)}${evaluation.tier === 'PROHIBITED' ? '' : ' risk'}${held}`,
    detail: evaluation.reviewed ? 'An underwriter asks questions before the merchant is boarded.' : evaluation.approved ? 'Boarded without a person on these terms.' : 'Refused; no reserve makes it acceptable.',
    facts: [
      { label: 'Risk tier', value: `${sentence(evaluation.tier)} · ${percentOf(answers.risk_tier.confidence)}`, tone: TIER_TONE[evaluation.tier] },
      { label: 'Reserve', value: reserveText(evaluation, item, currency), tone: approvedWithHold ? 'warn' : undefined },
      { label: 'Matches a prohibited activity', value: `${evaluation.prohibitedMatch ? 'Yes' : 'No'} · ${percentOf(Math.max(prohibited, 1 - prohibited))}`, tone: evaluation.prohibitedMatch ? 'bad' : 'good' },
      { label: 'Doubt about the documents', value: levelOf(evaluation.documentDoubt), tone: evaluation.documentDoubt >= 3 ? 'bad' : evaluation.documentDoubt >= 2 ? 'warn' : 'good' },
      { label: 'Confidence in the decision', value: percentOf(evaluation.confidence), tone: evaluation.confidence < 0.6 ? 'warn' : undefined },
    ],
  };
}

function gradeNote(result, label, currency) {
  const { evaluation } = result;
  if (label.outcome === 'CHARGEBACK_HEAVY') {
    const cost = money(label.chargebacksLater, currency);
    if (!evaluation.boarded) return `Went on to ${cost} of chargebacks; it was refused.`;
    const gap = label.chargebacksLater - evaluation.reserveHeld;
    return gap > 0 ? `Went on to ${cost} of chargebacks; the hold was ${money(gap, currency)} short.` : `Went on to ${cost} of chargebacks; the hold of ${money(evaluation.reserveHeld, currency)} covered it.`;
  }
  if (label.outcome === 'PROHIBITED') return 'Planted as an activity the acquirer does not accept.';
  if (label.outcome === 'FRAUD') return `Planted with documents that do not hold up; document doubt was ${evaluation.documentDoubt.toFixed(1)} of 6.`;
  if (label.kind === 'looks risky, turned out fine') return `Looks risky and turned out fine${evaluation.reserveHeld ? `; ${money(evaluation.reserveHeld, currency)} of its money is held` : ''}.`;
  return undefined;
}

const expectedHandling = (label) => (label.outcome === 'GOOD' ? 'boarded' : label.outcome === 'CHARGEBACK_HEAVY' ? 'refused, or held for what it cost' : 'refused');

const grade = {
  labelId: (label) => label.applicationId,
  // Right as the checks count it: good boarded, unacceptable refused, a later loss covered by the hold.
  judge: (result, label, context) => {
    if (!label) return null;
    return {
      agree: handledRight(label, result.evaluation.boarded, result.evaluation.reserveHeld),
      expected: expectedHandling(label),
      got: `${readable(result.evaluation.decision)}${result.evaluation.reserveHeld ? `, ${money(result.evaluation.reserveHeld, context?.currency)} held` : ''}`,
      note: gradeNote(result, label, context?.currency),
      confidence: result.answers.decision.confidence,
    };
  },
};

const present = {
  number: 115,
  problem: {
    headline: 'Refusing every merchant that looks risky loses good business. The other tool is the reserve: how much of their money to hold.',
    stat: '140',
    statLabel: 'applications, 22 of them a problem later',
  },
  hero: {
    item: 'APP-037',
    caption: 'A five-month-old dropshipper promising delivery in 44 days, expecting £102,054 a month. Not refused: sent to review as high risk with £30,616 held. It went on to £27,555 of chargebacks.',
  },
  answers: {
    caption: 'Five typed answers: the tier, a check against the prohibited list, doubt about the documents, the reserve and the decision.',
    reveal: ['risk_tier', 'prohibited_match', 'document_doubt', 'reserve', 'decision'],
  },
  miss: {
    item: 'APP-062',
    caption: 'The same kind of file, £146,615 a month, and the same rolling hold: £43,984. It went on to £52,781 of chargebacks, so the hold was £8,797 short. Five of eleven were short like this.',
  },
  proof: {
    kpis: ['Never-acceptable merchants approved', 'Good merchants declined', 'Under-reserved'],
    chart: 'baselines',
    closing: 'No unacceptable merchant approved and no good one refused; merchant by merchant, the holds covered 88.5% of the £414,610 the bad ones went on to cost.',
  },
};

export default {
  id: 'merchant-onboarding',
  title: 'Merchant onboarding risk',
  domain: 'orders',
  value: 'Underwrite a new merchant from its own application, and set the reserve that makes it acceptable.',
  tags: ['underwriting', 'onboarding', 'risk', 'payments'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.tradingName} · ${item.category.toLowerCase()}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/merchant-onboarding.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage: {
    hide: ['documentsClear', 'documentsExpected'],
    labels: {
      submittedAt: 'Submitted',
      nameMismatch: 'Legal and trading names differ',
      monthsRegistered: 'Months registered',
      expectedMonthlyVolume: 'Expected monthly volume',
      averageTicket: 'Average ticket',
      deliveryPromiseDays: 'Delivery promise (days)',
      declaredChargebackRatePercent: 'Declared chargeback rate (%)',
      websiteExcerpt: 'From the website',
      refundPolicy: 'Refund policy',
      note: 'Reviewer note',
    },
    highlight: ['deliveryPromiseDays', 'monthsRegistered', 'nameMismatch', 'expectedMonthlyVolume'],
  },
  grade,
  verdict,
  present,
  caveat: 'The five forged files are the only ones whose document notes state the problem outright, and all eleven merchants that went bad are companies under eight months old promising delivery in 25 days or more, so parts of this run measure reading. The reserve also collapsed to two values, none or a rolling hold. A harder dataset is planned.',
  explain: {
    data: 'scripts/generate/merchant-onboarding.js#demo:data',
    state: 'demos/merchant-onboarding/demo.js#demo:state',
    questions: 'demos/merchant-onboarding/demo.js#demo:questions',
    evaluate: 'demos/merchant-onboarding/demo.js#demo:evaluate',
  },
};
