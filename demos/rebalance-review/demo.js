// Rebalance review: two hundred trades a mechanical rebalancer proposed, read one at a time. The
// rebalancer knows the target weights and nothing else — not the tax lots, not the other accounts, not
// the note in the mandate — so the job is to catch the trades that are right on paper and wrong here.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const VERDICTS = ['APPROVE', 'RESIZE', 'DEFER', 'REJECT'];
const ISSUES = ['LIQUIDITY', 'TAX_LOT', 'CROSSING', 'TOO_SMALL', 'MANDATE_CONFLICT', 'NONE'];
const SIZES = ['AS_PROPOSED', 'HALF', 'QUARTER', 'SPLIT_OVER_DAYS'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(value ?? 0);
const sum = (results) => results.reduce((total, result) => total + result.item.valueUsd, 0);

// What the desk does with each kind of problem: the convention the labels follow.
const DESK_VERDICT = { LIQUIDITY: 'RESIZE', TAX_LOT: 'DEFER', CROSSING: 'REJECT', TOO_SMALL: 'REJECT', MANDATE_CONFLICT: 'DEFER', NONE: 'APPROVE' };

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The trade, the position it moves, and everything the rebalancer did not know when it proposed it. */
function buildState(item, context) {
  const account = context.accounts.find((entry) => entry.id === item.accountId);
  return {
    task: 'Review this proposed trade: approve it, resize it, defer it or reject it, and say what the problem is if there is one.',
    desk: { manager: context.manager, prices_as_of: context.pricesAsOf, rules: context.rules, tolerance: context.tolerance, note: context.note },
    account: { id: account.id, name: account.name, taxable: account.taxable, mandate: account.mandate },
    trade: {
      symbol: item.symbol,
      side: item.side,
      shares: item.shares,
      value_usd: item.valueUsd,
      price: item.price,
    },
    position: {
      weight_now_percent: item.currentWeightPercent,
      target_percent: item.targetWeightPercent,
      weight_after_this_trade_percent: item.weightAfterPercent,
    },
    liquidity: {
      average_daily_volume_shares: item.averageDailyVolume,
      this_trade_as_share_of_that_percent: item.shareOfAverageVolumePercent,
    },
    history_in_this_name: item.recentTradesInThisName,
    same_name_in_another_account_today: item.sameNameOtherAccountToday,
  };
}
// #endregion

// #region demo:questions
const questions = {
  verdict: choice('What happens to this trade?', {
    APPROVE: 'Send it as proposed.',
    RESIZE: 'The trade is right and the size is not.',
    DEFER: 'Not today. It needs a date, a netting, or a person.',
    REJECT: 'Do not do this trade at all.',
  }),
  size_band: choice('If it goes, how much of it goes?', {
    AS_PROPOSED: 'The whole thing, as it stands.',
    HALF: 'Half now.',
    QUARTER: 'A quarter now.',
    SPLIT_OVER_DAYS: 'Broken into pieces across several days.',
  }),
  issue: choice('What is wrong with it, if anything?', {
    LIQUIDITY: 'It is too large a share of what this instrument trades in a day.',
    TAX_LOT: 'It realises a loss the account cannot use, or repurchases too soon after one.',
    CROSSING: 'Another account is trading the same name the other way today.',
    TOO_SMALL: 'It costs more to do than the drift it corrects is worth.',
    MANDATE_CONFLICT: 'It undoes something the mandate asked for on purpose.',
    NONE: 'Nothing. It does what a rebalance is for.',
  }),
  execution_risk: score('How hard would this trade be to do well?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Severe',
  ]),
  needs_pm_sign_off: noul('Does a portfolio manager need to see this before it goes?', {
    yes: 'Something here is a judgement the desk should not make alone.',
    no: 'It is inside the rules as written.',
  }),
};
// #endregion

// #region demo:evaluate
/** The verdict, and the order it turns into if there is one. */
function evaluate(answers, item) {
  const verdict = answers.verdict.choice;
  const band = answers.size_band.choice;
  const fraction = { AS_PROPOSED: 1, HALF: 0.5, QUARTER: 0.25, SPLIT_OVER_DAYS: 1 }[band];
  const goes = verdict === 'APPROVE' || verdict === 'RESIZE';

  return {
    verdict,
    issue: answers.issue.choice,
    band,
    executionRisk: answers.execution_risk.score,
    needsSignOff: answers.needs_pm_sign_off.noul >= 0.5,
    goes,
    orderValue: goes ? Math.round(item.valueUsd * fraction) : 0,
    confidence: answers.verdict.confidence,
    stopScore: 1 - (answers.verdict.probabilities?.APPROVE ?? 0),
    label: `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${readable(verdict)}${goes && band !== 'AS_PROPOSED' ? ` (${readable(band)})` : ''}`,
  };
}
// #endregion

// #region demo:report
/** What survived the review, and whether the things that should not have survived did. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.tradeId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const problems = graded.filter((result) => byItem.get(result.item.id).issue !== 'NONE');
  const clean = graded.filter((result) => byItem.get(result.item.id).issue === 'NONE');
  const caught = problems.filter((result) => result.evaluation.verdict !== 'APPROVE');
  const matrix = confusion(graded, byItem);
  const stats = matrixStats(matrix);

  return {
    note: `Two hundred proposed trades across six accounts, ${problems.length} of them carrying something the rebalancer could not see. ${context.note ?? ''}`,
    findings: findings(graded, byItem, clean, stats),
    kpis: kpis({ graded, problems, clean, caught, byItem }),
    distribution: distribution(results),
    distributionTitle: 'Verdicts given',
    baselines: baselines(graded, byItem, stats),
    metrics: metrics(graded, problems, caught, stats),
    matrix,
    curve: coverage(graded, byItem, problems),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
    topItemsTitle: 'Largest trades kept out of the order list',
  };
}
// #endregion

function kpis({ graded, problems, clean, caught, byItem }) {
  const agrees = (result) => result.evaluation.verdict === byItem.get(result.item.id).verdict;
  const issueRight = problems.filter((result) => result.evaluation.issue === byItem.get(result.item.id).issue);
  const verdictRight = graded.filter(agrees);
  const problemVerdictRight = problems.filter(agrees);
  const blockedClean = clean.filter((result) => !result.evaluation.goes);
  const resizedClean = clean.filter((result) => result.evaluation.verdict === 'RESIZE');
  const order = graded.filter((result) => result.evaluation.goes);
  const badInTheOrder = order.filter((result) => byItem.get(result.item.id).issue !== 'NONE' && byItem.get(result.item.id).verdict === 'REJECT');
  const tooCautious = blockedClean.length + resizedClean.length > clean.length / 10;

  return [
    { label: 'Verdict agrees', value: share(verdictRight.length, graded.length), context: `${verdictRight.length} of ${graded.length} trades, all four verdicts · ${problemVerdictRight.length} of ${problems.length} on the problem trades`, tone: verdictRight.length === graded.length ? 'good' : 'warn' },
    { label: 'Problem trades stopped', value: `${caught.length} of ${problems.length}`, context: 'not approved as they stood, whatever was done with them instead', tone: caught.length === problems.length ? 'good' : 'warn' },
    { label: 'Problem named exactly', value: `${issueRight.length} of ${problems.length}`, context: 'liquidity, tax lot, crossing, too small or mandate' },
    { label: 'Good trades stopped', value: `${blockedClean.length} of ${clean.length}`, context: `${money(sum(blockedClean))} held up · ${resizedClean.length} more marked resize, worth ${money(sum(resizedClean))}`, tone: tooCautious ? 'warn' : 'good' },
    { label: 'Order list', value: money(order.reduce((total, result) => total + result.evaluation.orderValue, 0)), context: `${order.length} trades, of ${money(sum(graded))} proposed${badInTheOrder.length ? ` · ${badInTheOrder.length} that should not be there` : ' · nothing in it that should be rejected'}`, tone: badInTheOrder.length ? 'warn' : 'good' },
  ];
}

// The rule: the desk's five written rules as five ifs, each with the verdict the desk attaches to it.
function ruleIssue(trade) {
  const other = trade.sameNameOtherAccountToday;
  const lossLotInsideThirtyDays = (trade.recentTradesInThisName ?? []).some((lot) => lot.side === 'BUY' && lot.daysAgo < 30 && /at a loss/.test(lot.note ?? ''));
  if (trade.shareOfAverageVolumePercent > 20) return 'LIQUIDITY';
  if (trade.valueUsd < 250_000) return 'TOO_SMALL';
  if (other?.sameDay && other.side !== trade.side) return 'CROSSING';
  if (trade.accountTaxable && trade.side === 'SELL' && lossLotInsideThirtyDays) return 'TAX_LOT';
  if (trade.side === 'SELL' && /do not trim/.test(trade.mandateNote ?? '')) return 'MANDATE_CONFLICT';
  return 'NONE';
}

function baselines(graded, byItem, stats) {
  const total = graded.length;
  if (!total) return [];
  const modelRight = graded.filter((result) => result.evaluation.verdict === byItem.get(result.item.id).verdict).length;
  const ruleRight = graded.filter((result) => DESK_VERDICT[ruleIssue(result.item)] === byItem.get(result.item.id).verdict).length;
  const majority = Math.round((stats?.majorityBaseline ?? 0) * total);
  return [
    { label: 'Jev', detail: 'exact verdict, from the rules as written in the state', value: modelRight / total, display: `${modelRight} of ${total}`, model: true },
    { label: 'Rule: the five desk rules as five ifs', detail: 'over 20% of daily volume, under $250k, opposite side in another account, loss lot inside 30 days, do-not-trim note', value: ruleRight / total, display: `${ruleRight} of ${total}` },
    { label: 'Always the commonest verdict', detail: readable(stats?.majorityClass ?? 'approve'), value: majority / total, display: `${majority} of ${total}` },
  ];
}

function metrics(graded, problems, caught, stats) {
  const stopped = graded.filter((result) => result.evaluation.verdict !== 'APPROVE');
  return {
    headline: { label: 'Verdict agrees', value: stats?.accuracy ?? 0, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    recall: problems.length ? caught.length / problems.length : null,
    precision: stopped.length ? caught.length / stopped.length : null,
  };
}

function checks(graded, byItem, labels) {
  return ISSUES.filter((issue) => issue !== 'NONE').map((issue) => {
    const group = labels.filter((label) => label.issue === issue);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.tradeId);
      return !result || result.evaluation.verdict === 'APPROVE';
    });
    return { id: issue.toLowerCase().replaceAll('_', '-'), label: `${sentence(issue)} approved anyway`, detail: questions.issue.criteria[issue], count: missed.length, of: group.length, items: missed.map((label) => label.tradeId) };
  }).concat([{
    id: 'clean',
    label: 'Ordinary trades not approved',
    detail: 'Trades that move a weight towards its target, in a size the market can take, with nothing behind them.',
    count: graded.filter((result) => byItem.get(result.item.id).issue === 'NONE' && result.evaluation.verdict !== 'APPROVE').length,
    of: labels.filter((label) => label.issue === 'NONE').length,
    items: graded.filter((result) => byItem.get(result.item.id).issue === 'NONE' && result.evaluation.verdict !== 'APPROVE').slice(0, 20).map((result) => result.item.id),
  }]);
}

function distribution(results) {
  return VERDICTS
    .map((verdict) => ({ label: sentence(verdict), count: results.filter((result) => result.evaluation.verdict === verdict).length, tone: verdict === 'APPROVE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Verdict given against the verdict the desk would give',
    rowLabel: 'the verdict the desk would give',
    columnLabel: 'the verdict the model gave',
    columns: VERDICTS.map(sentence),
    rows: VERDICTS.map((actual) => ({
      label: sentence(actual),
      cells: VERDICTS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).verdict === actual && result.evaluation.verdict === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

// Ranked by how far the model was from approving, not by execution risk: a tax lot or a crossing is
// not hard to execute, so execution risk was never going to find it.
const STOP_BARS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99];

function coverage(graded, byItem, problems) {
  const points = STOP_BARS.map((bar) => {
    const held = graded.filter((result) => result.evaluation.stopScore >= bar);
    const real = held.filter((result) => byItem.get(result.item.id).issue !== 'NONE');
    return { threshold: bar, reviewed: held.length, caught: real.length, rate: held.length ? Number((real.length / held.length).toFixed(3)) : null };
  });
  return { title: 'How sure it must be that a trade should not simply go', xLabel: 'Trades held back at this bar', yLabel: 'Trades with something wrong among them', rateLabel: 'Share of those held that have a problem', of: problems.length, points, defaultIndex: 3 };
}

function findings(graded, byItem, clean, stats) {
  const lines = [];
  const agrees = (result) => result.evaluation.verdict === byItem.get(result.item.id).verdict;
  const problems = graded.filter((result) => byItem.get(result.item.id).issue !== 'NONE');
  const stoppedProblems = problems.filter((result) => result.evaluation.verdict !== 'APPROVE');
  const wrongWay = stoppedProblems.filter((result) => !agrees(result));
  if (wrongWay.length >= 3) lines.push(`${stoppedProblems.length} of the ${problems.length} problem trades were stopped, but only ${problems.filter(agrees).length} got the verdict the desk would give. ${commonestSwap(wrongWay, byItem)} It saw that something was wrong more reliably than it knew what to do about it.`);

  const modelRight = graded.filter(agrees).length;
  const ruleRight = graded.filter((result) => DESK_VERDICT[ruleIssue(result.item)] === byItem.get(result.item.id).verdict).length;
  const majority = Math.round((stats?.majorityBaseline ?? 0) * graded.length);
  if (ruleRight > modelRight) lines.push(`Five ifs over the same fields give the desk's verdict on ${ruleRight} of ${graded.length} trades, against ${modelRight} for the model${majority > modelRight ? `; approving everything scores ${majority}, because most trades are ordinary` : ''}. Every planted problem breaks a rule written in the state, so this file rewards reading the rules, not judgement.`);

  const signOff = graded.filter((result) => result.evaluation.needsSignOff);
  if (graded.length >= 20 && signOff.length === graded.length) lines.push(`The sign-off question was answered yes on all ${graded.length} trades, clean ones included. It separates nothing and is not graded.`);

  const fullSizeResizes = graded.filter((result) => result.evaluation.verdict === 'RESIZE' && result.evaluation.band === 'AS_PROPOSED');
  if (fullSizeResizes.length >= 5) lines.push(`${fullSizeResizes.length} trades were marked resize and then given their full size, so the verdict and the size band contradict each other; they count in the order list at full value.`);

  const approved = graded.filter((result) => byItem.get(result.item.id).issue !== 'NONE' && result.evaluation.verdict === 'APPROVE');
  if (approved.length) {
    const kinds = [...new Set(approved.map((result) => readable(byItem.get(result.item.id).issue)))];
    lines.push(`${approved.length} trades with something wrong were approved as they stood, worth ${money(sum(approved))}: ${kinds.join(', ')}.`);
  }

  const wrongIssue = graded.filter((result) => byItem.get(result.item.id).issue !== 'NONE' && result.evaluation.verdict !== 'APPROVE' && result.evaluation.issue !== byItem.get(result.item.id).issue);
  if (wrongIssue.length >= 3) lines.push(`${wrongIssue.length} trades were stopped for the wrong reason. The trade does not go either way; the note on the ticket is what a person reads next.`);

  const blocked = clean.filter((result) => !result.evaluation.goes);
  if (blocked.length >= 5) lines.push(`${blocked.length} ordinary trades were held or refused, worth ${money(sum(blocked))}. A rebalance that never executes is a drift policy with extra steps.`);

  const liquidity = graded.filter((result) => byItem.get(result.item.id).issue === 'LIQUIDITY');
  // A smaller size only counts when the trade still goes: a split attached to a rejection sends nothing.
  const splitProperly = liquidity.filter((result) => result.evaluation.verdict === 'RESIZE' && result.evaluation.band !== 'AS_PROPOSED');
  const refused = liquidity.filter((result) => !result.evaluation.goes);
  if (liquidity.length) lines.push(`${splitProperly.length} of the ${liquidity.length} oversized trades were given a smaller size rather than only a verdict, which is the difference between a review and an order list${refused.length ? `; the other ${refused.length} were refused outright` : ''}.`);
  return lines;
}

/** The most frequent wrong verdict among stopped problem trades, as a sentence. */
function commonestSwap(wrongWay, byItem) {
  const counts = new Map();
  for (const result of wrongWay) {
    const key = `${byItem.get(result.item.id).verdict}|${result.evaluation.verdict}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [[key, count]] = [...counts].sort((left, right) => right[1] - left[1]);
  const [wanted, given] = key.split('|');
  return `The commonest swap: ${count} trades the desk would ${readable(wanted)} were given ${readable(given)}.`;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => !result.evaluation.goes)
    .sort((left, right) => right.item.valueUsd - left.item.valueUsd)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.verdict === result.evaluation.verdict ? ' · agrees' : ''}`,
      value: money(result.item.valueUsd),
    }));
}

const PLANTED_NOTES = {
  LIQUIDITY: 'Planted as too large for the market: well over a fifth of the instrument’s daily volume. The desk resizes these.',
  TAX_LOT: 'Planted as a tax-lot problem: a taxable account selling a lot bought at a loss inside thirty days. The desk defers these.',
  CROSSING: 'Planted as a crossing: another account trades the same name the other way today. The desk nets these rather than sending them.',
  TOO_SMALL: 'Planted as too small: under $250,000, where the spread costs more than the drift. The desk rejects these.',
  MANDATE_CONFLICT: 'Planted as a mandate conflict: it trims the energy overweight the mandate asked for. The desk defers these to the December review.',
  NONE: 'An ordinary trade: a weight moving toward its target in a size the market can take.',
};

const level = (question, value) => `${question.criteria[Math.round(value)] ?? '–'} · ${value.toFixed(1)} of ${question.criteria.length - 1}`;

/** Right means the exact verdict the desk would give, which is what "Verdict agrees" counts. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: result.evaluation.verdict === label.verdict,
    expected: label.verdict,
    got: result.evaluation.verdict,
    note: PLANTED_NOTES[label.issue],
    confidence: result.answers.verdict.confidence,
  };
}

function verdict(result) {
  const { evaluation, answers, item } = result;
  const sized = evaluation.verdict === 'RESIZE' && evaluation.band !== 'AS_PROPOSED';
  const volumeShare = item.shareOfAverageVolumePercent;
  return {
    eyebrow: `${sentence(item.side)} ${item.symbol} · ${money(item.valueUsd)}`,
    headline: `${sentence(evaluation.verdict)}${sized ? ` · ${readable(evaluation.band)}` : ''}`,
    detail: evaluation.verdict === 'RESIZE' && !sized ? 'Marked resize but given its full size: the two answers contradict each other.' : undefined,
    facts: [
      { label: 'Problem named', value: sentence(evaluation.issue), tone: evaluation.issue === 'NONE' ? 'good' : 'warn' },
      { label: 'Goes into the order list', value: evaluation.goes ? `${money(evaluation.orderValue)} of ${money(item.valueUsd)}` : `Nothing · ${money(item.valueUsd)} held`, tone: evaluation.goes ? 'good' : 'warn' },
      { label: 'Share of daily volume', value: `${volumeShare}% against a 20% rule`, tone: volumeShare > 20 ? 'bad' : 'good' },
      { label: 'Hard to execute', value: level(questions.execution_risk, evaluation.executionRisk), tone: evaluation.executionRisk >= 4 ? 'warn' : undefined },
      { label: 'Confidence in the verdict', value: `${Math.round(evaluation.confidence * 100)}%`, tone: evaluation.confidence < 0.5 ? 'warn' : 'good' },
      { label: 'Manager sign-off', value: `${evaluation.needsSignOff ? 'Yes' : 'No'} · ${Math.round(Math.max(answers.needs_pm_sign_off.noul, 1 - answers.needs_pm_sign_off.noul) * 100)}%` },
    ],
  };
}

export default {
  id: 'rebalance-review',
  title: 'Rebalance review',
  domain: 'portfolio',
  value: 'Read a rebalancing proposal trade by trade, and let the approved ones fall out as an order list.',
  tags: ['portfolio', 'trading', 'rebalancing', 'real prices'],
  dataClass: 'mixed',
  readMinutes: 4,
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${money(item.valueUsd)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/rebalance-review.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'Every planted problem breaks a rule written out in the state, so five ifs match the desk on 199 of 200 trades; several planted trades also move away from their target, which a real rebalancer would never propose.',
  stage: {
    hide: ['accountTaxable', 'price', 'averageDailyVolume', 'shares'],
    labels: {
      accountId: 'Account',
      valueUsd: 'Trade value',
      currentWeightPercent: 'Weight now (%)',
      targetWeightPercent: 'Target weight (%)',
      weightAfterPercent: 'Weight after this trade (%)',
      shareOfAverageVolumePercent: 'Share of average daily volume (%)',
      recentTradesInThisName: 'Earlier trades in this name',
      sameNameOtherAccountToday: 'Same name in another account today',
      mandateNote: 'What the mandate says',
      daysAgo: 'Days ago',
    },
    highlight: ['shareOfAverageVolumePercent', 'valueUsd', 'weightAfterPercent'],
  },
  grade: { labelId: (label) => label.tradeId, judge },
  verdict,
  present: {
    number: 143,
    problem: {
      headline: 'A rebalancer knows the target weights and nothing else: not the tax lots, not the other accounts, not the mandate.',
      stat: '200',
      statLabel: 'proposed trades, 47 of them right on paper and wrong here',
    },
    hero: {
      item: 'TR-0154',
      caption: 'Buy $592M of PEP: 54.6% of a day’s volume against a rule of one fifth. The trade is right and the size is not.',
    },
    answers: {
      caption: 'Resize, split over days, problem named as liquidity. The confidence is only 35%: reject was the close second at 48%.',
      reveal: ['verdict', 'size_band', 'issue'],
    },
    miss: {
      item: 'TR-0015',
      caption: 'A taxable account selling KO at a loss 18 days after buying it. The problem is named exactly, but the desk would defer it and the model rejected it.',
    },
    proof: {
      kpis: ['Verdict agrees', 'Problem trades stopped', 'Good trades stopped'],
      chart: 'matrix',
      closing: '47 of 47 problem trades stopped, but only 16 with the verdict the desk would give; five ifs over the same fields match the desk on 199 of 200.',
    },
  },
  explain: {
    data: 'scripts/generate/rebalance-review.js#demo:data',
    state: 'demos/rebalance-review/demo.js#demo:state',
    questions: 'demos/rebalance-review/demo.js#demo:questions',
    evaluate: 'demos/rebalance-review/demo.js#demo:evaluate',
  },
};
