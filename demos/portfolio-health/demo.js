// Portfolio health: twenty-four books of holdings, each carrying one problem or none. The weights are
// invented; every price, volatility, volume and correlation behind them is real and cached, so the
// numbers the answer is judged against are numbers somebody could check.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const RISKS = ['CONCENTRATION', 'CORRELATION', 'LIQUIDITY', 'CURRENCY', 'DRIFT', 'NONE'];
const ACTIONS = ['HOLD', 'TRIM', 'HEDGE', 'REBALANCE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(value ?? 0);

// Below this confidence in the named risk the answer is better handed to the adviser than acted on.
const ACT_ABOVE = 0.5;

// #region demo:state
/** The holdings, the plan they were bought against, and the real numbers behind each position. */
function buildState(item, context) {
  return {
    task: 'Read this portfolio against what the client asked for, name the biggest risk in it, and say what to do.',
    adviser: { name: context.adviser, prices_as_of: context.pricesAsOf, how_we_read_these: context.howToRead, note: context.note },
    client: { spends_in: item.clientSpendsIn, objective: item.objective, agreed_allocation_percent: item.targetAllocation },
    portfolio: {
      total_value_usd: item.totalValueUsd,
      cash_percent: item.cashPercent,
      holdings: item.holdingCount,
      current_allocation_percent: item.currentAllocation,
      largest_holding_percent: item.largestHoldingPercent,
      held_outside_the_clients_currency_percent: item.heldOutsideTheClientsCurrencyPercent,
      adviser_note: item.adviserNote,
    },
    holdings: item.holdings.map((holding) => ({
      symbol: holding.symbol,
      sector: holding.sector,
      asset_class: holding.assetClass,
      currency: holding.currency,
      weight_percent: holding.weightPercent,
      value_usd: holding.valueUsd,
      twelve_month_return_percent: holding.twelveMonthReturnPercent,
      volatility_percent: holding.volatilityPercent,
      worst_fall_percent: holding.worstFallPercent,
      days_of_its_own_average_volume: holding.daysOfAverageVolume,
    })),
    most_correlated_pairs: item.pairCorrelations,
  };
}
// #endregion

// #region demo:questions
const questions = {
  main_risk: choice('What is the biggest risk in this portfolio?', {
    CONCENTRATION: 'Too much of it is in one name.',
    CORRELATION: 'Several holdings are really the same bet, whatever their tickers say.',
    LIQUIDITY: 'A position is large enough in its own market that selling it would move the price.',
    CURRENCY: 'The money is held in a currency the client does not live in.',
    DRIFT: 'The weights have wandered away from the allocation the client agreed.',
    NONE: 'Nothing here needs raising with the client.',
  }),
  severity: score('How serious is it?', ['None', 'Slight', 'Mild', 'Notable', 'Serious', 'Severe', 'Critical']),
  action: choice('What should the adviser do?', {
    HOLD: 'Nothing. Leave it as it is.',
    TRIM: 'Reduce the position that causes the problem.',
    HEDGE: 'Leave the holdings and cover the exposure separately.',
    REBALANCE: 'Bring the whole portfolio back to the agreed allocation.',
  }),
  fits_objective: noul('Does this portfolio still do what the client asked it to do?', {
    yes: 'The holdings and the plan agree well enough to leave alone.',
    no: 'What is held no longer matches what was agreed.',
  }),
  diversified_in_name_only: noul('Is it diversified on paper and concentrated in practice?', {
    yes: 'The number of holdings hides how few bets there really are.',
    no: 'The spread of holdings is a real spread of risk.',
  }),
};
// #endregion

/** The share of the book, in percent, that sits behind the risk that was named. */
function percentBehind(risk, item) {
  const heaviest = Math.max(...item.holdings.map((holding) => holding.weightPercent));
  if (risk === 'CURRENCY') return item.heldOutsideTheClientsCurrencyPercent ?? 0;
  if (risk === 'DRIFT') return largestDrift(item);
  if (risk === 'LIQUIDITY') {
    const slowest = [...item.holdings].sort((left, right) => (right.daysOfAverageVolume ?? 0) - (left.daysOfAverageVolume ?? 0))[0];
    return slowest.weightPercent;
  }
  if (risk === 'CORRELATION') {
    // Every holding that appears in a pair at or above the top pair's level, less a little slack.
    const pairs = item.pairCorrelations ?? [];
    const top = Math.max(...pairs.map((pair) => pair.correlation), 0);
    const symbols = new Set(pairs.filter((pair) => pair.correlation >= top - 0.05).flatMap((pair) => pair.pair.split('/')));
    const cluster = item.holdings.filter((holding) => symbols.has(holding.symbol));
    return cluster.length ? cluster.reduce((total, holding) => total + holding.weightPercent, 0) : heaviest;
  }
  return heaviest;
}

/** The furthest any asset class sits from the allocation the client agreed, in points. */
function largestDrift(item) {
  const target = item.targetAllocation ?? {};
  return Math.max(0, ...Object.keys(target).map((key) => Math.abs((item.currentAllocation?.[key] ?? 0) - target[key])));
}

// #region demo:evaluate
/** One portfolio's verdict, and the money sitting behind whatever it is worried about. */
function evaluate(answers, item) {
  const risk = answers.main_risk.choice;

  return {
    risk,
    severity: answers.severity.score,
    action: answers.action.choice,
    fits: answers.fits_objective.noul >= 0.5,
    nameOnly: answers.diversified_in_name_only.noul >= 0.5,
    confidence: answers.main_risk.confidence,
    flagged: risk !== 'NONE',
    valueAtRisk: risk === 'NONE' ? 0 : Math.round((percentBehind(risk, item) / 100) * item.totalValueUsd),
    label: `${item.id} · ${readable(risk)} · ${readable(answers.action.choice)}`,
  };
}
// #endregion

// #region demo:report
/** Graded against the problem each portfolio was built to carry, one risk per book. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.portfolioId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const withRisk = graded.filter((result) => byItem.get(result.item.id).plantedRisk !== 'NONE');
  const healthy = graded.filter((result) => byItem.get(result.item.id).plantedRisk === 'NONE');
  const named = withRisk.filter((result) => result.evaluation.risk === byItem.get(result.item.id).plantedRisk);
  const right = graded.filter((result) => result.evaluation.risk === byItem.get(result.item.id).plantedRisk);
  const sure = graded.filter((result) => result.evaluation.confidence >= ACT_ABOVE);
  const sureRight = sure.filter((result) => right.includes(result));
  const ruleRight = graded.filter((result) => thresholdRule(result.item) === byItem.get(result.item.id).plantedRisk);
  const matrix = confusion(graded, byItem);
  const stats = matrixStats(matrix);

  return {
    note: `Twenty-four portfolios, ${withRisk.length} built to carry one problem each and ${healthy.length} built to carry none. ${context.note ?? ''}`,
    findings: findings({ graded, byItem, healthy, right, sure, sureRight, ruleRight }),
    kpis: kpis({ graded, withRisk, healthy, named, right, sure, sureRight }),
    distribution: distribution(results),
    distributionTitle: 'What the adviser was told to do',
    baselines: baselines({ graded, right, ruleRight, stats }),
    metrics: {
      headline: { label: 'Main risk right', value: graded.length ? right.length / graded.length : 0, n: graded.length },
      accuracy: stats?.accuracy ?? null,
      macroF1: stats?.macroF1 ?? null,
      automationRate: graded.length ? sure.length / graded.length : null,
      automationPrecision: sure.length ? sureRight.length / sure.length : null,
    },
    matrix,
    curve: coverage(graded, byItem, withRisk),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
    topItemsTitle: 'Most serious, with the money behind the named risk',
  };
}
// #endregion

function kpis({ graded, withRisk, healthy, named, right, sure, sureRight }) {
  const flaggedHealthy = healthy.filter((result) => result.evaluation.flagged);
  const actions = graded.filter((result) => result.evaluation.action !== 'HOLD');
  const actedOnHealthy = healthy.filter((result) => result.evaluation.action !== 'HOLD');

  return [
    { label: 'Main risk right', value: `${right.length} of ${graded.length}`, context: 'every portfolio, the healthy ones included, named from six', tone: right.length === graded.length ? 'good' : 'warn' },
    { label: 'Right when it was sure', value: `${sureRight.length} of ${sure.length}`, context: `answers at 50% confidence or above · the other ${graded.length - sure.length} go to the adviser`, tone: sure.length && sureRight.length === sure.length ? 'good' : 'warn' },
    { label: 'Risk named exactly', value: `${named.length} of ${withRisk.length}`, context: 'only the portfolios built to carry a problem', tone: named.length === withRisk.length ? 'good' : 'warn' },
    { label: 'Healthy portfolios left alone', value: `${healthy.length - flaggedHealthy.length} of ${healthy.length}`, context: flaggedHealthy.length ? `${flaggedHealthy.length} given a problem they do not have` : 'none flagged', tone: flaggedHealthy.length ? 'warn' : 'good' },
    { label: 'Something to do', value: `${actions.length} of ${graded.length}`, context: actedOnHealthy.length ? `${actedOnHealthy.length} of them healthy portfolios that needed nothing` : 'trim, hedge or rebalance rather than hold', tone: actedOnHealthy.length ? 'warn' : undefined },
  ];
}

// The rule: book-wide problems first (currency above half, drift above ten points), then a pair above
// 0.7, a name above a quarter, a position above one day of volume; otherwise nothing.
function thresholdRule(item) {
  const topPair = Math.max(0, ...(item.pairCorrelations ?? []).map((pair) => pair.correlation));
  const slowest = Math.max(0, ...item.holdings.map((holding) => holding.daysOfAverageVolume ?? 0));
  if ((item.heldOutsideTheClientsCurrencyPercent ?? 0) > 50) return 'CURRENCY';
  if (largestDrift(item) > 10) return 'DRIFT';
  if (topPair > 0.7) return 'CORRELATION';
  if (item.largestHoldingPercent > 25) return 'CONCENTRATION';
  if (slowest > 1) return 'LIQUIDITY';
  return 'NONE';
}

function baselines({ graded, right, ruleRight, stats }) {
  const total = graded.length;
  if (!total) return [];
  const majority = Math.round((stats?.majorityBaseline ?? 0) * total);
  return [
    { label: 'Jev', detail: 'main risk named, all portfolios', value: right.length / total, display: `${right.length} of ${total}`, model: true },
    { label: 'Rule: the house thresholds, in order', detail: 'currency over 50%, drift over 10 points, a pair over 0.7, a name over 25%, a position over one day of volume', value: ruleRight.length / total, display: `${ruleRight.length} of ${total}` },
    { label: 'Always the commonest answer', detail: readable(stats?.majorityClass ?? 'none'), value: majority / total, display: `${majority} of ${total}` },
  ];
}

function checks(graded, byItem, labels) {
  return RISKS.filter((risk) => risk !== 'NONE').map((risk) => {
    const group = labels.filter((label) => label.plantedRisk === risk);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.portfolioId);
      return !result || result.evaluation.risk !== risk;
    });
    return { id: risk.toLowerCase(), label: `${sentence(risk)} not named`, detail: questions.main_risk.criteria[risk], count: missed.length, of: group.length, items: missed.map((label) => label.portfolioId) };
  }).concat([{
    id: 'healthy',
    label: 'Healthy portfolios given a problem',
    detail: 'At plan, spread out, liquid, and in the client’s own currency.',
    count: graded.filter((result) => byItem.get(result.item.id).plantedRisk === 'NONE' && result.evaluation.flagged).length,
    of: labels.filter((label) => label.plantedRisk === 'NONE').length,
    items: graded.filter((result) => byItem.get(result.item.id).plantedRisk === 'NONE' && result.evaluation.flagged).map((result) => result.item.id),
  }]);
}

function distribution(results) {
  return ACTIONS
    .map((action) => ({ label: sentence(action), count: results.filter((result) => result.evaluation.action === action).length, tone: action === 'HOLD' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Risk named against the problem the portfolio was built to carry',
    rowLabel: 'the problem the portfolio was built to carry',
    columnLabel: 'the risk the model named',
    columns: RISKS.map(sentence),
    rows: RISKS.map((actual) => ({
      label: sentence(actual),
      cells: RISKS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).plantedRisk === actual && result.evaluation.risk === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, withRisk) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const raised = graded.filter((result) => result.evaluation.severity >= bar);
    const real = raised.filter((result) => byItem.get(result.item.id).plantedRisk !== 'NONE');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: raised.length, caught: real.length, rate: raised.length ? Number((real.length / raised.length).toFixed(3)) : null };
  });
  return { title: 'Severity and what it raises with the client', xLabel: 'Portfolios raised at this severity or above', yLabel: 'Portfolios that really have a problem', rateLabel: 'Share of those raised that do', of: withRisk.length, points, thresholdFormat: 'level', levels: 6, defaultIndex: 4 };
}

function findings({ graded, byItem, healthy, right, sure, sureRight, ruleRight }) {
  const lines = [];
  const unsure = graded.filter((result) => !sure.includes(result));
  const unsureWrong = unsure.filter((result) => !right.includes(result));
  if (unsureWrong.length >= 2 && sureRight.length === sure.length && unsureWrong.length === unsure.length) {
    lines.push(`Confidence separates the run cleanly: all ${sure.length} answers at 50% or above are right, and the ${unsure.length} below it are exactly the ${unsureWrong.length} wrong ones. Acting only above that line would have sent every mistake to the adviser.`);
  }
  if (ruleRight.length > right.length) {
    const ruleMissed = [...new Set(graded.filter((result) => !ruleRight.includes(result)).map((result) => readable(byItem.get(result.item.id).plantedRisk)))];
    const why = ruleMissed.length === 1 && ruleMissed[0] === 'liquidity' ? ' The rule misses only the liquidity portfolios, whose planted positions sit under the one-day line written in the state.' : ruleMissed.length ? ` The rule misses: ${ruleMissed.join(', ')}.` : '';
    lines.push(`A short rule over the house thresholds names ${ruleRight.length} of ${graded.length}, against ${right.length} for the model.${why}`);
  }
  if (graded.length >= 10 && graded.every((result) => result.evaluation.nameOnly)) {
    lines.push(`"Diversified in name only" was answered yes on all ${graded.length} portfolios, so spotting the correlation books with it proves nothing. The action and the objective questions have no labels and are not graded.`);
  }

  const wrong =graded.filter((result) => byItem.get(result.item.id).plantedRisk !== 'NONE' && result.evaluation.risk !== byItem.get(result.item.id).plantedRisk);
  const groups = new Map();
  for (const result of wrong) {
    const key = `${byItem.get(result.item.id).plantedRisk}|${result.evaluation.risk}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const worst = [...groups].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) {
    const [actual, predicted] = worst[0].split('|');
    lines.push(`${worst[1]} portfolios built around ${readable(actual)} were read as ${readable(predicted)}. Both are in the file on purpose, and telling them apart is most of the job.`);
  }

  const flaggedHealthy = healthy.filter((result) => result.evaluation.flagged);
  if (flaggedHealthy.length >= 2) lines.push(`${flaggedHealthy.length} of the ${healthy.length} healthy portfolios were given a problem: ${flaggedHealthy.map((result) => `${result.item.id} (${readable(result.evaluation.risk)})`).join(', ')}. A portfolio at plan with nothing large in it is allowed to be dull.`);

  const holds = graded.filter((result) => result.evaluation.flagged && result.evaluation.action === 'HOLD');
  if (holds.length >= 3) lines.push(`${holds.length} portfolios were given a risk and then told to hold. Naming a problem and proposing nothing is the one answer a client cannot use.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .filter((result) => result.evaluation.flagged)
    .sort((left, right) => right.evaluation.severity - left.evaluation.severity || right.evaluation.valueAtRisk - left.evaluation.valueAtRisk)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.plantedRisk === result.evaluation.risk ? ' · agrees' : ''}`,
      value: money(result.evaluation.valueAtRisk),
    }));
}

const PLANTED_NOTES = {
  CONCENTRATION: 'Planted as concentration: one name at 39–48% of the book.',
  CORRELATION: 'Planted as correlation: three holdings from one group, top pair above 0.7.',
  LIQUIDITY: 'Planted as liquidity, but the position is under one day of volume, which the state itself says is fine.',
  CURRENCY: 'Planted as currency: the client spends in another currency and nothing here is held in it.',
  DRIFT: 'Planted as drift: equity about thirty points away from the agreed allocation.',
  NONE: 'Planted as healthy: at plan, spread out, liquid and in the client’s own currency.',
};

const level = (question, value) => `${question.criteria[Math.round(value)] ?? '–'} · ${value.toFixed(1)} of ${question.criteria.length - 1}`;
const yesNo = (noulValue) => `${noulValue >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(noulValue, 1 - noulValue) * 100)}%`;

/** Right means the named risk is the planted one, healthy portfolios included, as the headline counts it. */
function judge(result, label) {
  if (!label) return null;
  return {
    agree: result.evaluation.risk === label.plantedRisk,
    expected: label.plantedRisk,
    got: result.evaluation.risk,
    note: PLANTED_NOTES[label.plantedRisk],
    confidence: result.answers.main_risk.confidence,
  };
}

function verdict(result) {
  const { evaluation, answers, item } = result;
  const sure = evaluation.confidence >= ACT_ABOVE;
  const facts = [
    { label: 'How serious', value: level(questions.severity, evaluation.severity), tone: evaluation.severity >= 4 ? 'bad' : evaluation.severity >= 2.5 ? 'warn' : 'good' },
    { label: 'Confidence in the risk', value: `${Math.round(evaluation.confidence * 100)}%${sure ? '' : ' · below 50%, hand to the adviser'}`, tone: sure ? 'good' : 'warn' },
    { label: 'Still does what the client asked', value: yesNo(answers.fits_objective.noul), tone: evaluation.fits ? 'good' : 'warn' },
    { label: 'Diversified in name only', value: yesNo(answers.diversified_in_name_only.noul), tone: evaluation.nameOnly ? 'warn' : 'good' },
  ];
  if (evaluation.flagged) facts.splice(1, 0, { label: 'Money behind it', value: `${money(evaluation.valueAtRisk)} of ${money(item.totalValueUsd)}` });

  return {
    eyebrow: 'What the adviser is told',
    headline: evaluation.flagged ? `${sentence(evaluation.risk)} · ${readable(evaluation.action)}` : `Nothing to raise · ${readable(evaluation.action)}`,
    facts,
  };
}

export default {
  id: 'portfolio-health',
  title: 'Portfolio health',
  domain: 'portfolio',
  value: 'Hand over a list of holdings and get back the problem, graded, with what to do about it.',
  tags: ['portfolio', 'risk', 'advice', 'real prices'],
  dataClass: 'mixed',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${money(item.totalValueUsd)} · ${item.holdingCount} holdings · ${item.objectiveId}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/portfolio-health.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  caveat: 'The adviser note in each portfolio is worded differently for each planted problem, so this run cannot show the risk was read from the holdings alone; the planted liquidity positions also sit under the one-day line the state calls acceptable.',
  stage: {
    hide: ['objectiveId', 'holdingCount', 'price', 'name'],
    labels: {
      clientSpendsIn: 'Client spends in',
      totalValueUsd: 'Total value',
      heldOutsideTheClientsCurrencyPercent: 'Held outside the client’s currency (%)',
      largestHoldingPercent: 'Largest holding (%)',
      pairCorrelations: 'Most correlated pairs',
      daysOfAverageVolume: 'Days of its own volume',
      worstFallPercent: 'Worst fall (%)',
      twelveMonthReturnPercent: '12-month return (%)',
    },
    highlight: ['largestHoldingPercent', 'heldOutsideTheClientsCurrencyPercent', 'clientSpendsIn'],
  },
  grade: { labelId: (label) => label.portfolioId, judge },
  verdict,
  present: {
    number: 141,
    problem: {
      headline: 'A holdings list does not say what is wrong with it. An adviser has to find the one risk worth a conversation.',
      stat: '24',
      statLabel: 'portfolios, each built to carry one problem or none',
    },
    hero: {
      item: 'PF-01',
      caption: 'Nothing here is oversized or drifting. The client spends in dirhams and 91% of the book, about $378M, is in dollars with no hedge.',
    },
    answers: {
      caption: 'The risk is named at 99% confidence, graded serious at 4.2 of 6, and the action is to hedge rather than sell.',
      reveal: ['main_risk', 'severity', 'action'],
    },
    miss: {
      item: 'PF-04',
      caption: 'A portfolio built to be healthy was called concentrated, at 23% confidence. All five healthy books were given a problem.',
    },
    proof: {
      kpis: ['Main risk right', 'Right when it was sure', 'Healthy portfolios left alone'],
      chart: 'calibration',
      closing: '16 answers at 50% confidence or above, all 16 right; the 8 below the line are the 8 it got wrong.',
    },
  },
  explain: {
    data: 'scripts/generate/portfolio-health.js#demo:data',
    state: 'demos/portfolio-health/demo.js#demo:state',
    questions: 'demos/portfolio-health/demo.js#demo:questions',
    evaluate: 'demos/portfolio-health/demo.js#demo:evaluate',
  },
};
