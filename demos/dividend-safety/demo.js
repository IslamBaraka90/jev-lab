import { choice, noul, score } from '../lib/questions.js';
import { dividendRatios } from '../../src/services/ratios.js';

const BREAKS = ['EARNINGS_COVER', 'CASH_COVER', 'DEBT_MATURITIES', 'CYCLICALITY', 'SHARE_BUYBACKS', 'NONE'];
const RISKS = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Judge whether the dividend can survive a bad year from the raw payout, cash-flow and balance-sheet lines. Name the first pressure point. Do not estimate yield: no share price is supplied.',
    source_note: context.note, units_and_nulls: context.units, cache_coverage_note: context.coverage,
    company: { symbol: item.symbol, sector: item.sector, industry: item.industry, reporting_currency: item.currency },
    statement_coverage: item.cacheCoverage,
    annual_history_oldest_to_newest: item.annualStatements,
    current_shares_outstanding: item.sharesOutstanding,
    share_count_history: item.shareCountHistory,
    debt_maturities: item.debtMaturities,
  };
}
// #endregion

// #region demo:questions
const questions = {
  safety: score('How safe is the current dividend through a plausible bad year?', ['Unsustainable', 'Very weak', 'Weak', 'Adequate', 'Strong', 'Very strong', 'Fortress']),
  first_to_break: choice('What is most likely to break first under payout stress?', Object.fromEntries(BREAKS.map((key) => [key, title(key)]))),
  cut_risk_12m: choice('What is the risk of a dividend cut in the next twelve months?', Object.fromEntries(RISKS.map((key) => [key, title(key)]))),
  growth_sustainable: noul('Can the recent dividend growth rate be sustained by earnings and free cash flow?', { yes: 'Cash generation supports continued growth.', no: 'Recent growth outruns the available cover or history is absent.' }),
  payout_funded_by_debt: noul('Does the supplied evidence indicate that the latest payout is being funded by rising debt?', { yes: 'Free cash flow is insufficient and debt is rising.', no: 'The payout is covered or debt is not the funding source.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    safety: answers.safety.score, firstToBreak: answers.first_to_break.choice, cutRisk: answers.cut_risk_12m.choice,
    growthSustainable: answers.growth_sustainable.noul >= 0.5, debtFunded: answers.payout_funded_by_debt.noul >= 0.5,
    confidence: answers.safety.confidence,
    label: `${item.symbol} · safety ${answers.safety.score.toFixed(1)}/6 · ${title(answers.cut_risk_12m.choice)} cut risk`,
  };
}
// #endregion

// #region demo:report
function report(results, context = {}) {
  const rows = results.map((result) => ({ result, ratio: dividendRatios(result.item) }));
  const complete = rows.filter((row) => row.ratio.complete);
  const safetyAgree = complete.filter((row) => Math.abs(row.result.evaluation.safety - row.ratio.safetyScore) <= 1.25);
  const breakAgree = complete.filter((row) => row.result.evaluation.firstToBreak === row.ratio.firstToBreak);
  const debtKnown = complete.filter((row) => typeof row.ratio.debtFunded === 'boolean');
  const debtAgree = debtKnown.filter((row) => row.result.evaluation.debtFunded === row.ratio.debtFunded);
  const cuts = complete.flatMap((row) => row.ratio.historicalCuts.map((cut) => ({ symbol: row.result.item.symbol, ...cut, safety: row.result.evaluation.safety, risk: row.result.evaluation.cutRisk })));
  const points = complete.map(({ result, ratio }) => ({ id: result.item.id, label: result.item.symbol, safety: result.evaluation.safety, yield: ratio.yieldPercent, highRisk: ratio.yieldPercent >= 3 && result.evaluation.safety < 3 }));
  return {
    note: `Yield and cover ratios are transparent report-only calculations; Jev received only the underlying statements. ${context.note ?? ''}`,
    findings: [
      cuts.length ? `${cuts.length} historical aggregate payout cuts are retained as natural test cases with Jev’s answer shown beside them.` : 'The four-year cached histories contain no aggregate dividend cut; the report says so rather than manufacturing a test case.',
      `${points.filter((point) => point.highRisk).length} names combine at least 3% computed yield with a Jev safety score below 3/6.`,
    ],
    kpis: [
      { label: 'Complete issuer histories', value: `${complete.length} of ${rows.length}`, context: 'funds and crypto remain visible as gaps' },
      { label: 'Safety-band agreement', value: `${safetyAgree.length} of ${complete.length}`, context: 'within 1.25 points of the cover formula', tone: safetyAgree.length === complete.length ? 'good' : 'warn' },
      { label: 'First pressure agreement', value: `${breakAgree.length} of ${complete.length}`, context: 'Jev against the deterministic cover check' },
      { label: 'Debt-funding agreement', value: `${debtAgree.length} of ${debtKnown.length}`, context: 'free-cash-flow shortfall plus rising debt where debt lines exist' },
      { label: 'Historical cuts in cache', value: String(cuts.length), context: cuts.length ? 'reported below without hindsight leakage' : 'none in the four-year aggregate payout lines' },
    ],
    yieldSafety: { title: 'Computed yield against Jev dividend safety', points },
    dividendRows: rows.map(({ result, ratio }) => ({ id: result.item.id, symbol: result.item.symbol, safety: result.evaluation.safety, yield: ratio.yieldPercent, earningsCover: ratio.complete && ratio.payoutOnEarnings ? 1 / ratio.payoutOnEarnings : null, cashCover: ratio.complete && ratio.payoutOnFcf ? 1 / ratio.payoutOnFcf : null, growth: ratio.dividendGrowthPercent, modelBreak: title(result.evaluation.firstToBreak), computedBreak: ratio.complete ? title(ratio.firstToBreak) : 'Not computable', debtFunded: result.evaluation.debtFunded, computedDebtFunded: ratio.complete ? ratio.debtFunded : null })),
    historicalCuts: cuts,
    checks: [
      { id: 'safety', label: 'Safety outside formula band', detail: 'The model judgement and report-only formula both remain visible.', count: complete.length - safetyAgree.length, of: complete.length, items: complete.filter((row) => Math.abs(row.result.evaluation.safety - row.ratio.safetyScore) > 1.25).map((row) => row.result.item.id) },
      { id: 'debt', label: 'Debt-funding disagreements', detail: 'Formula requires both insufficient free cash flow and rising debt; unavailable debt lines are excluded.', count: debtKnown.length - debtAgree.length, of: debtKnown.length, items: debtKnown.filter((row) => row.result.evaluation.debtFunded !== row.ratio.debtFunded).map((row) => row.result.item.id) },
    ],
    topItems: [...results].sort((a, b) => b.evaluation.safety - a.evaluation.safety).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.safety.toFixed(1)} / 6` })),
  };
}
// #endregion

export default {
  id: 'dividend-safety', title: 'Dividend safety', domain: 'screening',
  value: 'Judge whether a payout survives a bad year and show yield beside safety without leaking price to the model.',
  tags: ['screening', 'dividends', 'cash flow', 'yield'], dataClass: 'cached-real', readMinutes: 5, view: 'statements', status: 'pending-recording',
  itemLabel: (item) => `${item.symbol} · ${item.sector ?? 'no issuer sector'} · ${item.cacheCoverage.annualYears} annual years`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:dividend-data', state: 'demos/dividend-safety/demo.js#demo:state', questions: 'demos/dividend-safety/demo.js#demo:questions', evaluate: 'demos/dividend-safety/demo.js#demo:evaluate' },
};
