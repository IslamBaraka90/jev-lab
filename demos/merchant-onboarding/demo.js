// Merchant onboarding risk: underwrite an application from what it says about itself, and set the
// reserve that makes taking it acceptable. The interesting number is not the decline rate — it is the
// money held back against the merchants that went on to cost the acquirer something.

import { choice, noul, score } from '../lib/questions.js';

const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED'];
const DECISIONS = ['APPROVE', 'REVIEW', 'DECLINE'];
const OUTCOMES = ['GOOD', 'CHARGEBACK_HEAVY', 'PROHIBITED', 'FRAUD'];

/** What each reserve holds, as a share of one month's settlement. The rolling hold builds to a third. */
const RESERVE_SHARE = { NONE: 0, FIVE_PERCENT: 0.05, TEN_PERCENT: 0.1, TWENTY_PERCENT: 0.2, ROLLING_HOLD: 0.3 };

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
    note: `A hundred and forty applications. ${bad.length} of these merchants were a problem — ${labels.filter((label) => label.outcome === 'CHARGEBACK_HEAVY').length} went on to heavy chargebacks, ${labels.filter((label) => label.outcome === 'PROHIBITED').length} were never acceptable, ${labels.filter((label) => label.outcome === 'FRAUD').length} sent documents that do not hold up. ${context.note ?? ''}`,
    findings: findings(graded, byItem, good),
    kpis: kpis({ good, goodDeclined, graded, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
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
  const reviewed = graded.filter((result) => result.evaluation.reviewed);
  const reviewedProblems = reviewed.filter((result) => byItem.get(result.item.id).outcome !== 'GOOD');
  const prohibited = graded.filter((result) => byItem.get(result.item.id).outcome === 'PROHIBITED');
  const prohibitedRight = prohibited.filter((result) => result.evaluation.prohibitedMatch && result.evaluation.tier === 'PROHIBITED');
  const wrongProhibited = good.filter((result) => result.evaluation.prohibitedMatch);

  return [
    { label: 'Never-acceptable merchants approved', value: `${approvedAnyway.length} of ${neverAcceptable.length}`, context: 'the prohibited activities and the forged files, which no reserve makes acceptable', tone: approvedAnyway.length ? 'warn' : 'good' },
    { label: 'Good merchants declined', value: `${goodDeclined.length} of ${good.length}`, context: `${money(total(goodDeclined.map((result) => result.item.expectedMonthlyVolume)))} of monthly volume turned away`, tone: goodDeclined.length ? 'warn' : 'good' },
    { label: 'Prohibited called exactly', value: `${prohibitedRight.length} of ${prohibited.length}`, context: wrongProhibited.length ? `${wrongProhibited.length} good merchants also called prohibited` : 'and no good merchant called prohibited', tone: prohibitedRight.length === prohibited.length && !wrongProhibited.length ? 'good' : 'warn' },
    { label: 'Reserve against what was not refused', value: exposed.faced ? share(exposed.held, exposed.faced) : '–', context: `${money(exposed.held)} held against ${money(exposed.faced)} of chargebacks on the ${exposed.boarded} that were not refused`, tone: exposed.held >= exposed.faced ? 'good' : 'warn' },
    { label: 'Under-reserved', value: `${exposed.under.length} of ${exposed.boarded}`, context: exposed.shortfall ? `${money(exposed.shortfall)} more went out than was held on those` : 'every one of them was covered', tone: exposed.under.length ? 'warn' : 'good' },
    { label: 'Sent to an underwriter', value: reviewed.length, context: `${share(reviewed.length, graded.length)} of the applications · ${reviewedProblems.length} of them were the problem files` },
  ];
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

function distribution(results) {
  return TIERS
    .map((tier) => ({ label: sentence(tier), count: results.filter((result) => result.evaluation.tier === tier).length, tone: tier === 'LOW' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'What happened to the application against how the merchant turned out',
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
  return { title: 'Document doubt against the files that really were forged', xLabel: 'Applications doubted at this level or above', yLabel: 'Forged files among them', rateLabel: 'Share of the doubted files that were forged', of: forged.length, points };
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
      label: `${result.item.tradingName} · ${result.item.category.toLowerCase()} · ${readable(result.evaluation.reserve)}${byItem.get(result.item.id)?.outcome === 'CHARGEBACK_HEAVY' ? ' · went bad' : ''}`,
      value: money(result.evaluation.reserveHeld),
    }));
}

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
  explain: {
    data: 'scripts/generate/merchant-onboarding.js#demo:data',
    state: 'demos/merchant-onboarding/demo.js#demo:state',
    questions: 'demos/merchant-onboarding/demo.js#demo:questions',
    evaluate: 'demos/merchant-onboarding/demo.js#demo:evaluate',
  },
};
