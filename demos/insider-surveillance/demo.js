// Insider trading surveillance with cached-real candles and entirely fictional people, trades,
// access records and events. The model never receives a bar after the trade date.

import { choice, noul, score } from '../lib/questions.js';

const PATTERNS = ['PRE_ANNOUNCEMENT', 'UNUSUAL_SIZE', 'FIRST_TIME_INSTRUMENT', 'CLUSTERED_WITH_COLLEAGUES', 'ROUTINE'];
const DISPOSITIONS = ['NO_ACTION', 'MONITOR', 'OPEN_CASE'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
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

  return {
    note: 'Prices are cached-real Yahoo Finance bars. Employees, trades, access and calendar events are fictional. Outcome bars were never in Jev’s state.',
    findings: findings(suspicious, falseCases, intended),
    kpis: [
      { label: 'Suspicious trades opened', value: `${caught.length} of ${suspicious.length}`, context: share(caught.length, suspicious.length), tone: caught.length === suspicious.length ? 'good' : 'warn' },
      { label: 'Opened-case precision', value: share(caught.length, opened.length), context: `${opened.length} cases opened · ${falseCases.length} innocent trades included` },
      { label: 'Disposition accuracy', value: share(dispositionRight.length, graded.length), context: `${dispositionRight.length} of ${graded.length}` },
      { label: 'Pattern accuracy', value: share(patternRight.length, graded.length), context: `${patternRight.length} of ${graded.length}` },
      { label: 'Blackout calls', value: share(blackoutRight.length, graded.length), context: `${blackoutRight.length} of ${graded.length}` },
    ],
    distribution: PATTERNS.map((pattern) => ({ label: pattern, count: graded.filter((result) => result.evaluation.pattern === pattern).length, tone: pattern === 'ROUTINE' ? 'good' : 'warn' })),
    matrix: caseMatrix(graded, intended),
    curve: suspicionCurve(graded, intended, suspicious.length),
    checks: checks(graded, intended),
    topItems: [...graded].filter((result) => result.evaluation.flagged).sort((a, b) => b.evaluation.suspicion - a.evaluation.suspicion).slice(0, 12).map((result) => ({
      id: result.item.id,
      label: `${result.item.trade.symbol} · ${readable(result.evaluation.disposition)} · ${readable(result.evaluation.pattern)}`,
      value: `${intended.get(result.item.id).outcomeReturnPercent >= 0 ? '+' : ''}${intended.get(result.item.id).outcomeReturnPercent}% after 10 sessions`,
    })),
  };
}
// #endregion

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
    title: 'Suspicion threshold: cases reviewed against planted trades caught', xLabel: 'Trades reviewed', yLabel: 'Suspicious trades caught', of: total,
    points: Array.from({ length: 7 }, (_, threshold) => {
      const queue = graded.filter((result) => result.evaluation.suspicion >= threshold);
      const caught = queue.filter((result) => intended.get(result.item.id).suspicious);
      return { threshold: threshold / 6, reviewed: queue.length, caught: caught.length, rate: queue.length ? caught.length / queue.length : 0 };
    }),
  };
}

export default {
  id: 'insider-surveillance',
  title: 'Insider trading surveillance',
  domain: 'fraud',
  value: 'Read a fictional employee trade against genuine price history and decide whether surveillance should open a case.',
  caveat: 'Cached-real Yahoo Finance prices; fictional employees, access records, trades and event calendar. Post-trade bars are never sent to Jev.',
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
  explain: {
    data: 'scripts/generate/insider-surveillance.js#demo:data',
    state: 'demos/insider-surveillance/demo.js#demo:state',
    questions: 'demos/insider-surveillance/demo.js#demo:questions',
    evaluate: 'demos/insider-surveillance/demo.js#demo:evaluate',
  },
};
