// Token screening: score the contract and market facts visible now, then compare the call with the
// generator's held-out outcome. Future outcomes are never sent to Jev.

import { matrixStats } from '../lib/metrics.js';
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
  const matrix = outcomeMatrix(graded, intended);
  const rows = baselines(graded, intended, correct);
  return {
    note: `One hundred and sixty invented tokens: 14 later rugged, 9 are honeypots, 11 are tax traps, and 18 are deliberately scary but fine. Future outcomes are held out until this report. ${context.caveat ?? ''}`,
    findings: findings(graded, intended, rows),
    kpis: kpis({ graded, harmful, fine, honeypots, correct, honeypotsCaught, fineExcluded, decoys }),
    baselines: rows,
    metrics: metrics(graded, harmful, correct, matrix),
    distributionTitle: 'Strongest red flag named',
    distribution: FLAGS.map((flag) => ({ label: title(flag), count: results.filter((result) => result.evaluation.flag === flag).length })).filter((entry) => entry.count),
    matrix,
    curve: exclusionCurve(graded, intended),
    checks: [
      { id: 'honeypots', label: 'Honeypots missed', detail: 'Buys succeed while repeated sells fail.', count: honeypots.length - honeypotsCaught.length, of: honeypots.length, items: honeypots.filter((result) => !result.evaluation.honeypot).map((result) => result.item.id) },
      { id: 'decoys', label: 'Scary-but-fine tokens excluded', detail: 'Verified vesting concentration and old, unmoved unlocked pools must remain distinguishable from creator control and liquidity removal.', count: decoys.filter((result) => fineExcluded.includes(result)).length, of: decoys.length, items: decoys.filter((result) => fineExcluded.includes(result)).map((result) => result.item.id) },
    ],
    topItemsTitle: 'The 18 scary-but-fine decoys',
    topItems: decoys.map((result) => ({ id: result.item.id, label: `${result.item.id} · ${intended.get(result.item.id).decoyKind} · called ${readable(result.evaluation.predictedOutcome)} · ${result.evaluation.tradeable ? 'tradeable' : 'avoid'}` })),
  };
}
// #endregion

/** Avoided means the user is kept out: not tradeable, or no position. A small position in a rug is still lost. */
const avoided = (result) => !result.evaluation.tradeable || result.evaluation.positionLimit === 'NONE';

function kpis({ graded, harmful, fine, honeypots, correct, honeypotsCaught, fineExcluded, decoys }) {
  const harmfulAvoided = harmful.filter(avoided);
  const harmfulTradeable = harmful.filter((result) => result.evaluation.tradeable);
  return [
    { label: 'Outcome correct', value: share(correct.length, graded.length), context: `${correct.length} of ${graded.length}; the outcome is derived from the red flag and the honeypot answer`, tone: correct.length >= graded.length * 0.9 ? 'good' : 'warn' },
    { label: 'Honeypots caught', value: `${honeypotsCaught.length} of ${honeypots.length}`, context: 'reported separately because this miss is expensive', tone: honeypotsCaught.length === honeypots.length ? 'good' : 'warn' },
    { label: 'Harmful tokens avoided', value: `${harmfulAvoided.length} of ${harmful.length}`, context: 'called not tradeable, or given no position; a small position in a token that rugs is still lost', tone: harmfulAvoided.length === harmful.length ? 'good' : 'warn' },
    { label: 'Harmful tokens called tradeable', value: `${harmfulTradeable.length} of ${harmful.length}`, context: 'rugged, honeypot and tax-trap cohorts together, whatever position limit came with the answer', tone: harmfulTradeable.length ? 'warn' : 'good' },
    { label: 'Fine tokens excluded', value: `${fineExcluded.length} of ${fine.length}`, context: `${decoys.filter((result) => fineExcluded.includes(result)).length} of the ${decoys.length} planted decoys`, tone: fineExcluded.length ? 'warn' : 'good' },
  ];
}

// The rule: failed sells make a honeypot, a sell tax over the chain norm makes a tax trap, and a live
// mint authority, a creator holding over a fifth, or a large liquidity removal makes a rug.
function ruleOutcome(item) {
  if (item.trading.failedSellAttempts >= 5) return 'HONEYPOT';
  if (item.contract.sellTaxPercent > 20) return 'TAX_TRAP';
  if (item.contract.mintAuthorityPresent || item.holders.creatorShare > 0.2 || item.liquidity.largestRemovalPercent > 20) return 'RUGGED';
  return 'FINE';
}

function baselines(graded, intended, correct) {
  if (!graded.length) return [];
  const ruleRight = graded.filter((result) => ruleOutcome(result.item) === intended.get(result.item.id).outcome);
  const fine = graded.filter((result) => intended.get(result.item.id).outcome === 'FINE');
  return [
    { label: 'Jev', detail: 'held-out outcome, derived from the red flag and the honeypot answer', value: correct.length / graded.length, count: correct.length, model: true },
    { label: 'Rule: failed sells, sell tax, mint, creator share, removal', detail: 'five lines of code over the same present-tense facts', value: ruleRight.length / graded.length, count: ruleRight.length },
    { label: 'Always fine', detail: 'the commonest outcome', value: fine.length / graded.length, count: fine.length },
  ];
}

function metrics(graded, harmful, correct, matrix) {
  const stats = matrixStats(matrix);
  const flagged = graded.filter((result) => result.evaluation.predictedOutcome !== 'FINE');
  const rate = (part, whole) => (whole ? part / whole : null);
  return {
    headline: { label: 'Outcome correct', value: rate(correct.length, graded.length) ?? 0, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    precision: rate(flagged.filter((result) => harmful.includes(result)).length, flagged.length),
    recall: rate(harmful.filter((result) => result.evaluation.predictedOutcome !== 'FINE').length, harmful.length),
    harmfulAvoidedRate: rate(harmful.filter(avoided).length, harmful.length),
  };
}

function outcomeMatrix(graded, intended) {
  return {
    title: 'Held-out outcome against the screen call',
    rowLabel: 'what later happened to the token',
    columnLabel: 'the outcome the screen called',
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
    return { threshold: Number((threshold / 6).toFixed(3)), reviewed: excluded.length, caught: caught.length, rate: goodLost.length / Math.max(graded.filter((result) => intended.get(result.item.id).outcome === 'FINE').length, 1), goodLost: goodLost.length };
  });
  return { title: 'Rug-likelihood bar: rugs caught against good tokens excluded', xLabel: 'Tokens excluded at this likelihood or above', yLabel: 'Later rugs caught', rateLabel: 'share of fine tokens excluded', of: rugs.length, thresholdFormat: 'level', levels: 6, defaultIndex: 3, points };
}

function findings(graded, intended, rows = []) {
  const lines = [];
  const [model, rule] = rows;
  if (model && rule && rule.count >= model.count) {
    lines.push(`A five-line rule over the same facts gets ${rule.count} of ${graded.length} outcomes right; the model gets ${model.count}. The harmful and fine tokens do not overlap on sell tax, failed sells, mint authority or creator share, so the held-out future is a function of the present fields.`);
  }

  const harmful = graded.filter((result) => intended.get(result.item.id).outcome !== 'FINE');
  const harmfulTradeable = harmful.filter((result) => result.evaluation.tradeable);
  if (harmfulTradeable.length) {
    const noPosition = harmfulTradeable.filter((result) => result.evaluation.positionLimit === 'NONE');
    lines.push(`${harmfulTradeable.length} of the ${harmful.length} harmful tokens were called tradeable. ${noPosition.length} of those came with "do not open a position", which contradicts the answer beside it; the other ${harmfulTradeable.length - noPosition.length} were given a small or normal position in a token that went on to harm its holders.`);
  }

  const fineScores = graded.filter((result) => intended.get(result.item.id).outcome === 'FINE').map((result) => result.evaluation.risk);
  const rugScores = graded.filter((result) => intended.get(result.item.id).outcome === 'RUGGED').map((result) => result.evaluation.risk);
  if (fineScores.length && rugScores.length && Math.min(...rugScores) > Math.max(...fineScores) && Math.max(...rugScores) < 4) {
    lines.push(`The later rugs score ${Math.min(...rugScores).toFixed(2)} to ${Math.max(...rugScores).toFixed(2)} of 6, "low" to "moderate" in the rubric's words, while no fine token scores above ${Math.max(...fineScores).toFixed(2)}. The ranking separates them; a bar at 3 of 6 would catch only ${rugScores.filter((value) => value >= 3).length} of ${rugScores.length}.`);
  }
  const missed = graded.filter((result) => intended.get(result.item.id).outcome === 'HONEYPOT' && !result.evaluation.honeypot);
  if (missed.length) lines.push(`${missed.length} honeypot${missed.length === 1 ? '' : 's'} slipped through despite repeated failed sells: ${missed.map((result) => result.item.id).join(', ')}.`);
  const vestingFalse = graded.filter((result) => intended.get(result.item.id).decoyKind === 'verified vesting concentration' && result.evaluation.flag === 'HOLDER_CONCENTRATION');
  if (vestingFalse.length) lines.push(`${vestingFalse.length} verified vesting ${vestingFalse.length === 1 ? 'allocation was' : 'allocations were'} mistaken for creator concentration.`);
  return lines;
}

const RISK_WORDS = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain'];
const LIMIT_WORDS = { NONE: 'No position', SMALL: 'Small position only', NORMAL: 'No size restriction' };
const asPercent = (value) => `${Math.round(value * 100)}%`;
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${asPercent(Math.max(probability, 1 - probability))}`;

/** Right means the derived outcome matches the held-out one, which is what the headline counts. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: result.evaluation.predictedOutcome === label.outcome,
    expected: label.outcome,
    got: result.evaluation.predictedOutcome,
    note: label.decoy ? `Planted decoy: ${label.decoyKind}. Scary to look at, and fine.` : label.outcome === 'FINE' ? undefined : `Held-out outcome: ${readable(label.outcome)}, planted through ${readable(label.flag)}.`,
    confidence: result.answers.red_flag.confidence,
  };
}

function verdict(result) {
  const { item, answers, evaluation } = result;
  const keepOut = !evaluation.tradeable || evaluation.positionLimit === 'NONE';
  const contradiction = evaluation.tradeable && evaluation.positionLimit === 'NONE';
  return {
    eyebrow: 'What the screen says about this token',
    headline: `${keepOut ? 'Avoid' : evaluation.positionLimit === 'SMALL' ? 'Tradeable, small size' : 'Tradeable'} · ${item.symbol}`,
    detail: contradiction ? 'Called tradeable and given no position in the same answer set: the two disagree.' : undefined,
    facts: [
      { label: 'Trap risk', value: `${RISK_WORDS[Math.round(evaluation.risk)]} · ${evaluation.risk.toFixed(1)} of 6`, tone: evaluation.risk >= 4 ? 'bad' : evaluation.risk >= 2.5 ? 'warn' : 'good' },
      { label: 'Strongest red flag', value: `${title(evaluation.flag)} · ${asPercent(answers.red_flag.confidence)}`, tone: evaluation.flag === 'NONE' ? 'good' : 'warn' },
      { label: 'Honeypot suspected', value: yesNo(answers.honeypot_suspected.noul), tone: evaluation.honeypot ? 'bad' : 'good' },
      { label: 'Tradeable for an ordinary user', value: yesNo(answers.tradeable.noul), tone: evaluation.tradeable ? 'good' : 'bad' },
      { label: 'Position limit', value: LIMIT_WORDS[evaluation.positionLimit], tone: evaluation.positionLimit === 'NORMAL' ? 'good' : evaluation.positionLimit === 'SMALL' ? 'warn' : 'bad' },
    ],
  };
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
  caveat: 'The harmful and the fine tokens in this file do not overlap on sell tax, failed sells, mint authority or creator share, and the option texts restate the chain norms, so a five-line rule gets all 160 outcomes. This run measures reading, not foresight; a file with overlapping features is planned.',
  stage: {
    hide: ['contractAddress', 'chain', 'name'],
    labels: {
      mintAuthorityPresent: 'Mint authority still live',
      buyTaxPercent: 'Buy tax (%)',
      sellTaxPercent: 'Sell tax (%)',
      poolUsd: 'Pool size (USD)',
      shareLocked: 'Liquidity locked (share)',
      largestRemovalPercent: 'Largest liquidity removal (%)',
      top10Share: 'Top ten holders (share)',
      creatorShare: 'Creator holding (share)',
      vestingContractShare: 'Held in a vesting contract (share)',
      vestingContractVerified: 'Vesting contract verified',
      burnAddressShare: 'Burned (share)',
      failedSellAttempts: 'Failed sell attempts',
      buySellRatio: 'Buys per successful sell',
      volume24hUsd: 'Volume, 24 hours (USD)',
      volume7dUsd: 'Volume, 7 days (USD)',
    },
    highlight: ['sellTaxPercent', 'failedSellAttempts', 'successfulSells', 'creatorShare'],
  },
  grade: { labelId: (label) => label.token, judge },
  verdict,
  present: {
    number: 134,
    problem: {
      headline: 'Before anyone buys, someone has to read the contract, the pool, the holders and the tape.',
      stat: '160',
      statLabel: 'tokens to screen, 34 of them traps',
    },
    hero: {
      item: 'TOK-0128',
      caption: 'A $3.6m pool with 455 buys, 0 successful sells and 10 failed ones. Called a honeypot at 94%, risk 5.5 of 6, not tradeable, no position.',
    },
    answers: {
      caption: 'A risk grade, the strongest red flag, the honeypot check, and what size of position follows.',
      reveal: ['rug_likelihood', 'red_flag', 'honeypot_suspected', 'tradeable', 'position_limit'],
    },
    miss: {
      item: 'TOK-0019',
      caption: 'Top ten holders own 63%, but 52% sits in a verified vesting contract and the creator holds 1.6%. Flagged as holder concentration at 45% confidence, which the report counts as a rug call.',
    },
    proof: {
      kpis: ['Honeypots caught', 'Harmful tokens called tradeable', 'Fine tokens excluded'],
      chart: 'baselines',
      closing: '9 of 9 honeypots avoided and 0 of 126 good tokens lost, but 25 of the 34 harmful tokens were still called tradeable.',
    },
  },
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
