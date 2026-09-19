// Rebalance review: two hundred trades a mechanical rebalancer proposed, read one at a time. The
// rebalancer knows the target weights and nothing else — not the tax lots, not the other accounts, not
// the note in the mandate — so the job is to catch the trades that are right on paper and wrong here.

import { choice, noul, score } from '../lib/questions.js';

const VERDICTS = ['APPROVE', 'RESIZE', 'DEFER', 'REJECT'];
const ISSUES = ['LIQUIDITY', 'TAX_LOT', 'CROSSING', 'TOO_SMALL', 'MANDATE_CONFLICT', 'NONE'];
const SIZES = ['AS_PROPOSED', 'HALF', 'QUARTER', 'SPLIT_OVER_DAYS'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(value ?? 0);
const sum = (results) => results.reduce((total, result) => total + result.item.valueUsd, 0);

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

  return {
    note: `Two hundred proposed trades across six accounts, ${problems.length} of them carrying something the rebalancer could not see. ${context.note ?? ''}`,
    findings: findings(graded, byItem, clean),
    kpis: kpis({ graded, problems, clean, caught, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, problems),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

function kpis({ graded, problems, clean, caught, byItem }) {
  const issueRight = problems.filter((result) => result.evaluation.issue === byItem.get(result.item.id).issue);
  const verdictRight = graded.filter((result) => result.evaluation.verdict === byItem.get(result.item.id).verdict);
  const blockedClean = clean.filter((result) => !result.evaluation.goes);
  const order = graded.filter((result) => result.evaluation.goes);
  const badInTheOrder = order.filter((result) => byItem.get(result.item.id).issue !== 'NONE' && byItem.get(result.item.id).verdict === 'REJECT');

  return [
    { label: 'Problem trades stopped', value: `${caught.length} of ${problems.length}`, context: 'not approved as they stood', tone: caught.length === problems.length ? 'good' : 'warn' },
    { label: 'Problem named exactly', value: `${issueRight.length} of ${problems.length}`, context: 'liquidity, tax lot, crossing, too small or mandate' },
    { label: 'Verdict agrees', value: share(verdictRight.length, graded.length), context: `${verdictRight.length} of ${graded.length} trades, all four verdicts` },
    { label: 'Good trades stopped', value: `${blockedClean.length} of ${clean.length}`, context: `${money(sum(blockedClean))} of ordinary rebalancing held up`, tone: blockedClean.length > clean.length / 10 ? 'warn' : 'good' },
    { label: 'Order list', value: money(order.reduce((total, result) => total + result.evaluation.orderValue, 0)), context: `${order.length} trades${badInTheOrder.length ? ` · ${badInTheOrder.length} that should not be there` : ' · nothing in it that should be rejected'}`, tone: badInTheOrder.length ? 'warn' : 'good' },
  ];
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
    title: 'Problem named against the problem the trade carries',
    columns: ISSUES.map(sentence),
    rows: ISSUES.map((actual) => ({
      label: sentence(actual),
      cells: ISSUES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).issue === actual && result.evaluation.issue === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, problems) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const held = graded.filter((result) => result.evaluation.executionRisk >= bar);
    const real = held.filter((result) => byItem.get(result.item.id).issue !== 'NONE');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: held.length, caught: real.length, rate: held.length ? Number((real.length / held.length).toFixed(3)) : null };
  });
  return { title: 'Execution risk against the trades that really have a problem', xLabel: 'Trades at this execution risk or above', yLabel: 'Trades with something wrong among them', rateLabel: 'Share of those that do', of: problems.length, points };
}

function findings(graded, byItem, clean) {
  const lines = [];
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
  const splitProperly = liquidity.filter((result) => result.evaluation.band === 'SPLIT_OVER_DAYS' || result.evaluation.band === 'QUARTER');
  if (liquidity.length) lines.push(`${splitProperly.length} of the ${liquidity.length} oversized trades were given a smaller size rather than only a verdict, which is the difference between a review and an order list.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => !result.evaluation.goes)
    .sort((left, right) => right.item.valueUsd - left.item.valueUsd)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.issue === result.evaluation.issue ? ' · agrees' : ''}`,
      value: money(result.item.valueUsd),
    }));
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
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.side.toLowerCase()} ${item.symbol} · ${money(item.valueUsd)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/rebalance-review.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/rebalance-review.js#demo:data',
    state: 'demos/rebalance-review/demo.js#demo:state',
    questions: 'demos/rebalance-review/demo.js#demo:questions',
    evaluate: 'demos/rebalance-review/demo.js#demo:evaluate',
  },
};
