// Portfolio health: twenty-four books of holdings, each carrying one problem or none. The weights are
// invented; every price, volatility, volume and correlation behind them is real and cached, so the
// numbers the answer is judged against are numbers somebody could check.

import { choice, noul, score } from '../lib/questions.js';

const RISKS = ['CONCENTRATION', 'CORRELATION', 'LIQUIDITY', 'CURRENCY', 'DRIFT', 'NONE'];
const ACTIONS = ['HOLD', 'TRIM', 'HEDGE', 'REBALANCE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

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

// #region demo:evaluate
/** One portfolio's verdict, and the money sitting behind whatever it is worried about. */
function evaluate(answers, item) {
  const risk = answers.main_risk.choice;
  const worst = [...item.holdings].sort((left, right) => right.weightPercent - left.weightPercent)[0];

  return {
    risk,
    severity: answers.severity.score,
    action: answers.action.choice,
    fits: answers.fits_objective.noul >= 0.5,
    nameOnly: answers.diversified_in_name_only.noul >= 0.5,
    confidence: answers.main_risk.confidence,
    flagged: risk !== 'NONE',
    valueAtRisk: risk === 'NONE' ? 0 : Math.round((worst.weightPercent / 100) * item.totalValueUsd),
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

  return {
    note: `Twenty-four portfolios, ${withRisk.length} built to carry one problem each and ${healthy.length} built to carry none. ${context.note ?? ''}`,
    findings: findings(graded, byItem, healthy),
    kpis: kpis({ graded, withRisk, healthy, named, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, withRisk),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

function kpis({ graded, withRisk, healthy, named, byItem }) {
  const flaggedHealthy = healthy.filter((result) => result.evaluation.flagged);
  const fitsWrong = graded.filter((result) => result.evaluation.fits === (byItem.get(result.item.id).plantedRisk !== 'NONE'));
  const correlation = graded.filter((result) => byItem.get(result.item.id).plantedRisk === 'CORRELATION');
  const sawTheBet = correlation.filter((result) => result.evaluation.nameOnly);
  const actions = graded.filter((result) => result.evaluation.action !== 'HOLD');

  return [
    { label: 'Risk named exactly', value: `${named.length} of ${withRisk.length}`, context: 'one planted problem per portfolio, named from six', tone: named.length === withRisk.length ? 'good' : 'warn' },
    { label: 'Healthy portfolios left alone', value: `${healthy.length - flaggedHealthy.length} of ${healthy.length}`, context: flaggedHealthy.length ? `${flaggedHealthy.length} given a problem they do not have` : 'none flagged', tone: flaggedHealthy.length ? 'warn' : 'good' },
    { label: 'Diversified in name only, spotted', value: `${sawTheBet.length} of ${correlation.length}`, context: 'the portfolios whose holdings are one bet in three costumes' },
    { label: 'Objective read correctly', value: share(graded.length - fitsWrong.length, graded.length), context: 'whether the portfolio still does what the client asked' },
    { label: 'Something to do', value: `${actions.length} of ${graded.length}`, context: 'trim, hedge or rebalance rather than hold' },
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
  return { title: 'Severity and what it raises with the client', xLabel: 'Portfolios raised at this severity or above', yLabel: 'Portfolios that really have a problem', rateLabel: 'Share of those raised that do', of: withRisk.length, points };
}

function findings(graded, byItem, healthy) {
  const lines = [];
  const wrong = graded.filter((result) => byItem.get(result.item.id).plantedRisk !== 'NONE' && result.evaluation.risk !== byItem.get(result.item.id).plantedRisk);
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
  explain: {
    data: 'scripts/generate/portfolio-health.js#demo:data',
    state: 'demos/portfolio-health/demo.js#demo:state',
    questions: 'demos/portfolio-health/demo.js#demo:questions',
    evaluate: 'demos/portfolio-health/demo.js#demo:evaluate',
  },
};
