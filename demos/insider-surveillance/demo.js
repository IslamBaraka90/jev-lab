// Insider trading surveillance with cached-real candles and entirely fictional people, trades,
// access records and events. The model never receives a bar after the trade date.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['PRE_ANNOUNCEMENT', 'UNUSUAL_SIZE', 'FIRST_TIME_INSTRUMENT', 'CLUSTERED_WITH_COLLEAGUES', 'ROUTINE'];
const DISPOSITIONS = ['NO_ACTION', 'MONITOR', 'OPEN_CASE'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';

// #region demo:state
/** Everything needed to judge the trade, ending precisely at the trade-date close. */
function buildState(item, context) {
  return {
    task: 'Assess this fictional employee trade using only information available at the trade-date close. Decide whether surveillance should open a case.',
    data_notice: { real: context.priceSource.notice, fictional: context.fictionalNotice },
    blackout_rules: context.blackoutRules,
    employee: item.employee,
    trade: item.trade,
    employee_trading_history: item.employeeHistory,
    recent_colleague_trades: item.recentColleagueTrades,
    fictional_event_calendar_within_30_days: item.eventCalendar,
    market_through_trade_date: {
      symbol: item.market.symbol,
      currency: item.market.currency,
      exchange: item.market.exchange,
      instrument_type: item.market.instrumentType,
      source: item.market.source,
      candles: item.market.preTradeBars,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  suspicion: score('How suspicious is this employee trade using only the pre-trade evidence?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain']),
  pattern: choice('Which pattern best describes the trade?', {
    PRE_ANNOUNCEMENT: 'Trading shortly before a material issuer announcement is the central concern.',
    UNUSUAL_SIZE: 'The position or leverage is unusually large against the employee’s own history.',
    FIRST_TIME_INSTRUMENT: 'A first trade in this instrument is the strongest unexplained departure.',
    CLUSTERED_WITH_COLLEAGUES: 'Several colleagues traded the same instrument in a tight window.',
    ROUTINE: 'The trade is consistent with history, a pre-cleared plan or non-issuer-specific context.',
  }),
  blackout_breach: noul('Does the visible trade breach the stated blackout rule?', { yes: 'The employee is covered, has material issuer access and traded inside the prohibited window without an exemption.', no: 'The rule does not apply or the trade is covered by the stated scheduled-plan exemption.' }),
  disposition: choice('What should surveillance do with this trade?', {
    NO_ACTION: 'Close it from surveillance without opening a case.', MONITOR: 'Keep it visible for a repeat pattern.', OPEN_CASE: 'Open a surveillance case for human investigation.',
  }),
  explained_by_history: noul('Is this trade adequately explained by the employee’s visible trading history or pre-cleared plan?', { yes: 'The size, symbol and cadence are consistent with the visible record.', no: 'The trade materially departs from the employee’s visible record.' }),
};
// #endregion

// #region demo:evaluate
/** Keeps the suspicion, pattern, rule call and operating disposition independently auditable. */
function evaluate(answers, item) {
  const disposition = answers.disposition.choice;
  return {
    flagged: disposition !== 'NO_ACTION',
    caseOpened: disposition === 'OPEN_CASE',
    suspicion: answers.suspicion.score,
    pattern: answers.pattern.choice,
    blackoutBreach: answers.blackout_breach.noul >= 0.5,
    disposition,
    explainedByHistory: answers.explained_by_history.noul >= 0.5,
    label: `${item.id}: ${readable(disposition)} · ${readable(answers.pattern.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Opens cases against the planted nine, then reveals the real outcome window for review. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.tradeId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const suspicious = graded.filter((result) => intended.get(result.item.id).suspicious);
  const benign = graded.filter((result) => !intended.get(result.item.id).suspicious);
  const opened = graded.filter((result) => result.evaluation.caseOpened);
  const caught = suspicious.filter((result) => result.evaluation.caseOpened);
  const falseCases = benign.filter((result) => result.evaluation.caseOpened);
  const dispositionRight = graded.filter((result) => result.evaluation.disposition === intended.get(result.item.id).expectedDisposition);
  const blackoutRight = graded.filter((result) => result.evaluation.blackoutBreach === intended.get(result.item.id).blackoutBreach);
  const patternRight = graded.filter((result) => result.evaluation.pattern === intended.get(result.item.id).pattern);

  const groups = { graded, suspicious, benign, opened, caught, falseCases, dispositionRight, blackoutRight, patternRight };

  return {
    note: 'Prices are cached-real Yahoo Finance bars. Employees, trades, access and calendar events are fictional. Outcome bars were never in Jev’s state.',
    findings: [...findings(suspicious, falseCases, intended), ...shortcutFindings(groups, intended)],
    kpis: kpis(groups, intended),
    baselines: baselines(graded, intended),
    metrics: metrics(groups, intended),
    distribution: PATTERNS.map((pattern) => ({ label: sentence(pattern), count: graded.filter((result) => result.evaluation.pattern === pattern).length, tone: pattern === 'ROUTINE' ? 'good' : 'warn' })).filter((entry) => entry.count),
    distributionTitle: 'Pattern named',
    matrix: caseMatrix(graded, intended),
    curve: suspicionCurve(graded, intended, suspicious.length),
    checks: checks(graded, intended),
    topItems: mostSuspicious(graded),
    topItemsTitle: 'Most suspicious trades',
  };
}
// #endregion

function kpis(groups, intended) {
  const { graded, suspicious, benign, opened, caught, falseCases, dispositionRight, blackoutRight, patternRight } = groups;
  const plantedPatternRight = suspicious.filter((result) => patternRight.includes(result));
  const benignGivenPattern = benign.filter((result) => result.evaluation.pattern !== 'ROUTINE');
  return [
    { label: 'Suspicious trades opened', value: `${caught.length} of ${suspicious.length}`, context: share(caught.length, suspicious.length), tone: caught.length === suspicious.length ? 'good' : 'warn' },
    { label: 'Opened-case precision', value: share(caught.length, opened.length), context: `${opened.length} cases opened · ${falseCases.length} innocent trades included`, tone: falseCases.length ? 'warn' : 'good' },
    { label: 'Disposition accuracy', value: share(dispositionRight.length, graded.length), context: `${dispositionRight.length} of ${graded.length} · a two-condition rule on the access list scores ${graded.filter((result) => ruleDisposition(result.item) === intended.get(result.item.id).expectedDisposition).length}` },
    { label: 'Pattern accuracy', value: share(patternRight.length, graded.length), context: `${patternRight.length} of ${graded.length} · ${plantedPatternRight.length} of the ${suspicious.length} planted trades, and ${benignGivenPattern.length} routine trades given a pattern`, tone: plantedPatternRight.length === suspicious.length ? 'good' : 'warn' },
    { label: 'Blackout calls', value: share(blackoutRight.length, graded.length), context: `${blackoutRight.length} of ${graded.length}` },
  ];
}

// The rule: open a case when the employee has material access to the traded symbol and the trade is not under a pre-cleared plan.
function ruleDisposition(item) {
  const hasAccess = item.employee.materialAccessSymbols.includes(item.trade.symbol);
  return hasAccess && !item.trade.preClearedPlan ? 'OPEN_CASE' : 'NO_ACTION';
}

function baselines(graded, intended) {
  if (!graded.length) return undefined;
  const rightShare = (pick) => graded.filter((result) => pick(result) === intended.get(result.item.id).expectedDisposition).length / graded.length;
  return [
    { label: 'Jev', detail: 'disposition agrees with the planted one', value: rightShare((result) => result.evaluation.disposition), model: true },
    { label: 'Rule: access to the symbol and no pre-cleared plan', detail: 'two conditions over the employee record and the trade', value: rightShare((result) => ruleDisposition(result.item)) },
    { label: 'Never open a case', detail: 'the commonest disposition; misses every planted trade', value: rightShare(() => 'NO_ACTION') },
  ];
}

function metrics(groups, intended) {
  const { graded, suspicious, opened, caught, dispositionRight } = groups;
  return {
    headline: { label: 'Suspicious trades opened', value: suspicious.length ? caught.length / suspicious.length : 0, n: suspicious.length },
    accuracy: graded.length ? dispositionRight.length / graded.length : null,
    macroF1: matrixStats(caseMatrix(graded, intended))?.macroF1 ?? null,
    precision: opened.length ? caught.length / opened.length : null,
    recall: suspicious.length ? caught.length / suspicious.length : null,
  };
}

/** Says so when the two-condition rule does as well as the model, and when the pattern labels overlap. */
function shortcutFindings(groups, intended) {
  const { graded, suspicious, dispositionRight, patternRight } = groups;
  const lines = [];
  const ruleRight = graded.filter((result) => ruleDisposition(result.item) === intended.get(result.item.id).expectedDisposition);
  if (graded.length >= 10 && ruleRight.length >= dispositionRight.length) {
    lines.push(`A two-condition rule, access to the traded symbol and no pre-cleared plan, gets ${ruleRight.length} of ${graded.length} dispositions right; the model gets ${dispositionRight.length}. In this dataset the access list decides every case, so the score says the record was read, not that the chart was.`);
  }
  const misnamed = suspicious.filter((result) => result.evaluation.caseOpened && !patternRight.includes(result));
  if (misnamed.length) lines.push(`${misnamed.length} planted trades were opened under a different pattern name (${misnamed.map((result) => result.item.id).join(', ')}). Every planted trade also sits a few days before an announcement, so more than one name fits and the single-label grading is strict.`);
  return lines;
}

function mostSuspicious(graded) {
  return [...graded]
    .sort((left, right) => right.evaluation.suspicion - left.evaluation.suspicion)
    .slice(0, 12)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.id} · ${result.item.employee.name} · ${result.item.trade.side.toLowerCase()} ${result.item.trade.symbol} · ${readable(result.evaluation.disposition)} · ${readable(result.evaluation.pattern)}`,
      value: `${result.evaluation.suspicion.toFixed(1)} of 6`,
    }));
}

function findings(suspicious, falseCases, intended) {
  const missed = suspicious.filter((result) => !result.evaluation.caseOpened);
  const lines = [];
  if (missed.length) lines.push(`${missed.length} planted suspicious trade${missed.length === 1 ? '' : 's'} did not become a case: ${missed.map((result) => result.item.id).join(', ')}.`);
  if (falseCases.length) lines.push(`${falseCases.length} innocent trade${falseCases.length === 1 ? '' : 's'} became a case; ${falseCases.filter((result) => intended.get(result.item.id).lookalike).length} were planted lookalikes.`);
  return lines;
}

function checks(graded, intended) {
  const patternRows = PATTERNS.filter((pattern) => pattern !== 'ROUTINE').map((pattern) => {
    const group = graded.filter((result) => intended.get(result.item.id).pattern === pattern);
    const mishandled = group.filter((result) => !result.evaluation.caseOpened || result.evaluation.pattern !== pattern);
    return { id: pattern.toLowerCase(), label: `${readable(pattern)} cases missed or misnamed`, count: mishandled.length, of: group.length, items: mishandled.map((result) => result.item.id) };
  });
  const lookalikeRows = ['SCHEDULED_PURCHASE', 'SECTOR_WIDE_MOVE'].map((lookalike) => {
    const group = graded.filter((result) => intended.get(result.item.id).lookalike === lookalike);
    const escalated = group.filter((result) => result.evaluation.disposition !== 'NO_ACTION');
    const lanes = DISPOSITIONS.map((lane) => `${lane.toLowerCase().replaceAll('_', ' ')} ${group.filter((result) => result.evaluation.disposition === lane).length}`).join(' · ');
    return { id: lookalike.toLowerCase(), label: `${readable(lookalike)} lookalikes not cleared`, detail: lanes, count: escalated.length, of: group.length, items: escalated.map((result) => result.item.id) };
  });
  const blackoutErrors = graded.filter((result) => result.evaluation.blackoutBreach !== intended.get(result.item.id).blackoutBreach);
  return [...patternRows, ...lookalikeRows, { id: 'blackout', label: 'Blackout rule calls wrong', count: blackoutErrors.length, of: graded.length, items: blackoutErrors.map((result) => result.item.id) }];
}

function caseMatrix(graded, intended) {
  const classes = ['SUSPICIOUS', 'BENIGN'];
  return {
    title: 'Case decision against planted status',
    rowLabel: 'what was planted',
    columnLabel: 'what the model decided',
    columns: ['case opened', 'no case'],
    rows: classes.map((actual) => ({
      label: actual.toLowerCase(),
      cells: [true, false].map((opened) => ({
        count: graded.filter((result) => (intended.get(result.item.id).suspicious ? 'SUSPICIOUS' : 'BENIGN') === actual && result.evaluation.caseOpened === opened).length,
        diagonal: (actual === 'SUSPICIOUS') === opened,
      })),
    })),
  };
}

function suspicionCurve(graded, intended, total) {
  return {
    title: 'Suspicion threshold: cases reviewed against planted trades caught', xLabel: 'Trades reviewed', yLabel: 'Suspicious trades caught', rateLabel: 'Share of those reviewed that were planted', of: total, thresholdFormat: 'level', levels: 6, defaultIndex: 3,
    points: Array.from({ length: 7 }, (_, threshold) => {
      const queue = graded.filter((result) => result.evaluation.suspicion >= threshold);
      const caught = queue.filter((result) => intended.get(result.item.id).suspicious);
      return { threshold: threshold / 6, reviewed: queue.length, caught: caught.length, rate: queue.length ? caught.length / queue.length : 0 };
    }),
  };
}

const levelName = (value) => questions.suspicion.criteria[Math.max(0, Math.min(6, Math.round(value)))];
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;
const LOOKALIKE_NOTES = {
  SCHEDULED_PURCHASE: 'Planted as a lookalike: a pre-cleared scheduled purchase that happens to fall before an announcement.',
  SECTOR_WIDE_MOVE: 'Planted as a lookalike: the whole sector moved, not this issuer.',
};

/** What a planted trade was, in a sentence. Routine trades carry no note. */
function plantedNote(label) {
  if (label.suspicious) return `Planted as suspicious: ${readable(label.pattern)}, ahead of the ${label.eventDate} event.`;
  return LOOKALIKE_NOTES[label.lookalike];
}

// Right means the planted disposition, which is what "Disposition accuracy" and the case counts are built on.
const grade = {
  labelId: (label) => label.tradeId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.disposition === label.expectedDisposition,
      expected: label.expectedDisposition,
      got: result.evaluation.disposition,
      note: plantedNote(label),
      confidence: result.answers.disposition.confidence,
    };
  },
};

function verdict(result) {
  const { item, answers, evaluation } = result;
  const hasAccess = item.employee.materialAccessSymbols.includes(item.trade.symbol);
  const opened = evaluation.disposition === 'OPEN_CASE';
  return {
    eyebrow: 'What surveillance does with this trade',
    headline: `${sentence(evaluation.disposition)}${evaluation.pattern === 'ROUTINE' ? '' : ` · ${readable(evaluation.pattern)}`}`,
    detail: 'Fictional employee and trade against real prices. The bars after the trade were never shown to the model.',
    facts: [
      { label: 'Suspicion', value: `${levelName(evaluation.suspicion)} · ${evaluation.suspicion.toFixed(1)} of 6`, tone: evaluation.suspicion >= 3 ? 'bad' : evaluation.suspicion >= 2 ? 'warn' : 'good' },
      { label: 'Inside the blackout window', value: yesNo(answers.blackout_breach.noul), tone: evaluation.blackoutBreach ? 'bad' : 'good' },
      { label: 'Their own history explains it', value: yesNo(answers.explained_by_history.noul), tone: evaluation.explainedByHistory ? 'good' : 'warn' },
      { label: `Material access to ${item.trade.symbol}`, value: hasAccess ? 'Yes' : 'No', tone: hasAccess ? 'warn' : undefined },
      { label: 'Pre-cleared plan', value: item.trade.preClearedPlan ? `Yes · ${item.trade.preClearedPlan.cadence.toLowerCase()}` : 'No' },
      { label: 'Confidence in the disposition', value: `${Math.round(answers.disposition.confidence * 100)}%`, tone: opened && answers.disposition.confidence < 0.4 ? 'warn' : undefined },
    ],
  };
}

const present = {
  number: 126,
  problem: {
    headline: 'Every employee trade has to be read against the chart, the event calendar, the access list and the employee’s own history. Almost all of them are nothing.',
    stat: '180',
    statLabel: 'employee trades, 9 of them planted as suspicious',
  },
  hero: {
    item: 'TRD-0161',
    caption: 'A first trade in NVDA, three days before a material announcement, by someone with access to that issuer. 4.3 of 6, open a case. The price rose 23.96% in the ten sessions after, which the model never saw.',
  },
  answers: {
    caption: 'How suspicious, which pattern, whether the blackout rule was broken, and what surveillance does next.',
    reveal: ['suspicion', 'pattern', 'blackout_breach', 'disposition'],
  },
  miss: {
    item: 'TRD-0130',
    caption: 'The least sure call in the run: a small NVDA purchase nine days before an announcement, with three colleagues buying the same stock that week. Opened, but at 3.0 of 6 and 19% confidence.',
  },
  proof: {
    kpis: ['Suspicious trades opened', 'Opened-case precision', 'Disposition accuracy'],
    chart: 'baselines',
    closing: '9 cases opened, all 9 planted, 171 trades left alone, and a two-condition rule on the access list does the same.',
  },
};

export default {
  id: 'insider-surveillance',
  title: 'Insider trading surveillance',
  domain: 'fraud',
  value: 'Read a fictional employee trade against genuine price history and decide whether surveillance should open a case.',
  caveat: 'Cached-real Yahoo Finance prices; fictional employees, access records, trades and event calendar. Post-trade bars are never sent to Jev. Every planted trade is by an employee with access to the traded symbol and no pre-cleared plan, and no innocent trade is, so one rule decides every case; a harder dataset is planned.',
  tags: ['fraud', 'surveillance', 'trades', 'market-data', 'compliance'],
  dataClass: 'mixed',
  readMinutes: 6,
  view: 'candles',
  itemLabel: (item) => `${item.id} · ${item.employee.id} · ${item.trade.side} ${item.trade.symbol}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/insider-surveillance.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/insider-surveillance.js#demo:data',
    state: 'demos/insider-surveillance/demo.js#demo:state',
    questions: 'demos/insider-surveillance/demo.js#demo:questions',
    evaluate: 'demos/insider-surveillance/demo.js#demo:evaluate',
  },
};
