// AML alert triage: three hundred alerts, two analysts, and about fifty alerts a week of capacity. The
// demo cuts the queue and says what it thinks each alert is. It closes, monitors or escalates — it
// never decides that anything is reported to anybody, and the page says so.

import { choice, noul, score } from '../lib/questions.js';

const TYPOLOGIES = ['STRUCTURING', 'LAYERING', 'MULE_ACTIVITY', 'TRADE_BASED', 'THIRD_PARTY_FUNDING', 'NONE'];
const DISPOSITIONS = ['CLOSE', 'MONITOR', 'ESCALATE'];
const MISSING = ['SOURCE_OF_FUNDS', 'COUNTERPARTY_IDENTITY', 'BUSINESS_PURPOSE', 'NONE'];

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
  const kept = graded.filter((result) => result.evaluation.kept);
  const keptReal = real.filter((result) => result.evaluation.kept);

  return {
    note: `${context.note ?? ''} ${context.wording ?? ''}`.trim(),
    findings: findings(graded, byItem, real),
    kpis: kpis({ graded, real, kept, keptReal, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, real),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

function kpis({ graded, real, kept, keptReal, byItem }) {
  const named = keptReal.filter((result) => result.evaluation.typology === byItem.get(result.item.id).typology);
  const explained = graded.filter((result) => byItem.get(result.item.id).kind === 'explained in the file');
  const closedExplained = explained.filter((result) => !result.evaluation.kept);
  const escalated = graded.filter((result) => result.evaluation.escalated);
  const askingSomething = kept.filter((result) => result.evaluation.missing !== 'NONE');

  return [
    { label: 'Queue after triage', value: `${kept.length} of ${graded.length}`, context: `a ${share(graded.length - kept.length, graded.length)} cut, keeping ${keptReal.length} of the ${real.length} alerts worth working`, tone: keptReal.length === real.length ? 'good' : 'warn' },
    { label: 'Worth working, kept', value: `${keptReal.length} of ${real.length}`, context: `${named.length} of them named for the right pattern` },
    { label: 'Explained spikes closed', value: `${closedExplained.length} of ${explained.length}`, context: 'house sales, bonuses, seasonal trade, money collected for a wedding', tone: closedExplained.length === explained.length ? 'good' : 'warn' },
    { label: 'Escalated', value: escalated.length, context: `${escalated.filter((result) => byItem.get(result.item.id).truePositive).length} of them are the planted ones` },
    { label: 'Asks for something specific', value: share(askingSomething.length, kept.length), context: `${askingSomething.length} of the ${kept.length} kept alerts name what would settle them` },
  ];
}

function checks(graded, byItem, labels) {
  const rows = TYPOLOGIES.filter((typology) => typology !== 'NONE' && typology !== 'LAYERING').map((typology) => {
    const group = labels.filter((label) => label.typology === typology);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.alertId);
      return !result || !result.evaluation.kept;
    });
    return { id: typology.toLowerCase(), label: `${sentence(typology)} closed`, detail: questions.typology.criteria[typology], count: missed.length, of: group.length, items: missed.map((label) => label.alertId) };
  });

  const explained = labels.filter((label) => label.kind === 'explained in the file');
  const keptExplained = explained.filter((label) => graded.some((result) => result.item.id === label.alertId && result.evaluation.kept));
  const everyday = graded.filter((result) => byItem.get(result.item.id).kind === 'everyday');
  const escalatedEveryday = everyday.filter((result) => result.evaluation.escalated);
  return [
    ...rows,
    { id: 'explained', label: 'Explained spikes kept in the queue', detail: 'Thirty alerts whose explanation is already in the customer file.', count: keptExplained.length, of: explained.length, items: keptExplained.slice(0, 20).map((label) => label.alertId) },
    { id: 'everyday', label: 'Everyday alerts escalated', detail: 'The rest of the queue: thresholds doing what thresholds do.', count: escalatedEveryday.length, of: everyday.length, items: escalatedEveryday.slice(0, 20).map((result) => result.item.id) },
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
  return { title: 'Where the queue is cut, and what is still in it', xLabel: 'Alerts an analyst opens', yLabel: 'Alerts worth working among them', rateLabel: 'Share of the queue worth working', of: real.length, points };
}

function findings(graded, byItem, real) {
  const lines = [];
  const lost = real.filter((result) => !result.evaluation.kept);
  if (lost.length) lines.push(`${lost.length} of the ${real.length} alerts worth working ${lost.length === 1 ? 'was' : 'were'} closed: ${lost.map((result) => `${result.item.id} (${readable(byItem.get(result.item.id).typology)})`).join(', ')}.`);

  const keptExplained = graded.filter((result) => byItem.get(result.item.id).kind === 'explained in the file' && result.evaluation.kept);
  if (keptExplained.length >= 3) {
    const looks = [...new Set(keptExplained.map((result) => byItem.get(result.item.id).look))];
    lines.push(`${keptExplained.length} spikes with an explanation already in the file stayed in the queue: ${looks.join(', ')}. Each one costs an analyst the time it takes to read the file and write the same sentence the file already contains.`);
  }

  const asked = graded.filter((result) => result.evaluation.kept && result.evaluation.missing !== 'NONE');
  if (asked.length) {
    const counts = new Map();
    for (const result of asked) counts.set(result.evaluation.missing, (counts.get(result.evaluation.missing) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    lines.push(`The kept alerts ask for one thing more than any other: ${readable(top[0])}, on ${top[1]} of ${asked.length}. That is a request an analyst can send without reading the file first.`);
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

export default {
  id: 'aml-alert-triage',
  title: 'AML alert triage',
  domain: 'fraud',
  value: 'Cut a monitoring queue to the alerts worth an analyst’s time, with the pattern named.',
  tags: ['aml', 'compliance', 'alerts', 'triage'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'queue',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.customerType.toLowerCase()} · ${money(item.triggeringTotal)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/aml-alert-triage.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/aml-alert-triage.js#demo:data',
    state: 'demos/aml-alert-triage/demo.js#demo:state',
    questions: 'demos/aml-alert-triage/demo.js#demo:questions',
    evaluate: 'demos/aml-alert-triage/demo.js#demo:evaluate',
  },
};
