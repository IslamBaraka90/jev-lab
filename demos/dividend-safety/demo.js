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
  const cuts = complete.flatMap((row) => row.ratio.historicalCuts.map((cut) => ({ symbol: row.result.item.symbol, ...cut, safety: row.result.evaluation.safety, risk: row.result.evaluation.cutRisk })));
  const points = complete.map(({ result, ratio }) => ({ id: result.item.id, label: result.item.symbol, safety: result.evaluation.safety, yield: ratio.yieldPercent, highRisk: ratio.yieldPercent >= YIELD_TRAP && result.evaluation.safety < ADEQUATE }));
  return {
    note: `Yield and cover ratios are transparent report-only calculations; Jev received only the underlying statements. ${context.note ?? ''}`,
    findings: findings(rows, complete, cuts, points),
    kpis: kpis(rows, complete),
    baselines: baselines(complete),
    metrics: metrics(complete),
    yieldSafety: { title: 'Computed yield against Jev dividend safety', points },
    dividendRows: rows.map(dividendRow),
    historicalCuts: cuts,
    checks: checks(rows, complete),
    topItems: results.filter(hasStatements).sort((a, b) => a.evaluation.safety - b.evaluation.safety).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.safety.toFixed(1)} / 6` })),
    topItemsTitle: 'Weakest payouts first, issuers only',
  };
}
// #endregion

const ADEQUATE = 3;
const SAFETY_BAND = 1.25;
const YIELD_TRAP = 3;
const FULL_MARKS = 6;

/** Funds, gold and bitcoin pay nothing out of earnings. They are not graded and not listed as risky. */
const hasStatements = (result) => (result.item.annualStatements ?? []).length > 0;

/** The cover arithmetic took something off: the payout uses most of earnings or free cash flow, or debt is paying for it. */
const underPressure = (ratio) => ratio.safetyScore < FULL_MARKS;
const readAsWeak = (result) => result.evaluation.safety < ADEQUATE;
const sidesAgree = ({ result, ratio }) => readAsWeak(result) === underPressure(ratio);

/** Cover from the filed lines themselves. Working back from a rounded payout ratio turned 123 times into 100. */
function coverOf(item) {
  const latest = (item.annualStatements ?? []).at(-1);
  const paid = Math.abs(latest?.dividendsPaid ?? 0);
  if (!paid) return { paid: null, earnings: null, cash: null, freeCashFlow: null };
  const known = (number) => Number.isFinite(number);
  const freeCashFlow = known(latest.operatingCashFlow) && known(latest.capitalExpenditure) ? latest.operatingCashFlow + latest.capitalExpenditure : null;
  const times = (amount) => (known(amount) ? Number((amount / paid).toFixed(2)) : null);
  return { paid, freeCashFlow, earnings: times(latest.netIncome), cash: times(freeCashFlow) };
}

function dividendRow({ result, ratio }) {
  const cover = coverOf(result.item);
  return {
    id: result.item.id,
    symbol: result.item.symbol,
    safety: result.evaluation.safety,
    yield: ratio.yieldPercent,
    earningsCover: ratio.complete ? cover.earnings : null,
    cashCover: ratio.complete ? cover.cash : null,
    growth: ratio.dividendGrowthPercent,
    modelBreak: title(result.evaluation.firstToBreak),
    computedBreak: ratio.complete ? title(ratio.firstToBreak) : 'Not computable',
    debtFunded: result.evaluation.debtFunded,
    computedDebtFunded: ratio.complete ? ratio.debtFunded : null,
  };
}

function kpis(rows, complete) {
  const n = complete.length;
  const sides = complete.filter(sidesAgree);
  const inBand = complete.filter((row) => Math.abs(row.result.evaluation.safety - row.ratio.safetyScore) <= SAFETY_BAND);
  const topCoded = complete.filter((row) => row.ratio.safetyScore === FULL_MARKS);
  const debtKnown = complete.filter((row) => typeof row.ratio.debtFunded === 'boolean');
  const debtAgree = debtKnown.filter((row) => row.result.evaluation.debtFunded === row.ratio.debtFunded);
  const pressureNamed = complete.filter((row) => row.ratio.firstToBreak !== 'NONE');
  const pressureAgree = pressureNamed.filter((row) => row.result.evaluation.firstToBreak === row.ratio.firstToBreak);
  return [
    { label: 'Weak payers told from covered ones', value: `${sides.length} of ${n}`, context: `safety under ${ADEQUATE} of 6 exactly where the cover arithmetic finds the payout stretched; ${n} companies, none of which has cut`, tone: sides.length === n ? 'good' : 'warn' },
    { label: 'Safety-band agreement', value: `${inBand.length} of ${n}`, context: `within ${SAFETY_BAND} points of the cover formula, which gives ${topCoded.length} of ${n} its top score of 6, so a careful 4 or 5 counts as a miss`, tone: inBand.length === n ? 'good' : 'warn' },
    { label: 'Debt-funding agreement', value: `${debtAgree.length} of ${debtKnown.length}`, context: 'free-cash-flow shortfall plus rising debt where debt lines exist', tone: debtAgree.length === debtKnown.length ? 'good' : 'warn' },
    { label: 'First pressure agreement', value: `${pressureAgree.length} of ${pressureNamed.length}`, context: `only where the cover check names a pressure; it says "none" for ${n - pressureNamed.length} of ${n} and can never say share buybacks, so the rest is a difference of vocabulary` },
    { label: 'Complete issuer histories', value: `${n} of ${rows.length}`, context: 'funds and crypto remain visible as gaps' },
  ];
}

/** Rule: a yield of 3% or more means the payout is stretched. The naive screen, and it uses a price the model never saw. */
const yieldSaysWeak = (ratio) => ratio.yieldPercent >= YIELD_TRAP;

function baselines(complete) {
  if (!complete.length) return undefined;
  const n = complete.length;
  const byYield = complete.filter((row) => yieldSaysWeak(row.ratio) === underPressure(row.ratio)).length;
  const covered = complete.filter((row) => !underPressure(row.ratio)).length;
  const row = (count) => ({ value: count / n, display: `${count} of ${n}` });
  return [
    { label: 'Jev', detail: 'weak or covered, the same side as the cover arithmetic', model: true, ...row(complete.filter(sidesAgree).length) },
    { label: `Rule: a yield of ${YIELD_TRAP}% or more is stretched`, detail: 'one comparison, using the share price the model was not given', ...row(byYield) },
    { label: 'Always say covered', detail: 'the commonest side', ...row(Math.max(covered, n - covered)) },
  ];
}

function metrics(complete) {
  if (!complete.length) return undefined;
  const share = complete.filter(sidesAgree).length / complete.length;
  const contradictions = complete.filter(safetyAndRiskDisagree).length;
  return {
    headline: { label: 'Weak payers told from covered ones', value: share, n: complete.length },
    accuracy: share,
    contradictionRate: contradictions / complete.length,
  };
}

/** A payout scored weak cannot also be at low risk of a cut. */
const safetyAndRiskDisagree = ({ result }) => readAsWeak(result) && ['VERY_LOW', 'LOW'].includes(result.evaluation.cutRisk);

function checks(rows, complete) {
  const outside = complete.filter((row) => Math.abs(row.result.evaluation.safety - row.ratio.safetyScore) > SAFETY_BAND);
  const debtKnown = complete.filter((row) => typeof row.ratio.debtFunded === 'boolean');
  const debtWrong = debtKnown.filter((row) => row.result.evaluation.debtFunded !== row.ratio.debtFunded);
  const crossed = complete.filter(safetyAndRiskDisagree);
  const blind = rows.filter((row) => !row.ratio.complete && row.result.evaluation.debtFunded);
  const ids = (list) => list.map((row) => row.result.item.id);
  return [
    { id: 'safety', label: 'Safety outside formula band', detail: 'The model judgement and report-only formula both remain visible.', count: outside.length, of: complete.length, items: ids(outside) },
    { id: 'debt', label: 'Debt-funding disagreements', detail: 'Formula requires both insufficient free cash flow and rising debt; unavailable debt lines are excluded.', count: debtWrong.length, of: debtKnown.length, items: ids(debtWrong) },
    { id: 'risk', label: 'Weak safety beside a low cut risk', detail: 'Two answers about the same payout that do not agree with each other.', count: crossed.length, of: complete.length, items: ids(crossed) },
    { id: 'blind', label: 'Debt funding asserted without the lines to show it', detail: 'The cash-flow lines are missing, so nothing on file says where the payout came from.', count: blind.length, of: rows.length - complete.length, items: ids(blind) },
  ];
}

function findings(rows, complete, cuts, points) {
  const lines = [
    cuts.length ? `${cuts.length} historical aggregate payout cuts are retained as natural test cases with Jev’s answer shown beside them.` : 'The four-year cached histories contain no aggregate dividend cut; the report says so rather than manufacturing a test case.',
    `${points.filter((point) => point.highRisk).length} names combine at least ${YIELD_TRAP}% computed yield with a Jev safety score below ${ADEQUATE}/6.`,
  ];
  const stretched = complete.filter((row) => underPressure(row.ratio));
  const weakest = [...complete].sort((left, right) => left.result.evaluation.safety - right.result.evaluation.safety).slice(0, stretched.length);
  if (stretched.length && weakest.every((row) => underPressure(row.ratio))) {
    lines.push(`The ${stretched.length} payouts the cover arithmetic marks down (${stretched.map((row) => row.result.item.symbol).join(', ')}) are exactly the ${stretched.length} Jev scored lowest, from raw lines with no price and no ratios. The band agreement misses this because the formula stops at 6.`);
  }
  const crossed = complete.filter(safetyAndRiskDisagree);
  if (crossed.length) lines.push(`${crossed.map((row) => row.result.item.symbol).join(' and ')} scored under ${ADEQUATE} of 6 on safety and were still given a low cut risk. The risk bands have no stated meaning, so the two answers drift apart.`);
  const unread = rows.filter((row) => !hasStatements(row.result));
  if (unread.length) lines.push(`${unread.map((row) => row.result.item.symbol).join(', ')} have no statements. The low safety and high cut risk they were given describe missing data, so they are not graded and not listed among the weakest payouts.`);
  if (!cuts.length) lines.push(`${complete.length} companies and no dividend cut among them: this is an illustration, n = ${complete.length}, and not a test of whether a cut can be foreseen.`);
  return lines;
}

const asPercent = (number) => `${Math.round(number * 100)}%`;
const yesNo = (number) => (number >= 0.5 ? `Yes · ${asPercent(number)}` : `No · ${asPercent(1 - number)}`);
const money = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
const timesCovered = (cover) => (cover === null ? 'not computable' : `${cover.toFixed(2)}×`);
const coverTone = (cover) => (cover === null ? undefined : cover < 1 ? 'bad' : cover < 1.25 ? 'warn' : 'good');

/** No labels and no cuts on file: graded on whether the payout lands on the same side as the cover arithmetic. */
const grade = {
  judge: (result) => {
    const ratio = dividendRatios(result.item);
    if (!ratio.complete) return null;
    const cover = coverOf(result.item);
    const side = (weak) => (weak ? 'Payout stretched' : 'Payout covered');
    return {
      agree: sidesAgree({ result, ratio }),
      expected: side(underPressure(ratio)),
      got: side(readAsWeak(result)),
      note: `Worked out on the page, never sent: dividends covered ${timesCovered(cover.earnings)} by earnings and ${timesCovered(cover.cash)} by free cash flow, cover formula ${ratio.safetyScore} of 6.`,
      confidence: result.answers.safety.confidence,
    };
  },
};

function ungradedVerdict(result) {
  const { evaluation, answers } = result;
  const nothingOnFile = !hasStatements(result);
  return {
    headline: nothingOnFile ? 'No issuer statements · not graded' : `Safety ${evaluation.safety.toFixed(1)} of 6 · not cross-checked`,
    detail: nothingOnFile ? 'There is no payout history to read, so the answers below describe missing data and not a dividend at risk.' : 'The cash-flow lines are not on file, so cover cannot be worked out and nothing here is graded.',
    facts: [
      { label: 'Safety score given', value: `${answers.safety.legend?.[Math.round(evaluation.safety)] ?? 'Score'} · ${evaluation.safety.toFixed(1)} of 6`, tone: 'warn' },
      { label: 'Cut risk given', value: title(evaluation.cutRisk), tone: 'warn' },
      { label: 'Payout funded by debt', value: yesNo(answers.payout_funded_by_debt.noul), tone: evaluation.debtFunded ? 'bad' : undefined },
    ],
  };
}

function verdict(result) {
  const ratio = dividendRatios(result.item);
  if (!ratio.complete) return ungradedVerdict(result);
  const { item, evaluation, answers } = result;
  const cover = coverOf(item);
  const crossed = safetyAndRiskDisagree({ result });
  const debtKnown = typeof ratio.debtFunded === 'boolean';
  return {
    eyebrow: 'Can the payout survive a bad year',
    headline: `Safety ${evaluation.safety.toFixed(1)} of 6 · ${title(evaluation.cutRisk).toLowerCase()} cut risk`,
    detail: crossed ? 'A weak safety score beside a low cut risk: the two answers do not agree.' : undefined,
    facts: [
      { label: 'Cash cover', value: `${timesCovered(cover.cash)} · dividends ${money(cover.paid, item.currency)} against free cash flow ${money(cover.freeCashFlow, item.currency)}`, tone: coverTone(cover.cash) },
      { label: 'Earnings cover', value: timesCovered(cover.earnings), tone: coverTone(cover.earnings) },
      { label: 'Cover formula', value: `${ratio.safetyScore} of 6 · Jev ${evaluation.safety.toFixed(1)} of 6`, tone: sidesAgree({ result, ratio }) ? 'good' : 'bad' },
      { label: 'First to break', value: `${title(evaluation.firstToBreak)} · cover check: ${title(ratio.firstToBreak).toLowerCase()}` },
      { label: 'Payout funded by debt', value: `${yesNo(answers.payout_funded_by_debt.noul)} · computed ${debtKnown ? (ratio.debtFunded ? 'yes' : 'no') : 'not computable'}`, tone: !debtKnown ? undefined : evaluation.debtFunded === ratio.debtFunded ? 'good' : 'warn' },
      { label: 'Yield, never sent', value: `${ratio.yieldPercent.toFixed(2)}%` },
    ],
  };
}

const present = {
  number: 164,
  problem: {
    headline: 'A high yield is only good if the payout survives a bad year. The answer is in the cash-flow lines, not in the yield.',
    stat: '10',
    statLabel: 'dividend payers with four complete years on file',
  },
  hero: {
    item: 'DS-KO',
    caption: 'Coca-Cola paid $8.8B in dividends out of $5.3B of free cash flow: cover of 0.60 times. Safety 2.3 of 6, cash cover named as the first thing to break, and the arithmetic agrees.',
  },
  answers: {
    caption: 'A safety score, what breaks first, the cut risk and two yes-or-no checks, from raw lines with no share price and no ratios.',
    reveal: ['safety', 'first_to_break', 'cut_risk_12m', 'payout_funded_by_debt'],
  },
  miss: {
    item: 'DS-JPM',
    caption: 'JPMorgan has no capital expenditure line on file, so free cash flow cannot be worked out. The model still said, at 60%, that debt is funding the payout.',
  },
  proof: {
    kpis: ['Weak payers told from covered ones', 'Safety-band agreement', 'Debt-funding agreement'],
    chart: 'baselines',
    closing: 'The 4 payouts the cover arithmetic marks down are the 4 the model scored lowest, out of 10, with no price and no ratios sent.',
  },
};

export default {
  id: 'dividend-safety', title: 'Dividend safety', domain: 'screening',
  value: 'Judge whether a payout survives a bad year and show yield beside safety without leaking price to the model.',
  tags: ['screening', 'dividends', 'cash flow', 'yield'], dataClass: 'cached-real', readMinutes: 5, view: 'statements',
  itemLabel: (item) => `${item.symbol} · ${item.sector ?? 'no issuer sector'} · ${item.cacheCoverage.annualYears} annual years`,
  caveat: 'None of the ten companies here has cut its dividend, so the run can show that weak cover is recognised but not that a cut is foreseen; a point-in-time set with real cuts is planned.',
  grade, verdict, present,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:dividend-data', state: 'demos/dividend-safety/demo.js#demo:state', questions: 'demos/dividend-safety/demo.js#demo:questions', evaluate: 'demos/dividend-safety/demo.js#demo:evaluate' },
};
