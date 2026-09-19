// A Sharia screen is two things stacked: a judgement about what a business does, and arithmetic about
// what it owns. The arithmetic is checkable, so this demo checks it — every ratio the model is asked
// about is computed here too, and the report puts the two numbers side by side. The judgement about
// the business is not checkable, and the report says which items it is not grading and why.
//
// The rule sets are written for this demo from published standards, simplified. They are not any
// standards body's text, and nothing here is a fatwa or a compliance opinion.

import { choice, noul } from '../lib/questions.js';

const VERDICTS = ['PASS', 'FAIL', 'NEEDS_REVIEW'];

const pct = (part, whole) => (typeof part === 'number' && typeof whole === 'number' && whole ? (part / whole) * 100 : null);
const show = (value) => (value === null ? 'not in the data' : `${value.toFixed(1)}%`);
const share = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(0)}%` : '–');
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');

// #region demo:state
/** The business, the balance sheet as filed, and the rule set. No ratios: working them out is the task. */
function buildState(item, context) {
  return {
    task: 'Screen this company against the rule set below. Work out each ratio yourself from the lines given, and compare it with the limit.',
    rule_set: {
      name: item.standardName,
      denominator_to_use: item.denominatorName,
      denominator_value: item.denominator,
      debt_limit_percent: item.debtLimitPercent,
      cash_and_interest_bearing_securities_limit_percent: item.liquidAssetsLimitPercent,
      receivables_limit_percent: item.receivablesLimitPercent,
      impure_income_limit_percent: item.impureIncomeLimitPercent,
    },
    activity_screen: context.activityScreen,
    company: { symbol: item.symbol, sector: item.sector, industry: item.industry, what_it_does: item.business },
    balance_sheet: {
      fiscal_year_end: item.fiscalYearEnd,
      revenue: item.revenue,
      total_assets: item.totalAssets,
      total_debt: item.totalDebt,
      cash_and_short_term_investments: item.cashAndSecurities,
      accounts_receivable: item.receivables,
      interest_income: item.interestIncome,
      interest_expense: item.interestExpense,
      market_capitalisation: item.marketCap,
    },
    note: 'A line that is null is not on file. Saying so is a valid answer and a better one than guessing.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  activity_compliant: noul('Does what this business does pass the activity screen?', {
    yes: 'Its revenue does not come from anything the screen prohibits.',
    no: 'Its main business, or a material part of it, is on the prohibited list.',
  }),
  debt_ratio_pass: noul('Is interest-bearing debt inside the limit for this rule set?', {
    yes: 'Debt over the stated denominator is below the limit.',
    no: 'It is at or above the limit, or the lines needed to work it out are not on file.',
  }),
  interest_securities_pass: noul('Are cash and interest-bearing securities inside the limit?', {
    yes: 'Cash and short-term investments over the denominator are below the limit.',
    no: 'They are at or above it, or the lines are not there.',
  }),
  receivables_pass: noul('Are receivables inside the limit?', {
    yes: 'Accounts receivable over the denominator are below the limit.',
    no: 'They are at or above it, or the line is missing.',
  }),
  impure_income_band: choice('How much of revenue is income from interest?', {
    UNDER_3: 'Under three per cent of revenue.',
    THREE_TO_FIVE: 'Between three and five per cent.',
    OVER_5: 'Above five per cent of revenue.',
    NOT_IN_THE_DATA: 'The statements on file do not break this out.',
  }),
  verdict: choice('What is the verdict under this rule set?', {
    PASS: 'It clears the activity screen and every ratio limit.',
    FAIL: 'At least one screen is failed outright.',
    NEEDS_REVIEW: 'A person has to decide: the data is incomplete, or the activity question is a judgement.',
  }),
};
// #endregion

// #region demo:evaluate
/** The model's three pass/fail calls beside the same three ratios computed here from the filed lines. */
function evaluate(answers, item) {
  const ratios = compute(item);
  const said = {
    debt: answers.debt_ratio_pass.noul >= 0.5,
    liquid: answers.interest_securities_pass.noul >= 0.5,
    receivables: answers.receivables_pass.noul >= 0.5,
  };
  const agrees = RATIOS.map(({ key }) => [key, ratios[key].pass === null ? null : ratios[key].pass === said[key]]);

  return {
    said,
    ratios,
    agrees: Object.fromEntries(agrees),
    activityCompliant: answers.activity_compliant.noul >= 0.5,
    band: answers.impure_income_band.choice,
    verdict: answers.verdict.choice,
    confidence: answers.verdict.confidence,
    consistent: consistent(answers.verdict.choice, said, answers.activity_compliant.noul >= 0.5),
    label: `${item.symbol} · ${item.standardId} · ${readable(answers.verdict.choice)}`,
  };
}
// #endregion

const RATIOS = [
  { key: 'debt', line: 'totalDebt', limit: 'debtLimitPercent', title: 'Debt' },
  { key: 'liquid', line: 'cashAndSecurities', limit: 'liquidAssetsLimitPercent', title: 'Cash and interest-bearing securities' },
  { key: 'receivables', line: 'receivables', limit: 'receivablesLimitPercent', title: 'Receivables' },
];

/** The demo's own arithmetic: the ratio, the limit it is measured against, and whether it clears it. */
function compute(item) {
  const entries = RATIOS.map(({ key, line, limit }) => {
    const value = pct(item[line], item.denominator);
    return [key, { value: value === null ? null : Number(value.toFixed(2)), limit: item[limit], pass: value === null ? null : value < item[limit] }];
  });
  const impure = pct(item.interestIncome, item.revenue);
  return { ...Object.fromEntries(entries), impure: impure === null ? null : Number(impure.toFixed(2)), band: bandFor(impure) };
}

const bandFor = (value) => (value === null ? 'NOT_IN_THE_DATA' : value < 3 ? 'UNDER_3' : value <= 5 ? 'THREE_TO_FIVE' : 'OVER_5');

/** A verdict has to follow from the answers given beside it, whatever the right answer turns out to be. */
function consistent(verdict, said, activity) {
  const allClear = said.debt && said.liquid && said.receivables && activity;
  if (verdict === 'PASS') return allClear;
  if (verdict === 'FAIL') return !allClear;
  return true;
}

/** Which businesses the activity screen answers on its own, and which are a judgement call. */
const ACTIVITY = {
  JPM: false, BAC: false, SPY: null, 'BTC-USD': null, WMT: null, PEP: null,
  NVDA: true, MSFT: true, AAPL: true, XOM: true, CVX: true, KO: true, PG: true, JNJ: true, GLD: true, XLE: true,
};

// #region demo:report
/** Arithmetic first: where the model's ratio calls and the demo's own calculation disagree. */
function report(results, context = {}) {
  const graded = results.filter((result) => result.evaluation);
  const calls = graded
    .flatMap((result) => RATIOS.map(({ key }) => ({ result, key, agrees: result.evaluation.agrees[key] })))
    .filter((call) => call.agrees !== null);

  return {
    note: `Forty-eight screenings: sixteen instruments against three rule sets. ${context.note ?? ''}`,
    findings: findings(graded, calls),
    kpis: kpis(graded, calls),
    distribution: distribution(graded),
    matrix: standardMatrix(graded),
    curve: coverage(graded, calls),
    checks: checks(graded, calls),
    topItems: topItems(graded),
  };
}
// #endregion

/** What a business does cannot change with the rule set, so an answer that moves is wrong twice over. */
function activitySplits(graded) {
  const bySymbol = new Map();
  for (const result of graded) bySymbol.set(result.item.symbol, [...(bySymbol.get(result.item.symbol) ?? []), result]);
  return [...bySymbol.entries()]
    .filter(([, group]) => new Set(group.map((result) => result.evaluation.activityCompliant)).size > 1)
    .map(([symbol, group]) => ({ symbol, group }));
}

function kpis(graded, calls) {
  const right = calls.filter((call) => call.agrees);
  const missing = graded.flatMap((result) => RATIOS.filter(({ key }) => result.evaluation.ratios[key].pass === null).map(({ key }) => ({ result, key })));
  const admitted = missing.filter(({ result, key }) => !result.evaluation.said[key]);
  const bands = graded.filter((result) => result.evaluation.band === result.evaluation.ratios.band);
  const judgements = graded.filter((result) => ACTIVITY[result.item.symbol] === null);
  const banks = graded.filter((result) => ACTIVITY[result.item.symbol] === false);
  const caught = banks.filter((result) => !result.evaluation.activityCompliant);

  return [
    { label: 'Ratio calls that match the arithmetic', value: `${right.length} of ${calls.length}`, context: 'debt, liquid assets and receivables, worked out here from the same filed lines', tone: right.length === calls.length ? 'good' : 'warn' },
    { label: 'Interest income band', value: `${bands.length} of ${graded.length}`, context: 'the band named matches interest income over revenue', tone: bands.length >= graded.length * 0.9 ? 'good' : 'warn' },
    { label: 'Missing lines admitted', value: `${admitted.length} of ${missing.length}`, context: 'ratios that cannot be computed because a line is not on file', tone: admitted.length === missing.length ? 'good' : 'warn' },
    { label: 'Conventional banks refused', value: `${caught.length} of ${banks.length}`, context: 'the one activity answer the screen states outright' },
    { label: 'Same business, same activity answer', value: `${16 - activitySplits(graded).length} of 16`, context: 'the activity screen is identical in all three rule sets, so its answer should be too', tone: activitySplits(graded).length ? 'warn' : 'good' },
    { label: 'Verdicts that follow their own answers', value: share(graded.filter((result) => result.evaluation.consistent).length, graded.length), context: 'a pass needs every screen it reported to have passed' },
    { label: 'Sent to a person', value: `${graded.filter((result) => result.evaluation.verdict === 'NEEDS_REVIEW').length} of ${graded.length}`, context: `${judgements.length} of these are activity questions this demo does not grade` },
  ];
}

function distribution(graded) {
  return VERDICTS
    .map((verdict) => ({
      label: readable(verdict).replace(/^./, (letter) => letter.toUpperCase()),
      count: graded.filter((result) => result.evaluation.verdict === verdict).length,
      tone: verdict === 'PASS' ? 'good' : verdict === 'FAIL' ? 'warn' : undefined,
    }))
    .filter((entry) => entry.count);
}

function checks(graded, calls) {
  const wrong = calls.filter((call) => !call.agrees);
  const byRatio = RATIOS.map(({ key, title }) => {
    const group = calls.filter((call) => call.key === key);
    const bad = group.filter((call) => !call.agrees);
    return { id: key, label: `${title} read wrongly against the limit`, detail: 'Computed here as the filed line over the denominator the rule set names.', count: bad.length, of: group.length, items: bad.slice(0, 20).map((call) => call.result.item.id) };
  });

  const bandWrong = graded.filter((result) => result.evaluation.band !== result.evaluation.ratios.band);
  const inconsistent = graded.filter((result) => !result.evaluation.consistent);
  return byRatio.concat([
    { id: 'band', label: 'Interest income band named wrongly', detail: 'Interest income over revenue, where both are on file.', count: bandWrong.length, of: graded.length, items: bandWrong.slice(0, 20).map((result) => result.item.id) },
    { id: 'activity', label: 'Activity answered differently for the same business', detail: 'The prohibited-activity list is word for word the same in all three rule sets.', count: activitySplits(graded).length, of: new Set(graded.map((result) => result.item.symbol)).size, items: activitySplits(graded).flatMap(({ group }) => group.map((result) => result.item.id)).slice(0, 20) },
    { id: 'verdict', label: 'Verdict that contradicts its own screens', detail: 'A pass with a failed screen beside it, or a fail with none.', count: inconsistent.length, of: graded.length, items: inconsistent.slice(0, 20).map((result) => result.item.id) },
    { id: 'overall', label: 'Every ratio call on the page', detail: 'All three ratios across all forty-eight screenings, where the lines exist.', count: wrong.length, of: calls.length, items: wrong.slice(0, 20).map((call) => call.result.item.id) },
  ]);
}

function standardMatrix(graded) {
  const standards = [...new Set(graded.map((result) => result.item.standardId))];
  return {
    title: 'Verdict by rule set',
    columns: VERDICTS.map(readable),
    rows: standards.map((standardId) => ({
      label: graded.find((result) => result.item.standardId === standardId).item.standardName,
      cells: VERDICTS.map((verdict) => ({
        predicted: verdict,
        count: graded.filter((result) => result.item.standardId === standardId && result.evaluation.verdict === verdict).length,
        diagonal: false,
      })),
    })),
  };
}

function coverage(graded, calls) {
  const points = Array.from({ length: 6 }, (_, step) => {
    const threshold = 0.5 + step * 0.1;
    const ids = new Set(graded.filter((result) => result.evaluation.confidence >= threshold).map((result) => result.item.id));
    const mine = calls.filter((call) => ids.has(call.result.item.id));
    const right = mine.filter((call) => call.agrees);
    return { threshold: Number(threshold.toFixed(2)), reviewed: mine.length, caught: right.length, rate: mine.length ? Number((right.length / mine.length).toFixed(3)) : null };
  });
  return { title: 'Ratio calls that hold up, by how sure the verdict was', xLabel: 'Calls made at this confidence or above', yLabel: 'Calls that match the arithmetic', rateLabel: 'Share that match', of: calls.length, points };
}

function findings(graded, calls) {
  const lines = [];
  const wrong = calls.filter((call) => !call.agrees);
  if (wrong.length) {
    const named = wrong.map((call) => `${call.result.item.symbol} ${call.key} (${show(call.result.evaluation.ratios[call.key].value)} against ${call.result.evaluation.ratios[call.key].limit}%)`);
    lines.push(`${wrong.length} ratio calls disagree with the same sum done here: ${[...new Set(named)].slice(0, 4).join(', ')}.`);
  }

  const bySymbol = new Map();
  for (const result of graded) bySymbol.set(result.item.symbol, [...(bySymbol.get(result.item.symbol) ?? []), result]);
  const split = [...bySymbol.entries()].filter(([, group]) => new Set(group.map((result) => result.evaluation.verdict)).size > 1);
  if (split.length) lines.push(`${split.length} of ${bySymbol.size} instruments get a different verdict depending on the rule set: ${split.slice(0, 5).map(([symbol]) => symbol).join(', ')}. The screen is the answer as much as the company is.`);

  const splits = activitySplits(graded);
  if (splits.length) lines.push(`${splits.map(({ symbol }) => symbol).join(', ')} got a different answer about what the business does depending on which ratio standard was in front of it. The activity list is the same words in all three.`);

  const judgements = graded.filter((result) => ACTIVITY[result.item.symbol] === null);
  const decided = judgements.filter((result) => result.evaluation.verdict !== 'NEEDS_REVIEW');
  if (decided.length) lines.push(`${decided.length} of ${judgements.length} screenings of businesses that only touch a prohibited activity were decided outright rather than sent to a person. Whether that is right is a scholar's call, not this demo's.`);
  return lines;
}

function topItems(graded) {
  return [...graded]
    .filter((result) => result.evaluation.verdict !== 'PASS')
    .sort((left, right) => right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `debt ${show(result.evaluation.ratios.debt.value)}` }));
}

export default {
  id: 'sharia-screen',
  title: 'Sharia screening, three rule sets',
  domain: 'screening',
  value: 'Run the same company through three named rule sets and watch the verdict change with the standard, with every ratio shown beside the demo’s own sum.',
  tags: ['screening', 'fundamentals', 'real data', 'rules'],
  dataClass: 'cached-real',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.symbol} · ${item.standardId}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/sharia-screen.js#demo:data',
    state: 'demos/sharia-screen/demo.js#demo:state',
    questions: 'demos/sharia-screen/demo.js#demo:questions',
    evaluate: 'demos/sharia-screen/demo.js#demo:evaluate',
  },
};
