// Token screening: score the contract and market facts visible now, then compare the call with the
// generator's held-out outcome. Future outcomes are never sent to Jev.

import { choice, noul, score } from '../lib/questions.js';

const OUTCOMES = ['FINE', 'RUGGED', 'HONEYPOT', 'TAX_TRAP'];
const FLAGS = ['MINT_AUTHORITY', 'UNLOCKED_LIQUIDITY', 'HOLDER_CONCENTRATION', 'SELL_TAX', 'FAILED_SELLS', 'NONE'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const title = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Screen this fictional token from the facts available now. Grade trap risk, name the strongest red flag, and say whether a normal user can trade it.',
    observed_on: context.asOf,
    chain_norms: context.norms,
    caution: context.caveat,
    token: { name: item.name, symbol: item.symbol, contract_address: item.contractAddress, chain: item.chain },
    contract_facts: item.contract,
    liquidity: item.liquidity,
    holder_distribution: item.holders,
    trading_history: item.trading,
  };
}
// #endregion

// #region demo:questions
const questions = {
  rug_likelihood: score('How likely is this token to trap or seriously harm a trader?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain']),
  red_flag: choice('What is the strongest red flag?', {
    MINT_AUTHORITY: 'An active mint authority can dilute holders.',
    UNLOCKED_LIQUIDITY: 'Liquidity can be removed and the visible history supports that concern.',
    HOLDER_CONCENTRATION: 'Control sits with the creator or ordinary holders, not a verified vesting contract.',
    SELL_TAX: 'The sell tax exceeds twenty per cent.',
    FAILED_SELLS: 'Buys work while repeated sell attempts fail and almost no sell succeeds.',
    NONE: 'No single fact here makes the token a trap.',
  }),
  tradeable: noul('Is the token tradeable for an ordinary user?', { yes: 'The evidence does not show a trap.', no: 'The trader should avoid it.' }),
  honeypot_suspected: noul('Does the observed buy-and-sell history support a honeypot suspicion?', { yes: 'Repeated failed sells coexist with working buys and almost no successful sells.', no: 'The history does not support that specific suspicion.' }),
  position_limit: choice('What position limit follows from the evidence?', { NONE: 'Do not open a position.', SMALL: 'Only a small, risk-limited position.', NORMAL: 'No special size restriction from this screen.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  const risk = answers.rug_likelihood.score;
  const flag = answers.red_flag.choice;
  const honeypot = answers.honeypot_suspected.noul >= 0.5;
  const predictedOutcome = honeypot ? 'HONEYPOT'
    : flag === 'SELL_TAX' ? 'TAX_TRAP'
      : ['MINT_AUTHORITY', 'UNLOCKED_LIQUIDITY', 'HOLDER_CONCENTRATION'].includes(flag) ? 'RUGGED'
        : 'FINE';
  return {
    risk,
    flag,
    tradeable: answers.tradeable.noul >= 0.5,
    honeypot,
    positionLimit: answers.position_limit.choice,
    predictedOutcome,
    confidence: answers.red_flag.confidence,
    label: `${item.id} · ${title(predictedOutcome)} · ${risk.toFixed(1)}/6 · ${title(flag)}`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.token, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const harmful = graded.filter((result) => intended.get(result.item.id).outcome !== 'FINE');
  const fine = graded.filter((result) => intended.get(result.item.id).outcome === 'FINE');
  const honeypots = graded.filter((result) => intended.get(result.item.id).outcome === 'HONEYPOT');
  const correct = graded.filter((result) => result.evaluation.predictedOutcome === intended.get(result.item.id).outcome);
  const honeypotsCaught = honeypots.filter((result) => result.evaluation.honeypot);
  const fineExcluded = fine.filter((result) => !result.evaluation.tradeable || result.evaluation.positionLimit === 'NONE');
  const decoys = graded.filter((result) => intended.get(result.item.id).decoy);
  return {
    note: `One hundred and sixty invented tokens: 14 later rugged, 9 are honeypots, 11 are tax traps, and 18 are deliberately scary but fine. Future outcomes are held out until this report. ${context.caveat ?? ''}`,
    findings: findings(graded, intended),
    kpis: [
      { label: 'Outcome correct', value: share(correct.length, graded.length), context: `${correct.length} of ${graded.length}`, tone: correct.length === graded.length ? 'good' : 'warn' },
      { label: 'Honeypots caught', value: `${honeypotsCaught.length} of ${honeypots.length}`, context: 'reported separately because this miss is expensive', tone: honeypotsCaught.length === honeypots.length ? 'good' : 'warn' },
      { label: 'Harmful tokens constrained', value: `${harmful.filter((result) => !result.evaluation.tradeable || result.evaluation.positionLimit !== 'NORMAL').length} of ${harmful.length}`, context: 'avoided or explicitly size-limited; rugged, honeypot and tax-trap cohorts together' },
      { label: 'Fine tokens excluded', value: `${fineExcluded.length} of ${fine.length}`, context: `${decoys.filter((result) => fineExcluded.includes(result)).length} of the 18 planted decoys`, tone: fineExcluded.length ? 'warn' : 'good' },
    ],
    distribution: FLAGS.map((flag) => ({ label: title(flag), count: results.filter((result) => result.evaluation.flag === flag).length })).filter((entry) => entry.count),
    matrix: outcomeMatrix(graded, intended),
    curve: exclusionCurve(graded, intended),
    checks: [
      { id: 'honeypots', label: 'Honeypots missed', detail: 'Buys succeed while repeated sells fail.', count: honeypots.length - honeypotsCaught.length, of: honeypots.length, items: honeypots.filter((result) => !result.evaluation.honeypot).map((result) => result.item.id) },
      { id: 'decoys', label: 'Scary-but-fine tokens excluded', detail: 'Verified vesting concentration and old, unmoved unlocked pools must remain distinguishable from creator control and liquidity removal.', count: decoys.filter((result) => fineExcluded.includes(result)).length, of: decoys.length, items: decoys.filter((result) => fineExcluded.includes(result)).map((result) => result.item.id) },
    ],
    topItems: decoys.map((result) => ({ id: result.item.id, label: `${result.item.id} · ${intended.get(result.item.id).decoyKind} · called ${readable(result.evaluation.predictedOutcome)} · ${result.evaluation.tradeable ? 'tradeable' : 'avoid'}` })),
  };
}
// #endregion

function outcomeMatrix(graded, intended) {
  return {
    title: 'Held-out outcome against the screen call',
    columns: OUTCOMES.map(title),
    rows: OUTCOMES.map((actual) => ({ label: title(actual), cells: OUTCOMES.map((predicted) => {
      const items = graded.filter((result) => intended.get(result.item.id).outcome === actual && result.evaluation.predictedOutcome === predicted).map((result) => result.item.id);
      return { predicted, count: items.length, diagonal: actual === predicted, items, ariaLabel: `${title(actual)} called ${title(predicted)}: ${items.length}` };
    }) })),
  };
}

function exclusionCurve(graded, intended) {
  const rugs = graded.filter((result) => intended.get(result.item.id).outcome === 'RUGGED');
  const points = Array.from({ length: 7 }, (_, threshold) => {
    const excluded = graded.filter((result) => result.evaluation.risk >= threshold);
    const caught = excluded.filter((result) => intended.get(result.item.id).outcome === 'RUGGED');
    const goodLost = excluded.filter((result) => intended.get(result.item.id).outcome === 'FINE');
    return { threshold: threshold / 6, reviewed: excluded.length, caught: caught.length, rate: goodLost.length / Math.max(graded.filter((result) => intended.get(result.item.id).outcome === 'FINE').length, 1), goodLost: goodLost.length };
  });
  return { title: 'Rug-likelihood bar: rugs caught against good tokens excluded', xLabel: 'Tokens excluded at this likelihood or above', yLabel: 'Later rugs caught', rateLabel: 'share of fine tokens excluded', of: rugs.length, points };
}

function findings(graded, intended) {
  const lines = [];
  const missed = graded.filter((result) => intended.get(result.item.id).outcome === 'HONEYPOT' && !result.evaluation.honeypot);
  if (missed.length) lines.push(`${missed.length} honeypot${missed.length === 1 ? '' : 's'} slipped through despite repeated failed sells: ${missed.map((result) => result.item.id).join(', ')}.`);
  const vestingFalse = graded.filter((result) => intended.get(result.item.id).decoyKind === 'verified vesting concentration' && result.evaluation.flag === 'HOLDER_CONCENTRATION');
  if (vestingFalse.length) lines.push(`${vestingFalse.length} verified vesting allocations were mistaken for creator concentration.`);
  return lines;
}

export default {
  id: 'token-screening',
  title: 'Token screening',
  domain: 'crypto',
  value: 'Read contract, liquidity, holder and trading facts and say whether a fictional token is a trap.',
  tags: ['crypto', 'tokens', 'rug risk', 'honeypots'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${item.trading.ageDays} days · ${item.holders.count.toLocaleString('en-US')} holders`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/token-screening.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/token-screening.js#demo:data',
    state: 'demos/token-screening/demo.js#demo:state',
    questions: 'demos/token-screening/demo.js#demo:questions',
    evaluate: 'demos/token-screening/demo.js#demo:evaluate',
  },
};
