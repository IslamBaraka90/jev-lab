// Screening for a goal: sixteen real companies and funds against six goals written in plain words.
// There is no ground truth here — nobody can label the right answer to "does this suit what I want" —
// so the report grades consistency instead: does the reading change with the brief, and does every
// disqualifier match a number on the page.

import { choice, noul, score } from '../lib/questions.js';

const DISQUALIFIERS = ['LEVERAGE', 'LIQUIDITY', 'EARNINGS_QUALITY', 'VALUATION', 'VOLATILITY', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());

const share = (part, whole) => {
  if (!whole) return '–';
  const value = (part / whole) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

// #region demo:state
/** One company's own numbers, and the goal it is being read against. Nothing about the others. */
function buildState(item, context) {
  return {
    task: 'Read this company against the goal below and say how well it fits, what would disqualify it, and whether the statements are enough to tell.',
    goal: item.goalBrief,
    how_to_read_this: context.howToRead,
    company: {
      symbol: item.symbol,
      sector: item.sector,
      industry: item.industry,
      years_of_statements_on_file: item.statementYears,
    },
    latest_year: {
      revenue: item.revenue,
      revenue_growth_percent_a_year: item.revenueGrowthPercent,
      gross_margin_percent: item.grossMarginPercent,
      operating_margin_percent: item.operatingMarginPercent,
      net_margin_percent: item.netMarginPercent,
      total_assets: item.totalAssets,
      total_debt: item.totalDebt,
      debt_to_assets_percent: item.debtToAssetsPercent,
      cash: item.cash,
      operating_cash_flow: item.operatingCashFlow,
      free_cash_flow: item.freeCashFlow,
      dividends_paid: item.dividendsPaid,
    },
    price_behaviour: {
      price: item.price,
      as_of: item.priceAsOf,
      twelve_month_return_percent: item.twelveMonthReturnPercent,
      three_year_return_percent: item.threeYearReturnPercent,
      volatility_percent: item.volatilityPercent,
      worst_fall_in_three_years_percent: item.worstFallPercent,
      average_daily_volume: item.averageDailyVolume,
    },
    annual_statements: item.annualStatements,
  };
}
// #endregion

// #region demo:questions
const questions = {
  fit_to_goal: score('How well does this fit the goal as written?', [
    'Unsuitable', 'Poor', 'Weak', 'Acceptable', 'Good', 'Very good', 'Ideal',
  ]),
  disqualifier: choice('What, if anything, rules it out for this goal?', {
    LEVERAGE: 'It owes too much for what this goal can carry.',
    LIQUIDITY: 'It cannot be sold quickly enough, or its cash position is too thin.',
    EARNINGS_QUALITY: 'The profits do not arrive as cash, or do not arrive reliably.',
    VALUATION: 'Whatever the business is, the price asks too much of it.',
    VOLATILITY: 'It moves more than this goal can tolerate.',
    NONE: 'Nothing rules it out.',
  }),
  shortlist: noul('Would you put it on the shortlist for this goal?', {
    yes: 'It belongs in front of whoever wrote the brief.',
    no: 'It does not belong on this list.',
  }),
  evidence_strength: score('How strong is the evidence for that reading?', [
    'None', 'Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Conclusive',
  ]),
  data_sufficient: noul('Are the statements on file enough to judge this?', {
    yes: 'What is here answers the question the goal asks.',
    no: 'Too much is missing to say either way.',
  }),
};
// #endregion

// #region demo:evaluate
/** One reading of one company against one goal. */
function evaluate(answers, item) {
  return {
    fit: answers.fit_to_goal.score,
    disqualifier: answers.disqualifier.choice,
    shortlisted: answers.shortlist.noul >= 0.5,
    evidence: answers.evidence_strength.score,
    dataSufficient: answers.data_sufficient.noul >= 0.5,
    confidence: answers.disqualifier.confidence,
    symbol: item.symbol,
    goalId: item.goalId,
    label: `${item.symbol} for "${item.goalId}" · fit ${answers.fit_to_goal.score.toFixed(1)}${answers.disqualifier.choice === 'NONE' ? '' : ` · ${readable(answers.disqualifier.choice)}`}`,
  };
}
// #endregion

// #region demo:report
/** No labels anywhere: what is graded is consistency, and whether the reasons match the numbers. */
function report(results, context = {}) {
  const graded = results.filter((result) => result.evaluation);
  const bySymbol = new Map();
  for (const result of graded) {
    bySymbol.set(result.item.symbol, [...(bySymbol.get(result.item.symbol) ?? []), result]);
  }

  return {
    note: `Ninety-six readings: sixteen companies against six goals. ${context.note ?? ''}`,
    findings: findings(graded, bySymbol),
    kpis: kpis(graded, bySymbol),
    distribution: distribution(graded),
    matrix: goalMatrix(graded),
    curve: coverage(graded),
    checks: checks(graded),
    topItems: topItems(graded),
  };
}
// #endregion

const spread = (values) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

/** Whether each disqualifier is supported by a number in this company's own file. */
const SUPPORTED = {
  LEVERAGE: (item) => item.debtToAssetsPercent !== null && item.debtToAssetsPercent > 30,
  VOLATILITY: (item) => item.volatilityPercent > 25,
  LIQUIDITY: (item) => item.averageDailyVolume < 3_000_000 || (item.cash !== null && item.totalAssets !== null && item.cash / item.totalAssets < 0.03),
  EARNINGS_QUALITY: (item) => item.operatingCashFlow !== null && item.netMarginPercent !== null && item.operatingCashFlow < (item.revenue ?? 0) * 0.05,
  VALUATION: () => true,
  NONE: () => true,
};

function kpis(graded, bySymbol) {
  const moved = [...bySymbol.values()].filter((group) => spread(group.map((result) => result.evaluation.fit)) >= 1.5);
  const supported = graded.filter((result) => SUPPORTED[result.evaluation.disqualifier](result.item));
  const noStatements = graded.filter((result) => result.item.statementYears === 0);
  const saidSo = noStatements.filter((result) => !result.evaluation.dataSufficient);
  const shortlisted = graded.filter((result) => result.evaluation.shortlisted);

  return [
    { label: 'Companies read differently by goal', value: `${moved.length} of ${bySymbol.size}`, context: 'a fit score that moves by at least a point and a half across the six briefs', tone: moved.length === bySymbol.size ? 'good' : 'warn' },
    { label: 'Disqualifiers the numbers support', value: share(supported.length, graded.length), context: `${supported.length} of ${graded.length} readings, checked against this company's own file` },
    { label: 'Missing statements admitted', value: `${saidSo.length} of ${noStatements.length}`, context: 'funds and commodities with no statements at all', tone: saidSo.length === noStatements.length ? 'good' : 'warn' },
    { label: 'Shortlisted', value: `${shortlisted.length} of ${graded.length}`, context: `${new Set(shortlisted.map((result) => result.item.symbol)).size} different companies across the six goals` },
    { label: 'Evidence claimed', value: `${average(graded.map((result) => result.evaluation.evidence)).toFixed(1)} of 6`, context: 'how strong the reading says its own evidence is' },
  ];
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function checks(graded) {
  const unsupported = (disqualifier) => graded.filter((result) => result.evaluation.disqualifier === disqualifier && !SUPPORTED[disqualifier](result.item));
  return DISQUALIFIERS.filter((entry) => entry !== 'NONE' && entry !== 'VALUATION').map((disqualifier) => {
    const claimed = graded.filter((result) => result.evaluation.disqualifier === disqualifier);
    const bad = unsupported(disqualifier);
    return {
      id: disqualifier.toLowerCase().replaceAll('_', '-'),
      label: `${sentence(disqualifier)} claimed without a number behind it`,
      detail: questions.disqualifier.criteria[disqualifier],
      count: bad.length,
      of: claimed.length,
      items: bad.slice(0, 20).map((result) => result.item.id),
    };
  }).concat([{
    id: 'no-statements',
    label: 'Judged confidently with no statements on file',
    detail: 'Funds and commodities have no revenue, margins or cash flow to read.',
    count: graded.filter((result) => result.item.statementYears === 0 && result.evaluation.dataSufficient).length,
    of: graded.filter((result) => result.item.statementYears === 0).length,
    items: graded.filter((result) => result.item.statementYears === 0 && result.evaluation.dataSufficient).slice(0, 20).map((result) => result.item.id),
  }]);
}

function distribution(graded) {
  return DISQUALIFIERS
    .map((disqualifier) => ({ label: sentence(disqualifier), count: graded.filter((result) => result.evaluation.disqualifier === disqualifier).length, tone: disqualifier === 'NONE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

/** Which companies were shortlisted for which goal: the output somebody actually wanted. */
function goalMatrix(graded) {
  const goals = [...new Set(graded.map((result) => result.item.goalId))];
  const symbols = [...new Set(graded.map((result) => result.item.symbol))];
  return {
    title: 'Shortlisted for each goal',
    columns: goals,
    rows: symbols.map((symbol) => ({
      label: symbol,
      cells: goals.map((goal) => {
        const entry = graded.find((result) => result.item.symbol === symbol && result.item.goalId === goal);
        return { predicted: goal, count: entry?.evaluation.shortlisted ? 1 : 0, diagonal: Boolean(entry?.evaluation.shortlisted) };
      }),
    })),
  };
}

function coverage(graded) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const above = graded.filter((result) => result.evaluation.fit >= bar);
    const shortlisted = above.filter((result) => result.evaluation.shortlisted);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: above.length, caught: shortlisted.length, rate: above.length ? Number((shortlisted.length / above.length).toFixed(3)) : null };
  });
  return { title: 'Fit score against what was actually shortlisted', xLabel: 'Readings at this fit or above', yLabel: 'Of those, the ones shortlisted', rateLabel: 'Share shortlisted', of: graded.filter((result) => result.evaluation.shortlisted).length, points };
}

function findings(graded, bySymbol) {
  const lines = [];
  const flat = [...bySymbol.entries()].filter(([, group]) => spread(group.map((result) => result.evaluation.fit)) < 1);
  if (flat.length) lines.push(`${flat.length} companies scored within a point across all six goals: ${flat.map(([symbol]) => symbol).join(', ')}. A brief that does not change the answer has not been read.`);

  const unsupported = graded.filter((result) => !SUPPORTED[result.evaluation.disqualifier](result.item));
  if (unsupported.length >= 3) {
    const kinds = [...new Set(unsupported.map((result) => readable(result.evaluation.disqualifier)))];
    lines.push(`${unsupported.length} readings name a disqualifier the file does not support: ${kinds.join(', ')}. The reason has to be in the numbers, not in the reputation.`);
  }

  const noStatements = graded.filter((result) => result.item.statementYears === 0);
  const confident = noStatements.filter((result) => result.evaluation.dataSufficient);
  if (noStatements.length) lines.push(`${confident.length} of ${noStatements.length} readings of instruments with no statements at all still said the data was sufficient.`);
  return lines;
}

function topItems(graded) {
  return [...graded]
    .filter((result) => result.evaluation.shortlisted)
    .sort((left, right) => right.evaluation.fit - left.evaluation.fit)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.fit.toFixed(1)} of 6` }));
}

export default {
  id: 'goal-screening',
  title: 'Screening for a goal',
  domain: 'screening',
  value: 'Say the goal in plain words, and get candidates judged against it with the reason each one made or missed the list.',
  tags: ['screening', 'fundamentals', 'real data', 'goals'],
  dataClass: 'cached-real',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.symbol} · ${item.goalId}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/goal-screening.js#demo:data',
    state: 'demos/goal-screening/demo.js#demo:state',
    questions: 'demos/goal-screening/demo.js#demo:questions',
    evaluate: 'demos/goal-screening/demo.js#demo:evaluate',
  },
};
