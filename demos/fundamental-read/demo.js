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
  const earningsAgree = complete.filter((row) => row.result.evaluation.earningsQuality === row.ratio.earningsQuality);
  const directionAgree = complete.filter((row) => row.result.evaluation.direction === row.ratio.direction);
  const leverageAgree = complete.filter((row) => Math.abs(row.result.evaluation.leverageRisk - row.ratio.leverageScore) <= 1.25);
  const capexAgree = complete.filter((row) => row.result.evaluation.capexDisciplined === row.ratio.capexDiscipline);
  const gapAgree = rows.filter((row) => row.result.evaluation.statementGap === row.ratio.statementGap);
  const disagreements = rows.filter((row) => row.ratio.complete && (row.result.evaluation.earningsQuality !== row.ratio.earningsQuality || row.result.evaluation.direction !== row.ratio.direction));
  return {
    note: `Sixteen cached symbols remain on the grid, including instruments without issuer statements. Computed ratios are report-only cross-checks and were not sent to Jev. ${context.note ?? ''}`,
    findings: findings(disagreements),
    kpis: [
      { label: 'Earnings-quality agreement', value: `${earningsAgree.length} of ${complete.length}`, context: 'Jev category against four-year cash conversion', tone: earningsAgree.length === complete.length ? 'good' : 'warn' },
      { label: 'Direction agreement', value: `${directionAgree.length} of ${complete.length}`, context: 'Jev direction against revenue and operating-margin trend', tone: directionAgree.length === complete.length ? 'good' : 'warn' },
      { label: 'Leverage-band agreement', value: `${leverageAgree.length} of ${complete.length}`, context: 'within 1.25 points of the computed band' },
      { label: 'Statement gaps exact', value: `${gapAgree.length} of ${rows.length}`, context: `${rows.filter((row) => row.ratio.statementGap !== 'NONE').length} instruments have incomplete histories`, tone: gapAgree.length === rows.length ? 'good' : 'warn' },
      { label: 'Capex-discipline agreement', value: `${capexAgree.length} of ${complete.length}`, context: 'cash coverage and latest capex burden' },
    ],
    distribution: Array.from({ length: 7 }, (_, bucket) => ({ label: `${bucket}/6 · ${questions.quality.criteria[bucket]}`, count: results.filter((result) => Math.round(result.evaluation.quality) === bucket).length })).filter((entry) => entry.count),
    qualityGrid: { title: 'All symbols · quality against leverage risk', points: results.map((result) => ({ id: result.item.id, label: result.item.symbol, quality: result.evaluation.quality, leverage: result.evaluation.leverageRisk, gap: computedRatios(result.item).statementGap !== 'NONE' })) },
    ratioRows: rows.map(({ result, ratio }) => ({ id: result.item.id, symbol: result.item.symbol, modelEarnings: title(result.evaluation.earningsQuality), computedEarnings: ratio.complete ? title(ratio.earningsQuality) : 'Not computable', modelDirection: title(result.evaluation.direction), computedDirection: ratio.complete ? title(ratio.direction) : 'Not computable', cashConversion: ratio.cashConversion, debtToEquity: ratio.debtToEquity, netDebtProxy: ratio.netDebtToEbitdaProxy, disagree: ratio.complete && (result.evaluation.earningsQuality !== ratio.earningsQuality || result.evaluation.direction !== ratio.direction), gap: title(ratio.statementGap) })),
    checks: [
      { id: 'earnings', label: 'Earnings-quality disagreements', detail: 'Both Jev’s category and computed cash conversion remain visible below.', count: complete.length - earningsAgree.length, of: complete.length, items: complete.filter((row) => row.result.evaluation.earningsQuality !== row.ratio.earningsQuality).map((row) => row.result.item.id) },
      { id: 'direction', label: 'Direction disagreements', detail: 'Compared with four-year revenue change and operating-margin movement.', count: complete.length - directionAgree.length, of: complete.length, items: complete.filter((row) => row.result.evaluation.direction !== row.ratio.direction).map((row) => row.result.item.id) },
      { id: 'gaps', label: 'Statement gaps called incorrectly', detail: 'Empty and partial histories stay in the denominator.', count: rows.length - gapAgree.length, of: rows.length, items: rows.filter((row) => row.result.evaluation.statementGap !== row.ratio.statementGap).map((row) => row.result.item.id) },
    ],
    topItems: [...results].sort((left, right) => right.evaluation.quality - left.evaluation.quality).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.quality.toFixed(1)} / 6` })),
  };
}
// #endregion

function findings(disagreements) {
  if (!disagreements.length) return [];
  return [`${disagreements.length} companies have a category disagreement between Jev’s direct statement reading and the small ratio cross-check. The report preserves both rather than treating the ratio as hidden ground truth.`];
}

export default {
  id: 'fundamental-read', title: 'Fundamental read', domain: 'screening',
  value: 'Read four years of statements directly, grade quality and leverage, and compare the judgement with transparent ratios.',
  tags: ['screening', 'fundamentals', 'statements', 'ratios'], dataClass: 'cached-real', readMinutes: 5, view: 'statements',
  itemLabel: (item) => `${item.symbol} · ${item.sector ?? 'no issuer sector'} · ${item.cacheCoverage.annualYears} annual years`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'),
  buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:data', state: 'demos/fundamental-read/demo.js#demo:state', questions: 'demos/fundamental-read/demo.js#demo:questions', evaluate: 'demos/fundamental-read/demo.js#demo:evaluate' },
};
