// A Sharia screen is two things stacked: a judgement about what a business does, and arithmetic about
// what it owns. The arithmetic is checkable, so this demo checks it — every ratio the model is asked
// about is computed here too, and the report puts the two numbers side by side. The judgement about
// the business is not checkable, and the report says which items it is not grading and why.
//
// The rule sets are written for this demo from published standards, simplified. They are not any
// standards body's text, and nothing here is a fatwa or a compliance opinion.

import { choice, noul } from '../lib/questions.js';
import { matrixStats } from '../lib/metrics.js';

const VERDICTS = ['PASS', 'FAIL', 'NEEDS_REVIEW'];

const pct = (part, whole) => (typeof part === 'number' && typeof whole === 'number' && whole ? (part / whole) * 100 : null);
const show = (value) => (value === null ? 'not in the data' : `${value.toFixed(1)}%`);
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
  { key: 'debt', line: 'totalDebt', limit: 'debtLimitPercent', title: 'Debt', question: 'debt_ratio_pass' },
  { key: 'liquid', line: 'cashAndSecurities', limit: 'liquidAssetsLimitPercent', title: 'Cash and interest-bearing securities', question: 'interest_securities_pass' },
  { key: 'receivables', line: 'receivables', limit: 'receivablesLimitPercent', title: 'Receivables', question: 'receivables_pass' },
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

/** How much weight a yes/no answer put on the side it landed on, 0.5 to 1. */
const sureness = (value) => Math.max(value, 1 - value);

/**
 * The verdict the arithmetic gives, where the activity screen states its answer outright. A failed
 * screen fails it, a missing line sends it to a person, and a judgement about the business is not graded.
 */
function expectedVerdict(item, ratios) {
  const activity = ACTIVITY[item.symbol];
  if (activity === null || activity === undefined) return null;
  if (activity === false) return 'FAIL';
  const screens = RATIOS.map(({ key }) => ratios[key].pass);
  const impureInside = ratios.impure === null ? null : ratios.impure < item.impureIncomeLimitPercent;
  if (screens.includes(false) || impureInside === false) return 'FAIL';
  if (screens.includes(null) || impureInside === null) return 'NEEDS_REVIEW';
  return 'PASS';
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

  const matrix = verdictMatrix(graded);
  return {
    note: `Forty-eight screenings: sixteen instruments against three rule sets. ${context.note ?? ''}`,
    findings: findings(graded, calls),
    kpis: kpis(graded, calls),
    distribution: distribution(graded),
    distributionTitle: 'Verdicts given',
    baselines: baselines(graded),
    matrix,
    curve: coverage(calls),
    metrics: metrics(graded, calls, matrix),
    verdictsByRuleSet: verdictsByRuleSet(graded),
    checks: checks(graded, calls),
    topItems: topItems(graded),
    topItemsTitle: 'Not passed, surest first',
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

/** The screenings with at least one ratio the page can work out, and the ones where every such call was right. */
const gradeable = (graded) => graded.filter((result) => Object.values(result.evaluation.agrees).some((agrees) => agrees !== null));
const everyCallRight = (result) => Object.values(result.evaluation.agrees).every((agrees) => agrees !== false);

/** A call the model got wrong is either a false pass (said inside, is outside) or a false fail. */
const falsePass = (call) => !call.agrees && call.result.evaluation.said[call.key];

function verdictGrades(graded) {
  return graded
    .map((result) => ({ result, expected: expectedVerdict(result.item, result.evaluation.ratios) }))
    .filter((entry) => entry.expected !== null);
}

function kpis(graded, calls) {
  const right = calls.filter((call) => call.agrees);
  const wrong = calls.filter((call) => !call.agrees);
  const falsePasses = wrong.filter(falsePass);
  const screenings = gradeable(graded);
  const clean = screenings.filter(everyCallRight);
  const verdicts = verdictGrades(graded);
  const verdictsRight = verdicts.filter(({ result, expected }) => result.evaluation.verdict === expected);
  const banks = graded.filter((result) => ACTIVITY[result.item.symbol] === false);
  const caught = banks.filter((result) => !result.evaluation.activityCompliant);
  const symbols = new Set(graded.map((result) => result.item.symbol)).size;
  const splits = activitySplits(graded).length;

  return [
    { label: 'Screenings with every ratio call right', value: `${clean.length} of ${screenings.length}`, context: 'debt, liquid assets and receivables all read the way the sum on the page reads them', tone: clean.length === screenings.length ? 'good' : 'warn' },
    { label: 'Ratio calls that match the arithmetic', value: `${right.length} of ${calls.length}`, context: `worked out here from the same filed lines; ${falsePasses.length} false passes and ${wrong.length - falsePasses.length} false fails`, tone: right.length === calls.length ? 'good' : 'warn' },
    { label: 'Verdict matches the arithmetic', value: `${verdictsRight.length} of ${verdicts.length}`, context: 'where the activity screen states its answer outright, the filed lines decide the verdict', tone: verdictsRight.length === verdicts.length ? 'good' : 'warn' },
    { label: 'Same business, same activity answer', value: `${symbols - splits} of ${symbols}`, context: 'the activity screen is identical in all three rule sets, so its answer should be too', tone: splits ? 'warn' : 'good' },
    { label: 'Conventional banks refused', value: `${caught.length} of ${banks.length}`, context: 'the one activity answer the screen states outright', tone: caught.length === banks.length ? 'good' : 'warn' },
  ];
}

/** Rule: say every ratio is inside its limit. Most are, for large companies, so this is the bar to clear. */
const alwaysInside = (result) => RATIOS.every(({ key }) => result.evaluation.ratios[key].pass !== false);

function baselines(graded) {
  const screenings = gradeable(graded);
  if (!screenings.length) return undefined;
  const clean = screenings.filter(everyCallRight);
  const inside = screenings.filter(alwaysInside);
  const row = (count) => ({ value: count / screenings.length, display: `${count} of ${screenings.length}` });
  return [
    { label: 'Jev', detail: 'every ratio call in the screening matches the sum', model: true, ...row(clean.length) },
    { label: 'Rule: divide the line by the denominator', detail: 'the three lines of arithmetic this page grades against, so right by construction', ...row(screenings.length) },
    { label: 'Always say inside the limit', detail: 'no reading at all', ...row(inside.length) },
  ];
}

function metrics(graded, calls, matrix) {
  const screenings = gradeable(graded);
  const clean = screenings.filter(everyCallRight);
  const stats = matrixStats(matrix);
  const share = screenings.length ? clean.length / screenings.length : null;
  return {
    headline: { label: 'Screenings with every ratio call right', value: share ?? 0, n: screenings.length },
    accuracy: share,
    ratioCallAccuracy: calls.length ? calls.filter((call) => call.agrees).length / calls.length : null,
    verdictAccuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    contradictionRate: graded.length ? graded.filter((result) => !result.evaluation.consistent).length / graded.length : null,
  };
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
  const missing = graded.flatMap((result) => RATIOS.filter(({ key }) => result.evaluation.ratios[key].pass === null).map(({ key }) => ({ result, key })));
  const claimed = missing.filter(({ result, key }) => result.evaluation.said[key]);
  return byRatio.concat([
    { id: 'missing', label: 'Ratio called inside the limit with its line not on file', detail: 'The question folds a missing line into "no", so a "no" here may be a default rather than an admission.', count: claimed.length, of: missing.length, items: [...new Set(claimed.map(({ result }) => result.item.id))].slice(0, 20) },
    { id: 'band', label: 'Interest income band named wrongly', detail: 'Interest income over revenue, where both are on file.', count: bandWrong.length, of: graded.length, items: bandWrong.slice(0, 20).map((result) => result.item.id) },
    { id: 'activity', label: 'Activity answered differently for the same business', detail: 'The prohibited-activity list is word for word the same in all three rule sets.', count: activitySplits(graded).length, of: new Set(graded.map((result) => result.item.symbol)).size, items: activitySplits(graded).flatMap(({ group }) => group.map((result) => result.item.id)).slice(0, 20) },
    { id: 'verdict', label: 'Verdict that contradicts its own screens', detail: 'A pass with a failed screen beside it, or a fail with none.', count: inconsistent.length, of: graded.length, items: inconsistent.slice(0, 20).map((result) => result.item.id) },
    { id: 'overall', label: 'Every ratio call on the page', detail: 'All three ratios across all forty-eight screenings, where the lines exist.', count: wrong.length, of: calls.length, items: wrong.slice(0, 20).map((call) => call.result.item.id) },
  ]);
}

/** The verdict the filed lines give against the verdict the model gave, where the first can be worked out. */
function verdictMatrix(graded) {
  const verdicts = verdictGrades(graded);
  return {
    title: 'Verdict the arithmetic gives against the verdict given',
    rowLabel: 'the verdict the filed lines and the rule set give',
    columnLabel: 'the verdict the model gave',
    columns: VERDICTS.map(readable),
    rows: VERDICTS.map((expected) => ({
      label: readable(expected),
      cells: VERDICTS.map((given) => {
        const cell = verdicts.filter((entry) => entry.expected === expected && entry.result.evaluation.verdict === given);
        return { predicted: given, count: cell.length, diagonal: expected === given, items: cell.slice(0, 20).map((entry) => entry.result.item.id) };
      }),
    })),
  };
}

/** How the forty-eight verdicts fall under each rule set: the comparison the demo is named for. */
function verdictsByRuleSet(graded) {
  const standards = [...new Set(graded.map((result) => result.item.standardId))];
  return standards.map((standardId) => {
    const group = graded.filter((result) => result.item.standardId === standardId);
    const count = (verdict) => group.filter((result) => result.evaluation.verdict === verdict).length;
    return { ruleSet: group[0].item.standardName, pass: count('PASS'), fail: count('FAIL'), needsReview: count('NEEDS_REVIEW') };
  });
}

/** Each ratio call at the weight its own yes/no carried, not the weight of the verdict beside it. */
function coverage(calls) {
  const weightOf = (call) => sureness(call.result.answers[RATIOS.find(({ key }) => key === call.key).question].noul);
  const points = [0.5, 0.55, 0.6, 0.7, 0.8, 0.9].map((threshold) => {
    const mine = calls.filter((call) => weightOf(call) >= threshold);
    const right = mine.filter((call) => call.agrees);
    return { threshold, reviewed: mine.length, caught: right.length, rate: mine.length ? Number((right.length / mine.length).toFixed(3)) : null };
  });
  return { title: 'Ratio calls that hold up, by how sure each call was', xLabel: 'Calls made at this weight or above', yLabel: 'Calls that match the arithmetic', rateLabel: 'Share that match', of: calls.length, defaultIndex: 2, points };
}

function findings(graded, calls) {
  const lines = [];
  const wrong = calls.filter((call) => !call.agrees);
  if (wrong.length) {
    const named = wrong.map((call) => `${call.result.item.symbol} ${call.key} (${show(call.result.evaluation.ratios[call.key].value)} against ${call.result.evaluation.ratios[call.key].limit}%)`);
    lines.push(`${wrong.length} ratio calls disagree with the same sum done here: ${[...new Set(named)].slice(0, 4).join(', ')}.`);
  }

  const falsePasses = wrong.filter(falsePass);
  if (wrong.length) lines.push(`${falsePasses.length} of the misses are false passes, the costly error in a compliance screen, and ${wrong.length - falsePasses.length} are false fails.`);

  const inside = calls.filter((call) => call.result.evaluation.ratios[call.key].pass);
  if (calls.length) lines.push(`Saying "inside the limit" every time would match ${inside.length} of ${calls.length} calls, because most ratios of large companies are nowhere near a limit. The model matches ${calls.length - wrong.length}. Dividing the line by the denominator in code matches all of them, and that is what the page does.`);

  const near = calls.filter((call) => Math.abs(call.result.evaluation.ratios[call.key].value - call.result.evaluation.ratios[call.key].limit) <= 5);
  if (near.length) lines.push(`${near.filter((call) => call.agrees).length} of the ${near.length} calls within five points of their limit are right. That is where a screen is decided, and there are too few of them here to say more.`);

  const verdictSure = (bar) => calls.filter((call) => call.result.evaluation.confidence >= bar);
  const atHalf = verdictSure(0.5);
  const atNine = verdictSure(0.9);
  if (atHalf.length && atNine.length) {
    lines.push(`A confident verdict does not mean careful arithmetic: ${atHalf.filter((call) => call.agrees).length} of ${atHalf.length} calls match where the verdict is at least 50% sure, and ${atNine.filter((call) => call.agrees).length} of ${atNine.length} where it is at least 90% sure. The curve below uses each call's own weight instead.`);
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
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: bindingRatio(result.evaluation.ratios) }));
}

const SHORT = { debt: 'debt', liquid: 'liquid assets', receivables: 'receivables' };

/** The ratio closest to, or furthest over, its limit: the one that decides the screen. */
function bindingRatio(ratios) {
  const computed = RATIOS.filter(({ key }) => ratios[key].value !== null);
  if (!computed.length) return 'no lines on file';
  const tightest = computed.reduce((worst, entry) => (ratios[entry.key].value / ratios[entry.key].limit > ratios[worst.key].value / ratios[worst.key].limit ? entry : worst));
  return `${SHORT[tightest.key]} ${show(ratios[tightest.key].value)} against ${ratios[tightest.key].limit}%`;
}

const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const insideOrOutside = (pass) => (pass ? 'inside' : 'outside');
const BAND_TEXT = { UNDER_3: 'under 3%', THREE_TO_FIVE: '3% to 5%', OVER_5: 'over 5%', NOT_IN_THE_DATA: 'not in the data' };

/** No labels: a screening is right when every ratio call it made matches the sum done on the page. */
const grade = {
  judge: (result) => {
    const { ratios, said, agrees } = result.evaluation;
    const checked = RATIOS.filter(({ key }) => agrees[key] !== null);
    if (!checked.length) return null;
    const missed = checked.filter(({ key }) => !agrees[key]);
    const describe = (source) => checked.map(({ key }) => `${SHORT[key]} ${insideOrOutside(source(key))}`).join(', ');
    const note = missed.length
      ? `Worked out on the page from the filed lines: ${missed.map(({ key }) => `${SHORT[key]} at ${show(ratios[key].value)} of the denominator against a ${ratios[key].limit}% limit, where the model said ${insideOrOutside(said[key])}`).join('; ')}.`
      : 'Every ratio call matches the sum done on the page from the same filed lines.';
    return {
      agree: missed.length === 0,
      expected: describe((key) => ratios[key].pass),
      got: describe((key) => said[key]),
      note,
      // The least sure of the calls being graded: a screening is only as firm as its shakiest ratio.
      confidence: Math.min(...checked.map(({ question }) => sureness(result.answers[question].noul))),
    };
  },
};

function ratioFact({ key, title }, evaluation) {
  const ratio = evaluation.ratios[key];
  const saidText = `model said ${insideOrOutside(evaluation.said[key])}`;
  if (ratio.value === null) return { label: title, value: `line not on file · ${saidText}`, tone: evaluation.said[key] ? 'bad' : undefined };
  return { label: title, value: `${show(ratio.value)} against a ${ratio.limit}% limit · ${saidText}`, tone: evaluation.agrees[key] ? 'good' : 'bad' };
}

function verdict(result) {
  const { item, answers, evaluation } = result;
  const expected = expectedVerdict(item, evaluation.ratios);
  const bandRight = evaluation.band === evaluation.ratios.band;
  const facts = RATIOS.map((ratio) => ratioFact(ratio, evaluation));
  facts.push({ label: 'Interest income', value: `${evaluation.ratios.impure === null ? 'not on file' : `${show(evaluation.ratios.impure)} of revenue`} · band named: ${BAND_TEXT[evaluation.band]}`, tone: bandRight ? 'good' : 'bad' });
  facts.push({ label: 'Activity screen', value: `${evaluation.activityCompliant ? 'Passes' : 'Does not pass'} · ${Math.round(sureness(answers.activity_compliant.noul) * 100)}%` });
  facts.push(expected === null
    ? { label: 'Verdict the arithmetic gives', value: 'Not graded: the activity question is a judgement' }
    : { label: 'Verdict the arithmetic gives', value: sentence(expected), tone: expected === evaluation.verdict ? 'good' : 'bad' });

  return {
    eyebrow: `${item.symbol} under the ${item.standardName.toLowerCase()}`,
    headline: `${sentence(evaluation.verdict)} · ${Math.round(evaluation.confidence * 100)}%`,
    detail: evaluation.consistent ? `Every ratio is measured against ${item.denominatorName.split(',')[0]}.` : 'This verdict contradicts the screens reported beside it.',
    facts,
  };
}

const stage = {
  hide: ['symbol', 'standardId', 'price', 'priceAsOf'],
  labels: {
    standardName: 'Rule set',
    business: 'What the business does',
    cashAndSecurities: 'Cash and short-term investments',
    receivables: 'Accounts receivable',
    marketCap: 'Market capitalisation',
    denominator: 'Denominator for this rule set',
    denominatorName: 'What the denominator is',
    debtLimitPercent: 'Debt limit %',
    liquidAssetsLimitPercent: 'Cash and securities limit %',
    receivablesLimitPercent: 'Receivables limit %',
    impureIncomeLimitPercent: 'Interest income limit %',
  },
  highlight: ['totalDebt', 'cashAndSecurities', 'receivables', 'denominator'],
};

const present = {
  number: 163,
  problem: {
    headline: 'One balance sheet, three rule sets. The verdict depends on which ruler is held against it.',
    stat: '48',
    statLabel: 'screenings: sixteen instruments under three rule sets',
  },
  hero: {
    item: 'KO-total-assets',
    caption: 'Coca-Cola owes 12.0% of its market value and passes that standard. Against total assets the same debt is 43.4%, over the 33% limit, and it fails.',
  },
  answers: {
    caption: 'No ratio is sent. Each yes or no is a division the model did itself, and the page does the same division beside it.',
    reveal: ['debt_ratio_pass', 'interest_securities_pass', 'receivables_pass', 'verdict'],
  },
  miss: {
    item: 'NVDA-house',
    caption: 'The model said cash and securities were inside the house limit. The sum on the page is 30.3% of total assets against 25%: a false pass.',
  },
  proof: {
    kpis: ['Screenings with every ratio call right', 'Ratio calls that match the arithmetic', 'Verdict matches the arithmetic'],
    chart: 'curve',
    closing: '98 of 105 ratio calls match the arithmetic, and 4 of 16 companies change verdict with the rule set.',
  },
};

export default {
  id: 'sharia-screen',
  title: 'Sharia screening, three rule sets',
  domain: 'screening',
  value: 'Run the same company through three named rule sets and watch the verdict change with the standard, with every ratio shown beside the demo’s own sum.',
  tags: ['screening', 'fundamentals', 'real data', 'rules'],
  dataClass: 'cached-real',
  readMinutes: 4,
  view: 'table',
  stage,
  grade,
  verdict,
  present,
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
