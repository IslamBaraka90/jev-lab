// AML alert triage: three hundred alerts, two analysts, and about fifty alerts a week of capacity. The
// demo cuts the queue and says what it thinks each alert is. It closes, monitors or escalates — it
// never decides that anything is reported to anybody, and the page says so.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const TYPOLOGIES = ['STRUCTURING', 'LAYERING', 'MULE_ACTIVITY', 'TRADE_BASED', 'THIRD_PARTY_FUNDING', 'NONE'];
const DISPOSITIONS = ['CLOSE', 'MONITOR', 'ESCALATE'];
const MISSING = ['SOURCE_OF_FUNDS', 'COUNTERPARTY_IDENTITY', 'BUSINESS_PURPOSE', 'NONE'];
// The bar the score queue is cut at: "High" on the suspicion rubric.
const SCORE_BAR = 4;

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The alert, ninety days of the account, and what the customer said they would do. */
function buildState(item, context) {
  return {
    task: 'Triage this monitoring alert: name the typology if there is one, decide whether to close, monitor or escalate, and say what is missing.',
    bank: { name: context.bank, currency: context.currency, cash_reporting_threshold: context.cashReportingThreshold, capacity: context.analystCapacity, scope: context.wording },
    alert: {
      fired: item.firedAt,
      scenario: item.scenario,
      triggering_payments: item.triggeringPaymentList,
      triggering_total: item.triggeringTotal,
    },
    customer: {
      type: item.customerType,
      stated_activity: item.statedActivity,
      expected_monthly_turnover: item.expectedMonthlyTurnover,
      onboarding_risk_rating: item.onboardingRisk,
      months_dormant_before_this: item.monthsDormantBefore,
    },
    last_ninety_days: {
      credits: item.creditsIn90Days,
      credit_total: item.creditTotal90Days,
      debits: item.debitsIn90Days,
      debit_total: item.debitTotal90Days,
      distinct_counterparties: item.distinctCounterparties90Days,
      share_in_cash_percent: item.cashSharePercent,
      main_corridor: item.mainCorridor,
      corridor_risk_rating: item.corridorRisk,
    },
    history: { earlier_alerts: item.priorAlerts, how_they_ended: item.priorOutcome, relationship_file: item.relationshipNote },
  };
}
// #endregion

// #region demo:questions
const questions = {
  typology: choice('What pattern does this alert fit, if any?', {
    STRUCTURING: 'Payments arranged to stay under a reporting threshold.',
    LAYERING: 'Money moved through accounts to put distance between it and where it came from.',
    MULE_ACTIVITY: 'An account taking money from many people and passing it straight on.',
    TRADE_BASED: 'Trade paperwork used to move value: invoices that do not match the goods.',
    THIRD_PARTY_FUNDING: 'The account is funded by someone with no visible connection to the customer.',
    NONE: 'The activity fits an ordinary life or an ordinary business.',
  }),
  activity_explained: noul('Does what the customer told the bank explain this activity?', {
    yes: 'The stated work, the expected turnover and the file account for what happened.',
    no: 'The activity does not follow from anything the customer has told the bank.',
  }),
  suspicion: score('How much does this alert deserve an analyst’s time?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  disposition: choice('What happens to this alert?', {
    CLOSE: 'Close it with the reason. Nothing here needs a person again.',
    MONITOR: 'Leave the account under watch and look again if the pattern repeats.',
    ESCALATE: 'Send it to the financial crime team to investigate properly.',
  }),
  information_missing: choice('What single piece of information would settle this?', {
    SOURCE_OF_FUNDS: 'Where the money came from.',
    COUNTERPARTY_IDENTITY: 'Who the other side of these payments actually is.',
    BUSINESS_PURPOSE: 'What the payments were for.',
    NONE: 'Nothing is missing. The file already answers it.',
  }),
};
// #endregion

// #region demo:evaluate
/** One alert's triage: what it is, what happens to it, and what an analyst should ask for. */
function evaluate(answers, item) {
  const disposition = answers.disposition.choice;

  return {
    typology: answers.typology.choice,
    disposition,
    suspicion: answers.suspicion.score,
    explained: answers.activity_explained.noul >= 0.5,
    missing: answers.information_missing.choice,
    kept: disposition !== 'CLOSE',
    escalated: disposition === 'ESCALATE',
    confidence: answers.typology.confidence,
    label: `${item.id} · ${readable(disposition)}${answers.typology.choice === 'NONE' ? '' : ` · ${readable(answers.typology.choice)}`}`,
  };
}
// #endregion

// #region demo:report
/** Queue reduction is only a number next to a catch rate, so the two are always reported together. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.alertId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const real = graded.filter((result) => byItem.get(result.item.id).truePositive);
  const kept = graded.filter((result) => result.evaluation.escalated);
  const keptReal = real.filter((result) => result.evaluation.escalated);

  return {
    note: `${context.note ?? ''} ${context.wording ?? ''}`.trim(),
    findings: findings(graded, byItem, real),
    kpis: kpis({ graded, real, kept, keptReal, byItem }),
    baselines: baselines(graded, byItem, real),
    metrics: metrics(graded, byItem, real),
    distribution: distribution(results),
    distributionTitle: 'What happens to each alert',
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, real),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
    topItemsTitle: 'Escalated, most suspicious first',
  };
}
// #endregion

/** The alerts at or above the suspicion bar, and the ones among them that were worth working. */
function scoreQueue(graded, byItem) {
  const queue = graded.filter((result) => result.evaluation.suspicion >= SCORE_BAR);
  return { queue, real: queue.filter((result) => byItem.get(result.item.id).truePositive) };
}

// The rule: keep an alert when the payments that fired it add up to three months of expected turnover.
function ruleKeeps(item) {
  return item.triggeringTotal >= 3 * item.expectedMonthlyTurnover;
}

/** How many alerts, taken in suspicion order, have to be opened before every real one has been seen. */
function alertsToFindAll(graded, byItem, real) {
  const ordered = [...graded].sort((left, right) => right.evaluation.suspicion - left.evaluation.suspicion);
  let found = 0;
  for (let opened = 0; opened < ordered.length; opened++) {
    if (byItem.get(ordered[opened].item.id).truePositive) found += 1;
    if (found === real.length) return opened + 1;
  }
  return ordered.length;
}

/** Each way of cutting the queue, scored the same way: the share of what it keeps that is worth working. */
function baselines(graded, byItem, real) {
  if (!graded.length || !real.length) return undefined;
  const row = (label, detail, queue) => {
    const hits = queue.filter((result) => byItem.get(result.item.id).truePositive).length;
    return { label, detail: `${detail} · keeps ${hits} of the ${real.length}`, value: queue.length ? hits / queue.length : 0, display: `${hits} of ${queue.length}` };
  };
  return [
    { ...row('Jev, suspicion score', `alerts scored ${SCORE_BAR} of 6 or above`, scoreQueue(graded, byItem).queue), model: true },
    row('Jev, escalate choice', 'the disposition question', graded.filter((result) => result.evaluation.escalated)),
    row('Rule: three months of turnover', 'triggering total at least 3 × expected monthly turnover', graded.filter((result) => ruleKeeps(result.item))),
    row('No triage', 'every alert opened', graded),
  ];
}

/** Flat numbers for the scoreboard. Precision and recall are of the score queue; macro F1 is of the typology. */
function metrics(graded, byItem, real) {
  const { queue, real: queueReal } = scoreQueue(graded, byItem);
  const right = graded.filter((result) => (result.evaluation.suspicion >= SCORE_BAR) === Boolean(byItem.get(result.item.id).truePositive));
  const precision = queue.length ? queueReal.length / queue.length : 0;
  return {
    headline: { label: 'Worth working, in the score queue', value: precision, n: queue.length },
    accuracy: graded.length ? right.length / graded.length : null,
    precision,
    recall: real.length ? queueReal.length / real.length : null,
    macroF1: matrixStats(confusion(graded, byItem))?.macroF1 ?? null,
    automationRate: graded.length ? graded.filter((result) => !result.evaluation.kept).length / graded.length : null,
  };
}

function kpis({ graded, real, kept, keptReal, byItem }) {
  const { queue, real: queueReal } = scoreQueue(graded, byItem);
  const named = keptReal.filter((result) => result.evaluation.typology === byItem.get(result.item.id).typology);
  const explained = graded.filter((result) => byItem.get(result.item.id).kind === 'explained in the file');
  const closedExplained = explained.filter((result) => !result.evaluation.kept);
  const watched = graded.filter((result) => result.evaluation.disposition === 'MONITOR');

  return [
    { label: 'Worth working, in the score queue', value: share(queueReal.length, queue.length), context: `${queueReal.length} of the ${queue.length} alerts scored ${SCORE_BAR} of 6 or above · ${queueReal.length} of the ${real.length} worth working are in it`, tone: queueReal.length === real.length ? 'good' : 'warn' },
    { label: 'Queue after triage', value: `${kept.length} of ${graded.length}`, context: `a ${share(graded.length - kept.length, graded.length)} cut, keeping ${keptReal.length} of the ${real.length} alerts worth working · by the escalate choice, ${share(keptReal.length, kept.length)} of it real`, tone: keptReal.length === real.length ? 'good' : 'warn' },
    { label: 'Worth working, escalated', value: `${keptReal.length} of ${real.length}`, context: `${named.length} of them named for the right pattern`, tone: keptReal.length === real.length ? 'good' : 'bad' },
    { label: 'Explained spikes closed', value: `${closedExplained.length} of ${explained.length}`, context: 'house sales, bonuses, seasonal trade, money collected for a wedding', tone: closedExplained.length === explained.length ? 'good' : 'warn' },
    { label: 'Left under watch', value: watched.length, context: `neither worked now nor closed · ${watched.filter((result) => byItem.get(result.item.id).truePositive).length} of the ones worth working sit here`, tone: watched.filter((result) => byItem.get(result.item.id).truePositive).length ? 'warn' : 'good' },
  ];
}

function checks(graded, byItem, labels) {
  const rows = TYPOLOGIES.filter((typology) => typology !== 'NONE' && typology !== 'LAYERING').map((typology) => {
    const group = labels.filter((label) => label.typology === typology);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.alertId);
      return !result || !result.evaluation.escalated;
    });
    return { id: typology.toLowerCase(), label: `${sentence(typology)} not escalated`, detail: questions.typology.criteria[typology], count: missed.length, of: group.length, items: missed.map((label) => label.alertId) };
  });

  const explained = labels.filter((label) => label.kind === 'explained in the file');
  const keptExplained = explained.filter((label) => graded.some((result) => result.item.id === label.alertId && result.evaluation.kept));
  const everyday = graded.filter((result) => byItem.get(result.item.id).kind === 'everyday');
  const escalatedEveryday = everyday.filter((result) => result.evaluation.escalated);
  return [
    ...rows,
    { id: 'explained', label: 'Explained spikes kept in the queue', detail: 'Thirty alerts whose explanation is already in the customer file.', count: keptExplained.length, of: explained.length, items: keptExplained.map((label) => label.alertId) },
    { id: 'everyday', label: 'Everyday alerts escalated', detail: 'The rest of the queue: thresholds doing what thresholds do.', count: escalatedEveryday.length, of: everyday.length, items: escalatedEveryday.map((result) => result.item.id) },
  ];
}

function distribution(results) {
  return [
    ...DISPOSITIONS.map((disposition) => ({ label: sentence(disposition), count: results.filter((result) => result.evaluation.disposition === disposition).length, tone: disposition === 'CLOSE' ? 'good' : 'warn' })),
  ].filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Typology named against what was planted',
    rowLabel: 'the typology that was planted',
    columnLabel: 'the typology the model named',
    columns: TYPOLOGIES.map(sentence),
    rows: TYPOLOGIES.map((actual) => ({
      label: sentence(actual),
      cells: TYPOLOGIES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).typology === actual && result.evaluation.typology === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, real) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const queue = graded.filter((result) => result.evaluation.suspicion >= bar);
    const caught = queue.filter((result) => byItem.get(result.item.id).truePositive);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: queue.length, caught: caught.length, rate: queue.length ? Number((caught.length / queue.length).toFixed(3)) : null };
  });
  return { title: 'Where the queue is cut, and what is still in it', xLabel: 'Alerts an analyst opens', yLabel: 'Alerts worth working among them', rateLabel: 'Share of the queue worth working', of: real.length, points, thresholdFormat: 'level', levels: 6, defaultIndex: SCORE_BAR };
}

function findings(graded, byItem, real) {
  const lines = [];
  const lost = real.filter((result) => !result.evaluation.escalated);
  if (lost.length) lines.push(`${lost.length} of the ${real.length} alerts worth working ${lost.length === 1 ? 'was' : 'were'} not escalated: ${lost.map((result) => `${result.item.id} (${readable(byItem.get(result.item.id).typology)})`).join(', ')}.`);

  const escalated = graded.filter((result) => result.evaluation.escalated);
  const { queue, real: queueReal } = scoreQueue(graded, byItem);
  if (real.length && queue.length < escalated.length && queueReal.length === real.length) {
    lines.push(`The score is the sharper instrument. Cutting at a suspicion of ${SCORE_BAR} of 6 leaves ${queue.length} alerts with all ${real.length} worth working among them; the escalate choice keeps ${escalated.length} to hold the same ${real.length}. In suspicion order the first ${alertsToFindAll(graded, byItem, real)} alerts contain every one.`);
  }

  const clean = graded.filter((result) => !byItem.get(result.item.id).truePositive);
  const typedClean = clean.filter((result) => result.evaluation.typology !== 'NONE');
  if (typedClean.length >= 10) lines.push(`${typedClean.length} of the ${clean.length} alerts with nothing planted in them were still given a typology. The name on an alert means little without the score beside it.`);

  const keptExplained = graded.filter((result) => byItem.get(result.item.id).kind === 'explained in the file' && result.evaluation.kept);
  if (keptExplained.length >= 3) {
    const looks = [...new Set(keptExplained.map((result) => byItem.get(result.item.id).look))];
    lines.push(`${keptExplained.length} spikes with an explanation already in the file stayed in the queue: ${looks.join(', ')}. Each one costs an analyst the time it takes to read the file and write the same sentence the file already contains.`);
  }

  const asked = graded.filter((result) => result.evaluation.escalated && result.evaluation.missing !== 'NONE');
  if (asked.length) {
    const counts = new Map();
    for (const result of asked) counts.set(result.evaluation.missing, (counts.get(result.evaluation.missing) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    lines.push(`The escalations ask for one thing more than any other: ${readable(top[0])}, on ${top[1]} of ${asked.length}. That is a request an analyst can send without reading the file first.`);
  }
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.escalated)
    .sort((left, right) => right.evaluation.suspicion - left.evaluation.suspicion || right.item.triggeringTotal - left.item.triggeringTotal)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.truePositive ? ' · planted' : ''}`,
      value: money(result.item.triggeringTotal, currency),
    }));
}

const levelName = (value) => questions.suspicion.criteria[Math.max(0, Math.min(6, Math.round(value)))];
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;

/** What a planted alert was, in a sentence. Everyday alerts carry no note. */
function plantedNote(label) {
  if (label.truePositive) return `Planted as ${readable(label.typology)}.`;
  if (label.kind === 'explained in the file') return `Planted as an explained spike: ${label.look}, with the explanation already in the customer file.`;
  return undefined;
}

// Right means the alert sits on the correct side of the suspicion bar, which is what the score queue counts.
const grade = {
  labelId: (label) => label.alertId,
  judge: (result, label) => {
    if (!label) return null;
    const inQueue = result.evaluation.suspicion >= SCORE_BAR;
    return {
      agree: inQueue === Boolean(label.truePositive),
      expected: label.truePositive ? 'worth an analyst' : 'not worth an analyst',
      got: inQueue ? `in the score queue at ${result.evaluation.suspicion.toFixed(1)} of 6` : `below the bar at ${result.evaluation.suspicion.toFixed(1)} of 6`,
      note: plantedNote(label),
      confidence: result.answers.suspicion.confidence,
    };
  },
};

function verdict(result, context = {}) {
  const { item, answers, evaluation } = result;
  const named = evaluation.typology !== 'NONE';
  const months = item.expectedMonthlyTurnover ? item.triggeringTotal / item.expectedMonthlyTurnover : null;
  const facts = [
    { label: 'Deserves an analyst’s time', value: `${levelName(evaluation.suspicion)} · ${evaluation.suspicion.toFixed(1)} of 6`, tone: evaluation.suspicion >= SCORE_BAR ? 'bad' : evaluation.suspicion >= 3 ? 'warn' : 'good' },
    { label: 'The customer’s stated activity explains it', value: yesNo(answers.activity_explained.noul), tone: evaluation.explained ? 'good' : 'warn' },
    { label: 'Triggering payments', value: `${money(item.triggeringTotal, context.currency)}${months === null ? '' : ` · ${months.toFixed(1)} × an expected month`}` },
  ];
  if (evaluation.missing !== 'NONE') facts.push({ label: 'What would settle it', value: readable(evaluation.missing) });
  facts.push({ label: 'Confidence in the disposition', value: `${Math.round(answers.disposition.confidence * 100)}%` });

  return {
    eyebrow: 'What happens to this alert',
    headline: `${sentence(evaluation.disposition)}${named ? ` · ${readable(evaluation.typology)}` : ''}`,
    detail: 'Close, monitor or escalate only. Nothing here decides whether anything is reported to an authority.',
    facts,
  };
}

const stage = {
  hide: ['triggeringPayments'],
  labels: {
    firedAt: 'Alert fired',
    scenario: 'Scenario that fired',
    triggeringTotal: 'Triggering total',
    triggeringPaymentList: 'Payments that fired the alert',
    expectedMonthlyTurnover: 'Expected monthly turnover',
    creditsIn90Days: 'Credits in 90 days',
    creditTotal90Days: 'Credit total, 90 days',
    debitsIn90Days: 'Debits in 90 days',
    debitTotal90Days: 'Debit total, 90 days',
    distinctCounterparties90Days: 'Distinct counterparties, 90 days',
    cashSharePercent: 'Share in cash (%)',
    corridorRisk: 'Corridor risk rating',
    onboardingRisk: 'Onboarding risk rating',
    monthsDormantBefore: 'Months dormant before this',
    priorAlerts: 'Earlier alerts',
    priorOutcome: 'How they ended',
    relationshipNote: 'Relationship file',
  },
  highlight: ['triggeringTotal', 'expectedMonthlyTurnover', 'cashSharePercent', 'relationshipNote'],
};

const present = {
  number: 123,
  problem: {
    headline: 'Three hundred monitoring alerts, two analysts, about fifty alerts a week. Most of the queue is thresholds doing what thresholds do.',
    stat: '300',
    statLabel: 'alerts, 12 of them worth an analyst',
  },
  hero: {
    item: 'AML-0089',
    caption: 'A care worker who expects £1,400 a month paid in eight cash credits between £2,340 and £2,770, each under the £3,000 reporting line. Structuring, 5.4 of 6, escalate.',
  },
  answers: {
    caption: 'The pattern is named, the score orders the queue, and the last answer is the question an analyst would send the customer.',
    reveal: ['typology', 'suspicion', 'disposition', 'information_missing'],
  },
  miss: {
    item: 'AML-0115',
    caption: 'Nothing was planted here: a textile importer, dormant for 19 months, trading into a corridor the bank rates high. The model scored it 4.4 of 6 and escalated it.',
  },
  proof: {
    kpis: ['Worth working, in the score queue', 'Queue after triage', 'Explained spikes closed'],
    chart: 'curve',
    closing: '300 alerts become 19 at a suspicion of 4 of 6, and all 12 worth working are still in the queue.',
  },
};

export default {
  id: 'aml-alert-triage',
  title: 'AML alert triage',
  domain: 'fraud',
  value: 'Cut a monitoring queue to the alerts worth an analyst’s time, with the pattern named.',
  tags: ['aml', 'compliance', 'alerts', 'triage'],
  dataClass: 'synthetic',
  readMinutes: 5,
  caveat: 'The relationship note is one of a few fixed sentences and each belongs to one label class, so a string lookup would score 100% here; this run measures reading, not judgement, and a harder dataset is planned.',
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.customerType.toLowerCase()} · ${money(item.triggeringTotal)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/aml-alert-triage.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/aml-alert-triage.js#demo:data',
    state: 'demos/aml-alert-triage/demo.js#demo:state',
    questions: 'demos/aml-alert-triage/demo.js#demo:questions',
    evaluate: 'demos/aml-alert-triage/demo.js#demo:evaluate',
  },
};
