// Screening for a goal: sixteen real companies and funds against six goals written in plain words.
// There is no ground truth here — nobody can label the right answer to "does this suit what I want" —
// so the report grades consistency instead: does the reading change with the brief, and does every
// disqualifier match a number on the page.

import { choice, noul, score } from '../lib/questions.js';
import { percent } from '../lib/metrics.js';

const DISQUALIFIERS = ['LEVERAGE', 'LIQUIDITY', 'EARNINGS_QUALITY', 'VALUATION', 'VOLATILITY', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());

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
    distributionTitle: 'What ruled them out',
    matrix: goalMatrix(graded),
    curve: coverage(graded),
    baselines: baselines(graded),
    metrics: metrics(graded),
    checks: checks(graded),
    topItems: topItems(graded),
    topItemsTitle: 'Best fits that were shortlisted',
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

/** The readings that name a reason the file can be checked against. NONE and VALUATION have no number to check. */
const CHECKABLE = new Set(['LEVERAGE', 'LIQUIDITY', 'EARNINGS_QUALITY', 'VOLATILITY']);
const namesReason = (result) => CHECKABLE.has(result.evaluation.disqualifier);
const reasonSupported = (result) => SUPPORTED[result.evaluation.disqualifier](result.item);

/** A shortlisted reading should name no disqualifier, and a reading with none should be shortlisted. */
const selfConsistent = (result) => result.evaluation.shortlisted === (result.evaluation.disqualifier === 'NONE');

function kpis(graded, bySymbol) {
  const moved = [...bySymbol.values()].filter((group) => spread(group.map((result) => result.evaluation.fit)) >= 1.5);
  const named = graded.filter(namesReason);
  const supported = named.filter(reasonSupported);
  const noStatements = graded.filter((result) => result.item.statementYears === 0);
  const saidSo = noStatements.filter((result) => !result.evaluation.dataSufficient);
  const withStatements = graded.filter((result) => result.item.statementYears > 0);
  const saidNoAnyway = withStatements.filter((result) => !result.evaluation.dataSufficient);
  const shortlisted = graded.filter((result) => result.evaluation.shortlisted);
  const consistent = graded.filter(selfConsistent);
  // Saying "not enough" to most files that do have statements means the 24 of 24 proves little.
  const saysNoToMost = saidNoAnyway.length > withStatements.length / 2;

  return [
    { label: 'Named disqualifiers the numbers support', value: `${supported.length} of ${named.length}`, context: `${percent(named.length ? supported.length / named.length : null)} of the readings that name a reason, against a deliberately strict bar; "none" is not counted as supported`, tone: supported.length >= named.length * 0.8 ? 'good' : 'warn' },
    { label: 'Companies read differently by goal', value: `${moved.length} of ${bySymbol.size}`, context: 'a fit score that moves by at least a point and a half across the six briefs; briefs this far apart make it an easy bar', tone: moved.length === bySymbol.size ? undefined : 'warn' },
    { label: 'Missing statements admitted', value: `${saidSo.length} of ${noStatements.length}`, context: `funds and commodities with no statements at all; ${saidNoAnyway.length} of ${withStatements.length} readings that do have statements also said not enough`, tone: saidSo.length < noStatements.length || saysNoToMost ? 'warn' : 'good' },
    { label: 'Shortlisted', value: `${shortlisted.length} of ${graded.length}`, context: `${new Set(shortlisted.map((result) => result.item.symbol)).size} different companies across the six goals` },
    { label: 'Shortlist and reason agree', value: `${consistent.length} of ${graded.length}`, context: 'shortlisted with nothing ruling it out, or left off with a reason named', tone: consistent.length >= graded.length * 0.95 ? 'good' : 'warn' },
  ];
}

/** Always naming volatility, scored on the same readings with the same bars. */
const alwaysVolatility = (item) => SUPPORTED.VOLATILITY(item);

function baselines(graded) {
  const named = graded.filter(namesReason);
  if (!named.length) return undefined;
  const supported = named.filter(reasonSupported);
  const volatile = named.filter((result) => alwaysVolatility(result.item));
  return [
    { label: 'Jev', detail: 'the reason it named clears the bar in the file', value: supported.length / named.length, display: `${supported.length} of ${named.length}`, model: true },
    { label: 'Always say volatility', detail: 'the commonest reason, given to the same readings', value: volatile.length / named.length, display: `${volatile.length} of ${named.length}` },
  ];
}

function metrics(graded) {
  const named = graded.filter(namesReason);
  const supported = named.filter(reasonSupported);
  const share = named.length ? supported.length / named.length : null;
  return {
    headline: { label: 'Named disqualifiers the numbers support', value: share ?? 0, n: named.length },
    accuracy: share,
    contradictionRate: graded.length ? graded.filter((result) => !selfConsistent(result)).length / graded.length : null,
  };
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
    rowLabel: 'the company or fund',
    columnLabel: 'the goal it was shortlisted for',
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
  return {
    title: 'Fit score against what was actually shortlisted',
    xLabel: 'Readings at this fit or above',
    yLabel: 'Of those, the ones shortlisted',
    rateLabel: 'Share shortlisted',
    of: graded.filter((result) => result.evaluation.shortlisted).length,
    thresholdFormat: 'level',
    levels: 6,
    defaultIndex: 3,
    points,
  };
}

function findings(graded, bySymbol) {
  const lines = [];
  const flat = [...bySymbol.entries()].filter(([, group]) => spread(group.map((result) => result.evaluation.fit)) < 1);
  if (flat.length) lines.push(`${flat.length} companies scored within a point across all six goals: ${flat.map(([symbol]) => symbol).join(', ')}. A brief that does not change the answer has not been read.`);

  const named = graded.filter(namesReason);
  const unsupported = named.filter((result) => !reasonSupported(result));
  if (unsupported.length >= 3) {
    const kinds = [...new Set(unsupported.map((result) => readable(result.evaluation.disqualifier)))];
    lines.push(`${unsupported.length} of ${named.length} readings that name a disqualifier name one the file does not support: ${kinds.join(', ')}. The reason has to be in the numbers, not in the reputation.`);
  }

  const volatile = named.filter((result) => alwaysVolatility(result.item));
  if (named.length && volatile.length >= named.length - unsupported.length) {
    lines.push(`Naming volatility every time would have cleared the bar on ${volatile.length} of those ${named.length} readings, against ${named.length - unsupported.length} for the model. The bar is one fixed number and the goals are not, so part of the shortfall is the bar.`);
  }

  const noStatements = graded.filter((result) => result.item.statementYears === 0);
  const confident = noStatements.filter((result) => result.evaluation.dataSufficient);
  if (noStatements.length) lines.push(`${confident.length} of ${noStatements.length} readings of instruments with no statements at all still said the data was sufficient.`);

  const withStatements = graded.filter((result) => result.item.statementYears > 0);
  const saidNoAnyway = withStatements.filter((result) => !result.evaluation.dataSufficient);
  if (saidNoAnyway.length > withStatements.length / 2) {
    lines.push(`${saidNoAnyway.length} of ${withStatements.length} readings with statements on file also said the data was not enough. A question answered no almost everywhere does not tell the two kinds of file apart.`);
  }

  const crossed = graded.filter((result) => !selfConsistent(result));
  const listedAnyway = crossed.filter((result) => result.evaluation.shortlisted);
  if (crossed.length) lines.push(`${listedAnyway.length} readings were shortlisted while naming a disqualifier, and ${crossed.length - listedAnyway.length} named none yet were left off the list.`);

  const nearHalf = graded.filter((result) => Math.abs(result.answers.shortlist.noul - 0.5) <= 0.1);
  if (nearHalf.length) lines.push(`${nearHalf.length} of ${graded.length} shortlist answers sit within ten points of the line, so that many could flip on a second run.`);
  return lines;
}

function topItems(graded) {
  return [...graded]
    .filter((result) => result.evaluation.shortlisted)
    .sort((left, right) => right.evaluation.fit - left.evaluation.fit)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.fit.toFixed(1)} of 6` }));
}

// The number in the file that each checkable disqualifier is held against, as a person would read it.
const EVIDENCE = {
  LEVERAGE: (item) => `debt ${item.debtToAssetsPercent ?? '–'}% of assets against a 30% bar`,
  VOLATILITY: (item) => `volatility ${item.volatilityPercent.toFixed(1)}% a year against a 25% bar`,
  LIQUIDITY: (item) => `${item.averageDailyVolume.toLocaleString('en-US')} shares a day against a 3,000,000 bar`,
  EARNINGS_QUALITY: () => 'operating cash flow against a bar of 5% of revenue',
};

const asPercent = (value) => `${Math.round(value * 100)}%`;

/** A yes/no answer with the weight behind whichever side it landed on. */
const yesNo = (value) => (value >= 0.5 ? `Yes · ${asPercent(value)}` : `No · ${asPercent(1 - value)}`);

/** No labels. A reading that names a checkable reason is graded on whether the file supports it. */
const grade = {
  judge: (result) => {
    if (!namesReason(result)) return null;
    const { disqualifier } = result.evaluation;
    const agree = reasonSupported(result);
    return {
      agree,
      expected: agree ? sentence(disqualifier) : 'A reason the file supports',
      got: sentence(disqualifier),
      note: `Checked on the page, not against a label: ${EVIDENCE[disqualifier](result.item)}.`,
      confidence: result.answers.disqualifier.confidence,
    };
  },
};

function verdict(result) {
  const { item, answers, evaluation } = result;
  const ruledOut = evaluation.disqualifier !== 'NONE';
  const facts = [
    { label: 'Ruled out by', value: ruledOut ? `${sentence(evaluation.disqualifier)} · ${asPercent(answers.disqualifier.confidence)}` : 'Nothing', tone: ruledOut ? 'bad' : 'good' },
  ];
  if (namesReason(result)) {
    const supported = reasonSupported(result);
    facts.push({ label: 'The file supports that reason', value: `${supported ? 'Yes' : 'No'} · ${EVIDENCE[evaluation.disqualifier](item)}`, tone: supported ? 'good' : 'warn' });
  }
  facts.push({ label: 'Shortlist answer', value: yesNo(answers.shortlist.noul), tone: selfConsistent(result) ? undefined : 'warn' });
  facts.push({ label: 'Evidence claimed', value: `${answers.evidence_strength.legend?.[Math.round(evaluation.evidence)] ?? 'Score'} · ${evaluation.evidence.toFixed(1)} of 6` });
  facts.push({ label: 'Statements enough to judge', value: yesNo(answers.data_sufficient.noul), tone: item.statementYears === 0 && evaluation.dataSufficient ? 'bad' : undefined });

  const crossed = evaluation.shortlisted ? 'Shortlisted even though a disqualifier was named.' : 'Left off the list although nothing was said to rule it out.';
  return {
    eyebrow: `${item.symbol} read for "${item.goalId}"`,
    headline: `${evaluation.shortlisted ? 'Shortlisted' : 'Not shortlisted'} · fit ${evaluation.fit.toFixed(1)} of 6`,
    detail: selfConsistent(result) ? undefined : crossed,
    facts,
  };
}

const stage = {
  hide: ['symbol', 'goalId', 'sharesOutstanding', 'statementYears'],
  labels: {
    goalBrief: 'The goal, as written',
    revenueGrowthPercent: 'Revenue growth % a year, over the years on file',
    debtToAssetsPercent: 'Debt as % of assets',
    volatilityPercent: 'Volatility % a year',
    worstFallPercent: 'Worst fall in three years %',
    twelveMonthReturnPercent: 'Twelve-month return %',
    threeYearReturnPercent: 'Three-year return %',
    averageDailyVolume: 'Shares traded a day',
    priceAsOf: 'Price as of',
    annualStatements: 'Annual statements on file',
  },
  highlight: ['volatilityPercent', 'worstFallPercent', 'debtToAssetsPercent', 'dividendsPaid'],
};

const present = {
  number: 161,
  problem: {
    headline: 'A goal arrives as a sentence. A screener wants numbers. Somebody has to read one against the other.',
    stat: '96',
    statLabel: 'readings: sixteen instruments against six briefs',
  },
  hero: {
    item: 'NVDA-income-now',
    caption: 'NVDA read for "I need income now": fit 1.4 of 6, ruled out by volatility. The file agrees: 38.0% a year against a 25% bar.',
  },
  answers: {
    caption: 'Five typed answers: a fit score, the one thing that rules it out, a shortlist call, and how far the file can be trusted.',
    reveal: ['fit_to_goal', 'disqualifier', 'shortlist', 'data_sufficient'],
  },
  miss: {
    item: 'JPM-preserve',
    caption: 'JPM for money that cannot be lost: volatility named at 22.1% a year. A fair call for that brief, and under the 25% bar, so it counts as unsupported.',
  },
  proof: {
    kpis: ['Named disqualifiers the numbers support', 'Shortlist and reason agree', 'Shortlisted'],
    chart: 'baselines',
    closing: '26 of 56 stated reasons clear a strict numeric bar. That is the number the next version has to beat.',
  },
};

export default {
  id: 'goal-screening',
  title: 'Screening for a goal',
  domain: 'screening',
  value: 'Say the goal in plain words, and get candidates judged against it with the reason each one made or missed the list.',
  tags: ['screening', 'fundamentals', 'real data', 'goals'],
  dataClass: 'cached-real',
  readMinutes: 4,
  view: 'table',
  stage,
  grade,
  verdict,
  present,
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
