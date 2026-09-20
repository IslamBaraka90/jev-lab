import { choice, noul, score } from '../lib/questions.js';
import { computedRatios } from '../../src/services/ratios.js';

const QUALITIES = ['CASH_BACKED', 'MIXED', 'ACCRUAL_HEAVY'];
const DIRECTIONS = ['IMPROVING', 'STABLE', 'DETERIORATING'];
const GAPS = ['NONE', 'MISSING_CASH_FLOW', 'MISSING_BALANCE_SHEET', 'SHORT_HISTORY'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';
const value = (number, digits = 2) => Number.isFinite(number) ? number.toFixed(digits) : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Read the supplied statements directly. Grade business quality, leverage, earnings quality and direction; report missing statement coverage explicitly. Do not assume that a fund or crypto instrument has issuer statements.',
    source_note: context.note, units_and_nulls: context.units, cache_coverage_note: context.coverage,
    company: { symbol: item.symbol, sector: item.sector, industry: item.industry, reporting_currency: item.currency, shares_outstanding_current: item.sharesOutstanding },
    statement_coverage: item.cacheCoverage,
    annual_statements_oldest_to_newest: item.annualStatements,
    quarterly_statements_oldest_to_newest: item.quarterlyStatements,
  };
}
// #endregion

// #region demo:questions
const questions = {
  quality: score('How strong is the company’s overall fundamental quality across the available history?', ['Very poor', 'Poor', 'Below average', 'Average', 'Good', 'Very good', 'Excellent']),
  leverage_risk: score('How risky is leverage from the supplied debt, cash, equity and operating evidence?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Severe']),
  earnings_quality: choice('How well are reported earnings backed by operating cash flow?', { CASH_BACKED: 'Operating cash flow broadly supports or exceeds reported earnings.', MIXED: 'Cash conversion is uneven or only partly supports earnings.', ACCRUAL_HEAVY: 'Reported earnings materially outrun operating cash flow.' }),
  direction: choice('What is the four-year direction of revenue and operating margin?', { IMPROVING: 'Revenue and operating economics are improving.', STABLE: 'Revenue and operating economics are broadly stable or mixed.', DETERIORATING: 'Revenue or operating economics are deteriorating.' }),
  capex_discipline: noul('Does operating cash flow consistently cover capital expenditure without an excessive latest-year burden?', { yes: 'Cash generation covers capital spending and the latest burden is proportionate.', no: 'Capital spending strains cash generation or is disproportionate.' }),
  statement_gap: choice('What is the most important gap in the cached statements?', { NONE: 'Four usable annual statements contain both cash-flow and balance-sheet lines.', MISSING_CASH_FLOW: 'Four years exist, but operating cash flow or capital expenditure is missing.', MISSING_BALANCE_SHEET: 'Four years exist, but debt, cash or equity is missing.', SHORT_HISTORY: 'Fewer than four usable annual statements are present.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    quality: answers.quality.score, leverageRisk: answers.leverage_risk.score,
    earningsQuality: answers.earnings_quality.choice, direction: answers.direction.choice,
    capexDisciplined: answers.capex_discipline.noul >= 0.5, statementGap: answers.statement_gap.choice,
    confidence: answers.quality.confidence,
    label: `${item.symbol} · quality ${answers.quality.score.toFixed(1)}/6 · leverage ${answers.leverage_risk.score.toFixed(1)}/6 · ${title(answers.direction.choice)}`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const rows = results.map((result) => ({ result, ratio: computedRatios(result.item) }));
  const complete = rows.filter((row) => row.ratio.complete);
  const withStatements = results.filter(hasStatements);
  return {
    note: `Sixteen cached symbols remain on the grid, including instruments without issuer statements. Computed ratios are report-only cross-checks and were not sent to Jev. ${context.note ?? ''}`,
    findings: findings(rows, complete),
    kpis: kpis(rows, complete),
    baselines: baselines(complete),
    metrics: metrics(complete),
    distribution: qualityDistribution(withStatements),
    distributionTitle: 'Quality scores, instruments with statements only',
    qualityGrid: { title: 'All symbols · quality against leverage risk', points: results.map((result) => ({ id: result.item.id, label: result.item.symbol, quality: result.evaluation.quality, leverage: result.evaluation.leverageRisk, gap: computedRatios(result.item).statementGap !== 'NONE' })) },
    ratioRows: ratioRows(rows),
    checks: checks(rows, complete),
    topItems: [...withStatements].sort((left, right) => right.evaluation.quality - left.evaluation.quality).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.quality.toFixed(1)} / 6` })),
    topItemsTitle: 'Highest quality scores',
  };
}
// #endregion

const LEVERAGE_BAND = 1.25;
const EARNINGS_CUT = 0.9;

/** Funds, gold and bitcoin file nothing. They are not graded and not counted as poor quality. */
const hasStatements = (result) => (result.item.annualStatements ?? []).length > 0;

/** The four cross-checks for one company whose ratios can be computed. */
function crossChecks({ result, ratio }) {
  const { evaluation } = result;
  return {
    earnings: evaluation.earningsQuality === ratio.earningsQuality,
    direction: evaluation.direction === ratio.direction,
    leverage: Math.abs(evaluation.leverageRisk - ratio.leverageScore) <= LEVERAGE_BAND,
    capex: evaluation.capexDisciplined === ratio.capexDiscipline,
  };
}

/** The two category readings are the ones a ratio settles by definition, so they decide right and wrong. */
const readAsComputed = (row) => crossChecks(row).earnings && crossChecks(row).direction;

const countOf = (complete, key) => complete.filter((row) => crossChecks(row)[key]).length;
const toneFor = (hits, total) => (hits === total ? 'good' : hits < total * 0.67 ? 'warn' : undefined);

function kpis(rows, complete) {
  const n = complete.length;
  const agreed = complete.filter(readAsComputed).length;
  const earnings = countOf(complete, 'earnings');
  const nearCut = complete.filter((row) => !crossChecks(row).earnings && Math.abs(row.ratio.cashConversion - EARNINGS_CUT) <= 0.05);
  const gapAgree = rows.filter((row) => row.result.evaluation.statementGap === row.ratio.statementGap).length;
  const incomplete = rows.filter((row) => row.ratio.statementGap !== 'NONE').length;
  return [
    { label: 'Companies read the way the ratios read them', value: `${agreed} of ${n}`, context: `earnings quality and direction both match the computed category; only ${n} of ${rows.length} instruments have complete statements, so one company moves this a long way`, tone: toneFor(agreed, n) },
    { label: 'Earnings-quality agreement', value: `${earnings} of ${n}`, context: `Jev category against four-year cash conversion${nearCut.length ? `; ${nearCut.length} of the misses sits within 0.05 of the ${EARNINGS_CUT.toFixed(2)} cut` : ''}`, tone: toneFor(earnings, n) },
    { label: 'Direction agreement', value: `${countOf(complete, 'direction')} of ${n}`, context: 'Jev direction against first-year to latest-year revenue and operating margin', tone: toneFor(countOf(complete, 'direction'), n) },
    { label: 'Leverage-band agreement', value: `${countOf(complete, 'leverage')} of ${n}`, context: `within ${LEVERAGE_BAND} points of a band computed from debt to equity and a net-debt proxy`, tone: toneFor(countOf(complete, 'leverage'), n) },
    { label: 'Statement gaps exact', value: `${gapAgree} of ${rows.length}`, context: `a lookup rather than a judgement: the rule is in the question and ${incomplete} instruments have incomplete histories`, tone: gapAgree === rows.length ? 'good' : 'warn' },
  ];
}

/** Rule: call every company cash-backed and improving, the commonest pair among these large companies. */
const COMMONEST = { earningsQuality: 'CASH_BACKED', direction: 'IMPROVING' };

function baselines(complete) {
  if (!complete.length) return undefined;
  const agreed = complete.filter(readAsComputed).length;
  const commonest = complete.filter((row) => row.ratio.earningsQuality === COMMONEST.earningsQuality && row.ratio.direction === COMMONEST.direction).length;
  const row = (count) => ({ value: count / complete.length, display: `${count} of ${complete.length}` });
  return [
    { label: 'Jev', detail: 'earnings quality and direction both match the computed category', model: true, ...row(agreed) },
    { label: 'Always cash-backed and improving', detail: 'the commonest pair, with no reading; the ratios themselves are the reference, so no rule is scored against them', ...row(commonest) },
  ];
}

function metrics(complete) {
  if (!complete.length) return undefined;
  const agreed = complete.filter(readAsComputed).length;
  const allChecks = ['earnings', 'direction', 'leverage', 'capex'].reduce((sum, key) => sum + countOf(complete, key), 0);
  return {
    headline: { label: 'Companies read the way the ratios read them', value: agreed / complete.length, n: complete.length },
    accuracy: agreed / complete.length,
    crossCheckAgreement: allChecks / (complete.length * 4),
  };
}

function qualityDistribution(results) {
  return Array.from({ length: 7 }, (_, bucket) => ({
    label: `${bucket}/6 · ${questions.quality.criteria[bucket]}`,
    count: results.filter((result) => Math.round(result.evaluation.quality) === bucket).length,
  })).filter((entry) => entry.count);
}

const disagrees = ({ result, ratio }) => ratio.complete && (result.evaluation.earningsQuality !== ratio.earningsQuality || result.evaluation.direction !== ratio.direction);

/** Disagreements first, then the companies that can be checked, then the ones that cannot. */
function ratioRows(rows) {
  const rank = (row) => (disagrees(row) ? 0 : row.ratio.complete ? 1 : 2);
  return [...rows].sort((left, right) => rank(left) - rank(right)).map(({ result, ratio }) => ({
    id: result.item.id,
    symbol: result.item.symbol,
    modelEarnings: title(result.evaluation.earningsQuality),
    computedEarnings: ratio.complete ? title(ratio.earningsQuality) : 'Not computable',
    modelDirection: title(result.evaluation.direction),
    computedDirection: ratio.complete ? title(ratio.direction) : 'Not computable',
    cashConversion: ratio.cashConversion,
    debtToEquity: ratio.debtToEquity,
    netDebtProxy: ratio.netDebtToEbitdaProxy,
    disagree: disagrees({ result, ratio }),
    gap: title(ratio.statementGap),
  }));
}

function checks(rows, complete) {
  const missed = (key) => complete.filter((row) => !crossChecks(row)[key]);
  const gapWrong = rows.filter((row) => row.result.evaluation.statementGap !== row.ratio.statementGap);
  const ids = (list) => list.map((row) => row.result.item.id);
  return [
    { id: 'earnings', label: 'Earnings-quality disagreements', detail: 'Both Jev’s category and computed cash conversion remain visible below.', count: missed('earnings').length, of: complete.length, items: ids(missed('earnings')) },
    { id: 'direction', label: 'Direction disagreements', detail: 'Compared with four-year revenue change and operating-margin movement.', count: missed('direction').length, of: complete.length, items: ids(missed('direction')) },
    { id: 'leverage', label: 'Leverage risk outside the computed band', detail: `More than ${LEVERAGE_BAND} points from a band built on debt to equity and a net-debt proxy.`, count: missed('leverage').length, of: complete.length, items: ids(missed('leverage')) },
    { id: 'capex', label: 'Capex-discipline disagreements', detail: 'Cash coverage of capital spending in every year, and a latest burden under a fifth of revenue.', count: missed('capex').length, of: complete.length, items: ids(missed('capex')) },
    { id: 'gaps', label: 'Statement gaps called incorrectly', detail: 'Empty and partial histories stay in the denominator.', count: gapWrong.length, of: rows.length, items: ids(gapWrong) },
  ];
}

function findings(rows, complete) {
  const lines = [];
  const disagreements = rows.filter(disagrees);
  if (disagreements.length) lines.push(`${disagreements.length} companies have a category disagreement between Jev’s direct statement reading and the small ratio cross-check. The report preserves both rather than treating the ratio as hidden ground truth.`);

  for (const row of complete.filter((entry) => !crossChecks(entry).earnings)) {
    lines.push(`${row.result.item.symbol}: earnings read as ${title(row.result.evaluation.earningsQuality).toLowerCase()}, computed ${title(row.ratio.earningsQuality).toLowerCase()} on cash conversion of ${value(row.ratio.cashConversion)} against a ${EARNINGS_CUT.toFixed(2)} cut.`);
  }

  if (complete.length) lines.push(`Every agreement count here is out of ${complete.length} companies. One company changing its answer moves a count by one in ${complete.length}, so read these as a smoke test and not as a rate.`);

  const blindToNulls = rows.filter((row) => row.ratio.statementGap === 'MISSING_CASH_FLOW' && row.result.evaluation.statementGap === 'NONE');
  if (blindToNulls.length) lines.push(`${blindToNulls.map((row) => row.result.item.symbol).join(' and ')} have four years on file with the cash-flow lines null, and the statements were called complete. The empty lines were not checked.`);

  const unread = rows.filter((row) => !hasStatements(row.result));
  if (unread.length) lines.push(`${unread.map((row) => row.result.item.symbol).join(', ')} have no issuer statements. The scores they were given describe the absence of data, so they are left out of the quality distribution and are not graded.`);
  return lines;
}

const asPercent = (number) => `${Math.round(number * 100)}%`;
const yesNo = (number) => (number >= 0.5 ? `Yes · ${asPercent(number)}` : `No · ${asPercent(1 - number)}`);
const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;

/** No labels: a company is graded against ratios worked out on the page, and only where they can be. */
const grade = {
  judge: (result) => {
    const ratio = computedRatios(result.item);
    if (!ratio.complete) return null;
    const { evaluation, answers } = result;
    const describe = (earnings, direction) => `${title(earnings)}, ${title(direction).toLowerCase()}`;
    return {
      agree: readAsComputed({ result, ratio }),
      expected: describe(ratio.earningsQuality, ratio.direction),
      got: describe(evaluation.earningsQuality, evaluation.direction),
      note: `Computed on the page, never sent: cash conversion ${value(ratio.cashConversion)} over four years, revenue ${value(ratio.revenueTrendPercent, 1)}% and operating margin ${value(ratio.marginTrendPoints, 1)} points from the first year to the latest.`,
      // Both answers have to hold, so the grade is as sure as the less sure of the two.
      confidence: Math.min(answers.earnings_quality.confidence, answers.direction.confidence),
    };
  },
};

function uncheckedVerdict(result, ratio) {
  const { evaluation, answers } = result;
  const gapRight = evaluation.statementGap === ratio.statementGap;
  const nothingOnFile = !hasStatements(result);
  return {
    headline: nothingOnFile ? 'No issuer statements to read · not graded' : `Quality ${evaluation.quality.toFixed(1)} of 6 · not cross-checked`,
    detail: nothingOnFile ? 'A fund, a commodity or a digital asset files no statements, so the scores below describe missing data and not the instrument.' : `The ratios cannot be computed: ${title(ratio.statementGap).toLowerCase()}.`,
    facts: [
      { label: 'Statement gap named', value: `${title(evaluation.statementGap)} · on file: ${title(ratio.statementGap).toLowerCase()}`, tone: gapRight ? 'good' : 'bad' },
      { label: 'Quality score given', value: levelOf(answers.quality), tone: nothingOnFile ? 'warn' : undefined },
      { label: 'Leverage risk given', value: levelOf(answers.leverage_risk), tone: nothingOnFile ? 'warn' : undefined },
    ],
  };
}

function verdict(result) {
  const ratio = computedRatios(result.item);
  if (!ratio.complete) return uncheckedVerdict(result, ratio);
  const { evaluation, answers } = result;
  const agrees = crossChecks({ result, ratio });
  const tone = (ok) => (ok ? 'good' : 'bad');
  return {
    eyebrow: 'The reading, beside ratios computed on the page',
    headline: `Quality ${evaluation.quality.toFixed(1)} of 6 · ${title(evaluation.direction).toLowerCase()}`,
    facts: [
      { label: 'Earnings quality', value: `${title(evaluation.earningsQuality)} · computed ${title(ratio.earningsQuality).toLowerCase()}, cash conversion ${value(ratio.cashConversion)}`, tone: tone(agrees.earnings) },
      { label: 'Direction', value: `${title(evaluation.direction)} · computed ${title(ratio.direction).toLowerCase()}, revenue ${value(ratio.revenueTrendPercent, 1)}% over the years on file`, tone: tone(agrees.direction) },
      { label: 'Leverage risk', value: `${levelOf(answers.leverage_risk)} · computed band ${ratio.leverageScore} of 6`, tone: agrees.leverage ? 'good' : 'warn' },
      { label: 'Cash covers capital spending', value: `${yesNo(answers.capex_discipline.noul)} · computed ${ratio.capexDiscipline ? 'yes' : 'no'}`, tone: agrees.capex ? 'good' : 'warn' },
      { label: 'Statement gap named', value: title(evaluation.statementGap), tone: tone(evaluation.statementGap === ratio.statementGap) },
    ],
  };
}

const present = {
  number: 162,
  problem: {
    headline: 'Four years of raw statement lines and no ratios. The reading has to come from the lines themselves.',
    stat: '16',
    statLabel: 'instruments read, 9 with statements complete enough to check',
  },
  hero: {
    item: 'FR-CVX',
    caption: 'Chevron: revenue down 21.8% across the four years and operating margin down 7.9 points. Read as deteriorating with cash-backed earnings, and the ratios say the same.',
  },
  answers: {
    caption: 'Two scores, two categories, a yes or no and the gap in the file. None of the ratios they are checked against was sent.',
    reveal: ['quality', 'leverage_risk', 'earnings_quality', 'direction'],
  },
  miss: {
    item: 'FR-JNJ',
    caption: 'Johnson & Johnson: earnings called mixed at 33% confidence. Operating cash flow is 0.99 of net income over four years, which the cross-check calls cash-backed.',
  },
  proof: {
    kpis: ['Companies read the way the ratios read them', 'Earnings-quality agreement', 'Direction agreement'],
    chart: 'baselines',
    closing: '6 of 9 companies read the way the arithmetic reads them, from raw lines, with n = 9 printed beside it.',
  },
};

export default {
  id: 'fundamental-read', title: 'Fundamental read', domain: 'screening',
  value: 'Read four years of statements directly, grade quality and leverage, and compare the judgement with transparent ratios.',
  tags: ['screening', 'fundamentals', 'statements', 'ratios'], dataClass: 'cached-real', readMinutes: 5, view: 'statements',
  itemLabel: (item) => `${item.symbol} · ${item.sector ?? 'no issuer sector'} · ${item.cacheCoverage.annualYears} annual years`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'),
  caveat: 'Only nine of the sixteen instruments have statements complete enough to check, and all nine are very large, healthy companies; this is a smoke test, not a benchmark.',
  grade, verdict, present,
  buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:data', state: 'demos/fundamental-read/demo.js#demo:state', questions: 'demos/fundamental-read/demo.js#demo:questions', evaluate: 'demos/fundamental-read/demo.js#demo:evaluate' },
};
